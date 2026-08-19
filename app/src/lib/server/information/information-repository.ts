import type { DatabaseExecutor } from '$lib/server/db/executor';

export type InformationContainerSummary = {
	id: string;
	projectId: string;
	publicId: string;
	containerNumber: string;
	title: string;
	typeCode: string;
	typeName: string;
	disciplineCode: string | null;
	classificationCode: string | null;
	lifecycleStatus: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
};

export type InformationVersionSummary = {
	id: string;
	containerId: string;
	publicId: string;
	revisionCode: string;
	versionSequence: number;
	titleAtVersion: string;
	purposeCode: string | null;
	suitabilityCode: string | null;
	status: string;
	lockedAt: Date | null;
	createdAt: Date;
};

export type InformationFileSummary = {
	id: string;
	versionId: string;
	fileRole: string;
	storageProvider: string;
	storageBucket: string;
	storageKey: string;
	originalFilename: string;
	contentType: string | null;
	sizeBytes: string;
	checksumAlgorithm: string;
	checksumValue: string;
	malwareScanStatus: string;
	createdAt: Date;
};

export type RfiSummary = {
	id: string;
	projectId: string;
	publicId: string;
	rfiNumber: string;
	subject: string;
	question: string;
	priority: string;
	status: string;
	dueAt: Date | null;
	openedAt: Date | null;
	closedAt: Date | null;
	createdByMemberId: string;
	projectNumber: string;
	projectName: string;
};

export type SubmittalSummary = {
	id: string;
	projectId: string;
	publicId: string;
	submittalNumber: string;
	typeCode: string;
	typeName: string;
	title: string;
	status: string;
	dueAt: Date | null;
	submittedAt: Date | null;
	createdByMemberId: string;
	projectNumber: string;
	projectName: string;
};

export type InstructionSummary = {
	id: string;
	projectId: string;
	publicId: string;
	instructionNumber: string;
	typeCode: string;
	typeName: string;
	subject: string;
	instructionText: string;
	status: string;
	issuedAt: Date | null;
	issuedByMemberId: string;
	projectNumber: string;
	projectName: string;
};

function insertedId(result: { insertId?: bigint }, label: string): string {
	if (result.insertId === undefined)
		throw new Error(`MySQL did not return the inserted ${label} ID.`);
	return result.insertId.toString();
}

export class InformationRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listContainerTypes() {
		return this.db
			.selectFrom('information_container_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listPurposeCodes() {
		return this.db
			.selectFrom('information_purpose_codes')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('code')
			.execute();
	}

	async listSubmittalTypes() {
		return this.db
			.selectFrom('submittal_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listInstructionTypes() {
		return this.db
			.selectFrom('instruction_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async findContainerTypeByCode(code: string) {
		return this.db
			.selectFrom('information_container_types')
			.select(['id', 'code', 'name'])
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
	}

	async findPurposeByCode(code: string) {
		return this.db
			.selectFrom('information_purpose_codes')
			.select(['id', 'code', 'name'])
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
	}

	async findSubmittalTypeByCode(code: string) {
		return this.db
			.selectFrom('submittal_types')
			.select(['id', 'code', 'name'])
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
	}

	async findInstructionTypeByCode(code: string) {
		return this.db
			.selectFrom('instruction_types')
			.select(['id', 'code', 'name'])
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
	}

	async listContainers(organisationId: string): Promise<InformationContainerSummary[]> {
		const rows = await this.db
			.selectFrom('information_containers as container')
			.innerJoin(
				'information_container_types as type',
				'type.id',
				'container.information_container_type_id'
			)
			.innerJoin('projects as project', 'project.id', 'container.project_id')
			.select([
				'container.id as id',
				'container.project_id as projectId',
				'container.public_id as publicId',
				'container.container_number as containerNumber',
				'container.title as title',
				'type.code as typeCode',
				'type.name as typeName',
				'container.discipline_code as disciplineCode',
				'container.classification_code as classificationCode',
				'container.lifecycle_status as lifecycleStatus',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName'
			])
			.where('container.owning_organisation_id', '=', organisationId)
			.orderBy('container.updated_at', 'desc')
			.orderBy('container.id', 'desc')
			.execute();
		return rows;
	}

	async findContainerByPublicId(
		organisationId: string,
		publicId: string
	): Promise<InformationContainerSummary | null> {
		const row = await this.db
			.selectFrom('information_containers as container')
			.innerJoin(
				'information_container_types as type',
				'type.id',
				'container.information_container_type_id'
			)
			.innerJoin('projects as project', 'project.id', 'container.project_id')
			.select([
				'container.id as id',
				'container.project_id as projectId',
				'container.public_id as publicId',
				'container.container_number as containerNumber',
				'container.title as title',
				'type.code as typeCode',
				'type.name as typeName',
				'container.discipline_code as disciplineCode',
				'container.classification_code as classificationCode',
				'container.lifecycle_status as lifecycleStatus',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName'
			])
			.where('container.owning_organisation_id', '=', organisationId)
			.where('container.public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async insertContainer(input: {
		projectId: string;
		organisationId: string;
		publicId: string;
		typeId: number;
		containerNumber: string;
		title: string;
		disciplineCode: string | null;
		classificationCode: string | null;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('information_containers')
			.values({
				project_id: input.projectId,
				owning_organisation_id: input.organisationId,
				public_id: input.publicId,
				information_container_type_id: input.typeId,
				project_site_id: null,
				container_number: input.containerNumber,
				title: input.title,
				discipline_code: input.disciplineCode,
				classification_code: input.classificationCode,
				lifecycle_status: 'active',
				created_by_member_id: input.createdByMemberId
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'information container');
	}

	async listVersions(
		containerId: string,
		organisationId: string
	): Promise<InformationVersionSummary[]> {
		const rows = await this.db
			.selectFrom('information_container_versions as version')
			.leftJoin(
				'information_purpose_codes as purpose',
				'purpose.id',
				'version.information_purpose_code_id'
			)
			.select([
				'version.id as id',
				'version.information_container_id as containerId',
				'version.public_id as publicId',
				'version.revision_code as revisionCode',
				'version.version_sequence as versionSequence',
				'version.title_at_version as titleAtVersion',
				'purpose.code as purposeCode',
				'version.suitability_code as suitabilityCode',
				'version.version_status as status',
				'version.locked_at as lockedAt',
				'version.created_at as createdAt'
			])
			.where('version.information_container_id', '=', containerId)
			.where('version.owning_organisation_id', '=', organisationId)
			.orderBy('version.version_sequence', 'desc')
			.execute();
		return rows;
	}

	async findVersionByPublicId(
		organisationId: string,
		publicId: string
	): Promise<InformationVersionSummary | null> {
		const row = await this.db
			.selectFrom('information_container_versions as version')
			.leftJoin(
				'information_purpose_codes as purpose',
				'purpose.id',
				'version.information_purpose_code_id'
			)
			.select([
				'version.id as id',
				'version.information_container_id as containerId',
				'version.public_id as publicId',
				'version.revision_code as revisionCode',
				'version.version_sequence as versionSequence',
				'version.title_at_version as titleAtVersion',
				'purpose.code as purposeCode',
				'version.suitability_code as suitabilityCode',
				'version.version_status as status',
				'version.locked_at as lockedAt',
				'version.created_at as createdAt'
			])
			.where('version.owning_organisation_id', '=', organisationId)
			.where('version.public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async nextVersionSequence(containerId: string, organisationId: string): Promise<number> {
		const row = await this.db
			.selectFrom('information_container_versions')
			.select((eb) => eb.fn.max<number>('version_sequence').as('maxSequence'))
			.where('information_container_id', '=', containerId)
			.where('owning_organisation_id', '=', organisationId)
			.executeTakeFirst();
		return Number(row?.maxSequence ?? 0) + 1;
	}

	async insertVersion(input: {
		containerId: string;
		projectId: string;
		organisationId: string;
		publicId: string;
		revisionCode: string;
		versionSequence: number;
		titleAtVersion: string;
		purposeId: number | null;
		suitabilityCode: string | null;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('information_container_versions')
			.values({
				information_container_id: input.containerId,
				project_id: input.projectId,
				owning_organisation_id: input.organisationId,
				public_id: input.publicId,
				revision_code: input.revisionCode,
				version_sequence: input.versionSequence,
				title_at_version: input.titleAtVersion,
				information_purpose_code_id: input.purposeId,
				suitability_code: input.suitabilityCode,
				version_status: 'draft',
				created_by_member_id: input.createdByMemberId,
				locked_by_member_id: null,
				locked_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'information version');
	}

	async updateDraftVersion(input: {
		versionId: string;
		organisationId: string;
		titleAtVersion: string;
		purposeId: number | null;
		suitabilityCode: string | null;
	}): Promise<number> {
		const result = await this.db
			.updateTable('information_container_versions')
			.set({
				title_at_version: input.titleAtVersion,
				information_purpose_code_id: input.purposeId,
				suitability_code: input.suitabilityCode
			})
			.where('id', '=', input.versionId)
			.where('owning_organisation_id', '=', input.organisationId)
			.where('version_status', '=', 'draft')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async listFiles(versionId: string, organisationId: string): Promise<InformationFileSummary[]> {
		const rows = await this.db
			.selectFrom('information_files')
			.select([
				'id',
				'information_container_version_id as versionId',
				'file_role as fileRole',
				'storage_provider as storageProvider',
				'storage_bucket as storageBucket',
				'storage_key as storageKey',
				'original_filename as originalFilename',
				'content_type as contentType',
				'size_bytes as sizeBytes',
				'checksum_algorithm as checksumAlgorithm',
				'checksum_value as checksumValue',
				'malware_scan_status as malwareScanStatus',
				'created_at as createdAt'
			])
			.where('information_container_version_id', '=', versionId)
			.where('owning_organisation_id', '=', organisationId)
			.orderBy('id')
			.execute();
		return rows;
	}

	async insertFile(input: {
		versionId: string;
		organisationId: string;
		fileRole: string;
		storageProvider: string;
		storageBucket: string;
		storageKey: string;
		originalFilename: string;
		contentType: string | null;
		sizeBytes: string;
		checksumAlgorithm: string;
		checksumValue: string;
		malwareScanStatus: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('information_files')
			.values({
				information_container_version_id: input.versionId,
				owning_organisation_id: input.organisationId,
				file_role: input.fileRole,
				storage_provider: input.storageProvider,
				storage_bucket: input.storageBucket,
				storage_key: input.storageKey,
				original_filename: input.originalFilename,
				content_type: input.contentType,
				size_bytes: input.sizeBytes,
				checksum_algorithm: input.checksumAlgorithm,
				checksum_value: input.checksumValue,
				malware_scan_status: input.malwareScanStatus
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'information file');
	}

	async issueVersion(input: {
		versionId: string;
		organisationId: string;
		memberId: string;
	}): Promise<number> {
		const result = await this.db
			.updateTable('information_container_versions')
			.set({ version_status: 'issued', locked_by_member_id: input.memberId, locked_at: new Date() })
			.where('id', '=', input.versionId)
			.where('owning_organisation_id', '=', input.organisationId)
			.where('version_status', '=', 'draft')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async nextIssueSequence(versionId: string, issuingOrganisationId: string): Promise<number> {
		const row = await this.db
			.selectFrom('information_version_issue_events')
			.select((eb) => eb.fn.max<number>('issue_sequence').as('maxSequence'))
			.where('information_container_version_id', '=', versionId)
			.where('issuing_organisation_id', '=', issuingOrganisationId)
			.executeTakeFirst();
		return Number(row?.maxSequence ?? 0) + 1;
	}

	async insertIssueEvent(input: {
		projectId: string;
		organisationId: string;
		versionId: string;
		issueSequence: number;
		memberId: string;
		channel: string;
		note: string | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('information_version_issue_events')
			.values({
				project_id: input.projectId,
				issuing_organisation_id: input.organisationId,
				information_container_version_id: input.versionId,
				version_owner_organisation_id: input.organisationId,
				issue_sequence: input.issueSequence,
				issued_by_member_id: input.memberId,
				issue_channel: input.channel,
				note: input.note
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'issue event');
	}

	async listRfis(organisationId: string): Promise<RfiSummary[]> {
		const rows = await this.db
			.selectFrom('rfis as rfi')
			.innerJoin('projects as project', 'project.id', 'rfi.project_id')
			.select([
				'rfi.id as id',
				'rfi.project_id as projectId',
				'rfi.public_id as publicId',
				'rfi.rfi_number as rfiNumber',
				'rfi.subject as subject',
				'rfi.question as question',
				'rfi.priority as priority',
				'rfi.status as status',
				'rfi.due_at as dueAt',
				'rfi.opened_at as openedAt',
				'rfi.closed_at as closedAt',
				'rfi.created_by_member_id as createdByMemberId',
				'project.project_number as projectNumber',
				'project.name as projectName'
			])
			.where('rfi.owning_organisation_id', '=', organisationId)
			.orderBy('rfi.updated_at', 'desc')
			.execute();
		return rows;
	}

	async findRfiByPublicId(organisationId: string, publicId: string): Promise<RfiSummary | null> {
		const row = await this.db
			.selectFrom('rfis as rfi')
			.innerJoin('projects as project', 'project.id', 'rfi.project_id')
			.select([
				'rfi.id as id',
				'rfi.project_id as projectId',
				'rfi.public_id as publicId',
				'rfi.rfi_number as rfiNumber',
				'rfi.subject as subject',
				'rfi.question as question',
				'rfi.priority as priority',
				'rfi.status as status',
				'rfi.due_at as dueAt',
				'rfi.opened_at as openedAt',
				'rfi.closed_at as closedAt',
				'rfi.created_by_member_id as createdByMemberId',
				'project.project_number as projectNumber',
				'project.name as projectName'
			])
			.where('rfi.owning_organisation_id', '=', organisationId)
			.where('rfi.public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async insertRfi(input: {
		projectId: string;
		organisationId: string;
		publicId: string;
		rfiNumber: string;
		subject: string;
		question: string;
		priority: string;
		dueAt: Date | null;
		memberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('rfis')
			.values({
				project_id: input.projectId,
				owning_organisation_id: input.organisationId,
				public_id: input.publicId,
				rfi_number: input.rfiNumber,
				subject: input.subject,
				question: input.question,
				priority: input.priority,
				status: 'draft',
				due_at: input.dueAt,
				created_by_member_id: input.memberId,
				opened_at: null,
				closed_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'RFI');
	}

	async openRfi(id: string, organisationId: string): Promise<number> {
		const result = await this.db
			.updateTable('rfis')
			.set({ status: 'open', opened_at: new Date() })
			.where('id', '=', id)
			.where('owning_organisation_id', '=', organisationId)
			.where('status', '=', 'draft')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async nextRfiResponseSequence(rfiId: string, organisationId: string): Promise<number> {
		const row = await this.db
			.selectFrom('rfi_responses')
			.select((eb) => eb.fn.max<number>('response_sequence').as('maxSequence'))
			.where('rfi_id', '=', rfiId)
			.where('responding_organisation_id', '=', organisationId)
			.executeTakeFirst();
		return Number(row?.maxSequence ?? 0) + 1;
	}

	async insertRfiResponse(input: {
		projectId: string;
		rfiId: string;
		organisationId: string;
		responseSequence: number;
		responseText: string;
		memberId: string;
		isFinal: boolean;
	}): Promise<string> {
		const result = await this.db
			.insertInto('rfi_responses')
			.values({
				project_id: input.projectId,
				rfi_id: input.rfiId,
				rfi_owner_organisation_id: input.organisationId,
				responding_organisation_id: input.organisationId,
				response_sequence: input.responseSequence,
				response_text: input.responseText,
				responded_by_member_id: input.memberId,
				is_final_response: input.isFinal ? 1 : 0
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'RFI response');
	}

	async markRfiAnswered(id: string, organisationId: string): Promise<void> {
		await this.db
			.updateTable('rfis')
			.set({ status: 'answered' })
			.where('id', '=', id)
			.where('owning_organisation_id', '=', organisationId)
			.where('status', 'in', ['open', 'reopened'])
			.execute();
	}

	async closeRfi(id: string, organisationId: string): Promise<number> {
		const result = await this.db
			.updateTable('rfis')
			.set({ status: 'closed', closed_at: new Date() })
			.where('id', '=', id)
			.where('owning_organisation_id', '=', organisationId)
			.where('status', '=', 'answered')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async listSubmittals(organisationId: string): Promise<SubmittalSummary[]> {
		const rows = await this.db
			.selectFrom('submittals as submittal')
			.innerJoin('submittal_types as type', 'type.id', 'submittal.submittal_type_id')
			.innerJoin('projects as project', 'project.id', 'submittal.project_id')
			.select([
				'submittal.id as id',
				'submittal.project_id as projectId',
				'submittal.public_id as publicId',
				'submittal.submittal_number as submittalNumber',
				'type.code as typeCode',
				'type.name as typeName',
				'submittal.title as title',
				'submittal.status as status',
				'submittal.due_at as dueAt',
				'submittal.submitted_at as submittedAt',
				'submittal.created_by_member_id as createdByMemberId',
				'project.project_number as projectNumber',
				'project.name as projectName'
			])
			.where('submittal.owning_organisation_id', '=', organisationId)
			.orderBy('submittal.updated_at', 'desc')
			.execute();
		return rows;
	}

	async findSubmittalByPublicId(
		organisationId: string,
		publicId: string
	): Promise<SubmittalSummary | null> {
		const row = await this.db
			.selectFrom('submittals as submittal')
			.innerJoin('submittal_types as type', 'type.id', 'submittal.submittal_type_id')
			.innerJoin('projects as project', 'project.id', 'submittal.project_id')
			.select([
				'submittal.id as id',
				'submittal.project_id as projectId',
				'submittal.public_id as publicId',
				'submittal.submittal_number as submittalNumber',
				'type.code as typeCode',
				'type.name as typeName',
				'submittal.title as title',
				'submittal.status as status',
				'submittal.due_at as dueAt',
				'submittal.submitted_at as submittedAt',
				'submittal.created_by_member_id as createdByMemberId',
				'project.project_number as projectNumber',
				'project.name as projectName'
			])
			.where('submittal.owning_organisation_id', '=', organisationId)
			.where('submittal.public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async insertSubmittal(input: {
		projectId: string;
		organisationId: string;
		publicId: string;
		number: string;
		typeId: number;
		title: string;
		dueAt: Date | null;
		memberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('submittals')
			.values({
				project_id: input.projectId,
				owning_organisation_id: input.organisationId,
				public_id: input.publicId,
				submittal_number: input.number,
				submittal_type_id: input.typeId,
				title: input.title,
				status: 'draft',
				due_at: input.dueAt,
				submitted_at: null,
				created_by_member_id: input.memberId
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'submittal');
	}

	async addSubmittalItem(input: {
		submittalId: string;
		organisationId: string;
		versionId: string;
		sortOrder: number;
	}): Promise<void> {
		await this.db
			.insertInto('submittal_items')
			.values({
				submittal_id: input.submittalId,
				submittal_owner_organisation_id: input.organisationId,
				information_container_version_id: input.versionId,
				version_owner_organisation_id: input.organisationId,
				sort_order: input.sortOrder,
				note: null
			})
			.executeTakeFirstOrThrow();
	}

	async submitSubmittal(input: {
		id: string;
		projectId: string;
		organisationId: string;
		dueAt: Date | null;
	}): Promise<number> {
		const result = await this.db
			.updateTable('submittals')
			.set({ status: 'submitted', submitted_at: new Date() })
			.where('id', '=', input.id)
			.where('owning_organisation_id', '=', input.organisationId)
			.where('status', '=', 'draft')
			.executeTakeFirst();
		if (Number(result.numUpdatedRows) === 1) {
			await this.db
				.insertInto('submittal_reviewers')
				.ignore()
				.values({
					project_id: input.projectId,
					submittal_id: input.id,
					submittal_owner_organisation_id: input.organisationId,
					reviewer_organisation_id: input.organisationId,
					due_at: input.dueAt
				})
				.execute();
		}
		return Number(result.numUpdatedRows);
	}

	async nextSubmittalReviewSequence(submittalId: string, organisationId: string): Promise<number> {
		const row = await this.db
			.selectFrom('submittal_reviews')
			.select((eb) => eb.fn.max<number>('review_sequence').as('maxSequence'))
			.where('submittal_id', '=', submittalId)
			.where('reviewer_organisation_id', '=', organisationId)
			.executeTakeFirst();
		return Number(row?.maxSequence ?? 0) + 1;
	}

	async insertSubmittalReview(input: {
		submittalId: string;
		organisationId: string;
		reviewSequence: number;
		outcome: string;
		comments: string | null;
		memberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('submittal_reviews')
			.values({
				submittal_id: input.submittalId,
				reviewer_organisation_id: input.organisationId,
				review_sequence: input.reviewSequence,
				outcome: input.outcome,
				comments: input.comments,
				reviewed_by_member_id: input.memberId
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'submittal review');
	}

	async markSubmittalReviewed(id: string, organisationId: string): Promise<void> {
		await this.db
			.updateTable('submittals')
			.set({ status: 'reviewed' })
			.where('id', '=', id)
			.where('owning_organisation_id', '=', organisationId)
			.where('status', 'in', ['submitted', 'under_review'])
			.execute();
	}

	async listInstructions(organisationId: string): Promise<InstructionSummary[]> {
		const rows = await this.db
			.selectFrom('project_instructions as instruction')
			.innerJoin('instruction_types as type', 'type.id', 'instruction.instruction_type_id')
			.innerJoin('projects as project', 'project.id', 'instruction.project_id')
			.select([
				'instruction.id as id',
				'instruction.project_id as projectId',
				'instruction.public_id as publicId',
				'instruction.instruction_number as instructionNumber',
				'type.code as typeCode',
				'type.name as typeName',
				'instruction.subject as subject',
				'instruction.instruction_text as instructionText',
				'instruction.status as status',
				'instruction.issued_at as issuedAt',
				'instruction.issued_by_member_id as issuedByMemberId',
				'project.project_number as projectNumber',
				'project.name as projectName'
			])
			.where('instruction.issuing_organisation_id', '=', organisationId)
			.orderBy('instruction.updated_at', 'desc')
			.execute();
		return rows;
	}

	async findInstructionByPublicId(
		organisationId: string,
		publicId: string
	): Promise<InstructionSummary | null> {
		const row = await this.db
			.selectFrom('project_instructions as instruction')
			.innerJoin('instruction_types as type', 'type.id', 'instruction.instruction_type_id')
			.innerJoin('projects as project', 'project.id', 'instruction.project_id')
			.select([
				'instruction.id as id',
				'instruction.project_id as projectId',
				'instruction.public_id as publicId',
				'instruction.instruction_number as instructionNumber',
				'type.code as typeCode',
				'type.name as typeName',
				'instruction.subject as subject',
				'instruction.instruction_text as instructionText',
				'instruction.status as status',
				'instruction.issued_at as issuedAt',
				'instruction.issued_by_member_id as issuedByMemberId',
				'project.project_number as projectNumber',
				'project.name as projectName'
			])
			.where('instruction.issuing_organisation_id', '=', organisationId)
			.where('instruction.public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async insertInstruction(input: {
		projectId: string;
		organisationId: string;
		publicId: string;
		number: string;
		typeId: number;
		subject: string;
		instructionText: string;
		memberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_instructions')
			.values({
				project_id: input.projectId,
				issuing_organisation_id: input.organisationId,
				public_id: input.publicId,
				instruction_number: input.number,
				instruction_type_id: input.typeId,
				subject: input.subject,
				instruction_text: input.instructionText,
				status: 'draft',
				issued_by_member_id: input.memberId,
				issued_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'project instruction');
	}

	async issueInstruction(id: string, organisationId: string): Promise<number> {
		const result = await this.db
			.updateTable('project_instructions')
			.set({ status: 'issued', issued_at: new Date() })
			.where('id', '=', id)
			.where('issuing_organisation_id', '=', organisationId)
			.where('status', '=', 'draft')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}
}
