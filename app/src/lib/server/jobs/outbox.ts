import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';

export type OutboxEvent = {
	organisationId?: string | null;
	topic: string;
	aggregateType?: string | null;
	aggregatePublicId?: string | null;
	payload: Record<string, unknown>;
	correlationId: string;
	deduplicationKey?: string | null;
	availableAt?: Date;
};

/**
 * Persist an event into the same database transaction as the business change.
 *
 * Callers should pass their active Transaction when atomicity with a domain
 * mutation is required. Delivery is deliberately separate from persistence.
 */
export async function enqueueOutboxEvent(
	db: DatabaseExecutor,
	event: OutboxEvent
): Promise<string> {
	const eventPublicId = randomUUID();
	const aggregateType = event.aggregateType ?? null;
	const aggregatePublicId = event.aggregatePublicId ?? null;
	if ((aggregateType === null) !== (aggregatePublicId === null)) {
		throw new Error('Outbox aggregateType and aggregatePublicId must be supplied together.');
	}

	await sql`
		INSERT INTO outbox_events (
			event_public_id,
			organisation_id,
			topic,
			aggregate_type,
			aggregate_public_id,
			payload,
			correlation_id,
			deduplication_key,
			available_at
		)
		VALUES (
			${eventPublicId},
			${event.organisationId ?? null},
			${event.topic.trim()},
			${aggregateType},
			${aggregatePublicId},
			${JSON.stringify(event.payload)},
			${event.correlationId},
			${event.deduplicationKey ?? null},
			${event.availableAt ?? new Date()}
		)
	`.execute(db);

	return eventPublicId;
}
