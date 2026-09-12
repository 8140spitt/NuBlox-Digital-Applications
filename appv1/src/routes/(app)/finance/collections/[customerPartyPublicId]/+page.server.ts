import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { CollectionsService } from '$lib/server/finance/collections-service';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
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

function actionFailure(cause: unknown) {
	if (cause instanceof FinanceValidationError) return fail(400, { actionError: cause.message });
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: cause.message });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function workspacePath(customerPartyPublicId: string) {
	return `/finance/collections/${encodeURIComponent(customerPartyPublicId)}`;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new CollectionsService(getDatabase()).getWorkspace(
			actor,
			params.customerPartyPublicId
		);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError)
			throw httpError(404, 'Customer collections account not found.');
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Collections access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	startCase: async ({ params, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		try {
			await new CollectionsService(getDatabase()).startCase(actor, params.customerPartyPublicId);
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, workspacePath(params.customerPartyPublicId));
	},
	caseStatus: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		const status = String(data.get('status') ?? '');
		if (status !== 'open' && status !== 'paused' && status !== 'closed') {
			return fail(400, { actionError: 'Collections case status is invalid.' });
		}
		try {
			await new CollectionsService(getDatabase()).setCaseStatus(
				actor,
				String(data.get('casePublicId') ?? ''),
				status,
				String(data.get('reason') ?? '')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, workspacePath(params.customerPartyPublicId));
	},
	recordAction: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CollectionsService(getDatabase()).recordAction(actor, {
				casePublicId: String(data.get('casePublicId') ?? ''),
				actionType: String(data.get('actionType') ?? ''),
				deliveryChannel: String(data.get('deliveryChannel') ?? ''),
				subject: String(data.get('subject') ?? ''),
				messageBody: String(data.get('messageBody') ?? ''),
				outcome: String(data.get('outcome') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, workspacePath(params.customerPartyPublicId));
	},
	recordPromise: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CollectionsService(getDatabase()).recordPromise(actor, {
				casePublicId: String(data.get('casePublicId') ?? ''),
				invoicePublicId: String(data.get('invoicePublicId') ?? ''),
				amount: String(data.get('amount') ?? ''),
				currencyCode: String(data.get('currencyCode') ?? ''),
				dueOn: String(data.get('dueOn') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, workspacePath(params.customerPartyPublicId));
	},
	resolvePromise: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		const status = String(data.get('status') ?? '');
		if (status !== 'kept' && status !== 'broken' && status !== 'cancelled') {
			return fail(400, { actionError: 'Promise resolution is invalid.' });
		}
		try {
			await new CollectionsService(getDatabase()).resolvePromise(actor, {
				casePublicId: String(data.get('casePublicId') ?? ''),
				promisePublicId: String(data.get('promisePublicId') ?? ''),
				status,
				note: String(data.get('note') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, workspacePath(params.customerPartyPublicId));
	},
	openDispute: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CollectionsService(getDatabase()).openDispute(actor, {
				casePublicId: String(data.get('casePublicId') ?? ''),
				invoicePublicId: String(data.get('invoicePublicId') ?? ''),
				disputedAmount: String(data.get('disputedAmount') ?? ''),
				currencyCode: String(data.get('currencyCode') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, workspacePath(params.customerPartyPublicId));
	},
	resolveDispute: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		const status = String(data.get('status') ?? '');
		if (status !== 'resolved' && status !== 'withdrawn') {
			return fail(400, { actionError: 'Dispute resolution is invalid.' });
		}
		try {
			await new CollectionsService(getDatabase()).resolveDispute(actor, {
				casePublicId: String(data.get('casePublicId') ?? ''),
				disputePublicId: String(data.get('disputePublicId') ?? ''),
				status,
				note: String(data.get('note') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, workspacePath(params.customerPartyPublicId));
	}
};
