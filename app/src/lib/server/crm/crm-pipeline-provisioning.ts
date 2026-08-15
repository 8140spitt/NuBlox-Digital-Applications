import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';

const DEFAULT_STAGES = [
	{ name: 'Lead', sortOrder: 10, probabilityPercent: '10.00' },
	{ name: 'Qualified', sortOrder: 20, probabilityPercent: '30.00' },
	{ name: 'Proposal', sortOrder: 30, probabilityPercent: '60.00' },
	{ name: 'Negotiation', sortOrder: 40, probabilityPercent: '80.00' }
] as const;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

export class CrmPipelineProvisioningService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	async ensureDefaultPipeline(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(this.db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		const permission = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			'crm.opportunity.manage',
			'crm.manage'
		);
		if (!permission.allowed) throw new TenantAccessError('CRM opportunity management is not permitted.');

		await this.db.transaction().execute(async (trx) => {
			const lockedOrganisation = await trx
				.selectFrom('organisations')
				.select('id')
				.where('id', '=', actor.organisationId)
				.where('status', 'in', ['active', 'pending'])
				.forUpdate()
				.executeTakeFirst();
			if (!lockedOrganisation) throw new TenantAccessError();

			const existing = await trx
				.selectFrom('crm_pipelines')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.limit(1)
				.executeTakeFirst();
			if (existing) return;

			const pipelinePublicId = this.publicIdFactory();
			const pipelineId = insertedId(
				await trx
					.insertInto('crm_pipelines')
					.values({
						organisation_id: actor.organisationId,
						public_id: pipelinePublicId,
						name: 'Sales',
						is_default: 1,
						is_active: 1
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('crm_pipeline_stages')
				.values(
					DEFAULT_STAGES.map((stage) => ({
						organisation_id: actor.organisationId,
						crm_pipeline_id: pipelineId,
						name: stage.name,
						sort_order: stage.sortOrder,
						probability_percent: stage.probabilityPercent,
						is_active: 1
					}))
				)
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.pipeline.initialized',
				subjectType: 'crm_pipeline',
				subjectPublicId: pipelinePublicId,
				correlationId: actor.correlationId,
				changeSummary: { name: 'Sales', stages: DEFAULT_STAGES.map((stage) => stage.name) }
			});
		});
	}
}
