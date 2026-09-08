import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	GovernanceRepository,
	type GovernanceActionRecord,
	type GovernanceAgendaItemRecord,
	type GovernanceAuthorityRuleRecord,
	type GovernanceBodyMembershipRecord,
	type GovernanceBodyRecord,
	type GovernanceConflictDeclarationRecord,
	type GovernanceDecisionRecord,
	type GovernanceEthicsCaseRecord,
	type GovernanceFrameworkRecord,
	type GovernanceMeetingAttendeeRecord,
	type GovernanceMeetingRecord,
	type GovernancePolicyAttestationRecord,
	type GovernancePolicyRecord
} from './governance-repository';

export class GovernanceValidationError extends Error {
	readonly code = 'GOVERNANCE_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'GovernanceValidationError';
	}
}

export type GovernanceWorkspace = {
	frameworks: GovernanceFrameworkRecord[];
	selectedFramework: GovernanceFrameworkRecord | null;
	bodies: GovernanceBodyRecord[];
	bodyMemberships: GovernanceBodyMembershipRecord[];
	authorityRules: GovernanceAuthorityRuleRecord[];
	meetings: GovernanceMeetingRecord[];
	meetingAttendees: GovernanceMeetingAttendeeRecord[];
	agendaItems: GovernanceAgendaItemRecord[];
	decisions: GovernanceDecisionRecord[];
	actions: GovernanceActionRecord[];
	policies: GovernancePolicyRecord[];
	policyAttestations: GovernancePolicyAttestationRecord[];
	conflicts: GovernanceConflictDeclarationRecord[];
	ethicsCases: GovernanceEthicsCaseRecord[];
	canManage: boolean;
	canApprove: boolean;
	canViewEthics: boolean;
	canManageEthics: boolean;
};

export type GovernanceFrameworkInput = {
	frameworkCode: string;
	title: string;
	purposeText: string;
	principlesText: string;
	effectiveFrom: string | Date;
	effectiveTo?: string | Date | null;
	ownerMemberId?: string | null;
};

export type GovernanceBodyInput = {
	frameworkPublicId: string;
	bodyCode: string;
	bodyType: 'board' | 'executive' | 'committee';
	title: string;
	mandateText: string;
	quorumCount: number | string;
	chairMemberId?: string | null;
	secretaryMemberId?: string | null;
};

export type BodyMembershipInput = {
	bodyPublicId: string;
	memberId: string;
	governanceRole: 'chair' | 'member' | 'secretary' | 'executive';
	votingRights: boolean;
	appointedOn: string | Date;
	termEndsOn?: string | Date | null;
};

export type AuthorityRuleInput = {
	frameworkPublicId: string;
	bodyPublicId: string;
	authorityCode: string;
	subjectDomain: string;
	actionKey: string;
	description: string;
	minAmount?: number | string | null;
	maxAmount?: number | string | null;
	currencyCode?: string | null;
	effectiveFrom: string | Date;
	effectiveTo?: string | Date | null;
};

export type MeetingInput = {
	bodyPublicId: string;
	meetingCode: string;
	meetingType: 'scheduled' | 'special' | 'written_resolution';
	title: string;
	scheduledAt: string | Date;
	locationText?: string | null;
};

export type MeetingAttendanceInput = {
	meetingPublicId: string;
	memberId: string;
	attendanceStatus: 'present' | 'apology' | 'absent';
};

export type AgendaItemInput = {
	meetingPublicId: string;
	agendaNumber: number | string;
	itemType: 'decision' | 'information' | 'review' | 'policy' | 'ethics';
	title: string;
	description: string;
	sourceDomain?: string | null;
	sourceRecordType?: string | null;
	sourcePublicId?: string | null;
	authorityActionKey?: string | null;
	decisionAmount?: number | string | null;
	currencyCode?: string | null;
};

export type DecisionInput = {
	agendaItemPublicId: string;
	decisionCode: string;
	decisionOutcome: 'approved' | 'rejected' | 'deferred' | 'noted';
	resolutionText: string;
};

export type ActionInput = {
	decisionPublicId: string;
	actionCode: string;
	title: string;
	description: string;
	ownerMemberId: string;
	dueDate: string | Date;
	sourceDomain?: string | null;
	sourceRecordType?: string | null;
	sourcePublicId?: string | null;
};

export type PolicyInput = {
	frameworkPublicId: string;
	approvalBodyPublicId: string;
	policyCode: string;
	title: string;
	policyCategory: 'corporate' | 'finance' | 'people' | 'safety' | 'information' | 'ethics' | 'other';
	scopeText: string;
	policyText: string;
	effectiveFrom: string | Date;
	reviewDueOn: string | Date;
	ownerMemberId?: string | null;
};

export type ConflictInput = {
	policyPublicId?: string | null;
	declarationType: 'actual' | 'potential' | 'perceived';
	subjectText: string;
	details: string;
	declaredOn: string | Date;
};

export type EthicsCaseInput = {
	policyPublicId?: string | null;
	anonymous?: boolean;
	caseCode: string;
	subjectText: string;
	description: string;
	severity: 'low' | 'medium' | 'high' | 'critical';
	ownerMemberId?: string | null;
};

const CODE = /^[A-Z0-9][A-Z0-9_.-]{1,63}$/;
const KEY = /^[a-z0-9][a-z0-9_.:-]{1,127}$/;
const DOMAIN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

function requiredText(value: string, label: string, maximum: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > maximum) {
		throw new GovernanceValidationError(`${label} must be between 1 and ${maximum} characters.`);
	}
	return normalized;
}

function optionalText(value: string | null | undefined, maximum: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > maximum) throw new GovernanceValidationError(`Text must not exceed ${maximum} characters.`);
	return normalized;
}

function coded(value: string, label: string): string {
	const normalized = value.trim().toUpperCase();
	if (!CODE.test(normalized)) throw new GovernanceValidationError(`${label} has an invalid format.`);
	return normalized;
}

function keyed(value: string, label: string): string {
	const normalized = value.trim().toLowerCase();
	if (!KEY.test(normalized)) throw new GovernanceValidationError(`${label} has an invalid format.`);
	return normalized;
}

function domain(value: string): string {
	const normalized = value.trim().toLowerCase();
	if (!DOMAIN.test(normalized)) throw new GovernanceValidationError('Subject domain has an invalid format.');
	return normalized;
}

function dateOnly(value: string | Date, label: string): Date {
	const parsed = value instanceof Date ? value : new Date(`${value.trim()}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) throw new GovernanceValidationError(`${label} is invalid.`);
	return new Date(`${parsed.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function optionalDateOnly(value: string | Date | null | undefined, label: string): Date | null {
	if (value === null || value === undefined || value === '') return null;
	return dateOnly(value, label);
}

function dateTime(value: string | Date, label: string): Date {
	const parsed = value instanceof Date ? value : new Date(value.trim());
	if (Number.isNaN(parsed.getTime())) throw new GovernanceValidationError(`${label} is invalid.`);
	return parsed;
}

function positiveInteger(value: number | string, label: string): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) throw new GovernanceValidationError(`${label} must be a positive whole number.`);
	return parsed;
}

function amount(value: number | string | null | undefined, label: string): string | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) throw new GovernanceValidationError(`${label} must be a non-negative number.`);
	return parsed.toFixed(4);
}

function currency(value: string | null | undefined): string | null {
	const normalized = value?.trim().toUpperCase() ?? '';
	if (!normalized) return null;
	if (!/^[A-Z]{3}$/.test(normalized)) throw new GovernanceValidationError('Currency must be a three-letter ISO code.');
	return normalized;
}

function referenceTriple(
	sourceDomain?: string | null,
	sourceRecordType?: string | null,
	sourcePublicId?: string | null
): { sourceDomain: string | null; sourceRecordType: string | null; sourcePublicId: string | null } {
	const values = [sourceDomain?.trim() ?? '', sourceRecordType?.trim() ?? '', sourcePublicId?.trim() ?? ''];
	const supplied = values.filter(Boolean).length;
	if (supplied !== 0 && supplied !== 3) {
		throw new GovernanceValidationError('Canonical source reference requires domain, record type and public ID together.');
	}
	return {
		sourceDomain: values[0] ? domain(values[0]) : null,
		sourceRecordType: values[1] ? requiredText(values[1], 'Source record type', 128) : null,
		sourcePublicId: values[2] ? requiredText(values[2], 'Source public ID', 191) : null
	};
}

export class GovernanceService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(this.db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async permissionFlags(actor: TenantActorContext) {
		await this.assertActiveActor(actor);
		const permissions = new PermissionService(this.db);
		const [view, manage, approve, ethicsView, ethicsManage] = await Promise.all([
			permissions.decide(actor, 'governance.view'),
			permissions.decide(actor, 'governance.manage'),
			permissions.decide(actor, 'governance.approve'),
			permissions.decide(actor, 'governance.ethics.view'),
			permissions.decide(actor, 'governance.ethics.manage')
		]);
		if (!view.allowed && !manage.allowed && !approve.allowed) {
			throw new RecordNotFoundError('Corporate governance workspace not found in the active scope.');
		}
		return {
			canManage: manage.allowed,
			canApprove: approve.allowed,
			canViewEthics: ethicsView.allowed || ethicsManage.allowed,
			canManageEthics: ethicsManage.allowed
		};
	}

	private async requirePermission(
		actor: TenantActorContext,
		permissionKey:
			| 'governance.manage'
			| 'governance.approve'
			| 'governance.ethics.view'
			| 'governance.ethics.manage'
	): Promise<void> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, permissionKey);
		if (!decision.allowed) throw new TenantAccessError('Corporate governance action is not permitted.');
	}

	private async activeMember(
		db: DatabaseExecutor,
		organisationId: string,
		memberId: string | null | undefined,
		label = 'Member'
	): Promise<string | null> {
		const normalized = memberId?.trim() || null;
		if (!normalized) return null;
		const row = await db
			.selectFrom('organisation_members')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('id', '=', normalized)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!row) throw new GovernanceValidationError(`${label} must be an active organisation member.`);
		return normalized;
	}

	private async appendEvidence(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		actionKey: string,
		subjectType: string,
		subjectPublicId: string,
		changeSummary: Record<string, unknown>,
		subfunctions: string[]
	): Promise<void> {
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: actor.memberId,
			actionKey,
			subjectType,
			subjectPublicId,
			correlationId: actor.correlationId,
			changeSummary,
			eventMetadata: { function: 'F02', subfunctions }
		});
		await enqueueOutboxEvent(db, {
			organisationId: actor.organisationId,
			topic: actionKey,
			aggregateType: subjectType,
			aggregatePublicId: subjectPublicId,
			correlationId: actor.correlationId,
			payload: { ...changeSummary, function: 'F02', subfunctions }
		});
	}

	private async requireFramework(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string,
		status?: 'draft' | 'approved'
	): Promise<GovernanceFrameworkRecord> {
		const framework = await new GovernanceRepository(db).findFrameworkByPublicId(organisationId, publicId.trim());
		if (!framework) throw new RecordNotFoundError('Governance framework not found.');
		if (status && framework.lifecycle_status !== status) {
			throw new GovernanceValidationError(
				status === 'draft'
					? 'Approved governance versions are immutable; create a controlled revision instead.'
					: 'This action requires an approved governance framework.'
			);
		}
		return framework;
	}

	private async requireBody(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string
	): Promise<GovernanceBodyRecord> {
		const body = await new GovernanceRepository(db).findBodyByPublicId(organisationId, publicId.trim());
		if (!body) throw new RecordNotFoundError('Governance body not found.');
		return body;
	}

	async getWorkspace(actor: TenantActorContext, selectedFrameworkPublicId?: string | null): Promise<GovernanceWorkspace> {
		const flags = await this.permissionFlags(actor);
		const repository = new GovernanceRepository(this.db);
		const frameworks = await repository.listFrameworks(actor.organisationId);
		let selectedFramework = frameworks[0] ?? null;
		if (selectedFrameworkPublicId?.trim()) {
			selectedFramework = (await repository.findFrameworkByPublicId(actor.organisationId, selectedFrameworkPublicId.trim())) ?? null;
			if (!selectedFramework) throw new RecordNotFoundError('Governance framework not found.');
		}
		if (!selectedFramework) {
			return {
				frameworks,
				selectedFramework: null,
				bodies: [],
				bodyMemberships: [],
				authorityRules: [],
				meetings: [],
				meetingAttendees: [],
				agendaItems: [],
				decisions: [],
				actions: [],
				policies: [],
				policyAttestations: [],
				conflicts: [],
				ethicsCases: [],
				...flags
			};
		}
		const [bodies, authorityRules, policies] = await Promise.all([
			repository.listBodies(selectedFramework.id),
			repository.listAuthorityRules(selectedFramework.id),
			repository.listPolicies(selectedFramework.id)
		]);
		const bodyIds = bodies.map((body) => body.id);
		const [bodyMemberships, meetings] = await Promise.all([
			repository.listBodyMemberships(bodyIds),
			repository.listMeetings(bodyIds)
		]);
		const meetingIds = meetings.map((meeting) => meeting.id);
		const [meetingAttendees, agendaItems, decisions] = await Promise.all([
			repository.listMeetingAttendees(meetingIds),
			repository.listAgendaItems(meetingIds),
			repository.listDecisions(meetingIds)
		]);
		const [actions, policyAttestations, conflicts, ethicsCases] = await Promise.all([
			repository.listActions(decisions.map((decision) => decision.id)),
			repository.listPolicyAttestations(policies.map((policy) => policy.id)),
			flags.canViewEthics ? repository.listConflicts(actor.organisationId) : Promise.resolve([]),
			flags.canViewEthics ? repository.listEthicsCases(actor.organisationId) : Promise.resolve([])
		]);
		return {
			frameworks,
			selectedFramework,
			bodies,
			bodyMemberships,
			authorityRules,
			meetings,
			meetingAttendees,
			agendaItems,
			decisions,
			actions,
			policies,
			policyAttestations,
			conflicts,
			ethicsCases,
			...flags
		};
	}

	async createFramework(actor: TenantActorContext, input: GovernanceFrameworkInput): Promise<GovernanceFrameworkRecord> {
		await this.requirePermission(actor, 'governance.manage');
		const frameworkCode = coded(input.frameworkCode, 'Framework code');
		const effectiveFrom = dateOnly(input.effectiveFrom, 'Effective from');
		const effectiveTo = optionalDateOnly(input.effectiveTo, 'Effective to');
		if (effectiveTo && effectiveTo < effectiveFrom) throw new GovernanceValidationError('Effective to must not be before effective from.');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			if (await repository.findLatestFrameworkVersion(actor.organisationId, frameworkCode)) {
				throw new GovernanceValidationError('A governance framework with this code already exists; create a controlled revision instead.');
			}
			const ownerMemberId = await this.activeMember(trx, actor.organisationId, input.ownerMemberId, 'Owner');
			const framework = await repository.insertFramework({
				organisation_id: actor.organisationId,
				public_id: this.publicIdFactory(),
				framework_code: frameworkCode,
				version_number: 1,
				title: requiredText(input.title, 'Title', 255),
				purpose_text: requiredText(input.purposeText, 'Purpose', 20_000),
				principles_text: requiredText(input.principlesText, 'Governance principles', 20_000),
				effective_from: effectiveFrom,
				effective_to: effectiveTo,
				lifecycle_status: 'draft',
				supersedes_governance_framework_id: null,
				owner_member_id: ownerMemberId,
				created_by_member_id: actor.memberId,
				approved_by_member_id: null,
				approved_at: null
			});
			await this.appendEvidence(trx, actor, 'governance.framework.create', 'governance_framework', framework.public_id, { frameworkCode, versionNumber: 1 }, ['F02.02']);
			return framework;
		});
	}

	async addBody(actor: TenantActorContext, input: GovernanceBodyInput): Promise<GovernanceBodyRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.requireFramework(trx, actor.organisationId, input.frameworkPublicId, 'draft');
			const chairMemberId = await this.activeMember(trx, actor.organisationId, input.chairMemberId, 'Chair');
			const secretaryMemberId = await this.activeMember(trx, actor.organisationId, input.secretaryMemberId, 'Secretary');
			const body = await new GovernanceRepository(trx).insertBody({
				organisation_id: actor.organisationId,
				governance_framework_id: framework.id,
				public_id: this.publicIdFactory(),
				body_code: coded(input.bodyCode, 'Body code'),
				body_type: input.bodyType,
				title: requiredText(input.title, 'Body title', 255),
				mandate_text: requiredText(input.mandateText, 'Mandate', 20_000),
				quorum_count: positiveInteger(input.quorumCount, 'Quorum'),
				chair_member_id: chairMemberId,
				secretary_member_id: secretaryMemberId,
				lifecycle_status: 'active',
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(trx, actor, 'governance.body.create', 'governance_body', body.public_id, { bodyCode: body.body_code, bodyType: body.body_type }, ['F02.01', 'F02.04', 'F02.05']);
			return body;
		});
	}

	async appointBodyMember(actor: TenantActorContext, input: BodyMembershipInput): Promise<GovernanceBodyMembershipRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			const body = await this.requireBody(trx, actor.organisationId, input.bodyPublicId);
			await this.requireFramework(trx, actor.organisationId, (await trx.selectFrom('governance_frameworks').select('public_id').where('id', '=', body.governance_framework_id).executeTakeFirstOrThrow()).public_id, 'draft');
			const memberId = await this.activeMember(trx, actor.organisationId, input.memberId, 'Appointee');
			if (!memberId) throw new GovernanceValidationError('Appointee is required.');
			if (await new GovernanceRepository(trx).findActiveBodyMembership(body.id, memberId)) {
				throw new GovernanceValidationError('This member already has an active appointment to the governance body.');
			}
			const appointedOn = dateOnly(input.appointedOn, 'Appointed on');
			const termEndsOn = optionalDateOnly(input.termEndsOn, 'Term ends on');
			if (termEndsOn && termEndsOn < appointedOn) throw new GovernanceValidationError('Term end must not be before appointment date.');
			const membership = await new GovernanceRepository(trx).insertBodyMembership({
				organisation_id: actor.organisationId,
				governance_body_id: body.id,
				public_id: this.publicIdFactory(),
				organisation_member_id: memberId,
				governance_role: input.governanceRole,
				voting_rights: input.votingRights ? 1 : 0,
				appointed_on: appointedOn,
				term_ends_on: termEndsOn,
				lifecycle_status: 'active',
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(trx, actor, 'governance.body.member.appoint', 'governance_body_membership', membership.public_id, { bodyPublicId: body.public_id, governanceRole: membership.governance_role, votingRights: Boolean(membership.voting_rights) }, ['F02.01', 'F02.04', 'F02.05']);
			return membership;
		});
	}

	async addAuthorityRule(actor: TenantActorContext, input: AuthorityRuleInput): Promise<GovernanceAuthorityRuleRecord> {
		await this.requirePermission(actor, 'governance.manage');
		const minAmount = amount(input.minAmount, 'Minimum amount');
		const maxAmount = amount(input.maxAmount, 'Maximum amount');
		const currencyCode = currency(input.currencyCode);
		if ((minAmount || maxAmount) && !currencyCode) throw new GovernanceValidationError('Currency is required for financial authority limits.');
		if (!minAmount && !maxAmount && currencyCode) throw new GovernanceValidationError('Currency is only valid when an authority amount is supplied.');
		if (minAmount && maxAmount && Number(maxAmount) < Number(minAmount)) throw new GovernanceValidationError('Maximum authority amount must not be below minimum amount.');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.requireFramework(trx, actor.organisationId, input.frameworkPublicId, 'draft');
			const body = await this.requireBody(trx, actor.organisationId, input.bodyPublicId);
			if (body.governance_framework_id !== framework.id) throw new GovernanceValidationError('Authority body must belong to the selected governance framework.');
			const effectiveFrom = dateOnly(input.effectiveFrom, 'Effective from');
			const effectiveTo = optionalDateOnly(input.effectiveTo, 'Effective to');
			if (effectiveTo && effectiveTo < effectiveFrom) throw new GovernanceValidationError('Authority effective-to date must not be before effective-from date.');
			const rule = await new GovernanceRepository(trx).insertAuthorityRule({
				organisation_id: actor.organisationId,
				governance_framework_id: framework.id,
				public_id: this.publicIdFactory(),
				authority_code: coded(input.authorityCode, 'Authority code'),
				subject_domain: domain(input.subjectDomain),
				action_key: keyed(input.actionKey, 'Authority action key'),
				description: requiredText(input.description, 'Authority description', 20_000),
				min_amount: minAmount,
				max_amount: maxAmount,
				currency_code: currencyCode,
				authority_body_id: body.id,
				effective_from: effectiveFrom,
				effective_to: effectiveTo,
				lifecycle_status: 'active',
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(trx, actor, 'governance.authority.create', 'governance_authority_rule', rule.public_id, { subjectDomain: rule.subject_domain, actionKey: rule.action_key, bodyPublicId: body.public_id, accessAuthority: false }, ['F02.03']);
			return rule;
		});
	}

	async approveFramework(actor: TenantActorContext, frameworkPublicId: string): Promise<GovernanceFrameworkRecord> {
		await this.requirePermission(actor, 'governance.approve');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.requireFramework(trx, actor.organisationId, frameworkPublicId, 'draft');
			const repository = new GovernanceRepository(trx);
			const bodies = (await repository.listBodies(framework.id)).filter((body) => body.lifecycle_status === 'active');
			if (!bodies.some((body) => body.body_type === 'board')) throw new GovernanceValidationError('Governance approval requires at least one active board.');
			const memberships = (await repository.listBodyMemberships(bodies.map((body) => body.id))).filter((membership) => membership.lifecycle_status === 'active');
			for (const body of bodies) {
				const bodyMemberships = memberships.filter((membership) => membership.governance_body_id === body.id);
				const voters = bodyMemberships.filter((membership) => Boolean(membership.voting_rights));
				if (voters.length < body.quorum_count) throw new GovernanceValidationError(`${body.title} requires at least ${body.quorum_count} active voting appointments before approval.`);
				if (body.chair_member_id && !bodyMemberships.some((membership) => membership.organisation_member_id === body.chair_member_id && membership.governance_role === 'chair')) throw new GovernanceValidationError(`${body.title} chair must have an active chair appointment.`);
				if (body.secretary_member_id && !bodyMemberships.some((membership) => membership.organisation_member_id === body.secretary_member_id && membership.governance_role === 'secretary')) throw new GovernanceValidationError(`${body.title} secretary must have an active secretary appointment.`);
			}
			const rules = (await repository.listAuthorityRules(framework.id)).filter((rule) => rule.lifecycle_status === 'active');
			if (rules.length === 0) throw new GovernanceValidationError('Governance approval requires at least one active delegation-of-authority rule.');
			if (framework.supersedes_governance_framework_id) {
				await repository.updateFramework(actor.organisationId, framework.supersedes_governance_framework_id, { lifecycle_status: 'superseded' });
			}
			const approved = await repository.updateFramework(actor.organisationId, framework.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: this.now() });
			await this.appendEvidence(trx, actor, 'governance.framework.approve', 'governance_framework', approved.public_id, { versionNumber: approved.version_number, bodyCount: bodies.length, authorityRuleCount: rules.length }, ['F02.01', 'F02.02', 'F02.03', 'F02.04', 'F02.05']);
			return approved;
		});
	}

	async reviseFramework(actor: TenantActorContext, frameworkPublicId: string): Promise<GovernanceFrameworkRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			const source = await this.requireFramework(trx, actor.organisationId, frameworkPublicId, 'approved');
			const repository = new GovernanceRepository(trx);
			const latest = await repository.findLatestFrameworkVersion(actor.organisationId, source.framework_code);
			if (latest && latest.id !== source.id && latest.lifecycle_status === 'draft') throw new GovernanceValidationError('A draft governance revision already exists.');
			const revision = await repository.insertFramework({
				organisation_id: actor.organisationId,
				public_id: this.publicIdFactory(),
				framework_code: source.framework_code,
				version_number: source.version_number + 1,
				title: source.title,
				purpose_text: source.purpose_text,
				principles_text: source.principles_text,
				effective_from: source.effective_from,
				effective_to: source.effective_to,
				lifecycle_status: 'draft',
				supersedes_governance_framework_id: source.id,
				owner_member_id: source.owner_member_id,
				created_by_member_id: actor.memberId,
				approved_by_member_id: null,
				approved_at: null
			});
			const bodies = await repository.listBodies(source.id);
			const bodyIdMap = new Map<string, GovernanceBodyRecord>();
			for (const body of bodies) {
				const clone = await repository.insertBody({ ...body, id: undefined, public_id: this.publicIdFactory(), governance_framework_id: revision.id, created_by_member_id: actor.memberId, created_at: undefined, updated_at: undefined });
				bodyIdMap.set(body.id, clone);
			}
			const memberships = await repository.listBodyMemberships(bodies.map((body) => body.id));
			for (const membership of memberships) {
				const cloneBody = bodyIdMap.get(membership.governance_body_id);
				if (!cloneBody) continue;
				await repository.insertBodyMembership({ ...membership, id: undefined, public_id: this.publicIdFactory(), governance_body_id: cloneBody.id, created_by_member_id: actor.memberId, created_at: undefined, updated_at: undefined });
			}
			for (const rule of await repository.listAuthorityRules(source.id)) {
				const cloneBody = bodyIdMap.get(rule.authority_body_id);
				if (!cloneBody) continue;
				await repository.insertAuthorityRule({ ...rule, id: undefined, public_id: this.publicIdFactory(), governance_framework_id: revision.id, authority_body_id: cloneBody.id, created_by_member_id: actor.memberId, created_at: undefined, updated_at: undefined });
			}
			await this.appendEvidence(trx, actor, 'governance.framework.revise', 'governance_framework', revision.public_id, { versionNumber: revision.version_number, supersedesPublicId: source.public_id }, ['F02.02', 'F02.03']);
			return revision;
		});
	}

	async createMeeting(actor: TenantActorContext, input: MeetingInput): Promise<GovernanceMeetingRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			const body = await this.requireBody(trx, actor.organisationId, input.bodyPublicId);
			const framework = await trx.selectFrom('governance_frameworks').selectAll().where('id', '=', body.governance_framework_id).where('organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			if (framework.lifecycle_status !== 'approved' || body.lifecycle_status !== 'active') throw new GovernanceValidationError('Meetings require an active body under an approved governance framework.');
			const meeting = await new GovernanceRepository(trx).insertMeeting({
				organisation_id: actor.organisationId,
				governance_body_id: body.id,
				public_id: this.publicIdFactory(),
				meeting_code: coded(input.meetingCode, 'Meeting code'),
				meeting_type: input.meetingType,
				title: requiredText(input.title, 'Meeting title', 255),
				scheduled_at: dateTime(input.scheduledAt, 'Scheduled date/time'),
				location_text: optionalText(input.locationText, 500),
				quorum_required_count: body.quorum_count,
				quorum_met: 0,
				chaired_by_member_id: body.chair_member_id,
				lifecycle_status: 'draft',
				minutes_text: null,
				created_by_member_id: actor.memberId,
				closed_by_member_id: null,
				closed_at: null
			});
			await this.appendEvidence(trx, actor, 'governance.meeting.create', 'governance_meeting', meeting.public_id, { bodyPublicId: body.public_id, meetingCode: meeting.meeting_code }, ['F02.01', 'F02.04', 'F02.05']);
			return meeting;
		});
	}

	async setMeetingAttendance(actor: TenantActorContext, input: MeetingAttendanceInput): Promise<void> {
		await this.requirePermission(actor, 'governance.manage');
		await this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const meeting = await repository.findMeetingByPublicId(actor.organisationId, input.meetingPublicId.trim());
			if (!meeting) throw new RecordNotFoundError('Governance meeting not found.');
			if (meeting.lifecycle_status !== 'draft') throw new GovernanceValidationError('Attendance can only be prepared while the meeting is draft.');
			const memberId = await this.activeMember(trx, actor.organisationId, input.memberId, 'Attendee');
			if (!memberId) throw new GovernanceValidationError('Attendee is required.');
			const membership = await repository.findActiveBodyMembership(meeting.governance_body_id, memberId);
			if (!membership) throw new GovernanceValidationError('Attendee must hold an active appointment to this governance body.');
			await repository.upsertMeetingAttendee({ organisation_id: actor.organisationId, governance_meeting_id: meeting.id, organisation_member_id: memberId, attendance_status: input.attendanceStatus, voting_eligible: membership.voting_rights, created_by_member_id: actor.memberId });
			await this.appendEvidence(trx, actor, 'governance.meeting.attendance', 'governance_meeting', meeting.public_id, { memberId, attendanceStatus: input.attendanceStatus, votingEligible: Boolean(membership.voting_rights) }, ['F02.01', 'F02.04', 'F02.05']);
		});
	}

	async addAgendaItem(actor: TenantActorContext, input: AgendaItemInput): Promise<GovernanceAgendaItemRecord> {
		await this.requirePermission(actor, 'governance.manage');
		const source = referenceTriple(input.sourceDomain, input.sourceRecordType, input.sourcePublicId);
		const decisionAmount = amount(input.decisionAmount, 'Decision amount');
		const currencyCode = currency(input.currencyCode);
		if (decisionAmount && !currencyCode) throw new GovernanceValidationError('Currency is required for a decision amount.');
		if (!decisionAmount && currencyCode) throw new GovernanceValidationError('Currency is only valid with a decision amount.');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const meeting = await repository.findMeetingByPublicId(actor.organisationId, input.meetingPublicId.trim());
			if (!meeting) throw new RecordNotFoundError('Governance meeting not found.');
			if (meeting.lifecycle_status !== 'draft') throw new GovernanceValidationError('Agenda items can only be added while the meeting is draft.');
			const item = await repository.insertAgendaItem({
				organisation_id: actor.organisationId,
				governance_meeting_id: meeting.id,
				public_id: this.publicIdFactory(),
				agenda_number: positiveInteger(input.agendaNumber, 'Agenda number'),
				item_type: input.itemType,
				title: requiredText(input.title, 'Agenda title', 255),
				description: requiredText(input.description, 'Agenda description', 20_000),
				source_domain: source.sourceDomain,
				source_record_type: source.sourceRecordType,
				source_public_id: source.sourcePublicId,
				authority_action_key: input.authorityActionKey?.trim() ? keyed(input.authorityActionKey, 'Authority action key') : null,
				decision_amount: decisionAmount,
				currency_code: currencyCode,
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(trx, actor, 'governance.agenda.create', 'governance_agenda_item', item.public_id, { meetingPublicId: meeting.public_id, itemType: item.item_type, sourceDomain: item.source_domain }, ['F02.01', 'F02.04', 'F02.05']);
			return item;
		});
	}

	async conveneMeeting(actor: TenantActorContext, meetingPublicId: string): Promise<GovernanceMeetingRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const meeting = await repository.findMeetingByPublicId(actor.organisationId, meetingPublicId.trim());
			if (!meeting) throw new RecordNotFoundError('Governance meeting not found.');
			if (meeting.lifecycle_status !== 'draft') throw new GovernanceValidationError('Only a draft meeting can be convened.');
			const attendees = await repository.listMeetingAttendees([meeting.id]);
			const presentVoters = attendees.filter((attendee) => attendee.attendance_status === 'present' && Boolean(attendee.voting_eligible));
			if (presentVoters.length < meeting.quorum_required_count) throw new GovernanceValidationError(`Meeting requires ${meeting.quorum_required_count} present voting members for quorum.`);
			if (meeting.chaired_by_member_id && !attendees.some((attendee) => attendee.organisation_member_id === meeting.chaired_by_member_id && attendee.attendance_status === 'present')) throw new GovernanceValidationError('The appointed chair must be present before the meeting can be convened.');
			const agendaItems = await repository.listAgendaItems([meeting.id]);
			if (agendaItems.length === 0) throw new GovernanceValidationError('Meeting requires at least one agenda item before it can be convened.');
			const convened = await repository.updateMeeting(actor.organisationId, meeting.id, { lifecycle_status: 'convened', quorum_met: 1 });
			await this.appendEvidence(trx, actor, 'governance.meeting.convene', 'governance_meeting', meeting.public_id, { presentVotingCount: presentVoters.length, quorumRequired: meeting.quorum_required_count }, ['F02.01', 'F02.04', 'F02.05']);
			return convened;
		});
	}

	private ruleCoversDecision(rule: GovernanceAuthorityRuleRecord, bodyId: string, item: GovernanceAgendaItemRecord, decidedAt: Date): boolean {
		if (rule.lifecycle_status !== 'active' || rule.authority_body_id !== bodyId) return false;
		if (rule.subject_domain !== (item.source_domain ?? 'general')) return false;
		if (rule.action_key !== item.authority_action_key) return false;
		const day = decidedAt.toISOString().slice(0, 10);
		if (rule.effective_from.toISOString().slice(0, 10) > day) return false;
		if (rule.effective_to && rule.effective_to.toISOString().slice(0, 10) < day) return false;
		if (item.decision_amount === null) return rule.min_amount === null && rule.max_amount === null;
		if (rule.currency_code !== item.currency_code) return false;
		const value = Number(item.decision_amount);
		if (rule.min_amount !== null && value < Number(rule.min_amount)) return false;
		if (rule.max_amount !== null && value > Number(rule.max_amount)) return false;
		return true;
	}

	async recordDecision(actor: TenantActorContext, input: DecisionInput): Promise<GovernanceDecisionRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const item = await repository.findAgendaItemByPublicId(actor.organisationId, input.agendaItemPublicId.trim());
			if (!item) throw new RecordNotFoundError('Governance agenda item not found.');
			if (await repository.findDecisionByAgendaItemId(item.id)) throw new GovernanceValidationError('This agenda item already has an immutable recorded decision.');
			const meeting = await trx.selectFrom('governance_meetings').selectAll().where('id', '=', item.governance_meeting_id).where('organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			if (meeting.lifecycle_status !== 'convened' || !meeting.quorum_met) throw new GovernanceValidationError('Decision recording requires a convened meeting with proven quorum.');
			const body = await trx.selectFrom('governance_bodies').selectAll().where('id', '=', meeting.governance_body_id).where('organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			const actorAttendance = await trx.selectFrom('governance_meeting_attendees').selectAll().where('governance_meeting_id', '=', meeting.id).where('organisation_member_id', '=', actor.memberId).where('attendance_status', '=', 'present').executeTakeFirst();
			if (!actorAttendance) throw new GovernanceValidationError('Decision recorder must be a present member of the governance body.');
			const now = this.now();
			let authorityRuleId: string | null = null;
			if (input.decisionOutcome !== 'noted') {
				if (!item.authority_action_key) throw new GovernanceValidationError('A decision authority action key is required for an approve/reject/defer resolution.');
				const framework = await trx.selectFrom('governance_frameworks').selectAll().where('id', '=', body.governance_framework_id).where('organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
				if (framework.lifecycle_status !== 'approved') throw new GovernanceValidationError('Decision authority must come from an approved governance framework.');
				const rules = await repository.listAuthorityRules(framework.id);
				const matchingRule = rules.find((rule) => this.ruleCoversDecision(rule, body.id, item, now));
				if (!matchingRule) throw new GovernanceValidationError('No approved delegation-of-authority rule covers this decision, body, domain and amount.');
				authorityRuleId = matchingRule.id;
			}
			const decision = await repository.insertDecision({
				organisation_id: actor.organisationId,
				governance_meeting_id: meeting.id,
				governance_agenda_item_id: item.id,
				governance_authority_rule_id: authorityRuleId,
				public_id: this.publicIdFactory(),
				decision_code: coded(input.decisionCode, 'Decision code'),
				decision_outcome: input.decisionOutcome,
				resolution_text: requiredText(input.resolutionText, 'Resolution', 100_000),
				decision_amount: item.decision_amount,
				currency_code: item.currency_code,
				supersedes_governance_decision_id: null,
				recorded_by_member_id: actor.memberId,
				decided_at: now
			});
			await this.appendEvidence(trx, actor, 'governance.decision.record', 'governance_decision', decision.public_id, { meetingPublicId: meeting.public_id, outcome: decision.decision_outcome, authorityRuleId, sourceDomain: item.source_domain, sourceRecordType: item.source_record_type, sourcePublicId: item.source_public_id }, ['F02.01', 'F02.03', 'F02.04', 'F02.05']);
			return decision;
		});
	}

	async createAction(actor: TenantActorContext, input: ActionInput): Promise<GovernanceActionRecord> {
		await this.requirePermission(actor, 'governance.manage');
		const source = referenceTriple(input.sourceDomain, input.sourceRecordType, input.sourcePublicId);
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const decision = await repository.findDecisionByPublicId(actor.organisationId, input.decisionPublicId.trim());
			if (!decision) throw new RecordNotFoundError('Governance decision not found.');
			if (decision.decision_outcome !== 'approved') throw new GovernanceValidationError('Actions can only be created from an approved governance decision.');
			const ownerMemberId = await this.activeMember(trx, actor.organisationId, input.ownerMemberId, 'Action owner');
			if (!ownerMemberId) throw new GovernanceValidationError('Action owner is required.');
			const action = await repository.insertAction({ organisation_id: actor.organisationId, governance_decision_id: decision.id, public_id: this.publicIdFactory(), action_code: coded(input.actionCode, 'Action code'), title: requiredText(input.title, 'Action title', 255), description: requiredText(input.description, 'Action description', 20_000), owner_member_id: ownerMemberId, due_date: dateOnly(input.dueDate, 'Due date'), lifecycle_status: 'open', source_domain: source.sourceDomain, source_record_type: source.sourceRecordType, source_public_id: source.sourcePublicId, completion_evidence: null, completed_by_member_id: null, completed_at: null, created_by_member_id: actor.memberId });
			await this.appendEvidence(trx, actor, 'governance.action.create', 'governance_action', action.public_id, { decisionPublicId: decision.public_id, ownerMemberId }, ['F02.01', 'F02.04', 'F02.05']);
			return action;
		});
	}

	async completeAction(actor: TenantActorContext, actionPublicId: string, completionEvidence: string): Promise<GovernanceActionRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const action = await repository.findActionByPublicId(actor.organisationId, actionPublicId.trim());
			if (!action) throw new RecordNotFoundError('Governance action not found.');
			if (action.lifecycle_status === 'completed') throw new GovernanceValidationError('Governance action is already completed.');
			const completed = await repository.updateAction(actor.organisationId, action.id, { lifecycle_status: 'completed', completion_evidence: requiredText(completionEvidence, 'Completion evidence', 20_000), completed_by_member_id: actor.memberId, completed_at: this.now() });
			await this.appendEvidence(trx, actor, 'governance.action.complete', 'governance_action', completed.public_id, { decisionId: completed.governance_decision_id }, ['F02.01', 'F02.04', 'F02.05']);
			return completed;
		});
	}

	async closeMeeting(actor: TenantActorContext, meetingPublicId: string, minutesText: string): Promise<GovernanceMeetingRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const meeting = await repository.findMeetingByPublicId(actor.organisationId, meetingPublicId.trim());
			if (!meeting) throw new RecordNotFoundError('Governance meeting not found.');
			if (meeting.lifecycle_status !== 'convened') throw new GovernanceValidationError('Only a convened meeting can be closed.');
			const closed = await repository.updateMeeting(actor.organisationId, meeting.id, { lifecycle_status: 'closed', minutes_text: requiredText(minutesText, 'Minutes', 100_000), closed_by_member_id: actor.memberId, closed_at: this.now() });
			await this.appendEvidence(trx, actor, 'governance.meeting.close', 'governance_meeting', closed.public_id, { quorumMet: Boolean(closed.quorum_met) }, ['F02.01', 'F02.04', 'F02.05']);
			return closed;
		});
	}

	async createPolicy(actor: TenantActorContext, input: PolicyInput): Promise<GovernancePolicyRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.requireFramework(trx, actor.organisationId, input.frameworkPublicId, 'approved');
			const body = await this.requireBody(trx, actor.organisationId, input.approvalBodyPublicId);
			if (body.governance_framework_id !== framework.id || body.lifecycle_status !== 'active') throw new GovernanceValidationError('Policy approval body must be active under the selected approved governance framework.');
			const policyCode = coded(input.policyCode, 'Policy code');
			const repository = new GovernanceRepository(trx);
			if (await repository.findLatestPolicyVersion(actor.organisationId, policyCode)) throw new GovernanceValidationError('A policy with this code already exists; create a controlled revision instead.');
			const ownerMemberId = await this.activeMember(trx, actor.organisationId, input.ownerMemberId, 'Policy owner');
			const effectiveFrom = dateOnly(input.effectiveFrom, 'Effective from');
			const reviewDueOn = dateOnly(input.reviewDueOn, 'Review due on');
			if (reviewDueOn < effectiveFrom) throw new GovernanceValidationError('Policy review date must not be before its effective date.');
			const policy = await repository.insertPolicy({ organisation_id: actor.organisationId, governance_framework_id: framework.id, approval_body_id: body.id, public_id: this.publicIdFactory(), policy_code: policyCode, version_number: 1, title: requiredText(input.title, 'Policy title', 255), policy_category: input.policyCategory, scope_text: requiredText(input.scopeText, 'Policy scope', 20_000), policy_text: requiredText(input.policyText, 'Policy text', 100_000), effective_from: effectiveFrom, review_due_on: reviewDueOn, lifecycle_status: 'draft', supersedes_governance_policy_id: null, owner_member_id: ownerMemberId, created_by_member_id: actor.memberId, approved_by_member_id: null, approved_at: null });
			await this.appendEvidence(trx, actor, 'governance.policy.create', 'governance_policy', policy.public_id, { policyCode, approvalBodyPublicId: body.public_id }, ['F02.06']);
			return policy;
		});
	}

	async approvePolicy(actor: TenantActorContext, policyPublicId: string): Promise<GovernancePolicyRecord> {
		await this.requirePermission(actor, 'governance.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const policy = await repository.findPolicyByPublicId(actor.organisationId, policyPublicId.trim());
			if (!policy) throw new RecordNotFoundError('Governance policy not found.');
			if (policy.lifecycle_status !== 'draft') throw new GovernanceValidationError('Only a draft policy can be approved.');
			if (!(await repository.findActiveBodyMembership(policy.approval_body_id, actor.memberId))) throw new GovernanceValidationError('Policy approver must hold an active appointment to the approval body.');
			if (policy.supersedes_governance_policy_id) await repository.updatePolicy(actor.organisationId, policy.supersedes_governance_policy_id, { lifecycle_status: 'superseded' });
			const approved = await repository.updatePolicy(actor.organisationId, policy.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: this.now() });
			await this.appendEvidence(trx, actor, 'governance.policy.approve', 'governance_policy', approved.public_id, { versionNumber: approved.version_number }, ['F02.06']);
			return approved;
		});
	}

	async revisePolicy(actor: TenantActorContext, policyPublicId: string): Promise<GovernancePolicyRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const source = await repository.findPolicyByPublicId(actor.organisationId, policyPublicId.trim());
			if (!source) throw new RecordNotFoundError('Governance policy not found.');
			if (source.lifecycle_status !== 'approved') throw new GovernanceValidationError('Only an approved policy can be revised.');
			const latest = await repository.findLatestPolicyVersion(actor.organisationId, source.policy_code);
			if (latest && latest.id !== source.id && latest.lifecycle_status === 'draft') throw new GovernanceValidationError('A draft policy revision already exists.');
			const revision = await repository.insertPolicy({ ...source, id: undefined, public_id: this.publicIdFactory(), version_number: source.version_number + 1, lifecycle_status: 'draft', supersedes_governance_policy_id: source.id, created_by_member_id: actor.memberId, approved_by_member_id: null, approved_at: null, created_at: undefined, updated_at: undefined });
			await this.appendEvidence(trx, actor, 'governance.policy.revise', 'governance_policy', revision.public_id, { versionNumber: revision.version_number, supersedesPublicId: source.public_id }, ['F02.06']);
			return revision;
		});
	}

	async attestPolicy(actor: TenantActorContext, policyPublicId: string, status: 'acknowledged' | 'declined', commentary?: string | null): Promise<GovernancePolicyAttestationRecord> {
		await this.assertActiveActor(actor);
		const permission = await new PermissionService(this.db).decide(actor, 'governance.view');
		if (!permission.allowed) throw new TenantAccessError('Corporate governance action is not permitted.');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const policy = await repository.findPolicyByPublicId(actor.organisationId, policyPublicId.trim());
			if (!policy) throw new RecordNotFoundError('Governance policy not found.');
			if (policy.lifecycle_status !== 'approved') throw new GovernanceValidationError('Only an approved policy can be attested.');
			if (await repository.findPolicyAttestation(policy.id, actor.memberId)) throw new GovernanceValidationError('This member has already attested this immutable policy version.');
			const attestation = await repository.insertPolicyAttestation({ organisation_id: actor.organisationId, governance_policy_id: policy.id, public_id: this.publicIdFactory(), organisation_member_id: actor.memberId, attestation_status: status, commentary: optionalText(commentary, 20_000), attested_at: this.now() });
			await this.appendEvidence(trx, actor, 'governance.policy.attest', 'governance_policy_attestation', attestation.public_id, { policyPublicId: policy.public_id, status }, ['F02.06']);
			return attestation;
		});
	}

	async declareConflict(actor: TenantActorContext, input: ConflictInput): Promise<GovernanceConflictDeclarationRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			let policyId: string | null = null;
			if (input.policyPublicId?.trim()) {
				const policy = await new GovernanceRepository(trx).findPolicyByPublicId(actor.organisationId, input.policyPublicId.trim());
				if (!policy || policy.lifecycle_status !== 'approved') throw new GovernanceValidationError('Conflict declaration can only reference an approved policy.');
				policyId = policy.id;
			}
			const conflict = await new GovernanceRepository(trx).insertConflict({ organisation_id: actor.organisationId, public_id: this.publicIdFactory(), organisation_member_id: actor.memberId, governance_policy_id: policyId, declaration_type: input.declarationType, subject_text: requiredText(input.subjectText, 'Conflict subject', 255), details: requiredText(input.details, 'Conflict details', 20_000), declared_on: dateOnly(input.declaredOn, 'Declared on'), lifecycle_status: 'open', reviewer_member_id: null, review_outcome: null, management_action: null, reviewed_at: null });
			await this.appendEvidence(trx, actor, 'governance.conflict.declare', 'governance_conflict_declaration', conflict.public_id, { declarationType: conflict.declaration_type }, ['F02.07']);
			return conflict;
		});
	}

	async reviewConflict(actor: TenantActorContext, conflictPublicId: string, outcome: string, managementAction: string, close = false): Promise<GovernanceConflictDeclarationRecord> {
		await this.requirePermission(actor, 'governance.ethics.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const conflict = await repository.findConflictByPublicId(actor.organisationId, conflictPublicId.trim());
			if (!conflict) throw new RecordNotFoundError('Conflict declaration not found.');
			const updated = await repository.updateConflict(actor.organisationId, conflict.id, { lifecycle_status: close ? 'closed' : 'managed', reviewer_member_id: actor.memberId, review_outcome: requiredText(outcome, 'Review outcome', 20_000), management_action: requiredText(managementAction, 'Management action', 20_000), reviewed_at: this.now() });
			await this.appendEvidence(trx, actor, 'governance.conflict.review', 'governance_conflict_declaration', updated.public_id, { lifecycleStatus: updated.lifecycle_status }, ['F02.07']);
			return updated;
		});
	}

	async createEthicsCase(actor: TenantActorContext, input: EthicsCaseInput): Promise<GovernanceEthicsCaseRecord> {
		await this.requirePermission(actor, 'governance.manage');
		return this.db.transaction().execute(async (trx) => {
			let policyId: string | null = null;
			if (input.policyPublicId?.trim()) {
				const policy = await new GovernanceRepository(trx).findPolicyByPublicId(actor.organisationId, input.policyPublicId.trim());
				if (!policy || policy.lifecycle_status !== 'approved') throw new GovernanceValidationError('Ethics case can only reference an approved policy.');
				policyId = policy.id;
			}
			const ownerMemberId = await this.activeMember(trx, actor.organisationId, input.ownerMemberId, 'Ethics case owner');
			const ethicsCase = await new GovernanceRepository(trx).insertEthicsCase({ organisation_id: actor.organisationId, public_id: this.publicIdFactory(), case_code: coded(input.caseCode, 'Case code'), governance_policy_id: policyId, reporter_member_id: input.anonymous ? null : actor.memberId, subject_text: requiredText(input.subjectText, 'Case subject', 255), description: requiredText(input.description, 'Case description', 20_000), severity: input.severity, lifecycle_status: 'open', owner_member_id: ownerMemberId, resolution_text: null, resolved_by_member_id: null, resolved_at: null, created_by_member_id: actor.memberId });
			await this.appendEvidence(trx, actor, 'governance.ethics.case.create', 'governance_ethics_case', ethicsCase.public_id, { severity: ethicsCase.severity, anonymous: Boolean(input.anonymous) }, ['F02.07']);
			return ethicsCase;
		});
	}

	async resolveEthicsCase(actor: TenantActorContext, casePublicId: string, resolutionText: string): Promise<GovernanceEthicsCaseRecord> {
		await this.requirePermission(actor, 'governance.ethics.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new GovernanceRepository(trx);
			const ethicsCase = await repository.findEthicsCaseByPublicId(actor.organisationId, casePublicId.trim());
			if (!ethicsCase) throw new RecordNotFoundError('Ethics case not found.');
			if (ethicsCase.lifecycle_status === 'resolved' || ethicsCase.lifecycle_status === 'closed') throw new GovernanceValidationError('Ethics case is already resolved.');
			const resolved = await repository.updateEthicsCase(actor.organisationId, ethicsCase.id, { lifecycle_status: 'resolved', resolution_text: requiredText(resolutionText, 'Resolution', 20_000), resolved_by_member_id: actor.memberId, resolved_at: this.now() });
			await this.appendEvidence(trx, actor, 'governance.ethics.case.resolve', 'governance_ethics_case', resolved.public_id, { severity: resolved.severity }, ['F02.07']);
			return resolved;
		});
	}
}
