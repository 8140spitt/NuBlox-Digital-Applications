import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { parseCanonicalRoute, portalLoginPath } from '$lib/routing/route-contract';
import { getDatabase } from '$lib/server/db/database';
import { ExternalAccessDeniedError } from '$lib/server/external-access/external-access-service';
import {
	ExternalProjectActionService,
	ExternalProjectActionValidationError
} from '$lib/server/projects/project-external-action-service';
import { RouteContextService } from '$lib/server/routing/route-context-service';

function field(data: FormData, name: string): string {
	const value = data.get(name);
	return typeof value === 'string' ? value : '';
}

function actionFailure(message: string) {
	return fail(400, { message });
}

async function requirePortalTask(locals: App.Locals, url: URL, workItemPublicId: string) {
	const canonical = parseCanonicalRoute(url.pathname);
	if (canonical?.kind !== 'portal') throw error(404, 'Shared work not found.');
	if (!locals.actor) {
		throw redirect(
			303,
			`${portalLoginPath(canonical.tenantSlug, canonical.partySlug)}?returnTo=${encodeURIComponent(url.pathname)}`
		);
	}
	const routing = new RouteContextService(getDatabase());
	const context = await routing.findPortalContext(
		locals.actor.authUserId,
		canonical.tenantSlug,
		canonical.partySlug
	);
	if (
		!context ||
		!(await routing.workItemBelongsToPortal(locals.actor.authUserId, workItemPublicId, context))
	) {
		throw error(404, 'Shared work not found.');
	}
	return context;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	await requirePortalTask(locals, url, params.workItemPublicId);
	try {
		return {
			task: await new ExternalProjectActionService().getTask(locals.actor!, params.workItemPublicId)
		};
	} catch (cause) {
		if (cause instanceof ExternalAccessDeniedError) throw error(404, 'Shared work not found.');
		throw cause;
	}
};

export const actions: Actions = {
	respondRfi: async ({ request, locals, params, url }) => {
		await requirePortalTask(locals, url, params.workItemPublicId);
		const data = await request.formData();
		try {
			await new ExternalProjectActionService().respondRfi(locals.actor!, {
				workItemPublicId: params.workItemPublicId,
				responseText: field(data, 'responseText'),
				final: data.get('final') === 'on'
			});
		} catch (cause) {
			if (cause instanceof ExternalAccessDeniedError) return fail(403, { message: cause.message });
			if (cause instanceof ExternalProjectActionValidationError) return actionFailure(cause.message);
			throw cause;
		}
		throw redirect(303, url.pathname);
	},

	reviewSubmittal: async ({ request, locals, params, url }) => {
		await requirePortalTask(locals, url, params.workItemPublicId);
		const data = await request.formData();
		try {
			await new ExternalProjectActionService().reviewSubmittal(locals.actor!, {
				workItemPublicId: params.workItemPublicId,
				outcome: field(data, 'outcome'),
				comments: field(data, 'comments')
			});
		} catch (cause) {
			if (cause instanceof ExternalAccessDeniedError) return fail(403, { message: cause.message });
			if (cause instanceof ExternalProjectActionValidationError) return actionFailure(cause.message);
			throw cause;
		}
		throw redirect(303, url.pathname);
	},

	acknowledgeInstruction: async ({ locals, params, url }) => {
		await requirePortalTask(locals, url, params.workItemPublicId);
		try {
			await new ExternalProjectActionService().acknowledgeInstruction(
				locals.actor!,
				params.workItemPublicId
			);
		} catch (cause) {
			if (cause instanceof ExternalAccessDeniedError) return fail(403, { message: cause.message });
			if (cause instanceof ExternalProjectActionValidationError) return actionFailure(cause.message);
			throw cause;
		}
		throw redirect(303, url.pathname);
	}
};
