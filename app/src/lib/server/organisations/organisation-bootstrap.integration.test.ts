import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from '$lib/server/auth/bootstrap-cookie';
import { auth, authPool } from '$lib/server/auth/better-auth';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { OrganisationBootstrapService } from './bootstrap-service';

const PREFIX = 'Bootstrap Integration ';
const PASSWORD = 'NuBlox-Bootstrap-Test-2026!';

let db: Database;
let email: string;
let activeToken: string;
let authUserId: string;
let platformUserId: string;
let organisationId: string;
let organisationPublicId: string;
let memberId: string;
const createdOrganisationIds: string[] = [];

async function cleanupOrganisation(id: string): Promise<void> {
	await db.deleteFrom('audit_events').where('acting_organisation_id', '=', id).execute();
	await db.deleteFrom('member_roles').where('organisation_id', '=', id).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', '=', id).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', '=', id).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', '=', id).execute();
	await db.deleteFrom('organisations').where('id', '=', id).execute();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	for (const id of [...createdOrganisationIds].reverse()) await cleanupOrganisation(id);
	if (authUserId) {
		await db.deleteFrom('auth_sessions').where('auth_user_id', '=', authUserId).execute();
		await db.deleteFrom('auth_accounts').where('auth_user_id', '=', authUserId).execute();
		await db.deleteFrom('auth_user_links').where('auth_user_id', '=', authUserId).execute();
	}
	if (platformUserId) {
		await db.deleteFrom('user_emails').where('user_id', '=', platformUserId).execute();
		await db.deleteFrom('users').where('id', '=', platformUserId).execute();
	}
	if (authUserId) await db.deleteFrom('auth_users').where('id', '=', authUserId).execute();
}

async function rolePermissionKeys(roleName: string): Promise<string[]> {
	const rows = await db
		.selectFrom('role_permissions as grant')
		.innerJoin('organisation_roles as role', (join) =>
			join.onRef('role.id', '=', 'grant.organisation_role_id').onRef('role.organisation_id', '=', 'grant.organisation_id')
		)
		.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
		.select('permission.permission_key as permissionKey')
		.where('grant.organisation_id', '=', organisationId)
		.where('role.name', '=', roleName)
		.orderBy('permission.permission_key', 'asc')
		.execute();
	return rows.map((row) => row.permissionKey);
}

describe('organisation bootstrap and onboarding', () => {
	beforeAll(async () => {
		db = getDatabase();
		email = `bootstrap-${randomUUID()}@example.test`;
		await cleanup();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
		await authPool.end();
	});

	it('issues a signed bootstrap intent without creating durable organisation records', async () => {
		const intent = await new OrganisationBootstrapService(db).createIntent({
			email,
			details: {
				legalName: `${PREFIX}Organisation`,
				tradingName: `${PREFIX}Trading`,
				defaultTimezone: 'Europe/London',
				defaultCurrencyCode: 'GBP'
			}
		});
		activeToken = intent.token;
		expect(intent.publicId).toHaveLength(36);
		expect(intent.email).toBe(email);
		expect(intent.token.split('.')).toHaveLength(2);
		expect(intent.expiresAt.getTime()).toBeGreaterThan(Date.now());
		const organisation = await db
			.selectFrom('organisations')
			.select('id')
			.where('legal_name', '=', `${PREFIX}Organisation`)
			.executeTakeFirst();
		expect(organisation).toBeUndefined();
	});

	it('keeps Better Auth signup closed unless the signed bootstrap token is intact and matches the email', async () => {
		await expect(
			auth.api.signUpEmail({
				headers: new Headers({ cookie: `${ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE}=${activeToken}` }),
				body: { name: `${PREFIX}Wrong Email`, email: `wrong-${randomUUID()}@example.test`, password: PASSWORD }
			})
		).rejects.toBeDefined();

		const [body, signature] = activeToken.split('.');
		const tamperedToken = `${body}x.${signature}`;
		await expect(
			auth.api.signUpEmail({
				headers: new Headers({ cookie: `${ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE}=${tamperedToken}` }),
				body: { name: `${PREFIX}Tampered`, email, password: PASSWORD }
			})
		).rejects.toBeDefined();

		await auth.api.signUpEmail({
			headers: new Headers({ cookie: `${ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE}=${activeToken}` }),
			body: {
				name: `${PREFIX}Owner`,
				email,
				password: PASSWORD,
				callbackURL: 'http://localhost:5173/signin?verified=1'
			}
		});

		const authUser = await db
			.selectFrom('auth_users')
			.select(['id', 'email_verified'])
			.where('email', '=', email)
			.executeTakeFirstOrThrow();
		authUserId = authUser.id;
		expect(authUser.email_verified).toBe(0);
		const link = await db
			.selectFrom('auth_user_links')
			.select('user_id')
			.where('auth_user_id', '=', authUserId)
			.executeTakeFirstOrThrow();
		platformUserId = link.user_id;
		const domainUser = await db.selectFrom('users').select('status').where('id', '=', platformUserId).executeTakeFirstOrThrow();
		expect(domainUser.status).toBe('pending');

		const pendingOrganisation = await db
			.selectFrom('organisation_members as member')
			.innerJoin('organisations as organisation', 'organisation.id', 'member.organisation_id')
			.select([
				'member.id as memberId',
				'member.status as memberStatus',
				'organisation.id as organisationId',
				'organisation.public_id as organisationPublicId',
				'organisation.status as organisationStatus'
			])
			.where('member.user_id', '=', platformUserId)
			.where('organisation.legal_name', '=', `${PREFIX}Organisation`)
			.executeTakeFirstOrThrow();
		memberId = pendingOrganisation.memberId;
		organisationId = pendingOrganisation.organisationId;
		organisationPublicId = pendingOrganisation.organisationPublicId;
		createdOrganisationIds.push(organisationId);
		expect(pendingOrganisation.memberStatus).toBe('invited');
		expect(pendingOrganisation.organisationStatus).toBe('pending');
	});

	it('activates the identity and persists standard-role finance grants with deliberate delegation boundaries', async () => {
		await db.updateTable('auth_users').set({ email_verified: 1, updated_at: new Date() }).where('id', '=', authUserId).executeTakeFirstOrThrow();
		const activated = await new OrganisationBootstrapService(db).activateVerifiedAuthUser({
			authUserId,
			email,
			displayName: `${PREFIX}Owner`,
			correlationId: `bootstrap-it-${randomUUID()}`
		});
		expect(activated).toMatchObject({ organisationId, organisationPublicId, memberId, userId: platformUserId });

		const organisation = await db
			.selectFrom('organisations')
			.select(['status', 'trading_name', 'default_timezone', 'default_currency_code'])
			.where('id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(organisation).toMatchObject({
			status: 'active',
			trading_name: `${PREFIX}Trading`,
			default_timezone: 'Europe/London',
			default_currency_code: 'GBP'
		});
		const membership = await db
			.selectFrom('organisation_members')
			.select(['status', 'joined_at'])
			.where('id', '=', memberId)
			.where('organisation_id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(membership.status).toBe('active');
		expect(membership.joined_at).not.toBeNull();

		const roles = await db
			.selectFrom('organisation_roles')
			.select(['id', 'name'])
			.where('organisation_id', '=', organisationId)
			.orderBy('name', 'asc')
			.execute();
		expect(roles.map((role) => role.name)).toEqual([
			'Administrator', 'Field Worker', 'Finance/Commercial', 'Manager', 'Member/Professional', 'Owner', 'Read Only'
		]);
		const assignedRoles = await db
			.selectFrom('member_roles as assignment')
			.innerJoin('organisation_roles as role', (join) =>
				join.onRef('role.id', '=', 'assignment.organisation_role_id').onRef('role.organisation_id', '=', 'assignment.organisation_id')
			)
			.select('role.name')
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.organisation_member_id', '=', memberId)
			.execute();
		expect(assignedRoles.map((row) => row.name)).toEqual(['Owner']);

		const ownerPermissions = await rolePermissionKeys('Owner');
		const administratorPermissions = await rolePermissionKeys('Administrator');
		const financePermissions = await rolePermissionKeys('Finance/Commercial');
		for (const broadPermission of ['project.manage', 'crm.manage', 'commercial.manage', 'contract.manage', 'finance.manage']) {
			expect(ownerPermissions).toContain(broadPermission);
			expect(administratorPermissions).toContain(broadPermission);
		}
		for (const correctionPermission of [
			'finance.credit_note.create',
			'finance.credit_note.draft.manage',
			'finance.credit_note.issue',
			'finance.invoice.void'
		]) {
			expect(ownerPermissions).toContain(correctionPermission);
			expect(administratorPermissions).toContain(correctionPermission);
		}
		for (const paymentPermission of [
			'finance.payment.create',
			'finance.payment.allocate',
			'finance.payment.allocation.reverse',
			'finance.payment.reverse'
		]) {
			expect(ownerPermissions).toContain(paymentPermission);
			expect(administratorPermissions).toContain(paymentPermission);
		}
		const collectionPermissions = [
			'finance.collections.view',
			'finance.collections.case.manage',
			'finance.collections.action.record',
			'finance.collections.promise.manage',
			'finance.collections.dispute.manage'
		];
		for (const collectionPermission of collectionPermissions) {
			expect(ownerPermissions).toContain(collectionPermission);
			expect(administratorPermissions).toContain(collectionPermission);
			expect(financePermissions).toContain(collectionPermission);
		}
		for (const financeOperationalPermission of [
			'finance.view',
			'finance.billing.manage',
			'finance.invoice.create',
			'finance.invoice.draft.manage',
			'finance.invoice.issue',
			'finance.credit_note.create',
			'finance.credit_note.draft.manage',
			'finance.credit_note.issue',
			'finance.payment.create',
			'finance.payment.allocate',
			'finance.payment.allocation.reverse',
			'finance.payment.reverse'
		]) {
			expect(financePermissions).toContain(financeOperationalPermission);
		}
		expect(financePermissions).not.toContain('finance.manage');
		expect(financePermissions).not.toContain('finance.invoice.void');
		expect(financePermissions).not.toContain('commercial.manage');
		expect(financePermissions).not.toContain('contract.manage');

		const permissionService = new PermissionService(db);
		const ownerActor = { organisationId, userId: platformUserId, memberId, correlationId: `bootstrap-it-${randomUUID()}` };
		await expect(permissionService.decide(ownerActor, 'organisation.manage')).resolves.toEqual({ allowed: true, reason: 'role-grant' });
		await expect(permissionService.decideWithUmbrella(ownerActor, 'contract.amendment.issue', 'contract.manage')).resolves.toEqual({ allowed: true, reason: 'role-grant' });
		await expect(permissionService.decideWithUmbrella(ownerActor, 'finance.credit_note.issue', 'finance.manage')).resolves.toEqual({ allowed: true, reason: 'role-grant' });
		await expect(permissionService.decideWithUmbrella(ownerActor, 'finance.invoice.void', 'finance.manage')).resolves.toEqual({ allowed: true, reason: 'role-grant' });
		await expect(permissionService.decideWithUmbrella(ownerActor, 'finance.payment.reverse', 'finance.manage')).resolves.toEqual({ allowed: true, reason: 'role-grant' });
		await expect(permissionService.decideWithUmbrella(ownerActor, 'finance.collections.case.manage', 'finance.manage')).resolves.toEqual({ allowed: true, reason: 'role-grant' });

		const auditActions = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', 'in', ['organisation.bootstrap.pending', 'organisation.bootstrap.activate'])
			.orderBy('occurred_at', 'asc')
			.execute();
		expect(auditActions.map((row) => row.action_key)).toEqual(['organisation.bootstrap.pending', 'organisation.bootstrap.activate']);
	});

	it('lets an existing active NuBlox user create an additional organisation without duplicating identity', async () => {
		const created = await new OrganisationBootstrapService(db).createForExistingUser(
			{ userId: platformUserId, correlationId: `bootstrap-existing-${randomUUID()}` },
			{ legalName: `${PREFIX}Second Organisation`, defaultTimezone: 'Europe/London', defaultCurrencyCode: 'GBP' }
		);
		createdOrganisationIds.push(created.organisationId);
		expect(created.userId).toBe(platformUserId);
		expect(created.organisationId).not.toBe(organisationId);
		const user = await db.selectFrom('users').select('id').where('id', '=', platformUserId).execute();
		expect(user).toHaveLength(1);
		const membership = await db
			.selectFrom('organisation_members')
			.select(['user_id', 'status'])
			.where('organisation_id', '=', created.organisationId)
			.where('id', '=', created.memberId)
			.executeTakeFirstOrThrow();
		expect(membership).toMatchObject({ user_id: platformUserId, status: 'active' });
	});
});
