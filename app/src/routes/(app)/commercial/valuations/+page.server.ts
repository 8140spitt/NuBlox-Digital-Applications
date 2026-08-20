import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	CommercialValuationService,
	CommercialValuationValidationError
} from '$lib/server/commercial/commercial-valuation-service';
import { ProjectCommercialControlService } from '$lib/server/commercial/project-commercial-control-service';
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

function failure(error: string) {
	return { error };
}

async function runAction(
	locals: App.Locals,
	operation: (service: CommercialValuationService, actor: TenantActorContext) => Promise<unknown>,
	projectPublicId: string
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, failure('Authentication and organisation context are required.'));
	try {
		await operation(new CommercialValuationService(getDatabase()), actor);
	} catch (error) {
		if (error instanceof CommercialValuationValidationError)
			return fail(400, failure(error.message));
		if (error instanceof TenantAccessError) {
			return fail(403, failure('You do not have access to this commercial valuation action.'));
		}
		throw error;
	}
	throw redirect(303, `/commercial/valuations?project=${encodeURIComponent(projectPublicId)}`);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return {
			canView: false,
			canManage: false,
			canAssess: false,
			projects: [],
			purchaseOrders: [],
			costCodes: [],
			selectedProjectPublicId: null,
			valuations: []
		};
	}
	const db = getDatabase();
	const projectPublicId = url.searchParams.get('project');
	const commercial = await new ProjectCommercialControlService(db).getWorkspace(
		actor,
		projectPublicId
	);
	if (!commercial.canView) {
		return {
			canView: false,
			canManage: false,
			canAssess: false,
			projects: commercial.projects,
			purchaseOrders: [],
			costCodes: [],
			selectedProjectPublicId: commercial.selectedProjectPublicId,
			valuations: []
		};
	}
	const valuation = await new CommercialValuationService(db).getWorkspace(
		actor,
		commercial.selectedProjectPublicId
	);
	const selectedProject = commercial.projects.find(
		(project) => project.publicId === commercial.selectedProjectPublicId
	);
	return {
		canView: true,
		canManage: valuation.canManage,
		canAssess: valuation.canAssess,
		projects: commercial.projects,
		purchaseOrders: selectedProject
			? commercial.purchaseOrders.filter((order) => order.projectId === selectedProject.id)
			: [],
		costCodes: selectedProject
			? commercial.costCodes.filter((costCode) => costCode.projectId === selectedProject.id)
			: [],
		selectedProjectPublicId: commercial.selectedProjectPublicId,
		valuations: valuation.valuations
	};
};

export const actions: Actions = {
	createSupplierApplication: async ({ request, locals }) => {
		const data = await request.formData();
		const projectPublicId = text(data, 'projectPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.createSupplierApplication(actor, {
					projectPublicId,
					purchaseOrderPublicId: text(data, 'purchaseOrderPublicId'),
					costCodePublicId: text(data, 'costCodePublicId'),
					valuationDate: text(data, 'valuationDate'),
					description: text(data, 'description'),
					grossValueToDate: text(data, 'grossValueToDate')
				}),
			projectPublicId
		);
	},
	submitValuation: async ({ request, locals }) => {
		const data = await request.formData();
		const projectPublicId = text(data, 'projectPublicId');
		return runAction(
			locals,
			(service, actor) => service.submit(actor, text(data, 'valuationPublicId')),
			projectPublicId
		);
	},
	assessValuation: async ({ request, locals }) => {
		const data = await request.formData();
		const projectPublicId = text(data, 'projectPublicId');
		return runAction(
			locals,
			(service, actor) => service.assess(actor, text(data, 'valuationPublicId')),
			projectPublicId
		);
	}
};
