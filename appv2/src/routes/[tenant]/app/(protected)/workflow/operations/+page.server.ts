import { redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import {
	listWorkflowOperations,
	WorkflowOperationsAccessError
} from '$lib/server/platform/workflow-operations-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { tenant, user } = await parent();
	try {
		const operations = await listWorkflowOperations({
			organisationId: tenant.organisationId,
			userId: user.id,
			memberId: tenant.memberId
		});
		return {
			operations,
			summary: {
				active: operations.filter((item) => item.requestStatus === 'pending').length,
				attention: operations.filter((item) => item.requestStatus === 'pending' && item.health !== 'green').length,
				closed: operations.filter((item) => item.requestStatus !== 'pending').length
			}
		};
	} catch (cause) {
		if (cause instanceof WorkflowOperationsAccessError) redirect(303, routes.dashboard(tenant.slug));
		throw cause;
	}
};
