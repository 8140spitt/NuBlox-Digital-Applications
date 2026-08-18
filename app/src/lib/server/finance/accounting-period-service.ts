import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	FinanceAccessPolicy,
	FinanceValidationError,
	cleanFinanceText,
	insertedId,
	validateFinanceDate
} from './finance-common';

export type AccountingPeriodStatus = 'open' | 'soft_closed' | 'hard_closed';

function cleanCode(value: string): string {
	const code = cleanFinanceText(value, 32, 'Financial year code', true)!;
	if (!/^[A-Za-z0-9._/-]+$/.test(code)) {
		throw new FinanceValidationError('Financial year code contains unsupported characters.');
	}
	return code;
}

function requiredDate(value: string, label: string): Date {
	const date = validateFinanceDate(value, label);
	if (!date) throw new FinanceValidationError(`${label} is required.`);
	return date;
}

function requiredPeriodNumber(value: number): number {
	if (!Number.isInteger(value) || value < 1 || value > 999) {
		throw new FinanceValidationError('Period number must be an integer between 1 and 999.');
	}
	return value;
}

async function lockOrganisation(db: DatabaseExecutor, organisationId: string): Promise<void> {
	await db.selectFrom('organisations').select('id').where('id', '=', organisationId).forUpdate().executeTakeFirstOrThrow();
}

async function periodForDate(
	db: DatabaseExecutor,
	organisationId: string,
	accountingDate: Date,
	lock = false
) {
	let query = db
		.selectFrom('accounting_periods')
		.select([
			'id',
			'public_id as publicId',
			'financial_year_id as financialYearId',
			'period_number as periodNumber',
			'name',
			'starts_on as startsOn',
			'ends_on as endsOn',
			'status'
		])
		.where('organisation_id', '=', organisationId)
		.where('starts_on', '<=', accountingDate)
		.where('ends_on', '>=', accountingDate)
		.orderBy('starts_on')
		.limit(2);
	if (lock) query = query.forUpdate();
	const rows = await query.execute();
	if (rows.length === 0) {
		throw new FinanceValidationError('No configured accounting period contains the selected accounting date.');
	}
	if (rows.length > 1) {
		throw new FinanceValidationError('Accounting period configuration overlaps for the selected accounting date.');
	}
	return rows[0]!;
}

async function exactPeriodForRange(
	db: DatabaseExecutor,
	organisationId: string,
	periodStart: Date,
	periodEnd: Date,
	lock = false
) {
	let query = db
		.selectFrom('accounting_periods')
		.select([
			'id',
			'public_id as publicId',
			'financial_year_id as financialYearId',
			'period_number as periodNumber',
			'name',
			'starts_on as startsOn',
			'ends_on as endsOn',
			'status'
		])
		.where('organisation_id', '=', organisationId)
		.where('starts_on', '=', periodStart)
		.where('ends_on', '=', periodEnd);
	if (lock) query = query.forUpdate();
	return query.executeTakeFirst();
}

export async function assertOpenAccountingPeriod(
	db: DatabaseExecutor,
	organisationId: string,
	accountingDate: Date
) {
	const period = await periodForDate(db, organisationId, accountingDate, true);
	if (period.status !== 'open') {
		throw new FinanceValidationError(`Accounting period ${period.name} is ${period.status.replace('_', ' ')}; posting is not permitted.`);
	}
	return period;
}

export async function assertAccountingExportPeriod(
	db: DatabaseExecutor,
	organisationId: string,
	periodStart: Date,
	periodEnd: Date
) {
	const period = await exactPeriodForRange(db, organisationId, periodStart, periodEnd, true);
	if (!period) {
		throw new FinanceValidationError('Accounting exports must match one configured accounting period exactly.');
	}
	if (period.status === 'open') {
		throw new FinanceValidationError('Close the accounting period before creating an accounting export.');
	}
	return period;
}

export async function assertAccountingExportReversalAllowed(
	db: DatabaseExecutor,
	organisationId: string,
	periodStart: Date,
	periodEnd: Date
): Promise<void> {
	const period = await exactPeriodForRange(db, organisationId, periodStart, periodEnd, true);
	if (period?.status === 'hard_closed') {
		throw new FinanceValidationError('Reopen the hard-closed accounting period before reversing its export evidence.');
	}
}

async function activeExportForJournal(db: DatabaseExecutor, organisationId: string, journalId: string) {
	return db
		.selectFrom('accounting_export_batch_entries as item')
		.innerJoin('accounting_export_batches as batch', (join) =>
			join
				.onRef('batch.id', '=', 'item.accounting_export_batch_id')
				.onRef('batch.organisation_id', '=', 'item.organisation_id')
		)
		.leftJoin('accounting_export_reversals as reversal', (join) =>
			join
				.onRef('reversal.accounting_export_batch_id', '=', 'batch.id')
				.onRef('reversal.organisation_id', '=', 'batch.organisation_id')
		)
		.select('batch.id')
		.where('item.organisation_id', '=', organisationId)
		.where('item.journal_entry_id', '=', journalId)
		.where('reversal.accounting_export_batch_id', 'is', null)
		.forUpdate()
		.executeTakeFirst();
}

async function unexportedJournalCount(
	db: DatabaseExecutor,
	organisationId: string,
	startsOn: Date,
	endsOn: Date,
	lock = false
): Promise<number> {
	let query = db
		.selectFrom('accounting_journal_entries')
		.select('id')
		.where('organisation_id', '=', organisationId)
		.where('accounting_date', '>=', startsOn)
		.where('accounting_date', '<=', endsOn)
		.orderBy('id');
	if (lock) query = query.forUpdate();
	const journals = await query.execute();
	let missing = 0;
	for (const journal of journals) {
		if (!(await activeExportForJournal(db, organisationId, journal.id))) missing += 1;
	}
	return missing;
}

export type AccountingPeriodWorkspace = {
	financialYears: Array<{
		publicId: string;
		yearCode: string;
		name: string;
		startsOn: Date;
		endsOn: Date;
		periods: Array<{
			publicId: string;
			periodNumber: number;
			name: string;
			startsOn: Date;
			endsOn: Date;
			status: string;
			unexportedJournalCount: number;
		}>;
	}>;
	recentEvents: Array<{
		publicId: string;
		periodPublicId: string;
		periodName: string;
		fromStatus: string;
		toStatus: string;
		reason: string;
		changedAt: Date;
	}>;
	canConfigure: boolean;
	canClose: boolean;
	canReopen: boolean;
};

export class AccountingPeriodService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertView(actor: TenantActorContext): Promise<FinanceAccessPolicy> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		if (!(await policy.viewDecision(actor)).allowed || !(await policy.accountingViewDecision(actor)).allowed) {
			throw new TenantAccessError('Accounting period viewing is not permitted.');
		}
		return policy;
	}

	async getWorkspace(actor: TenantActorContext): Promise<AccountingPeriodWorkspace> {
		const policy = await this.assertView(actor);
		const [configure, close, reopen] = await Promise.all([
			policy.mutationDecision(actor, 'finance.accounting.period.configure'),
			policy.mutationDecision(actor, 'finance.accounting.period.close'),
			policy.mutationDecision(actor, 'finance.accounting.period.reopen')
		]);
		const yearRows = await this.db
			.selectFrom('accounting_financial_years')
			.select([
				'id',
				'public_id as publicId',
				'year_code as yearCode',
				'name',
				'starts_on as startsOn',
				'ends_on as endsOn'
			])
			.where('organisation_id', '=', actor.organisationId)
			.orderBy('starts_on', 'desc')
			.execute();
		const financialYears: AccountingPeriodWorkspace['financialYears'] = [];
		for (const year of yearRows) {
			const periods = await this.db
				.selectFrom('accounting_periods')
				.select([
					'public_id as publicId',
					'period_number as periodNumber',
					'name',
					'starts_on as startsOn',
					'ends_on as endsOn',
					'status'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('financial_year_id', '=', year.id)
				.orderBy('period_number')
				.execute();
			financialYears.push({
				publicId: year.publicId,
				yearCode: year.yearCode,
				name: year.name,
				startsOn: year.startsOn,
				endsOn: year.endsOn,
				periods: await Promise.all(
					periods.map(async (period) => ({
						...period,
						unexportedJournalCount: await unexportedJournalCount(
							this.db,
							actor.organisationId,
							period.startsOn,
							period.endsOn
						)
					}))
				)
			});
		}
		const recentEvents = await this.db
			.selectFrom('accounting_period_status_events as event')
			.innerJoin('accounting_periods as period', (join) =>
				join.onRef('period.id', '=', 'event.accounting_period_id').onRef('period.organisation_id', '=', 'event.organisation_id')
			)
			.select([
				'event.public_id as publicId',
				'period.public_id as periodPublicId',
				'period.name as periodName',
				'event.from_status as fromStatus',
				'event.to_status as toStatus',
				'event.reason',
				'event.changed_at as changedAt'
			])
			.where('event.organisation_id', '=', actor.organisationId)
			.orderBy('event.changed_at', 'desc')
			.limit(100)
			.execute();
		return {
			financialYears,
			recentEvents,
			canConfigure: configure.allowed,
			canClose: close.allowed,
			canReopen: reopen.allowed
		};
	}

	async createFinancialYear(
		actor: TenantActorContext,
		input: { yearCode: string; name: string; startsOn: string; endsOn: string }
	): Promise<{ publicId: string }> {
		const yearCode = cleanCode(input.yearCode);
		const name = cleanFinanceText(input.name, 160, 'Financial year name', true)!;
		const startsOn = requiredDate(input.startsOn, 'Financial year start');
		const endsOn = requiredDate(input.endsOn, 'Financial year end');
		if (endsOn < startsOn) throw new FinanceValidationError('Financial year end must be on or after its start.');
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.period.configure', trx)).allowed) {
				throw new TenantAccessError('Accounting period configuration is not permitted.');
			}
			await lockOrganisation(trx, actor.organisationId);
			const overlap = await trx
				.selectFrom('accounting_financial_years')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('starts_on', '<=', endsOn)
				.where('ends_on', '>=', startsOn)
				.forUpdate()
				.executeTakeFirst();
			if (overlap) throw new FinanceValidationError('Financial years must not overlap.');
			const publicId = this.publicIdFactory();
			await trx
				.insertInto('accounting_financial_years')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					year_code: yearCode,
					name,
					starts_on: startsOn,
					ends_on: endsOn,
					created_by_member_id: membership.id
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.accounting.year.created',
				subjectType: 'accounting_financial_year',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { yearCode, name, startsOn, endsOn }
			});
			return { publicId };
		});
	}

	async createPeriod(
		actor: TenantActorContext,
		input: {
			financialYearPublicId: string;
			periodNumber: number;
			name: string;
			startsOn: string;
			endsOn: string;
		}
	): Promise<{ publicId: string }> {
		const financialYearPublicId = cleanFinanceText(input.financialYearPublicId, 64, 'Financial year ID', true)!;
		const periodNumber = requiredPeriodNumber(input.periodNumber);
		const name = cleanFinanceText(input.name, 120, 'Accounting period name', true)!;
		const startsOn = requiredDate(input.startsOn, 'Accounting period start');
		const endsOn = requiredDate(input.endsOn, 'Accounting period end');
		if (endsOn < startsOn) throw new FinanceValidationError('Accounting period end must be on or after its start.');
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.period.configure', trx)).allowed) {
				throw new TenantAccessError('Accounting period configuration is not permitted.');
			}
			await lockOrganisation(trx, actor.organisationId);
			const year = await trx
				.selectFrom('accounting_financial_years')
				.select(['id', 'starts_on as startsOn', 'ends_on as endsOn'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', financialYearPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!year) throw new RecordNotFoundError('Financial year not found.');
			if (startsOn < year.startsOn || endsOn > year.endsOn) {
				throw new FinanceValidationError('Accounting period must be fully contained within its financial year.');
			}
			const overlap = await trx
				.selectFrom('accounting_periods')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('starts_on', '<=', endsOn)
				.where('ends_on', '>=', startsOn)
				.forUpdate()
				.executeTakeFirst();
			if (overlap) throw new FinanceValidationError('Accounting periods must not overlap.');
			const publicId = this.publicIdFactory();
			await trx
				.insertInto('accounting_periods')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					financial_year_id: year.id,
					period_number: periodNumber,
					name,
					starts_on: startsOn,
					ends_on: endsOn,
					status: 'open',
					created_by_member_id: membership.id
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.accounting.period.created',
				subjectType: 'accounting_period',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { financialYearPublicId, periodNumber, name, startsOn, endsOn, status: 'open' }
			});
			return { publicId };
		});
	}

	async softClose(actor: TenantActorContext, periodPublicId: string, reason: string): Promise<void> {
		await this.transition(actor, periodPublicId, 'soft_closed', reason);
	}

	async hardClose(actor: TenantActorContext, periodPublicId: string, reason: string): Promise<void> {
		await this.transition(actor, periodPublicId, 'hard_closed', reason);
	}

	async reopen(actor: TenantActorContext, periodPublicId: string, reason: string): Promise<void> {
		await this.transition(actor, periodPublicId, 'open', reason, true);
	}

	private async transition(
		actor: TenantActorContext,
		periodPublicIdInput: string,
		toStatus: AccountingPeriodStatus,
		reasonInput: string,
		reopen = false
	): Promise<void> {
		const periodPublicId = cleanFinanceText(periodPublicIdInput, 64, 'Accounting period ID', true)!;
		const reason = cleanFinanceText(reasonInput, 1000, 'Accounting period status reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const permission = reopen ? 'finance.accounting.period.reopen' : 'finance.accounting.period.close';
			if (!(await policy.mutationDecision(actor, permission, trx)).allowed) {
				throw new TenantAccessError(reopen ? 'Accounting period reopening is not permitted.' : 'Accounting period closing is not permitted.');
			}
			await lockOrganisation(trx, actor.organisationId);
			const period = await trx
				.selectFrom('accounting_periods')
				.select(['id', 'public_id as publicId', 'name', 'starts_on as startsOn', 'ends_on as endsOn', 'status'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', periodPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!period) throw new RecordNotFoundError('Accounting period not found.');
			const fromStatus = period.status as AccountingPeriodStatus;
			if (toStatus === 'soft_closed' && fromStatus !== 'open') {
				throw new FinanceValidationError('Only an open accounting period can be soft-closed.');
			}
			if (toStatus === 'hard_closed') {
				if (fromStatus !== 'soft_closed') {
					throw new FinanceValidationError('Only a soft-closed accounting period can be hard-closed.');
				}
				const missing = await unexportedJournalCount(
					trx,
					actor.organisationId,
					period.startsOn,
					period.endsOn,
					true
				);
				if (missing > 0) {
					throw new FinanceValidationError(`Hard close is blocked until ${missing} journal${missing === 1 ? '' : 's'} have active accounting export evidence.`);
				}
			}
			if (toStatus === 'open' && fromStatus === 'open') {
				throw new FinanceValidationError('The accounting period is already open.');
			}
			await trx
				.updateTable('accounting_periods')
				.set({ status: toStatus })
				.where('id', '=', period.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			const eventPublicId = this.publicIdFactory();
			await trx
				.insertInto('accounting_period_status_events')
				.values({
					organisation_id: actor.organisationId,
					public_id: eventPublicId,
					accounting_period_id: period.id,
					from_status: fromStatus,
					to_status: toStatus,
					reason,
					changed_by_member_id: membership.id,
					changed_at: this.now()
				})
				.executeTakeFirstOrThrow();
			const actionKey = toStatus === 'soft_closed'
				? 'finance.accounting.period.soft_closed'
				: toStatus === 'hard_closed'
					? 'finance.accounting.period.hard_closed'
					: 'finance.accounting.period.reopened';
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey,
				subjectType: 'accounting_period',
				subjectPublicId: period.publicId,
				correlationId: actor.correlationId,
				changeSummary: { fromStatus, toStatus, reason, periodName: period.name, statusEventPublicId: eventPublicId }
			});
		});
	}
}
