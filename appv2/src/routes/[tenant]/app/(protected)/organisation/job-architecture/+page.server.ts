import { error } from '@sveltejs/kit';
import { decidePermissions } from '$lib/server/auth/permission-service';
import {
	getJobArchitectureCoverage,
	listJobFamilies,
	listJobProfileLevels,
	listJobProfiles
} from '$lib/server/job-architecture-catalogue';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
	const context = await parent();
	const decisions = await decidePermissions({
		organisationId: context.tenant.organisationId,
		memberId: context.tenant.memberId,
		permissionKeys: ['organisation.structure.view']
	});
	if (decisions.get('organisation.structure.view')?.allowed !== true) {
		error(403, 'You do not have permission to view organisation structure.');
	}

	const family = url.searchParams.get('family');
	const level = url.searchParams.get('level');
	const query = url.searchParams.get('q');
	const profiles = listJobProfiles({ jobFamilyId: family, level, query });
	const families = listJobFamilies();
	const familyNames = new Map(families.map((item) => [item.id, item.name]));

	return {
		coverage: getJobArchitectureCoverage(),
		families: families.map((item) => ({
			...item,
			profileCount: listJobProfiles({ jobFamilyId: item.id }).length
		})),
		levels: listJobProfileLevels(),
		filters: { family: family ?? '', level: level ?? '', query: query ?? '' },
		profiles: profiles.map((profile) => ({
			id: profile.id,
			title: profile.title,
			status: profile.status,
			level: profile.level,
			jobFamilyId: profile.jobFamilyId,
			jobFamilyName: familyNames.get(profile.jobFamilyId) ?? profile.jobFamilyId,
			purpose: profile.purpose,
			primaryRoleCount: profile.primaryFunctionalRoleIds.length,
			functionIds: profile.sourceMappings.functionIds,
			subfunctionIds: profile.sourceMappings.subfunctionIds
		}))
	};
};
