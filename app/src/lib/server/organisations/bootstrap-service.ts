import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import type { Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import {
	OrganisationBootstrapRepository,
	type PendingOrganisationBootstrap
} from './bootstrap-repository';

const BOOTSTRAP_INTENT_LIFETIME_MS = 4 * 60 * 60 * 1000;
const ADMIN_PERMISSION_KEYS = ['organisation.manage', 'member.invite', 'member.manage'] as const;

const STANDARD_ROLES = [
	{
		name: 'Owner',
		description: 'Organisation owner with full organisation administration authority.',
		permissionKeys: ['organisation.manage', 'member.invite', 'member.manage']
	},
	{
		name: 'Administrator',
		description: 'Full organisation administration without ownership semantics.',
		permissionKeys: ['organisation.manage', 'member.invite', 'member.manage']
	},
	{
		name: 'Manager',
		description: 'Manages ordinary members and organisation invitations within delegated authority.',
		permissionKeys: ['member.invite', 'member.manage']
	},
	{
		name: 'Finance/Commercial',
		description: 'Commercial and finance role template; domain permissions are assigned as those modules are enabled.',
		permissionKeys: []
	},
	{
		name: 'Member/Professional',
		description: 'General professional member role template.',
		permissionKeys: []
	},
	{
		name: 'Field Worker',
		description: 'Site and field workforce role template.',
		permissionKeys: []
	},
	{
		name: 'Read Only',
		description: 'Read-only role template; domain read permissions are assigned explicitly.',
		permissionKeys: []
	}
] as const;

export type OrganisationBootstrapDetails = {
	legalName: string;
	tradingName?: string | null;
	defaultTimezone?: string;
	defaultCurrencyCode?: string;
};

export type OrganisationBootstrapIntent = {
	publicId: string;
	email: string;
	expiresAt: Date;
	token: string;
};

export type OrganisationBootstrapResult = {
	organisationId: string;
	organisationPublicId: string;
	memberId: string;
	memberPublicId: string;
	userId: string;
};

export class OrganisationBootstrapValidationError extends Error {
	readonly code = 'ORGANISATION_BOOTSTRAP_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'OrganisationBootstrapValidationError';
	}
}

export class OrganisationBootstrapAccessError extends Error {
	readonly code = 'ORGANISATION_BOOTSTRAP_ACCESS_DENIED';
	constructor(message = 'The organisation setup request is invalid or has expired.') {
		super(message);
		this.name = 'OrganisationBootstrapAccessError';
	}
}

export function normaliseBootstrapEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function hashBootstrapToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

function validateEmail(value: string): string {
	const email = normaliseBootstrapEmail(value);
	if (!email || email.length > 320 || !email.includes('@')) {
		throw new OrganisationBootstrapValidationError('A valid email address is required.');
	}
	return email;
}

function validateDetails(input: OrganisationBootstrapDetails): Required<Omit<OrganisationBootstrapDetails, 'tradingName'>> & { tradingName: string | null } {
	const legalName = input.legalName.trim();
	if (!legalName || legalName.length > 255) {
		throw new OrganisationBootstrapValidationError('Legal name must be between 1 and 255 characters.');
	}

	const tradingNameValue = input.tradingName?.trim() ?? '';
	if (tradingNameValue.length > 255) {
		throw new OrganisationBootstrapValidationError('Trading name must not exceed 255 characters.');
	}

	const defaultTimezone = input.defaultTimezone?.trim() || 'Europe/London';
	if (defaultTimezone.length > 64) {
		throw new OrganisationBootstrapValidationError('Timezone must not exceed 64 characters.');
	}
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone: defaultTimezone }).format(new Date());
	} catch {
		throw new OrganisationBootstrapValidationError('A valid IANA timezone is required.');
	}

	const defaultCurrencyCode = (input.defaultCurrencyCode?.trim() || 'GBP').toUpperCase();
	if (!/^[A-Z]{3}$/.test(defaultCurrencyCode)) {
		throw new OrganisationBootstrapValidationError('Currency code must be a three-letter ISO code.');
	}

	return {
		legalName,
		tradingName: tradingNameValue || null,
		defaultTimezone,
		defaultCurrencyCode
	};
}

export class OrganisationBootstrapService {
	constructor(private readonly db: Database) {}

	async createIntent(input: {
		email: string;
		details: OrganisationBootstrapDetails;
	}): Promise<OrganisationBootstrapIntent> {
		const email = validateEmail(input.email);
		const details = validateDetails(input.details);
		const token = randomBytes(32).toString('base64url');
		const tokenHash = hashBootstrapToken(token);
		const publicId = randomUUID();
		const expiresAt = new Date(Date.now() + BOOTSTRAP_INTENT_LIFETIME_MS);

		await this.db.transaction().execute(async (trx) => {
			const existingAuthUser = await trx
				.selectFrom('auth_users')
				.select('id')
				.where('email', '=', email)
				.executeTakeFirst();
			const existingDomainEmail = await trx
				.selectFrom('user_emails')
				.select('user_id')
				.where('email', '=', email)
				.executeTakeFirst();
			if (existingAuthUser || existingDomainEmail) {
				throw new OrganisationBootstrapValidationError(
					'A NuBlox account already uses this email. Sign in to create another organisation.'
				);
			}

			const repository = new OrganisationBootstrapRepository(trx);
			await repository.revokePendingForEmail(email);
			await repository.insertIntent({
				publicId,
				email,
				tokenHash,
				legalName: details.legalName,
				tradingName: details.tradingName,
				defaultTimezone: details.defaultTimezone,
				defaultCurrencyCode: details.defaultCurrencyCode,
				expiresAt
			});
		});

		return { publicId, email, expiresAt, token };
	}

	async validateSignup(rawToken: string, rawEmail: string): Promise<PendingOrganisationBootstrap> {
		const email = validateEmail(rawEmail);
		const intent = await new OrganisationBootstrapRepository(this.db).findPendingByTokenHash(
			hashBootstrapToken(rawToken)
		);
		if (!intent || intent.authUserId || normaliseBootstrapEmail(intent.email) !== email) {
			throw new OrganisationBootstrapAccessError();
		}
		return intent;
	}

	async bindSignupAuthUser(rawToken: string, rawEmail: string, authUserId: string): Promise<void> {
		const email = validateEmail(rawEmail);
		await this.db.transaction().execute(async (trx) => {
			const repository = new OrganisationBootstrapRepository(trx);
			const intent = await repository.findPendingByTokenHash(hashBootstrapToken(rawToken), new Date(), true);
			if (!intent || intent.authUserId || normaliseBootstrapEmail(intent.email) !== email) {
				throw new OrganisationBootstrapAccessError();
			}
			if (!(await repository.bindAuthUser(intent.id, authUserId))) {
				throw new OrganisationBootstrapAccessError();
			}
		});
	}

	async activateVerifiedAuthUser(input: {
		authUserId: string;
		email: string;
		displayName: string;
		correlationId?: string;
	}): Promise<OrganisationBootstrapResult | null> {
		const email = validateEmail(input.email);
		return this.db.transaction().execute(async (trx) => {
			const repository = new OrganisationBootstrapRepository(trx);
			const intent = await repository.findPendingByAuthUser(input.authUserId, email, new Date(), true);
			if (!intent) return null;
			if (intent.authUserId !== input.authUserId || normaliseBootstrapEmail(intent.email) !== email) {
				throw new OrganisationBootstrapAccessError();
			}

			const userId = await this.ensureVerifiedDomainUser(trx, {
				authUserId: input.authUserId,
				email,
				displayName: input.displayName
			});
			const created = await this.createOrganisationFoundation(
				trx,
				userId,
				{
					legalName: intent.legalName,
					tradingName: intent.tradingName,
					defaultTimezone: intent.defaultTimezone,
					defaultCurrencyCode: intent.defaultCurrencyCode
				},
				input.correlationId ?? randomUUID()
			);
			if (
				!(await repository.markActivated({
					intentId: intent.id,
					userId,
					organisationId: created.organisationId
				}))
			) {
				throw new OrganisationBootstrapAccessError('Organisation setup changed concurrently.');
			}
			return created;
		});
	}

	async createForExistingUser(
		actor: Pick<TenantActorContext, 'userId' | 'correlationId'>,
		detailsInput: OrganisationBootstrapDetails
	): Promise<OrganisationBootstrapResult> {
		const details = validateDetails(detailsInput);
		return this.db.transaction().execute((trx) =>
			this.createOrganisationFoundation(trx, actor.userId, details, actor.correlationId)
		);
	}

	private async ensureVerifiedDomainUser(
		executor: DatabaseExecutor,
		input: { authUserId: string; email: string; displayName: string }
	): Promise<string> {
		const existingEmailOwner = await executor
			.selectFrom('user_emails')
			.select('user_id')
			.where('email', '=', input.email)
			.executeTakeFirst();
		const existingLink = await executor
			.selectFrom('auth_user_links')
			.select('user_id')
			.where('auth_user_id', '=', input.authUserId)
			.executeTakeFirst();

		let userId = existingLink?.user_id ?? null;
		if (existingEmailOwner && userId && existingEmailOwner.user_id !== userId) {
			throw new OrganisationBootstrapAccessError('The verified email is linked to another NuBlox user.');
		}
		if (existingEmailOwner && !userId) {
			throw new OrganisationBootstrapAccessError('The verified email already belongs to another NuBlox identity.');
		}

		if (!userId) {
			const insert = await executor
				.insertInto('users')
				.values({
					public_id: randomUUID(),
					display_name: input.displayName.trim() || input.email,
					status: 'active'
				})
				.executeTakeFirstOrThrow();
			if (insert.insertId === undefined) throw new Error('User insert did not return an ID.');
			userId = insert.insertId.toString();

			await executor
				.insertInto('user_emails')
				.values({
					user_id: userId,
					email: input.email,
					is_primary: 1,
					is_verified: 1,
					verified_at: new Date()
				})
				.executeTakeFirstOrThrow();
			await executor
				.insertInto('auth_user_links')
				.values({ auth_user_id: input.authUserId, user_id: userId })
				.executeTakeFirstOrThrow();
		} else if (!existingEmailOwner) {
			const primaryEmail = await executor
				.selectFrom('user_emails')
				.select('id')
				.where('user_id', '=', userId)
				.where('is_primary', '=', 1)
				.executeTakeFirst();
			await executor
				.insertInto('user_emails')
				.values({
					user_id: userId,
					email: input.email,
					is_primary: primaryEmail ? 0 : 1,
					is_verified: 1,
					verified_at: new Date()
				})
				.executeTakeFirstOrThrow();
		}

		const user = await executor
			.selectFrom('users')
			.select('status')
			.where('id', '=', userId)
			.executeTakeFirstOrThrow();
		if (user.status !== 'active') {
			throw new OrganisationBootstrapAccessError('The NuBlox user is not active.');
		}
		return userId;
	}

	private async createOrganisationFoundation(
		executor: DatabaseExecutor,
		userId: string,
		detailsInput: OrganisationBootstrapDetails,
		correlationId: string
	): Promise<OrganisationBootstrapResult> {
		const details = validateDetails(detailsInput);
		const organisationPublicId = randomUUID();
		const organisationInsert = await executor
			.insertInto('organisations')
			.values({
				public_id: organisationPublicId,
				legal_name: details.legalName,
				trading_name: details.tradingName,
				default_timezone: details.defaultTimezone,
				default_currency_code: details.defaultCurrencyCode,
				status: 'active'
			})
			.executeTakeFirstOrThrow();
		if (organisationInsert.insertId === undefined) throw new Error('Organisation insert did not return an ID.');
		const organisationId = organisationInsert.insertId.toString();

		const memberPublicId = randomUUID();
		const memberInsert = await executor
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: memberPublicId,
				status: 'active',
				joined_at: new Date(),
				disabled_at: null
			})
			.executeTakeFirstOrThrow();
		if (memberInsert.insertId === undefined) throw new Error('Organisation member insert did not return an ID.');
		const memberId = memberInsert.insertId.toString();

		const permissionRows = await executor
			.selectFrom('permissions')
			.select(['id', 'permission_key'])
			.where('permission_key', 'in', [...ADMIN_PERMISSION_KEYS])
			.where('is_active', '=', 1)
			.execute();
		const permissionIdByKey = new Map(permissionRows.map((row) => [row.permission_key, row.id]));
		for (const permissionKey of ADMIN_PERMISSION_KEYS) {
			if (!permissionIdByKey.has(permissionKey)) {
				throw new Error(`Required organisation bootstrap permission is missing: ${permissionKey}`);
			}
		}

		let ownerRoleId: string | null = null;
		for (const role of STANDARD_ROLES) {
			const roleInsert = await executor
				.insertInto('organisation_roles')
				.values({
					organisation_id: organisationId,
					public_id: randomUUID(),
					name: role.name,
					description: role.description,
					is_active: 1
				})
				.executeTakeFirstOrThrow();
			if (roleInsert.insertId === undefined) throw new Error('Organisation role insert did not return an ID.');
			const roleId = roleInsert.insertId.toString();
			if (role.name === 'Owner') ownerRoleId = roleId;

			if (role.permissionKeys.length > 0) {
				await executor
					.insertInto('role_permissions')
					.values(
						role.permissionKeys.map((permissionKey) => ({
							organisation_id: organisationId,
							organisation_role_id: roleId,
							permission_id: permissionIdByKey.get(permissionKey)!
						}))
					)
					.execute();
			}
		}
		if (!ownerRoleId) throw new Error('Owner role was not created.');

		await executor
			.insertInto('member_roles')
			.values({
				organisation_id: organisationId,
				organisation_member_id: memberId,
				organisation_role_id: ownerRoleId
			})
			.executeTakeFirstOrThrow();

		await new AuditRepository(executor).append({
			eventPublicId: randomUUID(),
			actingOrganisationId: organisationId,
			actorUserId: userId,
			actorMemberId: memberId,
			actionKey: 'organisation.bootstrap.create',
			subjectType: 'organisation',
			subjectPublicId: organisationPublicId,
			correlationId,
			changeSummary: {
				legalName: details.legalName,
				tradingName: details.tradingName,
				defaultTimezone: details.defaultTimezone,
				defaultCurrencyCode: details.defaultCurrencyCode,
				standardRoleCount: STANDARD_ROLES.length,
				ownerRoleAssigned: true
			}
		});

		return { organisationId, organisationPublicId, memberId, memberPublicId, userId };
	}
}
