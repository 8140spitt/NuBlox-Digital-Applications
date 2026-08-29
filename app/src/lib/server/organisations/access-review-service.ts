import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import type { Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import {
	accessConflictViolationMessage,
	evaluateMemberAccessConflicts
} from './access-conflict-policy';
import { hasActiveOwnerRole } from './role-delegation-policy';
import {
	ensureStandardAccessRoleBindings,
	OWNER_ACCESS_ROLE_KEY,
	STANDARD_ACCESS_ROLE_TEMPLATE_KEY
} from './standard-access-roles';

export type AccessReviewCampaignStatus = 'open' | 'completed' | 'cancelled';
export type AccessReviewAccessType = 'role_assignment' | 'permission_override';
export type AccessReviewLifecycleState = 'effective' | 'scheduled' | 'expired';
export type AccessReviewDecision = 'certify' | 'revoke';

export type AccessReviewCampaignSummary = {
	publicId: string;
	name: string;
	status: AccessReviewCampaignStatus;
	snapshotAt: Date;
	dueAt: Date | null;
	openedAt: Date;
	completedAt: Date | null;
	cancelledAt: Date | null;
	totalItems: number;
	pendingItems: number;
};

export type AccessReviewItemSummary = {
	publicId: string;
	memberPublicId: string;
	accessType: AccessReviewAccessType;
	sourceKey: string;
	rolePublicId: string | null;
	stableRoleKey: string | null;
	permissionKey: string | null;
	permissionEffect: 'allow' | 'deny' | null;
	displayLabel: string;
	lifecycleState: AccessReviewLifecycleState;
	effectiveFrom: Date | null;
	expiresAt: Date | null;
	sourceReason: string | null;
	decision: AccessReviewDecision | null;
	decisionReason: string | null;
	decidedAt: Date | null;
	revocationAppliedAt: Date | null;
};

export type AccessReviewCampaignDetail = {
	campaign: AccessReviewCampaignSummary;
	items: AccessReviewItemSummary[];
};

export class AccessReviewValidationError extends Error {
	readonly code = 'ACCESS_REVIEW_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'AccessReviewValidationError';
	}
}

export class AccessReviewNotFoundError extends Error {
	readonly code = 'ACCESS_REVIEW_NOT_FOUND';
	constructor(message: string) {
		super(message);
		this.name = 'AccessReviewNotFoundError';
	}
}

export class AccessReviewAuthorisationError extends Error {
	readonly code = 'ACCESS_REVIEW_FORBIDDEN';
	constructor() {
		super('Organisation management authority is required to administer access reviews.');
		this.name = 'AccessReviewAuthorisationError';
	}
}

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

function campaignName(value: string): string {
	const name = value.trim();
	if (!name || name.length > 160) {
		throw new AccessReviewValidationError('Access review name must be between 1 and 160 characters.');
	}
	return name;
}

function reviewReason(value: string | null | undefined, required: boolean): string | null {
	const reason = value?.trim() ?? '';
	if (required && !reason) {
		throw new AccessReviewValidationError('A reason is required when access is revoked.');
	}
	if (reason.length > 1000) {
		throw new AccessReviewValidationError('Access review reason must not exceed 1000 characters.');
	}
	return reason || null;
}

function campaignStatus(value: string): AccessReviewCampaignStatus {
	if (value === 'open' || value === 'completed' || value === 'cancelled') return value;
	throw new Error(`Unexpected access review campaign status: ${value}`);
}

function accessType(value: string): AccessReviewAccessType {
	if (value === 'role_assignment' || value === 'permission_override') return value;
	throw new Error(`Unexpected access review item type: ${value}`);
}

function lifecycleState(value: string): AccessReviewLifecycleState {
	if (value === 'effective' || value === 'scheduled' || value === 'expired') return value;
	throw new Error(`Unexpected access review lifecycle state: ${value}`);
}

function permissionEffect(value: string | null): 'allow' | 'deny' | null {
	if (value === null || value === 'allow' || value === 'deny') return value;
	throw new Error(`Unexpected permission override effect: ${value}`);
}

function reviewDecision(value: string | null): AccessReviewDecision | null {
	if (value === null || value === 'certify' || value === 'revoke') return value;
	throw new Error(`Unexpected access review decision: ${value}`);
}

function stateAt(
	effectiveFrom: Date | null,
	expiresAt: Date | null,
	at: Date
): AccessReviewLifecycleState {
	if (expiresAt !== null && expiresAt <= at) return 'expired';
	if (effectiveFrom !== null && effectiveFrom > at) return 'scheduled';
	return 'effective';
}

export class AccessReviewService {
	constructor(private readonly db: Database) {}

	async listCampaigns(actor: TenantActorContext): Promise<AccessReviewCampaignSummary[]> {
		await this.requireManage(this.db, actor, new Date());
		const campaigns = await this.db
			.selectFrom('access_review_campaigns')
			.select([
				'id',
				'public_id',
				'name',
				'status',
				'snapshot_at',
				'due_at',
				'opened_at',
				'completed_at',
				'cancelled_at'
			])
			.where('organisation_id', '=', actor.organisationId)
			.orderBy('opened_at', 'desc')
			.execute();

		const campaignIds = campaigns.map((campaign) => campaign.id);
		const counts = new Map<string, { total: number; pending: number }>();
		if (campaignIds.length > 0) {
			const items = await this.db
				.selectFrom('access_review_items')
				.select(['campaign_id', 'decision'])
				.where('campaign_id', 'in', campaignIds)
				.execute();
			for (const item of items) {
				const current = counts.get(item.campaign_id) ?? { total: 0, pending: 0 };
				current.total += 1;
				if (item.decision === null) current.pending += 1;
				counts.set(item.campaign_id, current);
			}
		}

		return campaigns.map((campaign) => this.mapCampaign(campaign, counts.get(campaign.id)));
	}

	async loadCampaign(
		actor: TenantActorContext,
		campaignPublicId: string
	): Promise<AccessReviewCampaignDetail> {
		await this.requireManage(this.db, actor, new Date());
		const campaign = await this.db
			.selectFrom('access_review_campaigns')
			.select([
				'id',
				'public_id',
				'name',
				'status',
				'snapshot_at',
				'due_at',
				'opened_at',
				'completed_at',
				'cancelled_at'
			])
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', campaignPublicId)
			.executeTakeFirst();
		if (!campaign) throw new AccessReviewNotFoundError('Access review campaign not found.');

		const items = await this.db
			.selectFrom('access_review_items')
			.select([
				'public_id',
				'member_public_id',
				'access_type',
				'source_key',
				'role_public_id',
				'stable_role_key',
				'permission_key',
				'permission_effect',
				'display_label',
				'lifecycle_state',
				'effective_from',
				'expires_at',
				'source_reason',
				'decision',
				'decision_reason',
				'decided_at',
				'revocation_applied_at'
			])
			.where('campaign_id', '=', campaign.id)
			.orderBy('organisation_member_id', 'asc')
			.orderBy('access_type', 'asc')
			.orderBy('display_label', 'asc')
			.execute();
		const pendingItems = items.filter((item) => item.decision === null).length;

		return {
			campaign: this.mapCampaign(campaign, { total: items.length, pending: pendingItems }),
			items: items.map((item) => ({
				publicId: item.public_id,
				memberPublicId: item.member_public_id,
				accessType: accessType(item.access_type),
				sourceKey: item.source_key,
				rolePublicId: item.role_public_id,
				stableRoleKey: item.stable_role_key,
				permissionKey: item.permission_key,
				permissionEffect: permissionEffect(item.permission_effect),
				displayLabel: item.display_label,
				lifecycleState: lifecycleState(item.lifecycle_state),
				effectiveFrom: item.effective_from,
				expiresAt: item.expires_at,
				sourceReason: item.source_reason,
				decision: reviewDecision(item.decision),
				decisionReason: item.decision_reason,
				decidedAt: item.decided_at,
				revocationAppliedAt: item.revocation_applied_at
			}))
		};
	}

	async openCampaign(
		actor: TenantActorContext,
		input: { name: string; dueAt?: Date | null }
	): Promise<string> {
		const name = campaignName(input.name);
		const dueAt = input.dueAt ?? null;
		const publicId = randomUUID();

		await this.db.transaction().execute(async (trx) => {
			const snapshotAt = new Date();
			await this.requireManage(trx, actor, snapshotAt);
			if (dueAt !== null && dueAt <= snapshotAt) {
				throw new AccessReviewValidationError('Access review due date must be in the future.');
			}
			await ensureStandardAccessRoleBindings(trx, actor.organisationId);

			const campaignId = insertedId(
				await trx
					.insertInto('access_review_campaigns')
					.values({
						public_id: publicId,
						organisation_id: actor.organisationId,
						name,
						status: 'open',
						snapshot_at: snapshotAt,
						due_at: dueAt,
						opened_by_member_id: actor.memberId,
						opened_at: snapshotAt,
						completed_at: null,
						cancelled_at: null
					})
					.executeTakeFirstOrThrow()
			);

			const roleRows = await trx
				.selectFrom('member_roles as assignment')
				.innerJoin('organisation_members as member', (join) =>
					join
						.onRef('member.id', '=', 'assignment.organisation_member_id')
						.onRef('member.organisation_id', '=', 'assignment.organisation_id')
				)
				.innerJoin('organisation_roles as role', (join) =>
					join
						.onRef('role.id', '=', 'assignment.organisation_role_id')
						.onRef('role.organisation_id', '=', 'assignment.organisation_id')
				)
				.leftJoin('organisation_role_template_bindings as binding', (join) =>
					join
						.onRef('binding.organisation_role_id', '=', 'assignment.organisation_role_id')
						.onRef('binding.organisation_id', '=', 'assignment.organisation_id')
						.on('binding.template_key', '=', STANDARD_ACCESS_ROLE_TEMPLATE_KEY)
				)
				.leftJoin('member_role_access_windows as window', (join) =>
					join
						.onRef('window.organisation_id', '=', 'assignment.organisation_id')
						.onRef('window.organisation_member_id', '=', 'assignment.organisation_member_id')
						.onRef('window.organisation_role_id', '=', 'assignment.organisation_role_id')
				)
				.select([
					'assignment.organisation_member_id as memberId',
					'member.public_id as memberPublicId',
					'role.id as roleId',
					'role.public_id as rolePublicId',
					'role.name as roleName',
					'binding.role_key as stableRoleKey',
					'window.effective_from as effectiveFrom',
					'window.expires_at as expiresAt',
					'window.reason as sourceReason'
				])
				.where('assignment.organisation_id', '=', actor.organisationId)
				.execute();

			const overrideRows = await trx
				.selectFrom('member_permission_overrides as override')
				.innerJoin('organisation_members as member', (join) =>
					join
						.onRef('member.id', '=', 'override.organisation_member_id')
						.onRef('member.organisation_id', '=', 'override.organisation_id')
				)
				.innerJoin('permissions as permission', 'permission.id', 'override.permission_id')
				.leftJoin('member_permission_override_access_windows as window', (join) =>
					join
						.onRef('window.organisation_id', '=', 'override.organisation_id')
						.onRef('window.organisation_member_id', '=', 'override.organisation_member_id')
						.onRef('window.permission_id', '=', 'override.permission_id')
				)
				.select([
					'override.organisation_member_id as memberId',
					'member.public_id as memberPublicId',
					'permission.id as permissionId',
					'permission.permission_key as permissionKey',
					'permission.name as permissionName',
					'override.effect as permissionEffect',
					'override.reason as sourceReason',
					'window.effective_from as effectiveFrom',
					'window.expires_at as expiresAt'
				])
				.where('override.organisation_id', '=', actor.organisationId)
				.execute();

			const itemValues = [
				...roleRows.map((row) => ({
					public_id: randomUUID(),
					campaign_id: campaignId,
					organisation_id: actor.organisationId,
					organisation_member_id: row.memberId,
					member_public_id: row.memberPublicId,
					access_type: 'role_assignment',
					source_key: row.rolePublicId,
					organisation_role_id: row.roleId,
					role_public_id: row.rolePublicId,
					stable_role_key: row.stableRoleKey,
					permission_id: null,
					permission_key: null,
					permission_effect: null,
					display_label: row.roleName,
					lifecycle_state: stateAt(row.effectiveFrom, row.expiresAt, snapshotAt),
					effective_from: row.effectiveFrom,
					expires_at: row.expiresAt,
					source_reason: row.sourceReason,
					decision: null,
					decision_reason: null,
					decided_by_member_id: null,
					decided_at: null,
					revocation_applied_at: null
				})),
				...overrideRows.map((row) => ({
					public_id: randomUUID(),
					campaign_id: campaignId,
					organisation_id: actor.organisationId,
					organisation_member_id: row.memberId,
					member_public_id: row.memberPublicId,
					access_type: 'permission_override',
					source_key: row.permissionKey,
					organisation_role_id: null,
					role_public_id: null,
					stable_role_key: null,
					permission_id: row.permissionId,
					permission_key: row.permissionKey,
					permission_effect: row.permissionEffect,
					display_label: row.permissionName,
					lifecycle_state: stateAt(row.effectiveFrom, row.expiresAt, snapshotAt),
					effective_from: row.effectiveFrom,
					expires_at: row.expiresAt,
					source_reason: row.sourceReason,
					decision: null,
					decision_reason: null,
					decided_by_member_id: null,
					decided_at: null,
					revocation_applied_at: null
				}))
			];
			if (itemValues.length > 0) {
				await trx.insertInto('access_review_items').values(itemValues).execute();
			}

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.access-review.open',
				subjectType: 'access_review_campaign',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					name,
					snapshotAt: snapshotAt.toISOString(),
					dueAt: dueAt?.toISOString() ?? null,
					itemCount: itemValues.length
				}
			});
		});

		return publicId;
	}

	async decideItem(
		actor: TenantActorContext,
		campaignPublicId: string,
		itemPublicId: string,
		input: { decision: AccessReviewDecision; reason?: string | null }
	): Promise<void> {
		if (input.decision !== 'certify' && input.decision !== 'revoke') {
			throw new AccessReviewValidationError('Unsupported access review decision.');
		}
		const reason = reviewReason(input.reason, input.decision === 'revoke');

		await this.db.transaction().execute(async (trx) => {
			const now = new Date();
			await this.requireManage(trx, actor, now);
			const campaign = await trx
				.selectFrom('access_review_campaigns')
				.select(['id', 'public_id', 'status'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', campaignPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!campaign) throw new AccessReviewNotFoundError('Access review campaign not found.');
			if (campaign.status !== 'open') {
				throw new AccessReviewValidationError('Only open access review campaigns can be decided.');
			}

			const item = await trx
				.selectFrom('access_review_items')
				.select([
					'id',
					'public_id',
					'organisation_member_id',
					'member_public_id',
					'access_type',
					'source_key',
					'organisation_role_id',
					'stable_role_key',
					'permission_id',
					'permission_key',
					'permission_effect',
					'decision'
				])
				.where('campaign_id', '=', campaign.id)
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', itemPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!item) throw new AccessReviewNotFoundError('Access review item not found.');
			if (item.decision !== null) {
				throw new AccessReviewValidationError('This access review item has already been decided.');
			}

			let sourceExisted = true;
			if (input.decision === 'revoke') {
				sourceExisted = await this.revokeSource(trx, actor, item, now);
			}

			await trx
				.updateTable('access_review_items')
				.set({
					decision: input.decision,
					decision_reason: reason,
					decided_by_member_id: actor.memberId,
					decided_at: now,
					revocation_applied_at: input.decision === 'revoke' && sourceExisted ? now : null
				})
				.where('id', '=', item.id)
				.executeTakeFirstOrThrow();

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.access-review.item.decision',
				subjectType: 'access_review_item',
				subjectPublicId: item.public_id,
				correlationId: actor.correlationId,
				changeSummary: {
					campaignPublicId: campaign.public_id,
					memberPublicId: item.member_public_id,
					accessType: item.access_type,
					sourceKey: item.source_key,
					stableRoleKey: item.stable_role_key,
					permissionKey: item.permission_key,
					permissionEffect: item.permission_effect,
					decision: input.decision,
					reason,
					sourceExisted
				}
			});
		});
	}

	async completeCampaign(actor: TenantActorContext, campaignPublicId: string): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			const now = new Date();
			await this.requireManage(trx, actor, now);
			const campaign = await trx
				.selectFrom('access_review_campaigns')
				.select(['id', 'public_id', 'status'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', campaignPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!campaign) throw new AccessReviewNotFoundError('Access review campaign not found.');
			if (campaign.status !== 'open') {
				throw new AccessReviewValidationError('Only open access review campaigns can be completed.');
			}
			const pending = await trx
				.selectFrom('access_review_items')
				.select('id')
				.where('campaign_id', '=', campaign.id)
				.where('decision', 'is', null)
				.limit(1)
				.executeTakeFirst();
			if (pending) {
				throw new AccessReviewValidationError(
					'All access review items must be decided before the campaign can be completed.'
				);
			}

			await trx
				.updateTable('access_review_campaigns')
				.set({ status: 'completed', completed_at: now })
				.where('id', '=', campaign.id)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.access-review.complete',
				subjectType: 'access_review_campaign',
				subjectPublicId: campaign.public_id,
				correlationId: actor.correlationId
			});
		});
	}

	async cancelCampaign(actor: TenantActorContext, campaignPublicId: string): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			const now = new Date();
			await this.requireManage(trx, actor, now);
			const campaign = await trx
				.selectFrom('access_review_campaigns')
				.select(['id', 'public_id', 'status'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', campaignPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!campaign) throw new AccessReviewNotFoundError('Access review campaign not found.');
			if (campaign.status !== 'open') {
				throw new AccessReviewValidationError('Only open access review campaigns can be cancelled.');
			}

			await trx
				.updateTable('access_review_campaigns')
				.set({ status: 'cancelled', cancelled_at: now })
				.where('id', '=', campaign.id)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.access-review.cancel',
				subjectType: 'access_review_campaign',
				subjectPublicId: campaign.public_id,
				correlationId: actor.correlationId
			});
		});
	}

	private mapCampaign(
		campaign: {
			public_id: string;
			name: string;
			status: string;
			snapshot_at: Date;
			due_at: Date | null;
			opened_at: Date;
			completed_at: Date | null;
			cancelled_at: Date | null;
		},
		counts?: { total: number; pending: number }
	): AccessReviewCampaignSummary {
		return {
			publicId: campaign.public_id,
			name: campaign.name,
			status: campaignStatus(campaign.status),
			snapshotAt: campaign.snapshot_at,
			dueAt: campaign.due_at,
			openedAt: campaign.opened_at,
			completedAt: campaign.completed_at,
			cancelledAt: campaign.cancelled_at,
			totalItems: counts?.total ?? 0,
			pendingItems: counts?.pending ?? 0
		};
	}

	private async requireManage(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		at: Date
	): Promise<void> {
		const decision = await new PermissionService(db).decide(actor, 'organisation.manage', { at });
		if (!decision.allowed) throw new AccessReviewAuthorisationError();
	}

	private async revokeSource(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		item: {
			organisation_member_id: string;
			access_type: string;
			organisation_role_id: string | null;
			stable_role_key: string | null;
			permission_id: string | null;
			permission_key: string | null;
			permission_effect: string | null;
		},
		at: Date
	): Promise<boolean> {
		if (item.access_type === 'role_assignment') {
			if (item.organisation_role_id === null) throw new Error('Review role item has no role ID.');
			if (
				item.stable_role_key === OWNER_ACCESS_ROLE_KEY &&
				!(await hasActiveOwnerRole(db, actor, at))
			) {
				throw new AccessReviewAuthorisationError();
			}
			const targetWasManager = await this.memberHasPermission(
				db,
				actor.organisationId,
				item.organisation_member_id,
				'organisation.manage',
				actor.correlationId,
				at
			);
			const result = await db
				.deleteFrom('member_roles')
				.where('organisation_id', '=', actor.organisationId)
				.where('organisation_member_id', '=', item.organisation_member_id)
				.where('organisation_role_id', '=', item.organisation_role_id)
				.executeTakeFirst();
			const sourceExisted = result.numDeletedRows === 1n;
			if (sourceExisted && item.stable_role_key === OWNER_ACCESS_ROLE_KEY) {
				await this.requireActiveOwner(db, actor.organisationId, at);
			}
			if (sourceExisted && targetWasManager) {
				await this.requireActiveOrganisationManager(db, actor, at);
			}
			return sourceExisted;
		}

		if (item.access_type === 'permission_override') {
			if (item.permission_id === null || item.permission_key === null) {
				throw new Error('Review permission item has no permission identity.');
			}
			const effect = permissionEffect(item.permission_effect);
			if (effect === null) throw new Error('Review permission item has no effect.');
			const targetWasManager =
				effect === 'allow' && item.permission_key === 'organisation.manage'
					? await this.memberHasPermission(
							db,
							actor.organisationId,
							item.organisation_member_id,
							'organisation.manage',
							actor.correlationId,
							at
						)
					: false;
			const result = await db
				.deleteFrom('member_permission_overrides')
				.where('organisation_id', '=', actor.organisationId)
				.where('organisation_member_id', '=', item.organisation_member_id)
				.where('permission_id', '=', item.permission_id)
				.executeTakeFirst();
			const sourceExisted = result.numDeletedRows === 1n;
			if (sourceExisted && effect === 'deny') {
				const targetActor = await this.memberActor(
					db,
					actor.organisationId,
					item.organisation_member_id,
					actor.correlationId
				);
				if (targetActor !== null) {
					const violations = await evaluateMemberAccessConflicts(db, targetActor, { at });
					if (violations.length > 0) {
						throw new AccessReviewValidationError(accessConflictViolationMessage(violations));
					}
				}
			}
			if (sourceExisted && targetWasManager) {
				await this.requireActiveOrganisationManager(db, actor, at);
			}
			return sourceExisted;
		}

		throw new Error(`Unexpected access review item type: ${item.access_type}`);
	}

	private async memberActor(
		db: DatabaseExecutor,
		organisationId: string,
		memberId: string,
		correlationId: string
	): Promise<TenantActorContext | null> {
		const member = await db
			.selectFrom('organisation_members')
			.select(['user_id', 'status'])
			.where('organisation_id', '=', organisationId)
			.where('id', '=', memberId)
			.executeTakeFirst();
		if (!member || member.status !== 'active') return null;
		return { organisationId, userId: member.user_id, memberId, correlationId };
	}

	private async memberHasPermission(
		db: DatabaseExecutor,
		organisationId: string,
		memberId: string,
		permissionKey: string,
		correlationId: string,
		at: Date
	): Promise<boolean> {
		const targetActor = await this.memberActor(db, organisationId, memberId, correlationId);
		if (targetActor === null) return false;
		return (await new PermissionService(db).decide(targetActor, permissionKey, { at })).allowed;
	}

	private async requireActiveOrganisationManager(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		at: Date
	): Promise<void> {
		const members = await db
			.selectFrom('organisation_members')
			.select(['id', 'user_id'])
			.where('organisation_id', '=', actor.organisationId)
			.where('status', '=', 'active')
			.execute();
		const service = new PermissionService(db);
		for (const member of members) {
			const decision = await service.decide(
				{
					organisationId: actor.organisationId,
					userId: member.user_id,
					memberId: member.id,
					correlationId: actor.correlationId
				},
				'organisation.manage',
				{ at }
			);
			if (decision.allowed) return;
		}
		throw new AccessReviewValidationError(
			'This revocation would leave the organisation without an active organisation manager.'
		);
	}

	private async requireActiveOwner(
		db: DatabaseExecutor,
		organisationId: string,
		at: Date
	): Promise<void> {
		const row = await db
			.selectFrom('member_roles as assignment')
			.leftJoin('member_role_access_windows as window', (join) =>
				join
					.onRef('window.organisation_id', '=', 'assignment.organisation_id')
					.onRef('window.organisation_member_id', '=', 'assignment.organisation_member_id')
					.onRef('window.organisation_role_id', '=', 'assignment.organisation_role_id')
			)
			.innerJoin('organisation_roles as role', (join) =>
				join
					.onRef('role.id', '=', 'assignment.organisation_role_id')
					.onRef('role.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin('organisation_role_template_bindings as binding', (join) =>
				join
					.onRef('binding.organisation_role_id', '=', 'assignment.organisation_role_id')
					.onRef('binding.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin('organisation_members as member', (join) =>
				join
					.onRef('member.id', '=', 'assignment.organisation_member_id')
					.onRef('member.organisation_id', '=', 'assignment.organisation_id')
			)
			.select('assignment.organisation_member_id')
			.where('assignment.organisation_id', '=', organisationId)
			.where('member.status', '=', 'active')
			.where('role.is_active', '=', 1)
			.where('binding.template_key', '=', STANDARD_ACCESS_ROLE_TEMPLATE_KEY)
			.where('binding.role_key', '=', OWNER_ACCESS_ROLE_KEY)
			.where((eb) =>
				eb.or([eb('window.effective_from', 'is', null), eb('window.effective_from', '<=', at)])
			)
			.where((eb) =>
				eb.or([eb('window.expires_at', 'is', null), eb('window.expires_at', '>', at)])
			)
			.executeTakeFirst();
		if (!row) {
			throw new AccessReviewValidationError(
				'This revocation would leave the organisation without an active Owner.'
			);
		}
	}
}
