import { error } from '@sveltejs/kit';
import { decidePermissions } from '$lib/server/auth/permission-service';
import { getJobProfileDetail } from '$lib/server/job-architecture-catalogue';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const context = await parent();
	const decisions = await decidePermissions({
		organisationId: context.tenant.organisationId,
		memberId: context.tenant.memberId,
		permissionKeys: ['organisation.structure.view']
	});
	if (decisions.get('organisation.structure.view')?.allowed !== true) {
		error(403, 'You do not have permission to view organisation structure.');
	}

	const detail = getJobProfileDetail(params.profile);
	if (!detail) error(404, 'Job profile not found');
	return detail;
};
