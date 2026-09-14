import { fail, redirect } from '@sveltejs/kit';
import { appPath, routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	addWorkflowLink,
	addWorkflowNode,
	addWorkflowParticipant,
	addWorkflowRole,
	addWorkflowVariable,
	bindWorkflowTemplate,
	deleteWorkflowLink,
	deleteWorkflowNode,
	getWorkflowTemplate,
	publishWorkflowTemplate,
	reviseWorkflowTemplate,
	unbindWorkflowTemplate,
	updateWorkflowTemplate,
	WorkflowAdministrationAccessError,
	WorkflowAdministrationValidationError
} from '$lib/server/platform/workflow-admin-service';
import type { WorkflowNodeType, WorkflowParticipantType, WorkflowVariableDefinition } from '$lib/server/platform/workflow-kernel';
import type { Actions, PageServerLoad } from './$types';

function checked(formData: FormData, key: string): boolean {
	return formData.get(key) === 'on' || formData.get(key) === 'true' || formData.get(key) === '1';
}

function optionalNumber(formData: FormData, key: string): number | undefined {
	const raw = String(formData.get(key) ?? '').trim();
	if (!raw) return undefined;
	const value = Number(raw);
	return Number.isFinite(value) ? value : Number.NaN;
}

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

function handled(cause: unknown) {
	if (cause instanceof WorkflowAdministrationValidationError) return fail(400, { formError: cause.message });
	if (cause instanceof WorkflowAdministrationAccessError) return fail(403, { formError: cause.message });
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
		return { template: await getWorkflowTemplate(actor, params.template) };
	} catch (cause) {
		if (cause instanceof WorkflowAdministrationAccessError) redirect(303, routes.dashboard(tenant.slug));
		if (cause instanceof WorkflowAdministrationValidationError) redirect(303, appPath(tenant.slug, 'workflow'));
		throw cause;
	}
};

export const actions = {
	update: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await updateWorkflowTemplate({
				actor,
				publicId: params.template,
				name: String(formData.get('name') ?? ''),
				description: String(formData.get('description') ?? '')
			});
			return { success: 'Workflow template details updated.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	addRole: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addWorkflowRole({
				actor,
				publicId: params.template,
				roleKey: String(formData.get('roleKey') ?? ''),
				label: String(formData.get('label') ?? ''),
				description: String(formData.get('description') ?? '')
			});
			return { success: 'Workflow role added.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	addVariable: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addWorkflowVariable({
				actor,
				publicId: params.template,
				variableKey: String(formData.get('variableKey') ?? ''),
				variableType: String(formData.get('variableType') ?? 'string') as WorkflowVariableDefinition['type'],
				variableScope: String(formData.get('variableScope') ?? 'process') as WorkflowVariableDefinition['scope'],
				visible: checked(formData, 'visible'),
				required: checked(formData, 'required'),
				readOnly: checked(formData, 'readOnly'),
				resettable: checked(formData, 'resettable')
			});
			return { success: 'Workflow variable added.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	addNode: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		const routingEvents = String(formData.get('routingEvents') ?? '')
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);
		const notifyRoles = String(formData.get('deadlineNotifyRoleKeys') ?? '')
			.split(',')
			.map((value) => value.trim())
			.filter(Boolean);
		try {
			await addWorkflowNode({
				actor,
				publicId: params.template,
				nodeKey: String(formData.get('nodeKey') ?? ''),
				label: String(formData.get('label') ?? ''),
				nodeType: String(formData.get('nodeType') ?? 'activity') as WorkflowNodeType,
				responsibleRoleKey: String(formData.get('responsibleRoleKey') ?? ''),
				completionRuleType: (String(formData.get('completionRuleType') ?? '') || undefined) as 'any' | 'all' | 'count' | undefined,
				completionCount: optionalNumber(formData, 'completionCount'),
				routingEvents,
				deadlineMinutes: optionalNumber(formData, 'deadlineMinutes'),
				deadlineRelativeTo: (String(formData.get('deadlineRelativeTo') ?? '') || undefined) as 'node_start' | 'process_start' | undefined,
				overdueAction: (String(formData.get('overdueAction') ?? '') || undefined) as 'notify' | 'reassign' | 'skip' | 'complete' | 'escalate' | 'block' | undefined,
				deadlineResponsibleRoleKey: String(formData.get('deadlineResponsibleRoleKey') ?? ''),
				deadlineNotifyRoleKeys: notifyRoles,
				requiresElectronicSignature: checked(formData, 'requiresElectronicSignature'),
				thresholdCount: optionalNumber(formData, 'thresholdCount'),
				subprocessKey: String(formData.get('subprocessKey') ?? ''),
				serviceActionKey: String(formData.get('serviceActionKey') ?? ''),
				integrationKey: String(formData.get('integrationKey') ?? ''),
				timerMinutes: optionalNumber(formData, 'timerMinutes'),
				synchronizeEventKey: String(formData.get('synchronizeEventKey') ?? ''),
				recordVariableChanges: checked(formData, 'recordVariableChanges'),
				recordVotes: checked(formData, 'recordVotes'),
				recordReassignments: checked(formData, 'recordReassignments'),
				abortOnError: checked(formData, 'abortOnError'),
				abortParentOnError: checked(formData, 'abortParentOnError'),
				displayOrder: Number(formData.get('displayOrder') ?? 0)
			});
			return { success: 'Workflow node added.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	addParticipant: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addWorkflowParticipant({
				actor,
				publicId: params.template,
				nodeKey: String(formData.get('nodeKey') ?? ''),
				participantType: String(formData.get('participantType') ?? 'workflow_role') as WorkflowParticipantType,
				participantKey: String(formData.get('participantKey') ?? ''),
				required: checked(formData, 'required')
			});
			return { success: 'Workflow participant added.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	addLink: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addWorkflowLink({
				actor,
				publicId: params.template,
				fromNodeKey: String(formData.get('fromNodeKey') ?? ''),
				toNodeKey: String(formData.get('toNodeKey') ?? ''),
				eventKey: String(formData.get('eventKey') ?? ''),
				loop: checked(formData, 'loop'),
				terminateOpenPredecessors: checked(formData, 'terminateOpenPredecessors'),
				displayOrder: Number(formData.get('displayOrder') ?? 0)
			});
			return { success: 'Workflow route added.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	deleteLink: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await deleteWorkflowLink({ actor, publicId: params.template, linkPublicId: String(formData.get('linkPublicId') ?? '') });
			return { success: 'Workflow route removed.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	deleteNode: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await deleteWorkflowNode({ actor, publicId: params.template, nodeKey: String(formData.get('nodeKey') ?? '') });
			return { success: 'Workflow node removed.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	publish: async ({ request, params, url }) => {
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await publishWorkflowTemplate({ actor, publicId: params.template });
			return { success: 'Workflow template published.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	revise: async ({ request, params, url }) => {
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			const revision = await reviseWorkflowTemplate({ actor, publicId: params.template });
			redirect(303, `${appPath(access.organisationRouteSlug, 'workflow')}/${revision.publicId}`);
		} catch (cause) {
			return handled(cause);
		}
	},
	bind: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await bindWorkflowTemplate({
				actor,
				publicId: params.template,
				sourceDomain: String(formData.get('sourceDomain') ?? ''),
				sourceType: String(formData.get('sourceType') ?? ''),
				eventKey: String(formData.get('eventKey') ?? '')
			});
			return { success: 'Published workflow binding activated.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	unbind: async ({ request, params, url }) => {
		const formData = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await unbindWorkflowTemplate({ actor, bindingId: Number(formData.get('bindingId') ?? 0) });
			return { success: 'Workflow binding removed.' };
		} catch (cause) {
			return handled(cause);
		}
	}
} satisfies Actions;
