import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import type { Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';

const BOOTSTRAP_INTENT_LIFETIME_MS = 4 * 60 * 60 * 1000;
const BOOTSTRAP_TOKEN_VERSION = 1;
const BOOTSTRAP_PERMISSION_KEYS = [
	'organisation.manage',
	'member.invite',
	'member.manage',
	'project.create',
	'project.view',
	'project.manage',
	'crm.view',
	'crm.manage'
] as const;

const STANDARD_ROLES = [
	{
		name: 'Owner',
		description: 'Organisation owner with full organisation administration authority.',
		permissionKeys: [
			'organisation.manage',
			'member.invite',
			'member.manage',
			'project.create',
			'project.view',
			'project.manage',
			'crm.view',
			'crm.manage'
		]
	},
	{
		name: 'Administrator',
		description: 'Full organisation administration without ownership semantics.',
		permissionKeys: [
			'organisation.manage',
			'member.invite',
			'member.manage',
			'project.create',
			'project.view',
			'project.manage',
			'crm.view',
			'crm.manage'
		]
	},
	{
		name: 'Manager',
		description: 'Manages ordinary members, invitations and project delivery within delegated authority.',
		permissionKeys: [
			'member.invite',
			'member.manage',
			'project.create',
			'project.view',
			'project.manage',
			'crm.view',
			'crm.manage'
		]
	},
	{
		name: 'Finance/Commercial',
		description: 'Commercial and finance role template; domain permissions are assigned as those modules are enabled.',
		permissionKeys: ['project.view', 'crm.view']
	},
	{
		name: 'Member/Professional',
		description: 'General professional member role template.',
		permissionKeys: ['project.view', 'crm.view']
	},
	{
		name: 'Field Worker',
		description: 'Site and field workforce role template.',
		permissionKeys: ['project.view']
	},
	{
		name: 'Read Only',
		description: 'Read-only role template; domain read permissions are assigned explicitly.',
		permissionKeys: ['project.view', 'crm.view']
	}
] as const;

export type OrganisationBootstrapDetails = {
	legalName: string;
	tradingName?: string | null;
	defaultTimezone?: string;
	defaultCurrencyCode?: string;
};

type ValidatedBootstrapDetails = {
	legalName: string;
	tradingName: string | null;
	defaultTimezone: string;
	defaultCurrencyCode: string;
};

type BootstrapTokenPayload = ValidatedBootstrapDetails & {
	v: 1;
	nonce: string;
	email: string;
	expiresAt: number;
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

function bootstrapSigningKey(): string {
	const secret = env.BETTER_AUTH_SECRET?.trim();
	if (!secret) throw new Error('BETTER_AUTH_SECRET is required for organisation bootstrap signing.');
	return `nublox:organisation-bootstrap:v1:${secret}`;
}

function validateEmail(value: string): string {
	const email = normaliseBootstrapEmail(value);
	if (!email || email.length > 320 || !email.includes('@')) {
		throw new OrganisationBootstrapValidationError('A valid email address is required.');
	}
	return email;
}

function validateDetails(input: OrganisationBootstrapDetails): ValidatedBootstrapDetails {
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

function encodeBootstrapToken(payload: BootstrapTokenPayload): string {
	const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	const signature = createHmac('sha256', bootstrapSigningKey()).update(body).digest('base64url');
	return `${body}.${signature}`;
}

function decodeBootstrapToken(rawToken: string): BootstrapTokenPayload {
	const [body, suppliedSignature, extra] = rawToken.split('.');
	if (!body || !suppliedSignature || extra) throw new OrganisationBootstrapAccessError();
	const expectedSignature = createHmac('sha256', bootstrapSigningKey()).update(body).digest();
	let supplied: Buffer;
	try {
		supplied = Buffer.from(suppliedSignature, 'base64url');
	} catch {
		throw new OrganisationBootstrapAccessError();
	}
	if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) {
		throw new OrganisationBootstrapAccessError();
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
	} catch {
		throw new OrganisationBootstrapAccessError();
	}
	if (!parsed || typeof parsed !== 'object') throw new OrganisationBootstrapAccessError();
	const value = parsed as Partial<BootstrapTokenPayload>;
	if (
		value.v !== BOOTSTRAP_TOKEN_VERSION ||
		typeof value.nonce !== 'string' ||
		typeof value.email !== 'string' ||
		typeof value.legalName !== 'string' ||
		(value.tradingName !== null && typeof value.tradingName !== 'string') ||
		typeof value.defaultTimezone !== 'string' ||
		typeof value.defaultCurrencyCode !== 'string' ||
		typeof value.expiresAt !== 'number' ||
		!Number.isFinite(value.expiresAt) ||
		value.expiresAt <= Date.now()
	) {
		throw new OrganisationBootstrapAccessError();
	}

	const email = validateEmail(value.email);
	const details = validateDetails({
		legalName: value.legalName,
		tradingName: value.tradingName,
		defaultTimezone: value.defaultTimezone,
		defaultCurrencyCode: value.defaultCurrencyCode
	});
	return {
		v: 1,
		nonce: value.nonce,
		email,
		expiresAt: value.expiresAt,
		...details
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
		const existingAuthUser = await this.db
			.selectFrom('auth_users')
			.select('id')
			.where('email', '=', email)
			.executeTakeFirst();
		const existingDomainEmail = await this.db
			.selectFrom('user_emails')
			.select('user_id')
			.where('email', '=', email)
			.executeTakeFirst();
		if (existingAuthUser || existingDomainEmail) {
			throw new OrganisationBootstrapValidationError(
				'A NuBlox account already uses this email. Sign in to create another organisation.'
			);
		}

		const publicId = randomUUID();
		const expiresAt = new Date(Date.now() + BOOTSTRAP_INTENT_LIFETIME_MS);
		const token = encodeBootstrapToken({
			v: 1,
			nonce: publicId,
			email,
			expiresAt: expiresAt.getTime(),
			...details
		});
		return { publicId, email, expiresAt, token };
	}

	async validateSignup(rawToken: string, rawEmail: string): Promise<void> {
		const payload = decodeBootstrapToken(rawToken);
		if (payload.email !== validateEmail(rawEmail)) throw new OrganisationBootstrapAccessError();
		const existingAuthUser = await this.db
			.selectFrom('auth_users')
			.select('id')
			.where('email', '=', payload.email)
			.executeTakeFirst();
		const existingDomainEmail = await this.db
			.selectFrom('user_emails')
			.select('user_id')
			.where('email', '=', payload.email)
			.executeTakeFirst();
		if (existingAuthUser || existingDomainEmail) throw new OrganisationBootstrapAccessError();
	}

	async provisionSignup(input: {
		rawToken: string;
		authUserId: string;
		email: string;
		displayName: string;
		correlationId?: string;
	}): Promise<OrganisationBootstrapResult> {
		const payload = decodeBootstrapToken(input.rawToken);
		const email = validateEmail(input.email);
		if (payload.email !== email) throw new OrganisationBootstrapAccessError();

		return this.db.transaction().execute(async (trx) => {
			const existingLink = await trx
				.selectFrom('auth_user_links')
				.select('user_id')
				.where('auth_user_id', '=', input.authUserId)
				.executeTakeFirst();
			const existingEmail = await trx
				.selectFrom('user_emails')
				.select('user_id')
				.where('email', '=', email)
				.executeTakeFirst();
			if (existingLink || existingEmail) throw new OrganisationBootstrapAccessError();

			const userInsert = await trx
				.insertInto('users')
				.values({
					public_id: randomUUID(),
					display_name: input.displayName.trim() || email,
					status: 'pending'
				})
				.executeTakeFirstOrThrow();
			if (userInsert.insertId === undefined) throw new Error('User insert did not return an ID.');
			const userId = userInsert.insertId.toString();

			await trx
				.insertInto('user_emails')
				.values({
					user_id: userId,
					email,
					is_primary: 1,
					is_verified: 0,
					verified_at: null
				})
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('auth_user_links')
				.values({ auth_user_id: input.authUserId, user_id: userId })
				.executeTakeFirstOrThrow();

			return this.createOrganisationRecords(trx, {
				userId,
				details: payload,
				state: 'pending',
				correlationId: input.correlationId ?? randomUUID()
			});
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
			const link = await trx
				.selectFrom('auth_user_links')
				.select('user_id')
				.where('auth_user_id', '=', input.authUserId)
				.executeTakeFirst();
			if (!link) return null;

			const pending = await trx
				.selectFrom('organisation_members as member')
				.innerJoin('organisations as organisation', 'organisation.id', 'member.organisation_id')
				.select([
					'member.id as memberId',
					'member.public_id as memberPublicId',
					'organisation.id as organisationId',
					'organisation.public_id as organisationPublicId'
				])
				.where('member.user_id', '=', link.user_id)
				.where('member.status', '=', 'invited')
				.where('organisation.status', '=', 'pending')
				.forUpdate()
				.limit(2)
				.execute();
			if (pending.length === 0) return null;
			if (pending.length !== 1) {
				throw new OrganisationBootstrapAccessError('Multiple pending organisation bootstrap records were found.');
			}
			const target = pending[0]!;

			const user = await trx
				.selectFrom('users')
				.select('status')
				.where('id', '=', link.user_id)
				.forUpdate()
				.executeTakeFirstOrThrow();
			const domainEmail = await trx
				.selectFrom('user_emails')
				.select(['email', 'is_verified'])
				.where('user_id', '=', link.user_id)
				.where('email', '=', email)
				.executeTakeFirst();
			if (!domainEmail || user.status !== 'pending') return null;

			const now = new Date();
			await trx
				.updateTable('users')
				.set({ status: 'active' })
				.where('id', '=', link.user_id)
				.where('status', '=', 'pending')
				.executeTakeFirstOrThrow();
			await trx
				.updateTable('user_emails')
				.set({ is_verified: 1, verified_at: now })
				.where('user_id', '=', link.user_id)
				.where('email', '=', email)
				.executeTakeFirstOrThrow();
			await trx
				.updateTable('organisations')
				.set({ status: 'active' })
				.where('id', '=', target.organisationId)
				.where('status', '=', 'pending')
				.executeTakeFirstOrThrow();
			await trx
				.updateTable('organisation_members')
				.set({ status: 'active', joined_at: now, disabled_at: null })
				.where('id', '=', target.memberId)
				.where('organisation_id', '=', target.organisationId)
				.where('status', '=', 'invited')
				.executeTakeFirstOrThrow();

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: target.organisationId,
				actorUserId: link.user_id,
				actorMemberId: target.memberId,
				actionKey: 'organisation.bootstrap.activate',
				subjectType: 'organisation',
				subjectPublicId: target.organisationPublicId,
				correlationId: input.correlationId ?? randomUUID(),
				changeSummary: { emailVerified: true, membershipActivated: true }
			});

			return {
				organisationId: target.organisationId,
				organisationPublicId: target.organisationPublicId,
				memberId: target.memberId,
				memberPublicId: target.memberPublicId,
				userId: link.user_id
			};
		});
	}

	async createForExistingUser(
		actor: Pick<TenantActorContext, 'userId' | 'correlationId'>,
		detailsInput: OrganisationBootstrapDetails
	): Promise<OrganisationBootstrapResult> {
		const details = validateDetails(detailsInput);
		return this.db.transaction().execute(async (trx) => {
			const user = await trx
				.selectFrom('users')
				.select('status')
				.where('id', '=', actor.userId)
				.forUpdate()
				.executeTakeFirst();
			if (!user || user.status !== 'active') {
				throw new OrganisationBootstrapAccessError('Only an active NuBlox user can create an organisation.');
			}
			return this.createOrganisationRecords(trx, {
				userId: actor.userId,
				details,
				state: 'active',
				correlationId: actor.correlationId
			});
		});
	}

	private async createOrganisationRecords(
		executor: DatabaseExecutor,
		input: {
			userId: string;
			details: OrganisationBootstrapDetails;
			state: 'pending' | 'active';
			correlationId: string;
		}
	): Promise<OrganisationBootstrapResult> {
		const details = validateDetails(input.details);
		const organisationPublicId = randomUUID();
		const organisationInsert = await executor
			.insertInto('organisations')
			.values({
				public_id: organisationPublicId,
				legal_name: details.legalName,
				trading_name: details.tradingName,
				default_timezone: details.defaultTimezone,
				default_currency_code: details.defaultCurrencyCode,
				status: input.state
			})
			.executeTakeFirstOrThrow();
		if (organisationInsert.insertId === undefined) throw new Error('Organisation insert did not return an ID.');
		const organisationId = organisationInsert.insertId.toString();

		const memberPublicId = randomUUID();
		const memberInsert = await executor
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: input.userId,
				public_id: memberPublicId,
				status: input.state === 'active' ? 'active' : 'invited',
				joined_at: input.state === 'active' ? new Date() : null,
				disabled_at: null
			})
			.executeTakeFirstOrThrow();
		if (memberInsert.insertId === undefined) throw new Error('Organisation member insert did not return an ID.');
		const memberId = memberInsert.insertId.toString();

		const permissionRows = await executor
			.selectFrom('permissions')
			.select(['id', 'permission_key'])
			.where('permission_key', 'in', [...BOOTSTRAP_PERMISSION_KEYS])
			.where('is_active', '=', 1)
			.execute();
		const permissionIdByKey = new Map(permissionRows.map((row) => [row.permission_key, row.id]));
		for (const permissionKey of BOOTSTRAP_PERMISSION_KEYS) {
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
			actorUserId: input.userId,
			actorMemberId: memberId,
			actionKey:
				input.state === 'active' ? 'organisation.bootstrap.create' : 'organisation.bootstrap.pending',
			subjectType: 'organisation',
			subjectPublicId: organisationPublicId,
			correlationId: input.correlationId,
			changeSummary: {
				legalName: details.legalName,
				tradingName: details.tradingName,
				defaultTimezone: details.defaultTimezone,
				defaultCurrencyCode: details.defaultCurrencyCode,
				standardRoleCount: STANDARD_ROLES.length,
				ownerRoleAssigned: true,
				activationState: input.state
			}
		});

		return {
			organisationId,
			organisationPublicId,
			memberId,
			memberPublicId,
			userId: input.userId
		};
	}
}
