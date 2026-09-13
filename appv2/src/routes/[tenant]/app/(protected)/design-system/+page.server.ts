import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

function text(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

export const actions = {
	preview: async ({ request }) => {
		const formData = await request.formData();
		const values = {
			title: text(formData, 'title'),
			owner: text(formData, 'owner'),
			priority: text(formData, 'priority'),
			notes: text(formData, 'notes')
		};

		const errors: Record<string, string> = {};
		if (!values.title) errors.title = 'Enter a record title.';
		if (!values.owner) errors.owner = 'Enter an accountable owner.';
		if (!['normal', 'high', 'critical'].includes(values.priority)) {
			errors.priority = 'Choose a valid priority.';
		}

		if (Object.keys(errors).length > 0) {
			return fail(400, { success: false, values, errors });
		}

		return {
			success: true,
			values,
			message: 'Server validation passed. The same action works without JavaScript.'
		};
	}
} satisfies Actions;
