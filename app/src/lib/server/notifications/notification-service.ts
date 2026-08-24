import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { ensureWorkKernelStandardRoleDefaults } from '$lib/server/work/work-item-bootstrap';
import {
	NotificationRepository,
	type NotificationEventRecord,
	type NotificationEventTopic
} from './notification-repository';

export type NotificationKind = 'assignment' | 'status' | 'decision';

export type NotificationRecord = {
	eventPublicId: string;
	kind: NotificationKind;
	workItemPublicId: string;
	projectId: string | null;
	title: string;
	message: string;
	priority: string;
	sourceDomain: string;
	href: string;
	occurredAt: Date;
};

function humanize(value: string | null): string {
	if (!value) return 'Updated';
	return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function kindForTopic(topic: NotificationEventTopic): NotificationKind {
	if (topic === 'work.item.assigned') return 'assignment';
	if (topic === 'work.item.decision_recorded') return 'decision';
	return 'status';
}

function messageForEvent(event: NotificationEventRecord): string {
	if (event.topic === 'work.item.assigned') {
		return `${humanize(event.priority)} priority ${humanize(event.workItemKind).toLowerCase()} assigned to you.`;
	}
	if (event.topic === 'work.item.decision_recorded') {
		return `${humanize(event.decision)} decision recorded.`;
	}
	return `${humanize(event.fromStatus)} → ${humanize(event.toStatus)}`;
}

function titleForEvent(event: NotificationEventRecord): string {
	if (event.topic === 'work.item.assigned') return `Assigned: ${event.title}`;
	if (event.topic === 'work.item.decision_recorded') return `Decision: ${event.title}`;
	return `Work updated: ${event.title}`;
}

export class NotificationService {
	constructor(private readonly db: Database = getDatabase()) {}

	async listForMember(actor: TenantActorContext, limit = 12): Promise<NotificationRecord[]> {
		await ensureWorkKernelStandardRoleDefaults(this.db, actor.organisationId);

		const candidates = await new NotificationRepository(this.db).listRelevantWorkEvents(
			actor.organisationId,
			actor.memberId,
			Math.max(limit * 2, limit)
		);
		if (candidates.length === 0) return [];

		const permissionService = new PermissionService(this.db);
		const scopeKeys = Array.from(new Set(candidates.map((candidate) => candidate.projectId ?? 'organisation')));
		const allowedByScope = new Map<string, boolean>();

		await Promise.all(
			scopeKeys.map(async (scopeKey) => {
				const decision = await permissionService.decideWithUmbrella(
					actor,
					'work.view',
					'work.manage',
					scopeKey === 'organisation' ? {} : { projectId: scopeKey }
				);
				allowedByScope.set(scopeKey, decision.allowed);
			})
		);

		return candidates
			.filter((candidate) => allowedByScope.get(candidate.projectId ?? 'organisation') === true)
			.slice(0, Math.max(1, Math.min(Math.trunc(limit), 50)))
			.map((candidate) => ({
				eventPublicId: candidate.eventPublicId,
				kind: kindForTopic(candidate.topic),
				workItemPublicId: candidate.workItemPublicId,
				projectId: candidate.projectId,
				title: titleForEvent(candidate),
				message: messageForEvent(candidate),
				priority: candidate.priority,
				sourceDomain: candidate.sourceDomain,
				href: '/my-work',
				occurredAt: candidate.occurredAt
			}));
	}
}
