import type { DatabaseExecutor } from '$lib/server/db/executor';

export type AppendAuditEvent = {
	eventPublicId: string;
	actingOrganisationId: string;
	actorUserId: string;
	actorMemberId?: string | null;
	externalAuthUserId?: string | null;
	projectId?: string | null;
	actionKey: string;
	subjectType: string;
	subjectPublicId?: string | null;
	correlationId: string;
	changeSummary?: unknown;
	eventMetadata?: unknown;
};

export class AuditRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async append(event: AppendAuditEvent): Promise<void> {
		const actorMemberId = event.actorMemberId ?? null;
		const externalAuthUserId = event.externalAuthUserId ?? null;
		if ((actorMemberId === null) === (externalAuthUserId === null)) {
			throw new Error(
				'Audit evidence requires exactly one internal-member or external-auth actor.'
			);
		}
		await this.db
			.insertInto('audit_events')
			.values({
				event_public_id: event.eventPublicId,
				acting_organisation_id: event.actingOrganisationId,
				actor_user_id: event.actorUserId,
				actor_member_id: actorMemberId,
				external_auth_user_id: externalAuthUserId,
				project_id: event.projectId ?? null,
				action_key: event.actionKey,
				subject_type: event.subjectType,
				subject_public_id: event.subjectPublicId ?? null,
				correlation_id: event.correlationId,
				change_summary:
					event.changeSummary === undefined ? null : JSON.stringify(event.changeSummary),
				event_metadata:
					event.eventMetadata === undefined ? null : JSON.stringify(event.eventMetadata)
			})
			.executeTakeFirstOrThrow();
	}
}
