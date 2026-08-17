import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { ensureDefaultUkTaxCategories } from '$lib/server/tax/tax-defaults';
import {
	FinanceAccessPolicy,
	FinanceValidationError,
	cleanFinanceText,
	validateFinanceDate
} from './finance-common';

const TAX_TREATMENTS = new Set(['taxable', 'zero', 'exempt', 'outside_scope']);

export type TaxRateSettingsRecord = {
	id: string;
	ratePercent: string;
	validFrom: Date;
	validTo: Date | null;
};

export type TaxCategorySettingsRecord = {
	id: string;
	publicId: string;
	code: string;
	name: string;
	treatment: string;
	isActive: boolean;
	rates: TaxRateSettingsRecord[];
};

export type TaxSettingsWorkspace = {
	categories: TaxCategorySettingsRecord[];
	canManage: boolean;
};

function isDuplicateKeyError(error: unknown): boolean {
	return Boolean(
		error && typeof error === 'object' && 'code' in error &&
		(error as { code?: unknown }).code === 'ER_DUP_ENTRY'
	);
}

function taxCode(value: string): string {
	const code = value.trim().toUpperCase();
	if (!/^[A-Z0-9_]{1,48}$/.test(code)) {
		throw new FinanceValidationError('Tax code must use 1–48 uppercase letters, numbers or underscores.');
	}
	return code;
}

function treatment(value: string): 'taxable' | 'zero' | 'exempt' | 'outside_scope' {
	const text = value.trim();
	if (!TAX_TREATMENTS.has(text)) throw new FinanceValidationError('Tax treatment is invalid.');
	return text as 'taxable' | 'zero' | 'exempt' | 'outside_scope';
}

function ratePercent(value: string, selectedTreatment: string): string | null {
	if (selectedTreatment === 'exempt' || selectedTreatment === 'outside_scope') return null;
	const parsed = parseScaledDecimal(value, 4, 'Tax rate', true);
	if (parsed < 0n || parsed > 1000000n) throw new FinanceValidationError('Tax rate must be between 0% and 100%.');
	if (selectedTreatment === 'zero' && parsed !== 0n) {
		throw new FinanceValidationError('Zero-rated tax categories must use a 0% rate.');
	}
	return formatScaledDecimal(parsed, 4);
}

function previousUtcDay(value: Date): Date {
	const previous = new Date(value);
	previous.setUTCDate(previous.getUTCDate() - 1);
	return previous;
}

export class TaxSettingsService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async assertView(actor: TenantActorContext): Promise<FinanceAccessPolicy> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		if (!(await policy.viewDecision(actor)).allowed) {
			throw new TenantAccessError('Tax settings viewing is not permitted.');
		}
		return policy;
	}

	async ensureDefaults(actor: TenantActorContext): Promise<void> {
		await this.assertView(actor);
		await this.db.transaction().execute(async (trx) => {
			await ensureDefaultUkTaxCategories(trx, actor.organisationId, this.publicIdFactory);
		});
	}

	async getWorkspace(actor: TenantActorContext): Promise<TaxSettingsWorkspace> {
		const policy = await this.assertView(actor);
		await this.db.transaction().execute(async (trx) => {
			await ensureDefaultUkTaxCategories(trx, actor.organisationId, this.publicIdFactory);
		});
		const [categoryRows, manageDecision] = await Promise.all([
			this.db
				.selectFrom('tax_categories')
				.select(['id', 'public_id as publicId', 'code', 'name', 'treatment', 'is_active as isActive'])
				.where('organisation_id', '=', actor.organisationId)
				.orderBy('name', 'asc')
				.execute(),
			policy.mutationDecision(actor, 'finance.billing.manage')
		]);
		const categories: TaxCategorySettingsRecord[] = [];
		for (const row of categoryRows) {
			const rates = await this.db
				.selectFrom('tax_category_rates')
				.select(['id', 'rate_percent as ratePercent', 'valid_from as validFrom', 'valid_to as validTo'])
				.where('organisation_id', '=', actor.organisationId)
				.where('tax_category_id', '=', row.id)
				.orderBy('valid_from', 'desc')
				.execute();
			categories.push({
				id: row.id,
				publicId: row.publicId,
				code: row.code,
				name: row.name,
				treatment: row.treatment,
				isActive: row.isActive === 1,
				rates
			});
		}
		return { categories, canManage: manageDecision.allowed };
	}

	async createCategory(actor: TenantActorContext, input: {
		code: string;
		name: string;
		treatment: string;
		ratePercent?: string | null;
		validFrom?: string | null;
	}): Promise<string> {
		const code = taxCode(input.code);
		const name = cleanFinanceText(input.name, 160, 'Tax category name', true)!;
		const selectedTreatment = treatment(input.treatment);
		const rate = ratePercent(input.ratePercent ?? '', selectedTreatment);
		const validFrom = rate === null ? null : validateFinanceDate(input.validFrom, 'Tax rate start date');
		if (rate !== null && !validFrom) throw new FinanceValidationError('Tax rate start date is required.');

		try {
			return await this.db.transaction().execute(async (trx) => {
				const policy = new FinanceAccessPolicy(trx);
				const membership = await policy.assertActiveActor(actor, trx);
				if (!(await policy.mutationDecision(actor, 'finance.billing.manage', trx)).allowed) {
					throw new TenantAccessError('Tax settings management is not permitted.');
				}
				const publicId = this.publicIdFactory();
				const result = await trx
					.insertInto('tax_categories')
					.values({
						organisation_id: actor.organisationId,
						public_id: publicId,
						code,
						name,
						treatment: selectedTreatment,
						is_active: 1
					})
					.executeTakeFirstOrThrow();
				if (result.insertId === undefined) throw new Error('Tax-category insert did not return an ID.');
				const categoryId = result.insertId.toString();
				if (rate !== null && validFrom) {
					await trx
						.insertInto('tax_category_rates')
						.values({
							organisation_id: actor.organisationId,
							tax_category_id: categoryId,
							rate_percent: rate,
							valid_from: validFrom,
							valid_to: null
						})
						.executeTakeFirstOrThrow();
				}
				await new AuditRepository(trx).append({
					eventPublicId: this.publicIdFactory(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: membership.id,
					projectId: null,
					actionKey: 'finance.tax_category.created',
					subjectType: 'tax_category',
					subjectPublicId: publicId,
					correlationId: actor.correlationId,
					changeSummary: { code, name, treatment: selectedTreatment, ratePercent: rate, validFrom }
				});
				return publicId;
			});
		} catch (cause) {
			if (isDuplicateKeyError(cause)) throw new FinanceValidationError('A tax category with that code already exists.');
			throw cause;
		}
	}

	async addRate(actor: TenantActorContext, input: {
		categoryPublicId: string;
		ratePercent: string;
		validFrom: string;
	}): Promise<void> {
		const categoryPublicId = cleanFinanceText(input.categoryPublicId, 64, 'Tax category ID', true)!;
		const validFrom = validateFinanceDate(input.validFrom, 'Tax rate start date');
		if (!validFrom) throw new FinanceValidationError('Tax rate start date is required.');

		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.billing.manage', trx)).allowed) {
				throw new TenantAccessError('Tax settings management is not permitted.');
			}
			const category = await trx
				.selectFrom('tax_categories')
				.select(['id', 'public_id as publicId', 'code', 'name', 'treatment'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', categoryPublicId)
				.where('is_active', '=', 1)
				.forUpdate()
				.executeTakeFirst();
			if (!category) throw new RecordNotFoundError('Tax category not found.');
			if (category.treatment === 'exempt' || category.treatment === 'outside_scope') {
				throw new FinanceValidationError('Exempt and outside-scope categories do not use percentage rates.');
			}
			const rate = ratePercent(input.ratePercent, category.treatment);
			if (rate === null) throw new FinanceValidationError('A tax rate is required.');
			const rates = await trx
				.selectFrom('tax_category_rates')
				.select(['id', 'valid_from as validFrom', 'valid_to as validTo'])
				.where('organisation_id', '=', actor.organisationId)
				.where('tax_category_id', '=', category.id)
				.orderBy('valid_from', 'desc')
				.forUpdate()
				.execute();
			const latest = rates[0] ?? null;
			if (latest && validFrom <= latest.validFrom) {
				throw new FinanceValidationError('A new tax rate must start after the latest existing rate period.');
			}
			if (latest?.validTo && latest.validTo >= validFrom) {
				throw new FinanceValidationError('The new tax rate overlaps the latest existing rate period.');
			}
			if (latest && latest.validTo === null) {
				await trx
					.updateTable('tax_category_rates')
					.set({ valid_to: previousUtcDay(validFrom) })
					.where('organisation_id', '=', actor.organisationId)
					.where('id', '=', latest.id)
					.executeTakeFirstOrThrow();
			}
			await trx
				.insertInto('tax_category_rates')
				.values({
					organisation_id: actor.organisationId,
					tax_category_id: category.id,
					rate_percent: rate,
					valid_from: validFrom,
					valid_to: null
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.tax_rate.created',
				subjectType: 'tax_category',
				subjectPublicId: category.publicId,
				correlationId: actor.correlationId,
				changeSummary: { ratePercent: rate, validFrom, previousRateClosed: latest?.validTo === null }
			});
		});
	}
}
