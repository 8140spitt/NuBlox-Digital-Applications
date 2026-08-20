import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	CommercialValuationService,
	CommercialValuationValidationError
} from '$lib/server/commercial/commercial-valuation-service';
import {
	ProjectCommercialControlService,
	ProjectCommercialControlValidationError
} from '$lib/server/commercial/project-commercial-control-service';
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

function redirectToProject(projectPublicId?: string) {
	const suffix = projectPublicId ? `?project=${encodeURIComponent(projectPublicId)}` : '';
	throw redirect(303, `/commercial/cost-control${suffix}`);
}

async function runAction(
	locals: App.Locals,
	operation: (service: ProjectCommercialControlService, actor: TenantActorContext) => Promise<unknown>,
	returnProjectPublicId?: string
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, failure('Authentication and organisation context are required.'));
	try {
		await operation(new ProjectCommercialControlService(getDatabase()), actor);
	} catch (error) {
		if (error instanceof ProjectCommercialControlValidationError) return fail(400, failure(error.message));
		if (error instanceof TenantAccessError) {
			return fail(403, failure('You do not have access to this project commercial-control action.'));
		}
		throw error;
	}
	redirectToProject(returnProjectPublicId);
}

async function runValuationAction(
	locals: App.Locals,
	operation: (service: CommercialValuationService, actor: TenantActorContext) => Promise<unknown>,
	returnProjectPublicId?: string
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, failure('Authentication and organisation context are required.'));
	try {
		await operation(new CommercialValuationService(getDatabase()), actor);
	} catch (error) {
		if (error instanceof CommercialValuationValidationError) return fail(400, failure(error.message));
		if (error instanceof TenantAccessError) {
			return fail(403, failure('You do not have access to this project valuation action.'));
		}
		throw error;
	}
	redirectToProject(returnProjectPublicId);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return {
			canView: false,
			canManageCostCodes: false,
			canManageBudgets: false,
			canApproveBudgets: false,
			canManageVariations: false,
			canIssueVariations: false,
			canDecideVariations: false,
			canManageValuations: false,
			canAssessValuations: false,
			projects: [],
			costCategories: [],
			variationTypes: [],
			costCodes: [],
			budgets: [],
			purchaseOrders: [],
			variations: [],
			valuations: [],
			selectedProjectPublicId: null,
			position: null
		};
	}
	const db = getDatabase();
	const projectPublicId = url.searchParams.get('project');
	const workspace = await new ProjectCommercialControlService(db).getWorkspace(actor, projectPublicId);
	if (!workspace.canView) {
		return {
			...workspace,
			canManageValuations: false,
			canAssessValuations: false,
			valuations: []
		};
	}
	const valuationWorkspace = await new CommercialValuationService(db).getWorkspace(
		actor,
		workspace.selectedProjectPublicId
	);
	return {
		...workspace,
		canManageValuations: valuationWorkspace.canManage,
		canAssessValuations: valuationWorkspace.canAssess,
		valuations: valuationWorkspace.valuations
	};
};

export const actions: Actions = {
	createCostCode: async ({ request, locals }) => {
		const data = await request.formData();
		const projectPublicId = text(data, 'projectPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.createCostCode(actor, {
					projectPublicId,
					categoryCode: text(data, 'categoryCode'),
					code: text(data, 'code'),
					name: text(data, 'name'),
					description: text(data, 'description')
				}),
			projectPublicId
		);
	},
	createBudget: async ({ request, locals }) => {
		const data = await request.formData();
		const projectPublicId = text(data, 'projectPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.createBudget(actor, {
					projectPublicId,
					costCodePublicId: text(data, 'costCodePublicId'),
					name: text(data, 'name'),
					currencyCode: text(data, 'currencyCode'),
					effectiveOn: text(data, 'effectiveOn'),
					description: text(data, 'description'),
					budgetAmount: text(data, 'budgetAmount')
				}),
			projectPublicId
		);
	},
	approveBudget: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) => service.approveBudget(actor, text(data, 'budgetPublicId')),
			text(data, 'projectPublicId')
		);
	},
	allocatePurchaseOrderLine: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.allocatePurchaseOrderLine(
					actor,
					text(data, 'purchaseOrderPublicId'),
					Number(text(data, 'lineNumber')),
					text(data, 'costCodePublicId')
				),
			text(data, 'projectPublicId')
		);
	},
	createVariation: async ({ request, locals }) => {
		const data = await request.formData();
		const projectPublicId = text(data, 'projectPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.createVariation(actor, {
					projectPublicId,
					costCodePublicId: text(data, 'costCodePublicId'),
					purchaseOrderPublicId: text(data, 'purchaseOrderPublicId'),
					variationTypeCode: text(data, 'variationTypeCode'),
					commercialSide: text(data, 'commercialSide'),
					title: text(data, 'title'),
					currencyCode: text(data, 'currencyCode'),
					description: text(data, 'description'),
					quantity: text(data, 'quantity'),
					unitRate: text(data, 'unitRate')
				}),
			projectPublicId
		);
	},
	issueVariation: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) => service.issueVariation(actor, text(data, 'variationPublicId')),
			text(data, 'projectPublicId')
		);
	},
	decideVariation: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.decideVariation(
					actor,
					text(data, 'variationPublicId'),
					text(data, 'decision'),
					text(data, 'decisionAmount'),
					text(data, 'comments')
				),
			text(data, 'projectPublicId')
		);
	},
	createSupplierApplication: async ({ request, locals }) => {
		const data = await request.formData();
		const projectPublicId = text(data, 'projectPublicId');
		return runValuationAction(
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
		return runValuationAction(
			locals,
			(service, actor) => service.submit(actor, text(data, 'valuationPublicId')),
			text(data, 'projectPublicId')
		);
	},
	assessValuation: async ({ request, locals }) => {
		const data = await request.formData();
		return runValuationAction(
			locals,
			(service, actor) => service.assess(actor, text(data, 'valuationPublicId')),
			text(data, 'projectPublicId')
		);
	}
};
