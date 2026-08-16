import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	ContractAccessPolicy,
	ContractValidationError,
	DELIVERY_CHANNELS,
	EXECUTION_METHODS,
	cleanText,
	positiveInt,
	validateCode,
	validateDate,
	validateDateTime,
	validateMoney,
	type AddContractKeyDateInput,
	type AddContractValueInput,
	type ContractExecution,
	type ContractWorkspace,
	type ExecuteContractInput,
	type IssueContractInput,
	type UpdateContractDraftInput
} from './contract-common';

export class ContractLifecycleService {
	private readonly policy: ContractAccessPolicy;

	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {
		this.policy = new ContractAccessPolicy(db);
	}

	private async latestVersion(
		db: DatabaseExecutor,
		organisationId: string,
		contractId: string,
		lock = false
	) {
		let query = db
			.selectFrom('contract_versions')
			.select([
				'id',
				'version_number as versionNumber',
				'title',
				'customer_reference as customerReference',
				'version_status as versionStatus',
				'locked_at as lockedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('contract_id', '=', contractId)
			.orderBy('version_number', 'desc')
			.limit(1);
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}

	async getWorkspace(actor: TenantActorContext, contractPublicIdInput: string): Promise<ContractWorkspace> {
		await this.policy.assertActiveActor(actor);
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		const view = await this.policy.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Contract viewing is not permitted.');

		const contract = await this.db
			.selectFrom('contracts as contract')
			.innerJoin('contract_types as type', 'type.id', 'contract.contract_type_id')
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'contract.project_id')
					.onRef('project.owning_organisation_id', '=', 'contract.organisation_id')
			)
			.leftJoin('quotation_responses as response', (join) =>
				join
					.onRef('response.id', '=', 'contract.source_quotation_response_id')
					.onRef('response.organisation_id', '=', 'contract.organisation_id')
			)
			.leftJoin('quotations as quotation', (join) =>
				join
					.onRef('quotation.id', '=', 'response.quotation_id')
					.onRef('quotation.organisation_id', '=', 'response.organisation_id')
			)
			.select([
				'contract.id as id',
				'contract.public_id as publicId',
				'contract.contract_number as contractNumber',
				'contract.title as title',
				'type.code as contractTypeCode',
				'type.name as contractTypeName',
				'contract.lifecycle_status as lifecycleStatus',
				'contract.currency_code as currencyCode',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'contract.created_at as createdAt',
				'contract.source_quotation_response_id as sourceQuotationResponseId',
				'quotation.quotation_number as sourceQuotationNumber'
			])
			.where('contract.organisation_id', '=', actor.organisationId)
			.where('contract.public_id', '=', contractPublicId)
			.executeTakeFirst();
		if (!contract) throw new RecordNotFoundError('Contract not found.');

		const version = await this.latestVersion(this.db, actor.organisationId, contract.id);
		if (!version) throw new Error('Contract has no version record.');

		const [
			parties,
			valueComponents,
			keyDates,
			issueRows,
			executionRow,
			valueComponentTypes,
			keyDateTypes,
			manageDecision,
			issueDecision,
			executeDecision
		] = await Promise.all([
			this.db
				.selectFrom('contract_version_parties as party')
				.innerJoin('contract_party_role_types as role', 'role.id', 'party.contract_party_role_type_id')
				.select([
					'party.id as id',
					'role.code as roleCode',
					'role.name as roleName',
					'party.display_name as displayName',
					'party.reference_identifier as referenceIdentifier',
					'party.sort_order as sortOrder'
				])
				.where('party.organisation_id', '=', actor.organisationId)
				.where('party.contract_version_id', '=', version.id)
				.orderBy('party.sort_order', 'asc')
				.execute(),
			this.db
				.selectFrom('contract_version_value_components as value')
				.innerJoin('contract_value_component_types as type', 'type.id', 'value.contract_value_component_type_id')
				.select([
					'value.id as id',
					'type.code as typeCode',
					'type.name as typeName',
					'value.description as description',
					'value.amount as amount',
					'value.sort_order as sortOrder'
				])
				.where('value.organisation_id', '=', actor.organisationId)
				.where('value.contract_version_id', '=', version.id)
				.orderBy('value.sort_order', 'asc')
				.execute(),
			this.db
				.selectFrom('contract_version_key_dates as key_date')
				.innerJoin('contract_key_date_types as type', 'type.id', 'key_date.contract_key_date_type_id')
				.select([
					'key_date.id as id',
					'type.code as typeCode',
					'type.name as typeName',
					'key_date.label as label',
					'key_date.date_value as dateValue',
					'key_date.sort_order as sortOrder'
				])
				.where('key_date.organisation_id', '=', actor.organisationId)
				.where('key_date.contract_version_id', '=', version.id)
				.orderBy('key_date.sort_order', 'asc')
				.execute(),
			this.db
				.selectFrom('contract_issue_events as issue')
				.leftJoin('contract_issue_recipients as recipient', (join) =>
					join
						.onRef('recipient.contract_issue_event_id', '=', 'issue.id')
						.onRef('recipient.organisation_id', '=', 'issue.organisation_id')
						.onRef('recipient.contract_version_id', '=', 'issue.contract_version_id')
				)
				.select([
					'issue.id as id',
					'issue.issue_sequence as issueSequence',
					'issue.delivery_channel as deliveryChannel',
					'issue.issued_at as issuedAt',
					'issue.note as note',
					'recipient.recipient_name as recipientName',
					'recipient.recipient_email as recipientEmail',
					'recipient.delivery_status as deliveryStatus'
				])
				.where('issue.organisation_id', '=', actor.organisationId)
				.where('issue.contract_version_id', '=', version.id)
				.orderBy('issue.issue_sequence', 'asc')
				.execute(),
			this.db
				.selectFrom('contract_execution_events')
				.select([
					'id',
					'execution_method as executionMethod',
					'executed_at as executedAt',
					'external_transaction_reference as externalTransactionReference',
					'note'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_version_id', '=', version.id)
				.executeTakeFirst(),
			this.db
				.selectFrom('contract_value_component_types')
				.select(['id', 'code', 'name'])
				.where('is_active', '=', 1)
				.orderBy('name')
				.execute(),
			this.db
				.selectFrom('contract_key_date_types')
				.select(['id', 'code', 'name'])
				.where('is_active', '=', 1)
				.orderBy('name')
				.execute(),
			this.policy.mutationDecision(actor, 'contract.draft.manage'),
			this.policy.mutationDecision(actor, 'contract.issue'),
			this.policy.mutationDecision(actor, 'contract.execute')
		]);

		let execution: ContractExecution | null = null;
		if (executionRow) {
			const signatories = await this.db
				.selectFrom('contract_execution_signatories')
				.select([
					'id',
					'signatory_name as signatoryName',
					'signatory_email as signatoryEmail',
					'signing_role as signingRole',
					'signed_at as signedAt'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_execution_event_id', '=', executionRow.id)
				.orderBy('id', 'asc')
				.execute();
			execution = { ...executionRow, signatories };
		}

		return {
			contract,
			version,
			parties,
			valueComponents,
			keyDates,
			issueEvents: issueRows,
			execution,
			valueComponentTypes,
			keyDateTypes,
			canManageDraft: manageDecision.allowed && version.versionStatus === 'draft',
			canIssue: issueDecision.allowed && version.versionStatus === 'draft',
			canExecute: executeDecision.allowed && version.versionStatus === 'issued'
		};
	}

	private async lockDraftVersion(
		trx: DatabaseExecutor,
		actor: TenantActorContext,
		contractPublicId: string,
		versionNumber: number
	) {
		const contract = await trx
			.selectFrom('contracts')
			.select(['id', 'public_id as publicId', 'title', 'lifecycle_status as lifecycleStatus', 'project_id as projectId'])
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', contractPublicId)
			.forUpdate()
			.executeTakeFirst();
		if (!contract) throw new RecordNotFoundError('Contract not found.');
		const version = await trx
			.selectFrom('contract_versions')
			.select(['id', 'version_number as versionNumber', 'version_status as versionStatus'])
			.where('organisation_id', '=', actor.organisationId)
			.where('contract_id', '=', contract.id)
			.where('version_number', '=', versionNumber)
			.forUpdate()
			.executeTakeFirst();
		if (!version) throw new RecordNotFoundError('Contract version not found.');
		if (version.versionStatus !== 'draft') {
			throw new ContractValidationError('Only a draft contract version can be changed.');
		}
		return { contract, version };
	}

	async updateDraft(actor: TenantActorContext, input: UpdateContractDraftInput): Promise<void> {
		const contractPublicId = cleanText(input.contractPublicId, 64, 'Contract ID', true)!;
		const versionNumber = positiveInt(input.versionNumber, 'Contract version');
		const title = cleanText(input.title, 255, 'Contract title', true)!;
		const customerReference = cleanText(input.customerReference, 160, 'Customer reference');
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.policy.assertActiveActor(actor, trx);
			const decision = await this.policy.mutationDecision(actor, 'contract.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Contract draft management is not permitted.');
			const { contract, version } = await this.lockDraftVersion(trx, actor, contractPublicId, versionNumber);
			await trx
				.updateTable('contracts')
				.set({ title })
				.where('id', '=', contract.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await trx
				.updateTable('contract_versions')
				.set({ title, customer_reference: customerReference })
				.where('id', '=', version.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.draft.updated',
				subjectType: 'contract',
				subjectPublicId: contract.publicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, title, customerReference }
			});
		});
	}

	async addValueComponent(actor: TenantActorContext, input: AddContractValueInput): Promise<void> {
		const contractPublicId = cleanText(input.contractPublicId, 64, 'Contract ID', true)!;
		const versionNumber = positiveInt(input.versionNumber, 'Contract version');
		const typeCode = validateCode(input.typeCode, 'Value component type');
		const description = cleanText(input.description, 500, 'Value description');
		const amount = validateMoney(input.amount);
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.policy.assertActiveActor(actor, trx);
			const decision = await this.policy.mutationDecision(actor, 'contract.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Contract draft management is not permitted.');
			const { contract, version } = await this.lockDraftVersion(trx, actor, contractPublicId, versionNumber);
			const type = await trx
				.selectFrom('contract_value_component_types')
				.select('id')
				.where('code', '=', typeCode)
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!type) throw new ContractValidationError('The selected value component type is not available.');
			const last = await trx
				.selectFrom('contract_version_value_components')
				.select('sort_order as sortOrder')
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_version_id', '=', version.id)
				.orderBy('sort_order', 'desc')
				.limit(1)
				.executeTakeFirst();
			const sortOrder = (last?.sortOrder ?? 0) + 1;
			await trx
				.insertInto('contract_version_value_components')
				.values({
					organisation_id: actor.organisationId,
					contract_version_id: version.id,
					contract_value_component_type_id: type.id,
					description,
					amount,
					sort_order: sortOrder
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.value_component.added',
				subjectType: 'contract',
				subjectPublicId: contract.publicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, typeCode, amount, sortOrder }
			});
		});
	}

	async removeValueComponent(
		actor: TenantActorContext,
		contractPublicIdInput: string,
		versionNumberInput: number,
		sortOrderInput: number
	): Promise<void> {
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		const versionNumber = positiveInt(versionNumberInput, 'Contract version');
		const sortOrder = positiveInt(sortOrderInput, 'Value component');
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.policy.assertActiveActor(actor, trx);
			const decision = await this.policy.mutationDecision(actor, 'contract.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Contract draft management is not permitted.');
			const { contract, version } = await this.lockDraftVersion(trx, actor, contractPublicId, versionNumber);
			const result = await trx
				.deleteFrom('contract_version_value_components')
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_version_id', '=', version.id)
				.where('sort_order', '=', sortOrder)
				.executeTakeFirst();
			if (result.numDeletedRows !== 1n) throw new RecordNotFoundError('Contract value component not found.');
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.value_component.removed',
				subjectType: 'contract',
				subjectPublicId: contract.publicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, sortOrder }
			});
		});
	}

	async addKeyDate(actor: TenantActorContext, input: AddContractKeyDateInput): Promise<void> {
		const contractPublicId = cleanText(input.contractPublicId, 64, 'Contract ID', true)!;
		const versionNumber = positiveInt(input.versionNumber, 'Contract version');
		const typeCode = validateCode(input.typeCode, 'Key date type');
		const label = cleanText(input.label, 200, 'Key date label');
		const dateValue = validateDate(input.dateValue, 'Key date');
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.policy.assertActiveActor(actor, trx);
			const decision = await this.policy.mutationDecision(actor, 'contract.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Contract draft management is not permitted.');
			const { contract, version } = await this.lockDraftVersion(trx, actor, contractPublicId, versionNumber);
			const type = await trx
				.selectFrom('contract_key_date_types')
				.select('id')
				.where('code', '=', typeCode)
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!type) throw new ContractValidationError('The selected key date type is not available.');
			const last = await trx
				.selectFrom('contract_version_key_dates')
				.select('sort_order as sortOrder')
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_version_id', '=', version.id)
				.orderBy('sort_order', 'desc')
				.limit(1)
				.executeTakeFirst();
			const sortOrder = (last?.sortOrder ?? 0) + 1;
			await trx
				.insertInto('contract_version_key_dates')
				.values({
					organisation_id: actor.organisationId,
					contract_version_id: version.id,
					contract_key_date_type_id: type.id,
					label,
					date_value: dateValue,
					sort_order: sortOrder
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.key_date.added',
				subjectType: 'contract',
				subjectPublicId: contract.publicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, typeCode, dateValue: input.dateValue, sortOrder }
			});
		});
	}

	async removeKeyDate(
		actor: TenantActorContext,
		contractPublicIdInput: string,
		versionNumberInput: number,
		sortOrderInput: number
	): Promise<void> {
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		const versionNumber = positiveInt(versionNumberInput, 'Contract version');
		const sortOrder = positiveInt(sortOrderInput, 'Key date');
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.policy.assertActiveActor(actor, trx);
			const decision = await this.policy.mutationDecision(actor, 'contract.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Contract draft management is not permitted.');
			const { contract, version } = await this.lockDraftVersion(trx, actor, contractPublicId, versionNumber);
			const result = await trx
				.deleteFrom('contract_version_key_dates')
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_version_id', '=', version.id)
				.where('sort_order', '=', sortOrder)
				.executeTakeFirst();
			if (result.numDeletedRows !== 1n) throw new RecordNotFoundError('Contract key date not found.');
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.key_date.removed',
				subjectType: 'contract',
				subjectPublicId: contract.publicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, sortOrder }
			});
		});
	}

	async issue(actor: TenantActorContext, input: IssueContractInput): Promise<void> {
		const contractPublicId = cleanText(input.contractPublicId, 64, 'Contract ID', true)!;
		const versionNumber = positiveInt(input.versionNumber, 'Contract version');
		const deliveryChannel = input.deliveryChannel.trim();
		if (!DELIVERY_CHANNELS.has(deliveryChannel)) throw new ContractValidationError('Delivery channel is invalid.');
		const recipientName = cleanText(input.recipientName, 255, 'Recipient name', true)!;
		const recipientEmail = cleanText(input.recipientEmail, 320, 'Recipient email');
		if (recipientEmail && !recipientEmail.includes('@')) throw new ContractValidationError('Recipient email is invalid.');
		const note = cleanText(input.note, 1000, 'Issue note');

		await this.db.transaction().execute(async (trx) => {
			const membership = await this.policy.assertActiveActor(actor, trx);
			const decision = await this.policy.mutationDecision(actor, 'contract.issue', trx);
			if (!decision.allowed) throw new TenantAccessError('Contract issue is not permitted.');
			const { contract, version } = await this.lockDraftVersion(trx, actor, contractPublicId, versionNumber);
			const [partyCount, valueCount, clientParty] = await Promise.all([
				trx
					.selectFrom('contract_version_parties')
					.select(({ fn }) => fn.countAll<string>().as('count'))
					.where('organisation_id', '=', actor.organisationId)
					.where('contract_version_id', '=', version.id)
					.executeTakeFirstOrThrow(),
				trx
					.selectFrom('contract_version_value_components')
					.select(({ fn }) => fn.countAll<string>().as('count'))
					.where('organisation_id', '=', actor.organisationId)
					.where('contract_version_id', '=', version.id)
					.executeTakeFirstOrThrow(),
				trx
					.selectFrom('contract_version_parties as party')
					.innerJoin('contract_party_role_types as role', 'role.id', 'party.contract_party_role_type_id')
					.select('party.source_party_id as sourcePartyId')
					.where('party.organisation_id', '=', actor.organisationId)
					.where('party.contract_version_id', '=', version.id)
					.where('role.code', '=', 'client')
					.orderBy('party.sort_order')
					.executeTakeFirst()
			]);
			if (Number(partyCount.count) < 1) {
				throw new ContractValidationError('A contract requires at least one party before issue.');
			}
			if (Number(valueCount.count) < 1) {
				throw new ContractValidationError('A contract requires at least one value component before issue.');
			}

			const lockedAt = this.now();
			await trx
				.updateTable('contract_versions')
				.set({ version_status: 'issued', locked_by_member_id: membership.id, locked_at: lockedAt })
				.where('id', '=', version.id)
				.where('organisation_id', '=', actor.organisationId)
				.where('version_status', '=', 'draft')
				.executeTakeFirstOrThrow();
			await trx
				.updateTable('contracts')
				.set({ lifecycle_status: 'under_review' })
				.where('id', '=', contract.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			const issueInsert = await trx
				.insertInto('contract_issue_events')
				.values({
					organisation_id: actor.organisationId,
					contract_version_id: version.id,
					issue_sequence: 1,
					issued_by_member_id: membership.id,
					delivery_channel: deliveryChannel,
					issued_at: lockedAt,
					note
				})
				.executeTakeFirstOrThrow();
			if (issueInsert.insertId === undefined) throw new Error('Contract issue event insert did not return an ID.');
			await trx
				.insertInto('contract_issue_recipients')
				.values({
					organisation_id: actor.organisationId,
					contract_issue_event_id: issueInsert.insertId.toString(),
					contract_version_id: version.id,
					source_party_id: clientParty?.sourcePartyId ?? null,
					recipient_name: recipientName,
					recipient_email: recipientEmail,
					delivery_status: deliveryChannel === 'manual' ? 'acknowledged' : 'sent',
					delivered_at: deliveryChannel === 'manual' ? lockedAt : null
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.issued',
				subjectType: 'contract',
				subjectPublicId: contract.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					versionNumber,
					deliveryChannel,
					recipientName,
					lockedAt: lockedAt.toISOString()
				}
			});
		});
	}

	async execute(actor: TenantActorContext, input: ExecuteContractInput): Promise<void> {
		const contractPublicId = cleanText(input.contractPublicId, 64, 'Contract ID', true)!;
		const versionNumber = positiveInt(input.versionNumber, 'Contract version');
		const executionMethod = input.executionMethod.trim();
		if (!EXECUTION_METHODS.has(executionMethod)) throw new ContractValidationError('Execution method is invalid.');
		const executedAt = validateDateTime(input.executedAt, 'Execution date/time');
		const signatoryName = cleanText(input.signatoryName, 255, 'Signatory name', true)!;
		const signatoryEmail = cleanText(input.signatoryEmail, 320, 'Signatory email');
		if (signatoryEmail && !signatoryEmail.includes('@')) throw new ContractValidationError('Signatory email is invalid.');
		const signingRole = cleanText(input.signingRole, 160, 'Signing role');
		const externalTransactionReference = cleanText(
			input.externalTransactionReference,
			255,
			'External transaction reference'
		);
		const note = cleanText(input.note, 1000, 'Execution note');

		await this.db.transaction().execute(async (trx) => {
			const membership = await this.policy.assertActiveActor(actor, trx);
			const decision = await this.policy.mutationDecision(actor, 'contract.execute', trx);
			if (!decision.allowed) throw new TenantAccessError('Contract execution recording is not permitted.');
			const contract = await trx
				.selectFrom('contracts')
				.select([
					'id',
					'public_id as publicId',
					'lifecycle_status as lifecycleStatus',
					'project_id as projectId',
					'started_on as startedOn'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', contractPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!contract) throw new RecordNotFoundError('Contract not found.');
			const version = await trx
				.selectFrom('contract_versions')
				.select(['id', 'version_status as versionStatus', 'locked_at as lockedAt'])
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_id', '=', contract.id)
				.where('version_number', '=', versionNumber)
				.forUpdate()
				.executeTakeFirst();
			if (!version) throw new RecordNotFoundError('Contract version not found.');
			if (version.versionStatus !== 'issued' || !version.lockedAt) {
				throw new ContractValidationError('Only an issued and locked contract version can be executed.');
			}
			if (contract.lifecycleStatus !== 'under_review') {
				throw new ContractValidationError('The contract is not awaiting execution.');
			}
			const existingExecution = await trx
				.selectFrom('contract_execution_events')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_version_id', '=', version.id)
				.executeTakeFirst();
			if (existingExecution) throw new ContractValidationError('Execution evidence already exists for this contract version.');
			const clientParty = await trx
				.selectFrom('contract_version_parties as party')
				.innerJoin('contract_party_role_types as role', 'role.id', 'party.contract_party_role_type_id')
				.select('party.source_party_id as sourcePartyId')
				.where('party.organisation_id', '=', actor.organisationId)
				.where('party.contract_version_id', '=', version.id)
				.where('role.code', '=', 'client')
				.orderBy('party.sort_order')
				.executeTakeFirst();
			const executionInsert = await trx
				.insertInto('contract_execution_events')
				.values({
					organisation_id: actor.organisationId,
					contract_version_id: version.id,
					execution_method: executionMethod,
					executed_at: executedAt,
					recorded_by_member_id: membership.id,
					external_transaction_reference: externalTransactionReference,
					note
				})
				.executeTakeFirstOrThrow();
			if (executionInsert.insertId === undefined) throw new Error('Contract execution event insert did not return an ID.');
			await trx
				.insertInto('contract_execution_signatories')
				.values({
					organisation_id: actor.organisationId,
					contract_execution_event_id: executionInsert.insertId.toString(),
					contract_version_id: version.id,
					source_party_id: clientParty?.sourcePartyId ?? null,
					signatory_name: signatoryName,
					signatory_email: signatoryEmail,
					signing_role: signingRole,
					signed_at: executedAt,
					external_signature_reference: externalTransactionReference
				})
				.executeTakeFirstOrThrow();
			await trx
				.updateTable('contract_versions')
				.set({ version_status: 'executed' })
				.where('id', '=', version.id)
				.where('organisation_id', '=', actor.organisationId)
				.where('version_status', '=', 'issued')
				.executeTakeFirstOrThrow();
			await trx
				.updateTable('contracts')
				.set({ lifecycle_status: 'active', started_on: contract.startedOn ?? executedAt })
				.where('id', '=', contract.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.executed',
				subjectType: 'contract',
				subjectPublicId: contract.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					versionNumber,
					executionMethod,
					executedAt: executedAt.toISOString(),
					signatoryName
				}
			});
		});
	}
}
