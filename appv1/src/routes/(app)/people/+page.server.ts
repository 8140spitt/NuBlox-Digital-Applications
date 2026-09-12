import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	WorkforceService,
	WorkforceValidationError
} from '$lib/server/workforce/workforce-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function failure(error: string) {
	return { error };
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return {
			canView: false,
			canManage: false,
			canManageCompetencies: false,
			canManageCredentials: false,
			canViewCostRates: false,
			canManageAssignments: false,
			workers: [],
			memberCandidates: [],
			teams: [],
			engagementTypes: [],
			competencyTypes: [],
			projectAssignments: [],
			projects: []
		};
	}
	return new WorkforceService(getDatabase()).getPeopleWorkspace(actor);
};

export const actions: Actions = {
	createWorker: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, failure('Authentication and organisation context are required.'));
		const data = await request.formData();
		try {
			await new WorkforceService(getDatabase()).createWorkerFromMember(actor, {
				memberPublicId: String(data.get('memberPublicId') ?? ''),
				workerNumber: String(data.get('workerNumber') ?? ''),
				engagementTypeCode: String(data.get('engagementTypeCode') ?? ''),
				jobTitle: String(data.get('jobTitle') ?? ''),
				teamPublicId: String(data.get('teamPublicId') ?? ''),
				startedOn: String(data.get('startedOn') ?? '')
			});
		} catch (error) {
			if (error instanceof WorkforceValidationError) return fail(400, failure(error.message));
			if (error instanceof RecordNotFoundError) return fail(404, failure(error.message));
			if (error instanceof TenantAccessError)
				return fail(403, failure('You do not have permission to manage workforce records.'));
			throw error;
		}
		throw redirect(303, '/people');
	},

	createCompetency: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, failure('Authentication and organisation context are required.'));
		const data = await request.formData();
		try {
			await new WorkforceService(getDatabase()).createCompetencyType(actor, {
				code: String(data.get('code') ?? ''),
				name: String(data.get('name') ?? ''),
				description: String(data.get('description') ?? ''),
				requiresExpiry: data.get('requiresExpiry') === 'on'
			});
		} catch (error) {
			if (error instanceof WorkforceValidationError) return fail(400, failure(error.message));
			if (error instanceof TenantAccessError)
				return fail(403, failure('You do not have permission to manage workforce competencies.'));
			throw error;
		}
		throw redirect(303, '/people');
	},

	assignCompetency: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, failure('Authentication and organisation context are required.'));
		const data = await request.formData();
		try {
			await new WorkforceService(getDatabase()).assignCompetency(actor, {
				workerPublicId: String(data.get('workerPublicId') ?? ''),
				competencyTypePublicId: String(data.get('competencyTypePublicId') ?? ''),
				proficiencyLevel: String(data.get('proficiencyLevel') ?? ''),
				validFrom: String(data.get('validFrom') ?? ''),
				validTo: String(data.get('validTo') ?? '')
			});
		} catch (error) {
			if (error instanceof WorkforceValidationError) return fail(400, failure(error.message));
			if (error instanceof RecordNotFoundError) return fail(404, failure(error.message));
			if (error instanceof TenantAccessError)
				return fail(403, failure('You do not have permission to manage workforce competencies.'));
			throw error;
		}
		throw redirect(303, '/people');
	},

	assignProject: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, failure('Authentication and organisation context are required.'));
		const data = await request.formData();
		try {
			await new WorkforceService(getDatabase()).assignWorkerToProject(actor, {
				workerPublicId: String(data.get('workerPublicId') ?? ''),
				projectPublicId: String(data.get('projectPublicId') ?? ''),
				startsOn: String(data.get('startsOn') ?? ''),
				endsOn: String(data.get('endsOn') ?? ''),
				plannedAllocationPercent: String(data.get('plannedAllocationPercent') ?? '')
			});
		} catch (error) {
			if (error instanceof WorkforceValidationError) return fail(400, failure(error.message));
			if (error instanceof RecordNotFoundError) return fail(404, failure(error.message));
			if (error instanceof TenantAccessError)
				return fail(403, failure('You do not have permission to staff projects.'));
			throw error;
		}
		throw redirect(303, '/people');
	}
};
