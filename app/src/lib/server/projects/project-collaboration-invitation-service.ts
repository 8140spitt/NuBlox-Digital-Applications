import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { CrmRepository } from '$lib/server/crm/crm-repository';
import { getDatabase, type Database } from '$lib/server/db/database';
import { getEmailDelivery, type EmailDelivery } from '$lib/server/email/email-delivery';
import {
	ConcurrentUpdateError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectTeamRepository } from './project-team-repository';
import { ProjectTeamService } from './project-team-service';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const TERMINAL_PROJECT_STATUSES = new Set(['cancelled', 'archived']);

export class ProjectCollaborationInvitationAccessError extends Error {
	readonly code = 'PROJECT_COLLABORATION_INVITATION_ACCESS_DENIED';
	constructor(
		message = 'This project collaboration invitation is invalid, expired or unavailable.'
	) {
		super(message);
		this.name = 'ProjectCollaborationInvitationAccessError';
	}
}

export class ProjectCollaborationInvitationValidationError extends Error {
	readonly code = 'PROJECT_COLLABORATION_INVITATION_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProjectCollaborationInvitationValidationError';
	}
}

export type ProjectCollaborationInvitationSummary = {
	publicId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	invitingOrganisationName: string;
	crmOrganisationPartyPublicId: string;
	crmOrganisationName: string;
	crmLegalName: string;
	crmTradingName: string | null;
	contactPartyPublicId: string;
	contactName: string;
	email: string;
	roleNames: string[];
	expiresAt: Date;
};

export type ProjectCollaborationInvitationResult =
	| { mode: 'linked'; projectPublicId: string }
	| { mode: 'onboarding'; invitation: ProjectCollaborationInvitationSummary };

export type PendingProjectCollaborationInvitation = {
	publicId: string;
	crmOrganisationName: string;
	contactName: string;
	email: string;
	expiresAt: Date;
	createdAt: Date;
};

type FinaliseLookup = { tokenHash: string } | { authUserId: string };

function hashToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

function normaliseEmail(value: string): string {
	return value.trim().toLowerCase();
}

function normalisePublicId(value: string, label: string): string {
	const result = value.trim();
	if (!result || result.length > 64) {
		throw new ProjectCollaborationInvitationValidationError(`${label} is required.`);
	}
	return result;
}

function normaliseRoleKeys(input: readonly string[]): string[] {
	const roleKeys = [...new Set(input.map((value) => value.trim()).filter(Boolean))];
	if (roleKeys.length === 0) {
		throw new ProjectCollaborationInvitationValidationError('Select at least one project role.');
	}
	if (roleKeys.length > 12 || roleKeys.some((key) => !/^[a-z0-9_]{1,80}$/.test(key))) {
		throw new ProjectCollaborationInvitationValidationError(
			'One or more project roles are invalid.'
		);
	}
	return roleKeys;
}

function applicationBaseUrl(): string {
	const value = env.BETTER_AUTH_URL?.trim();
	if (!value)
		throw new Error('BETTER_AUTH_URL is required to build collaboration invitation links.');
	return value;
}

function displayPerson(input: {
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
}): string {
	const preferred = input.preferredName?.trim();
	const family = input.familyName?.trim();
	if (preferred && family) return `${preferred} ${family}`;
	if (preferred) return preferred;
	return [input.givenNames?.trim(), family].filter(Boolean).join(' ') || 'Customer contact';
}

function displayOrganisation(input: { legalName: string; tradingName: string | null }): string {
	return input.tradingName?.trim() || input.legalName;
}

export class ProjectCollaborationInvitationService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly emailDelivery: EmailDelivery = getEmailDelivery(),
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	async inviteFromCrm(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			crmPartyPublicId: string;
			contactPartyPublicId?: string | null;
			roleKeys: readonly string[];
		}
	): Promise<ProjectCollaborationInvitationResult> {
		await this.assertActiveActor(actor);
		const projectPublicId = normalisePublicId(input.projectPublicId, 'Project ID');
		const crmPartyPublicId = normalisePublicId(input.crmPartyPublicId, 'CRM organisation');
		const roleKeys = normaliseRoleKeys(input.roleKeys);
		const crmRepository = new CrmRepository(this.db);
		const candidate = await crmRepository.findCollaborationOrganisationByPublicId(
			actor.organisationId,
			crmPartyPublicId
		);
		if (!candidate) {
			throw new ProjectCollaborationInvitationValidationError('Select an active CRM organisation.');
		}

		if (candidate.linkedOrganisationStatus === 'active' && candidate.linkedOrganisationPublicId) {
			await new ProjectTeamService(this.db).inviteCrmParticipant(actor, {
				projectPublicId,
				crmPartyPublicId,
				roleKeys
			});
			return { mode: 'linked', projectPublicId };
		}
		if (candidate.linkedOrganisationId) {
			throw new ProjectCollaborationInvitationValidationError(
				'This customer is connected to a NuBlox organisation that is not currently active.'
			);
		}

		const contactPartyPublicId = normalisePublicId(
			input.contactPartyPublicId ?? '',
			'Customer contact'
		);
		const contacts = await crmRepository.listOrganisationContacts(
			actor.organisationId,
			candidate.partyId
		);
		const contact = contacts.find(
			(item) => item.personPublicId === contactPartyPublicId && item.status === 'active'
		);
		if (!contact || !contact.primaryEmail) {
			throw new ProjectCollaborationInvitationValidationError(
				'Select an active customer contact with a primary email address.'
			);
		}
		const email = normaliseEmail(contact.primaryEmail);
		const token = randomBytes(32).toString('base64url');
		const tokenHash = hashToken(token);
		const publicId = randomUUID();
		const expiresAt = new Date(this.now().getTime() + INVITATION_LIFETIME_MS);

		const invitation = await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const project = await trx
				.selectFrom('projects')
				.select(['id', 'public_id', 'project_number', 'name', 'status', 'owning_organisation_id'])
				.where('public_id', '=', projectPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!project || project.owning_organisation_id !== actor.organisationId) {
				throw new RecordNotFoundError('Project not found.');
			}
			const decision = await new PermissionService(trx).decideWithUmbrella(
				actor,
				'project.participant.manage',
				'project.manage',
				{ projectId: project.id }
			);
			if (!decision.allowed)
				throw new TenantAccessError('Project administration is not permitted.');
			if (TERMINAL_PROJECT_STATUSES.has(project.status)) {
				throw new ProjectCollaborationInvitationValidationError(
					'New collaboration cannot be added to a cancelled or archived project.'
				);
			}

			const lockedCrmParty = await trx
				.selectFrom('parties as party')
				.innerJoin('party_organisations as company', (join) =>
					join
						.onRef('company.party_id', '=', 'party.id')
						.onRef('company.organisation_id', '=', 'party.organisation_id')
				)
				.select([
					'party.id as partyId',
					'party.public_id as partyPublicId',
					'party.status as partyStatus',
					'company.legal_name as legalName',
					'company.trading_name as tradingName',
					'company.linked_organisation_id as linkedOrganisationId'
				])
				.where('party.organisation_id', '=', actor.organisationId)
				.where('party.public_id', '=', crmPartyPublicId)
				.where('party.party_kind', '=', 'organisation')
				.forUpdate()
				.executeTakeFirst();
			if (!lockedCrmParty || lockedCrmParty.partyStatus !== 'active') {
				throw new ProjectCollaborationInvitationValidationError(
					'The CRM organisation is unavailable.'
				);
			}
			if (lockedCrmParty.linkedOrganisationId) {
				throw new ProjectCollaborationInvitationValidationError(
					'The CRM organisation was connected while this invitation was being prepared. Reload and try again.'
				);
			}

			const lockedContact = await trx
				.selectFrom('party_organisation_contacts as relationship')
				.innerJoin('parties as person_party', (join) =>
					join
						.onRef('person_party.id', '=', 'relationship.person_party_id')
						.onRef('person_party.organisation_id', '=', 'relationship.organisation_id')
				)
				.innerJoin('party_persons as person', (join) =>
					join
						.onRef('person.party_id', '=', 'person_party.id')
						.onRef('person.organisation_id', '=', 'person_party.organisation_id')
				)
				.innerJoin('party_email_addresses as email_address', (join) =>
					join
						.onRef('email_address.party_id', '=', 'person_party.id')
						.onRef('email_address.organisation_id', '=', 'person_party.organisation_id')
						.on('email_address.is_primary', '=', 1)
				)
				.select([
					'person_party.id as partyId',
					'person_party.public_id as partyPublicId',
					'person_party.status as partyStatus',
					'person.preferred_name as preferredName',
					'person.given_names as givenNames',
					'person.family_name as familyName',
					'email_address.email as email'
				])
				.where('relationship.organisation_id', '=', actor.organisationId)
				.where('relationship.organisation_party_id', '=', lockedCrmParty.partyId)
				.where('person_party.public_id', '=', contactPartyPublicId)
				.where('relationship.ended_on', 'is', null)
				.forUpdate()
				.executeTakeFirst();
			if (
				!lockedContact ||
				lockedContact.partyStatus !== 'active' ||
				normaliseEmail(lockedContact.email) !== email
			) {
				throw new ProjectCollaborationInvitationValidationError(
					'The selected CRM contact is no longer available for this organisation.'
				);
			}

			const teamRepository = new ProjectTeamRepository(trx);
			const roleIds = await teamRepository.findActiveRoleTypeIdsByKeys(roleKeys);
			if (roleIds.length !== roleKeys.length) {
				throw new ProjectCollaborationInvitationValidationError(
					'One or more selected project roles are unavailable.'
				);
			}

			await trx
				.updateTable('project_collaboration_invitations')
				.set({ status: 'revoked', revoked_at: this.now() })
				.where('project_id', '=', project.id)
				.where('inviting_organisation_id', '=', actor.organisationId)
				.where('crm_organisation_party_id', '=', lockedCrmParty.partyId)
				.where('status', '=', 'pending')
				.execute();

			const inserted = await trx
				.insertInto('project_collaboration_invitations')
				.values({
					public_id: publicId,
					project_id: project.id,
					inviting_organisation_id: actor.organisationId,
					crm_organisation_party_id: lockedCrmParty.partyId,
					crm_contact_party_id: lockedContact.partyId,
					invite_email: email,
					token_hash: tokenHash,
					status: 'pending',
					invited_by_member_id: membership.id,
					auth_user_id: null,
					target_organisation_id: null,
					expires_at: expiresAt,
					accepted_at: null,
					revoked_at: null
				})
				.executeTakeFirstOrThrow();
			if (inserted.insertId === undefined)
				throw new Error('Collaboration invitation insert did not return an ID.');
			const invitationId = inserted.insertId.toString();
			await trx
				.insertInto('project_collaboration_invitation_roles')
				.values(
					roleIds.map((projectRoleTypeId) => ({
						project_id: project.id,
						project_collaboration_invitation_id: invitationId,
						project_role_type_id: projectRoleTypeId
					}))
				)
				.execute();

			const inviterOrganisation = await trx
				.selectFrom('organisations')
				.select(['legal_name', 'trading_name'])
				.where('id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			const roleRows = await trx
				.selectFrom('project_role_types')
				.select(['id', 'name'])
				.where('id', 'in', roleIds)
				.orderBy('name', 'asc')
				.execute();
			const summary: ProjectCollaborationInvitationSummary = {
				publicId,
				projectPublicId: project.public_id,
				projectNumber: project.project_number,
				projectName: project.name,
				invitingOrganisationName: displayOrganisation({
					legalName: inviterOrganisation.legal_name,
					tradingName: inviterOrganisation.trading_name
				}),
				crmOrganisationPartyPublicId: lockedCrmParty.partyPublicId,
				crmOrganisationName: displayOrganisation({
					legalName: lockedCrmParty.legalName,
					tradingName: lockedCrmParty.tradingName
				}),
				crmLegalName: lockedCrmParty.legalName,
				crmTradingName: lockedCrmParty.tradingName,
				contactPartyPublicId: lockedContact.partyPublicId,
				contactName: displayPerson(lockedContact),
				email,
				roleNames: roleRows.map((row) => row.name),
				expiresAt
			};
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'project.collaboration_invitation.created',
				subjectType: 'project_collaboration_invitation',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					crmOrganisationPartyPublicId: lockedCrmParty.partyPublicId,
					contactPartyPublicId: lockedContact.partyPublicId,
					email,
					roleKeys,
					expiresAt: expiresAt.toISOString()
				}
			});
			return summary;
		});

		const invitationUrl = new URL(
			`/collaborate/${encodeURIComponent(token)}`,
			applicationBaseUrl()
		).toString();
		await this.emailDelivery.send({
			to: invitation.email,
			subject: `${invitation.invitingOrganisationName} invited ${invitation.crmOrganisationName} to ${invitation.projectName} on NuBlox`,
			text: `${invitation.contactName},\n\n${invitation.invitingOrganisationName} has invited ${invitation.crmOrganisationName} to collaborate on ${invitation.projectNumber} · ${invitation.projectName} in NuBlox.\n\nAccept the invitation: ${invitationUrl}\n\nIf your organisation is not on NuBlox yet, the invitation will create and connect it without requiring you to send anyone an organisation ID.\n\nThis invitation expires on ${invitation.expiresAt.toISOString()}.`
		});
		return { mode: 'onboarding', invitation };
	}

	async getPendingInvitation(
		rawToken: string
	): Promise<ProjectCollaborationInvitationSummary | null> {
		const row = await this.findPendingInvitation({ tokenHash: hashToken(rawToken) });
		return row ? this.summaryFromRow(row) : null;
	}

	async listPendingForProject(
		actor: TenantActorContext,
		projectPublicIdInput: string
	): Promise<PendingProjectCollaborationInvitation[]> {
		await this.assertActiveActor(actor);
		const projectPublicId = normalisePublicId(projectPublicIdInput, 'Project ID');
		const project = await this.db
			.selectFrom('projects')
			.select(['id', 'owning_organisation_id'])
			.where('public_id', '=', projectPublicId)
			.executeTakeFirst();
		if (!project || project.owning_organisation_id !== actor.organisationId) return [];
		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			'project.participant.manage',
			'project.manage',
			{ projectId: project.id }
		);
		if (!decision.allowed) return [];
		const rows = await this.db
			.selectFrom('project_collaboration_invitations as invitation')
			.innerJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'invitation.crm_organisation_party_id')
					.onRef('company.organisation_id', '=', 'invitation.inviting_organisation_id')
			)
			.innerJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'invitation.crm_contact_party_id')
					.onRef('person.organisation_id', '=', 'invitation.inviting_organisation_id')
			)
			.select([
				'invitation.public_id as publicId',
				'invitation.invite_email as email',
				'invitation.expires_at as expiresAt',
				'invitation.created_at as createdAt',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName'
			])
			.where('invitation.project_id', '=', project.id)
			.where('invitation.inviting_organisation_id', '=', actor.organisationId)
			.where('invitation.status', '=', 'pending')
			.where('invitation.expires_at', '>', this.now())
			.orderBy('invitation.created_at', 'desc')
			.execute();
		return rows.map((row) => ({
			publicId: row.publicId,
			crmOrganisationName: displayOrganisation({
				legalName: row.legalName,
				tradingName: row.tradingName
			}),
			contactName: displayPerson(row),
			email: row.email,
			expiresAt: row.expiresAt,
			createdAt: row.createdAt
		}));
	}

	async bindSignupAuthUser(
		rawToken: string,
		emailInput: string,
		authUserId: string
	): Promise<void> {
		const email = normaliseEmail(emailInput);
		const tokenHash = hashToken(rawToken);
		const row = await this.db
			.selectFrom('project_collaboration_invitations')
			.select(['id', 'invite_email', 'auth_user_id', 'status', 'expires_at'])
			.where('token_hash', '=', tokenHash)
			.executeTakeFirst();
		if (
			!row ||
			row.status !== 'pending' ||
			row.expires_at <= this.now() ||
			normaliseEmail(row.invite_email) !== email ||
			(row.auth_user_id && row.auth_user_id !== authUserId)
		) {
			throw new ProjectCollaborationInvitationAccessError();
		}
		await this.db
			.updateTable('project_collaboration_invitations')
			.set({ auth_user_id: authUserId })
			.where('id', '=', row.id)
			.where('status', '=', 'pending')
			.executeTakeFirstOrThrow();
	}

	async activateVerifiedBootstrap(input: {
		authUserId: string;
		email: string;
		organisationId: string;
		organisationPublicId: string;
		memberId: string;
		userId: string;
		correlationId: string;
	}): Promise<string | null> {
		const pending = await this.db
			.selectFrom('project_collaboration_invitations')
			.select('id')
			.where('auth_user_id', '=', input.authUserId)
			.where('invite_email', '=', normaliseEmail(input.email))
			.where('status', '=', 'pending')
			.where('expires_at', '>', this.now())
			.orderBy('created_at', 'desc')
			.executeTakeFirst();
		if (!pending) return null;
		return this.finalise(
			{ authUserId: input.authUserId },
			{
				organisationId: input.organisationId,
				userId: input.userId,
				memberId: input.memberId,
				correlationId: input.correlationId
			},
			input.email
		);
	}

	async acceptExistingOrganisation(
		rawToken: string,
		actor: TenantActorContext,
		actorEmail: string
	): Promise<string> {
		return this.finalise({ tokenHash: hashToken(rawToken) }, actor, actorEmail);
	}

	async revoke(
		actor: TenantActorContext,
		input: { projectPublicId: string; invitationPublicId: string }
	): Promise<void> {
		await this.assertActiveActor(actor);
		const projectPublicId = normalisePublicId(input.projectPublicId, 'Project ID');
		const invitationPublicId = normalisePublicId(input.invitationPublicId, 'Invitation ID');
		return this.db.transaction().execute(async (trx) => {
			const project = await trx
				.selectFrom('projects')
				.select(['id', 'owning_organisation_id'])
				.where('public_id', '=', projectPublicId)
				.executeTakeFirst();
			if (!project || project.owning_organisation_id !== actor.organisationId) {
				throw new RecordNotFoundError('Project not found.');
			}
			const decision = await new PermissionService(trx).decideWithUmbrella(
				actor,
				'project.participant.manage',
				'project.manage',
				{ projectId: project.id }
			);
			if (!decision.allowed) throw new TenantAccessError();
			const result = await trx
				.updateTable('project_collaboration_invitations')
				.set({ status: 'revoked', revoked_at: this.now() })
				.where('public_id', '=', invitationPublicId)
				.where('project_id', '=', project.id)
				.where('inviting_organisation_id', '=', actor.organisationId)
				.where('status', '=', 'pending')
				.executeTakeFirst();
			if (result.numUpdatedRows !== 1n) {
				throw new ProjectCollaborationInvitationValidationError(
					'That collaboration invitation is no longer pending.'
				);
			}
		});
	}

	private async findPendingInvitation(lookup: FinaliseLookup) {
		let query = this.db
			.selectFrom('project_collaboration_invitations as invitation')
			.innerJoin('projects as project', 'project.id', 'invitation.project_id')
			.innerJoin('organisations as inviter', 'inviter.id', 'invitation.inviting_organisation_id')
			.innerJoin('parties as company_party', (join) =>
				join
					.onRef('company_party.id', '=', 'invitation.crm_organisation_party_id')
					.onRef('company_party.organisation_id', '=', 'invitation.inviting_organisation_id')
			)
			.innerJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'company_party.id')
					.onRef('company.organisation_id', '=', 'company_party.organisation_id')
			)
			.innerJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'invitation.crm_contact_party_id')
					.onRef('person.organisation_id', '=', 'invitation.inviting_organisation_id')
			)
			.select([
				'invitation.id as id',
				'invitation.public_id as publicId',
				'invitation.invite_email as email',
				'invitation.expires_at as expiresAt',
				'invitation.auth_user_id as authUserId',
				'project.id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'project.status as projectStatus',
				'invitation.inviting_organisation_id as invitingOrganisationId',
				'invitation.invited_by_member_id as invitedByMemberId',
				'inviter.legal_name as inviterLegalName',
				'inviter.trading_name as inviterTradingName',
				'company_party.public_id as crmOrganisationPartyPublicId',
				'company.legal_name as crmLegalName',
				'company.trading_name as crmTradingName',
				'company.linked_organisation_id as linkedOrganisationId',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName'
			])
			.where('invitation.status', '=', 'pending')
			.where('invitation.expires_at', '>', this.now());
		query =
			'tokenHash' in lookup
				? query.where('invitation.token_hash', '=', lookup.tokenHash)
				: query.where('invitation.auth_user_id', '=', lookup.authUserId);
		return query.executeTakeFirst();
	}

	private async summaryFromRow(
		row: NonNullable<
			Awaited<ReturnType<ProjectCollaborationInvitationService['findPendingInvitation']>>
		>
	): Promise<ProjectCollaborationInvitationSummary> {
		const roles = await this.db
			.selectFrom('project_collaboration_invitation_roles as assignment')
			.innerJoin('project_role_types as role', 'role.id', 'assignment.project_role_type_id')
			.select('role.name')
			.where('assignment.project_collaboration_invitation_id', '=', row.id)
			.where('assignment.project_id', '=', row.projectId)
			.orderBy('role.name', 'asc')
			.execute();
		return {
			publicId: row.publicId,
			projectPublicId: row.projectPublicId,
			projectNumber: row.projectNumber,
			projectName: row.projectName,
			invitingOrganisationName: displayOrganisation({
				legalName: row.inviterLegalName,
				tradingName: row.inviterTradingName
			}),
			crmOrganisationPartyPublicId: row.crmOrganisationPartyPublicId,
			crmOrganisationName: displayOrganisation({
				legalName: row.crmLegalName,
				tradingName: row.crmTradingName
			}),
			crmLegalName: row.crmLegalName,
			crmTradingName: row.crmTradingName,
			contactPartyPublicId: '',
			contactName: displayPerson(row),
			email: row.email,
			roleNames: roles.map((role) => role.name),
			expiresAt: row.expiresAt
		};
	}

	private async finalise(
		lookup: FinaliseLookup,
		actor: TenantActorContext,
		actorEmailInput: string
	): Promise<string> {
		const actorEmail = normaliseEmail(actorEmailInput);
		return this.db.transaction().execute(async (trx) => {
			const actorMembership = await this.assertActiveActor(actor, trx);
			const organisationManage = await new PermissionService(trx).decide(
				actor,
				'organisation.manage'
			);
			if (!organisationManage.allowed) {
				throw new ProjectCollaborationInvitationAccessError(
					'Organisation administrator authority is required to connect this company to NuBlox.'
				);
			}

			let invitationQuery = trx
				.selectFrom('project_collaboration_invitations as invitation')
				.innerJoin('projects as project', 'project.id', 'invitation.project_id')
				.innerJoin('parties as company_party', (join) =>
					join
						.onRef('company_party.id', '=', 'invitation.crm_organisation_party_id')
						.onRef('company_party.organisation_id', '=', 'invitation.inviting_organisation_id')
				)
				.innerJoin('party_organisations as company', (join) =>
					join
						.onRef('company.party_id', '=', 'company_party.id')
						.onRef('company.organisation_id', '=', 'company_party.organisation_id')
				)
				.select([
					'invitation.id as id',
					'invitation.public_id as publicId',
					'invitation.invite_email as email',
					'invitation.status as status',
					'invitation.expires_at as expiresAt',
					'invitation.auth_user_id as authUserId',
					'invitation.inviting_organisation_id as invitingOrganisationId',
					'invitation.invited_by_member_id as invitedByMemberId',
					'project.id as projectId',
					'project.public_id as projectPublicId',
					'project.status as projectStatus',
					'project.owning_organisation_id as owningOrganisationId',
					'company_party.public_id as crmOrganisationPartyPublicId',
					'company.linked_organisation_id as linkedOrganisationId'
				])
				.forUpdate();
			invitationQuery =
				'tokenHash' in lookup
					? invitationQuery.where('invitation.token_hash', '=', lookup.tokenHash)
					: invitationQuery.where('invitation.auth_user_id', '=', lookup.authUserId);
			const invitation = await invitationQuery.executeTakeFirst();
			if (!invitation || invitation.status !== 'pending') {
				throw new ProjectCollaborationInvitationAccessError();
			}
			if (invitation.expiresAt <= this.now()) {
				await trx
					.updateTable('project_collaboration_invitations')
					.set({ status: 'expired' })
					.where('id', '=', invitation.id)
					.where('status', '=', 'pending')
					.execute();
				throw new ProjectCollaborationInvitationAccessError();
			}
			if (normaliseEmail(invitation.email) !== actorEmail) {
				throw new ProjectCollaborationInvitationAccessError(
					'This invitation is addressed to a different verified email address.'
				);
			}
			if (TERMINAL_PROJECT_STATUSES.has(invitation.projectStatus)) {
				throw new ProjectCollaborationInvitationValidationError(
					'This project can no longer accept new participants.'
				);
			}
			if (invitation.owningOrganisationId !== invitation.invitingOrganisationId) {
				throw new ProjectCollaborationInvitationAccessError();
			}
			if (actor.organisationId === invitation.invitingOrganisationId) {
				throw new ProjectCollaborationInvitationValidationError(
					'The inviting organisation cannot accept its own external collaboration invitation.'
				);
			}
			const targetOrganisation = await trx
				.selectFrom('organisations')
				.select(['id', 'public_id', 'legal_name', 'trading_name', 'status'])
				.where('id', '=', actor.organisationId)
				.forUpdate()
				.executeTakeFirst();
			if (!targetOrganisation || targetOrganisation.status !== 'active') {
				throw new ProjectCollaborationInvitationAccessError(
					'The selected NuBlox organisation is not active.'
				);
			}
			if (
				invitation.linkedOrganisationId &&
				invitation.linkedOrganisationId !== actor.organisationId
			) {
				throw new ProjectCollaborationInvitationValidationError(
					'This CRM organisation has already been connected to another NuBlox organisation.'
				);
			}
			const conflictingLink = await trx
				.selectFrom('party_organisations')
				.select('party_id')
				.where('organisation_id', '=', invitation.invitingOrganisationId)
				.where('linked_organisation_id', '=', actor.organisationId)
				.where(
					'party_id',
					'!=',
					trx
						.selectFrom('parties')
						.select('id')
						.where('organisation_id', '=', invitation.invitingOrganisationId)
						.where('public_id', '=', invitation.crmOrganisationPartyPublicId)
				)
				.executeTakeFirst();
			if (conflictingLink) {
				throw new ProjectCollaborationInvitationValidationError(
					'This NuBlox organisation is already connected to a different CRM organisation for the inviter.'
				);
			}
			await trx
				.updateTable('party_organisations')
				.set({ linked_organisation_id: actor.organisationId })
				.where('organisation_id', '=', invitation.invitingOrganisationId)
				.where(
					'party_id',
					'=',
					trx
						.selectFrom('parties')
						.select('id')
						.where('organisation_id', '=', invitation.invitingOrganisationId)
						.where('public_id', '=', invitation.crmOrganisationPartyPublicId)
				)
				.executeTakeFirstOrThrow();

			const teamRepository = new ProjectTeamRepository(trx);
			const roleRows = await trx
				.selectFrom('project_collaboration_invitation_roles')
				.select('project_role_type_id')
				.where('project_id', '=', invitation.projectId)
				.where('project_collaboration_invitation_id', '=', invitation.id)
				.execute();
			const roleIds = roleRows.map((row) => row.project_role_type_id);
			if (roleIds.length === 0) {
				throw new ProjectCollaborationInvitationValidationError(
					'This collaboration invitation no longer has a project role.'
				);
			}
			const current = await teamRepository.findParticipationForUpdate(
				invitation.projectId,
				actor.organisationId
			);
			if (!current) {
				await teamRepository.insertInvitation(
					invitation.projectId,
					actor.organisationId,
					invitation.invitedByMemberId
				);
			} else if (current.status === 'active') {
				throw new ProjectCollaborationInvitationValidationError(
					'This organisation already participates in the project.'
				);
			} else if (current.status !== 'invited') {
				const reinvited = await teamRepository.reinviteParticipation(
					invitation.projectId,
					actor.organisationId,
					current.status,
					invitation.invitedByMemberId
				);
				if (!reinvited) throw new ConcurrentUpdateError();
			}
			const activated = await teamRepository.updateParticipationStatus({
				projectId: invitation.projectId,
				participantOrganisationId: actor.organisationId,
				fromStatus: 'invited',
				toStatus: 'active',
				joinedAt: this.now(),
				leftAt: null
			});
			if (!activated) throw new ConcurrentUpdateError();
			await teamRepository.replaceOrganisationRoles(
				invitation.projectId,
				actor.organisationId,
				roleIds
			);
			const currentMember = await teamRepository.findProjectMemberForUpdate(
				invitation.projectId,
				actor.organisationId,
				actorMembership.id
			);
			await teamRepository.activateProjectMember({
				projectId: invitation.projectId,
				participantOrganisationId: actor.organisationId,
				organisationMemberId: actorMembership.id,
				joinedAt: this.now(),
				currentStatus: currentMember?.status ?? null
			});
			await teamRepository.replaceMemberRoles({
				projectId: invitation.projectId,
				participantOrganisationId: actor.organisationId,
				organisationMemberId: actorMembership.id,
				roleTypeIds: []
			});

			const marked = await trx
				.updateTable('project_collaboration_invitations')
				.set({
					status: 'accepted',
					target_organisation_id: actor.organisationId,
					accepted_at: this.now(),
					revoked_at: null
				})
				.where('id', '=', invitation.id)
				.where('status', '=', 'pending')
				.executeTakeFirst();
			if (marked.numUpdatedRows !== 1n) throw new ConcurrentUpdateError();

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: invitation.invitingOrganisationId,
				actorUserId: actor.userId,
				actorMemberId: actorMembership.id,
				projectId: invitation.projectId,
				actionKey: 'crm.party.platform_organisation_linked_by_collaboration',
				subjectType: 'crm_party',
				subjectPublicId: invitation.crmOrganisationPartyPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					targetOrganisationPublicId: targetOrganisation.public_id,
					invitationPublicId: invitation.publicId
				}
			});
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actorMembership.id,
				projectId: invitation.projectId,
				actionKey: 'project.collaboration_invitation.accepted',
				subjectType: 'project_collaboration_invitation',
				subjectPublicId: invitation.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					projectPublicId: invitation.projectPublicId,
					targetOrganisationPublicId: targetOrganisation.public_id
				}
			});
			return invitation.projectPublicId;
		});
	}
}
