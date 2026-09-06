import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy } from './finance-common';

export type PaymentTermTemplateRecord = {
	code: string;
	name: string;
	termKind: string;
	calculationBasis: string;
	daysOffset: number;
	dayType: string;
	monthOffset: number;
	fixedDayOfMonth: number | null;
	businessDayConvention: string;
	invoiceCompatible: boolean;
	description: string | null;
};

export type PaymentTermCatalogue = {
	templates: PaymentTermTemplateRecord[];
	invoiceCompatibleCount: number;
};

export type ProvisionPaymentTermsResult = {
	created: number;
	alreadyPresent: number;
};

type TemplateRow = {
	code: string;
	name: string;
	termKind: string;
	calculationBasis: string;
	daysOffset: number;
	dayType: string;
	monthOffset: number;
	fixedDayOfMonth: number | null;
	businessDayConvention: string;
	invoiceCompatible: number;
	description: string | null;
};

export class PaymentTermCatalogueService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async templateRows(invoiceCompatibleOnly = false): Promise<TemplateRow[]> {
		const result = await sql<TemplateRow>`
			SELECT
				code,
				name,
				term_kind AS termKind,
				calculation_basis AS calculationBasis,
				days_offset AS daysOffset,
				day_type AS dayType,
				month_offset AS monthOffset,
				fixed_day_of_month AS fixedDayOfMonth,
				business_day_convention AS businessDayConvention,
				is_invoice_compatible AS invoiceCompatible,
				description
			FROM payment_term_templates
			WHERE is_active = 1
			${invoiceCompatibleOnly ? sql`AND is_invoice_compatible = 1` : sql``}
			ORDER BY name ASC
		`.execute(this.db);
		return result.rows;
	}

	async getCatalogue(actor: TenantActorContext): Promise<PaymentTermCatalogue> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		const view = await policy.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Accounts-receivable viewing is not permitted.');
		const rows = await this.templateRows();
		return {
			templates: rows.map((row) => ({
				...row,
				invoiceCompatible: row.invoiceCompatible === 1
			})),
			invoiceCompatibleCount: rows.filter((row) => row.invoiceCompatible === 1).length
		};
	}

	async provisionInvoiceCompatibleTerms(
		actor: TenantActorContext
	): Promise<ProvisionPaymentTermsResult> {
		return this.db.transaction().execute(async (trx) => {
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

			const templatesResult = await sql<TemplateRow>`
				SELECT
					code,
					name,
					term_kind AS termKind,
					calculation_basis AS calculationBasis,
					days_offset AS daysOffset,
					day_type AS dayType,
					month_offset AS monthOffset,
					fixed_day_of_month AS fixedDayOfMonth,
					business_day_convention AS businessDayConvention,
					is_invoice_compatible AS invoiceCompatible,
					description
				FROM payment_term_templates
				WHERE is_active = 1 AND is_invoice_compatible = 1
				ORDER BY code ASC
			`.execute(trx);

			const existing = await trx
				.selectFrom('payment_terms')
				.select(['id', 'name'])
				.where('organisation_id', '=', actor.organisationId)
				.execute();
			const byName = new Map(existing.map((row) => [row.name.toLocaleLowerCase(), row.id]));

			let created = 0;
			let alreadyPresent = 0;
			for (const template of templatesResult.rows) {
				let paymentTermId = byName.get(template.name.toLocaleLowerCase()) ?? null;
				let paymentTermPublicId: string | null = null;
				if (!paymentTermId) {
					paymentTermPublicId = this.publicIdFactory();
					await trx
						.insertInto('payment_terms')
						.values({
							organisation_id: actor.organisationId,
							public_id: paymentTermPublicId,
							name: template.name,
							calculation_basis: template.calculationBasis,
							days_offset: template.daysOffset,
							is_default: 0,
							is_active: 1
						})
						.executeTakeFirstOrThrow();
					const inserted = await trx
						.selectFrom('payment_terms')
						.select('id')
						.where('organisation_id', '=', actor.organisationId)
						.where('public_id', '=', paymentTermPublicId)
						.executeTakeFirstOrThrow();
					paymentTermId = inserted.id;
					byName.set(template.name.toLocaleLowerCase(), paymentTermId);
					created += 1;
					await new AuditRepository(trx).append({
						eventPublicId: this.publicIdFactory(),
						actingOrganisationId: actor.organisationId,
						actorUserId: actor.userId,
						actorMemberId: membership.id,
						actionKey: 'finance.payment_term.created',
						subjectType: 'payment_term',
						subjectPublicId: paymentTermPublicId,
						correlationId: actor.correlationId,
						changeSummary: {
							name: template.name,
							calculationBasis: template.calculationBasis,
							daysOffset: template.daysOffset,
							sourceTemplateCode: template.code
						}
					});
				} else {
					alreadyPresent += 1;
				}

				await sql`
					INSERT INTO payment_term_rules (
						payment_term_id,
						organisation_id,
						source_template_code,
						term_kind,
						day_type,
						month_offset,
						fixed_day_of_month,
						business_day_convention,
						description
					)
					VALUES (
						${paymentTermId},
						${actor.organisationId},
						${template.code},
						${template.termKind},
						${template.dayType},
						${template.monthOffset},
						${template.fixedDayOfMonth},
						${template.businessDayConvention},
						${template.description}
					)
					ON DUPLICATE KEY UPDATE
						source_template_code = VALUES(source_template_code),
						term_kind = VALUES(term_kind),
						day_type = VALUES(day_type),
						month_offset = VALUES(month_offset),
						fixed_day_of_month = VALUES(fixed_day_of_month),
						business_day_convention = VALUES(business_day_convention),
						description = VALUES(description)
				`.execute(trx);
			}

			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'finance.payment_term.catalogue_provisioned',
				subjectType: 'organisation',
				subjectPublicId: actor.organisationId,
				correlationId: actor.correlationId,
				changeSummary: { created, alreadyPresent }
			});

			return { created, alreadyPresent };
		});
	}
}
