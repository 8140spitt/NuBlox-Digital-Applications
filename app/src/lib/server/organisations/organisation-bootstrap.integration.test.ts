import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from '$lib/server/auth/bootstrap-cookie';
import { auth, authPool } from '$lib/server/auth/better-auth';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import {
	hashBootstrapToken,
	OrganisationBootstrapService
} from './bootstrap-service';

const PREFIX = 'Bootstrap Integration ';
const PASSWORD = 'NuBlox-Bootstrap-Test-2026!';

let db: Database;
let email: string;
let activeIntentPublicId: string;
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
	if (email) {
		await db.deleteFrom('organisation_bootstrap_intents').where('email', '=', email).execute();
	}
	for (const id of [...createdOrganisationIds].reverse()) {
		await cleanupOrganisation(id);
	}
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

	it('stores only a bootstrap token hash and revokes an earlier unbound setup intent', async () => {
		const service = new OrganisationBootstrapService(db);
		const first = await service.createIntent({
			email,
			details: { legalName: `${PREFIX}First Organisation` }
		});
		const firstRow = await db
			.selectFrom('organisation_bootstrap_intents')
			.select(['token_hash', 'status'])
			.where('public_id', '=', first.publicId)
			.executeTakeFirstOrThrow();
		expect(firstRow.token_hash).toBe(hashBootstrapToken(first.token));
		expect(firstRow.token_hash).not.toBe(first.token);
		expect(firstRow.status).toBe('pending');

		const second = await service.createIntent({
			email,
			details: {
				legalName: `${PREFIX}Organisation`,
				tradingName: `${PREFIX}Trading`,
				defaultTimezone: 'Europe/London',
				defaultCurrencyCode: 'GBP'
			}
		});
		activeIntentPublicId = second.publicId;
		activeToken = second.token;
		const revoked = await db
			.selectFrom('organisation_bootstrap_intents')
			.select(['status', 'revoked_at'])
			.where('public_id', '=', first.publicId)
			.executeTakeFirstOrThrow();
		expect(revoked.status).toBe('revoked');
		expect(revoked.revoked_at).not.toBeNull();
	});

	it('keeps Better Auth signup closed unless the bootstrap token and email match', async () => {
		const bootstrapCookie = `${ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE}=${activeToken}`;
		await expect(
			auth.api.signUpEmail({
				headers: new Headers({ cookie: bootstrapCookie }),
				body: {
					name: `${PREFIX}Wrong Email`,
					email: `wrong-${randomUUID()}@example.test`,
					password: PASSWORD
				}
			})
		).rejects.toBeDefined();

		await auth.api.signUpEmail({
			headers: new Headers({ cookie: bootstrapCookie }),
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

		const intent = await db
			.selectFrom('organisation_bootstrap_intents')
			.select(['auth_user_id', 'status'])
			.where('public_id', '=', activeIntentPublicId)
			.executeTakeFirstOrThrow();
		expect(intent).toMatchObject({ auth_user_id: authUserId, status: 'pending' });
	});

	it('atomically creates the domain identity, organisation, owner membership and standard roles after verification', async () => {
		await db
			.updateTable('auth_users')
			.set({ email_verified: 1, updated_at: new Date() })
			.where('id', '=', authUserId)
			.executeTakeFirstOrThrow();

		const created = await new OrganisationBootstrapService(db).activateVerifiedAuthUser({
			authUserId,
			email,
			displayName: `${PREFIX}Owner`,
			correlationId: `bootstrap-it-${randomUUID()}`
		});
		expect(created).not.toBeNull();
		platformUserId = created!.userId;
		organisationId = created!.organisationId;
		organisationPublicId = created!.organisationPublicId;
		memberId = created!.memberId;
		createdOrganisationIds.push(organisationId);

		const organisation = await db
			.selectFrom('organisations')
			.select(['public_id', 'legal_name', 'trading_name', 'default_timezone', 'default_currency_code'])
			.where('id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(organisation).toMatchObject({
			public_id: organisationPublicId,
			legal_name: `${PREFIX}Organisation`,
			trading_name: `${PREFIX}Trading`,
			default_timezone: 'Europe/London',
			default_currency_code: 'GBP'
		});

		const membership = await db
			.selectFrom('organisation_members')
			.select(['user_id', 'status'])
			.where('id', '=', memberId)
			.where('organisation_id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(membership).toMatchObject({ user_id: platformUserId, status: 'active' });

		const roles = await db
			.selectFrom('organisation_roles')
			.select(['id', 'name'])
			.where('organisation_id', '=', organisationId)
			.orderBy('name', 'asc')
			.execute();
		expect(roles.map((role) => role.name)).toEqual([
			'Administrator',
			'Field Worker',
			'Finance/Commercial',
			'Manager',
			'Member/Professional',
			'Owner',
			'Read Only'
		]);

		const assignedRole = await db
			.selectFrom('member_roles as assignment')
			.innerJoin('organisation_roles as role', (join) =>
				join
					.onRef('role.id', '=', 'assignment.organisation_role_id')
					.onRef('role.organisation_id', '=', 'assignment.organisation_id')
			)
			.select('role.name')
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.organisation_member_id', '=', memberId)
			.execute();
		expect(assignedRole.map((role) => role.name)).toEqual(['Owner']);

		const ownerDecision = await new PermissionService(db).decide(
			{
				organisationId,
				userId: platformUserId,
				memberId,
				correlationId: `bootstrap-it-${randomUUID()}`
			},
			'organisation.manage'
		);
		expect(ownerDecision).toEqual({ allowed: true, reason: 'role-grant' });

		const intent = await db
			.selectFrom('organisation_bootstrap_intents')
			.select(['status', 'created_user_id', 'organisation_id', 'activated_at'])
			.where('public_id', '=', activeIntentPublicId)
			.executeTakeFirstOrThrow();
		expect(intent.status).toBe('activated');
		expect(intent.created_user_id).toBe(platformUserId);
		expect(intent.organisation_id).toBe(organisationId);
		expect(intent.activated_at).not.toBeNull();

		const audit = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', '=', 'organisation.bootstrap.create')
			.executeTakeFirst();
		expect(audit?.action_key).toBe('organisation.bootstrap.create');
	});

	it('lets an existing NuBlox user create an additional organisation without duplicating identity', async () => {
		const created = await new OrganisationBootstrapService(db).createForExistingUser(
			{ userId: platformUserId, correlationId: `bootstrap-existing-${randomUUID()}` },
			{
				legalName: `${PREFIX}Second Organisation`,
				defaultTimezone: 'Europe/London',
				defaultCurrencyCode: 'GBP'
			}
		);
		createdOrganisationIds.push(created.organisationId);
		expect(created.userId).toBe(platformUserId);
		expect(created.organisationId).not.toBe(organisationId);

		const userCount = await db
			.selectFrom('users')
			.select(({ fn }) => fn.countAll<number>().as('count'))
			.where('id', '=', platformUserId)
			.executeTakeFirstOrThrow();
		expect(Number(userCount.count)).toBe(1);

		const membership = await db
			.selectFrom('organisation_members')
			.select(['user_id', 'status'])
			.where('organisation_id', '=', created.organisationId)
			.where('id', '=', created.memberId)
			.executeTakeFirstOrThrow();
		expect(membership).toMatchObject({ user_id: platformUserId, status: 'active' });
	});
});
