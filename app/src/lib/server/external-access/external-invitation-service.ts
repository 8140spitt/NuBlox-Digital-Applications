import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import { assertVerifiedAuthUser } from '$lib/server/auth/verified-auth-user';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import type { Actor } from '$lib/types/request-context';

const DEFAULT_INVITATION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export class ExternalInvitationAccessError extends Error {
	readonly code = 'EXTERNAL_INVITATION_ACCESS';

	constructor(message = 'This NuBlox Network invitation is invalid, expired or unavailable.') {
		super(message);
		this.name = 'ExternalInvitationAccessError';
	}
}

export class ExternalInvitationValidationError extends Error {
	readonly code = 'EXTERNAL_INVITATION_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'ExternalInvitationValidationError';
	}
}

export type PendingExternalInvitation = {
	publicId: string;
	email: string;
	owningOrganisationName: string;
	contextType: string;
	contextPublicId: string;
	domainKey: string;
	actionType: string;
	title: string;
	summary: string | null;
	dueAt: Date | null;
	expiresAt: Date;
};

export type CreateExternalInvitationInput = {
	owningOrganisationId: string;
	inviteEmail: string;
	invitedByMemberId: string;
	actorUserId: string;
	correlationId: string;
	contextType: string;
	contextPublicId: string;
	resourceType: string;
	capabilityKey: string;
	domainKey: string;
	actionType: string;
	workItemTitle: string;
	workItemSummary?: string | null;
	dueAt?: Date | null;
	expiresAt?: Date | null;
};

export type CreatedExternalInvitation = {
	id: string;
	publicId: string;
	rawToken: string;
	invitationUrl: string;
};

function normaliseEmail(value: string): string {
	const email = value.trim().toLowerCase();
	if (!email || email.length > 320 || !email.includes('@')) {
		throw new ExternalInvitationValidationError('A valid invited email address is required.');
	}
	return email;
}

function requiredText(value: string, label: string, max: number): string {
	const text = value.trim();
	if (!text) throw new ExternalInvitationValidationError(`${label} is required.`);
	if (text.length > max) throw new ExternalInvitationValidationError(`${label} is too long.`);
	return text;
}

function optionalText(value: string | null | undefined, max: number): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max)
		throw new ExternalInvitationValidationError('A supplied value is too long.');
	return text;
}

function hashToken(rawToken: string): string {
	return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function applicationBaseUrl(): string {
	const value = env.BETTER_AUTH_URL?.trim();
	if (!value)
		throw new Error('BETTER_AUTH_URL is required to build NuBlox Network invitation links.');
	return value;
}

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined)
		throw new Error('External access insert did not return an ID.');
	return result.insertId.toString();
}

export class ExternalInvitationService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly now: () => Date = () => new Date(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly tokenFactory: () => string = () => randomBytes(32).toString('base64url')
	) {}

	async createPending(
		db: DatabaseExecutor,
		input: CreateExternalInvitationInput
	): Promise<CreatedExternalInvitation> {
		const email = normaliseEmail(input.inviteEmail);
		const rawToken = this.tokenFactory();
		const publicId = this.publicIdFactory();
		const expiresAt =
			input.expiresAt ?? new Date(this.now().getTime() + DEFAULT_INVITATION_LIFETIME_MS);
		if (expiresAt <= this.now()) {
			throw new ExternalInvitationValidationError('The invitation expiry must be in the future.');
		}
		const result = await db
			.insertInto('external_access_invitations')
			.values({
				public_id: publicId,
				owning_organisation_id: input.owningOrganisationId,
				invite_email: email,
				auth_user_id: null,
				context_type: requiredText(input.contextType, 'Context type', 64),
				context_public_id: requiredText(input.contextPublicId, 'Context', 64),
				resource_type: requiredText(input.resourceType, 'Resource type', 64),
				capability_key: requiredText(input.capabilityKey, 'Capability', 160),
				domain_key: requiredText(input.domainKey, 'Domain', 64),
				action_type: requiredText(input.actionType, 'Action type', 64),
				work_item_title: requiredText(input.workItemTitle, 'Work item title', 255),
				work_item_summary: optionalText(input.workItemSummary, 20_000),
				due_at: input.dueAt ?? null,
				token_hash: hashToken(rawToken),
				status: 'pending',
				expires_at: expiresAt,
				accepted_at: null,
				revoked_at: null,
				invited_by_member_id: input.invitedByMemberId
			})
			.executeTakeFirstOrThrow();
		const id = insertedId(result);
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: input.owningOrganisationId,
			actorUserId: input.actorUserId,
			actorMemberId: input.invitedByMemberId,
			actionKey: 'network.invitation.created',
			subjectType: 'external_access_invitation',
			subjectPublicId: publicId,
			correlationId: input.correlationId,
			changeSummary: {
				inviteEmail: email,
				contextType: input.contextType,
				contextPublicId: input.contextPublicId,
				capabilityKey: input.capabilityKey
			}
		});
		return {
			id,
			publicId,
			rawToken,
			invitationUrl: new URL(
				`/network/invite/${encodeURIComponent(rawToken)}`,
				applicationBaseUrl()
			).toString()
		};
	}

	async queueEmail(
		db: DatabaseExecutor,
		input: {
			owningOrganisationId: string;
			invitationId: string;
			recipient: string;
			subject: string;
			bodyText: string;
			idempotencyKey: string;
		}
	): Promise<string> {
		const publicId = this.publicIdFactory();
		await db
			.insertInto('external_delivery_messages')
			.values({
				public_id: publicId,
				owning_organisation_id: input.owningOrganisationId,
				external_access_invitation_id: input.invitationId,
				channel: 'email',
				recipient: normaliseEmail(input.recipient),
				subject: requiredText(input.subject, 'Email subject', 255),
				body_text: requiredText(input.bodyText, 'Email body', 65_535),
				idempotency_key: requiredText(input.idempotencyKey, 'Idempotency key', 255),
				delivery_status: 'pending',
				attempt_count: 0,
				available_at: this.now(),
				sent_at: null,
				last_attempt_at: null,
				last_error: null
			})
			.executeTakeFirstOrThrow();
		return publicId;
	}

	async getPendingInvitation(rawToken: string): Promise<PendingExternalInvitation | null> {
		const token = rawToken.trim();
		if (!token) return null;
		const row = await this.db
			.selectFrom('external_access_invitations as invitation')
			.innerJoin('organisations as owner', 'owner.id', 'invitation.owning_organisation_id')
			.select([
				'invitation.public_id as publicId',
				'invitation.invite_email as email',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName',
				'invitation.context_type as contextType',
				'invitation.context_public_id as contextPublicId',
				'invitation.domain_key as domainKey',
				'invitation.action_type as actionType',
				'invitation.work_item_title as title',
				'invitation.work_item_summary as summary',
				'invitation.due_at as dueAt',
				'invitation.expires_at as expiresAt'
			])
			.where('invitation.token_hash', '=', hashToken(token))
			.where('invitation.status', '=', 'pending')
			.where('invitation.expires_at', '>', this.now())
			.executeTakeFirst();
		if (!row) return null;
		return {
			publicId: row.publicId,
			email: row.email,
			owningOrganisationName: row.ownerTradingName?.trim() || row.ownerLegalName,
			contextType: row.contextType,
			contextPublicId: row.contextPublicId,
			domainKey: row.domainKey,
			actionType: row.actionType,
			title: row.title,
			summary: row.summary,
			dueAt: row.dueAt,
			expiresAt: row.expiresAt
		};
	}

	async validateSignup(rawToken: string, emailInput: string): Promise<void> {
		const invitation = await this.getPendingInvitation(rawToken);
		if (!invitation || invitation.email !== normaliseEmail(emailInput)) {
			throw new ExternalInvitationAccessError();
		}
	}

	async bindSignupAuthUser(
		rawToken: string,
		emailInput: string,
		authUserId: string
	): Promise<void> {
		await this.validateSignup(rawToken, emailInput);
		const result = await this.db
			.updateTable('external_access_invitations')
			.set({ auth_user_id: authUserId })
			.where('token_hash', '=', hashToken(rawToken.trim()))
			.where('status', '=', 'pending')
			.where('invite_email', '=', normaliseEmail(emailInput))
			.where((eb) => eb.or([eb('auth_user_id', 'is', null), eb('auth_user_id', '=', authUserId)]))
			.executeTakeFirst();
		if (result.numUpdatedRows !== 1n) throw new ExternalInvitationAccessError();
	}

	private async materialiseAccess(
		db: DatabaseExecutor,
		invitation: {
			id: string;
			publicId: string;
			owningOrganisationId: string;
			authUserId: string;
			contextType: string;
			contextPublicId: string;
			resourceType: string;
			capabilityKey: string;
			domainKey: string;
			actionType: string;
			title: string;
			summary: string | null;
			dueAt: Date | null;
			invitedByMemberId: string;
		}
	): Promise<void> {
		const grantPublicId = this.publicIdFactory();
		await db
			.insertInto('external_access_grants')
			.values({
				public_id: grantPublicId,
				owning_organisation_id: invitation.owningOrganisationId,
				auth_user_id: invitation.authUserId,
				invitation_id: invitation.id,
				context_type: invitation.contextType,
				context_public_id: invitation.contextPublicId,
				resource_type: invitation.resourceType,
				resource_public_id: invitation.publicId,
				capability_key: invitation.capabilityKey,
				valid_from: this.now(),
				valid_until: invitation.dueAt,
				revoked_at: null,
				created_by_member_id: invitation.invitedByMemberId
			})
			.onDuplicateKeyUpdate({
				invitation_id: invitation.id,
				valid_from: this.now(),
				valid_until: invitation.dueAt,
				revoked_at: null,
				created_by_member_id: invitation.invitedByMemberId
			})
			.executeTakeFirst();
		const grant = await db
			.selectFrom('external_access_grants')
			.select(['id', 'public_id as publicId'])
			.where('owning_organisation_id', '=', invitation.owningOrganisationId)
			.where('auth_user_id', '=', invitation.authUserId)
			.where('context_type', '=', invitation.contextType)
			.where('context_public_id', '=', invitation.contextPublicId)
			.where('resource_type', '=', invitation.resourceType)
			.where('resource_public_id', '=', invitation.publicId)
			.where('capability_key', '=', invitation.capabilityKey)
			.executeTakeFirstOrThrow();

		if (invitation.actionType !== 'view') {
			await db
				.insertInto('external_work_items')
				.values({
					public_id: this.publicIdFactory(),
					owning_organisation_id: invitation.owningOrganisationId,
					auth_user_id: invitation.authUserId,
					external_access_grant_id: grant.id,
					domain_key: invitation.domainKey,
					source_type: invitation.contextType,
					source_public_id: invitation.contextPublicId,
					action_type: invitation.actionType,
					title: invitation.title,
					summary: invitation.summary,
					state: 'open',
					due_at: invitation.dueAt,
					completed_at: null,
					cancelled_at: null
				})
				.onDuplicateKeyUpdate({
					auth_user_id: invitation.authUserId,
					title: invitation.title,
					summary: invitation.summary,
					state: 'open',
					due_at: invitation.dueAt,
					completed_at: null,
					cancelled_at: null
				})
				.executeTakeFirst();
		}
	}

	private async activateInvitation(
		db: DatabaseExecutor,
		invitationId: string,
		authUserId: string,
		actorUserId: string,
		correlationId: string
	): Promise<void> {
		const invitation = await db
			.selectFrom('external_access_invitations')
			.select([
				'id',
				'public_id as publicId',
				'owning_organisation_id as owningOrganisationId',
				'auth_user_id as authUserId',
				'context_type as contextType',
				'context_public_id as contextPublicId',
				'resource_type as resourceType',
				'capability_key as capabilityKey',
				'domain_key as domainKey',
				'action_type as actionType',
				'work_item_title as title',
				'work_item_summary as summary',
				'due_at as dueAt',
				'invited_by_member_id as invitedByMemberId',
				'expires_at as expiresAt',
				'status'
			])
			.where('id', '=', invitationId)
			.forUpdate()
			.executeTakeFirst();
		if (
			!invitation ||
			invitation.status !== 'pending' ||
			invitation.authUserId !== authUserId ||
			invitation.expiresAt <= this.now()
		) {
			throw new ExternalInvitationAccessError();
		}
		const acceptedAt = this.now();
		const updated = await db
			.updateTable('external_access_invitations')
			.set({ status: 'accepted', accepted_at: acceptedAt, revoked_at: null })
			.where('id', '=', invitation.id)
			.where('status', '=', 'pending')
			.executeTakeFirst();
		if (updated.numUpdatedRows !== 1n) throw new ExternalInvitationAccessError();
		await this.materialiseAccess(db, {
			...invitation,
			authUserId
		});
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: invitation.owningOrganisationId,
			actorUserId,
			actorMemberId: null,
			externalAuthUserId: authUserId,
			actionKey: 'network.invitation.accepted',
			subjectType: 'external_access_invitation',
			subjectPublicId: invitation.publicId,
			correlationId,
			changeSummary: {
				contextType: invitation.contextType,
				contextPublicId: invitation.contextPublicId,
				capabilityKey: invitation.capabilityKey
			}
		});
	}

	async activateVerifiedAuthUser(input: {
		authUserId: string;
		email: string;
		correlationId?: string;
	}): Promise<void> {
		await assertVerifiedAuthUser(this.db, input.authUserId, input.email);
		const link = await this.db
			.selectFrom('auth_user_links')
			.select('user_id as userId')
			.where('auth_user_id', '=', input.authUserId)
			.executeTakeFirst();
		if (!link) return;
		const email = normaliseEmail(input.email);
		const pending = await this.db
			.selectFrom('external_access_invitations')
			.select(['id', 'expires_at as expiresAt'])
			.where('auth_user_id', '=', input.authUserId)
			.where('invite_email', '=', email)
			.where('status', '=', 'pending')
			.execute();
		for (const row of pending) {
			if (row.expiresAt <= this.now()) {
				await this.db
					.updateTable('external_access_invitations')
					.set({ status: 'expired' })
					.where('id', '=', row.id)
					.where('status', '=', 'pending')
					.executeTakeFirst();
				continue;
			}
			await this.db
				.transaction()
				.execute((trx) =>
					this.activateInvitation(
						trx,
						row.id,
						input.authUserId,
						link.userId,
						input.correlationId ?? randomUUID()
					)
				);
		}
	}

	async acceptExistingUser(rawToken: string, actor: Actor, correlationId: string): Promise<void> {
		await assertVerifiedAuthUser(this.db, actor.authUserId, actor.email);
		const pending = await this.getPendingInvitation(rawToken);
		if (!pending || pending.email !== normaliseEmail(actor.email)) {
			throw new ExternalInvitationAccessError();
		}
		await this.db.transaction().execute(async (trx) => {
			const result = await trx
				.updateTable('external_access_invitations')
				.set({ auth_user_id: actor.authUserId })
				.where('token_hash', '=', hashToken(rawToken.trim()))
				.where('status', '=', 'pending')
				.where('invite_email', '=', normaliseEmail(actor.email))
				.where((eb) =>
					eb.or([eb('auth_user_id', 'is', null), eb('auth_user_id', '=', actor.authUserId)])
				)
				.executeTakeFirst();
			if (result.numUpdatedRows !== 1n) throw new ExternalInvitationAccessError();
			const invitation = await trx
				.selectFrom('external_access_invitations')
				.select('id')
				.where('token_hash', '=', hashToken(rawToken.trim()))
				.where('auth_user_id', '=', actor.authUserId)
				.executeTakeFirstOrThrow();
			await this.activateInvitation(
				trx,
				invitation.id,
				actor.authUserId,
				actor.userId,
				correlationId
			);
		});
	}
}
