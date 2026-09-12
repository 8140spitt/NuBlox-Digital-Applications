import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { AccountingService } from '$lib/server/finance/accounting-service';
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

export const GET: RequestHandler = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw error(401, 'Authentication and organisation context are required.');
	try {
		const result = await new AccountingService(getDatabase()).getExportContent(
			actor,
			params.exportPublicId
		);
		return new Response(result.content, {
			headers: {
				'content-type': 'text/csv; charset=utf-8',
				'content-disposition': `attachment; filename="${result.filename}"`,
				'x-content-sha256': result.contentSha256,
				'cache-control': 'private, no-store'
			}
		});
	} catch (cause) {
		if (cause instanceof RecordNotFoundError) throw error(404, 'Accounting export not found.');
		if (cause instanceof TenantAccessError) throw error(403, cause.message);
		if (cause instanceof FinanceValidationError) throw error(409, cause.message);
		throw cause;
	}
};
