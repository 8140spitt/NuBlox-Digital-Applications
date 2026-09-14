import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import { decidePermissions } from '$lib/server/auth/permission-service';
import { listJobFamilies, listJobProfiles } from '$lib/server/job-architecture-catalogue';
import {
	assignOrganisationMemberToPosition,
	createOrganisationPosition,
	listOrganisationPositions,
	listPositionAssignableMembers,
	OrganisationStructureAccessError,
	OrganisationStructureValidationError
} from '$lib/server/organisation-structure-service';
import type { Actions, PageServerLoad } from './$types';

async function loadContext(parent: Parameters<PageServerLoad>[0]['parent']) {
	const context = await parent();
	return {
		context,
		actor: {
			organisationId: context.tenant.organisationId,
			memberId: context.tenant.memberId,
			userId: context.user.id
		}
	};
}

async function actorFor(request: Request, tenantSlug: string, returnTo: string) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) redirect(303, routes.appSignIn(tenantSlug, returnTo));
	const access = await resolveActiveInternalTenant(session.user.id, tenantSlug);
	if (!access) redirect(303, routes.appNoAccess(tenantSlug));
	return {
		organisationId: access.organisationId,
		memberId: access.memberId,
		userId: access.userId
	};
}

function handled(cause: unknown) {
	if (cause instanceof OrganisationStructureValidationError) {
		return fail(400, { formError: cause.message });
	}
	if (cause instanceof OrganisationStructureAccessError) {
		return fail(403, { formError: cause.message });
	}
	throw cause;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { context, actor } = await loadContext(parent);
	const decisions = await decidePermissions({
		organisationId: actor.organisationId,
		memberId: actor.memberId,
		permissionKeys: ['organisation.structure.view', 'organisation.structure.manage']
	});
	if (decisions.get('organisation.structure.view')?.allowed !== true) {
		error(403, 'You do not have permission to view organisation structure.');
	}
	const families = listJobFamilies();
	const familyNames = new Map(families.map((family) => [family.id, family.name]));
	return {
		organisationName: context.tenant.displayName,
		canManage: decisions.get('organisation.structure.manage')?.allowed === true,
		positions: await listOrganisationPositions(actor),
		members: await listPositionAssignableMembers(actor),
		profiles: listJobProfiles().map((profile) => ({
			id: profile.id,
			title: profile.title,
			level: profile.level,
			familyName: familyNames.get(profile.jobFamilyId) ?? profile.jobFamilyId,
			status: profile.status
		}))
	};
};

export const actions = {
	create: async ({ params, request, url }) => {
		const actor = await actorFor(request, params.tenant, `${url.pathname}${url.search}`);
		const formData = await request.formData();
		try {
			const publicId = await createOrganisationPosition({
				actor,
				positionCode: String(formData.get('positionCode') ?? ''),
				jobProfileKey: String(formData.get('jobProfileKey') ?? ''),
				titleOverride: String(formData.get('titleOverride') ?? ''),
				reportsToPublicId: String(formData.get('reportsToPublicId') ?? ''),
				fte: Number(formData.get('fte') ?? 1),
				validFrom: String(formData.get('validFrom') ?? ''),
				validTo: String(formData.get('validTo') ?? '')
			});
			return { success: true, message: 'Organisation position created.', publicId };
		} catch (cause) {
			return handled(cause);
		}
	},
	assign: async ({ params, request, url }) => {
		const actor = await actorFor(request, params.tenant, `${url.pathname}${url.search}`);
		const formData = await request.formData();
		try {
			const publicId = await assignOrganisationMemberToPosition({
				actor,
				positionPublicId: String(formData.get('positionPublicId') ?? ''),
				memberPublicId: String(formData.get('memberPublicId') ?? ''),
				assignmentType: String(formData.get('assignmentType') ?? 'primary') as
					'primary' | 'acting' | 'secondary',
				allocationPercent: Number(formData.get('allocationPercent') ?? 100),
				startDate: String(formData.get('startDate') ?? ''),
				endDate: String(formData.get('endDate') ?? '')
			});
			return { success: true, message: 'Position assignment created.', publicId };
		} catch (cause) {
			return handled(cause);
		}
	}
} satisfies Actions;
