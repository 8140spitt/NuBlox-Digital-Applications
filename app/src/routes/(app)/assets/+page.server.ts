import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import {
	AssetsMaintenanceService,
	AssetsMaintenanceValidationError
} from '$lib/server/assets/assets-maintenance-service';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';

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

async function runAction(
	locals: App.Locals,
	operation: (service: AssetsMaintenanceService, actor: TenantActorContext) => Promise<unknown>
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
	try {
		await operation(new AssetsMaintenanceService(getDatabase()), actor);
	} catch (error) {
		if (error instanceof AssetsMaintenanceValidationError) return fail(400, { error: error.message });
		if (error instanceof TenantAccessError) return fail(403, { error: 'You do not have access to this assets or maintenance action.' });
		throw error;
	}
	throw redirect(303, '/assets');
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) return new AssetsMaintenanceService(getDatabase()).getWorkspace({ organisationId: '', userId: '', memberId: '', correlationId: locals.correlationId });
	return new AssetsMaintenanceService(getDatabase()).getWorkspace(actor);
};

export const actions: Actions = {
	createFacility: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) => service.createFacility(actor, {
			facilityCode: text(data, 'facilityCode'), name: text(data, 'name'), description: text(data, 'description'), timezone: text(data, 'timezone'), commissionedOn: text(data, 'commissionedOn'), openedOn: text(data, 'openedOn')
		}));
	},
	createBuilding: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.createBuilding(actor, { facilityPublicId: text(data, 'facilityPublicId'), buildingCode: text(data, 'buildingCode'), name: text(data, 'name') }));
	},
	createLevel: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.createLevel(actor, { buildingPublicId: text(data, 'buildingPublicId'), levelCode: text(data, 'levelCode'), name: text(data, 'name'), sortOrder: text(data, 'sortOrder') }));
	},
	createSpace: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.createSpace(actor, { buildingPublicId: text(data, 'buildingPublicId'), levelPublicId: text(data, 'levelPublicId'), spaceCode: text(data, 'spaceCode'), name: text(data, 'name'), spaceType: text(data, 'spaceType') }));
	},
	createAssetType: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.createAssetType(actor, { categoryCode: text(data, 'categoryCode'), code: text(data, 'code'), name: text(data, 'name'), description: text(data, 'description') }));
	},
	createAsset: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.createAsset(actor, { facilityPublicId: text(data, 'facilityPublicId'), assetTypePublicId: text(data, 'assetTypePublicId'), buildingPublicId: text(data, 'buildingPublicId'), levelPublicId: text(data, 'levelPublicId'), spacePublicId: text(data, 'spacePublicId'), parentAssetPublicId: text(data, 'parentAssetPublicId'), assetTag: text(data, 'assetTag'), serialNumber: text(data, 'serialNumber'), name: text(data, 'name'), description: text(data, 'description'), criticality: text(data, 'criticality') }));
	},
	transitionAsset: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.transitionAsset(actor, text(data, 'assetPublicId'), text(data, 'toStatus'), text(data, 'notes')));
	},
	createMaintenanceRequest: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.createMaintenanceRequest(actor, { facilityPublicId: text(data, 'facilityPublicId'), assetPublicId: text(data, 'assetPublicId'), priorityCode: text(data, 'priorityCode'), requestType: text(data, 'requestType'), title: text(data, 'title'), description: text(data, 'description') }));
	},
	resolveMaintenanceRequest: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.resolveMaintenanceRequest(actor, text(data, 'requestPublicId'), text(data, 'resolutionNote')));
	},
	createMaintenancePlan: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.createMaintenancePlan(actor, { facilityPublicId: text(data, 'facilityPublicId'), assetPublicId: text(data, 'assetPublicId'), planTypeCode: text(data, 'planTypeCode'), name: text(data, 'name'), description: text(data, 'description'), taskTitle: text(data, 'taskTitle'), instructions: text(data, 'instructions'), intervalValue: text(data, 'intervalValue'), intervalUnit: text(data, 'intervalUnit'), startsOn: text(data, 'startsOn') }));
	},
	generatePlannedWorkOrder: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.generatePlannedWorkOrder(actor, text(data, 'planTaskId'), text(data, 'assetPublicId')));
	},
	createReactiveWorkOrder: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.createReactiveWorkOrder(actor, text(data, 'requestPublicId'), text(data, 'assetPublicId')));
	},
	assignContractor: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.assignContractor(actor, text(data, 'workOrderPublicId'), text(data, 'contractorPartyPublicId')));
	},
	completeWorkOrder: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.completeWorkOrder(actor, text(data, 'workOrderPublicId'), text(data, 'completionSummary')));
	},
	recordServiceEvent: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.recordServiceEvent(actor, { assetPublicId: text(data, 'assetPublicId'), workOrderPublicId: text(data, 'workOrderPublicId'), serviceTypeCode: text(data, 'serviceTypeCode'), performedAt: text(data, 'performedAt'), resultCode: text(data, 'resultCode'), conditionRating: text(data, 'conditionRating'), notes: text(data, 'notes'), recommendedNextServiceOn: text(data, 'recommendedNextServiceOn') }));
	},
	createComplianceRequirement: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.createComplianceRequirement(actor, { categoryCode: text(data, 'categoryCode'), requirementCode: text(data, 'requirementCode'), name: text(data, 'name'), requirementText: text(data, 'requirementText'), intervalValue: text(data, 'intervalValue'), intervalUnit: text(data, 'intervalUnit') }));
	},
	assignComplianceToAsset: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.assignComplianceToAsset(actor, text(data, 'assetPublicId'), text(data, 'requirementPublicId'), text(data, 'assignedFrom')));
	},
	recordComplianceEvent: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.recordComplianceEvent(actor, { assignmentId: text(data, 'assignmentId'), performedAt: text(data, 'performedAt'), outcome: text(data, 'outcome'), findingsSummary: text(data, 'findingsSummary'), recommendedNextDueOn: text(data, 'recommendedNextDueOn') }));
	},
	linkEvidence: async ({ request, locals }) => {
		const data = await request.formData(); return runAction(locals, (service, actor) => service.linkEvidence(actor, { subjectType: text(data, 'subjectType') as 'asset'|'workOrder'|'service'|'compliance', subjectPublicId: text(data, 'subjectPublicId'), informationVersionPublicId: text(data, 'informationVersionPublicId'), linkRole: text(data, 'linkRole') }));
	}
};
