import { error as httpError, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function versionFromUrl(url: URL): number | undefined {
	const text = url.searchParams.get('version');
	if (!text) return undefined;
	const parsed = Number(text);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function versionFromForm(value: FormDataEntryValue | null): number | undefined {
	const parsed = Number(String(value ?? ''));
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function contractFormationLocation(quotationPublicId: string, versionNumber?: number): string {
	const version = versionNumber ? `&version=${versionNumber}` : '';
	return `/contracts/new?quotation=${encodeURIComponent(quotationPublicId)}${version}`;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) {
		throw httpError(401, 'Authentication and organisation context are required.');
	}
	throw redirect(303, contractFormationLocation(params.quotationPublicId, versionFromUrl(url)));
};

export const actions: Actions = {
	convert: async ({ request, locals, params }) => {
		if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) {
			throw httpError(401, 'Authentication and organisation context are required.');
		}
		const data = await request.formData();
		throw redirect(
			303,
			contractFormationLocation(
				params.quotationPublicId,
				versionFromForm(data.get('versionNumber'))
			)
		);
	}
};
