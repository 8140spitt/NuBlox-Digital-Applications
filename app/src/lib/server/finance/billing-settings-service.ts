import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	FinanceAccessPolicy,
	FinanceValidationError,
	PAYMENT_TERM_BASES,
	cleanFinanceText,
	validateCurrencyCode
} from './finance-common';

export type PaymentTermRecord = {
	id: string;
	publicId: string;
	name: string;
	calculationBasis: string;
	daysOffset: number;
	isDefault: boolean;
	isActive: boolean;
};

export type PartyBillingRecord = {
	partyId: string;
	partyPublicId: string;
	displayName: string;
	partyKind: string;
	defaultPaymentTermPublicId: string | null;
	defaultPaymentTermName: string | null;
	defaultCurrencyCode: string | null;
	customerAccountReference: string | null;
	purchaseOrderRequired: boolean;
};

export type BillingSettingsWorkspace = {
	paymentTerms: PaymentTermRecord[];
	parties: PartyBillingRecord[];
	canManage: boolean;
};

function partyDisplayName(row: {
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

function isDuplicateKeyError(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		(error as { code?: unknown }).code === 'ER_DUP_ENTRY'
	);
}

export class BillingSettingsService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async paymentTerms(
		db: DatabaseExecutor,
		organisationId: string
	): Promise<PaymentTermRecord[]> {
		const rows = await db
			.selectFrom('payment_terms')
			.select([
				'id',
				'public_id as publicId',
				'name',
				'calculation_basis as calculationBasis',
				'days_offset as daysOffset',
				'is_default as isDefault',
				'is_active as isActive'
			])
			.where('organisation_id', '=', organisationId)
			.orderBy('is_default', 'desc')
			.orderBy('name', 'asc')
			.execute();
		return rows.map((row) => ({
			...row,
			isDefault: row.isDefault === 1,
			isActive: row.isActive === 1
		}));
	}

	async getWorkspace(actor: TenantActorContext): Promise<BillingSettingsWorkspace> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		const view = await policy.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Accounts-receivable viewing is not permitted.');
		const [paymentTerms, manage, partyRows] = await Promise.all([
			this.paymentTerms(this.db, actor.organisationId),
			policy.mutationDecision(actor, 'finance.billing.manage'),
			this.db
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
				.leftJoin('party_billing_settings as settings', (join) =>
					join
						.onRef('settings.party_id', '=', 'party.id')
						.onRef('settings.organisation_id', '=', 'party.organisation_id')
				)
				.leftJoin('payment_terms as term', (join) =>
					join
						.onRef('term.id', '=', 'settings.default_payment_term_id')
						.onRef('term.organisation_id', '=', 'party.organisation_id')
				)
				.select([
					'party.id as partyId',
					'party.public_id as partyPublicId',
					'party.party_kind as partyKind',
					'person.preferred_name as preferredName',
					'person.given_names as givenNames',
					'person.family_name as familyName',
					'company.legal_name as legalName',
					'company.trading_name as tradingName',
					'term.public_id as defaultPaymentTermPublicId',
					'term.name as defaultPaymentTermName',
					'settings.default_currency_code as defaultCurrencyCode',
					'settings.customer_account_reference as customerAccountReference',
					'settings.purchase_order_required as purchaseOrderRequired'
				])
				.where('party.organisation_id', '=', actor.organisationId)
				.orderBy('party.id', 'asc')
				.execute()
		]);
		return {
			paymentTerms,
			parties: partyRows.map((row) => ({
				partyId: row.partyId,
				partyPublicId: row.partyPublicId,
				displayName: partyDisplayName(row),
				partyKind: row.partyKind,
				defaultPaymentTermPublicId: row.defaultPaymentTermPublicId ?? null,
				defaultPaymentTermName: row.defaultPaymentTermName ?? null,
				defaultCurrencyCode: row.defaultCurrencyCode ?? null,
				customerAccountReference: row.customerAccountReference ?? null,
				purchaseOrderRequired: row.purchaseOrderRequired === 1
			})),
			canManage: manage.allowed
		};
	}

	async createPaymentTerm(
		actor: TenantActorContext,
		input: {
			name: string;
			calculationBasis: string;
			daysOffset: number;
			isDefault: boolean;
		}
	): Promise<string> {
		const name = cleanFinanceText(input.name, 160, 'Payment term name', true)!;
		const calculationBasis = input.calculationBasis.trim();
		if (!PAYMENT_TERM_BASES.has(calculationBasis))
			throw new FinanceValidationError('Payment-term calculation basis is invalid.');
		if (
			!Number.isSafeInteger(input.daysOffset) ||
			input.daysOffset < 0 ||
			input.daysOffset > 65535
		) {
			throw new FinanceValidationError('Payment-term day offset is invalid.');
		}
		if (calculationBasis === 'manual' && input.daysOffset !== 0) {
			throw new FinanceValidationError('Manual payment terms must use a zero day offset.');
		}
		try {
			return await this.db.transaction().execute(async (trx) => {
				const policy = new FinanceAccessPolicy(trx);
				const membership = await policy.assertActiveActor(actor, trx);
				const decision = await policy.mutationDecision(actor, 'finance.billing.manage', trx);
				if (!decision.allowed)
					throw new TenantAccessError('Billing settings management is not permitted.');
				await trx
					.selectFrom('organisations')
					.select('id')
					.where('id', '=', actor.organisationId)
					.forUpdate()
					.executeTakeFirstOrThrow();
				if (input.isDefault) {
					await trx
						.updateTable('payment_terms')
						.set({ is_default: 0 })
						.where('organisation_id', '=', actor.organisationId)
						.where('is_default', '=', 1)
						.execute();
				}
				const publicId = this.publicIdFactory();
				await trx
					.insertInto('payment_terms')
					.values({
						organisation_id: actor.organisationId,
						public_id: publicId,
						name,
						calculation_basis: calculationBasis,
						days_offset: input.daysOffset,
						is_default: input.isDefault ? 1 : 0,
						is_active: 1
					})
					.executeTakeFirstOrThrow();
				await new AuditRepository(trx).append({
					eventPublicId: this.publicIdFactory(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: membership.id,
					actionKey: 'finance.payment_term.created',
					subjectType: 'payment_term',
					subjectPublicId: publicId,
					correlationId: actor.correlationId,
					changeSummary: {
						name,
						calculationBasis,
						daysOffset: input.daysOffset,
						isDefault: input.isDefault
					}
				});
				return publicId;
			});
		} catch (cause) {
			if (isDuplicateKeyError(cause))
				throw new FinanceValidationError('A payment term with that name already exists.');
			throw cause;
		}
	}

	async setPartyBillingSettings(
		actor: TenantActorContext,
		input: {
			partyPublicId: string;
			defaultPaymentTermPublicId?: string | null;
			defaultCurrencyCode?: string | null;
			customerAccountReference?: string | null;
			purchaseOrderRequired: boolean;
		}
	): Promise<void> {
		const partyPublicId = cleanFinanceText(input.partyPublicId, 64, 'Party ID', true)!;
		const currencyCode = validateCurrencyCode(input.defaultCurrencyCode);
		const accountReference = cleanFinanceText(
			input.customerAccountReference,
			120,
			'Customer account reference'
		);
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.billing.manage', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Billing settings management is not permitted.');
			const party = await trx
				.selectFrom('parties')
				.select(['id', 'public_id as publicId'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', partyPublicId)
				.executeTakeFirst();
			if (!party) throw new RecordNotFoundError('Customer party not found.');
			let paymentTermId: string | null = null;
			const termPublicId = input.defaultPaymentTermPublicId?.trim() ?? '';
			if (termPublicId) {
				const term = await trx
					.selectFrom('payment_terms')
					.select('id')
					.where('organisation_id', '=', actor.organisationId)
					.where('public_id', '=', termPublicId)
					.where('is_active', '=', 1)
					.executeTakeFirst();
				if (!term) throw new FinanceValidationError('Default payment term is unavailable.');
				paymentTermId = term.id;
			}
			const existing = await trx
				.selectFrom('party_billing_settings')
				.select('party_id')
				.where('party_id', '=', party.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirst();
			if (existing) {
				await trx
					.updateTable('party_billing_settings')
					.set({
						default_payment_term_id: paymentTermId,
						default_currency_code: currencyCode,
						customer_account_reference: accountReference,
						purchase_order_required: input.purchaseOrderRequired ? 1 : 0
					})
					.where('party_id', '=', party.id)
					.where('organisation_id', '=', actor.organisationId)
					.executeTakeFirstOrThrow();
			} else {
				await trx
					.insertInto('party_billing_settings')
					.values({
						party_id: party.id,
						organisation_id: actor.organisationId,
						default_payment_term_id: paymentTermId,
						default_currency_code: currencyCode,
						customer_account_reference: accountReference,
						purchase_order_required: input.purchaseOrderRequired ? 1 : 0
					})
					.executeTakeFirstOrThrow();
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'finance.party_billing_settings.updated',
				subjectType: 'party',
				subjectPublicId: party.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					defaultPaymentTermPublicId: termPublicId || null,
					defaultCurrencyCode: currencyCode,
					customerAccountReference: accountReference,
					purchaseOrderRequired: input.purchaseOrderRequired
				}
			});
		});
	}
}
