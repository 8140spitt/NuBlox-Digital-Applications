import type { DatabaseExecutor } from '$lib/server/db/executor';

export type PortalProjectSummary = {
	id: string;
	publicId: string;
	projectNumber: string;
	name: string;
	status: string;
	owningOrganisationId: string;
	owningOrganisationName: string;
	isOwnedByCurrentOrganisation: boolean;
};

export type PortalRfiTask = {
	id: string;
	publicId: string;
	projectId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	owningOrganisationId: string;
	owningOrganisationName: string;
	rfiNumber: string;
	subject: string;
	question: string;
	priority: string;
	status: string;
	dueAt: Date | null;
	assignedAt: Date;
	responseCount: number;
	latestResponse: string | null;
};

export type PortalSubmittalTask = {
	id: string;
	publicId: string;
	projectId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	owningOrganisationId: string;
	owningOrganisationName: string;
	number: string;
	typeName: string;
	title: string;
	status: string;
	dueAt: Date | null;
	submittedAt: Date | null;
	reviewerDueAt: Date | null;
	assignedAt: Date;
	reviewCount: number;
	latestOutcome: string | null;
};

export type PortalInstructionTask = {
	id: string;
	publicId: string;
	projectId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	issuingOrganisationId: string;
	issuingOrganisationName: string;
	number: string;
	typeName: string;
	subject: string;
	instructionText: string;
	status: string;
	issuedAt: Date | null;
	acknowledgedAt: Date | null;
};

export type PortalTransmittalItem = {
	versionPublicId: string;
	containerNumber: string;
	title: string;
	revisionCode: string;
	versionStatus: string;
};

export type PortalTransmittalSummary = {
	id: string;
	publicId: string;
	projectId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	issuingOrganisationId: string;
	issuingOrganisationName: string;
	transmittalNumber: string;
	subject: string;
	purpose: string | null;
	issuedAt: Date;
	deliveryStatus: string;
	deliveredAt: Date | null;
	items: PortalTransmittalItem[];
};

export type PortalManageRfi = {
	id: string;
	publicId: string;
	rfiNumber: string;
	subject: string;
	status: string;
	dueAt: Date | null;
};

export type PortalManageSubmittal = {
	id: string;
	publicId: string;
	number: string;
	title: string;
	status: string;
	dueAt: Date | null;
};

export type PortalManageInstruction = {
	id: string;
	publicId: string;
	number: string;
	subject: string;
	status: string;
	issuedAt: Date | null;
};

export type PortalManageVersion = {
	id: string;
	publicId: string;
	containerNumber: string;
	title: string;
	revisionCode: string;
	status: string;
};

export type LockedPortalRfi = {
	id: string;
	publicId: string;
	projectId: string;
	owningOrganisationId: string;
	status: string;
};

export type LockedPortalSubmittal = {
	id: string;
	publicId: string;
	projectId: string;
	owningOrganisationId: string;
	status: string;
};

export type LockedPortalInstruction = {
	id: string;
	publicId: string;
	projectId: string;
	issuingOrganisationId: string;
	status: string;
};

export type PortalShareTarget = {
	id: string;
	publicId: string;
	name: string;
};

function organisationName(row: { legalName: string; tradingName: string | null }): string {
	return row.tradingName ?? row.legalName;
}

export class PortalCollaborationRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listProjects(organisationId: string, memberId: string): Promise<PortalProjectSummary[]> {
		const rows = await this.db
			.selectFrom('projects as project')
			.innerJoin('project_organisations as participation', 'participation.project_id', 'project.id')
			.innerJoin('project_members as member', (join) =>
				join
					.onRef('member.project_id', '=', 'participation.project_id')
					.onRef(
						'member.participant_organisation_id',
						'=',
						'participation.participant_organisation_id'
					)
			)
			.innerJoin('organisations as owner', 'owner.id', 'project.owning_organisation_id')
			.select([
				'project.id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'project.status as projectStatus',
				'project.owning_organisation_id as owningOrganisationId',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName'
			])
			.where('participation.participant_organisation_id', '=', organisationId)
			.where('participation.status', '=', 'active')
			.where('member.organisation_member_id', '=', memberId)
			.where('member.status', '=', 'active')
			.orderBy('project.name', 'asc')
			.execute();

		return rows.map((row) => ({
			id: row.projectId,
			publicId: row.projectPublicId,
			projectNumber: row.projectNumber,
			name: row.projectName,
			status: row.projectStatus,
			owningOrganisationId: row.owningOrganisationId,
			owningOrganisationName: organisationName({
				legalName: row.ownerLegalName,
				tradingName: row.ownerTradingName
			}),
			isOwnedByCurrentOrganisation: row.owningOrganisationId === organisationId
		}));
	}

	async listAssignedRfis(organisationId: string, memberId: string): Promise<PortalRfiTask[]> {
		const rows = await this.db
			.selectFrom('rfi_addressees as assignment')
			.innerJoin('rfis as rfi', 'rfi.id', 'assignment.rfi_id')
			.innerJoin('projects as project', 'project.id', 'assignment.project_id')
			.innerJoin('project_organisations as participation', (join) =>
				join
					.onRef('participation.project_id', '=', 'assignment.project_id')
					.onRef(
						'participation.participant_organisation_id',
						'=',
						'assignment.addressee_organisation_id'
					)
			)
			.innerJoin('project_members as member', (join) =>
				join
					.onRef('member.project_id', '=', 'assignment.project_id')
					.onRef('member.participant_organisation_id', '=', 'assignment.addressee_organisation_id')
			)
			.innerJoin('organisations as owner', 'owner.id', 'rfi.owning_organisation_id')
			.select([
				'rfi.id as rfiId',
				'rfi.public_id as rfiPublicId',
				'rfi.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'rfi.owning_organisation_id as owningOrganisationId',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName',
				'rfi.rfi_number as rfiNumber',
				'rfi.subject as subject',
				'rfi.question as question',
				'rfi.priority as priority',
				'rfi.status as status',
				'rfi.due_at as dueAt',
				'assignment.assigned_at as assignedAt'
			])
			.where('assignment.addressee_organisation_id', '=', organisationId)
			.where('participation.status', '=', 'active')
			.where('member.organisation_member_id', '=', memberId)
			.where('member.status', '=', 'active')
			.where('rfi.status', 'in', ['open', 'reopened', 'answered', 'closed'])
			.orderBy('rfi.due_at', 'asc')
			.orderBy('assignment.assigned_at', 'desc')
			.execute();

		if (rows.length === 0) return [];
		const rfiIds = rows.map((row) => row.rfiId);
		const responses = await this.db
			.selectFrom('rfi_responses')
			.select(['rfi_id', 'response_sequence', 'response_text'])
			.where('responding_organisation_id', '=', organisationId)
			.where('rfi_id', 'in', rfiIds)
			.orderBy('response_sequence', 'asc')
			.execute();
		const responsesByRfi = new Map<string, Array<{ sequence: number; text: string }>>();
		for (const response of responses) {
			const current = responsesByRfi.get(response.rfi_id) ?? [];
			current.push({ sequence: response.response_sequence, text: response.response_text });
			responsesByRfi.set(response.rfi_id, current);
		}

		return rows.map((row) => {
			const ownResponses = responsesByRfi.get(row.rfiId) ?? [];
			return {
				id: row.rfiId,
				publicId: row.rfiPublicId,
				projectId: row.projectId,
				projectPublicId: row.projectPublicId,
				projectNumber: row.projectNumber,
				projectName: row.projectName,
				owningOrganisationId: row.owningOrganisationId,
				owningOrganisationName: organisationName({
					legalName: row.ownerLegalName,
					tradingName: row.ownerTradingName
				}),
				rfiNumber: row.rfiNumber,
				subject: row.subject,
				question: row.question,
				priority: row.priority,
				status: row.status,
				dueAt: row.dueAt,
				assignedAt: row.assignedAt,
				responseCount: ownResponses.length,
				latestResponse: ownResponses.at(-1)?.text ?? null
			};
		});
	}

	async listAssignedSubmittals(
		organisationId: string,
		memberId: string
	): Promise<PortalSubmittalTask[]> {
		const rows = await this.db
			.selectFrom('submittal_reviewers as assignment')
			.innerJoin('submittals as submittal', 'submittal.id', 'assignment.submittal_id')
			.innerJoin('submittal_types as type', 'type.id', 'submittal.submittal_type_id')
			.innerJoin('projects as project', 'project.id', 'assignment.project_id')
			.innerJoin('project_organisations as participation', (join) =>
				join
					.onRef('participation.project_id', '=', 'assignment.project_id')
					.onRef(
						'participation.participant_organisation_id',
						'=',
						'assignment.reviewer_organisation_id'
					)
			)
			.innerJoin('project_members as member', (join) =>
				join
					.onRef('member.project_id', '=', 'assignment.project_id')
					.onRef('member.participant_organisation_id', '=', 'assignment.reviewer_organisation_id')
			)
			.innerJoin('organisations as owner', 'owner.id', 'submittal.owning_organisation_id')
			.select([
				'submittal.id as submittalId',
				'submittal.public_id as submittalPublicId',
				'submittal.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'submittal.owning_organisation_id as owningOrganisationId',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName',
				'submittal.submittal_number as number',
				'type.name as typeName',
				'submittal.title as title',
				'submittal.status as status',
				'submittal.due_at as dueAt',
				'submittal.submitted_at as submittedAt',
				'assignment.due_at as reviewerDueAt',
				'assignment.assigned_at as assignedAt'
			])
			.where('assignment.reviewer_organisation_id', '=', organisationId)
			.where('participation.status', '=', 'active')
			.where('member.organisation_member_id', '=', memberId)
			.where('member.status', '=', 'active')
			.where('submittal.status', 'in', ['submitted', 'under_review', 'reviewed', 'closed'])
			.orderBy('assignment.due_at', 'asc')
			.orderBy('assignment.assigned_at', 'desc')
			.execute();

		if (rows.length === 0) return [];
		const submittalIds = rows.map((row) => row.submittalId);
		const reviews = await this.db
			.selectFrom('submittal_reviews')
			.select(['submittal_id', 'review_sequence', 'outcome'])
			.where('reviewer_organisation_id', '=', organisationId)
			.where('submittal_id', 'in', submittalIds)
			.orderBy('review_sequence', 'asc')
			.execute();
		const reviewsBySubmittal = new Map<string, Array<{ sequence: number; outcome: string }>>();
		for (const review of reviews) {
			const current = reviewsBySubmittal.get(review.submittal_id) ?? [];
			current.push({ sequence: review.review_sequence, outcome: review.outcome });
			reviewsBySubmittal.set(review.submittal_id, current);
		}

		return rows.map((row) => {
			const ownReviews = reviewsBySubmittal.get(row.submittalId) ?? [];
			return {
				id: row.submittalId,
				publicId: row.submittalPublicId,
				projectId: row.projectId,
				projectPublicId: row.projectPublicId,
				projectNumber: row.projectNumber,
				projectName: row.projectName,
				owningOrganisationId: row.owningOrganisationId,
				owningOrganisationName: organisationName({
					legalName: row.ownerLegalName,
					tradingName: row.ownerTradingName
				}),
				number: row.number,
				typeName: row.typeName,
				title: row.title,
				status: row.status,
				dueAt: row.dueAt,
				submittedAt: row.submittedAt,
				reviewerDueAt: row.reviewerDueAt,
				assignedAt: row.assignedAt,
				reviewCount: ownReviews.length,
				latestOutcome: ownReviews.at(-1)?.outcome ?? null
			};
		});
	}

	async listAssignedInstructions(
		organisationId: string,
		memberId: string
	): Promise<PortalInstructionTask[]> {
		const rows = await this.db
			.selectFrom('instruction_recipients as recipient')
			.innerJoin(
				'project_instructions as instruction',
				'instruction.id',
				'recipient.instruction_id'
			)
			.innerJoin('instruction_types as type', 'type.id', 'instruction.instruction_type_id')
			.innerJoin('projects as project', 'project.id', 'recipient.project_id')
			.innerJoin('project_organisations as participation', (join) =>
				join
					.onRef('participation.project_id', '=', 'recipient.project_id')
					.onRef(
						'participation.participant_organisation_id',
						'=',
						'recipient.recipient_organisation_id'
					)
			)
			.innerJoin('project_members as member', (join) =>
				join
					.onRef('member.project_id', '=', 'recipient.project_id')
					.onRef('member.participant_organisation_id', '=', 'recipient.recipient_organisation_id')
			)
			.innerJoin('organisations as issuer', 'issuer.id', 'instruction.issuing_organisation_id')
			.select([
				'instruction.id as instructionId',
				'instruction.public_id as instructionPublicId',
				'instruction.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'instruction.issuing_organisation_id as issuingOrganisationId',
				'issuer.legal_name as issuerLegalName',
				'issuer.trading_name as issuerTradingName',
				'instruction.instruction_number as number',
				'type.name as typeName',
				'instruction.subject as subject',
				'instruction.instruction_text as instructionText',
				'instruction.status as status',
				'instruction.issued_at as issuedAt',
				'recipient.acknowledged_at as acknowledgedAt'
			])
			.where('recipient.recipient_organisation_id', '=', organisationId)
			.where('participation.status', '=', 'active')
			.where('member.organisation_member_id', '=', memberId)
			.where('member.status', '=', 'active')
			.where('instruction.status', 'in', ['issued', 'acknowledged', 'superseded', 'closed'])
			.orderBy('instruction.issued_at', 'desc')
			.execute();

		return rows.map((row) => ({
			id: row.instructionId,
			publicId: row.instructionPublicId,
			projectId: row.projectId,
			projectPublicId: row.projectPublicId,
			projectNumber: row.projectNumber,
			projectName: row.projectName,
			issuingOrganisationId: row.issuingOrganisationId,
			issuingOrganisationName: organisationName({
				legalName: row.issuerLegalName,
				tradingName: row.issuerTradingName
			}),
			number: row.number,
			typeName: row.typeName,
			subject: row.subject,
			instructionText: row.instructionText,
			status: row.status,
			issuedAt: row.issuedAt,
			acknowledgedAt: row.acknowledgedAt
		}));
	}

	async listReceivedTransmittals(
		organisationId: string,
		memberId: string
	): Promise<PortalTransmittalSummary[]> {
		const rows = await this.db
			.selectFrom('transmittal_recipients as recipient')
			.innerJoin('transmittals as transmittal', 'transmittal.id', 'recipient.transmittal_id')
			.innerJoin('projects as project', 'project.id', 'recipient.project_id')
			.innerJoin('project_organisations as participation', (join) =>
				join
					.onRef('participation.project_id', '=', 'recipient.project_id')
					.onRef(
						'participation.participant_organisation_id',
						'=',
						'recipient.recipient_project_organisation_id'
					)
			)
			.innerJoin('project_members as member', (join) =>
				join
					.onRef('member.project_id', '=', 'recipient.project_id')
					.onRef(
						'member.participant_organisation_id',
						'=',
						'recipient.recipient_project_organisation_id'
					)
			)
			.innerJoin('organisations as issuer', 'issuer.id', 'transmittal.issuing_organisation_id')
			.select([
				'transmittal.id as transmittalId',
				'transmittal.public_id as transmittalPublicId',
				'transmittal.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'transmittal.issuing_organisation_id as issuingOrganisationId',
				'issuer.legal_name as issuerLegalName',
				'issuer.trading_name as issuerTradingName',
				'transmittal.transmittal_number as transmittalNumber',
				'transmittal.subject as subject',
				'transmittal.purpose as purpose',
				'transmittal.issued_at as issuedAt',
				'recipient.delivery_status as deliveryStatus',
				'recipient.delivered_at as deliveredAt'
			])
			.where('recipient.recipient_project_organisation_id', '=', organisationId)
			.where('participation.status', '=', 'active')
			.where('member.organisation_member_id', '=', memberId)
			.where('member.status', '=', 'active')
			.orderBy('transmittal.issued_at', 'desc')
			.execute();

		if (rows.length === 0) return [];
		const transmittalIds = rows.map((row) => row.transmittalId);
		const items = await this.db
			.selectFrom('transmittal_items as item')
			.innerJoin(
				'information_container_versions as version',
				'version.id',
				'item.information_container_version_id'
			)
			.innerJoin(
				'information_containers as container',
				'container.id',
				'version.information_container_id'
			)
			.select([
				'item.transmittal_id as transmittalId',
				'item.sort_order as sortOrder',
				'version.public_id as versionPublicId',
				'container.container_number as containerNumber',
				'container.title as title',
				'version.revision_code as revisionCode',
				'version.version_status as versionStatus'
			])
			.where('item.transmittal_id', 'in', transmittalIds)
			.orderBy('item.transmittal_id', 'asc')
			.orderBy('item.sort_order', 'asc')
			.execute();
		const itemsByTransmittal = new Map<string, PortalTransmittalItem[]>();
		for (const item of items) {
			const current = itemsByTransmittal.get(item.transmittalId) ?? [];
			current.push({
				versionPublicId: item.versionPublicId,
				containerNumber: item.containerNumber,
				title: item.title,
				revisionCode: item.revisionCode,
				versionStatus: item.versionStatus
			});
			itemsByTransmittal.set(item.transmittalId, current);
		}

		return rows.map((row) => ({
			id: row.transmittalId,
			publicId: row.transmittalPublicId,
			projectId: row.projectId,
			projectPublicId: row.projectPublicId,
			projectNumber: row.projectNumber,
			projectName: row.projectName,
			issuingOrganisationId: row.issuingOrganisationId,
			issuingOrganisationName: organisationName({
				legalName: row.issuerLegalName,
				tradingName: row.issuerTradingName
			}),
			transmittalNumber: row.transmittalNumber,
			subject: row.subject,
			purpose: row.purpose,
			issuedAt: row.issuedAt,
			deliveryStatus: row.deliveryStatus,
			deliveredAt: row.deliveredAt,
			items: itemsByTransmittal.get(row.transmittalId) ?? []
		}));
	}

	async findAssignedRfiForUpdate(
		organisationId: string,
		memberId: string,
		publicId: string
	): Promise<LockedPortalRfi | null> {
		const row = await this.db
			.selectFrom('rfi_addressees as assignment')
			.innerJoin('rfis as rfi', 'rfi.id', 'assignment.rfi_id')
			.innerJoin('project_organisations as participation', (join) =>
				join
					.onRef('participation.project_id', '=', 'assignment.project_id')
					.onRef(
						'participation.participant_organisation_id',
						'=',
						'assignment.addressee_organisation_id'
					)
			)
			.innerJoin('project_members as member', (join) =>
				join
					.onRef('member.project_id', '=', 'assignment.project_id')
					.onRef('member.participant_organisation_id', '=', 'assignment.addressee_organisation_id')
			)
			.select([
				'rfi.id',
				'rfi.public_id as publicId',
				'rfi.project_id as projectId',
				'rfi.owning_organisation_id as owningOrganisationId',
				'rfi.status'
			])
			.where('assignment.addressee_organisation_id', '=', organisationId)
			.where('member.organisation_member_id', '=', memberId)
			.where('member.status', '=', 'active')
			.where('participation.status', '=', 'active')
			.where('rfi.public_id', '=', publicId)
			.forUpdate()
			.executeTakeFirst();
		return row ?? null;
	}

	async nextRfiResponseSequence(rfiId: string, organisationId: string): Promise<number> {
		const row = await this.db
			.selectFrom('rfi_responses')
			.select('response_sequence')
			.where('rfi_id', '=', rfiId)
			.where('responding_organisation_id', '=', organisationId)
			.orderBy('response_sequence', 'desc')
			.limit(1)
			.executeTakeFirst();
		return (row?.response_sequence ?? 0) + 1;
	}

	async insertRfiResponse(input: {
		projectId: string;
		rfiId: string;
		rfiOwnerOrganisationId: string;
		respondingOrganisationId: string;
		sequence: number;
		responseText: string;
		memberId: string;
		final: boolean;
	}): Promise<void> {
		await this.db
			.insertInto('rfi_responses')
			.values({
				project_id: input.projectId,
				rfi_id: input.rfiId,
				rfi_owner_organisation_id: input.rfiOwnerOrganisationId,
				responding_organisation_id: input.respondingOrganisationId,
				response_sequence: input.sequence,
				response_text: input.responseText,
				responded_by_member_id: input.memberId,
				is_final_response: input.final ? 1 : 0
			})
			.executeTakeFirstOrThrow();
	}

	async markRfiAnswered(rfiId: string): Promise<boolean> {
		const result = await this.db
			.updateTable('rfis')
			.set({ status: 'answered' })
			.where('id', '=', rfiId)
			.where('status', 'in', ['open', 'reopened'])
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async findAssignedSubmittalForUpdate(
		organisationId: string,
		memberId: string,
		publicId: string
	): Promise<LockedPortalSubmittal | null> {
		const row = await this.db
			.selectFrom('submittal_reviewers as assignment')
			.innerJoin('submittals as submittal', 'submittal.id', 'assignment.submittal_id')
			.innerJoin('project_organisations as participation', (join) =>
				join
					.onRef('participation.project_id', '=', 'assignment.project_id')
					.onRef(
						'participation.participant_organisation_id',
						'=',
						'assignment.reviewer_organisation_id'
					)
			)
			.innerJoin('project_members as member', (join) =>
				join
					.onRef('member.project_id', '=', 'assignment.project_id')
					.onRef('member.participant_organisation_id', '=', 'assignment.reviewer_organisation_id')
			)
			.select([
				'submittal.id',
				'submittal.public_id as publicId',
				'submittal.project_id as projectId',
				'submittal.owning_organisation_id as owningOrganisationId',
				'submittal.status'
			])
			.where('assignment.reviewer_organisation_id', '=', organisationId)
			.where('member.organisation_member_id', '=', memberId)
			.where('member.status', '=', 'active')
			.where('participation.status', '=', 'active')
			.where('submittal.public_id', '=', publicId)
			.forUpdate()
			.executeTakeFirst();
		return row ?? null;
	}

	async nextSubmittalReviewSequence(submittalId: string, organisationId: string): Promise<number> {
		const row = await this.db
			.selectFrom('submittal_reviews')
			.select('review_sequence')
			.where('submittal_id', '=', submittalId)
			.where('reviewer_organisation_id', '=', organisationId)
			.orderBy('review_sequence', 'desc')
			.limit(1)
			.executeTakeFirst();
		return (row?.review_sequence ?? 0) + 1;
	}

	async insertSubmittalReview(input: {
		submittalId: string;
		organisationId: string;
		sequence: number;
		outcome: string;
		comments: string | null;
		memberId: string;
	}): Promise<void> {
		await this.db
			.insertInto('submittal_reviews')
			.values({
				submittal_id: input.submittalId,
				reviewer_organisation_id: input.organisationId,
				review_sequence: input.sequence,
				outcome: input.outcome,
				comments: input.comments,
				reviewed_by_member_id: input.memberId
			})
			.executeTakeFirstOrThrow();
	}

	async markSubmittalReviewed(submittalId: string): Promise<boolean> {
		const result = await this.db
			.updateTable('submittals')
			.set({ status: 'reviewed' })
			.where('id', '=', submittalId)
			.where('status', 'in', ['submitted', 'under_review'])
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async findAssignedInstructionForUpdate(
		organisationId: string,
		memberId: string,
		publicId: string
	): Promise<LockedPortalInstruction | null> {
		const row = await this.db
			.selectFrom('instruction_recipients as recipient')
			.innerJoin(
				'project_instructions as instruction',
				'instruction.id',
				'recipient.instruction_id'
			)
			.innerJoin('project_organisations as participation', (join) =>
				join
					.onRef('participation.project_id', '=', 'recipient.project_id')
					.onRef(
						'participation.participant_organisation_id',
						'=',
						'recipient.recipient_organisation_id'
					)
			)
			.innerJoin('project_members as member', (join) =>
				join
					.onRef('member.project_id', '=', 'recipient.project_id')
					.onRef('member.participant_organisation_id', '=', 'recipient.recipient_organisation_id')
			)
			.select([
				'instruction.id',
				'instruction.public_id as publicId',
				'instruction.project_id as projectId',
				'instruction.issuing_organisation_id as issuingOrganisationId',
				'instruction.status'
			])
			.where('recipient.recipient_organisation_id', '=', organisationId)
			.where('recipient.acknowledged_at', 'is', null)
			.where('member.organisation_member_id', '=', memberId)
			.where('member.status', '=', 'active')
			.where('participation.status', '=', 'active')
			.where('instruction.public_id', '=', publicId)
			.forUpdate()
			.executeTakeFirst();
		return row ?? null;
	}

	async acknowledgeInstruction(
		instructionId: string,
		organisationId: string,
		memberId: string,
		at: Date
	): Promise<boolean> {
		const result = await this.db
			.updateTable('instruction_recipients')
			.set({ acknowledged_by_member_id: memberId, acknowledged_at: at })
			.where('instruction_id', '=', instructionId)
			.where('recipient_organisation_id', '=', organisationId)
			.where('acknowledged_at', 'is', null)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async markInstructionAcknowledgedWhenComplete(instructionId: string): Promise<void> {
		const remaining = await this.db
			.selectFrom('instruction_recipients')
			.select('instruction_id')
			.where('instruction_id', '=', instructionId)
			.where('acknowledged_at', 'is', null)
			.limit(1)
			.executeTakeFirst();
		if (remaining) return;
		await this.db
			.updateTable('project_instructions')
			.set({ status: 'acknowledged' })
			.where('id', '=', instructionId)
			.where('status', '=', 'issued')
			.execute();
	}

	async findActiveShareTarget(
		projectId: string,
		organisationPublicId: string
	): Promise<PortalShareTarget | null> {
		const row = await this.db
			.selectFrom('project_organisations as participation')
			.innerJoin(
				'organisations as organisation',
				'organisation.id',
				'participation.participant_organisation_id'
			)
			.select([
				'organisation.id',
				'organisation.public_id as publicId',
				'organisation.legal_name as legalName',
				'organisation.trading_name as tradingName'
			])
			.where('participation.project_id', '=', projectId)
			.where('participation.status', '=', 'active')
			.where('organisation.public_id', '=', organisationPublicId)
			.executeTakeFirst();
		if (!row) return null;
		return {
			id: row.id,
			publicId: row.publicId,
			name: organisationName({ legalName: row.legalName, tradingName: row.tradingName })
		};
	}

	async listManageRfis(organisationId: string, projectId: string): Promise<PortalManageRfi[]> {
		return this.db
			.selectFrom('rfis')
			.select([
				'id',
				'public_id as publicId',
				'rfi_number as rfiNumber',
				'subject',
				'status',
				'due_at as dueAt'
			])
			.where('project_id', '=', projectId)
			.where('owning_organisation_id', '=', organisationId)
			.where('status', 'in', ['open', 'reopened'])
			.orderBy('due_at', 'asc')
			.execute();
	}

	async listManageSubmittals(
		organisationId: string,
		projectId: string
	): Promise<PortalManageSubmittal[]> {
		const rows = await this.db
			.selectFrom('submittals')
			.select([
				'id',
				'public_id as publicId',
				'submittal_number as number',
				'title',
				'status',
				'due_at as dueAt'
			])
			.where('project_id', '=', projectId)
			.where('owning_organisation_id', '=', organisationId)
			.where('status', 'in', ['submitted', 'under_review'])
			.orderBy('due_at', 'asc')
			.execute();
		return rows;
	}

	async listManageInstructions(
		organisationId: string,
		projectId: string
	): Promise<PortalManageInstruction[]> {
		return this.db
			.selectFrom('project_instructions')
			.select([
				'id',
				'public_id as publicId',
				'instruction_number as number',
				'subject',
				'status',
				'issued_at as issuedAt'
			])
			.where('project_id', '=', projectId)
			.where('issuing_organisation_id', '=', organisationId)
			.where('status', 'in', ['issued', 'acknowledged'])
			.orderBy('issued_at', 'desc')
			.execute();
	}

	async listManageVersions(
		organisationId: string,
		projectId: string
	): Promise<PortalManageVersion[]> {
		const rows = await this.db
			.selectFrom('information_container_versions as version')
			.innerJoin(
				'information_containers as container',
				'container.id',
				'version.information_container_id'
			)
			.select([
				'version.id',
				'version.public_id as publicId',
				'container.container_number as containerNumber',
				'container.title as title',
				'version.revision_code as revisionCode',
				'version.version_status as status'
			])
			.where('version.project_id', '=', projectId)
			.where('version.owning_organisation_id', '=', organisationId)
			.where('version.version_status', 'in', ['issued', 'superseded'])
			.orderBy('container.container_number', 'asc')
			.orderBy('version.version_sequence', 'desc')
			.execute();
		return rows;
	}

	async findOwnedRfiForUpdate(
		organisationId: string,
		projectId: string,
		publicId: string
	): Promise<LockedPortalRfi | null> {
		const row = await this.db
			.selectFrom('rfis')
			.select([
				'id',
				'public_id as publicId',
				'project_id as projectId',
				'owning_organisation_id as owningOrganisationId',
				'status'
			])
			.where('project_id', '=', projectId)
			.where('owning_organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.forUpdate()
			.executeTakeFirst();
		return row ?? null;
	}

	async addRfiAddressee(input: {
		projectId: string;
		rfiId: string;
		rfiOwnerOrganisationId: string;
		addresseeOrganisationId: string;
	}): Promise<boolean> {
		const existing = await this.db
			.selectFrom('rfi_addressees')
			.select('rfi_id')
			.where('rfi_id', '=', input.rfiId)
			.where('addressee_organisation_id', '=', input.addresseeOrganisationId)
			.executeTakeFirst();
		if (existing) return false;
		await this.db
			.insertInto('rfi_addressees')
			.values({
				project_id: input.projectId,
				rfi_id: input.rfiId,
				rfi_owner_organisation_id: input.rfiOwnerOrganisationId,
				addressee_organisation_id: input.addresseeOrganisationId
			})
			.executeTakeFirstOrThrow();
		return true;
	}

	async findOwnedSubmittalForUpdate(
		organisationId: string,
		projectId: string,
		publicId: string
	): Promise<LockedPortalSubmittal | null> {
		const row = await this.db
			.selectFrom('submittals')
			.select([
				'id',
				'public_id as publicId',
				'project_id as projectId',
				'owning_organisation_id as owningOrganisationId',
				'status'
			])
			.where('project_id', '=', projectId)
			.where('owning_organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.forUpdate()
			.executeTakeFirst();
		return row ?? null;
	}

	async addSubmittalReviewer(input: {
		projectId: string;
		submittalId: string;
		submittalOwnerOrganisationId: string;
		reviewerOrganisationId: string;
		dueAt: Date | null;
	}): Promise<boolean> {
		const existing = await this.db
			.selectFrom('submittal_reviewers')
			.select('submittal_id')
			.where('submittal_id', '=', input.submittalId)
			.where('reviewer_organisation_id', '=', input.reviewerOrganisationId)
			.executeTakeFirst();
		if (existing) return false;
		await this.db
			.insertInto('submittal_reviewers')
			.values({
				project_id: input.projectId,
				submittal_id: input.submittalId,
				submittal_owner_organisation_id: input.submittalOwnerOrganisationId,
				reviewer_organisation_id: input.reviewerOrganisationId,
				due_at: input.dueAt
			})
			.executeTakeFirstOrThrow();
		return true;
	}

	async findOwnedInstructionForUpdate(
		organisationId: string,
		projectId: string,
		publicId: string
	): Promise<LockedPortalInstruction | null> {
		const row = await this.db
			.selectFrom('project_instructions')
			.select([
				'id',
				'public_id as publicId',
				'project_id as projectId',
				'issuing_organisation_id as issuingOrganisationId',
				'status'
			])
			.where('project_id', '=', projectId)
			.where('issuing_organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.forUpdate()
			.executeTakeFirst();
		return row ?? null;
	}

	async addInstructionRecipient(input: {
		projectId: string;
		instructionId: string;
		issuingOrganisationId: string;
		recipientOrganisationId: string;
	}): Promise<boolean> {
		const existing = await this.db
			.selectFrom('instruction_recipients')
			.select('instruction_id')
			.where('instruction_id', '=', input.instructionId)
			.where('recipient_organisation_id', '=', input.recipientOrganisationId)
			.executeTakeFirst();
		if (existing) return false;
		await this.db
			.insertInto('instruction_recipients')
			.values({
				instruction_id: input.instructionId,
				project_id: input.projectId,
				issuing_organisation_id: input.issuingOrganisationId,
				recipient_organisation_id: input.recipientOrganisationId,
				acknowledged_by_member_id: null,
				acknowledged_at: null
			})
			.executeTakeFirstOrThrow();
		return true;
	}

	async findOwnedIssuedVersion(
		organisationId: string,
		projectId: string,
		publicId: string
	): Promise<PortalManageVersion | null> {
		const row = await this.db
			.selectFrom('information_container_versions as version')
			.innerJoin(
				'information_containers as container',
				'container.id',
				'version.information_container_id'
			)
			.select([
				'version.id',
				'version.public_id as publicId',
				'container.container_number as containerNumber',
				'container.title as title',
				'version.revision_code as revisionCode',
				'version.version_status as status'
			])
			.where('version.project_id', '=', projectId)
			.where('version.owning_organisation_id', '=', organisationId)
			.where('version.public_id', '=', publicId)
			.where('version.version_status', 'in', ['issued', 'superseded'])
			.executeTakeFirst();
		return row ?? null;
	}

	async insertTransmittal(input: {
		projectId: string;
		organisationId: string;
		publicId: string;
		number: string;
		subject: string;
		purpose: string | null;
		memberId: string;
		issuedAt: Date;
		versionId: string;
		recipientOrganisationId: string;
		recipientName: string;
	}): Promise<string> {
		const transmittal = await this.db
			.insertInto('transmittals')
			.values({
				project_id: input.projectId,
				issuing_organisation_id: input.organisationId,
				public_id: input.publicId,
				transmittal_number: input.number,
				subject: input.subject,
				purpose: input.purpose,
				issued_by_member_id: input.memberId,
				issued_at: input.issuedAt
			})
			.executeTakeFirstOrThrow();
		if (transmittal.insertId === undefined) throw new Error('MySQL did not return transmittal ID.');
		const transmittalId = transmittal.insertId.toString();
		await this.db
			.insertInto('transmittal_items')
			.values({
				transmittal_id: transmittalId,
				project_id: input.projectId,
				issuing_organisation_id: input.organisationId,
				information_container_version_id: input.versionId,
				version_owner_organisation_id: input.organisationId,
				sort_order: 1,
				note: null
			})
			.executeTakeFirstOrThrow();
		await this.db
			.insertInto('transmittal_recipients')
			.values({
				transmittal_id: transmittalId,
				project_id: input.projectId,
				issuing_organisation_id: input.organisationId,
				recipient_project_organisation_id: input.recipientOrganisationId,
				source_party_id: null,
				source_party_owner_organisation_id: null,
				recipient_name: input.recipientName,
				recipient_email: null,
				delivery_status: 'delivered',
				delivered_at: input.issuedAt
			})
			.executeTakeFirstOrThrow();
		return transmittalId;
	}
}
