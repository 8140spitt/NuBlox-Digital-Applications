import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import {
	AccessReviewAuthorisationError,
	AccessReviewService,
	AccessReviewValidationError
} from './access-review-service';
import { ensureStandardAccessRoleBindings } from './standard-access-roles';

const PREFIX = 'Access Review Integration ';

let db: Database;
let organisationId: string;
let ownerUserId: string;
let ownerMemberId: string;
let ownerMemberPublicId: string;
let adminUserId: string;
let adminMemberId: string;
let workerUserId: string;
let workerMemberId: string;
let ownerRoleId: string;
let ownerRolePublicId: string;
let adminRoleId: string;
let readOnlyRoleId: string;
let readOnlyRolePublicId: string;
let elevatedRoleId: string;
let elevatedRolePublicId: string;
let organisationManagePermissionId: string;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

function actor(userId: string, memberId: string) {
	return {
		organisationId,
		userId,
		memberId,
		correlationId: randomUUID()
	};
}

async function createUser(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createMember(userId: string): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: publicId,
				status: 'active',
				joined_at: new Date()
			})
			.executeTakeFirstOrThrow()
	);
	return { id, publicId };
}

async function cleanup(): Promise<void> {
	if (!db) return;
	if (organisationId) {
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('access_review_campaigns')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('member_permission_override_access_windows')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('member_role_access_windows')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db.deleteFrom('member_roles').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', '=', organisationId).execute();
		await db
			.deleteFrom('organisation_role_template_bindings')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('organisation_roles')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db.deleteFrom('organisations').where('id', '=', organisationId).execute();
	}
	const userIds = [ownerUserId, adminUserId, workerUserId].filter(Boolean);
	if (userIds.length > 0) await db.deleteFrom('users').where('id', 'in', userIds).execute();
}

async function resetAccessState(): Promise<void> {
	await db
		.deleteFrom('audit_events')
		.where('acting_organisation_id', '=', organisationId)
		.execute();
	await db
		.deleteFrom('access_review_campaigns')
		.where('organisation_id', '=', organisationId)
		.execute();
	await db
		.deleteFrom('member_permission_override_access_windows')
		.where('organisation_id', '=', organisationId)
		.execute();
	await db
		.deleteFrom('member_permission_overrides')
		.where('organisation_id', '=', organisationId)
		.execute();
	await db
		.deleteFrom('member_role_access_windows')
		.where('organisation_id', '=', organisationId)
		.execute();
	await db.deleteFrom('member_roles').where('organisation_id', '=', organisationId).execute();

	await db
		.insertInto('member_roles')
		.values([
			{
				organisation_id: organisationId,
				organisation_member_id: ownerMemberId,
				organisation_role_id: ownerRoleId
			},
			{
				organisation_id: organisationId,
				organisation_member_id: adminMemberId,
				organisation_role_id: adminRoleId
			},
			{
				organisation_id: organisationId,
				organisation_member_id: workerMemberId,
				organisation_role_id: readOnlyRoleId
			},
			{
				organisation_id: organisationId,
				organisation_member_id: workerMemberId,
				organisation_role_id: elevatedRoleId
			}
		])
		.execute();
	await db
		.insertInto('member_role_access_windows')
		.values({
			organisation_id: organisationId,
			organisation_member_id: workerMemberId,
			organisation_role_id: elevatedRoleId,
			effective_from: new Date(Date.now() - 60_000),
			expires_at: new Date(Date.now() + 86_400_000),
			reason: 'Temporary elevated access under review.'
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('member_permission_overrides')
		.values({
			organisation_id: organisationId,
			organisation_member_id: workerMemberId,
			permission_id: organisationManagePermissionId,
			effect: 'deny',
			reason: 'Least privilege safeguard.'
		})
		.executeTakeFirstOrThrow();
}

async function createFixture(): Promise<void> {
	organisationManagePermissionId = (
		await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'organisation.manage')
			.executeTakeFirstOrThrow()
	).id;
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}Organisation`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	ownerUserId = await createUser('Owner');
	adminUserId = await createUser('Administrator');
	workerUserId = await createUser('Worker');
	const ownerMember = await createMember(ownerUserId);
	ownerMemberId = ownerMember.id;
	ownerMemberPublicId = ownerMember.publicId;
	adminMemberId = (await createMember(adminUserId)).id;
	workerMemberId = (await createMember(workerUserId)).id;

	ownerRolePublicId = randomUUID();
	ownerRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: ownerRolePublicId,
				name: 'Owner',
				description: 'Access review Owner fixture.',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	adminRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: 'Administrator',
				description: 'Access review Administrator fixture.',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	readOnlyRolePublicId = randomUUID();
	readOnlyRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: readOnlyRolePublicId,
				name: 'Read Only',
				description: 'Access review Read Only fixture.',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	elevatedRolePublicId = randomUUID();
	elevatedRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: elevatedRolePublicId,
				name: `${PREFIX}Elevated`,
				description: 'Custom role whose organisation.manage grant is neutralised by a deny.',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	await ensureStandardAccessRoleBindings(db, organisationId);
	await db
		.insertInto('role_permissions')
		.values([
			{
				organisation_id: organisationId,
				organisation_role_id: ownerRoleId,
				permission_id: organisationManagePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: adminRoleId,
				permission_id: organisationManagePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: elevatedRoleId,
				permission_id: organisationManagePermissionId
			}
		])
		.execute();
	await resetAccessState();
}

describe('organisation access review and attestation', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	beforeEach(async () => {
		await resetAccessState();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('snapshots role assignments, stable role identity, lifecycle metadata and explicit overrides', async () => {
		const service = new AccessReviewService(db);
		const campaignPublicId = await service.openCampaign(actor(adminUserId, adminMemberId), {
			name: 'Quarterly access certification',
			dueAt: new Date(Date.now() + 7 * 86_400_000)
		});
		const detail = await service.loadCampaign(actor(adminUserId, adminMemberId), campaignPublicId);

		expect(detail.campaign.status).toBe('open');
		expect(detail.campaign.totalItems).toBe(5);
		expect(detail.campaign.pendingItems).toBe(5);
		const ownerItem = detail.items.find((item) => item.rolePublicId === ownerRolePublicId);
		expect(ownerItem?.memberPublicId).toBe(ownerMemberPublicId);
		expect(ownerItem?.stableRoleKey).toBe('owner');
		const elevatedItem = detail.items.find((item) => item.rolePublicId === elevatedRolePublicId);
		expect(elevatedItem?.lifecycleState).toBe('effective');
		expect(elevatedItem?.expiresAt).toBeInstanceOf(Date);
		expect(elevatedItem?.sourceReason).toBe('Temporary elevated access under review.');
		const denyItem = detail.items.find((item) => item.permissionKey === 'organisation.manage');
		expect(denyItem?.permissionEffect).toBe('deny');
		expect(denyItem?.sourceReason).toBe('Least privilege safeguard.');

		const audit = await db
			.selectFrom('audit_events')
			.select(['action_key', 'subject_public_id'])
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', '=', 'organisation.access-review.open')
			.where('subject_public_id', '=', campaignPublicId)
			.executeTakeFirst();
		expect(audit).toBeTruthy();
	});

	it('does not let an Administrator revoke the stable Owner assignment through a review', async () => {
		const service = new AccessReviewService(db);
		const adminActor = actor(adminUserId, adminMemberId);
		const campaignPublicId = await service.openCampaign(adminActor, {
			name: 'Owner boundary review'
		});
		const detail = await service.loadCampaign(adminActor, campaignPublicId);
		const ownerItem = detail.items.find((item) => item.rolePublicId === ownerRolePublicId);
		if (!ownerItem) throw new Error('Expected Owner review item.');

		await expect(
			service.decideItem(adminActor, campaignPublicId, ownerItem.publicId, {
				decision: 'revoke',
				reason: 'Attempted ownership revocation.'
			})
		).rejects.toBeInstanceOf(AccessReviewAuthorisationError);

		const assignment = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', ownerMemberId)
			.where('organisation_role_id', '=', ownerRoleId)
			.executeTakeFirst();
		expect(assignment).toBeTruthy();
		const reviewItem = await db
			.selectFrom('access_review_items')
			.select('decision')
			.where('public_id', '=', ownerItem.publicId)
			.executeTakeFirstOrThrow();
		expect(reviewItem.decision).toBeNull();
	});

	it('revokes an assignment transactionally while retaining the immutable review item', async () => {
		const service = new AccessReviewService(db);
		const ownerActor = actor(ownerUserId, ownerMemberId);
		const campaignPublicId = await service.openCampaign(ownerActor, {
			name: 'Worker access review'
		});
		const detail = await service.loadCampaign(ownerActor, campaignPublicId);
		const elevatedItem = detail.items.find((item) => item.rolePublicId === elevatedRolePublicId);
		if (!elevatedItem) throw new Error('Expected elevated-role review item.');

		await service.decideItem(ownerActor, campaignPublicId, elevatedItem.publicId, {
			decision: 'revoke',
			reason: 'Elevated access is no longer required.'
		});

		const assignment = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', workerMemberId)
			.where('organisation_role_id', '=', elevatedRoleId)
			.executeTakeFirst();
		expect(assignment).toBeUndefined();
		const reviewItem = await db
			.selectFrom('access_review_items')
			.select(['decision', 'decision_reason', 'revocation_applied_at'])
			.where('public_id', '=', elevatedItem.publicId)
			.executeTakeFirstOrThrow();
		expect(reviewItem.decision).toBe('revoke');
		expect(reviewItem.decision_reason).toBe('Elevated access is no longer required.');
		expect(reviewItem.revocation_applied_at).toBeInstanceOf(Date);
	});

	it('rolls back removal of a deny when the review would expose toxic access', async () => {
		const service = new AccessReviewService(db);
		const adminActor = actor(adminUserId, adminMemberId);
		const campaignPublicId = await service.openCampaign(adminActor, {
			name: 'Deny safeguard review'
		});
		const detail = await service.loadCampaign(adminActor, campaignPublicId);
		const denyItem = detail.items.find((item) => item.permissionKey === 'organisation.manage');
		if (!denyItem) throw new Error('Expected organisation.manage override review item.');

		await expect(
			service.decideItem(adminActor, campaignPublicId, denyItem.publicId, {
				decision: 'revoke',
				reason: 'Test whether the protective deny can be removed.'
			})
		).rejects.toBeInstanceOf(AccessReviewValidationError);

		const override = await db
			.selectFrom('member_permission_overrides')
			.select('effect')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', workerMemberId)
			.where('permission_id', '=', organisationManagePermissionId)
			.executeTakeFirst();
		expect(override?.effect).toBe('deny');
		const reviewItem = await db
			.selectFrom('access_review_items')
			.select('decision')
			.where('public_id', '=', denyItem.publicId)
			.executeTakeFirstOrThrow();
		expect(reviewItem.decision).toBeNull();
	});

	it('requires every snapshotted item to be decided before completing the campaign', async () => {
		const service = new AccessReviewService(db);
		const adminActor = actor(adminUserId, adminMemberId);
		const campaignPublicId = await service.openCampaign(adminActor, { name: 'Completion review' });

		await expect(service.completeCampaign(adminActor, campaignPublicId)).rejects.toBeInstanceOf(
			AccessReviewValidationError
		);
		const detail = await service.loadCampaign(adminActor, campaignPublicId);
		for (const item of detail.items) {
			await service.decideItem(adminActor, campaignPublicId, item.publicId, {
				decision: 'certify'
			});
		}
		await service.completeCampaign(adminActor, campaignPublicId);
		const completed = await service.loadCampaign(adminActor, campaignPublicId);
		expect(completed.campaign.status).toBe('completed');
		expect(completed.campaign.pendingItems).toBe(0);
		expect(completed.campaign.completedAt).toBeInstanceOf(Date);
	});
});
