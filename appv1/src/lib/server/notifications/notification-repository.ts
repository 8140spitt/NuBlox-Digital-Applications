import { sql } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';

export type NotificationEventTopic =
	'work.item.assigned' | 'work.item.status_changed' | 'work.item.decision_recorded';

export type NotificationEventRecord = {
	eventPublicId: string;
	topic: NotificationEventTopic;
	workItemPublicId: string;
	projectId: string | null;
	workItemKind: string;
	sourceDomain: string;
	title: string;
	priority: string;
	fromStatus: string | null;
	toStatus: string | null;
	decision: string | null;
	occurredAt: Date;
};

type NotificationEventRow = {
	event_public_id: string;
	topic: NotificationEventTopic;
	work_item_public_id: string;
	project_id: string | null;
	work_item_kind: string;
	source_domain: string;
	title: string;
	priority: string;
	from_status: string | null;
	to_status: string | null;
	decision: string | null;
	occurred_at: Date;
};

function mapRow(row: NotificationEventRow): NotificationEventRecord {
	return {
		eventPublicId: row.event_public_id,
		topic: row.topic,
		workItemPublicId: row.work_item_public_id,
		projectId: row.project_id,
		workItemKind: row.work_item_kind,
		sourceDomain: row.source_domain,
		title: row.title,
		priority: row.priority,
		fromStatus: row.from_status,
		toStatus: row.to_status,
		decision: row.decision,
		occurredAt: row.occurred_at
	};
}

export class NotificationRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listRelevantWorkEvents(
		organisationId: string,
		memberId: string,
		limit = 20
	): Promise<NotificationEventRecord[]> {
		const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
		const result = await sql<NotificationEventRow>`
			SELECT
				oe.event_public_id,
				oe.topic,
				wi.public_id AS work_item_public_id,
				wi.project_id,
				wi.work_item_kind,
				wi.source_domain,
				wi.title,
				wi.priority,
				JSON_UNQUOTE(JSON_EXTRACT(oe.payload, '$.fromStatus')) AS from_status,
				JSON_UNQUOTE(JSON_EXTRACT(oe.payload, '$.toStatus')) AS to_status,
				JSON_UNQUOTE(JSON_EXTRACT(oe.payload, '$.decision')) AS decision,
				oe.created_at AS occurred_at
			FROM outbox_events AS oe
			INNER JOIN work_items AS wi
				ON wi.owning_organisation_id = oe.organisation_id
				AND wi.public_id = oe.aggregate_public_id
			WHERE oe.organisation_id = ${organisationId}
			  AND oe.aggregate_type = 'work_item'
			  AND oe.topic IN (
				'work.item.assigned',
				'work.item.status_changed',
				'work.item.decision_recorded'
			  )
			  AND (
				(
					oe.topic = 'work.item.assigned'
					AND JSON_UNQUOTE(JSON_EXTRACT(oe.payload, '$.assignedMemberId')) = ${memberId}
				)
				OR (
					oe.topic IN ('work.item.status_changed', 'work.item.decision_recorded')
					AND (
						wi.created_by_member_id = ${memberId}
						OR EXISTS (
							SELECT 1
							FROM work_item_assignments AS assignment
							WHERE assignment.work_item_id = wi.id
							  AND assignment.work_item_owner_organisation_id = wi.owning_organisation_id
							  AND assignment.assigned_organisation_id = ${organisationId}
							  AND assignment.assignment_scope = 'member'
							  AND assignment.assigned_member_id = ${memberId}
							  AND assignment.ended_at IS NULL
						)
					)
				)
			  )
			ORDER BY oe.created_at DESC, oe.id DESC
			LIMIT ${safeLimit}
		`.execute(this.db);

		return result.rows.map(mapRow);
	}
}
