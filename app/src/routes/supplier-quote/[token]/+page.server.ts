import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { SUPPLIER_RFQ_SIGNUP_COOKIE } from '$lib/server/auth/supplier-rfq-cookie';
import { getDatabase } from '$lib/server/db/database';
import { SupplierRfqPortalService } from '$lib/server/procurement/supplier-rfq-portal-service';

function normaliseEmail(value: string): string {
	return value.trim().toLowerCase();
}

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const invitation = await new SupplierRfqPortalService(getDatabase()).getInvitation(params.token);
	if (!invitation)
		throw error(404, 'This supplier quotation invitation is invalid or has expired.');

	const expiresAt =
		invitation.responseDeadlineAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
	const remainingSeconds = Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
	cookies.set(SUPPLIER_RFQ_SIGNUP_COOKIE, params.token, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/',
		maxAge: remainingSeconds
	});

	return {
		invitation: {
			rfqNumber: invitation.rfqNumber,
			title: invitation.title,
			issuerName: invitation.issuerName,
			supplierName: invitation.supplierName,
			email: invitation.recipientEmail,
			currencyCode: invitation.currencyCode,
			responseDeadlineAt: invitation.responseDeadlineAt?.toISOString() ?? null,
			lineCount: invitation.lines.length,
			status: invitation.status
		},
		actor: locals.actor
			? { displayName: locals.actor.displayName, email: locals.actor.email }
			: null,
		emailMatchesActor:
			Boolean(locals.actor) &&
			normaliseEmail(locals.actor?.email ?? '') === normaliseEmail(invitation.recipientEmail),
		returnTo: `/supplier-quote/${encodeURIComponent(params.token)}`
	};
};
