import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy, FinanceValidationError, cleanFinanceText } from './finance-common';

export class AccountingYearEndConfigurationService {
	constructor(private readonly db: Database = getDatabase()) {}

	async getConfiguration(actor: TenantActorContext) {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		const [financeView, accountingView, configure] = await Promise.all([
			policy.viewDecision(actor),
			policy.accountingViewDecision(actor),
			policy.mutationDecision(actor, 'finance.accounting.configure')
		]);
		if (!financeView.allowed || !accountingView.allowed) throw new TenantAccessError('Year-end accounting configuration is not permitted.');
		const [accounts, mapping] = await Promise.all([
			this.db.selectFrom('accounting_accounts').select(['public_id as publicId', 'account_code as accountCode', 'name']).where('organisation_id', '=', actor.organisationId).where('account_type', '=', 'equity').where('is_active', '=', 1).orderBy('account_code').execute(),
			this.db.selectFrom('accounting_account_mappings as mapping').innerJoin('accounting_accounts as account', (join) => join.onRef('account.id', '=', 'mapping.accounting_account_id').onRef('account.organisation_id', '=', 'mapping.organisation_id')).select(['account.public_id as accountPublicId', 'account.account_code as accountCode', 'account.name']).where('mapping.organisation_id', '=', actor.organisationId).where('mapping.mapping_key', '=', 'retained_earnings').executeTakeFirst()
		]);
		return { retainedEarningsAccounts: accounts, retainedEarningsMapping: mapping ?? null, canConfigureRetainedEarnings: configure.allowed };
	}

	async assignRetainedEarnings(actor: TenantActorContext, input: { accountPublicId: string; reason: string }): Promise<void> {
		const accountPublicId = cleanFinanceText(input.accountPublicId, 64, 'Retained earnings account ID', true)!;
		const reason = cleanFinanceText(input.reason, 1000, 'Mapping reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.configure', trx)).allowed) throw new TenantAccessError('Accounting configuration is not permitted.');
			await trx.selectFrom('organisations').select('id').where('id', '=', actor.organisationId).forUpdate().executeTakeFirstOrThrow();
			const account = await trx.selectFrom('accounting_accounts').select(['id', 'account_code as accountCode', 'name', 'account_type as accountType', 'is_active as isActive']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', accountPublicId).forUpdate().executeTakeFirst();
			if (!account) throw new RecordNotFoundError('Accounting account not found.');
			if (account.accountType !== 'equity' || account.isActive !== 1) throw new FinanceValidationError('Retained earnings must map to an active equity account.');
			await trx.insertInto('accounting_account_mappings').values({ organisation_id: actor.organisationId, mapping_key: 'retained_earnings', accounting_account_id: account.id, assigned_by_member_id: membership.id, assigned_at: new Date(), reason }).onDuplicateKeyUpdate({ accounting_account_id: account.id, assigned_by_member_id: membership.id, assigned_at: new Date(), reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: randomUUID(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.accounting.mapping.assigned', subjectType: 'accounting_mapping', subjectPublicId: 'retained_earnings', correlationId: actor.correlationId, changeSummary: { mappingKey: 'retained_earnings', accountPublicId, accountCode: account.accountCode, reason } });
		});
	}
}
