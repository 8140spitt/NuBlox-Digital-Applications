import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';

export type AuditOutboxEvidenceInput = {
	actor: TenantActorContext;
	actionKey: string;
	subjectType: string;
	subjectPublicId: string;
	metadata: Record<string, unknown>;
	eventType: string;
	eventPayload: Record<string, unknown>;
};

export class AuditOutboxEvidenceWriter {
	constructor(
		private readonly db: DatabaseExecutor,
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	async record(input: AuditOutboxEvidenceInput) {
		await new AuditRepository(this.db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: input.actor.organisationId,
			actorUserId: input.actor.userId,
			actorMemberId: input.actor.memberId,
			actionKey: input.actionKey,
			subjectType: input.subjectType,
			subjectPublicId: input.subjectPublicId,
			correlationId: input.actor.correlationId,
			changeSummary: input.metadata,
			eventMetadata: input.metadata
		});

		await enqueueOutboxEvent(this.db, {
			organisationId: input.actor.organisationId,
			topic: input.eventType,
			aggregateType: input.subjectType,
			aggregatePublicId: input.subjectPublicId,
			correlationId: input.actor.correlationId,
			payload: input.eventPayload
		});
	}
}
