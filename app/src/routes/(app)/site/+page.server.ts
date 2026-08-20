import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	SiteQualitySafetyService,
	SiteQualitySafetyValidationError,
	type LinkEvidenceInput
} from '$lib/server/site/site-quality-safety-service';

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
	data: FormData,
	operation: (service: SiteQualitySafetyService, actor: TenantActorContext) => Promise<unknown>
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, failure('Authentication and organisation context are required.'));
	try {
		await operation(new SiteQualitySafetyService(getDatabase()), actor);
	} catch (error) {
		if (error instanceof SiteQualitySafetyValidationError) return fail(400, failure(error.message));
		if (error instanceof TenantAccessError) {
			return fail(403, failure('You do not have access to this site, quality or safety action.'));
		}
		throw error;
	}
	const project = text(data, 'projectPublicId').trim();
	throw redirect(303, project ? `/site?project=${encodeURIComponent(project)}` : '/site');
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return {
			canViewSite: false,
			canManageSites: false,
			canManageDiaries: false,
			canSubmitDiaries: false,
			canApproveDiaries: false,
			canViewQuality: false,
			canManageTemplates: false,
			canManageInspections: false,
			canManageDefects: false,
			canManageNcrs: false,
			canViewSafety: false,
			canManageSafetyEvents: false,
			canManageSafetyActions: false,
			canLinkEvidence: false,
			projects: [],
			selectedProjectPublicId: null,
			sites: [],
			diaries: [],
			templates: [],
			inspections: [],
			findingTypes: [],
			defects: [],
			ncrs: [],
			safetyEvents: [],
			evidenceVersions: []
		};
	}
	return new SiteQualitySafetyService(getDatabase()).getWorkspace(actor, url.searchParams.get('project'));
};

export const actions: Actions = {
	createSite: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.createSite(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				siteCode: text(data, 'siteCode'),
				name: text(data, 'name'),
				timezone: text(data, 'timezone')
			})
		);
	},
	createDiary: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.createDiary(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				sitePublicId: text(data, 'sitePublicId'),
				diaryDate: text(data, 'diaryDate'),
				shiftLabel: text(data, 'shiftLabel'),
				summary: text(data, 'summary'),
				activityDescription: text(data, 'activityDescription'),
				locationDescription: text(data, 'locationDescription'),
				progressPercent: text(data, 'progressPercent')
			})
		);
	},
	submitDiary: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) => service.submitDiary(actor, text(data, 'diaryPublicId')));
	},
	approveDiary: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) => service.approveDiary(actor, text(data, 'diaryPublicId')));
	},
	createTemplate: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.createInspectionTemplate(actor, {
				code: text(data, 'code'),
				name: text(data, 'name'),
				description: text(data, 'description'),
				checklistPrompts: text(data, 'checklistPrompts')
			})
		);
	},
	createInspection: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.createInspection(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				sitePublicId: text(data, 'sitePublicId'),
				templateVersionPublicId: text(data, 'templateVersionPublicId'),
				title: text(data, 'title'),
				locationDescription: text(data, 'locationDescription')
			})
		);
	},
	recordInspectionResponse: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.recordInspectionResponse(actor, {
				inspectionPublicId: text(data, 'inspectionPublicId'),
				templateItemId: text(data, 'templateItemId'),
				resultCode: text(data, 'resultCode'),
				comments: text(data, 'comments')
			})
		);
	},
	raiseFinding: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.raiseInspectionFinding(actor, {
				inspectionPublicId: text(data, 'inspectionPublicId'),
				templateItemId: text(data, 'templateItemId'),
				findingTypeCode: text(data, 'findingTypeCode'),
				title: text(data, 'title'),
				description: text(data, 'description'),
				severity: text(data, 'severity')
			})
		);
	},
	completeInspection: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) => service.completeInspection(actor, text(data, 'inspectionPublicId')));
	},
	createDefect: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.createDefect(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				sitePublicId: text(data, 'sitePublicId'),
				title: text(data, 'title'),
				description: text(data, 'description'),
				locationDescription: text(data, 'locationDescription'),
				severity: text(data, 'severity'),
				targetDate: text(data, 'targetDate'),
				findingPublicId: text(data, 'findingPublicId')
			})
		);
	},
	closeDefect: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) => service.closeDefect(actor, text(data, 'defectPublicId')));
	},
	createNcr: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.createNcr(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				sitePublicId: text(data, 'sitePublicId'),
				title: text(data, 'title'),
				statement: text(data, 'statement'),
				severity: text(data, 'severity'),
				immediateContainment: text(data, 'immediateContainment'),
				targetDate: text(data, 'targetDate'),
				findingPublicId: text(data, 'findingPublicId')
			})
		);
	},
	closeNcr: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) => service.closeNcr(actor, text(data, 'ncrPublicId')));
	},
	createSafetyObservation: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.createSafetyObservation(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				sitePublicId: text(data, 'sitePublicId'),
				title: text(data, 'title'),
				description: text(data, 'description'),
				locationDescription: text(data, 'locationDescription'),
				occurredAt: text(data, 'occurredAt'),
				observationCategory: text(data, 'observationCategory'),
				isPositiveObservation: data.has('isPositiveObservation'),
				immediateActionTaken: text(data, 'immediateActionTaken')
			})
		);
	},
	createSafetyAction: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.createSafetyAction(actor, {
				safetyEventPublicId: text(data, 'safetyEventPublicId'),
				actionType: text(data, 'actionType'),
				actionText: text(data, 'actionText'),
				targetDate: text(data, 'targetDate')
			})
		);
	},
	completeSafetyAction: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.completeSafetyAction(
				actor,
				text(data, 'safetyEventPublicId'),
				text(data, 'actionId'),
				text(data, 'verificationNote')
			)
		);
	},
	closeSafetyEvent: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) => service.closeSafetyEvent(actor, text(data, 'safetyEventPublicId')));
	},
	linkEvidence: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, data, (service, actor) =>
			service.linkEvidence(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				subjectType: text(data, 'subjectType') as LinkEvidenceInput['subjectType'],
				subjectPublicId: text(data, 'subjectPublicId'),
				informationVersionPublicId: text(data, 'informationVersionPublicId'),
				linkRole: text(data, 'linkRole') as LinkEvidenceInput['linkRole']
			})
		);
	}
};
