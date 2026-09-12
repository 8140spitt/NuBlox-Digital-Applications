import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { ExternalAccessDeniedError } from '$lib/server/external-access/external-access-service';
import {
	ExternalProjectActionService,
	ExternalProjectActionValidationError
} from '$lib/server/projects/project-external-action-service';

function field(data: FormData, name: string): string {
	const value = data.get(name);
	return typeof value === 'string' ? value : '';
}

function actionFailure(message: string) {
	return fail(400, { message });
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.actor) {
		throw redirect(
			303,
			`/signin?returnTo=${encodeURIComponent(`/portal/project-actions/${params.workItemPublicId}`)}`
		);
	}
	try {
		return {
			task: await new ExternalProjectActionService().getTask(locals.actor, params.workItemPublicId)
		};
	} catch (cause) {
		if (cause instanceof ExternalAccessDeniedError) throw error(404, 'Shared work not found.');
		throw cause;
	}
};

export const actions: Actions = {
	respondRfi: async ({ request, locals, params }) => {
		if (!locals.actor) return fail(401, { message: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ExternalProjectActionService().respondRfi(locals.actor, {
				workItemPublicId: params.workItemPublicId,
				responseText: field(data, 'responseText'),
				final: data.get('final') === 'on'
			});
		} catch (cause) {
			if (cause instanceof ExternalAccessDeniedError) return fail(403, { message: cause.message });
			if (cause instanceof ExternalProjectActionValidationError) return actionFailure(cause.message);
			throw cause;
		}
		throw redirect(303, `/portal/project-actions/${encodeURIComponent(params.workItemPublicId)}`);
	},

	reviewSubmittal: async ({ request, locals, params }) => {
		if (!locals.actor) return fail(401, { message: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ExternalProjectActionService().reviewSubmittal(locals.actor, {
				workItemPublicId: params.workItemPublicId,
				outcome: field(data, 'outcome'),
				comments: field(data, 'comments')
			});
		} catch (cause) {
			if (cause instanceof ExternalAccessDeniedError) return fail(403, { message: cause.message });
			if (cause instanceof ExternalProjectActionValidationError) return actionFailure(cause.message);
			throw cause;
		}
		throw redirect(303, `/portal/project-actions/${encodeURIComponent(params.workItemPublicId)}`);
	},

	acknowledgeInstruction: async ({ locals, params }) => {
		if (!locals.actor) return fail(401, { message: 'Authentication is required.' });
		try {
			await new ExternalProjectActionService().acknowledgeInstruction(
				locals.actor,
				params.workItemPublicId
			);
		} catch (cause) {
			if (cause instanceof ExternalAccessDeniedError) return fail(403, { message: cause.message });
			if (cause instanceof ExternalProjectActionValidationError) return actionFailure(cause.message);
			throw cause;
		}
		throw redirect(303, `/portal/project-actions/${encodeURIComponent(params.workItemPublicId)}`);
	}
};
