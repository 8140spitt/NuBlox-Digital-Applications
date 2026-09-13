import { randomUUID } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';

export type EvidenceActor = {
	organisationId: string;
	userId: string;
	memberId: string;
};

export async function appendDomainEvidence(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		actionKey: string;
		subjectType: string;
		subjectPublicId: string;
		changeSummary: Record<string, unknown>;
		eventMetadata?: Record<string, unknown>;
		correlationId?: string;
	}
): Promise<void> {
	const correlationId = input.correlationId ?? randomUUID();
	const eventMetadata = input.eventMetadata ?? {};

	await connection.execute(
		`INSERT INTO audit_events
			(event_public_id, acting_organisation_id, actor_user_id, actor_member_id,
			 external_auth_user_id, project_id, action_key, subject_type, subject_public_id,
			 correlation_id, change_summary, event_metadata)
		 VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
		[
			randomUUID(),
			input.actor.organisationId,
			input.actor.userId,
			input.actor.memberId,
			input.actionKey,
			input.subjectType,
			input.subjectPublicId,
			correlationId,
			JSON.stringify(input.changeSummary),
			JSON.stringify(eventMetadata)
		]
	);

	await connection.execute(
		`INSERT INTO outbox_events
			(event_public_id, organisation_id, topic, aggregate_type, aggregate_public_id,
			 payload, correlation_id, deduplication_key, available_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP(6))`,
		[
			randomUUID(),
			input.actor.organisationId,
			input.actionKey,
			input.subjectType,
			input.subjectPublicId,
			JSON.stringify({ ...input.changeSummary, ...eventMetadata }),
			correlationId
		]
	);
}
