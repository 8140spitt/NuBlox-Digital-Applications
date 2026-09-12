import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';

export const TENANT_BOOTSTRAP_COOKIE = 'nublox-v2-tenant-bootstrap';
const BOOTSTRAP_INTENT_LIFETIME_MS = 4 * 60 * 60 * 1000;
const BOOTSTRAP_TOKEN_VERSION = 1;

type BootstrapDetails = {
	legalName: string;
	tradingName: string | null;
	defaultTimezone: string;
	defaultCurrencyCode: string;
};

type BootstrapTokenPayload = BootstrapDetails & {
	v: 1;
	nonce: string;
	email: string;
	expiresAt: number;
};

type IdRow = RowDataPacket & { id: string | number };
type LinkRow = RowDataPacket & { user_id: string | number };
type PendingTenantRow = RowDataPacket & {
	member_id: string | number;
	member_public_id: string;
	organisation_id: string | number;
	organisation_public_id: string;
};
type PermissionRow = RowDataPacket & { id: string | number };

type BootstrapIntent = {
	publicId: string;
	email: string;
	expiresAt: Date;
	token: string;
};

export class TenantBootstrapValidationError extends Error {
	readonly code = 'TENANT_BOOTSTRAP_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'TenantBootstrapValidationError';
	}
}

export class TenantBootstrapAccessError extends Error {
	readonly code = 'TENANT_BOOTSTRAP_ACCESS_DENIED';
	constructor(message = 'The tenant registration request is invalid or has expired.') {
		super(message);
		this.name = 'TenantBootstrapAccessError';
	}
}

function normaliseEmail(value: string): string {
	return value.trim().toLowerCase();
}

function validateEmail(value: string): string {
	const email = normaliseEmail(value);
	if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new TenantBootstrapValidationError('A valid email address is required.');
	}
	return email;
}

function validateDetails(input: {
	legalName: string;
	tradingName?: string | null;
	defaultTimezone?: string;
	defaultCurrencyCode?: string;
}): BootstrapDetails {
	const legalName = input.legalName.trim();
	if (!legalName || legalName.length > 255) {
		throw new TenantBootstrapValidationError('Legal name must be between 1 and 255 characters.');
	}

	const tradingNameValue = input.tradingName?.trim() ?? '';
	if (tradingNameValue.length > 255) {
		throw new TenantBootstrapValidationError('Trading name must not exceed 255 characters.');
	}

	const defaultTimezone = input.defaultTimezone?.trim() || 'Europe/London';
	if (defaultTimezone.length > 64) {
		throw new TenantBootstrapValidationError('Timezone must not exceed 64 characters.');
	}
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone: defaultTimezone }).format(new Date());
	} catch {
		throw new TenantBootstrapValidationError('A valid IANA timezone is required.');
	}

	const defaultCurrencyCode = (input.defaultCurrencyCode?.trim() || 'GBP').toUpperCase();
	if (!/^[A-Z]{3}$/.test(defaultCurrencyCode)) {
		throw new TenantBootstrapValidationError('Currency code must be a three-letter ISO code.');
	}

	return {
		legalName,
		tradingName: tradingNameValue || null,
		defaultTimezone,
		defaultCurrencyCode
	};
}

function signingKey(): string {
	const secret = env.BETTER_AUTH_SECRET?.trim();
	if (!secret) throw new Error('BETTER_AUTH_SECRET is required for tenant bootstrap signing.');
	return `nublox:v2:tenant-bootstrap:v1:${secret}`;
}

function encodeToken(payload: BootstrapTokenPayload): string {
	const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	const signature = createHmac('sha256', signingKey()).update(body).digest('base64url');
	return `${body}.${signature}`;
}

function decodeToken(rawToken: string): BootstrapTokenPayload {
	const [body, suppliedSignature, extra] = rawToken.split('.');
	if (!body || !suppliedSignature || extra) throw new TenantBootstrapAccessError();

	const expectedSignature = createHmac('sha256', signingKey()).update(body).digest();
	let supplied: Buffer;
	try {
		supplied = Buffer.from(suppliedSignature, 'base64url');
	} catch {
		throw new TenantBootstrapAccessError();
	}
	if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) {
		throw new TenantBootstrapAccessError();
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
	} catch {
		throw new TenantBootstrapAccessError();
	}
	if (!parsed || typeof parsed !== 'object') throw new TenantBootstrapAccessError();

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
		throw new TenantBootstrapAccessError();
	}

	const email = validateEmail(value.email);
	const details = validateDetails({
		legalName: value.legalName,
		tradingName: value.tradingName,
		defaultTimezone: value.defaultTimezone,
		defaultCurrencyCode: value.defaultCurrencyCode
	});
	return { v: 1, nonce: value.nonce, email, expiresAt: value.expiresAt, ...details };
}

async function audit(
	connection: PoolConnection,
	input: {
		organisationId: string;
		userId: string;
		memberId: string;
		actionKey: string;
		subjectPublicId: string;
		changeSummary: unknown;
	}
): Promise<void> {
	await connection.execute(
		`INSERT INTO audit_events
			(event_public_id, acting_organisation_id, actor_user_id, actor_member_id,
			 external_auth_user_id, project_id, action_key, subject_type, subject_public_id,
			 correlation_id, change_summary, event_metadata)
		 VALUES (?, ?, ?, ?, NULL, NULL, ?, 'organisation', ?, ?, ?, NULL)`,
		[
			randomUUID(),
			input.organisationId,
			input.userId,
			input.memberId,
			input.actionKey,
			input.subjectPublicId,
			randomUUID(),
			JSON.stringify(input.changeSummary)
		]
	);
}

export async function createTenantBootstrapIntent(input: {
	email: string;
	legalName: string;
	tradingName?: string | null;
	defaultTimezone?: string;
	defaultCurrencyCode?: string;
}): Promise<BootstrapIntent> {
	const email = validateEmail(input.email);
	const details = validateDetails(input);
	const pool = getPool();

	const [authUsers] = await pool.execute<IdRow[]>(
		'SELECT id FROM auth_users WHERE LOWER(email) = LOWER(?) LIMIT 1',
		[email]
	);
	const [domainUsers] = await pool.execute<LinkRow[]>(
		'SELECT user_id FROM user_emails WHERE LOWER(email) = LOWER(?) LIMIT 1',
		[email]
	);
	if (authUsers.length || domainUsers.length) {
		throw new TenantBootstrapValidationError(
			'A NuBlox account already uses this email. Sign in to create another organisation.'
		);
	}

	const publicId = randomUUID();
	const expiresAt = new Date(Date.now() + BOOTSTRAP_INTENT_LIFETIME_MS);
	const token = encodeToken({
		v: 1,
		nonce: publicId,
		email,
		expiresAt: expiresAt.getTime(),
		...details
	});

	return { publicId, email, expiresAt, token };
}

export async function validateTenantBootstrapSignup(rawToken: string, rawEmail: string): Promise<void> {
	const payload = decodeToken(rawToken);
	if (payload.email !== validateEmail(rawEmail)) throw new TenantBootstrapAccessError();

	const pool = getPool();
	const [authUsers] = await pool.execute<IdRow[]>(
		'SELECT id FROM auth_users WHERE LOWER(email) = LOWER(?) LIMIT 1',
		[payload.email]
	);
	const [domainUsers] = await pool.execute<LinkRow[]>(
		'SELECT user_id FROM user_emails WHERE LOWER(email) = LOWER(?) LIMIT 1',
		[payload.email]
	);
	if (authUsers.length || domainUsers.length) throw new TenantBootstrapAccessError();
}

export async function provisionTenantBootstrapSignup(input: {
	rawToken: string;
	authUserId: string;
	email: string;
	displayName: string;
}): Promise<void> {
	const payload = decodeToken(input.rawToken);
	const email = validateEmail(input.email);
	if (payload.email !== email) throw new TenantBootstrapAccessError();

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();

		const [links] = await connection.execute<LinkRow[]>(
			'SELECT user_id FROM auth_user_links WHERE auth_user_id = ? LIMIT 1 FOR UPDATE',
			[input.authUserId]
		);
		const [emails] = await connection.execute<LinkRow[]>(
			'SELECT user_id FROM user_emails WHERE LOWER(email) = LOWER(?) LIMIT 1 FOR UPDATE',
			[email]
		);
		if (links.length || emails.length) throw new TenantBootstrapAccessError();

		const userPublicId = randomUUID();
		const [userInsert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO users (public_id, display_name, status)
			 VALUES (?, ?, 'pending')`,
			[userPublicId, input.displayName.trim() || email]
		);
		const userId = userInsert.insertId.toString();

		await connection.execute(
			`INSERT INTO user_emails (user_id, email, is_primary, is_verified, verified_at)
			 VALUES (?, ?, 1, 0, NULL)`,
			[userId, email]
		);
		await connection.execute(
			'INSERT INTO auth_user_links (auth_user_id, user_id) VALUES (?, ?)',
			[input.authUserId, userId]
		);

		const organisationPublicId = randomUUID();
		const [organisationInsert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO organisations
				(public_id, legal_name, trading_name, default_timezone, default_currency_code, status)
			 VALUES (?, ?, ?, ?, ?, 'pending')`,
			[
				organisationPublicId,
				payload.legalName,
				payload.tradingName,
				payload.defaultTimezone,
				payload.defaultCurrencyCode
			]
		);
		const organisationId = organisationInsert.insertId.toString();

		const memberPublicId = randomUUID();
		const [memberInsert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO organisation_members
				(organisation_id, user_id, public_id, status, joined_at, disabled_at)
			 VALUES (?, ?, ?, 'invited', NULL, NULL)`,
			[organisationId, userId, memberPublicId]
		);
		const memberId = memberInsert.insertId.toString();

		const ownerRolePublicId = randomUUID();
		const [ownerRoleInsert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO organisation_roles
				(organisation_id, public_id, name, description, is_active)
			 VALUES (?, ?, 'Owner', 'Organisation owner with full organisation authority.', 1)`,
			[organisationId, ownerRolePublicId]
		);
		const ownerRoleId = ownerRoleInsert.insertId.toString();

		const [permissions] = await connection.execute<PermissionRow[]>(
			'SELECT id FROM permissions WHERE is_active = 1'
		);
		if (!permissions.length) throw new Error('No active NuBlox permissions are available.');
		for (const permission of permissions) {
			await connection.execute(
				`INSERT INTO role_permissions
					(organisation_id, organisation_role_id, permission_id)
				 VALUES (?, ?, ?)`,
				[organisationId, ownerRoleId, permission.id]
			);
		}

		await connection.execute(
			`INSERT INTO member_roles
				(organisation_id, organisation_member_id, organisation_role_id)
			 VALUES (?, ?, ?)`,
			[organisationId, memberId, ownerRoleId]
		);

		await audit(connection, {
			organisationId,
			userId,
			memberId,
			actionKey: 'organisation.bootstrap.pending',
			subjectPublicId: organisationPublicId,
			changeSummary: {
				legalName: payload.legalName,
				tradingName: payload.tradingName,
				defaultTimezone: payload.defaultTimezone,
				defaultCurrencyCode: payload.defaultCurrencyCode,
				ownerRoleAssigned: true,
				activationState: 'pending'
			}
		});

		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function activateVerifiedTenantBootstrap(input: {
	authUserId: string;
	email: string;
}): Promise<boolean> {
	const email = validateEmail(input.email);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();

		const [links] = await connection.execute<LinkRow[]>(
			'SELECT user_id FROM auth_user_links WHERE auth_user_id = ? LIMIT 1 FOR UPDATE',
			[input.authUserId]
		);
		const link = links[0];
		if (!link) {
			await connection.rollback();
			return false;
		}
		const userId = link.user_id.toString();

		const [pending] = await connection.execute<PendingTenantRow[]>(
			`SELECT member.id AS member_id,
					member.public_id AS member_public_id,
					organisation.id AS organisation_id,
					organisation.public_id AS organisation_public_id
			 FROM organisation_members member
			 JOIN organisations organisation ON organisation.id = member.organisation_id
			 WHERE member.user_id = ?
			   AND member.status = 'invited'
			   AND organisation.status = 'pending'
			 LIMIT 2 FOR UPDATE`,
			[userId]
		);
		if (!pending.length) {
			await connection.rollback();
			return false;
		}
		if (pending.length !== 1) {
			throw new TenantBootstrapAccessError('Multiple pending tenant registrations were found.');
		}
		const tenant = pending[0]!;
		const now = new Date();

		await connection.execute("UPDATE users SET status = 'active' WHERE id = ? AND status = 'pending'", [
			userId
		]);
		await connection.execute(
			`UPDATE user_emails
			 SET is_verified = 1, verified_at = ?
			 WHERE user_id = ? AND LOWER(email) = LOWER(?)`,
			[now, userId, email]
		);
		await connection.execute(
			"UPDATE organisations SET status = 'active' WHERE id = ? AND status = 'pending'",
			[tenant.organisation_id]
		);
		await connection.execute(
			`UPDATE organisation_members
			 SET status = 'active', joined_at = ?, disabled_at = NULL
			 WHERE id = ? AND organisation_id = ? AND status = 'invited'`,
			[now, tenant.member_id, tenant.organisation_id]
		);

		await audit(connection, {
			organisationId: tenant.organisation_id.toString(),
			userId,
			memberId: tenant.member_id.toString(),
			actionKey: 'organisation.bootstrap.activate',
			subjectPublicId: tenant.organisation_public_id,
			changeSummary: { emailVerified: true, membershipActivated: true }
		});

		await connection.commit();
		return true;
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}
