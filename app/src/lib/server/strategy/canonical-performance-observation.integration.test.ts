import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { CanonicalPerformanceObservationService } from './canonical-performance-observation-service';
import {
	PerformanceForesightService,
	PerformanceForesightValidationError
} from './performance-foresight-service';

const PREFIX = 'Canonical KPI Integration ';
let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let actor: TenantActorContext;
let kpiPublicId = '';
let periodPublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup() {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const ids = organisations.map((row) => row.id);
	if (!ids.length) return;
	await db.deleteFrom('strategy_kpi_observations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_kpis').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_objectives').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_frameworks').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_journal_lines').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_journal_entries').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_accounts').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_periods').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_financial_years').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('outbox_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisations').where('id', 'in', ids).execute();
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	userId = insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Organisation`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	memberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2027-01-01T00:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}Owner`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissionKeys = [
		'strategy.view',
		'strategy.manage',
		'strategy.approve',
		'finance.view',
		'finance.accounting.view'
	];
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', permissionKeys)
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db
		.insertInto('role_permissions')
		.values(
			permissions.map((permission) => ({
				organisation_id: organisationId,
				organisation_role_id: roleId,
				permission_id: permission.id
			}))
		)
		.execute();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
	actor = { organisationId, userId, memberId, correlationId: randomUUID() };

	const frameworkId = insertedId(
		await db
			.insertInto('strategy_frameworks')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				framework_code: 'CANONICAL-KPI',
				version_number: 1,
				title: `${PREFIX}Strategy`,
				horizon_start: new Date('2027-01-01T00:00:00.000Z'),
				horizon_end: new Date('2030-12-31T00:00:00.000Z'),
				purpose_text: 'Drive governed performance from canonical enterprise facts.',
				vision_text: 'One strategy-to-finance evidence chain.',
				mission_text: 'Resolve KPI actuals without duplicate manual truth.',
				lifecycle_status: 'approved',
				supersedes_strategy_framework_id: null,
				owner_member_id: memberId,
				created_by_member_id: memberId,
				approved_by_member_id: memberId,
				approved_at: new Date('2027-01-01T09:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	const objectiveId = insertedId(
		await db
			.insertInto('strategy_objectives')
			.values({
				organisation_id: organisationId,
				strategy_framework_id: frameworkId,
				public_id: randomUUID(),
				objective_code: 'OBJ-MARGIN',
				title: 'Improve operating margin',
				description: 'Drive operating margin from governed financial actuals.',
				priority_rank: 1,
				owner_member_id: memberId,
				target_date: new Date('2028-12-31T00:00:00.000Z'),
				lifecycle_status: 'active',
				created_by_member_id: memberId
			})
			.executeTakeFirstOrThrow()
	);
	kpiPublicId = randomUUID();
	await db
		.insertInto('strategy_kpis')
		.values({
			organisation_id: organisationId,
			strategy_framework_id: frameworkId,
			strategy_objective_id: objectiveId,
			public_id: kpiPublicId,
			kpi_code: 'KPI-MARGIN',
			version_number: 1,
			title: 'Operating margin',
			description: 'Operating margin resolved from canonical accounting P&L.',
			unit_label: '%',
			direction: 'higher_is_better',
			aggregation_method: 'latest',
			baseline_value: '8.500000',
			target_value: '12.000000',
			warning_threshold: '10.000000',
			critical_threshold: '9.000000',
			target_date: new Date('2028-12-31T00:00:00.000Z'),
			source_mode: 'canonical',
			source_domain: 'finance',
			source_record_type: 'accounting_profit_and_loss',
			source_measure_key: 'period_profit_margin_percent',
			owner_member_id: memberId,
			lifecycle_status: 'approved',
			supersedes_strategy_kpi_id: null,
			created_by_member_id: memberId,
			approved_by_member_id: memberId,
			approved_at: new Date('2027-01-02T09:00:00.000Z')
		})
		.executeTakeFirstOrThrow();

	const yearId = insertedId(
		await db
			.insertInto('accounting_financial_years')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				year_code: 'FY27',
				name: `${PREFIX}FY27`,
				starts_on: new Date('2027-01-01T00:00:00.000Z'),
				ends_on: new Date('2027-12-31T00:00:00.000Z'),
				created_by_member_id: memberId
			})
			.executeTakeFirstOrThrow()
	);
	periodPublicId = randomUUID();
	await db
		.insertInto('accounting_periods')
		.values({
			organisation_id: organisationId,
			financial_year_id: yearId,
			public_id: periodPublicId,
			period_number: 1,
			name: 'H1 2027',
			starts_on: new Date('2027-01-01T00:00:00.000Z'),
			ends_on: new Date('2027-06-30T00:00:00.000Z'),
			created_by_member_id: memberId
		})
		.executeTakeFirstOrThrow();
	async function account(code: string, type: string, normalBalance: string) {
		return insertedId(
			await db
				.insertInto('accounting_accounts')
				.values({
					organisation_id: organisationId,
					public_id: randomUUID(),
					account_code: code,
					name: `${PREFIX}${code}`,
					account_type: type,
					normal_balance: normalBalance,
					created_by_member_id: memberId
				})
				.executeTakeFirstOrThrow()
		);
	}
	const cashId = await account('1000', 'asset', 'debit');
	const revenueId = await account('4000', 'revenue', 'credit');
	const expenseId = await account('5000', 'expense', 'debit');

	async function journal(
		sequence: number,
		amount: string,
		lines: Array<{ accountId: string; debit: string; credit: string }>
	) {
		const result = await db
			.insertInto('accounting_journal_entries')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				journal_number: `CANONICAL-${sequence}`,
				source_type: sequence === 1 ? 'invoice_issue' : 'accounts_payable_invoice_approval',
				source_public_id: randomUUID(),
				source_event_at: new Date('2027-06-30T12:00:00.000Z'),
				source_amount: amount,
				source_fingerprint: String(sequence).padStart(64, '0'),
				accounting_date: new Date('2027-06-30T00:00:00.000Z'),
				currency_code: 'GBP',
				memo: `${PREFIX}journal ${sequence}`,
				posted_by_member_id: memberId
			})
			.executeTakeFirstOrThrow();
		const journalId = insertedId(result);
		await db
			.insertInto('accounting_journal_lines')
			.values(
				lines.map((line, index) => ({
					organisation_id: organisationId,
					journal_entry_id: journalId,
					accounting_account_id: line.accountId,
					line_number: index + 1,
					description: `${PREFIX}line ${index + 1}`,
					debit_amount: line.debit,
					credit_amount: line.credit
				}))
			)
			.execute();
	}
	await journal(1, '1000000.0000', [
		{ accountId: cashId, debit: '1000000.0000', credit: '0.0000' },
		{ accountId: revenueId, debit: '0.0000', credit: '1000000.0000' }
	]);
	await journal(2, '902500.0000', [
		{ accountId: expenseId, debit: '902500.0000', credit: '0.0000' },
		{ accountId: cashId, debit: '0.0000', credit: '902500.0000' }
	]);
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('F01 canonical KPI source continuity', () => {
	it('resolves finance P&L into an immutable KPI observation and blocks forged canonical actuals', async () => {
		const canonical = new CanonicalPerformanceObservationService(db, randomUUID);
		const first = await canonical.record(actor, {
			kpiPublicId,
			sourcePublicId: periodPublicId,
			forecastValue: '11.4',
			commentary: 'Management forecast remains below the approved target.'
		});
		expect(Number(first.observation.actual_value)).toBe(9.75);
		expect(first.observation.observed_on.toISOString().slice(0, 10)).toBe('2027-06-30');
		expect(first.observation.source_domain).toBe('finance');
		expect(first.observation.source_record_type).toBe('accounting_profit_and_loss');
		expect(first.observation.source_public_id).toBe(periodPublicId);
		expect(first.observation.source_measure_key).toBe('period_profit_margin_percent');
		expect(first.source.sourceHref).toContain(
			`/finance/accounting/reports?period=${periodPublicId}`
		);

		const repeated = await canonical.record(actor, {
			kpiPublicId,
			sourcePublicId: periodPublicId,
			forecastValue: '11.4'
		});
		expect(repeated.observation.public_id).toBe(first.observation.public_id);
		const observationCount = await db
			.selectFrom('strategy_kpi_observations')
			.select(({ fn }) => fn.countAll<number>().as('count'))
			.where('organisation_id', '=', organisationId)
			.where('strategy_kpi_id', '=', first.observation.strategy_kpi_id)
			.executeTakeFirstOrThrow();
		expect(Number(observationCount.count)).toBe(1);

		await expect(
			new PerformanceForesightService(db).recordObservation(actor, {
				kpiPublicId,
				observedOn: '2027-06-30',
				actualValue: '99.99',
				sourceMode: 'canonical',
				sourceDomain: 'finance',
				sourceRecordType: 'accounting_profit_and_loss',
				sourcePublicId: periodPublicId,
				sourceMeasureKey: 'period_profit_margin_percent'
			})
		).rejects.toBeInstanceOf(PerformanceForesightValidationError);

		const audit = await db
			.selectFrom('audit_events')
			.select(['action_key', 'subject_public_id'])
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', '=', 'strategy.kpi.observe.canonical')
			.executeTakeFirstOrThrow();
		expect(audit.subject_public_id).toBe(first.observation.public_id);
		const outbox = await db
			.selectFrom('outbox_events')
			.select(['topic', 'aggregate_public_id'])
			.where('organisation_id', '=', organisationId)
			.where('topic', '=', 'strategy.kpi.observe.canonical')
			.executeTakeFirstOrThrow();
		expect(outbox.aggregate_public_id).toBe(first.observation.public_id);
	});
});
