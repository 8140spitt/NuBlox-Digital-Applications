import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import {
	formatScaledDecimal,
	lineAmount,
	parseScaledDecimal
} from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectRecord } from '$lib/server/projects/project-repository';
import {
	ProjectCommercialControlRepository,
	type CommercialVariationItemSummary
} from './project-commercial-control-repository';
import {
	ProjectFinancialControlRepository,
	type CashFlowLineRecord,
	type FinancialCostCodeRecord,
	type ForecastLineRecord,
	type ForecastRecord,
	type ReportingPeriodRecord
} from './project-financial-control-repository';

const MONEY_SCALE = 4;
const QUANTITY_SCALE = 6;

export class ProjectFinancialControlValidationError extends Error {
	readonly code = 'PROJECT_FINANCIAL_CONTROL_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProjectFinancialControlValidationError';
	}
}

export type FinancialCostPosition = FinancialCostCodeRecord & {
	baselineBudget: string;
	budgetAdjustments: string;
	controlBudget: string;
	commitment: string;
	procurementActual: string;
	labourActual: string;
	directActual: string;
	actualCost: string;
	remainingCommitment: string;
	approvedChange: string;
	pendingChangeExposure: string;
	forecastToComplete: string | null;
	forecastAtCompletion: string | null;
	costVariance: string | null;
};

export type FinancialTotals = {
	baselineBudget: string;
	budgetAdjustments: string;
	controlBudget: string;
	commitment: string;
	actualCost: string;
	remainingCommitment: string;
	approvedChange: string;
	pendingChangeExposure: string;
	unclassifiedCommitment: string;
	unclassifiedActual: string;
	unclassifiedChangeExposure: string;
};

export type ForecastWorkspace = {
	forecast: ForecastRecord;
	lines: ForecastLineRecord[];
	cashFlowLines: CashFlowLineRecord[];
	forecastToComplete: string;
	forecastAtCompletion: string;
	costVariance: string;
	forecastMargin: string;
	marginPercent: number | null;
	cashInflow: string;
	cashOutflow: string;
	cashNet: string;
	cashOutflowVarianceToFtc: string;
};

export type ProjectFinancialControlWorkspace = {
	project: ProjectRecord;
	canManageForecasts: boolean;
	canApproveForecasts: boolean;
	canManageCashFlow: boolean;
	asOf: string;
	currencyCode: string | null;
	currencyCodes: string[];
	currencyMismatch: boolean;
	costCodes: FinancialCostPosition[];
	totals: FinancialTotals;
	periods: ReportingPeriodRecord[];
	forecasts: ForecastRecord[];
	activeForecast: ForecastWorkspace | null;
};

export type CreateReportingPeriodInput = {
	projectPublicId: string;
	periodLabel: string;
	periodStart: Date;
	periodEnd: Date;
};

export type CreateForecastInput = {
	projectPublicId: string;
	periodPublicId: string;
	forecastRevenueAmount: string;
};

export type UpdateForecastLineInput = {
	projectPublicId: string;
	forecastPublicId: string;
	costCodePublicId: string;
	forecastToCompleteAmount: string;
	commentary?: string | null;
};

export type CreateCashFlowLineInput = {
	projectPublicId: string;
	forecastPublicId: string;
	costCodePublicId?: string | null;
	flowDate: Date;
	direction: string;
	category: string;
	amount: string;
	commentary?: string | null;
};

function money(value: string, label = 'Amount'): bigint {
	return parseScaledDecimal(value, MONEY_SCALE, label);
}

function moneyText(value: bigint): string {
	return formatScaledDecimal(value, MONEY_SCALE);
}

function quantity(value: string): bigint {
	return parseScaledDecimal(value, QUANTITY_SCALE, 'Quantity');
}

function add(map: Map<string, bigint>, key: string, value: bigint): void {
	map.set(key, (map.get(key) ?? 0n) + value);
}

function positive(value: bigint): bigint {
	return value > 0n ? value : 0n;
}

function maxMoney(...values: bigint[]): bigint {
	return values.reduce((current, value) => (value > current ? value : current), values[0] ?? 0n);
}

function dateOnlyText(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function cutoffEnd(value: Date): Date {
	return new Date(`${dateOnlyText(value)}T23:59:59.999Z`);
}

function validDate(value: Date, label: string): Date {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		throw new ProjectFinancialControlValidationError(`${label} is invalid.`);
	}
	return new Date(`${dateOnlyText(value)}T00:00:00.000Z`);
}

function text(value: string, label: string, max: number): string {
	const result = value.trim();
	if (!result) throw new ProjectFinancialControlValidationError(`${label} is required.`);
	if (result.length > max)
		throw new ProjectFinancialControlValidationError(`${label} is too long.`);
	return result;
}

function optionalText(value: string | null | undefined, max = 2000): string | null {
	const result = value?.trim() ?? '';
	if (!result) return null;
	if (result.length > max)
		throw new ProjectFinancialControlValidationError('A supplied value is too long.');
	return result;
}

function nonnegativeMoney(value: string, label: string): string {
	const parsed = money(value, label);
	if (parsed < 0n)
		throw new ProjectFinancialControlValidationError(`${label} must not be negative.`);
	return moneyText(parsed);
}

function positiveMoney(value: string, label: string): string {
	const parsed = money(value, label);
	if (parsed <= 0n)
		throw new ProjectFinancialControlValidationError(`${label} must be greater than zero.`);
	return moneyText(parsed);
}

function allocateProRata(total: bigint, part: bigint, whole: bigint): bigint {
	if (total === 0n || part === 0n || whole <= 0n) return 0n;
	const numerator = total * part;
	return (numerator + whole / 2n) / whole;
}

function variationLineValue(item: CommercialVariationItemSummary): bigint {
	return money(lineAmount(item.quantity, item.unitRate), 'Variation line value');
}

function percentage(numerator: bigint, denominator: bigint): number | null {
	if (denominator === 0n) return null;
	return Number((numerator * 10_000n) / denominator) / 100;
}

export class ProjectFinancialControlService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async resolveProject(
		actor: TenantActorContext,
		projectPublicId: string,
		permission = 'commercial.forecast.view'
	): Promise<ProjectRecord> {
		await this.assertActiveActor(actor);
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId.trim()
		);
		if (!project || project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError(
				'Project financial control not found in the active member scope.'
			);
		}
		const permissionService = new PermissionService(this.db);
		const projectView = await permissionService.decide(actor, 'project.view', {
			projectId: project.id
		});
		const financialView = await permissionService.decide(actor, permission, {
			projectId: project.id
		});
		if (!projectView.allowed || !financialView.allowed) {
			throw new TenantAccessError(
				'Project financial control is outside your effective permission scope.'
			);
		}
		return project;
	}

	private async permissionFlags(actor: TenantActorContext, project: ProjectRecord) {
		const permissionService = new PermissionService(this.db);
		const [manage, approve, cashFlow] = await Promise.all([
			permissionService.decide(actor, 'commercial.forecast.manage', { projectId: project.id }),
			permissionService.decide(actor, 'commercial.forecast.approve', { projectId: project.id }),
			permissionService.decide(actor, 'commercial.cash_flow.manage', { projectId: project.id })
		]);
		return {
			canManageForecasts: manage.allowed,
			canApproveForecasts: approve.allowed,
			canManageCashFlow: cashFlow.allowed
		};
	}

	private async variationMaps(
		actor: TenantActorContext,
		project: ProjectRecord
	): Promise<{
		approved: Map<string, bigint>;
		pending: Map<string, bigint>;
		unclassified: bigint;
	}> {
		const repository = new ProjectCommercialControlRepository(this.db);
		const variations = await repository.listVariations(actor.organisationId, [project.id]);
		const approved = new Map<string, bigint>();
		const pending = new Map<string, bigint>();
		let unclassified = 0n;

		for (const variation of variations.filter((row) => row.status === 'active')) {
			const issuedVersion = (
				await repository.listVariationVersions(actor.organisationId, variation.id)
			).find((version) => version.status === 'issued');
			if (!issuedVersion) continue;
			const items = await repository.listVariationItems(actor.organisationId, issuedVersion.id);
			const total = items.reduce((sum, item) => sum + variationLineValue(item), 0n);
			if (total === 0n) continue;
			const decision = (
				await repository.listVariationDecisions(actor.organisationId, issuedVersion.id)
			)[0];
			const accepted =
				decision?.decision === 'accepted' || decision?.decision === 'partially_accepted';
			const isPending = !decision || decision.decision === 'pending';
			if (!accepted && !isPending) continue;
			const decidedTotal = accepted
				? decision?.decisionAmount
					? money(decision.decisionAmount, 'Variation decision')
					: total
				: total;
			let distributed = 0n;
			items.forEach((item, index) => {
				const itemValue = variationLineValue(item);
				const amount =
					index === items.length - 1
						? decidedTotal - distributed
						: allocateProRata(decidedTotal, itemValue, total);
				distributed += amount;
				if (!item.costCodeId) {
					unclassified += amount;
				} else {
					add(accepted ? approved : pending, item.costCodeId, amount);
				}
			});
		}
		return { approved, pending, unclassified };
	}

	private async calculatePosition(
		actor: TenantActorContext,
		project: ProjectRecord,
		asOf: Date
	): Promise<{
		currencyCodes: string[];
		costCodes: FinancialCostPosition[];
		totals: FinancialTotals;
	}> {
		const repository = new ProjectFinancialControlRepository(this.db);
		const costCodes = await repository.listCostCodes(actor.organisationId, project.id);
		const budgetFacts = await repository.listApprovedBudgetFacts(actor.organisationId, project.id);
		const latestVersionByBudget = new Map<string, number>();
		for (const fact of budgetFacts) {
			latestVersionByBudget.set(
				fact.budgetId,
				Math.max(latestVersionByBudget.get(fact.budgetId) ?? 0, fact.versionNumber)
			);
		}

		const currencies = new Set<string>();
		const baseline = new Map<string, bigint>();
		for (const fact of budgetFacts) {
			if (latestVersionByBudget.get(fact.budgetId) !== fact.versionNumber) continue;
			currencies.add(fact.currencyCode);
			add(baseline, fact.costCodeId, money(fact.budgetAmount, 'Budget amount'));
		}
		const adjustments = new Map<string, bigint>();
		for (const fact of await repository.listApprovedBudgetAdjustmentFacts(
			actor.organisationId,
			project.id,
			asOf
		)) {
			add(adjustments, fact.costCodeId, money(fact.adjustmentAmount, 'Budget adjustment'));
		}

		const commitment = new Map<string, bigint>();
		const procurementActual = new Map<string, bigint>();
		let unclassifiedCommitment = 0n;
		let unclassifiedProcurementActual = 0n;
		const items = await repository.listIssuedCommitmentItems(
			actor.organisationId,
			project.id,
			asOf
		);
		for (const item of items) currencies.add(item.currencyCode);
		const itemIds = items.map((item) => item.itemId);
		const allocations = await repository.listCommitmentAllocations(actor.organisationId, itemIds);
		const allocationsByItem = new Map<string, typeof allocations>();
		for (const allocation of allocations) {
			const rows = allocationsByItem.get(allocation.itemId) ?? [];
			rows.push(allocation);
			allocationsByItem.set(allocation.itemId, rows);
		}
		const receipts = await repository.listConfirmedReceipts(
			actor.organisationId,
			itemIds,
			cutoffEnd(asOf)
		);
		const receivedByItem = new Map<string, bigint>();
		for (const receipt of receipts) {
			const accepted = quantity(receipt.quantityReceived) - quantity(receipt.quantityRejected);
			add(receivedByItem, receipt.itemId, accepted);
		}
		for (const item of items) {
			const itemValue = money(lineAmount(item.quantity, item.unitRate), 'Commitment value');
			const itemAllocations = allocationsByItem.get(item.itemId) ?? [];
			const allocatedCommitment = itemAllocations.reduce(
				(sum, allocation) => sum + money(allocation.allocatedNetAmount, 'Commitment allocation'),
				0n
			);
			for (const allocation of itemAllocations) {
				add(
					commitment,
					allocation.costCodeId,
					money(allocation.allocatedNetAmount, 'Commitment allocation')
				);
			}
			unclassifiedCommitment += positive(itemValue - allocatedCommitment);
			const receivedQuantity = receivedByItem.get(item.itemId) ?? 0n;
			const actualValue = money(
				lineAmount(formatScaledDecimal(receivedQuantity, QUANTITY_SCALE), item.unitRate),
				'Receipt actual'
			);
			let allocatedActual = 0n;
			for (const allocation of itemAllocations) {
				const allocationValue = money(allocation.allocatedNetAmount, 'Commitment allocation');
				const actual = allocateProRata(actualValue, allocationValue, itemValue);
				allocatedActual += actual;
				add(procurementActual, allocation.costCodeId, actual);
			}
			unclassifiedProcurementActual += positive(actualValue - allocatedActual);
		}

		const labourActual = new Map<string, bigint>();
		for (const fact of await repository.listLabourActuals(actor.organisationId, project.id, asOf)) {
			currencies.add(fact.currencyCode);
			add(labourActual, fact.costCodeId, money(fact.allocatedCostAmount, 'Labour actual'));
		}

		const directActual = new Map<string, bigint>();
		const directCosts = await repository.listPostedDirectCosts(
			actor.organisationId,
			project.id,
			asOf
		);
		for (const fact of directCosts) currencies.add(fact.currencyCode);
		const reversalFacts = await repository.listDirectCostReversals(
			actor.organisationId,
			directCosts.map((fact) => fact.id),
			cutoffEnd(asOf)
		);
		const reversals = new Map<string, bigint>();
		for (const reversal of reversalFacts) {
			add(reversals, reversal.directCostId, money(reversal.reversalAmount, 'Direct-cost reversal'));
		}
		for (const fact of directCosts) {
			const net = positive(money(fact.amount, 'Direct cost') - (reversals.get(fact.id) ?? 0n));
			add(directActual, fact.costCodeId, net);
		}

		const variation = await this.variationMaps(actor, project);
		const positions = costCodes.map((costCode) => {
			const baselineBudget = baseline.get(costCode.id) ?? 0n;
			const budgetAdjustments = adjustments.get(costCode.id) ?? 0n;
			const controlBudget = baselineBudget + budgetAdjustments;
			const commitmentValue = commitment.get(costCode.id) ?? 0n;
			const procurement = procurementActual.get(costCode.id) ?? 0n;
			const labour = labourActual.get(costCode.id) ?? 0n;
			const direct = directActual.get(costCode.id) ?? 0n;
			const actualCost = procurement + labour + direct;
			return {
				...costCode,
				baselineBudget: moneyText(baselineBudget),
				budgetAdjustments: moneyText(budgetAdjustments),
				controlBudget: moneyText(controlBudget),
				commitment: moneyText(commitmentValue),
				procurementActual: moneyText(procurement),
				labourActual: moneyText(labour),
				directActual: moneyText(direct),
				actualCost: moneyText(actualCost),
				remainingCommitment: moneyText(positive(commitmentValue - procurement)),
				approvedChange: moneyText(variation.approved.get(costCode.id) ?? 0n),
				pendingChangeExposure: moneyText(variation.pending.get(costCode.id) ?? 0n),
				forecastToComplete: null,
				forecastAtCompletion: null,
				costVariance: null
			};
		});
		const sum = (
			key: keyof Pick<
				FinancialCostPosition,
				| 'baselineBudget'
				| 'budgetAdjustments'
				| 'controlBudget'
				| 'commitment'
				| 'actualCost'
				| 'remainingCommitment'
				| 'approvedChange'
				| 'pendingChangeExposure'
			>
		) => positions.reduce((total, row) => total + money(row[key] as string), 0n);
		return {
			currencyCodes: [...currencies].sort(),
			costCodes: positions,
			totals: {
				baselineBudget: moneyText(sum('baselineBudget')),
				budgetAdjustments: moneyText(sum('budgetAdjustments')),
				controlBudget: moneyText(sum('controlBudget')),
				commitment: moneyText(sum('commitment') + unclassifiedCommitment),
				actualCost: moneyText(sum('actualCost') + unclassifiedProcurementActual),
				remainingCommitment: moneyText(
					sum('remainingCommitment') +
						positive(unclassifiedCommitment - unclassifiedProcurementActual)
				),
				approvedChange: moneyText(sum('approvedChange')),
				pendingChangeExposure: moneyText(sum('pendingChangeExposure')),
				unclassifiedCommitment: moneyText(unclassifiedCommitment),
				unclassifiedActual: moneyText(unclassifiedProcurementActual),
				unclassifiedChangeExposure: moneyText(variation.unclassified)
			}
		};
	}

	private async forecastWorkspace(
		actor: TenantActorContext,
		forecast: ForecastRecord | null
	): Promise<ForecastWorkspace | null> {
		if (!forecast) return null;
		const repository = new ProjectFinancialControlRepository(this.db);
		const [lines, cashFlowLines] = await Promise.all([
			repository.listForecastLines(actor.organisationId, forecast.id),
			repository.listCashFlowLines(actor.organisationId, forecast.id)
		]);
		const actual = lines.reduce((sum, line) => sum + money(line.actualCostSnapshot), 0n);
		const controlBudget = lines.reduce((sum, line) => sum + money(line.controlBudgetSnapshot), 0n);
		const forecastToComplete = lines.reduce(
			(sum, line) => sum + money(line.forecastToCompleteAmount),
			0n
		);
		const forecastAtCompletion = actual + forecastToComplete;
		const forecastRevenue = money(forecast.forecastRevenueAmount);
		const forecastMargin = forecastRevenue - forecastAtCompletion;
		const cashInflow = cashFlowLines
			.filter((line) => line.direction === 'inflow')
			.reduce((sum, line) => sum + money(line.amount), 0n);
		const cashOutflow = cashFlowLines
			.filter((line) => line.direction === 'outflow')
			.reduce((sum, line) => sum + money(line.amount), 0n);
		return {
			forecast,
			lines,
			cashFlowLines,
			forecastToComplete: moneyText(forecastToComplete),
			forecastAtCompletion: moneyText(forecastAtCompletion),
			costVariance: moneyText(controlBudget - forecastAtCompletion),
			forecastMargin: moneyText(forecastMargin),
			marginPercent: percentage(forecastMargin, forecastRevenue),
			cashInflow: moneyText(cashInflow),
			cashOutflow: moneyText(cashOutflow),
			cashNet: moneyText(cashInflow - cashOutflow),
			cashOutflowVarianceToFtc: moneyText(cashOutflow - forecastToComplete)
		};
	}

	async getWorkspace(
		actor: TenantActorContext,
		projectPublicId: string,
		asOfInput?: Date | null,
		forecastPublicId?: string | null
	): Promise<ProjectFinancialControlWorkspace> {
		const project = await this.resolveProject(actor, projectPublicId);
		const flags = await this.permissionFlags(actor, project);
		const asOf = validDate(asOfInput ?? this.now(), 'As-of date');
		const position = await this.calculatePosition(actor, project, asOf);
		const repository = new ProjectFinancialControlRepository(this.db);
		const [periods, forecasts] = await Promise.all([
			repository.listReportingPeriods(actor.organisationId, project.id),
			repository.listForecasts(actor.organisationId, project.id)
		]);
		const requested = forecastPublicId
			? (forecasts.find((row) => row.publicId === forecastPublicId) ?? null)
			: null;
		const active =
			requested ??
			forecasts.find((row) => row.status === 'draft') ??
			forecasts.find((row) => row.status === 'approved') ??
			null;
		const activeForecast = await this.forecastWorkspace(actor, active);
		if (activeForecast) {
			const byCostCode = new Map(activeForecast.lines.map((line) => [line.costCodeId, line]));
			for (const row of position.costCodes) {
				const forecastLine = byCostCode.get(row.id);
				if (!forecastLine) continue;
				const actual = money(forecastLine.actualCostSnapshot);
				const ftc = money(forecastLine.forecastToCompleteAmount);
				const eac = actual + ftc;
				row.forecastToComplete = moneyText(ftc);
				row.forecastAtCompletion = moneyText(eac);
				row.costVariance = moneyText(money(forecastLine.controlBudgetSnapshot) - eac);
			}
		}
		return {
			project,
			...flags,
			asOf: dateOnlyText(asOf),
			currencyCode: position.currencyCodes.length === 1 ? position.currencyCodes[0] : null,
			currencyCodes: position.currencyCodes,
			currencyMismatch: position.currencyCodes.length > 1,
			costCodes: position.costCodes,
			totals: position.totals,
			periods,
			forecasts,
			activeForecast
		};
	}

	async createReportingPeriod(
		actor: TenantActorContext,
		input: CreateReportingPeriodInput
	): Promise<string> {
		const project = await this.resolveProject(
			actor,
			input.projectPublicId,
			'commercial.forecast.manage'
		);
		const periodLabel = text(input.periodLabel, 'Period label', 120);
		const periodStart = validDate(input.periodStart, 'Period start');
		const periodEnd = validDate(input.periodEnd, 'Period end');
		if (periodEnd < periodStart) {
			throw new ProjectFinancialControlValidationError(
				'Period end must be on or after period start.'
			);
		}
		const repository = new ProjectFinancialControlRepository(this.db);
		const existing = await repository.listReportingPeriods(actor.organisationId, project.id);
		if (
			existing.some((period) => periodStart <= period.periodEnd && periodEnd >= period.periodStart)
		) {
			throw new ProjectFinancialControlValidationError(
				'Commercial reporting periods must not overlap.'
			);
		}
		const publicId = this.publicIdFactory();
		await this.db.transaction().execute(async (transaction) => {
			await new ProjectFinancialControlRepository(transaction).insertReportingPeriod({
				organisationId: actor.organisationId,
				projectId: project.id,
				publicId,
				periodLabel,
				periodStart,
				periodEnd
			});
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'commercial.reporting_period.created',
				subjectType: 'commercial_reporting_period',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					periodLabel,
					periodStart: dateOnlyText(periodStart),
					periodEnd: dateOnlyText(periodEnd)
				}
			});
		});
		return publicId;
	}

	async createForecast(actor: TenantActorContext, input: CreateForecastInput): Promise<string> {
		const project = await this.resolveProject(
			actor,
			input.projectPublicId,
			'commercial.forecast.manage'
		);
		const repository = new ProjectFinancialControlRepository(this.db);
		const period = await repository.findReportingPeriodByPublicId(
			actor.organisationId,
			project.id,
			input.periodPublicId.trim()
		);
		if (!period || !['open', 'reopened'].includes(period.status)) {
			throw new ProjectFinancialControlValidationError(
				'The selected reporting period is not open for forecasting.'
			);
		}
		const position = await this.calculatePosition(actor, project, period.periodEnd);
		if (position.costCodes.length === 0) {
			throw new ProjectFinancialControlValidationError(
				'Create at least one project cost code before forecasting.'
			);
		}
		if (position.currencyCodes.length !== 1) {
			throw new ProjectFinancialControlValidationError(
				'Forecast creation requires one project reporting currency.'
			);
		}
		if (
			money(position.totals.unclassifiedCommitment) !== 0n ||
			money(position.totals.unclassifiedActual) !== 0n ||
			money(position.totals.unclassifiedChangeExposure) !== 0n
		) {
			throw new ProjectFinancialControlValidationError(
				'Classify all commitment, actual and change exposure before creating a governed forecast snapshot.'
			);
		}
		const forecastRevenueAmount = nonnegativeMoney(input.forecastRevenueAmount, 'Forecast revenue');
		const existing = await repository.listForecasts(actor.organisationId, project.id);
		const versionNumber =
			Math.max(
				0,
				...existing
					.filter((forecast) => forecast.periodId === period.id)
					.map((forecast) => forecast.versionNumber)
			) + 1;
		const publicId = this.publicIdFactory();
		await this.db.transaction().execute(async (transaction) => {
			const transactionRepository = new ProjectFinancialControlRepository(transaction);
			const forecastId = await transactionRepository.insertForecast({
				organisationId: actor.organisationId,
				projectId: project.id,
				periodId: period.id,
				publicId,
				versionNumber,
				currencyCode: position.currencyCodes[0],
				forecastRevenueAmount,
				createdByMemberId: actor.memberId
			});
			for (const row of position.costCodes) {
				const actual = money(row.actualCost);
				const remainingBudget = money(row.controlBudget) - actual;
				const initialFtc = maxMoney(0n, remainingBudget, money(row.remainingCommitment));
				await transactionRepository.insertForecastLine({
					organisationId: actor.organisationId,
					forecastId,
					costCodeId: row.id,
					controlBudgetSnapshot: row.controlBudget,
					actualCostSnapshot: row.actualCost,
					remainingCommitmentSnapshot: row.remainingCommitment,
					approvedChangeSnapshot: row.approvedChange,
					pendingChangeExposureSnapshot: row.pendingChangeExposure,
					forecastToCompleteAmount: moneyText(initialFtc),
					commentary: null
				});
			}
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'commercial.forecast.created',
				subjectType: 'commercial_forecast',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					periodPublicId: period.publicId,
					versionNumber,
					currencyCode: position.currencyCodes[0],
					forecastRevenueAmount
				}
			});
		});
		return publicId;
	}

	private async draftForecast(
		actor: TenantActorContext,
		project: ProjectRecord,
		forecastPublicId: string
	): Promise<ForecastRecord> {
		const forecast = await new ProjectFinancialControlRepository(this.db).findForecastByPublicId(
			actor.organisationId,
			project.id,
			forecastPublicId.trim()
		);
		if (!forecast) throw new RecordNotFoundError('Project financial forecast not found.');
		if (forecast.status !== 'draft') {
			throw new ProjectFinancialControlValidationError(
				'Approved or superseded forecasts are immutable. Create a new version instead.'
			);
		}
		return forecast;
	}

	async updateForecastLine(
		actor: TenantActorContext,
		input: UpdateForecastLineInput
	): Promise<void> {
		const project = await this.resolveProject(
			actor,
			input.projectPublicId,
			'commercial.forecast.manage'
		);
		const forecast = await this.draftForecast(actor, project, input.forecastPublicId);
		const repository = new ProjectFinancialControlRepository(this.db);
		const costCode = (await repository.listCostCodes(actor.organisationId, project.id)).find(
			(row) => row.publicId === input.costCodePublicId.trim()
		);
		if (!costCode)
			throw new ProjectFinancialControlValidationError('The selected cost code is invalid.');
		const forecastToCompleteAmount = nonnegativeMoney(
			input.forecastToCompleteAmount,
			'Forecast to complete'
		);
		const updated = await repository.updateDraftForecastLine({
			organisationId: actor.organisationId,
			forecastId: forecast.id,
			costCodeId: costCode.id,
			forecastToCompleteAmount,
			commentary: optionalText(input.commentary)
		});
		if (!updated) throw new RecordNotFoundError('Forecast cost-code line not found.');
	}

	async addCashFlowLine(actor: TenantActorContext, input: CreateCashFlowLineInput): Promise<void> {
		const project = await this.resolveProject(
			actor,
			input.projectPublicId,
			'commercial.cash_flow.manage'
		);
		const forecast = await this.draftForecast(actor, project, input.forecastPublicId);
		const flowDate = validDate(input.flowDate, 'Cash-flow date');
		if (flowDate <= forecast.periodEnd) {
			throw new ProjectFinancialControlValidationError(
				'Forecast cash flow must fall after the reporting cut-off.'
			);
		}
		if (!['inflow', 'outflow'].includes(input.direction)) {
			throw new ProjectFinancialControlValidationError('Cash-flow direction is invalid.');
		}
		const categories = [
			'revenue',
			'labour',
			'material',
			'plant',
			'subcontract',
			'professional_fee',
			'overhead',
			'preliminaries',
			'retention',
			'tax',
			'contingency',
			'other'
		];
		if (!categories.includes(input.category)) {
			throw new ProjectFinancialControlValidationError('Cash-flow category is invalid.');
		}
		const repository = new ProjectFinancialControlRepository(this.db);
		let costCodeId: string | null = null;
		if (input.costCodePublicId?.trim()) {
			const costCode = (await repository.listCostCodes(actor.organisationId, project.id)).find(
				(row) => row.publicId === input.costCodePublicId!.trim()
			);
			if (!costCode)
				throw new ProjectFinancialControlValidationError(
					'The selected cash-flow cost code is invalid.'
				);
			costCodeId = costCode.id;
		}
		const existing = await repository.listCashFlowLines(actor.organisationId, forecast.id);
		const lineNumber = Math.max(0, ...existing.map((line) => line.lineNumber)) + 1;
		await repository.insertCashFlowLine({
			organisationId: actor.organisationId,
			projectId: project.id,
			forecastId: forecast.id,
			costCodeId,
			lineNumber,
			flowDate,
			direction: input.direction,
			category: input.category,
			amount: positiveMoney(input.amount, 'Cash-flow amount'),
			commentary: optionalText(input.commentary)
		});
	}

	async removeCashFlowLine(
		actor: TenantActorContext,
		projectPublicId: string,
		forecastPublicId: string,
		lineNumber: number
	): Promise<void> {
		const project = await this.resolveProject(
			actor,
			projectPublicId,
			'commercial.cash_flow.manage'
		);
		const forecast = await this.draftForecast(actor, project, forecastPublicId);
		if (!Number.isInteger(lineNumber) || lineNumber <= 0) {
			throw new ProjectFinancialControlValidationError('Cash-flow line is invalid.');
		}
		const deleted = await new ProjectFinancialControlRepository(this.db).deleteCashFlowLine(
			actor.organisationId,
			forecast.id,
			lineNumber
		);
		if (!deleted) throw new RecordNotFoundError('Cash-flow line not found.');
	}

	async approveForecast(
		actor: TenantActorContext,
		projectPublicId: string,
		forecastPublicId: string
	): Promise<void> {
		const project = await this.resolveProject(
			actor,
			projectPublicId,
			'commercial.forecast.approve'
		);
		const forecast = await this.draftForecast(actor, project, forecastPublicId);
		const repository = new ProjectFinancialControlRepository(this.db);
		const [lines, cashFlowLines] = await Promise.all([
			repository.listForecastLines(actor.organisationId, forecast.id),
			repository.listCashFlowLines(actor.organisationId, forecast.id)
		]);
		if (lines.length === 0)
			throw new ProjectFinancialControlValidationError('A forecast requires cost-code lines.');
		const ftc = lines.reduce((sum, line) => sum + money(line.forecastToCompleteAmount), 0n);
		const cashOutflow = cashFlowLines
			.filter((line) => line.direction === 'outflow')
			.reduce((sum, line) => sum + money(line.amount), 0n);
		if (cashOutflow !== ftc) {
			throw new ProjectFinancialControlValidationError(
				`Forecast cash outflow must reconcile to forecast-to-complete before approval (${moneyText(cashOutflow)} versus ${moneyText(ftc)}).`
			);
		}
		const cashInflow = cashFlowLines
			.filter((line) => line.direction === 'inflow')
			.reduce((sum, line) => sum + money(line.amount), 0n);
		if (cashInflow > money(forecast.forecastRevenueAmount)) {
			throw new ProjectFinancialControlValidationError(
				'Forecast cash inflow cannot exceed forecast project revenue.'
			);
		}
		const approvedAt = this.now();
		await this.db.transaction().execute(async (transaction) => {
			const transactionRepository = new ProjectFinancialControlRepository(transaction);
			await transactionRepository.supersedeApprovedForecasts({
				organisationId: actor.organisationId,
				projectId: project.id,
				periodId: forecast.periodId,
				excludeForecastId: forecast.id
			});
			const approved = await transactionRepository.approveForecast({
				organisationId: actor.organisationId,
				forecastId: forecast.id,
				memberId: actor.memberId,
				approvedAt
			});
			if (!approved)
				throw new ProjectFinancialControlValidationError(
					'Forecast is no longer available for approval.'
				);
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'commercial.forecast.approved',
				subjectType: 'commercial_forecast',
				subjectPublicId: forecast.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					periodPublicId: forecast.periodPublicId,
					versionNumber: forecast.versionNumber,
					forecastToComplete: moneyText(ftc),
					cashOutflow: moneyText(cashOutflow),
					cashInflow: moneyText(cashInflow)
				}
			});
		});
	}

	async closeReportingPeriod(
		actor: TenantActorContext,
		projectPublicId: string,
		periodPublicId: string
	): Promise<void> {
		const project = await this.resolveProject(
			actor,
			projectPublicId,
			'commercial.forecast.approve'
		);
		const repository = new ProjectFinancialControlRepository(this.db);
		const period = await repository.findReportingPeriodByPublicId(
			actor.organisationId,
			project.id,
			periodPublicId.trim()
		);
		if (!period) throw new RecordNotFoundError('Commercial reporting period not found.');
		const forecasts = await repository.listForecasts(actor.organisationId, project.id);
		if (
			!forecasts.some(
				(forecast) => forecast.periodId === period.id && forecast.status === 'approved'
			)
		) {
			throw new ProjectFinancialControlValidationError(
				'Approve a forecast for the reporting period before closing it.'
			);
		}
		const closedAt = this.now();
		await this.db.transaction().execute(async (transaction) => {
			const changed = await new ProjectFinancialControlRepository(transaction).closeReportingPeriod(
				{
					organisationId: actor.organisationId,
					periodId: period.id,
					memberId: actor.memberId,
					closedAt
				}
			);
			if (!changed)
				throw new ProjectFinancialControlValidationError('Reporting period is not open.');
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'commercial.reporting_period.closed',
				subjectType: 'commercial_reporting_period',
				subjectPublicId: period.publicId,
				correlationId: actor.correlationId,
				changeSummary: { periodLabel: period.periodLabel }
			});
		});
	}

	async reopenReportingPeriod(
		actor: TenantActorContext,
		projectPublicId: string,
		periodPublicId: string
	): Promise<void> {
		const project = await this.resolveProject(
			actor,
			projectPublicId,
			'commercial.forecast.approve'
		);
		const repository = new ProjectFinancialControlRepository(this.db);
		const period = await repository.findReportingPeriodByPublicId(
			actor.organisationId,
			project.id,
			periodPublicId.trim()
		);
		if (!period) throw new RecordNotFoundError('Commercial reporting period not found.');
		await this.db.transaction().execute(async (transaction) => {
			const changed = await new ProjectFinancialControlRepository(
				transaction
			).reopenReportingPeriod({
				organisationId: actor.organisationId,
				periodId: period.id
			});
			if (!changed)
				throw new ProjectFinancialControlValidationError(
					'Only a closed reporting period can be reopened.'
				);
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'commercial.reporting_period.reopened',
				subjectType: 'commercial_reporting_period',
				subjectPublicId: period.publicId,
				correlationId: actor.correlationId,
				changeSummary: { periodLabel: period.periodLabel }
			});
		});
	}
}
