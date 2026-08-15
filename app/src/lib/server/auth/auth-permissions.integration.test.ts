import { randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import { hashPassword } from 'better-auth/crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PermissionService } from '$lib/server/capabilities/permission-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { resolveTenantContext } from '$lib/server/request-context';
import type { Actor } from '$lib/types/request-context';
import { auth, authPool } from './better-auth';
import { getSessionActor } from './session';

const PREFIX = 'Auth Integration ';
const PASSWORD = 'NuBlox-Test-Password-2026!';

let db: Database;

let platformUserId: string;
let authUserId: string;
let organisationAId: string;
let organisationAPublicId: string;
let organisationBId: string;
let organisationBPublicId: string;
let memberAId: string;
let permissionId: string;
let roleId: string;
let scopedProjectId: string;
let unscopedProjectId: string;
let email: string;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

function tenantEvent(actor: Actor, organisationPublicId: string): RequestEvent {
	return {
		locals: { actor },
		cookies: {
			get: (name: string) => (name === 'nublox_organisation' ? organisationPublicId : undefined)
		}
	} as unknown as RequestEvent;
}

async function cleanup(): Promise<void> {
	if (!db) return;

	if (scopedProjectId || unscopedProjectId) {
		const ids = [scopedProjectId, unscopedProjectId].filter(Boolean);
		await db.deleteFrom('project_members').where('project_id', 'in', ids).execute();
		await db.deleteFrom('project_organisations').where('project_id', 'in', ids).execute();
		await db.deleteFrom('projects').where('id', 'in', ids).execute();
	}

	if (memberAId && permissionId) {
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', memberAId)
			.where('permission_id', '=', permissionId)
			.execute();
	}

	if (memberAId && roleId) {
		await db
			.deleteFrom('member_roles')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', memberAId)
			.where('organisation_role_id', '=', roleId)
			.execute();
	}

	if (roleId && permissionId) {
		await db
			.deleteFrom('role_permissions')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_role_id', '=', roleId)
			.where('permission_id', '=', permissionId)
			.execute();
	}

	if (roleId) await db.deleteFrom('organisation_roles').where('id', '=', roleId).execute();
	if (permissionId) await db.deleteFrom('permissions').where('id', '=', permissionId).execute();

	if (authUserId) {
		await db.deleteFrom('auth_sessions').where('auth_user_id', '=', authUserId).execute();
		await db.deleteFrom('auth_accounts').where('auth_user_id', '=', authUserId).execute();
		await db.deleteFrom('auth_user_links').where('auth_user_id', '=', authUserId).execute();
		await db.deleteFrom('auth_users').where('id', '=', authUserId).execute();
	}

	if (memberAId) await db.deleteFrom('organisation_members').where('id', '=', memberAId).execute();
	if (organisationAId || organisationBId) {
		await db
			.deleteFrom('organisations')
			.where('id', 'in', [organisationAId, organisationBId].filter(Boolean))
			.execute();
	}
	if (platformUserId) await db.deleteFrom('users').where('id', '=', platformUserId).execute();
}

async function createFixture(): Promise<void> {
	platformUserId = insertedId(
		await db
			.insertInto('users')
			.values({
				public_id: randomUUID(),
				display_name: `${PREFIX}Platform User`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);

	authUserId = randomUUID();
	email = `auth-${randomUUID()}@example.test`;
	const now = new Date();
	await db
		.insertInto('auth_users')
		.values({
			id: authUserId,
			display_name: `${PREFIX}Auth User`,
			email,
			email_verified: 1,
			image: null,
			created_at: now,
			updated_at: now
		})
		.executeTakeFirstOrThrow();

	await db
		.insertInto('auth_accounts')
		.values({
			id: randomUUID(),
			provider_account_id: authUserId,
			provider_id: 'credential',
			auth_user_id: authUserId,
			access_token: null,
			refresh_token: null,
			id_token: null,
			access_token_expires_at: null,
			refresh_token_expires_at: null,
			scope: null,
			password: await hashPassword(PASSWORD),
			created_at: now,
			updated_at: now
		})
		.executeTakeFirstOrThrow();

	await db
		.insertInto('auth_user_links')
		.values({ auth_user_id: authUserId, user_id: platformUserId })
		.executeTakeFirstOrThrow();

	organisationAPublicId = randomUUID();
	organisationAId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: organisationAPublicId,
				legal_name: `${PREFIX}Organisation A`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);

	organisationBPublicId = randomUUID();
	organisationBId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: organisationBPublicId,
				legal_name: `${PREFIX}Organisation B`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);

	memberAId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationAId,
				user_id: platformUserId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: now
			})
			.executeTakeFirstOrThrow()
	);

	permissionId = insertedId(
		await db
			.insertInto('permissions')
			.values({
				capability_id: null,
				permission_key: `test.permission.${randomUUID()}`,
				name: `${PREFIX}Permission`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);

	roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				name: `${PREFIX}Role`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);

	await db
		.insertInto('role_permissions')
		.values({
			organisation_id: organisationAId,
			organisation_role_id: roleId,
			permission_id: permissionId
		})
		.executeTakeFirstOrThrow();

	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationAId,
			organisation_member_id: memberAId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();

	const createProject = async (number: string, addMember: boolean): Promise<string> => {
		const projectId = insertedId(
			await db
				.insertInto('projects')
				.values({
					owning_organisation_id: organisationAId,
					public_id: randomUUID(),
					project_number: number,
					name: `${PREFIX}${number}`,
					status: 'active'
				})
				.executeTakeFirstOrThrow()
		);

		await db
			.insertInto('project_organisations')
			.values({
				project_id: projectId,
				participant_organisation_id: organisationAId,
				status: 'active',
				joined_at: now
			})
			.executeTakeFirstOrThrow();

		if (addMember) {
			await db
				.insertInto('project_members')
				.values({
					project_id: projectId,
					participant_organisation_id: organisationAId,
					organisation_member_id: memberAId,
					status: 'active',
					joined_at: now
				})
				.executeTakeFirstOrThrow();
		}

		return projectId;
	};

	scopedProjectId = await createProject(`AUTH-${randomUUID()}`, true);
	unscopedProjectId = await createProject(`AUTH-${randomUUID()}`, false);
}

describe('authentication, tenant context and effective permissions', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
		await authPool.end();
	});

	it('authenticates with Better Auth and maps the session to the linked NuBlox user', async () => {
		const signIn = await auth.api.signInEmail({
			returnHeaders: true,
			body: { email, password: PASSWORD, rememberMe: false }
		});
		const sessionCookie = signIn.headers
			.getSetCookie()
			.find((cookie) => cookie.startsWith('nublox.session_token='));
		expect(sessionCookie).toBeDefined();

		const event = {
			request: new Request('http://localhost:5173/private', {
				headers: { cookie: sessionCookie!.split(';', 1)[0] }
			})
		} as RequestEvent;

		const actor = await getSessionActor(event);
		expect(actor).toMatchObject({
			authUserId,
			userId: platformUserId,
			email
		});
	});

	it('treats the organisation cookie as a hint and revalidates membership', async () => {
		const actor: Actor = {
			authUserId,
			userId: platformUserId,
			email,
			displayName: `${PREFIX}Platform User`
		};

		const allowed = await resolveTenantContext(tenantEvent(actor, organisationAPublicId));
		expect(allowed).toMatchObject({
			organisationId: organisationAId,
			organisationPublicId: organisationAPublicId,
			memberId: memberAId,
			membershipVerified: true
		});

		const forged = await resolveTenantContext(tenantEvent(actor, organisationBPublicId));
		expect(forged.membershipVerified).toBe(false);
		expect(forged.organisationId).toBeNull();
	});

	it('resolves role grants, explicit deny/allow precedence and project scope', async () => {
		const permissionKeyRow = await db
			.selectFrom('permissions')
			.select('permission_key')
			.where('id', '=', permissionId)
			.executeTakeFirstOrThrow();
		const permissionKey = permissionKeyRow.permission_key;
		const actor = {
			organisationId: organisationAId,
			userId: platformUserId,
			memberId: memberAId,
			correlationId: `auth-it-${randomUUID()}`
		};
		const service = new PermissionService(db);

		expect(await service.decide(actor, permissionKey)).toEqual({
			allowed: true,
			reason: 'role-grant'
		});
		expect(await service.decide(actor, permissionKey, { projectId: scopedProjectId })).toEqual({
			allowed: true,
			reason: 'role-grant'
		});
		expect(await service.decide(actor, permissionKey, { projectId: unscopedProjectId })).toEqual({
			allowed: false,
			reason: 'project-scope-deny'
		});

		await db
			.insertInto('member_permission_overrides')
			.values({
				organisation_id: organisationAId,
				organisation_member_id: memberAId,
				permission_id: permissionId,
				effect: 'deny',
				reason: 'integration test'
			})
			.executeTakeFirstOrThrow();
		expect(await service.decide(actor, permissionKey)).toEqual({
			allowed: false,
			reason: 'member-deny'
		});

		await db
			.updateTable('member_permission_overrides')
			.set({ effect: 'allow' })
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', memberAId)
			.where('permission_id', '=', permissionId)
			.executeTakeFirstOrThrow();
		expect(await service.decide(actor, permissionKey)).toEqual({
			allowed: true,
			reason: 'member-allow'
		});
	});
});
