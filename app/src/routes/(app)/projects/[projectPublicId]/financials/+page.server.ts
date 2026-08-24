import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	ProjectFinancialControlService,
	ProjectFinancialControlValidationError
} from '$lib/server/commercial/project-financial-control-service';
import { getDatabase } from '$lib/server/db/database';
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

function financialFailure(financialAction: string, financialError: string) {
	return { financialAction, financialError };
}

function parseDate(value: string | FormDataEntryValue | null, label: string): Date | null {
	const text = String(value ?? '').trim();
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		throw new ProjectFinancialControlValidationError(`${label} is invalid.`);
	}
	const parsed = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
		throw new ProjectFinancialControlValidationError(`${label} is invalid.`);
	}
	return parsed;
}

function requiredDate(value: FormDataEntryValue | null, label: string): Date {
	const parsed = parseDate(value, label);
	if (!parsed) throw new ProjectFinancialControlValidationError(`${label} is required.`);
	return parsed;
}

function handleFinancialActionError(cause: unknown, financialAction: string) {
	if (cause instanceof RecordNotFoundError) {
		return fail(404, financialFailure(financialAction, cause.message));
	}
	if (cause instanceof TenantAccessError) {
		return fail(403, financialFailure(financialAction, cause.message));
	}
	if (cause instanceof ProjectFinancialControlValidationError) {
		return fail(400, financialFailure(financialAction, cause.message));
	}
	throw cause;
}

function redirectToFinancials(projectPublicId: string, forecastPublicId?: string | null): never {
	const query = forecastPublicId ? `?forecast=${encodeURIComponent(forecastPublicId)}` : '';
	throw redirect(303, `/projects/${encodeURIComponent(projectPublicId)}/financials${query}`);
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		const asOf = parseDate(url.searchParams.get('asOf'), 'As-of date');
		return await new ProjectFinancialControlService(getDatabase()).getWorkspace(
			actor,
			params.projectPublicId,
			asOf,
			url.searchParams.get('forecast')
		);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError || cause instanceof TenantAccessError) {
			throw httpError(404, 'Project financial control not found.');
		}
		if (cause instanceof ProjectFinancialControlValidationError) {
			throw httpError(400, cause.message);
		}
		throw cause;
	}
};

export const actions: Actions = {
	createPeriod: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, financialFailure('create-period', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectFinancialControlService(getDatabase()).createReportingPeriod(actor, {
				projectPublicId: params.projectPublicId,
				periodLabel: String(data.get('periodLabel') ?? ''),
				periodStart: requiredDate(data.get('periodStart'), 'Period start'),
				periodEnd: requiredDate(data.get('periodEnd'), 'Period end')
			});
		} catch (cause) {
			return handleFinancialActionError(cause, 'create-period');
		}
		redirectToFinancials(params.projectPublicId);
	},

	createForecast: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, financialFailure('create-forecast', 'Authentication is required.'));
		const data = await request.formData();
		try {
			const forecastPublicId = await new ProjectFinancialControlService(
				getDatabase()
			).createForecast(actor, {
				projectPublicId: params.projectPublicId,
				periodPublicId: String(data.get('periodPublicId') ?? ''),
				forecastRevenueAmount: String(data.get('forecastRevenueAmount') ?? '')
			});
			redirectToFinancials(params.projectPublicId, forecastPublicId);
		} catch (cause) {
			return handleFinancialActionError(cause, 'create-forecast');
		}
	},

	updateForecastLine: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, financialFailure('update-forecast-line', 'Authentication is required.'));
		const data = await request.formData();
		const forecastPublicId = String(data.get('forecastPublicId') ?? '');
		try {
			await new ProjectFinancialControlService(getDatabase()).updateForecastLine(actor, {
				projectPublicId: params.projectPublicId,
				forecastPublicId,
				costCodePublicId: String(data.get('costCodePublicId') ?? ''),
				forecastToCompleteAmount: String(data.get('forecastToCompleteAmount') ?? ''),
				commentary: String(data.get('commentary') ?? '')
			});
		} catch (cause) {
			return handleFinancialActionError(cause, 'update-forecast-line');
		}
		redirectToFinancials(params.projectPublicId, forecastPublicId);
	},

	addCashFlow: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, financialFailure('add-cash-flow', 'Authentication is required.'));
		const data = await request.formData();
		const forecastPublicId = String(data.get('forecastPublicId') ?? '');
		try {
			await new ProjectFinancialControlService(getDatabase()).addCashFlowLine(actor, {
				projectPublicId: params.projectPublicId,
				forecastPublicId,
				costCodePublicId: String(data.get('costCodePublicId') ?? ''),
				flowDate: requiredDate(data.get('flowDate'), 'Cash-flow date'),
				direction: String(data.get('direction') ?? ''),
				category: String(data.get('category') ?? ''),
				amount: String(data.get('amount') ?? ''),
				commentary: String(data.get('commentary') ?? '')
			});
		} catch (cause) {
			return handleFinancialActionError(cause, 'add-cash-flow');
		}
		redirectToFinancials(params.projectPublicId, forecastPublicId);
	},

	removeCashFlow: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, financialFailure('remove-cash-flow', 'Authentication is required.'));
		const data = await request.formData();
		const forecastPublicId = String(data.get('forecastPublicId') ?? '');
		try {
			await new ProjectFinancialControlService(getDatabase()).removeCashFlowLine(
				actor,
				params.projectPublicId,
				forecastPublicId,
				Number(data.get('lineNumber'))
			);
		} catch (cause) {
			return handleFinancialActionError(cause, 'remove-cash-flow');
		}
		redirectToFinancials(params.projectPublicId, forecastPublicId);
	},

	approveForecast: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, financialFailure('approve-forecast', 'Authentication is required.'));
		const data = await request.formData();
		const forecastPublicId = String(data.get('forecastPublicId') ?? '');
		try {
			await new ProjectFinancialControlService(getDatabase()).approveForecast(
				actor,
				params.projectPublicId,
				forecastPublicId
			);
		} catch (cause) {
			return handleFinancialActionError(cause, 'approve-forecast');
		}
		redirectToFinancials(params.projectPublicId, forecastPublicId);
	},

	closePeriod: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, financialFailure('close-period', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectFinancialControlService(getDatabase()).closeReportingPeriod(
				actor,
				params.projectPublicId,
				String(data.get('periodPublicId') ?? '')
			);
		} catch (cause) {
			return handleFinancialActionError(cause, 'close-period');
		}
		redirectToFinancials(params.projectPublicId);
	},

	reopenPeriod: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, financialFailure('reopen-period', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectFinancialControlService(getDatabase()).reopenReportingPeriod(
				actor,
				params.projectPublicId,
				String(data.get('periodPublicId') ?? '')
			);
		} catch (cause) {
			return handleFinancialActionError(cause, 'reopen-period');
		}
		redirectToFinancials(params.projectPublicId);
	}
};
