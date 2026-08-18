import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	FinanceAccessPolicy,
	FinanceValidationError,
	cleanFinanceText,
	validateFinanceDate
} from './finance-common';

export type AccountingPeriodState = 'open' | 'soft_closed' | 'hard_closed';
export type AccountingEvidenceKind = 'posting' | 'reversal' | 'export';

export type AccountingPeriodSummary = {
	publicId: string;
	financialYearPublicId: string;
	financialYearName: string;
	periodNumber: number;
	name: string;
	startsOn: Date;
	endsOn: Date;
	state: AccountingPeriodState;
	stateVersion: number;
};

type PeriodRow = AccountingPeriodSummary & { id: string };

function requiredDate(value: string | null | undefined, label: string): Date {
	const date = validateFinanceDate(value, label);
	if (!date) throw new FinanceValidationError(`${label} is required.`);
	return date;
}

function dateKey(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function transitionAllowed(from: AccountingPeriodState, to: AccountingPeriodState): boolean {
	return (
		(from === 'open' && (to === 'soft_closed' || to === 'hard_closed')) ||
		(from === 'soft_closed' && (to === 'open' || to === 'hard_closed')) ||
		(from === 'hard_closed' && to === 'open')
	);
}

async function findPeriodForDate(
	db: DatabaseExecutor,
	organisationId: string,
	accountingDate: Date,
	lock = false
): Promise<PeriodRow | undefined> {
	const query = sql<PeriodRow>`
		SELECT
			period.id,
			period.public_id AS publicId,
			year.public_id AS financialYearPublicId,
			year.name AS financialYearName,
			period.period_number AS periodNumber,
			period.name,
			period.starts_on AS startsOn,
			period.ends_on AS endsOn,
			period.state,
			period.state_version AS stateVersion
		FROM accounting_periods AS period
		INNER JOIN accounting_financial_years AS year
			ON year.id = period.financial_year_id
			AND year.organisation_id = period.organisation_id
		WHERE period.organisation_id = ${organisationId}
			AND period.starts_on <= ${accountingDate}
			AND period.ends_on >= ${accountingDate}
		LIMIT 1
		${lock ? sql`FOR UPDATE` : sql``}
	`;
	return (await query.execute(db)).rows[0];
}

export async function assertAccountingDateEligible(
	db: DatabaseExecutor,
	organisationId: string,
	accountingDate: Date,
	kind: AccountingEvidenceKind
): Promise<AccountingPeriodSummary> {
	const period = await findPeriodForDate(db, organisationId, accountingDate, true);
	if (!period) {
		throw new FinanceValidationError(`No configured accounting period contains ${dateKey(accountingDate)}.`);
	}
	if (period.state === 'hard_closed') {
		throw new FinanceValidationError(`Accounting period ${period.name} is hard closed.`);
	}
	if (period.state === 'soft_closed' && kind === 'posting') {
		throw new FinanceValidationError(`Accounting period ${period.name} is soft closed for routine posting.`);
	}
	return period;
}

export class AccountingPeriodService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	async list(actor: TenantActorContext): Promise<AccountingPeriodSummary[]> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		if (!(await policy.viewDecision(actor)).allowed || !(await policy.mutationDecision(actor, 'finance.accounting.period.view')).allowed) {
			throw new TenantAccessError('Accounting-period viewing is not permitted.');
		}
		const result = await sql<AccountingPeriodSummary>`
			SELECT
				period.public_id AS publicId,
				year.public_id AS financialYearPublicId,
				year.name AS financialYearName,
				period.period_number AS periodNumber,
				period.name,
				period.starts_on AS startsOn,
				period.ends_on AS endsOn,
				period.state,
				period.state_version AS stateVersion
			FROM accounting_periods AS period
			INNER JOIN accounting_financial_years AS year
				ON year.id = period.financial_year_id
				AND year.organisation_id = period.organisation_id
			WHERE period.organisation_id = ${actor.organisationId}
			ORDER BY period.starts_on DESC, period.period_number DESC
		`.execute(this.db);
		return result.rows;
	}

	async createFinancialYear(
		actor: TenantActorContext,
		input: { name: string; startsOn: string; endsOn: string }
	): Promise<{ publicId: string }> {
		const name = cleanFinanceText(input.name, 80, 'Financial-year name', true)!;
		const startsOn = requiredDate(input.startsOn, 'Financial-year start');
		const endsOn = requiredDate(input.endsOn, 'Financial-year end');
		if (endsOn < startsOn) throw new FinanceValidationError('Financial-year end must not precede its start.');

		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.period.configure', trx)).allowed) {
				throw new TenantAccessError('Accounting-period configuration is not permitted.');
			}
			await trx.selectFrom('organisations').select('id').where('id', '=', actor.organisationId).forUpdate().executeTakeFirstOrThrow();
			const overlap = await sql<{ id: string }>`
				SELECT id
				FROM accounting_financial_years
				WHERE organisation_id = ${actor.organisationId}
					AND starts_on <= ${endsOn}
					AND ends_on >= ${startsOn}
				LIMIT 1
				FOR UPDATE
			`.execute(trx);
			if (overlap.rows.length > 0) throw new FinanceValidationError('Financial years must not overlap.');

			const publicId = this.publicIdFactory();
			await sql`
				INSERT INTO accounting_financial_years
					(organisation_id, public_id, name, starts_on, ends_on, created_by_member_id, created_at)
				VALUES
					(${actor.organisationId}, ${publicId}, ${name}, ${startsOn}, ${endsOn}, ${membership.id}, ${this.now()})
			`.execute(trx);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.accounting.financial-year.created',
				subjectType: 'accounting_financial_year',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { name, startsOn: dateKey(startsOn), endsOn: dateKey(endsOn) }
			});
			return { publicId };
		});
	}

	async createPeriod(
		actor: TenantActorContext,
		input: { financialYearPublicId: string; periodNumber: number; name: string; startsOn: string; endsOn: string }
	): Promise<{ publicId: string }> {
		const financialYearPublicId = cleanFinanceText(input.financialYearPublicId, 64, 'Financial-year ID', true)!;
		const name = cleanFinanceText(input.name, 80, 'Accounting-period name', true)!;
		const startsOn = requiredDate(input.startsOn, 'Accounting-period start');
		const endsOn = requiredDate(input.endsOn, 'Accounting-period end');
		if (!Number.isInteger(input.periodNumber) || input.periodNumber < 1 || input.periodNumber > 999) {
			throw new FinanceValidationError('Accounting-period number must be an integer from 1 to 999.');
		}
		if (endsOn < startsOn) throw new FinanceValidationError('Accounting-period end must not precede its start.');

		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.period.configure', trx)).allowed) {
				throw new TenantAccessError('Accounting-period configuration is not permitted.');
			}
			await trx.selectFrom('organisations').select('id').where('id', '=', actor.organisationId).forUpdate().executeTakeFirstOrThrow();
			const yearResult = await sql<{ id: string; startsOn: Date; endsOn: Date }>`
				SELECT id, starts_on AS startsOn, ends_on AS endsOn
				FROM accounting_financial_years
				WHERE organisation_id = ${actor.organisationId}
					AND public_id = ${financialYearPublicId}
				LIMIT 1
				FOR UPDATE
			`.execute(trx);
			const year = yearResult.rows[0];
			if (!year) throw new RecordNotFoundError('Financial year not found.');
			if (startsOn < year.startsOn || endsOn > year.endsOn) {
				throw new FinanceValidationError('Accounting period must be contained by its financial year.');
			}
			const overlap = await sql<{ id: string }>`
				SELECT id
				FROM accounting_periods
				WHERE organisation_id = ${actor.organisationId}
					AND starts_on <= ${endsOn}
					AND ends_on >= ${startsOn}
				LIMIT 1
				FOR UPDATE
			`.execute(trx);
			if (overlap.rows.length > 0) throw new FinanceValidationError('Accounting periods must not overlap.');

			const publicId = this.publicIdFactory();
			await sql`
				INSERT INTO accounting_periods
					(organisation_id, financial_year_id, public_id, period_number, name, starts_on, ends_on, state, state_version, created_by_member_id, created_at)
				VALUES
					(${actor.organisationId}, ${year.id}, ${publicId}, ${input.periodNumber}, ${name}, ${startsOn}, ${endsOn}, 'open', 1, ${membership.id}, ${this.now()})
			`.execute(trx);
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
				changeSummary: { financialYearPublicId, periodNumber: input.periodNumber, name, startsOn: dateKey(startsOn), endsOn: dateKey(endsOn), state: 'open' }
			});
			return { publicId };
		});
	}

	async transition(
		actor: TenantActorContext,
		input: { periodPublicId: string; toState: AccountingPeriodState; reason: string }
	): Promise<void> {
		const periodPublicId = cleanFinanceText(input.periodPublicId, 64, 'Accounting-period ID', true)!;
		const reason = cleanFinanceText(input.reason, 1000, 'Accounting-period transition reason', true)!;
		if (!['open', 'soft_closed', 'hard_closed'].includes(input.toState)) {
			throw new FinanceValidationError('Accounting-period state is invalid.');
		}

		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const permission = input.toState === 'open'
				? 'finance.accounting.period.reopen'
				: input.toState === 'soft_closed'
					? 'finance.accounting.period.soft-close'
					: 'finance.accounting.period.hard-close';
			if (!(await policy.mutationDecision(actor, permission, trx)).allowed) {
				throw new TenantAccessError('Accounting-period state transition is not permitted.');
			}
			await trx.selectFrom('organisations').select('id').where('id', '=', actor.organisationId).forUpdate().executeTakeFirstOrThrow();
			const periodResult = await sql<{ id: string; state: AccountingPeriodState; stateVersion: number }>`
				SELECT id, state, state_version AS stateVersion
				FROM accounting_periods
				WHERE organisation_id = ${actor.organisationId}
					AND public_id = ${periodPublicId}
				LIMIT 1
				FOR UPDATE
			`.execute(trx);
			const period = periodResult.rows[0];
			if (!period) throw new RecordNotFoundError('Accounting period not found.');
			if (!transitionAllowed(period.state, input.toState)) {
				throw new FinanceValidationError(`Accounting period cannot move from ${period.state} to ${input.toState}.`);
			}
			const nextVersion = Number(period.stateVersion) + 1;
			const eventPublicId = this.publicIdFactory();
			await sql`
				UPDATE accounting_periods
				SET state = ${input.toState}, state_version = ${nextVersion}, updated_at = ${this.now()}
				WHERE id = ${period.id} AND organisation_id = ${actor.organisationId}
			`.execute(trx);
			await sql`
				INSERT INTO accounting_period_state_events
					(organisation_id, accounting_period_id, public_id, from_state, to_state, state_version, acted_by_member_id, acted_at, reason, created_at)
				VALUES
					(${actor.organisationId}, ${period.id}, ${eventPublicId}, ${period.state}, ${input.toState}, ${nextVersion}, ${membership.id}, ${this.now()}, ${reason}, ${this.now()})
			`.execute(trx);

			if (input.toState === 'open') {
				const event = await sql<{ id: string }>`
					SELECT id
					FROM accounting_period_state_events
					WHERE organisation_id = ${actor.organisationId}
						AND public_id = ${eventPublicId}
					LIMIT 1
				`.execute(trx);
				await sql`
					INSERT INTO accounting_period_reopen_authorities
						(organisation_id, accounting_period_id, state_event_id, public_id, prior_state, authorised_by_member_id, authorised_at, reason, created_at)
					VALUES
						(${actor.organisationId}, ${period.id}, ${event.rows[0]!.id}, ${this.publicIdFactory()}, ${period.state}, ${membership.id}, ${this.now()}, ${reason}, ${this.now()})
				`.execute(trx);
			}

			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: input.toState === 'open' ? 'finance.accounting.period.reopened' : `finance.accounting.period.${input.toState}`,
				subjectType: 'accounting_period',
				subjectPublicId: periodPublicId,
				correlationId: actor.correlationId,
				changeSummary: { fromState: period.state, toState: input.toState, stateVersion: nextVersion, reason }
			});
		});
	}
}
