import { json } from '@sveltejs/kit';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	reorderWorkflowNodes,
	WorkflowDesignerAccessError,
	WorkflowDesignerValidationError
} from '$lib/server/platform/workflow-designer-service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) return json({ error: 'Authentication is required.' }, { status: 401 });
	const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
	if (!access) return json({ error: 'Tenant access is required.' }, { status: 403 });
	const body = (await request.json().catch(() => null)) as { nodeKeys?: unknown } | null;
	if (
		!body ||
		!Array.isArray(body.nodeKeys) ||
		body.nodeKeys.some((value) => typeof value !== 'string')
	) {
		return json({ error: 'A valid workflow node order is required.' }, { status: 400 });
	}
	try {
		await reorderWorkflowNodes({
			actor: {
				organisationId: access.organisationId,
				userId: access.userId,
				memberId: access.memberId
			},
			publicId: params.template,
			nodeKeys: body.nodeKeys as string[]
		});
		return json({ success: true });
	} catch (cause) {
		if (cause instanceof WorkflowDesignerValidationError) {
			return json({ error: cause.message }, { status: 400 });
		}
		if (cause instanceof WorkflowDesignerAccessError) {
			return json({ error: cause.message }, { status: 403 });
		}
		throw cause;
	}
};
