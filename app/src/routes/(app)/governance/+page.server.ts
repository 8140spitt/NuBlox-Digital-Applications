import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import {
	GovernanceService,
	GovernanceValidationError
} from '$lib/server/governance/governance-service';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function text(data: FormData, name: string): string {
	return String(data.get(name) ?? '');
}

function nullableText(data: FormData, name: string): string | null {
	const value = text(data, name).trim();
	return value || null;
}

function checked(data: FormData, name: string): boolean {
	return data.get(name) !== null;
}

async function runAction(
	locals: App.Locals,
	operation: (
		service: GovernanceService,
		actor: TenantActorContext
	) => Promise<{ public_id?: string } | void>,
	fallbackFrameworkPublicId?: string | null
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
	try {
		const result = await operation(new GovernanceService(getDatabase()), actor);
		const frameworkPublicId = fallbackFrameworkPublicId ?? result?.public_id ?? null;
		throw redirect(
			303,
			frameworkPublicId
				? `/governance?framework=${encodeURIComponent(frameworkPublicId)}`
				: '/governance'
		);
	} catch (error) {
		if (error instanceof GovernanceValidationError) return fail(400, { error: error.message });
		if (error instanceof TenantAccessError)
			return fail(403, { error: 'You do not have access to this governance action.' });
		if (error instanceof RecordNotFoundError) return fail(404, { error: error.message });
		throw error;
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw redirect(303, '/signin');
	try {
		const db = getDatabase();
		const [workspace, members] = await Promise.all([
			new GovernanceService(db).getWorkspace(actor, url.searchParams.get('framework')),
			db
				.selectFrom('organisation_members as member')
				.innerJoin('users as user', 'user.id', 'member.user_id')
				.select(['member.id as id', 'user.display_name as display_name'])
				.where('member.organisation_id', '=', actor.organisationId)
				.where('member.status', '=', 'active')
				.where('user.status', '=', 'active')
				.orderBy('user.display_name', 'asc')
				.execute()
		]);
		const clientWorkspace = {
			...workspace,
			ethicsCases: workspace.ethicsCases.map(({ created_by_member_id, ...ethicsCase }) => {
				void created_by_member_id;
				return ethicsCase;
			})
		};
		return { ...clientWorkspace, members, actorMemberId: actor.memberId };
	} catch (error) {
		if (error instanceof RecordNotFoundError)
			throw httpError(404, 'Corporate governance workspace not found in the active scope.');
		if (error instanceof TenantAccessError)
			throw httpError(403, 'You do not have access to the corporate governance workspace.');
		throw error;
	}
};

export const actions: Actions = {
	createFramework: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createFramework(actor, {
				frameworkCode: text(data, 'frameworkCode'),
				title: text(data, 'title'),
				purposeText: text(data, 'purposeText'),
				principlesText: text(data, 'principlesText'),
				effectiveFrom: text(data, 'effectiveFrom'),
				effectiveTo: nullableText(data, 'effectiveTo'),
				ownerMemberId: nullableText(data, 'ownerMemberId')
			})
		);
	},
	addBody: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addBody(actor, {
					frameworkPublicId,
					bodyCode: text(data, 'bodyCode'),
					bodyType: text(data, 'bodyType') as 'board' | 'executive' | 'committee',
					title: text(data, 'title'),
					mandateText: text(data, 'mandateText'),
					quorumCount: text(data, 'quorumCount'),
					chairMemberId: nullableText(data, 'chairMemberId'),
					secretaryMemberId: nullableText(data, 'secretaryMemberId')
				}),
			frameworkPublicId
		);
	},
	appointMember: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.appointBodyMember(actor, {
					bodyPublicId: text(data, 'bodyPublicId'),
					memberId: text(data, 'memberId'),
					governanceRole: text(data, 'governanceRole') as
						'chair' | 'member' | 'secretary' | 'executive',
					votingRights: checked(data, 'votingRights'),
					appointedOn: text(data, 'appointedOn'),
					termEndsOn: nullableText(data, 'termEndsOn')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	addAuthorityRule: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addAuthorityRule(actor, {
					frameworkPublicId,
					bodyPublicId: text(data, 'bodyPublicId'),
					authorityCode: text(data, 'authorityCode'),
					subjectDomain: text(data, 'subjectDomain'),
					actionKey: text(data, 'actionKey'),
					description: text(data, 'description'),
					minAmount: nullableText(data, 'minAmount'),
					maxAmount: nullableText(data, 'maxAmount'),
					currencyCode: nullableText(data, 'currencyCode'),
					effectiveFrom: text(data, 'effectiveFrom'),
					effectiveTo: nullableText(data, 'effectiveTo')
				}),
			frameworkPublicId
		);
	},
	approveFramework: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) => service.approveFramework(actor, frameworkPublicId),
			frameworkPublicId
		);
	},
	reviseFramework: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.reviseFramework(actor, text(data, 'frameworkPublicId'))
		);
	},
	createMeeting: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.createMeeting(actor, {
					bodyPublicId: text(data, 'bodyPublicId'),
					meetingCode: text(data, 'meetingCode'),
					meetingType: text(data, 'meetingType') as 'scheduled' | 'special' | 'written_resolution',
					title: text(data, 'title'),
					scheduledAt: text(data, 'scheduledAt'),
					locationText: nullableText(data, 'locationText')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	setAttendance: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.setMeetingAttendance(actor, {
					meetingPublicId: text(data, 'meetingPublicId'),
					memberId: text(data, 'memberId'),
					attendanceStatus: text(data, 'attendanceStatus') as 'present' | 'apology' | 'absent'
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	addAgendaItem: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.addAgendaItem(actor, {
					meetingPublicId: text(data, 'meetingPublicId'),
					agendaNumber: text(data, 'agendaNumber'),
					itemType: text(data, 'itemType') as
						'decision' | 'information' | 'review' | 'policy' | 'ethics',
					title: text(data, 'title'),
					description: text(data, 'description'),
					sourceDomain: nullableText(data, 'sourceDomain'),
					sourceRecordType: nullableText(data, 'sourceRecordType'),
					sourcePublicId: nullableText(data, 'sourcePublicId'),
					authorityActionKey: nullableText(data, 'authorityActionKey'),
					decisionAmount: nullableText(data, 'decisionAmount'),
					currencyCode: nullableText(data, 'currencyCode')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	conveneMeeting: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) => service.conveneMeeting(actor, text(data, 'meetingPublicId')),
			nullableText(data, 'frameworkPublicId')
		);
	},
	recordDecision: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.recordDecision(actor, {
					agendaItemPublicId: text(data, 'agendaItemPublicId'),
					decisionCode: text(data, 'decisionCode'),
					decisionOutcome: text(data, 'decisionOutcome') as
						'approved' | 'rejected' | 'deferred' | 'noted',
					resolutionText: text(data, 'resolutionText')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	createAction: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.createAction(actor, {
					decisionPublicId: text(data, 'decisionPublicId'),
					actionCode: text(data, 'actionCode'),
					title: text(data, 'title'),
					description: text(data, 'description'),
					ownerMemberId: text(data, 'ownerMemberId'),
					dueDate: text(data, 'dueDate'),
					sourceDomain: nullableText(data, 'sourceDomain'),
					sourceRecordType: nullableText(data, 'sourceRecordType'),
					sourcePublicId: nullableText(data, 'sourcePublicId')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	completeAction: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.completeAction(
					actor,
					text(data, 'actionPublicId'),
					text(data, 'completionEvidence')
				),
			nullableText(data, 'frameworkPublicId')
		);
	},
	closeMeeting: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.closeMeeting(actor, text(data, 'meetingPublicId'), text(data, 'minutesText')),
			nullableText(data, 'frameworkPublicId')
		);
	},
	createPolicy: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.createPolicy(actor, {
					frameworkPublicId,
					approvalBodyPublicId: text(data, 'approvalBodyPublicId'),
					policyCode: text(data, 'policyCode'),
					title: text(data, 'title'),
					policyCategory: text(data, 'policyCategory') as
						'corporate' | 'finance' | 'people' | 'safety' | 'information' | 'ethics' | 'other',
					scopeText: text(data, 'scopeText'),
					policyText: text(data, 'policyText'),
					effectiveFrom: text(data, 'effectiveFrom'),
					reviewDueOn: text(data, 'reviewDueOn'),
					ownerMemberId: nullableText(data, 'ownerMemberId')
				}),
			frameworkPublicId
		);
	},
	approvePolicy: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) => service.approvePolicy(actor, text(data, 'policyPublicId')),
			nullableText(data, 'frameworkPublicId')
		);
	},
	revisePolicy: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) => service.revisePolicy(actor, text(data, 'policyPublicId')),
			nullableText(data, 'frameworkPublicId')
		);
	},
	attestPolicy: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.attestPolicy(
					actor,
					text(data, 'policyPublicId'),
					text(data, 'attestationStatus') as 'acknowledged' | 'declined',
					nullableText(data, 'commentary')
				),
			nullableText(data, 'frameworkPublicId')
		);
	},
	declareConflict: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.declareConflict(actor, {
					policyPublicId: nullableText(data, 'policyPublicId'),
					declarationType: text(data, 'declarationType') as 'actual' | 'potential' | 'perceived',
					subjectText: text(data, 'subjectText'),
					details: text(data, 'details'),
					declaredOn: text(data, 'declaredOn')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	reviewConflict: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.reviewConflict(
					actor,
					text(data, 'conflictPublicId'),
					text(data, 'reviewOutcome'),
					text(data, 'managementAction'),
					checked(data, 'close')
				),
			nullableText(data, 'frameworkPublicId')
		);
	},
	createEthicsCase: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.createEthicsCase(actor, {
					policyPublicId: nullableText(data, 'policyPublicId'),
					anonymous: checked(data, 'anonymous'),
					caseCode: text(data, 'caseCode'),
					subjectText: text(data, 'subjectText'),
					description: text(data, 'description'),
					severity: text(data, 'severity') as 'low' | 'medium' | 'high' | 'critical',
					ownerMemberId: nullableText(data, 'ownerMemberId')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	resolveEthicsCase: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.resolveEthicsCase(actor, text(data, 'casePublicId'), text(data, 'resolutionText')),
			nullableText(data, 'frameworkPublicId')
		);
	}
};
