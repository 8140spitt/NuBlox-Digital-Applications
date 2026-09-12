import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	formatScaledDecimal,
	parseScaledDecimal,
	subtractMoney,
	sumMoney
} from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	FinanceAccessPolicy,
	FinanceValidationError,
	cleanFinanceText,
	insertedId,
	validateCurrencyCode,
	validateMoneyAmount
} from './finance-common';
import { customerOutstandingByCurrency } from './receivable-ledger';

export type CreditControlWorkflow = 'quotation_conversion' | 'contract_execution';

export class CreditControlBlockedError extends Error {
	readonly code = 'CREDIT_CONTROL_BLOCKED';
	constructor(message: string) {
		super(message);
		this.name = 'CreditControlBlockedError';
	}
}

export type CreditControlCustomer = {
	id: string;
	publicId: string;
	displayName: string;
	partyKind: string;
};
export type CreditPolicySummary = {
	id: string;
	publicId: string;
	customerPartyId: string;
	customerPartyPublicId: string;
	customerDisplayName: string;
	currencyCode: string;
	versionNumber: number;
	isEnabled: boolean;
	creditLimitAmount: string | null;
	outstandingAmount: string;
	availableAmount: string | null;
	limitExhausted: boolean;
	reason: string;
	updatedAt: Date;
};
export type CreditHoldSummary = {
	id: string;
	publicId: string;
	customerPartyId: string;
	customerPartyPublicId: string;
	customerDisplayName: string;
	status: string;
	placedReason: string;
	placedAt: Date;
	releasedReason: string | null;
	releasedAt: Date | null;
};
export type CreditOverrideSummary = {
	publicId: string;
	customerPartyPublicId: string;
	customerDisplayName: string;
	workflowType: CreditControlWorkflow;
	subjectPublicId: string;
	currencyCode: string;
	outstandingAmount: string;
	commitmentAmount: string;
	projectedExposureAmount: string;
	creditLimitAmount: string | null;
	reason: string;
	authorisedAt: Date;
};
export type CreditControlWorkspace = {
	customers: CreditControlCustomer[];
	policies: CreditPolicySummary[];
	holds: CreditHoldSummary[];
	overrides: CreditOverrideSummary[];
	canManagePolicies: boolean;
	canManageHolds: boolean;
	canOverride: boolean;
};
export type CreditCommitmentPreview = {
	blocked: boolean;
	hasActiveHold: boolean;
	limitExhausted: boolean;
	canOverride: boolean;
	detailsVisible: boolean;
	outstandingAmount: string | null;
	commitmentAmount: string | null;
	projectedExposureAmount: string | null;
	creditLimitAmount: string | null;
	currencyCode: string;
};

type CreditPolicyState = {
	policyId: string;
	policyPublicId: string;
	customerPartyId: string;
	currencyCode: string;
	versionNumber: number;
	isEnabled: boolean;
	creditLimitAmount: string | null;
	reason: string;
	updatedAt: Date;
} | null;
type ActiveHoldState = {
	id: string;
	publicId: string;
	placedReason: string;
	placedAt: Date;
} | null;

function displayName(row: {
	partyKind: string;
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
	legalName: string | null;
	tradingName: string | null;
}): string {
	if (row.partyKind === 'person') {
		const preferred = row.preferredName?.trim();
		const family = row.familyName?.trim();
		if (preferred && family) return `${preferred} ${family}`;
		if (preferred) return preferred;
		return [row.givenNames?.trim(), family].filter(Boolean).join(' ') || 'Unnamed person';
	}
	return row.tradingName?.trim() || row.legalName?.trim() || 'Unnamed organisation';
}
function cleanCustomerPublicId(value: string): string {
	const result = value.trim();
	if (!result || result.length > 64) throw new RecordNotFoundError('Customer not found.');
	return result;
}
function normaliseCommitmentAmount(value: string | null | undefined): string {
	let amount: bigint;
	try {
		amount = parseScaledDecimal(value?.trim() || '0', 4, 'Commitment amount', true);
	} catch (cause) {
		throw new FinanceValidationError(
			cause instanceof Error ? cause.message : 'Commitment amount is invalid.'
		);
	}
	if (amount < 0n) throw new FinanceValidationError('Commitment amount must not be negative.');
	return formatScaledDecimal(amount, 4);
}

export class CreditControlService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async customerByPublicId(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string,
		lock = false
	) {
		let query = db
			.selectFrom('parties')
			.select(['id', 'public_id as publicId', 'party_kind as partyKind', 'status'])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId);
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}
	private async customerById(
		db: DatabaseExecutor,
		organisationId: string,
		customerPartyId: string,
		lock = false
	) {
		let query = db
			.selectFrom('parties')
			.select(['id', 'public_id as publicId', 'party_kind as partyKind', 'status'])
			.where('organisation_id', '=', organisationId)
			.where('id', '=', customerPartyId);
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}
	private async customers(
		db: DatabaseExecutor,
		organisationId: string
	): Promise<CreditControlCustomer[]> {
		const rows = await db
			.selectFrom('parties as party')
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'party.id')
					.onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.select([
				'party.id as id',
				'party.public_id as publicId',
				'party.party_kind as partyKind',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName'
			])
			.where('party.organisation_id', '=', organisationId)
			.where('party.status', '=', 'active')
			.orderBy('party.id', 'asc')
			.execute();
		return rows
			.map((row) => ({
				id: row.id,
				publicId: row.publicId,
				partyKind: row.partyKind,
				displayName: displayName(row)
			}))
			.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}
	private async policyState(
		db: DatabaseExecutor,
		organisationId: string,
		customerPartyId: string,
		currencyCode: string,
		lock = false
	): Promise<CreditPolicyState> {
		let policyQuery = db
			.selectFrom('receivable_credit_policies')
			.select([
				'id',
				'public_id as publicId',
				'customer_party_id as customerPartyId',
				'currency_code as currencyCode'
			])
			.where('organisation_id', '=', organisationId)
			.where('customer_party_id', '=', customerPartyId)
			.where('currency_code', '=', currencyCode);
		if (lock) policyQuery = policyQuery.forUpdate();
		const policy = await policyQuery.executeTakeFirst();
		if (!policy) return null;
		let revisionQuery = db
			.selectFrom('receivable_credit_policy_revisions')
			.select([
				'version_number as versionNumber',
				'is_enabled as isEnabled',
				'credit_limit_amount as creditLimitAmount',
				'reason',
				'created_at as createdAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('credit_policy_id', '=', policy.id)
			.orderBy('version_number', 'desc')
			.limit(1);
		if (lock) revisionQuery = revisionQuery.forUpdate();
		const revision = await revisionQuery.executeTakeFirst();
		if (!revision) throw new Error('Credit policy has no revision evidence.');
		return {
			policyId: policy.id,
			policyPublicId: policy.publicId,
			customerPartyId: policy.customerPartyId,
			currencyCode: policy.currencyCode,
			versionNumber: revision.versionNumber,
			isEnabled: revision.isEnabled === 1,
			creditLimitAmount: revision.creditLimitAmount,
			reason: revision.reason,
			updatedAt: revision.createdAt
		};
	}
	private async activeHold(
		db: DatabaseExecutor,
		organisationId: string,
		customerPartyId: string,
		lock = false
	): Promise<ActiveHoldState> {
		let query = db
			.selectFrom('receivable_credit_holds')
			.select([
				'id',
				'public_id as publicId',
				'placed_reason as placedReason',
				'placed_at as placedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('customer_party_id', '=', customerPartyId)
			.where('status', '=', 'active')
			.orderBy('id', 'desc')
			.limit(1);
		if (lock) query = query.forUpdate();
		return (await query.executeTakeFirst()) ?? null;
	}
	private async rawState(
		db: DatabaseExecutor,
		organisationId: string,
		customerPartyId: string,
		currencyCode: string,
		commitmentAmountInput: string | null | undefined = '0.0000',
		lock = false
	) {
		if (lock) {
			// Customer is the canonical first lock for invoice mutation and credit-control enforcement.
			// Once both workflows share this hierarchy, the invoice range lock cannot deadlock an
			// issuer that already owns a child row while waiting for the customer parent row.
			const customer = await this.customerById(db, organisationId, customerPartyId, true);
			if (!customer) throw new RecordNotFoundError('Customer not found.');
			await db
				.selectFrom('financial_documents')
				.select('id')
				.where('organisation_id', '=', organisationId)
				.where('document_kind', '=', 'invoice')
				.where('customer_party_id', '=', customerPartyId)
				.where('currency_code', '=', currencyCode)
				.forUpdate()
				.execute();
		}
		const commitmentAmount = normaliseCommitmentAmount(commitmentAmountInput);
		const [policy, hold, outstandingAmount] = await Promise.all([
			this.policyState(db, organisationId, customerPartyId, currencyCode, lock),
			this.activeHold(db, organisationId, customerPartyId, lock),
			customerOutstandingByCurrency(db, organisationId, customerPartyId, currencyCode)
		]);
		const projectedExposureAmount = sumMoney([outstandingAmount, commitmentAmount]);
		const limitExhausted = Boolean(
			policy?.isEnabled &&
			policy.creditLimitAmount !== null &&
			parseScaledDecimal(projectedExposureAmount, 4, 'Projected exposure', true) >
				parseScaledDecimal(policy.creditLimitAmount, 4, 'Credit limit', true)
		);
		return {
			policy,
			hold,
			outstandingAmount,
			commitmentAmount,
			projectedExposureAmount,
			limitExhausted
		};
	}

	async getWorkspace(actor: TenantActorContext): Promise<CreditControlWorkspace> {
		const access = new FinanceAccessPolicy(this.db);
		await access.assertActiveActor(actor);
		const [financeView, creditView] = await Promise.all([
			access.viewDecision(actor),
			access.creditControlViewDecision(actor)
		]);
		if (!financeView.allowed || !creditView.allowed)
			throw new TenantAccessError('Credit-control viewing is not permitted.');
		const [
			customers,
			policyRows,
			holdRows,
			overrideRows,
			policyManage,
			holdManage,
			overrideDecision
		] = await Promise.all([
			this.customers(this.db, actor.organisationId),
			this.db
				.selectFrom('receivable_credit_policies')
				.select([
					'id',
					'public_id as publicId',
					'customer_party_id as customerPartyId',
					'currency_code as currencyCode'
				])
				.where('organisation_id', '=', actor.organisationId)
				.orderBy('id', 'asc')
				.execute(),
			this.db
				.selectFrom('receivable_credit_holds')
				.select([
					'id',
					'public_id as publicId',
					'customer_party_id as customerPartyId',
					'status',
					'placed_reason as placedReason',
					'placed_at as placedAt',
					'released_reason as releasedReason',
					'released_at as releasedAt'
				])
				.where('organisation_id', '=', actor.organisationId)
				.orderBy('placed_at', 'desc')
				.limit(100)
				.execute(),
			this.db
				.selectFrom('receivable_credit_control_overrides')
				.select([
					'public_id as publicId',
					'customer_party_id as customerPartyId',
					'workflow_type as workflowType',
					'subject_public_id as subjectPublicId',
					'currency_code as currencyCode',
					'outstanding_amount as outstandingAmount',
					'commitment_amount as commitmentAmount',
					'projected_exposure_amount as projectedExposureAmount',
					'credit_limit_amount as creditLimitAmount',
					'reason',
					'authorised_at as authorisedAt'
				])
				.where('organisation_id', '=', actor.organisationId)
				.orderBy('authorised_at', 'desc')
				.limit(50)
				.execute(),
			access.mutationDecision(actor, 'finance.credit_control.policy.manage'),
			access.mutationDecision(actor, 'finance.credit_control.hold.manage'),
			access.mutationDecision(actor, 'finance.credit_control.override')
		]);
		const byId = new Map(customers.map((customer) => [customer.id, customer]));
		const policies: CreditPolicySummary[] = [];
		for (const row of policyRows) {
			const customer = byId.get(row.customerPartyId);
			if (!customer) continue;
			const state = await this.policyState(
				this.db,
				actor.organisationId,
				row.customerPartyId,
				row.currencyCode
			);
			if (!state) continue;
			const outstandingAmount = await customerOutstandingByCurrency(
				this.db,
				actor.organisationId,
				row.customerPartyId,
				row.currencyCode
			);
			const limitExhausted = Boolean(
				state.isEnabled &&
				state.creditLimitAmount !== null &&
				parseScaledDecimal(outstandingAmount, 4, 'Outstanding amount', true) >=
					parseScaledDecimal(state.creditLimitAmount, 4, 'Credit limit', true)
			);
			policies.push({
				id: row.id,
				publicId: row.publicId,
				customerPartyId: row.customerPartyId,
				customerPartyPublicId: customer.publicId,
				customerDisplayName: customer.displayName,
				currencyCode: row.currencyCode,
				versionNumber: state.versionNumber,
				isEnabled: state.isEnabled,
				creditLimitAmount: state.creditLimitAmount,
				outstandingAmount,
				availableAmount:
					state.isEnabled && state.creditLimitAmount !== null
						? subtractMoney(state.creditLimitAmount, outstandingAmount)
						: null,
				limitExhausted,
				reason: state.reason,
				updatedAt: state.updatedAt
			});
		}
		return {
			customers,
			policies,
			holds: holdRows.map((row) => {
				const customer = byId.get(row.customerPartyId);
				return {
					id: row.id,
					publicId: row.publicId,
					customerPartyId: row.customerPartyId,
					customerPartyPublicId: customer?.publicId ?? '',
					customerDisplayName: customer?.displayName ?? 'Unavailable customer',
					status: row.status,
					placedReason: row.placedReason,
					placedAt: row.placedAt,
					releasedReason: row.releasedReason,
					releasedAt: row.releasedAt
				};
			}),
			overrides: overrideRows.map((row) => {
				const customer = byId.get(row.customerPartyId);
				return {
					publicId: row.publicId,
					customerPartyPublicId: customer?.publicId ?? '',
					customerDisplayName: customer?.displayName ?? 'Unavailable customer',
					workflowType: row.workflowType as CreditControlWorkflow,
					subjectPublicId: row.subjectPublicId,
					currencyCode: row.currencyCode,
					outstandingAmount: row.outstandingAmount,
					commitmentAmount: row.commitmentAmount,
					projectedExposureAmount: row.projectedExposureAmount,
					creditLimitAmount: row.creditLimitAmount,
					reason: row.reason,
					authorisedAt: row.authorisedAt
				};
			}),
			canManagePolicies: policyManage.allowed,
			canManageHolds: holdManage.allowed,
			canOverride: overrideDecision.allowed
		};
	}

	async setLimit(
		actor: TenantActorContext,
		input: {
			customerPartyPublicId: string;
			currencyCode: string;
			limitAmount: string;
			reason: string;
		}
	): Promise<{ policyPublicId: string; revisionPublicId: string; versionNumber: number }> {
		const publicId = cleanCustomerPublicId(input.customerPartyPublicId);
		const currencyCode = validateCurrencyCode(input.currencyCode, 'Credit-limit currency');
		if (!currencyCode) throw new FinanceValidationError('Credit-limit currency is required.');
		const limitAmount = validateMoneyAmount(input.limitAmount, 'Credit limit');
		const reason = cleanFinanceText(input.reason, 1000, 'Credit-limit reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (
				!(await access.mutationDecision(actor, 'finance.credit_control.policy.manage', trx)).allowed
			)
				throw new TenantAccessError('Credit-limit management is not permitted.');
			const customer = await this.customerByPublicId(trx, actor.organisationId, publicId, true);
			if (!customer || customer.status !== 'active')
				throw new RecordNotFoundError('Customer not found.');
			const state = await this.policyState(
				trx,
				actor.organisationId,
				customer.id,
				currencyCode,
				true
			);
			let policyId: string;
			let policyPublicId: string;
			if (!state) {
				policyPublicId = this.publicIdFactory();
				policyId = insertedId(
					await trx
						.insertInto('receivable_credit_policies')
						.values({
							organisation_id: actor.organisationId,
							public_id: policyPublicId,
							customer_party_id: customer.id,
							currency_code: currencyCode,
							created_by_member_id: membership.id
						})
						.executeTakeFirstOrThrow()
				);
			} else {
				policyId = state.policyId;
				policyPublicId = state.policyPublicId;
			}
			const versionNumber = (state?.versionNumber ?? 0) + 1;
			const revisionPublicId = this.publicIdFactory();
			await trx
				.insertInto('receivable_credit_policy_revisions')
				.values({
					organisation_id: actor.organisationId,
					public_id: revisionPublicId,
					credit_policy_id: policyId,
					version_number: versionNumber,
					is_enabled: 1,
					credit_limit_amount: limitAmount,
					reason,
					created_by_member_id: membership.id
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'finance.credit_control.limit.set',
				subjectType: 'customer_credit_policy',
				subjectPublicId: policyPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					customerPartyPublicId: customer.publicId,
					currencyCode,
					limitAmount,
					versionNumber,
					reason
				}
			});
			return { policyPublicId, revisionPublicId, versionNumber };
		});
	}

	async disableLimit(
		actor: TenantActorContext,
		input: { customerPartyPublicId: string; currencyCode: string; reason: string }
	): Promise<void> {
		const publicId = cleanCustomerPublicId(input.customerPartyPublicId);
		const currencyCode = validateCurrencyCode(input.currencyCode, 'Credit-limit currency');
		if (!currencyCode) throw new FinanceValidationError('Credit-limit currency is required.');
		const reason = cleanFinanceText(input.reason, 1000, 'Credit-limit reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (
				!(await access.mutationDecision(actor, 'finance.credit_control.policy.manage', trx)).allowed
			)
				throw new TenantAccessError('Credit-limit management is not permitted.');
			const customer = await this.customerByPublicId(trx, actor.organisationId, publicId, true);
			if (!customer) throw new RecordNotFoundError('Credit-limit policy not found.');
			const state = await this.policyState(
				trx,
				actor.organisationId,
				customer.id,
				currencyCode,
				true
			);
			if (!state) throw new RecordNotFoundError('Credit-limit policy not found.');
			if (!state.isEnabled) return;
			const versionNumber = state.versionNumber + 1;
			await trx
				.insertInto('receivable_credit_policy_revisions')
				.values({
					organisation_id: actor.organisationId,
					public_id: this.publicIdFactory(),
					credit_policy_id: state.policyId,
					version_number: versionNumber,
					is_enabled: 0,
					credit_limit_amount: null,
					reason,
					created_by_member_id: membership.id
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'finance.credit_control.limit.disabled',
				subjectType: 'customer_credit_policy',
				subjectPublicId: state.policyPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					customerPartyPublicId: customer.publicId,
					currencyCode,
					versionNumber,
					reason
				}
			});
		});
	}

	async placeHold(
		actor: TenantActorContext,
		input: { customerPartyPublicId: string; reason: string }
	): Promise<string> {
		const publicId = cleanCustomerPublicId(input.customerPartyPublicId);
		const reason = cleanFinanceText(input.reason, 1000, 'Credit-hold reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (
				!(await access.mutationDecision(actor, 'finance.credit_control.hold.manage', trx)).allowed
			)
				throw new TenantAccessError('Credit-hold management is not permitted.');
			const customer = await this.customerByPublicId(trx, actor.organisationId, publicId, true);
			if (!customer || customer.status !== 'active')
				throw new RecordNotFoundError('Customer not found.');
			const existing = await this.activeHold(trx, actor.organisationId, customer.id, true);
			if (existing) return existing.publicId;
			const holdPublicId = this.publicIdFactory();
			await trx
				.insertInto('receivable_credit_holds')
				.values({
					organisation_id: actor.organisationId,
					public_id: holdPublicId,
					customer_party_id: customer.id,
					status: 'active',
					placed_reason: reason,
					placed_by_member_id: membership.id,
					placed_at: this.now(),
					released_reason: null,
					released_by_member_id: null,
					released_at: null
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'finance.credit_control.hold.placed',
				subjectType: 'customer_credit_hold',
				subjectPublicId: holdPublicId,
				correlationId: actor.correlationId,
				changeSummary: { customerPartyPublicId: customer.publicId, reason }
			});
			return holdPublicId;
		});
	}

	async releaseHold(
		actor: TenantActorContext,
		input: { holdPublicId: string; reason: string }
	): Promise<void> {
		const holdPublicId = input.holdPublicId.trim();
		if (!holdPublicId || holdPublicId.length > 64)
			throw new RecordNotFoundError('Credit hold not found.');
		const reason = cleanFinanceText(input.reason, 1000, 'Credit-hold release reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (
				!(await access.mutationDecision(actor, 'finance.credit_control.hold.manage', trx)).allowed
			)
				throw new TenantAccessError('Credit-hold management is not permitted.');
			const hold = await trx
				.selectFrom('receivable_credit_holds')
				.select(['id', 'public_id as publicId', 'customer_party_id as customerPartyId', 'status'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', holdPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!hold) throw new RecordNotFoundError('Credit hold not found.');
			if (hold.status === 'released') return;
			await this.customerById(trx, actor.organisationId, hold.customerPartyId, true);
			const releasedAt = this.now();
			await trx
				.updateTable('receivable_credit_holds')
				.set({
					status: 'released',
					released_reason: reason,
					released_by_member_id: membership.id,
					released_at: releasedAt
				})
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', hold.id)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'finance.credit_control.hold.released',
				subjectType: 'customer_credit_hold',
				subjectPublicId: hold.publicId,
				correlationId: actor.correlationId,
				changeSummary: { reason, releasedAt: releasedAt.toISOString() }
			});
		});
	}

	async commitmentPreview(
		actor: TenantActorContext,
		customerPartyId: string,
		currencyCodeInput: string,
		commitmentAmountInput: string | null | undefined = '0.0000'
	): Promise<CreditCommitmentPreview> {
		const currencyCode = validateCurrencyCode(currencyCodeInput, 'Credit-control currency');
		if (!currencyCode) throw new FinanceValidationError('Credit-control currency is required.');
		const access = new FinanceAccessPolicy(this.db);
		await access.assertActiveActor(actor);
		const customer = await this.customerById(this.db, actor.organisationId, customerPartyId);
		if (!customer) throw new RecordNotFoundError('Customer not found.');
		const [state, overrideDecision, financeView, creditView] = await Promise.all([
			this.rawState(
				this.db,
				actor.organisationId,
				customerPartyId,
				currencyCode,
				commitmentAmountInput
			),
			access.mutationDecision(actor, 'finance.credit_control.override'),
			access.viewDecision(actor),
			access.creditControlViewDecision(actor)
		]);
		const detailsVisible = financeView.allowed && creditView.allowed;
		return {
			blocked: Boolean(state.hold) || state.limitExhausted,
			hasActiveHold: Boolean(state.hold),
			limitExhausted: state.limitExhausted,
			canOverride: overrideDecision.allowed,
			detailsVisible,
			outstandingAmount: detailsVisible ? state.outstandingAmount : null,
			commitmentAmount: detailsVisible ? state.commitmentAmount : null,
			projectedExposureAmount: detailsVisible ? state.projectedExposureAmount : null,
			creditLimitAmount:
				detailsVisible && state.policy?.isEnabled ? state.policy.creditLimitAmount : null,
			currencyCode
		};
	}

	async enforceCommitment(
		actor: TenantActorContext,
		input: {
			customerPartyId: string;
			currencyCode: string;
			workflowType: CreditControlWorkflow;
			subjectPublicId: string;
			commitmentAmount?: string | null;
			overrideReason?: string | null;
		},
		db: DatabaseExecutor
	): Promise<void> {
		const currencyCode = validateCurrencyCode(input.currencyCode, 'Credit-control currency');
		if (!currencyCode) throw new FinanceValidationError('Credit-control currency is required.');
		const subjectPublicId = cleanFinanceText(
			input.subjectPublicId,
			64,
			'Credit-control subject',
			true
		)!;
		const access = new FinanceAccessPolicy(db);
		const membership = await access.assertActiveActor(actor, db);
		const state = await this.rawState(
			db,
			actor.organisationId,
			input.customerPartyId,
			currencyCode,
			input.commitmentAmount,
			true
		);
		const customer = await this.customerById(db, actor.organisationId, input.customerPartyId);
		if (!customer) throw new RecordNotFoundError('Customer not found.');
		if (!state.hold && !state.limitExhausted) return;
		const blockMessage =
			state.hold && state.limitExhausted
				? 'Credit control blocks new commitment because the customer has an active credit hold and the projected exposure exceeds the credit limit.'
				: state.hold
					? 'Credit control blocks new commitment because the customer has an active credit hold.'
					: 'Credit control blocks new commitment because the projected exposure exceeds the customer credit limit.';
		const overrideReason = cleanFinanceText(
			input.overrideReason,
			1000,
			'Credit-control override reason'
		);
		if (!overrideReason)
			throw new CreditControlBlockedError(
				`${blockMessage} A reasoned credit-control override is required to continue.`
			);
		const overrideDecision = await access.mutationDecision(
			actor,
			'finance.credit_control.override',
			db
		);
		if (!overrideDecision.allowed)
			throw new CreditControlBlockedError(
				`${blockMessage} Credit-control override authority is required.`
			);
		const overridePublicId = this.publicIdFactory();
		await db
			.insertInto('receivable_credit_control_overrides')
			.values({
				organisation_id: actor.organisationId,
				public_id: overridePublicId,
				customer_party_id: customer.id,
				credit_policy_id: state.limitExhausted ? (state.policy?.policyId ?? null) : null,
				credit_hold_id: state.hold?.id ?? null,
				workflow_type: input.workflowType,
				subject_public_id: subjectPublicId,
				currency_code: currencyCode,
				outstanding_amount: state.outstandingAmount,
				commitment_amount: state.commitmentAmount,
				projected_exposure_amount: state.projectedExposureAmount,
				credit_limit_amount: state.limitExhausted
					? (state.policy?.creditLimitAmount ?? null)
					: null,
				reason: overrideReason,
				authorised_by_member_id: membership.id,
				authorised_at: this.now()
			})
			.executeTakeFirstOrThrow();
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: membership.id,
			actionKey: 'finance.credit_control.override.authorised',
			subjectType: input.workflowType,
			subjectPublicId,
			correlationId: actor.correlationId,
			changeSummary: {
				overridePublicId,
				customerPartyPublicId: customer.publicId,
				currencyCode,
				outstandingAmount: state.outstandingAmount,
				commitmentAmount: state.commitmentAmount,
				projectedExposureAmount: state.projectedExposureAmount,
				creditLimitAmount: state.limitExhausted ? (state.policy?.creditLimitAmount ?? null) : null,
				holdPublicId: state.hold?.publicId ?? null,
				reason: overrideReason
			}
		});
	}
}
