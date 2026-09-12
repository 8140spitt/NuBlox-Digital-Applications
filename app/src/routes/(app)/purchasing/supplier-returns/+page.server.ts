import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import { ProjectRepository } from '$lib/server/projects/project-repository';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw redirect(303, '/signin?returnTo=%2Fpurchasing%2Fsupplier-returns');
	const db = getDatabase();
	const permission = await new PermissionService(db).decide(actor, 'procurement.view');
	if (!permission.allowed) return { canView: false, returns: [] };
	const projects = await new ProjectRepository(db).listForMember(
		actor.organisationId,
		actor.memberId
	);
	const projectIds = projects.map((project) => project.id);
	if (!projectIds.length) return { canView: true, returns: [] };

	const rows = await db
		.selectFrom('supplier_returns as supplierReturn')
		.innerJoin('rfq_invitations as invitation', 'invitation.id', 'supplierReturn.rfq_invitation_id')
		.innerJoin('rfq_versions as version', 'version.id', 'supplierReturn.rfq_version_id')
		.innerJoin('rfqs as rfq', 'rfq.id', 'version.rfq_id')
		.innerJoin('procurement_packages as package', 'package.id', 'rfq.procurement_package_id')
		.innerJoin('projects as project', 'project.id', 'package.project_id')
		.innerJoin(
			'party_organisations as supplier',
			'supplier.party_id',
			'invitation.supplier_party_id'
		)
		.select([
			'supplierReturn.id as returnId',
			'supplierReturn.public_id as publicId',
			'supplierReturn.return_status as status',
			'supplierReturn.submission_number as submissionNumber',
			'supplierReturn.currency_code as currencyCode',
			'supplierReturn.supplier_reference as supplierReference',
			'supplierReturn.valid_until as validUntil',
			'supplierReturn.submitted_at as submittedAt',
			'rfq.rfq_number as rfqNumber',
			'rfq.public_id as rfqPublicId',
			'version.title as rfqTitle',
			'project.project_number as projectNumber',
			'project.name as projectName',
			'supplier.legal_name as supplierLegalName',
			'supplier.trading_name as supplierTradingName'
		])
		.where('supplierReturn.organisation_id', '=', actor.organisationId)
		.where('package.project_id', 'in', projectIds)
		.orderBy('supplierReturn.submitted_at', 'desc')
		.execute();

	const returns = [];
	for (const row of rows) {
		const items = await db
			.selectFrom('supplier_return_items as responseItem')
			.innerJoin('rfq_items as item', 'item.id', 'responseItem.rfq_item_id')
			.select([
				'responseItem.line_number as lineNumber',
				'item.description as description',
				'item.quantity as requestedQuantity',
				'responseItem.offered_quantity as offeredQuantity',
				'responseItem.unit_rate as unitRate',
				'responseItem.lead_time_days as leadTimeDays',
				'responseItem.qualification_note as qualificationNote'
			])
			.where('responseItem.supplier_return_id', '=', row.returnId)
			.orderBy('responseItem.line_number', 'asc')
			.execute();
		returns.push({
			...row,
			supplierName: row.supplierTradingName?.trim() || row.supplierLegalName,
			items: items.map((item) => ({
				...item,
				requestedQuantity: String(item.requestedQuantity),
				offeredQuantity: String(item.offeredQuantity),
				unitRate: String(item.unitRate)
			}))
		});
	}
	return { canView: true, returns };
};
