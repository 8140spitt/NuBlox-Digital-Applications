import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	activateLifecycleTemplate,
	addLifecycleAccessRule,
	addLifecyclePhase,
	addLifecycleRole,
	addLifecycleTransition,
	bindOrganisationRole,
	deleteLifecycleAccessRule,
	deleteLifecyclePhase,
	deleteLifecycleRole,
	deleteLifecycleTransition,
	discardLifecycleTemplate,
	getLifecycleTemplate,
	LifecycleAdministrationAccessError,
	LifecycleAdministrationValidationError,
	listLifecycleReferenceData,
	publishLifecycleTemplate,
	reviseLifecycleTemplate,
	unbindOrganisationRole,
	updateLifecycleTemplate
} from '$lib/server/platform/lifecycle-admin-service';
import type { Actions, PageServerLoad } from './$types';

async function actorFor(request: Request, params: { tenant: string }, returnTo: string) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) redirect(303, routes.appSignIn(params.tenant, returnTo));
	const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
	if (!access) redirect(303, routes.appNoAccess(params.tenant));
	return {
		access,
		actor: {
			organisationId: access.organisationId,
			userId: access.userId,
			memberId: access.memberId
		}
	};
}

function checked(formData: FormData, name: string): boolean {
	return formData.get(name) === 'on';
}

function numberValue(formData: FormData, name: string, fallback = 0): number {
	const value = Number(formData.get(name));
	return Number.isFinite(value) ? value : fallback;
}

function handle(cause: unknown) {
	if (cause instanceof LifecycleAdministrationValidationError) return fail(400, { formError: cause.message });
	if (cause instanceof LifecycleAdministrationAccessError) return fail(403, { formError: cause.message });
	throw cause;
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant, user } = await parent();
	const actor = {
		organisationId: tenant.organisationId,
		userId: user.id,
		memberId: tenant.memberId
	};
	try {
		const [template, referenceData] = await Promise.all([
			getLifecycleTemplate(actor, params.template),
			listLifecycleReferenceData(actor)
		]);
		return { template, referenceData };
	} catch (cause) {
		if (cause instanceof LifecycleAdministrationAccessError) redirect(303, routes.dashboard(tenant.slug));
		if (cause instanceof LifecycleAdministrationValidationError) error(404, cause.message);
		throw cause;
	}
};

export const actions = {
	update: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await updateLifecycleTemplate({
				actor,
				publicId: params.template,
				name: String(formData.get('name') ?? ''),
				description: String(formData.get('description') ?? ''),
				objectType: String(formData.get('objectType') ?? ''),
				initialState: String(formData.get('initialState') ?? '')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	addPhase: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addLifecyclePhase({
				actor,
				publicId: params.template,
				phaseKey: String(formData.get('phaseKey') ?? ''),
				label: String(formData.get('label') ?? ''),
				displayOrder: numberValue(formData, 'displayOrder', 10),
				editable: checked(formData, 'editable'),
				deletable: checked(formData, 'deletable'),
				revisable: checked(formData, 'revisable')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	deletePhase: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await deleteLifecyclePhase({
				actor,
				publicId: params.template,
				phaseKey: String(formData.get('phaseKey') ?? '')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	addRole: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addLifecycleRole({
				actor,
				publicId: params.template,
				roleKey: String(formData.get('roleKey') ?? ''),
				label: String(formData.get('label') ?? ''),
				description: String(formData.get('description') ?? '')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	deleteRole: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await deleteLifecycleRole({
				actor,
				publicId: params.template,
				roleKey: String(formData.get('roleKey') ?? '')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	bindRole: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await bindOrganisationRole({
				actor,
				publicId: params.template,
				lifecycleRoleKey: String(formData.get('lifecycleRoleKey') ?? ''),
				organisationRolePublicId: String(formData.get('organisationRolePublicId') ?? '')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	unbindRole: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await unbindOrganisationRole({
				actor,
				publicId: params.template,
				lifecycleRoleKey: String(formData.get('lifecycleRoleKey') ?? ''),
				organisationRolePublicId: String(formData.get('organisationRolePublicId') ?? '')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	addAccessRule: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addLifecycleAccessRule({
				actor,
				publicId: params.template,
				phaseKey: String(formData.get('phaseKey') ?? ''),
				roleKey: String(formData.get('roleKey') ?? ''),
				permissionKey: String(formData.get('permissionKey') ?? '')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	deleteAccessRule: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await deleteLifecycleAccessRule({
				actor,
				publicId: params.template,
				ruleId: numberValue(formData, 'ruleId')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	addTransition: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addLifecycleTransition({
				actor,
				publicId: params.template,
				fromState: String(formData.get('fromState') ?? ''),
				toState: String(formData.get('toState') ?? ''),
				label: String(formData.get('label') ?? ''),
				requiresNote: checked(formData, 'requiresNote'),
				requiresTargetReference: checked(formData, 'requiresTargetReference'),
				tone: formData.get('tone') === 'danger' ? 'danger' : 'default',
				requiredPermissionKey: String(formData.get('requiredPermissionKey') ?? ''),
				workflowKey: String(formData.get('workflowKey') ?? '')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	deleteTransition: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await deleteLifecycleTransition({
				actor,
				publicId: params.template,
				transitionPublicId: String(formData.get('transitionPublicId') ?? '')
			});
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	publish: async ({ request, params, url }) => {
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await publishLifecycleTemplate({ actor, publicId: params.template });
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	activate: async ({ request, params, url }) => {
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await activateLifecycleTemplate({ actor, publicId: params.template });
			redirect(303, url.pathname);
		} catch (cause) {
			return handle(cause);
		}
	},
	revise: async ({ request, params, url }) => {
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			const revision = await reviseLifecycleTemplate({ actor, publicId: params.template });
			redirect(303, routes.lifecycleTemplate(access.organisationRouteSlug, revision.publicId));
		} catch (cause) {
			return handle(cause);
		}
	},
	discard: async ({ request, params, url }) => {
		const formData = await request.formData();
		if (String(formData.get('confirmation') ?? '') !== 'DISCARD') {
			return fail(400, { formError: 'Type DISCARD to remove the working lifecycle-template revision.' });
		}
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await discardLifecycleTemplate({ actor, publicId: params.template });
			redirect(303, routes.lifecycle(access.organisationRouteSlug));
		} catch (cause) {
			return handle(cause);
		}
	}
} satisfies Actions;
