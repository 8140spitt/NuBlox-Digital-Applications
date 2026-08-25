import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import { assertVerifiedAuthUser } from '$lib/server/auth/verified-auth-user';
import { recoverVerifiedPlatformIdentity } from '$lib/server/auth/verified-identity-recovery';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { getEmailDelivery, type EmailDelivery } from '$lib/server/email/email-delivery';
import {
	ConcurrentUpdateError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import type { Actor } from '$lib/types/request-context';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const TERMINAL_PROJECT_STATUSES = new Set(['cancelled', 'archived']);

export class ProjectExternalCollaborationAccessError extends Error {
	readonly code = 'PROJECT_EXTERNAL_COLLABORATION_ACCESS';
	constructor(
		message = 'The project collaboration invitation is invalid, expired or unavailable.'
	) {
		super(message);
		this.name = 'ProjectExternalCollaborationAccessError';
	}
}

export class ProjectExternalCollaborationValidationError extends Error {
	readonly code = 'PROJECT_EXTERNAL_COLLABORATION_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProjectExternalCollaborationValidationError';
	}
}

export type ExternalCollaborationCandidate = {
	personPartyPublicId: string;
	personName: string;
	email: string;
	organisationPartyPublicId: string | null;
	organisationName: string | null;
	jobTitle: string | null;
	department: string | null;
};

export type ExternalCollaborator = {
	publicId: string;
	personPartyPublicId: string;
	personName: string;
	email: string;
	organisationPartyPublicId: string | null;
	organisationName: string | null;
	status: 'active' | 'revoked';
	joinedAt: Date;
	roles: Array<{ roleKey: string; name: string }>;
};

export type PendingExternalCollaborationInvitation = {
	publicId: string;
	personName: string;
	email: string;
	organisationName: string | null;
	expiresAt: Date;
	createdAt: Date;
	roles: Array<{ roleKey: string; name: string }>;
};

export type ExternalCollaborationManagementView = {
	canManage: boolean;
	roleTypes: Array<{ roleKey: string; name: string }>;
	candidates: ExternalCollaborationCandidate[];
	collaborators: ExternalCollaborator[];
	pendingInvitations: PendingExternalCollaborationInvitation[];
};

export type ProjectExternalCollaborationInvitationSummary = {
	publicId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	invitingOrganisationName: string;
	personPartyPublicId: string;
	contactName: string;
	email: string;
	organisationPartyPublicId: string | null;
	organisationName: string | null;
	roleNames: string[];
	expiresAt: Date;
};

export type ExternalPortalProject = {
	collaboratorPublicId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	projectStatus: string;
	owningOrganisationName: string;
	crmOrganisationName: string | null;
	roles: string[];
};

function normaliseEmail(value: string): string {
	const email = value.trim().toLowerCase();
	if (!email || email.length > 320 || !email.includes('@')) {
		throw new ProjectExternalCollaborationValidationError(
			'The collaboration contact requires a valid email address.'
		);
	}
	return email;
}

function normalisePublicId(value: string, label: string): string {
	const publicId = value.trim();
	if (
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(publicId)
	) {
		throw new ProjectExternalCollaborationValidationError(`${label} is invalid.`);
	}
	return publicId;
}

function normaliseRoleKeys(values: readonly string[]): string[] {
	const keys = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
	if (keys.length === 0)
		throw new ProjectExternalCollaborationValidationError('Choose at least one project role.');
	if (keys.length > 20)
		throw new ProjectExternalCollaborationValidationError('Too many project roles were selected.');
	return keys;
}

function hashToken(value: string): string {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

function displayPerson(row: {
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
}): string {
	const preferred = row.preferredName?.trim();
	const family = row.familyName?.trim();
	if (preferred && family) return `${preferred} ${family}`;
	if (preferred) return preferred;
	return [row.givenNames?.trim(), family].filter(Boolean).join(' ') || 'Unnamed contact';
}

function displayOrganisation(row: { legalName: string; tradingName: string | null }): string {
	return row.tradingName?.trim() || row.legalName;
}

function applicationBaseUrl(): string {
	const value = env.BETTER_AUTH_URL?.trim();
	if (!value) throw new Error('BETTER_AUTH_URL is required to build project collaboration links.');
	return value;
}

export class ProjectExternalCollaborationService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly emailDelivery: EmailDelivery = getEmailDelivery(),
		private readonly now: () => Date = () => new Date(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async requireOwnedProjectManage(
		actor: TenantActorContext,
		projectPublicIdInput: string,
		db: DatabaseExecutor = this.db
	) {
		const membership = await this.assertActiveActor(actor, db);
		const projectPublicId = normalisePublicId(projectPublicIdInput, 'Project');
		const project = await db
			.selectFrom('projects')
			.select(['id', 'public_id', 'project_number', 'name', 'status', 'owning_organisation_id'])
			.where('public_id', '=', projectPublicId)
			.executeTakeFirst();
		if (!project || project.owning_organisation_id !== actor.organisationId) {
			throw new RecordNotFoundError('Owned project not found.');
		}
		if (TERMINAL_PROJECT_STATUSES.has(project.status)) {
			throw new ProjectExternalCollaborationValidationError(
				'This project can no longer accept collaborators.'
			);
		}
		const decision = await new PermissionService(db).decideWithUmbrella(
			actor,
			'project.participant.manage',
			'project.manage',
			{ projectId: project.id }
		);
		if (!decision.allowed)
			throw new TenantAccessError('Project collaborator management is not permitted.');
		return { membership, project };
	}

	private async roleIds(db: DatabaseExecutor, roleKeysInput: readonly string[]) {
		const roleKeys = normaliseRoleKeys(roleKeysInput);
		const rows = await db
			.selectFrom('project_role_types')
			.select(['id', 'role_key', 'name'])
			.where('role_key', 'in', roleKeys)
			.where('is_active', '=', 1)
			.execute();
		if (rows.length !== roleKeys.length) {
			throw new ProjectExternalCollaborationValidationError(
				'One or more project roles are unavailable.'
			);
		}
		return { roleKeys, rows };
	}

	async getManagementView(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ExternalCollaborationManagementView> {
		const { project } = await this.requireOwnedProjectManage(actor, projectPublicId);
		const crmDecision = await new PermissionService(this.db).decide(actor, 'crm.view');
		const roleTypes = await this.db
			.selectFrom('project_role_types')
			.select(['role_key as roleKey', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name', 'asc')
			.execute();

		const collaboratorRows = await this.db
			.selectFrom('project_external_collaborators as collaborator')
			.innerJoin('parties as person_party', 'person_party.id', 'collaborator.crm_person_party_id')
			.innerJoin('party_persons as person', 'person.party_id', 'person_party.id')
			.leftJoin(
				'parties as company_party',
				'company_party.id',
				'collaborator.crm_organisation_party_id'
			)
			.leftJoin('party_organisations as company', 'company.party_id', 'company_party.id')
			.select([
				'collaborator.id as id',
				'collaborator.public_id as publicId',
				'collaborator.invite_email as email',
				'collaborator.status as status',
				'collaborator.joined_at as joinedAt',
				'person_party.public_id as personPublicId',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company_party.public_id as companyPublicId',
				'company.legal_name as companyLegalName',
				'company.trading_name as companyTradingName'
			])
			.where('collaborator.project_id', '=', project.id)
			.where('collaborator.owning_organisation_id', '=', actor.organisationId)
			.orderBy('collaborator.created_at', 'desc')
			.execute();
		const collaboratorIds = collaboratorRows.map((row) => row.id);
		const collaboratorRoleRows = collaboratorIds.length
			? await this.db
					.selectFrom('project_external_collaborator_roles as assigned')
					.innerJoin('project_role_types as role', 'role.id', 'assigned.project_role_type_id')
					.select([
						'assigned.project_external_collaborator_id as collaboratorId',
						'role.role_key as roleKey',
						'role.name'
					])
					.where('assigned.project_id', '=', project.id)
					.where('assigned.project_external_collaborator_id', 'in', collaboratorIds)
					.orderBy('role.name', 'asc')
					.execute()
			: [];
		const rolesByCollaborator = new Map<string, Array<{ roleKey: string; name: string }>>();
		for (const row of collaboratorRoleRows) {
			const roles = rolesByCollaborator.get(row.collaboratorId) ?? [];
			roles.push({ roleKey: row.roleKey, name: row.name });
			rolesByCollaborator.set(row.collaboratorId, roles);
		}

		const invitationRows = await this.db
			.selectFrom('project_collaboration_invitations as invitation')
			.innerJoin('parties as person_party', 'person_party.id', 'invitation.crm_contact_party_id')
			.innerJoin('party_persons as person', 'person.party_id', 'person_party.id')
			.leftJoin(
				'party_organisations as company',
				'company.party_id',
				'invitation.crm_organisation_party_id'
			)
			.select([
				'invitation.id as id',
				'invitation.public_id as publicId',
				'invitation.invite_email as email',
				'invitation.expires_at as expiresAt',
				'invitation.created_at as createdAt',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as companyLegalName',
				'company.trading_name as companyTradingName'
			])
			.where('invitation.project_id', '=', project.id)
			.where('invitation.inviting_organisation_id', '=', actor.organisationId)
			.where('invitation.status', '=', 'pending')
			.where('invitation.expires_at', '>', this.now())
			.orderBy('invitation.created_at', 'desc')
			.execute();
		const invitationIds = invitationRows.map((row) => row.id);
		const invitationRoleRows = invitationIds.length
			? await this.db
					.selectFrom('project_collaboration_invitation_roles as assigned')
					.innerJoin('project_role_types as role', 'role.id', 'assigned.project_role_type_id')
					.select([
						'assigned.project_collaboration_invitation_id as invitationId',
						'role.role_key as roleKey',
						'role.name'
					])
					.where('assigned.project_id', '=', project.id)
					.where('assigned.project_collaboration_invitation_id', 'in', invitationIds)
					.orderBy('role.name', 'asc')
					.execute()
			: [];
		const rolesByInvitation = new Map<string, Array<{ roleKey: string; name: string }>>();
		for (const row of invitationRoleRows) {
			const roles = rolesByInvitation.get(row.invitationId) ?? [];
			roles.push({ roleKey: row.roleKey, name: row.name });
			rolesByInvitation.set(row.invitationId, roles);
		}

		const candidates: ExternalCollaborationCandidate[] = [];
		if (crmDecision.allowed) {
			const rows = await this.db
				.selectFrom('parties as person_party')
				.innerJoin('party_persons as person', (join) =>
					join
						.onRef('person.party_id', '=', 'person_party.id')
						.onRef('person.organisation_id', '=', 'person_party.organisation_id')
				)
				.innerJoin('party_email_addresses as email', (join) =>
					join
						.onRef('email.party_id', '=', 'person_party.id')
						.onRef('email.organisation_id', '=', 'person_party.organisation_id')
						.on('email.is_primary', '=', 1)
				)
				.leftJoin('party_organisation_contacts as contact', (join) =>
					join
						.onRef('contact.person_party_id', '=', 'person_party.id')
						.onRef('contact.organisation_id', '=', 'person_party.organisation_id')
						.on('contact.ended_on', 'is', null)
				)
				.leftJoin('parties as company_party', (join) =>
					join
						.onRef('company_party.id', '=', 'contact.organisation_party_id')
						.onRef('company_party.organisation_id', '=', 'person_party.organisation_id')
						.on('company_party.status', '=', 'active')
				)
				.leftJoin('party_organisations as company', (join) =>
					join
						.onRef('company.party_id', '=', 'company_party.id')
						.onRef('company.organisation_id', '=', 'company_party.organisation_id')
				)
				.select([
					'person_party.public_id as personPublicId',
					'person.preferred_name as preferredName',
					'person.given_names as givenNames',
					'person.family_name as familyName',
					'email.email as email',
					'company_party.public_id as companyPublicId',
					'company.legal_name as companyLegalName',
					'company.trading_name as companyTradingName',
					'contact.job_title as jobTitle',
					'contact.department as department'
				])
				.where('person_party.organisation_id', '=', actor.organisationId)
				.where('person_party.party_kind', '=', 'person')
				.where('person_party.status', '=', 'active')
				.orderBy('person.family_name', 'asc')
				.orderBy('person.given_names', 'asc')
				.execute();
			for (const row of rows) {
				candidates.push({
					personPartyPublicId: row.personPublicId,
					personName: displayPerson(row),
					email: row.email,
					organisationPartyPublicId: row.companyPublicId ?? null,
					organisationName: row.companyLegalName
						? displayOrganisation({
								legalName: row.companyLegalName,
								tradingName: row.companyTradingName
							})
						: null,
					jobTitle: row.jobTitle ?? null,
					department: row.department ?? null
				});
			}
		}

		return {
			canManage: true,
			roleTypes,
			candidates,
			collaborators: collaboratorRows.map((row) => ({
				publicId: row.publicId,
				personPartyPublicId: row.personPublicId,
				personName: displayPerson(row),
				email: row.email,
				organisationPartyPublicId: row.companyPublicId ?? null,
				organisationName: row.companyLegalName
					? displayOrganisation({
							legalName: row.companyLegalName,
							tradingName: row.companyTradingName
						})
					: null,
				status: row.status as 'active' | 'revoked',
				joinedAt: row.joinedAt,
				roles: rolesByCollaborator.get(row.id) ?? []
			})),
			pendingInvitations: invitationRows.map((row) => ({
				publicId: row.publicId,
				personName: displayPerson(row),
				email: row.email,
				organisationName: row.companyLegalName
					? displayOrganisation({
							legalName: row.companyLegalName,
							tradingName: row.companyTradingName
						})
					: null,
				expiresAt: row.expiresAt,
				createdAt: row.createdAt,
				roles: rolesByInvitation.get(row.id) ?? []
			}))
		};
	}

	async invite(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			personPartyPublicId: string;
			organisationPartyPublicId?: string | null;
			roleKeys: readonly string[];
		}
	): Promise<ProjectExternalCollaborationInvitationSummary> {
		const token = randomBytes(32).toString('base64url');
		const tokenHash = hashToken(token);
		const publicId = this.publicIdFactory();
		const expiresAt = new Date(this.now().getTime() + INVITATION_LIFETIME_MS);
		const personPublicId = normalisePublicId(input.personPartyPublicId, 'CRM person');
		const companyPublicId = input.organisationPartyPublicId?.trim()
			? normalisePublicId(input.organisationPartyPublicId, 'CRM organisation')
			: null;

		const summary = await this.db.transaction().execute(async (trx) => {
			const { membership, project } = await this.requireOwnedProjectManage(
				actor,
				input.projectPublicId,
				trx
			);
			const crmDecision = await new PermissionService(trx).decide(actor, 'crm.view');
			if (!crmDecision.allowed)
				throw new TenantAccessError('CRM access is required to invite a CRM contact.');
			const person = await trx
				.selectFrom('parties as person_party')
				.innerJoin('party_persons as person', (join) =>
					join
						.onRef('person.party_id', '=', 'person_party.id')
						.onRef('person.organisation_id', '=', 'person_party.organisation_id')
				)
				.innerJoin('party_email_addresses as email', (join) =>
					join
						.onRef('email.party_id', '=', 'person_party.id')
						.onRef('email.organisation_id', '=', 'person_party.organisation_id')
						.on('email.is_primary', '=', 1)
				)
				.select([
					'person_party.id as id',
					'person_party.public_id as publicId',
					'person.preferred_name as preferredName',
					'person.given_names as givenNames',
					'person.family_name as familyName',
					'email.email as email'
				])
				.where('person_party.organisation_id', '=', actor.organisationId)
				.where('person_party.public_id', '=', personPublicId)
				.where('person_party.party_kind', '=', 'person')
				.where('person_party.status', '=', 'active')
				.forUpdate()
				.executeTakeFirst();
			if (!person)
				throw new ProjectExternalCollaborationValidationError(
					'Select an active CRM person with a primary email.'
				);

			let company: {
				id: string;
				publicId: string;
				legalName: string;
				tradingName: string | null;
			} | null = null;
			if (companyPublicId) {
				company =
					(await trx
						.selectFrom('party_organisation_contacts as contact')
						.innerJoin('parties as company_party', (join) =>
							join
								.onRef('company_party.id', '=', 'contact.organisation_party_id')
								.onRef('company_party.organisation_id', '=', 'contact.organisation_id')
						)
						.innerJoin('party_organisations as company', (join) =>
							join
								.onRef('company.party_id', '=', 'company_party.id')
								.onRef('company.organisation_id', '=', 'company_party.organisation_id')
						)
						.select([
							'company_party.id as id',
							'company_party.public_id as publicId',
							'company.legal_name as legalName',
							'company.trading_name as tradingName'
						])
						.where('contact.organisation_id', '=', actor.organisationId)
						.where('contact.person_party_id', '=', person.id)
						.where('company_party.public_id', '=', companyPublicId)
						.where('company_party.status', '=', 'active')
						.where('contact.ended_on', 'is', null)
						.forUpdate()
						.executeTakeFirst()) ?? null;
				if (!company)
					throw new ProjectExternalCollaborationValidationError(
						'The selected person is not an active contact of that CRM organisation.'
					);
			}
			const email = normaliseEmail(person.email);
			const { roleKeys, rows: roles } = await this.roleIds(trx, input.roleKeys);

			const existing = await trx
				.selectFrom('project_external_collaborators')
				.select('id')
				.where('project_id', '=', project.id)
				.where('crm_person_party_id', '=', person.id)
				.where('status', '=', 'active')
				.executeTakeFirst();
			if (existing)
				throw new ProjectExternalCollaborationValidationError(
					'This person already collaborates on the project.'
				);

			await trx
				.updateTable('project_collaboration_invitations')
				.set({ status: 'revoked', revoked_at: this.now() })
				.where('project_id', '=', project.id)
				.where('inviting_organisation_id', '=', actor.organisationId)
				.where('crm_contact_party_id', '=', person.id)
				.where('status', '=', 'pending')
				.execute();
			const inserted = await trx
				.insertInto('project_collaboration_invitations')
				.values({
					public_id: publicId,
					project_id: project.id,
					inviting_organisation_id: actor.organisationId,
					crm_organisation_party_id: company?.id ?? null,
					crm_contact_party_id: person.id,
					invite_email: email,
					token_hash: tokenHash,
					status: 'pending',
					invited_by_member_id: membership.id,
					auth_user_id: null,
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
					roles.map((role) => ({
						project_id: project.id,
						project_collaboration_invitation_id: invitationId,
						project_role_type_id: role.id
					}))
				)
				.execute();
			const inviter = await trx
				.selectFrom('organisations')
				.select(['legal_name as legalName', 'trading_name as tradingName'])
				.where('id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'project.external_collaboration.invited',
				subjectType: 'project_collaboration_invitation',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					personPartyPublicId: person.publicId,
					organisationPartyPublicId: company?.publicId ?? null,
					email,
					roleKeys
				}
			});
			return {
				publicId,
				projectPublicId: project.public_id,
				projectNumber: project.project_number,
				projectName: project.name,
				invitingOrganisationName: displayOrganisation(inviter),
				personPartyPublicId: person.publicId,
				contactName: displayPerson(person),
				email,
				organisationPartyPublicId: company?.publicId ?? null,
				organisationName: company ? displayOrganisation(company) : null,
				roleNames: roles.map((role) => role.name),
				expiresAt
			};
		});

		const invitationUrl = new URL(
			`/collaborate/${encodeURIComponent(token)}`,
			applicationBaseUrl()
		).toString();
		await this.emailDelivery.send({
			to: summary.email,
			subject: `${summary.invitingOrganisationName} invited you to ${summary.projectName} on NuBlox`,
			text: `${summary.contactName},\n\n${summary.invitingOrganisationName} invited you to collaborate on ${summary.projectNumber} · ${summary.projectName} in NuBlox.${summary.organisationName ? `\n\nYou are being invited as a contact of ${summary.organisationName}.` : ''}\n\nAccept the invitation: ${invitationUrl}\n\nYou do not need to create or connect a NuBlox organisation. Access is granted to you personally for this project.\n\nThis invitation expires on ${summary.expiresAt.toISOString()}.`
		});
		return summary;
	}

	private async invitationByToken(rawToken: string) {
		const tokenHash = hashToken(rawToken.trim());
		return this.db
			.selectFrom('project_collaboration_invitations as invitation')
			.innerJoin('projects as project', 'project.id', 'invitation.project_id')
			.innerJoin('organisations as owner', 'owner.id', 'invitation.inviting_organisation_id')
			.innerJoin('parties as person_party', 'person_party.id', 'invitation.crm_contact_party_id')
			.innerJoin('party_persons as person', 'person.party_id', 'person_party.id')
			.leftJoin(
				'parties as company_party',
				'company_party.id',
				'invitation.crm_organisation_party_id'
			)
			.leftJoin('party_organisations as company', 'company.party_id', 'company_party.id')
			.select([
				'invitation.id as id',
				'invitation.public_id as publicId',
				'invitation.project_id as projectId',
				'invitation.inviting_organisation_id as ownerId',
				'invitation.crm_contact_party_id as personPartyId',
				'invitation.crm_organisation_party_id as companyPartyId',
				'invitation.invite_email as email',
				'invitation.status as status',
				'invitation.auth_user_id as authUserId',
				'invitation.invited_by_member_id as invitedByMemberId',
				'invitation.expires_at as expiresAt',
				'invitation.accepted_at as acceptedAt',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'project.status as projectStatus',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName',
				'person_party.public_id as personPublicId',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company_party.public_id as companyPublicId',
				'company.legal_name as companyLegalName',
				'company.trading_name as companyTradingName'
			])
			.where('invitation.token_hash', '=', tokenHash)
			.executeTakeFirst();
	}

	async getPendingInvitation(
		rawToken: string
	): Promise<ProjectExternalCollaborationInvitationSummary | null> {
		const row = await this.invitationByToken(rawToken);
		if (!row || row.status !== 'pending' || row.expiresAt <= this.now()) return null;
		const roles = await this.db
			.selectFrom('project_collaboration_invitation_roles as assigned')
			.innerJoin('project_role_types as role', 'role.id', 'assigned.project_role_type_id')
			.select('role.name')
			.where('assigned.project_id', '=', row.projectId)
			.where('assigned.project_collaboration_invitation_id', '=', row.id)
			.orderBy('role.name', 'asc')
			.execute();
		return {
			publicId: row.publicId,
			projectPublicId: row.projectPublicId,
			projectNumber: row.projectNumber,
			projectName: row.projectName,
			invitingOrganisationName: displayOrganisation({
				legalName: row.ownerLegalName,
				tradingName: row.ownerTradingName
			}),
			personPartyPublicId: row.personPublicId,
			contactName: displayPerson(row),
			email: row.email,
			organisationPartyPublicId: row.companyPublicId ?? null,
			organisationName: row.companyLegalName
				? displayOrganisation({
						legalName: row.companyLegalName,
						tradingName: row.companyTradingName
					})
				: null,
			roleNames: roles.map((role) => role.name),
			expiresAt: row.expiresAt
		};
	}

	async validateSignup(rawToken: string, emailInput: string): Promise<void> {
		const invitation = await this.getPendingInvitation(rawToken);
		if (!invitation || normaliseEmail(invitation.email) !== normaliseEmail(emailInput)) {
			throw new ProjectExternalCollaborationAccessError();
		}
	}

	async bindSignupAuthUser(
		rawToken: string,
		emailInput: string,
		authUserId: string
	): Promise<void> {
		await this.validateSignup(rawToken, emailInput);
		const result = await this.db
			.updateTable('project_collaboration_invitations')
			.set({ auth_user_id: authUserId })
			.where('token_hash', '=', hashToken(rawToken.trim()))
			.where('status', '=', 'pending')
			.where((eb) => eb.or([eb('auth_user_id', 'is', null), eb('auth_user_id', '=', authUserId)]))
			.executeTakeFirst();
		if (result.numUpdatedRows !== 1n) throw new ProjectExternalCollaborationAccessError();
	}

	async activateVerifiedAuthUser(input: {
		authUserId: string;
		email: string;
		displayName: string;
		correlationId?: string;
	}): Promise<string | null> {
		const pending = await this.db
			.selectFrom('project_collaboration_invitations')
			.select('token_hash')
			.where('auth_user_id', '=', input.authUserId)
			.where('invite_email', '=', normaliseEmail(input.email))
			.where('status', '=', 'pending')
			.where('expires_at', '>', this.now())
			.orderBy('created_at', 'desc')
			.executeTakeFirst();
		if (!pending) return null;
		const identity = await recoverVerifiedPlatformIdentity(this.db, input);
		if (!identity.recovered) throw new ProjectExternalCollaborationAccessError(identity.reason);
		return this.finaliseByAuth(
			input.authUserId,
			identity.userId,
			input.email,
			input.correlationId ?? randomUUID()
		);
	}

	async acceptExistingUser(rawToken: string, actor: Actor, correlationId: string): Promise<string> {
		await assertVerifiedAuthUser(this.db, actor.authUserId, actor.email);
		const invitation = await this.getPendingInvitation(rawToken);
		if (!invitation || normaliseEmail(invitation.email) !== normaliseEmail(actor.email)) {
			throw new ProjectExternalCollaborationAccessError(
				'This invitation is addressed to a different verified email address.'
			);
		}
		const identity = await recoverVerifiedPlatformIdentity(this.db, {
			authUserId: actor.authUserId,
			email: actor.email,
			displayName: actor.displayName
		});
		if (!identity.recovered) throw new ProjectExternalCollaborationAccessError(identity.reason);
		await this.db
			.updateTable('project_collaboration_invitations')
			.set({ auth_user_id: actor.authUserId })
			.where('public_id', '=', invitation.publicId)
			.where('status', '=', 'pending')
			.executeTakeFirstOrThrow();
		return this.finaliseByAuth(actor.authUserId, identity.userId, actor.email, correlationId);
	}

	private async finaliseByAuth(
		authUserId: string,
		userId: string,
		emailInput: string,
		correlationId: string
	): Promise<string> {
		const email = normaliseEmail(emailInput);
		return this.db.transaction().execute(async (trx) => {
			const invitation = await trx
				.selectFrom('project_collaboration_invitations as invitation')
				.innerJoin('projects as project', 'project.id', 'invitation.project_id')
				.innerJoin('parties as person_party', 'person_party.id', 'invitation.crm_contact_party_id')
				.select([
					'invitation.id as id',
					'invitation.public_id as publicId',
					'invitation.project_id as projectId',
					'invitation.inviting_organisation_id as ownerId',
					'invitation.crm_contact_party_id as personPartyId',
					'invitation.crm_organisation_party_id as companyPartyId',
					'invitation.invite_email as email',
					'invitation.status as status',
					'invitation.auth_user_id as authUserId',
					'invitation.invited_by_member_id as invitedByMemberId',
					'invitation.expires_at as expiresAt',
					'project.public_id as projectPublicId',
					'project.status as projectStatus',
					'person_party.public_id as personPublicId'
				])
				.where('invitation.auth_user_id', '=', authUserId)
				.where('invitation.invite_email', '=', email)
				.where('invitation.status', '=', 'pending')
				.orderBy('invitation.created_at', 'desc')
				.forUpdate()
				.executeTakeFirst();
			if (!invitation || invitation.expiresAt <= this.now())
				throw new ProjectExternalCollaborationAccessError();
			if (TERMINAL_PROJECT_STATUSES.has(invitation.projectStatus)) {
				throw new ProjectExternalCollaborationValidationError(
					'This project can no longer accept collaborators.'
				);
			}
			const roleRows = await trx
				.selectFrom('project_collaboration_invitation_roles')
				.select('project_role_type_id')
				.where('project_id', '=', invitation.projectId)
				.where('project_collaboration_invitation_id', '=', invitation.id)
				.execute();
			if (roleRows.length === 0)
				throw new ProjectExternalCollaborationValidationError(
					'This invitation no longer has a project role.'
				);
			let collaborator = await trx
				.selectFrom('project_external_collaborators')
				.select(['id', 'public_id as publicId', 'status'])
				.where('project_id', '=', invitation.projectId)
				.where('auth_user_id', '=', authUserId)
				.forUpdate()
				.executeTakeFirst();
			const at = this.now();
			if (!collaborator) {
				const collaboratorPublicId = this.publicIdFactory();
				const inserted = await trx
					.insertInto('project_external_collaborators')
					.values({
						public_id: collaboratorPublicId,
						project_id: invitation.projectId,
						owning_organisation_id: invitation.ownerId,
						crm_person_party_id: invitation.personPartyId,
						crm_organisation_party_id: invitation.companyPartyId,
						auth_user_id: authUserId,
						invite_email: email,
						status: 'active',
						invited_by_member_id: invitation.invitedByMemberId,
						joined_at: at,
						left_at: null
					})
					.executeTakeFirstOrThrow();
				if (inserted.insertId === undefined)
					throw new Error('External collaborator insert did not return an ID.');
				collaborator = {
					id: inserted.insertId.toString(),
					publicId: collaboratorPublicId,
					status: 'active'
				};
			} else if (collaborator.status === 'revoked') {
				await trx
					.updateTable('project_external_collaborators')
					.set({
						crm_person_party_id: invitation.personPartyId,
						crm_organisation_party_id: invitation.companyPartyId,
						invite_email: email,
						status: 'active',
						invited_by_member_id: invitation.invitedByMemberId,
						joined_at: at,
						left_at: null
					})
					.where('id', '=', collaborator.id)
					.executeTakeFirstOrThrow();
			}
			await trx
				.deleteFrom('project_external_collaborator_roles')
				.where('project_id', '=', invitation.projectId)
				.where('project_external_collaborator_id', '=', collaborator.id)
				.execute();
			await trx
				.insertInto('project_external_collaborator_roles')
				.values(
					roleRows.map((role) => ({
						project_id: invitation.projectId,
						project_external_collaborator_id: collaborator!.id,
						project_role_type_id: role.project_role_type_id
					}))
				)
				.execute();
			const marked = await trx
				.updateTable('project_collaboration_invitations')
				.set({ status: 'accepted', accepted_at: at, revoked_at: null })
				.where('id', '=', invitation.id)
				.where('status', '=', 'pending')
				.executeTakeFirst();
			if (marked.numUpdatedRows !== 1n) throw new ConcurrentUpdateError();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: invitation.ownerId,
				actorUserId: userId,
				actorMemberId: null,
				externalAuthUserId: authUserId,
				projectId: invitation.projectId,
				actionKey: 'project.external_collaboration.accepted',
				subjectType: 'project_external_collaborator',
				subjectPublicId: collaborator.publicId,
				correlationId,
				changeSummary: {
					personPartyPublicId: invitation.personPublicId,
					invitationPublicId: invitation.publicId
				}
			});
			return invitation.projectPublicId;
		});
	}

	async revokeInvitation(
		actor: TenantActorContext,
		projectPublicId: string,
		invitationPublicIdInput: string
	): Promise<void> {
		const invitationPublicId = normalisePublicId(invitationPublicIdInput, 'Invitation');
		await this.db.transaction().execute(async (trx) => {
			const { membership, project } = await this.requireOwnedProjectManage(
				actor,
				projectPublicId,
				trx
			);
			const result = await trx
				.updateTable('project_collaboration_invitations')
				.set({ status: 'revoked', revoked_at: this.now() })
				.where('public_id', '=', invitationPublicId)
				.where('project_id', '=', project.id)
				.where('status', '=', 'pending')
				.executeTakeFirst();
			if (result.numUpdatedRows !== 1n)
				throw new RecordNotFoundError('Pending collaboration invitation not found.');
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'project.external_collaboration.invitation_revoked',
				subjectType: 'project_collaboration_invitation',
				subjectPublicId: invitationPublicId,
				correlationId: actor.correlationId
			});
		});
	}

	async removeCollaborator(
		actor: TenantActorContext,
		projectPublicId: string,
		collaboratorPublicIdInput: string
	): Promise<void> {
		const collaboratorPublicId = normalisePublicId(
			collaboratorPublicIdInput,
			'External collaborator'
		);
		await this.db.transaction().execute(async (trx) => {
			const { membership, project } = await this.requireOwnedProjectManage(
				actor,
				projectPublicId,
				trx
			);
			const result = await trx
				.updateTable('project_external_collaborators')
				.set({ status: 'revoked', left_at: this.now() })
				.where('public_id', '=', collaboratorPublicId)
				.where('project_id', '=', project.id)
				.where('status', '=', 'active')
				.executeTakeFirst();
			if (result.numUpdatedRows !== 1n)
				throw new RecordNotFoundError('Active external collaborator not found.');
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'project.external_collaboration.revoked',
				subjectType: 'project_external_collaborator',
				subjectPublicId: collaboratorPublicId,
				correlationId: actor.correlationId
			});
		});
	}

	async listExternalPortalProjects(authUserId: string): Promise<ExternalPortalProject[]> {
		const rows = await this.db
			.selectFrom('project_external_collaborators as collaborator')
			.innerJoin('projects as project', 'project.id', 'collaborator.project_id')
			.innerJoin('organisations as owner', 'owner.id', 'collaborator.owning_organisation_id')
			.leftJoin(
				'party_organisations as company',
				'company.party_id',
				'collaborator.crm_organisation_party_id'
			)
			.select([
				'collaborator.id as collaboratorId',
				'collaborator.public_id as collaboratorPublicId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'project.status as projectStatus',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName',
				'company.legal_name as companyLegalName',
				'company.trading_name as companyTradingName'
			])
			.where('collaborator.auth_user_id', '=', authUserId)
			.where('collaborator.status', '=', 'active')
			.where('project.status', 'not in', ['cancelled', 'archived'])
			.orderBy('project.name', 'asc')
			.execute();
		if (!rows.length) return [];
		const roleRows = await this.db
			.selectFrom('project_external_collaborator_roles as assigned')
			.innerJoin('project_role_types as role', 'role.id', 'assigned.project_role_type_id')
			.select(['assigned.project_external_collaborator_id as collaboratorId', 'role.name'])
			.where(
				'assigned.project_external_collaborator_id',
				'in',
				rows.map((row) => row.collaboratorId)
			)
			.orderBy('role.name', 'asc')
			.execute();
		const roles = new Map<string, string[]>();
		for (const row of roleRows) {
			const list = roles.get(row.collaboratorId) ?? [];
			list.push(row.name);
			roles.set(row.collaboratorId, list);
		}
		return rows.map((row) => ({
			collaboratorPublicId: row.collaboratorPublicId,
			projectPublicId: row.projectPublicId,
			projectNumber: row.projectNumber,
			projectName: row.projectName,
			projectStatus: row.projectStatus,
			owningOrganisationName: displayOrganisation({
				legalName: row.ownerLegalName,
				tradingName: row.ownerTradingName
			}),
			crmOrganisationName: row.companyLegalName
				? displayOrganisation({
						legalName: row.companyLegalName,
						tradingName: row.companyTradingName
					})
				: null,
			roles: roles.get(row.collaboratorId) ?? []
		}));
	}
}
