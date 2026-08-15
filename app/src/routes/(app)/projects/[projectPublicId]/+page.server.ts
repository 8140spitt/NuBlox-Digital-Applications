import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import {
	ConcurrentUpdateError,
	InvalidLifecycleTransitionError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import type { ProjectLifecycleStatus } from '$lib/server/projects/project-repository';
import { ProjectTeamService, ProjectTeamValidationError } from '$lib/server/projects/project-team-service';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';

const PROJECT_STATUSES = new Set<ProjectLifecycleStatus>([
	'proposed',
	'active',
	'on_hold',
	'completed',
	'cancelled',
	'archived'
]);

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function actionFailure(input: {
	transitionError?: string | null;
	teamError?: string | null;
	teamAction?: string;
}) {
	return {
		transitionError: input.transitionError ?? null,
		teamError: input.teamError ?? null,
		teamAction: input.teamAction ?? ''
	};
}

function parseEffectiveDate(value: FormDataEntryValue | null): Date | undefined {
	if (typeof value !== 'string' || !value.trim()) return undefined;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new InvalidLifecycleTransitionError('invalid-date', 'invalid-date');
	}
	const parsed = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) {
		throw new InvalidLifecycleTransitionError('invalid-date', 'invalid-date');
	}
	return parsed;
}

function roleKeys(data: FormData): string[] {
	return data.getAll('roleKeys').map((value) => String(value));
}

function teamFailure(error: unknown, teamAction: string) {
	if (error instanceof RecordNotFoundError) {
		return fail(404, actionFailure({ teamError: 'Project or requested record was not found.', teamAction }));
	}
	if (error instanceof TenantAccessError) {
		return fail(403, actionFailure({ teamError: error.message, teamAction }));
	}
	if (error instanceof ProjectTeamValidationError) {
		return fail(400, actionFailure({ teamError: error.message, teamAction }));
	}
	if (error instanceof ConcurrentUpdateError) {
		return fail(409, actionFailure({ teamError: 'The project team changed concurrently. Reload and try again.', teamAction }));
	}
	throw error;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');

	try {
		const db = getDatabase();
		const workspace = await new ProjectWorkspaceService(db).getWorkspace(actor, params.projectPublicId);
		const team = await new ProjectTeamService(db).getTeamView(actor, params.projectPublicId);
		return { ...workspace, team };
	} catch (cause) {
		if (cause instanceof RecordNotFoundError || cause instanceof TenantAccessError) {
			throw httpError(404, 'Project not found.');
		}
		throw cause;
	}
};

export const actions: Actions = {
	transition: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) {
			return fail(401, actionFailure({ transitionError: 'Authentication and organisation context are required.' }));
		}

		const data = await request.formData();
		const rawStatus = String(data.get('toStatus') ?? '');
		if (!PROJECT_STATUSES.has(rawStatus as ProjectLifecycleStatus)) {
			return fail(400, actionFailure({ transitionError: 'The requested project status is invalid.' }));
		}

		let effectiveDate: Date | undefined;
		try {
			effectiveDate = parseEffectiveDate(data.get('effectiveDate'));
		} catch {
			return fail(400, actionFailure({ transitionError: 'The effective date is invalid.' }));
		}

		try {
			await new ProjectWorkspaceService(getDatabase()).transitionProject(actor, {
				projectPublicId: params.projectPublicId,
				toStatus: rawStatus as ProjectLifecycleStatus,
				effectiveDate
			});
		} catch (cause) {
			if (cause instanceof RecordNotFoundError) {
				return fail(404, actionFailure({ transitionError: 'Project not found.' }));
			}
			if (cause instanceof TenantAccessError) {
				return fail(403, actionFailure({ transitionError: 'You do not have permission to manage this project lifecycle.' }));
			}
			if (cause instanceof InvalidLifecycleTransitionError) {
				return fail(409, actionFailure({ transitionError: 'That lifecycle transition is not allowed from the current project state.' }));
			}
			if (cause instanceof ConcurrentUpdateError) {
				return fail(409, actionFailure({ transitionError: 'The project changed concurrently. Reload and try again.' }));
			}
			throw cause;
		}

		throw redirect(303, `/projects/${encodeURIComponent(params.projectPublicId)}`);
	},

	inviteParticipant: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure({ teamError: 'Authentication is required.', teamAction: 'invite-participant' }));
		const data = await request.formData();
		try {
			await new ProjectTeamService(getDatabase()).inviteParticipant(actor, {
				projectPublicId: params.projectPublicId,
				organisationPublicId: String(data.get('organisationPublicId') ?? ''),
				roleKeys: roleKeys(data)
			});
		} catch (cause) {
			return teamFailure(cause, 'invite-participant');
		}
		throw redirect(303, `/projects/${encodeURIComponent(params.projectPublicId)}`);
	},

	updateParticipantRoles: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		const data = await request.formData();
		const organisationPublicId = String(data.get('organisationPublicId') ?? '');
		const marker = `participant-${organisationPublicId}`;
		if (!actor) return fail(401, actionFailure({ teamError: 'Authentication is required.', teamAction: marker }));
		try {
			await new ProjectTeamService(getDatabase()).updateParticipantRoles(actor, {
				projectPublicId: params.projectPublicId,
				organisationPublicId,
				roleKeys: roleKeys(data)
			});
		} catch (cause) {
			return teamFailure(cause, marker);
		}
		throw redirect(303, `/projects/${encodeURIComponent(params.projectPublicId)}`);
	},

	removeParticipant: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		const data = await request.formData();
		const organisationPublicId = String(data.get('organisationPublicId') ?? '');
		const marker = `participant-${organisationPublicId}`;
		if (!actor) return fail(401, actionFailure({ teamError: 'Authentication is required.', teamAction: marker }));
		try {
			await new ProjectTeamService(getDatabase()).removeParticipant(actor, {
				projectPublicId: params.projectPublicId,
				organisationPublicId
			});
		} catch (cause) {
			return teamFailure(cause, marker);
		}
		throw redirect(303, `/projects/${encodeURIComponent(params.projectPublicId)}`);
	},

	addMember: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure({ teamError: 'Authentication is required.', teamAction: 'add-member' }));
		const data = await request.formData();
		try {
			await new ProjectTeamService(getDatabase()).addMember(actor, {
				projectPublicId: params.projectPublicId,
				memberPublicId: String(data.get('memberPublicId') ?? ''),
				roleKeys: roleKeys(data)
			});
		} catch (cause) {
			return teamFailure(cause, 'add-member');
		}
		throw redirect(303, `/projects/${encodeURIComponent(params.projectPublicId)}`);
	},

	updateMemberRoles: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		const data = await request.formData();
		const memberPublicId = String(data.get('memberPublicId') ?? '');
		const marker = `member-${memberPublicId}`;
		if (!actor) return fail(401, actionFailure({ teamError: 'Authentication is required.', teamAction: marker }));
		try {
			await new ProjectTeamService(getDatabase()).updateMemberRoles(actor, {
				projectPublicId: params.projectPublicId,
				memberPublicId,
				roleKeys: roleKeys(data)
			});
		} catch (cause) {
			return teamFailure(cause, marker);
		}
		throw redirect(303, `/projects/${encodeURIComponent(params.projectPublicId)}`);
	},

	removeMember: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		const data = await request.formData();
		const memberPublicId = String(data.get('memberPublicId') ?? '');
		const marker = `member-${memberPublicId}`;
		if (!actor) return fail(401, actionFailure({ teamError: 'Authentication is required.', teamAction: marker }));
		let removedSelf = false;
		try {
			({ removedSelf } = await new ProjectTeamService(getDatabase()).removeMember(actor, {
				projectPublicId: params.projectPublicId,
				memberPublicId
			}));
		} catch (cause) {
			return teamFailure(cause, marker);
		}
		throw redirect(303, removedSelf ? '/projects' : `/projects/${encodeURIComponent(params.projectPublicId)}`);
	},

	leaveProject: async ({ locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure({ teamError: 'Authentication is required.', teamAction: 'leave-project' }));
		try {
			await new ProjectTeamService(getDatabase()).leaveProject(actor, params.projectPublicId);
		} catch (cause) {
			return teamFailure(cause, 'leave-project');
		}
		throw redirect(303, '/projects');
	}
};
