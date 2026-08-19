import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import {
	InformationService,
	InformationValidationError
} from '$lib/server/information/information-service';
import { TenantAccessError } from '$lib/server/kernel/errors';

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

function failure(error: string) {
	return { error };
}

async function runAction(
	locals: App.Locals,
	operation: (service: InformationService, actor: TenantActorContext) => Promise<void>
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, failure('Authentication and organisation context are required.'));
	try {
		await operation(new InformationService(getDatabase()), actor);
	} catch (error) {
		if (error instanceof InformationValidationError) return fail(400, failure(error.message));
		if (error instanceof TenantAccessError) {
			return fail(403, failure('You do not have access to this project information action.'));
		}
		throw error;
	}
	throw redirect(303, '/documents');
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return {
			canView: false,
			canManage: false,
			canManageFiles: false,
			canIssue: false,
			canManageRfis: false,
			canRespondRfis: false,
			canManageSubmittals: false,
			canReviewSubmittals: false,
			canManageInstructions: false,
			canIssueInstructions: false,
			projects: [],
			containerTypes: [],
			purposeCodes: [],
			submittalTypes: [],
			instructionTypes: [],
			documents: [],
			rfis: [],
			submittals: [],
			instructions: []
		};
	}
	return new InformationService(getDatabase()).getWorkspace(actor);
};

export const actions: Actions = {
	createDocument: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, async (service, actor) => {
			await service.createDocument(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				typeCode: text(data, 'typeCode'),
				containerNumber: text(data, 'containerNumber'),
				title: text(data, 'title'),
				disciplineCode: text(data, 'disciplineCode'),
				classificationCode: text(data, 'classificationCode'),
				revisionCode: text(data, 'revisionCode'),
				purposeCode: text(data, 'purposeCode'),
				suitabilityCode: text(data, 'suitabilityCode')
			});
		});
	},

	createRevision: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, async (service, actor) => {
			await service.createRevision(actor, {
				containerPublicId: text(data, 'containerPublicId'),
				revisionCode: text(data, 'revisionCode'),
				titleAtVersion: text(data, 'titleAtVersion'),
				purposeCode: text(data, 'purposeCode'),
				suitabilityCode: text(data, 'suitabilityCode')
			});
		});
	},

	updateRevision: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, async (service, actor) => {
			await service.updateDraftRevision(actor, {
				versionPublicId: text(data, 'versionPublicId'),
				titleAtVersion: text(data, 'titleAtVersion'),
				purposeCode: text(data, 'purposeCode'),
				suitabilityCode: text(data, 'suitabilityCode')
			});
		});
	},

	registerFile: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, async (service, actor) => {
			await service.registerFileMetadata(actor, {
				versionPublicId: text(data, 'versionPublicId'),
				fileRole: text(data, 'fileRole'),
				storageProvider: text(data, 'storageProvider'),
				storageBucket: text(data, 'storageBucket'),
				storageKey: text(data, 'storageKey'),
				originalFilename: text(data, 'originalFilename'),
				contentType: text(data, 'contentType'),
				sizeBytes: text(data, 'sizeBytes'),
				checksumAlgorithm: text(data, 'checksumAlgorithm'),
				checksumValue: text(data, 'checksumValue')
			});
		});
	},

	issueRevision: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, async (service, actor) => {
			await service.issueRevision(actor, {
				versionPublicId: text(data, 'versionPublicId'),
				channel: text(data, 'channel'),
				note: text(data, 'note')
			});
		});
	},

	createRfi: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, async (service, actor) => {
			await service.createRfi(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				rfiNumber: text(data, 'rfiNumber'),
				subject: text(data, 'subject'),
				question: text(data, 'question'),
				priority: text(data, 'priority'),
				dueAt: text(data, 'dueAt')
			});
		});
	},

	openRfi: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) => service.openRfi(actor, text(data, 'rfiPublicId')));
	},

	respondRfi: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.respondToRfi(actor, {
				rfiPublicId: text(data, 'rfiPublicId'),
				responseText: text(data, 'responseText'),
				final: data.get('final') !== 'false'
			})
		);
	},

	closeRfi: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) => service.closeRfi(actor, text(data, 'rfiPublicId')));
	},

	createSubmittal: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createSubmittal(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				number: text(data, 'number'),
				typeCode: text(data, 'typeCode'),
				title: text(data, 'title'),
				dueAt: text(data, 'dueAt'),
				versionPublicId: text(data, 'versionPublicId')
			}).then(() => undefined)
		);
	},

	submitSubmittal: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) => service.submitSubmittal(actor, text(data, 'submittalPublicId')));
	},

	reviewSubmittal: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.reviewSubmittal(actor, {
				publicId: text(data, 'submittalPublicId'),
				outcome: text(data, 'outcome'),
				comments: text(data, 'comments')
			})
		);
	},

	createInstruction: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createInstruction(actor, {
				projectPublicId: text(data, 'projectPublicId'),
				number: text(data, 'number'),
				typeCode: text(data, 'typeCode'),
				subject: text(data, 'subject'),
				instructionText: text(data, 'instructionText')
			}).then(() => undefined)
		);
	},

	issueInstruction: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) => service.issueInstruction(actor, text(data, 'instructionPublicId')));
	}
};
