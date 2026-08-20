import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { ProcurementService, ProcurementValidationError } from '$lib/server/procurement/procurement-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function text(data: FormData, name: string): string {
	return String(data.get(name) ?? '');
}

function optionalNumber(data: FormData, name: string): number | null {
	const value = text(data, name).trim();
	return value ? Number(value) : null;
}

function requiredNumber(data: FormData, name: string): number {
	return Number(text(data, name));
}

function failure(error: string) {
	return { error };
}

async function runAction(
	locals: App.Locals,
	operation: (service: ProcurementService, actor: TenantActorContext) => Promise<unknown>
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, failure('Authentication and organisation context are required.'));
	try {
		await operation(new ProcurementService(getDatabase()), actor);
	} catch (error) {
		if (error instanceof ProcurementValidationError) return fail(400, failure(error.message));
		if (error instanceof TenantAccessError) {
			return fail(403, failure('You do not have access to this procurement action.'));
		}
		throw error;
	}
	throw redirect(303, '/purchasing');
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return {
			canView: false,
			canManagePackages: false,
			canManageRfqs: false,
			canIssueRfqs: false,
			canManagePurchaseOrders: false,
			canApprovePurchaseOrders: false,
			canIssuePurchaseOrders: false,
			canManageReceipts: false,
			projects: [],
			suppliers: [],
			packageTypes: [],
			purchaseOrderTypes: [],
			salesItemTypes: [],
			units: [],
			packages: [],
			orders: []
		};
	}
	return new ProcurementService(getDatabase()).getWorkspace(actor);
};

export const actions: Actions = {
	createPackage: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createPackage(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				packageTypeCode: text(data, 'packageTypeCode'),
				title: text(data, 'title'),
				description: text(data, 'description'),
				currencyCode: text(data, 'currencyCode'),
				requiredByDate: text(data, 'requiredByDate'),
				salesItemTypeId: requiredNumber(data, 'salesItemTypeId'),
				unitOfMeasureId: optionalNumber(data, 'unitOfMeasureId'),
				lineDescription: text(data, 'lineDescription'),
				quantity: text(data, 'quantity'),
				targetUnitCost: text(data, 'targetUnitCost')
			})
		);
	},
	createRfq: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createRfq(actor, {
				packagePublicId: text(data, 'packagePublicId'),
				title: text(data, 'title'),
				responseDeadlineAt: text(data, 'responseDeadlineAt')
			})
		);
	},
	issueRfq: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.issueRfq(actor, text(data, 'rfqPublicId'), text(data, 'supplierPublicId'))
		);
	},
	createPurchaseOrder: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createPurchaseOrder(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				packagePublicId: text(data, 'packagePublicId'),
				supplierPublicId: text(data, 'supplierPublicId'),
				purchaseOrderTypeCode: text(data, 'purchaseOrderTypeCode'),
				title: text(data, 'title'),
				supplierReference: text(data, 'supplierReference'),
				currencyCode: text(data, 'currencyCode'),
				orderDate: text(data, 'orderDate'),
				requiredByDate: text(data, 'requiredByDate'),
				salesItemTypeId: requiredNumber(data, 'salesItemTypeId'),
				unitOfMeasureId: optionalNumber(data, 'unitOfMeasureId'),
				lineDescription: text(data, 'lineDescription'),
				quantity: text(data, 'quantity'),
				unitRate: text(data, 'unitRate')
			})
		);
	},
	approvePurchaseOrder: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.approvePurchaseOrder(actor, text(data, 'purchaseOrderPublicId'))
		);
	},
	issuePurchaseOrder: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.issuePurchaseOrder(actor, text(data, 'purchaseOrderPublicId'))
		);
	},
	recordReceipt: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.recordReceipt(actor, {
				purchaseOrderPublicId: text(data, 'purchaseOrderPublicId'),
				lineNumber: requiredNumber(data, 'lineNumber'),
				receiptType: text(data, 'receiptType'),
				quantityReceived: text(data, 'quantityReceived'),
				quantityRejected: text(data, 'quantityRejected'),
				supplierDeliveryReference: text(data, 'supplierDeliveryReference'),
				notes: text(data, 'notes')
			})
		);
	}
};
