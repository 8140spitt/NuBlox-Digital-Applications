import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import {
	formatScaledDecimal,
	parseScaledDecimal,
	sumMoney
} from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { cleanText, ContractValidationError, validateCode, validateDate } from './contract-common';

export type ContractAmendmentLifecycleStatus =
	'draft' | 'issued' | 'agreed' | 'rejected' | 'withdrawn';
export type ContractAmendmentDecision = 'agreed' | 'rejected';

export type ContractAmendmentSummary = {
	id: string;
	publicId: string;
	amendmentNumber: string;
	typeCode: string;
	typeName: string;
	title: string;
	description: string | null;
	lifecycleStatus: ContractAmendmentLifecycleStatus;
	effectiveOn: Date | null;
	issuedAt: Date | null;
	decidedAt: Date | null;
	createdAt: Date;
};

export type AmendmentTypeOption = { id: number; code: string; name: string };

export type ContractAmendmentList = {
	items: ContractAmendmentSummary[];
	amendmentTypes: AmendmentTypeOption[];
	canCreate: boolean;
	baselineValue: string | null;
	agreedAdjustmentTotal: string;
	currentContractValue: string | null;
};

export type ContractAmendmentWorkspace = {
	contract: {
		id: string;
		publicId: string;
		contractNumber: string;
		title: string;
		lifecycleStatus: string;
		currencyCode: string;
		projectId: string | null;
	};
	amendment: ContractAmendmentSummary;
	valueAdjustments: Array<{
		id: string;
		typeCode: string;
		typeName: string;
		description: string | null;
		adjustmentAmount: string;
		sortOrder: number;
	}>;
	keyDateChanges: Array<{
		id: string;
		typeCode: string;
		typeName: string;
		label: string | null;
		newDate: Date;
		sortOrder: number;
	}>;
	amendmentTypes: AmendmentTypeOption[];
	valueComponentTypes: AmendmentTypeOption[];
	keyDateTypes: AmendmentTypeOption[];
	baselineValue: string;
	agreedAdjustmentTotal: string;
	currentContractValue: string;
	canManageDraft: boolean;
	canIssue: boolean;
	canDecide: boolean;
	canWithdraw: boolean;
};

export type CreateContractAmendmentInput = {
	contractPublicId: string;
	typeCode: string;
	title: string;
	description?: string | null;
	effectiveOn?: string | null;
};

export type UpdateContractAmendmentInput = {
	contractPublicId: string;
	amendmentPublicId: string;
	typeCode: string;
	title: string;
	description?: string | null;
	effectiveOn?: string | null;
};

export type AddContractAmendmentValueInput = {
	contractPublicId: string;
	amendmentPublicId: string;
	typeCode: string;
	description?: string | null;
	adjustmentAmount: string;
};

export type AddContractAmendmentKeyDateInput = {
	contractPublicId: string;
	amendmentPublicId: string;
	typeCode: string;
	label?: string | null;
	newDate: string;
};

export class ContractAmendmentValidationError extends ContractValidationError {
	constructor(message: string) {
		super(message);
		this.name = 'ContractAmendmentValidationError';
	}
}

type AmendmentPermissionKey =
	| 'contract.amendment.create'
	| 'contract.amendment.draft.manage'
	| 'contract.amendment.issue'
	| 'contract.amendment.decide';

function optionalDate(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	return text ? validateDate(text, label) : null;
}

function validateSignedAdjustment(value: string): string {
	let parsed: bigint;
	try {
		parsed = parseScaledDecimal(value, 4, 'Contract adjustment', true);
	} catch (cause) {
		throw new ContractAmendmentValidationError(
			cause instanceof Error ? cause.message : 'Contract adjustment must be a decimal number.'
		);
	}
	if (parsed === 0n)
		throw new ContractAmendmentValidationError('Contract adjustment must not be zero.');
	const absolute = parsed < 0n ? -parsed : parsed;
	if (absolute > 9_999_999_999_999_999_999n) {
		throw new ContractAmendmentValidationError('Contract adjustment is too large.');
	}
	return formatScaledDecimal(parsed, 4);
}

function generatedAmendmentNumber(sequence: number): string {
	return `AMD-${String(sequence).padStart(3, '0')}`;
}

export class ContractAmendmentService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async viewDecision(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		return new PermissionService(db).decide(actor, 'contract.view');
	}

	private async mutationDecision(
		actor: TenantActorContext,
		permissionKey: AmendmentPermissionKey,
		db: DatabaseExecutor = this.db
	) {
		return new PermissionService(db).decideWithUmbrella(actor, permissionKey, 'contract.manage');
	}

	private async findContract(
		db: DatabaseExecutor,
		organisationId: string,
		contractPublicId: string,
		lock = false
	) {
		let query = db
			.selectFrom('contracts')
			.select([
				'id',
				'public_id as publicId',
				'contract_number as contractNumber',
				'title',
				'lifecycle_status as lifecycleStatus',
				'currency_code as currencyCode',
				'project_id as projectId'
			])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', contractPublicId);
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}

	private async executedBaselineVersion(
		db: DatabaseExecutor,
		organisationId: string,
		contractId: string
	) {
		return db
			.selectFrom('contract_versions')
			.select(['id', 'version_number as versionNumber'])
			.where('organisation_id', '=', organisationId)
			.where('contract_id', '=', contractId)
			.where('version_status', '=', 'executed')
			.orderBy('version_number', 'desc')
			.executeTakeFirst();
	}

	private async baselineValue(
		db: DatabaseExecutor,
		organisationId: string,
		contractVersionId: string
	): Promise<string> {
		const rows = await db
			.selectFrom('contract_version_value_components')
			.select('amount')
			.where('organisation_id', '=', organisationId)
			.where('contract_version_id', '=', contractVersionId)
			.orderBy('sort_order', 'asc')
			.execute();
		return sumMoney(rows.map((row) => row.amount));
	}

	private async agreedAdjustmentTotal(
		db: DatabaseExecutor,
		organisationId: string,
		contractId: string
	): Promise<string> {
		const rows = await db
			.selectFrom('contract_amendments as amendment')
			.innerJoin('contract_amendment_value_adjustments as adjustment', (join) =>
				join
					.onRef('adjustment.contract_amendment_id', '=', 'amendment.id')
					.onRef('adjustment.organisation_id', '=', 'amendment.organisation_id')
			)
			.select('adjustment.adjustment_amount as adjustmentAmount')
			.where('amendment.organisation_id', '=', organisationId)
			.where('amendment.contract_id', '=', contractId)
			.where('amendment.lifecycle_status', '=', 'agreed')
			.execute();
		return sumMoney(rows.map((row) => row.adjustmentAmount));
	}

	private async findAmendment(
		db: DatabaseExecutor,
		organisationId: string,
		contractId: string,
		amendmentPublicId: string,
		lock = false
	) {
		let query = db
			.selectFrom('contract_amendments as amendment')
			.innerJoin(
				'contract_amendment_types as type',
				'type.id',
				'amendment.contract_amendment_type_id'
			)
			.select([
				'amendment.id as id',
				'amendment.public_id as publicId',
				'amendment.amendment_number as amendmentNumber',
				'type.code as typeCode',
				'type.name as typeName',
				'amendment.title as title',
				'amendment.description as description',
				'amendment.lifecycle_status as lifecycleStatus',
				'amendment.effective_on as effectiveOn',
				'amendment.issued_at as issuedAt',
				'amendment.decided_at as decidedAt',
				'amendment.created_at as createdAt'
			])
			.where('amendment.organisation_id', '=', organisationId)
			.where('amendment.contract_id', '=', contractId)
			.where('amendment.public_id', '=', amendmentPublicId);
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst() as Promise<ContractAmendmentSummary | undefined>;
	}

	async listForContract(
		actor: TenantActorContext,
		contractPublicIdInput: string
	): Promise<ContractAmendmentList> {
		await this.assertActiveActor(actor);
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		const view = await this.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Contract viewing is not permitted.');
		const contract = await this.findContract(this.db, actor.organisationId, contractPublicId);
		if (!contract) throw new RecordNotFoundError('Contract not found.');

		const [items, amendmentTypes, createDecision, baseline] = await Promise.all([
			this.db
				.selectFrom('contract_amendments as amendment')
				.innerJoin(
					'contract_amendment_types as type',
					'type.id',
					'amendment.contract_amendment_type_id'
				)
				.select([
					'amendment.id as id',
					'amendment.public_id as publicId',
					'amendment.amendment_number as amendmentNumber',
					'type.code as typeCode',
					'type.name as typeName',
					'amendment.title as title',
					'amendment.description as description',
					'amendment.lifecycle_status as lifecycleStatus',
					'amendment.effective_on as effectiveOn',
					'amendment.issued_at as issuedAt',
					'amendment.decided_at as decidedAt',
					'amendment.created_at as createdAt'
				])
				.where('amendment.organisation_id', '=', actor.organisationId)
				.where('amendment.contract_id', '=', contract.id)
				.orderBy('amendment.id', 'desc')
				.execute() as Promise<ContractAmendmentSummary[]>,
			this.db
				.selectFrom('contract_amendment_types')
				.select(['id', 'code', 'name'])
				.where('is_active', '=', 1)
				.orderBy('name', 'asc')
				.execute(),
			this.mutationDecision(actor, 'contract.amendment.create'),
			this.executedBaselineVersion(this.db, actor.organisationId, contract.id)
		]);

		const baselineValue = baseline
			? await this.baselineValue(this.db, actor.organisationId, baseline.id)
			: null;
		const agreedAdjustmentTotal = await this.agreedAdjustmentTotal(
			this.db,
			actor.organisationId,
			contract.id
		);
		return {
			items,
			amendmentTypes,
			canCreate:
				createDecision.allowed && contract.lifecycleStatus === 'active' && Boolean(baseline),
			baselineValue,
			agreedAdjustmentTotal,
			currentContractValue:
				baselineValue === null ? null : sumMoney([baselineValue, agreedAdjustmentTotal])
		};
	}

	async create(
		actor: TenantActorContext,
		input: CreateContractAmendmentInput
	): Promise<ContractAmendmentSummary> {
		const contractPublicId = cleanText(input.contractPublicId, 64, 'Contract ID', true)!;
		const typeCode = validateCode(input.typeCode, 'Amendment type');
		const title = cleanText(input.title, 255, 'Amendment title', true)!;
		const description = cleanText(input.description, 65535, 'Amendment description');
		const effectiveOn = optionalDate(input.effectiveOn, 'Effective date');

		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'contract.amendment.create', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Contract amendment creation is not permitted.');
			const contract = await this.findContract(trx, actor.organisationId, contractPublicId, true);
			if (!contract) throw new RecordNotFoundError('Contract not found.');
			if (contract.lifecycleStatus !== 'active') {
				throw new ContractAmendmentValidationError(
					'Only an active executed contract can be amended.'
				);
			}
			const baseline = await this.executedBaselineVersion(trx, actor.organisationId, contract.id);
			if (!baseline) {
				throw new ContractAmendmentValidationError(
					'An executed contract baseline is required before amendment.'
				);
			}
			const type = await trx
				.selectFrom('contract_amendment_types')
				.select('id')
				.where('code', '=', typeCode)
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!type) throw new ContractAmendmentValidationError('Amendment type is not available.');
			const existing = await trx
				.selectFrom('contract_amendments')
				.select(({ fn }) => fn.countAll<string>().as('count'))
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_id', '=', contract.id)
				.executeTakeFirstOrThrow();
			const amendmentNumber = generatedAmendmentNumber(Number(existing.count) + 1);
			const publicId = this.publicIdFactory();
			await trx
				.insertInto('contract_amendments')
				.values({
					organisation_id: actor.organisationId,
					contract_id: contract.id,
					public_id: publicId,
					amendment_number: amendmentNumber,
					contract_amendment_type_id: type.id,
					title,
					description,
					lifecycle_status: 'draft',
					effective_on: effectiveOn,
					created_by_member_id: membership.id,
					issued_by_member_id: null,
					issued_at: null,
					decided_by_member_id: null,
					decided_at: null
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.amendment.created',
				subjectType: 'contract_amendment',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { contractPublicId, amendmentNumber, typeCode, title, effectiveOn }
			});
			const created = await this.findAmendment(trx, actor.organisationId, contract.id, publicId);
			if (!created) throw new Error('Created contract amendment could not be reloaded.');
			return created;
		});
	}

	async getWorkspace(
		actor: TenantActorContext,
		contractPublicIdInput: string,
		amendmentPublicIdInput: string
	): Promise<ContractAmendmentWorkspace> {
		await this.assertActiveActor(actor);
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		const amendmentPublicId = cleanText(amendmentPublicIdInput, 64, 'Amendment ID', true)!;
		const view = await this.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Contract viewing is not permitted.');
		const contract = await this.findContract(this.db, actor.organisationId, contractPublicId);
		if (!contract) throw new RecordNotFoundError('Contract not found.');
		const amendment = await this.findAmendment(
			this.db,
			actor.organisationId,
			contract.id,
			amendmentPublicId
		);
		if (!amendment) throw new RecordNotFoundError('Contract amendment not found.');
		const baseline = await this.executedBaselineVersion(this.db, actor.organisationId, contract.id);
		if (!baseline)
			throw new ContractAmendmentValidationError('The contract has no executed baseline.');

		const [
			valueAdjustments,
			keyDateChanges,
			amendmentTypes,
			valueComponentTypes,
			keyDateTypes,
			manageDecision,
			issueDecision,
			decideDecision,
			baselineValue,
			agreedAdjustmentTotal
		] = await Promise.all([
			this.db
				.selectFrom('contract_amendment_value_adjustments as adjustment')
				.innerJoin(
					'contract_value_component_types as type',
					'type.id',
					'adjustment.contract_value_component_type_id'
				)
				.select([
					'adjustment.id as id',
					'type.code as typeCode',
					'type.name as typeName',
					'adjustment.description as description',
					'adjustment.adjustment_amount as adjustmentAmount',
					'adjustment.sort_order as sortOrder'
				])
				.where('adjustment.organisation_id', '=', actor.organisationId)
				.where('adjustment.contract_amendment_id', '=', amendment.id)
				.orderBy('adjustment.sort_order', 'asc')
				.execute(),
			this.db
				.selectFrom('contract_amendment_key_date_changes as change')
				.innerJoin('contract_key_date_types as type', 'type.id', 'change.contract_key_date_type_id')
				.select([
					'change.id as id',
					'type.code as typeCode',
					'type.name as typeName',
					'change.label as label',
					'change.new_date as newDate',
					'change.sort_order as sortOrder'
				])
				.where('change.organisation_id', '=', actor.organisationId)
				.where('change.contract_amendment_id', '=', amendment.id)
				.orderBy('change.sort_order', 'asc')
				.execute(),
			this.db
				.selectFrom('contract_amendment_types')
				.select(['id', 'code', 'name'])
				.where('is_active', '=', 1)
				.orderBy('name')
				.execute(),
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
			this.mutationDecision(actor, 'contract.amendment.draft.manage'),
			this.mutationDecision(actor, 'contract.amendment.issue'),
			this.mutationDecision(actor, 'contract.amendment.decide'),
			this.baselineValue(this.db, actor.organisationId, baseline.id),
			this.agreedAdjustmentTotal(this.db, actor.organisationId, contract.id)
		]);

		return {
			contract,
			amendment,
			valueAdjustments,
			keyDateChanges,
			amendmentTypes,
			valueComponentTypes,
			keyDateTypes,
			baselineValue,
			agreedAdjustmentTotal,
			currentContractValue: sumMoney([baselineValue, agreedAdjustmentTotal]),
			canManageDraft: manageDecision.allowed && amendment.lifecycleStatus === 'draft',
			canIssue: issueDecision.allowed && amendment.lifecycleStatus === 'draft',
			canDecide: decideDecision.allowed && amendment.lifecycleStatus === 'issued',
			canWithdraw:
				decideDecision.allowed &&
				(amendment.lifecycleStatus === 'draft' || amendment.lifecycleStatus === 'issued')
		};
	}

	private async lockDraft(
		trx: DatabaseExecutor,
		actor: TenantActorContext,
		contractPublicId: string,
		amendmentPublicId: string
	) {
		const contract = await this.findContract(trx, actor.organisationId, contractPublicId, true);
		if (!contract) throw new RecordNotFoundError('Contract not found.');
		const amendment = await this.findAmendment(
			trx,
			actor.organisationId,
			contract.id,
			amendmentPublicId,
			true
		);
		if (!amendment) throw new RecordNotFoundError('Contract amendment not found.');
		if (amendment.lifecycleStatus !== 'draft') {
			throw new ContractAmendmentValidationError('Only a draft amendment can be changed.');
		}
		return { contract, amendment };
	}

	async updateDraft(actor: TenantActorContext, input: UpdateContractAmendmentInput): Promise<void> {
		const contractPublicId = cleanText(input.contractPublicId, 64, 'Contract ID', true)!;
		const amendmentPublicId = cleanText(input.amendmentPublicId, 64, 'Amendment ID', true)!;
		const typeCode = validateCode(input.typeCode, 'Amendment type');
		const title = cleanText(input.title, 255, 'Amendment title', true)!;
		const description = cleanText(input.description, 65535, 'Amendment description');
		const effectiveOn = optionalDate(input.effectiveOn, 'Effective date');
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'contract.amendment.draft.manage', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Contract amendment draft management is not permitted.');
			const { contract, amendment } = await this.lockDraft(
				trx,
				actor,
				contractPublicId,
				amendmentPublicId
			);
			const type = await trx
				.selectFrom('contract_amendment_types')
				.select('id')
				.where('code', '=', typeCode)
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!type) throw new ContractAmendmentValidationError('Amendment type is not available.');
			await trx
				.updateTable('contract_amendments')
				.set({
					contract_amendment_type_id: type.id,
					title,
					description,
					effective_on: effectiveOn
				})
				.where('id', '=', amendment.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.amendment.draft.updated',
				subjectType: 'contract_amendment',
				subjectPublicId: amendment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { typeCode, title, description, effectiveOn }
			});
		});
	}

	async addValueAdjustment(
		actor: TenantActorContext,
		input: AddContractAmendmentValueInput
	): Promise<void> {
		const contractPublicId = cleanText(input.contractPublicId, 64, 'Contract ID', true)!;
		const amendmentPublicId = cleanText(input.amendmentPublicId, 64, 'Amendment ID', true)!;
		const typeCode = validateCode(input.typeCode, 'Value component type');
		const description = cleanText(input.description, 500, 'Adjustment description');
		const adjustmentAmount = validateSignedAdjustment(input.adjustmentAmount);
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'contract.amendment.draft.manage', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Contract amendment draft management is not permitted.');
			const { contract, amendment } = await this.lockDraft(
				trx,
				actor,
				contractPublicId,
				amendmentPublicId
			);
			const type = await trx
				.selectFrom('contract_value_component_types')
				.select('id')
				.where('code', '=', typeCode)
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!type)
				throw new ContractAmendmentValidationError('Value component type is not available.');
			const last = await trx
				.selectFrom('contract_amendment_value_adjustments')
				.select('sort_order as sortOrder')
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_amendment_id', '=', amendment.id)
				.orderBy('sort_order', 'desc')
				.executeTakeFirst();
			const sortOrder = (last?.sortOrder ?? 0) + 1;
			await trx
				.insertInto('contract_amendment_value_adjustments')
				.values({
					organisation_id: actor.organisationId,
					contract_amendment_id: amendment.id,
					contract_value_component_type_id: type.id,
					description,
					adjustment_amount: adjustmentAmount,
					sort_order: sortOrder
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.amendment.value.added',
				subjectType: 'contract_amendment',
				subjectPublicId: amendment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { typeCode, description, adjustmentAmount, sortOrder }
			});
		});
	}

	async removeValueAdjustment(
		actor: TenantActorContext,
		contractPublicIdInput: string,
		amendmentPublicIdInput: string,
		sortOrderInput: number
	): Promise<void> {
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		const amendmentPublicId = cleanText(amendmentPublicIdInput, 64, 'Amendment ID', true)!;
		if (!Number.isSafeInteger(sortOrderInput) || sortOrderInput <= 0)
			throw new ContractAmendmentValidationError('Value adjustment is invalid.');
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'contract.amendment.draft.manage', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Contract amendment draft management is not permitted.');
			const { contract, amendment } = await this.lockDraft(
				trx,
				actor,
				contractPublicId,
				amendmentPublicId
			);
			const result = await trx
				.deleteFrom('contract_amendment_value_adjustments')
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_amendment_id', '=', amendment.id)
				.where('sort_order', '=', sortOrderInput)
				.executeTakeFirst();
			if (Number(result.numDeletedRows) === 0)
				throw new RecordNotFoundError('Value adjustment not found.');
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.amendment.value.removed',
				subjectType: 'contract_amendment',
				subjectPublicId: amendment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { sortOrder: sortOrderInput }
			});
		});
	}

	async addKeyDateChange(
		actor: TenantActorContext,
		input: AddContractAmendmentKeyDateInput
	): Promise<void> {
		const contractPublicId = cleanText(input.contractPublicId, 64, 'Contract ID', true)!;
		const amendmentPublicId = cleanText(input.amendmentPublicId, 64, 'Amendment ID', true)!;
		const typeCode = validateCode(input.typeCode, 'Key date type');
		const label = cleanText(input.label, 200, 'Key date label');
		const newDate = validateDate(input.newDate, 'New key date');
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'contract.amendment.draft.manage', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Contract amendment draft management is not permitted.');
			const { contract, amendment } = await this.lockDraft(
				trx,
				actor,
				contractPublicId,
				amendmentPublicId
			);
			const type = await trx
				.selectFrom('contract_key_date_types')
				.select('id')
				.where('code', '=', typeCode)
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!type) throw new ContractAmendmentValidationError('Key date type is not available.');
			const last = await trx
				.selectFrom('contract_amendment_key_date_changes')
				.select('sort_order as sortOrder')
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_amendment_id', '=', amendment.id)
				.orderBy('sort_order', 'desc')
				.executeTakeFirst();
			const sortOrder = (last?.sortOrder ?? 0) + 1;
			await trx
				.insertInto('contract_amendment_key_date_changes')
				.values({
					organisation_id: actor.organisationId,
					contract_amendment_id: amendment.id,
					contract_key_date_type_id: type.id,
					label,
					new_date: newDate,
					sort_order: sortOrder
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.amendment.key_date.added',
				subjectType: 'contract_amendment',
				subjectPublicId: amendment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { typeCode, label, newDate, sortOrder }
			});
		});
	}

	async removeKeyDateChange(
		actor: TenantActorContext,
		contractPublicIdInput: string,
		amendmentPublicIdInput: string,
		sortOrderInput: number
	): Promise<void> {
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		const amendmentPublicId = cleanText(amendmentPublicIdInput, 64, 'Amendment ID', true)!;
		if (!Number.isSafeInteger(sortOrderInput) || sortOrderInput <= 0)
			throw new ContractAmendmentValidationError('Key date change is invalid.');
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'contract.amendment.draft.manage', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Contract amendment draft management is not permitted.');
			const { contract, amendment } = await this.lockDraft(
				trx,
				actor,
				contractPublicId,
				amendmentPublicId
			);
			const result = await trx
				.deleteFrom('contract_amendment_key_date_changes')
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_amendment_id', '=', amendment.id)
				.where('sort_order', '=', sortOrderInput)
				.executeTakeFirst();
			if (Number(result.numDeletedRows) === 0)
				throw new RecordNotFoundError('Key date change not found.');
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.amendment.key_date.removed',
				subjectType: 'contract_amendment',
				subjectPublicId: amendment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { sortOrder: sortOrderInput }
			});
		});
	}

	async issue(
		actor: TenantActorContext,
		contractPublicIdInput: string,
		amendmentPublicIdInput: string
	): Promise<void> {
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		const amendmentPublicId = cleanText(amendmentPublicIdInput, 64, 'Amendment ID', true)!;
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'contract.amendment.issue', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Contract amendment issue is not permitted.');
			const { contract, amendment } = await this.lockDraft(
				trx,
				actor,
				contractPublicId,
				amendmentPublicId
			);
			if (!amendment.effectiveOn) {
				throw new ContractAmendmentValidationError(
					'Set an effective date before issuing the amendment.'
				);
			}
			const [value, date] = await Promise.all([
				trx
					.selectFrom('contract_amendment_value_adjustments')
					.select('id')
					.where('organisation_id', '=', actor.organisationId)
					.where('contract_amendment_id', '=', amendment.id)
					.limit(1)
					.executeTakeFirst(),
				trx
					.selectFrom('contract_amendment_key_date_changes')
					.select('id')
					.where('organisation_id', '=', actor.organisationId)
					.where('contract_amendment_id', '=', amendment.id)
					.limit(1)
					.executeTakeFirst()
			]);
			if (!amendment.description && !value && !date) {
				throw new ContractAmendmentValidationError(
					'Add an amendment description, value adjustment or key-date change before issue.'
				);
			}
			const issuedAt = this.now();
			await trx
				.updateTable('contract_amendments')
				.set({
					lifecycle_status: 'issued',
					issued_by_member_id: membership.id,
					issued_at: issuedAt
				})
				.where('id', '=', amendment.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.amendment.issued',
				subjectType: 'contract_amendment',
				subjectPublicId: amendment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { issuedAt, effectiveOn: amendment.effectiveOn }
			});
		});
	}

	async decide(
		actor: TenantActorContext,
		contractPublicIdInput: string,
		amendmentPublicIdInput: string,
		decisionInput: ContractAmendmentDecision
	): Promise<void> {
		if (decisionInput !== 'agreed' && decisionInput !== 'rejected')
			throw new ContractAmendmentValidationError('Amendment decision is invalid.');
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		const amendmentPublicId = cleanText(amendmentPublicIdInput, 64, 'Amendment ID', true)!;
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const permission = await this.mutationDecision(actor, 'contract.amendment.decide', trx);
			if (!permission.allowed)
				throw new TenantAccessError('Contract amendment decision is not permitted.');
			const contract = await this.findContract(trx, actor.organisationId, contractPublicId, true);
			if (!contract) throw new RecordNotFoundError('Contract not found.');
			const amendment = await this.findAmendment(
				trx,
				actor.organisationId,
				contract.id,
				amendmentPublicId,
				true
			);
			if (!amendment) throw new RecordNotFoundError('Contract amendment not found.');
			if (amendment.lifecycleStatus !== 'issued')
				throw new ContractAmendmentValidationError(
					'Only an issued amendment can be agreed or rejected.'
				);
			if (decisionInput === 'agreed' && !amendment.effectiveOn)
				throw new ContractAmendmentValidationError(
					'An effective date is required before agreement.'
				);
			const decidedAt = this.now();
			await trx
				.updateTable('contract_amendments')
				.set({
					lifecycle_status: decisionInput,
					decided_by_member_id: membership.id,
					decided_at: decidedAt
				})
				.where('id', '=', amendment.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: `contract.amendment.${decisionInput}`,
				subjectType: 'contract_amendment',
				subjectPublicId: amendment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { decidedAt, effectiveOn: amendment.effectiveOn }
			});
		});
	}

	async withdraw(
		actor: TenantActorContext,
		contractPublicIdInput: string,
		amendmentPublicIdInput: string
	): Promise<void> {
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		const amendmentPublicId = cleanText(amendmentPublicIdInput, 64, 'Amendment ID', true)!;
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const permission = await this.mutationDecision(actor, 'contract.amendment.decide', trx);
			if (!permission.allowed)
				throw new TenantAccessError('Contract amendment withdrawal is not permitted.');
			const contract = await this.findContract(trx, actor.organisationId, contractPublicId, true);
			if (!contract) throw new RecordNotFoundError('Contract not found.');
			const amendment = await this.findAmendment(
				trx,
				actor.organisationId,
				contract.id,
				amendmentPublicId,
				true
			);
			if (!amendment) throw new RecordNotFoundError('Contract amendment not found.');
			if (amendment.lifecycleStatus !== 'draft' && amendment.lifecycleStatus !== 'issued') {
				throw new ContractAmendmentValidationError(
					'Only a draft or issued amendment can be withdrawn.'
				);
			}
			await trx
				.updateTable('contract_amendments')
				.set({ lifecycle_status: 'withdrawn' })
				.where('id', '=', amendment.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.amendment.withdrawn',
				subjectType: 'contract_amendment',
				subjectPublicId: amendment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { fromStatus: amendment.lifecycleStatus }
			});
		});
	}
}
