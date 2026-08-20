import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import {
	formatScaledDecimal,
	lineAmount,
	parseScaledDecimal,
	subtractMoney,
	sumMoney
} from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectRecord } from '$lib/server/projects/project-repository';
import {
	ProcurementRepository,
	type PurchaseOrderSummary
} from '$lib/server/procurement/procurement-repository';
import {
	ProjectCommercialControlRepository,
	type CommercialVariationSummary,
	type CommercialVariationVersionSummary,
	type ProjectBudgetSummary,
	type ProjectBudgetVersionSummary,
	type ProjectCostCodeSummary
} from './project-commercial-control-repository';

export class ProjectCommercialControlValidationError extends Error {
	readonly code = 'PROJECT_COMMERCIAL_CONTROL_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProjectCommercialControlValidationError';
	}
}

export type ProjectCommercialPosition = {
	projectPublicId: string;
	currencyCode: string;
	approvedBaselineBudget: string;
	issuedPurchaseOrderCommitment: string;
	classifiedCommitment: string;
	acceptedReceiptCost: string;
	approvedChange: string;
	pendingChangeExposure: string;
	budgetHeadroom: string;
	exposedHeadroom: string;
};

export type BudgetWorkspace = ProjectBudgetSummary & {
	latestVersion: ProjectBudgetVersionSummary | null;
	total: string;
};

export type VariationWorkspace = CommercialVariationSummary & {
	latestVersion: CommercialVariationVersionSummary | null;
	versionTotal: string;
	latestDecision: string | null;
	decisionAmount: string | null;
};

export type CommercialControlWorkspace = {
	canView: boolean;
	canManageCostCodes: boolean;
	canManageBudgets: boolean;
	canApproveBudgets: boolean;
	canManageVariations: boolean;
	canIssueVariations: boolean;
	canDecideVariations: boolean;
	projects: ProjectRecord[];
	costCategories: Awaited<ReturnType<ProjectCommercialControlRepository['listCostCategories']>>;
	variationTypes: Awaited<ReturnType<ProjectCommercialControlRepository['listVariationTypes']>>;
	costCodes: ProjectCostCodeSummary[];
	budgets: BudgetWorkspace[];
	purchaseOrders: PurchaseOrderSummary[];
	variations: VariationWorkspace[];
	selectedProjectPublicId: string | null;
	position: ProjectCommercialPosition | null;
};

export type CreateCostCodeInput = {
	projectPublicId: string;
	categoryCode: string;
	code: string;
	name: string;
	description?: string | null;
};

export type CreateBudgetInput = {
	projectPublicId: string;
	costCodePublicId: string;
	name: string;
	currencyCode: string;
	effectiveOn?: string | null;
	description?: string | null;
	budgetAmount: string;
};

export type CreateVariationInput = {
	projectPublicId: string;
	costCodePublicId?: string | null;
	purchaseOrderPublicId?: string | null;
	variationTypeCode: string;
	commercialSide: string;
	title: string;
	currencyCode: string;
	description: string;
	quantity: string;
	unitRate: string;
};

function requiredText(value: string, label: string, max = 500): string {
	const text = value.trim();
	if (!text) throw new ProjectCommercialControlValidationError(`${label} is required.`);
	if (text.length > max) throw new ProjectCommercialControlValidationError(`${label} is too long.`);
	return text;
}

function optionalText(value: string | null | undefined, max = 2000): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max)
		throw new ProjectCommercialControlValidationError('A supplied value is too long.');
	return text;
}

function publicId(value: string, label: string): string {
	const text = requiredText(value, label, 36);
	if (!/^[0-9a-f-]{36}$/i.test(text))
		throw new ProjectCommercialControlValidationError(`${label} is invalid.`);
	return text;
}

function currencyCode(value: string): string {
	const code = value.trim().toUpperCase();
	if (!/^[A-Z]{3}$/.test(code))
		throw new ProjectCommercialControlValidationError('Currency must be a three-letter ISO code.');
	return code;
}

function decimal(value: string, scale: number, label: string, allowZero = false): string {
	let parsed: bigint;
	try {
		parsed = parseScaledDecimal(value, scale, label);
	} catch (cause) {
		throw new ProjectCommercialControlValidationError(
			cause instanceof Error ? cause.message : `${label} is invalid.`
		);
	}
	if (allowZero ? parsed < 0n : parsed <= 0n) {
		throw new ProjectCommercialControlValidationError(
			`${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'}.`
		);
	}
	return formatScaledDecimal(parsed, scale);
}

function dateOnly(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
		throw new ProjectCommercialControlValidationError(`${label} is invalid.`);
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()))
		throw new ProjectCommercialControlValidationError(`${label} is invalid.`);
	return date;
}

function commercialSide(value: string): string {
	if (value === 'cost' || value === 'revenue' || value === 'internal') return value;
	throw new ProjectCommercialControlValidationError('Commercial side is invalid.');
}

function variationDecision(value: string): string {
	if (
		value === 'pending' ||
		value === 'accepted' ||
		value === 'partially_accepted' ||
		value === 'rejected' ||
		value === 'withdrawn'
	) {
		return value;
	}
	throw new ProjectCommercialControlValidationError('Variation decision is invalid.');
}

function documentNumber(prefix: 'BUD' | 'VAR', id: string, now: Date): string {
	const stamp = now.toISOString().slice(0, 10).replaceAll('-', '');
	return `${prefix}-${stamp}-${id.replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

export class ProjectCommercialControlService {
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

	private async requirePermission(
		actor: TenantActorContext,
		permissionKey: string,
		db: DatabaseExecutor = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decide(actor, permissionKey);
		if (!decision.allowed)
			throw new TenantAccessError('This project commercial-control action is not permitted.');
	}

	private async requireProject(
		actor: TenantActorContext,
		projectPublicIdInput: string,
		db: DatabaseExecutor = this.db
	): Promise<ProjectRecord> {
		const project = await new ProjectRepository(db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			publicId(projectPublicIdInput, 'Project')
		);
		if (!project)
			throw new TenantAccessError('The project is outside your effective project scope.');
		return project;
	}

	private async projectForId(
		actor: TenantActorContext,
		projectId: string,
		db: DatabaseExecutor = this.db
	) {
		const projects = await new ProjectRepository(db).listForMember(
			actor.organisationId,
			actor.memberId
		);
		const project = projects.find((row) => row.id === projectId);
		if (!project)
			throw new TenantAccessError('The commercial record is outside your effective project scope.');
		return project;
	}

	private async permissionFlags(actor: TenantActorContext) {
		const decisions = await new PermissionService(this.db).decideMany(actor, [
			'commercial.cost_control.view',
			'commercial.cost_code.manage',
			'commercial.budget.manage',
			'commercial.budget.approve',
			'commercial.variation.manage',
			'commercial.variation.issue',
			'commercial.variation.decide'
		]);
		const allowed = (key: string) => decisions.get(key)?.allowed ?? false;
		return {
			canView: allowed('commercial.cost_control.view'),
			canManageCostCodes: allowed('commercial.cost_code.manage'),
			canManageBudgets: allowed('commercial.budget.manage'),
			canApproveBudgets: allowed('commercial.budget.approve'),
			canManageVariations: allowed('commercial.variation.manage'),
			canIssueVariations: allowed('commercial.variation.issue'),
			canDecideVariations: allowed('commercial.variation.decide')
		};
	}

	private async calculatePosition(
		actor: TenantActorContext,
		project: ProjectRecord,
		budgets: readonly ProjectBudgetSummary[],
		variations: readonly CommercialVariationSummary[],
		orders: readonly PurchaseOrderSummary[]
	): Promise<ProjectCommercialPosition> {
		const commercialRepository = new ProjectCommercialControlRepository(this.db);
		const procurementRepository = new ProcurementRepository(this.db);
		const budgetValues: string[] = [];
		let currency = 'GBP';
		for (const budget of budgets.filter(
			(row) => row.projectId === project.id && row.status === 'active'
		)) {
			const approvedVersion = (
				await commercialRepository.listBudgetVersions(actor.organisationId, budget.id)
			).find((version) => version.status === 'approved');
			if (!approvedVersion) continue;
			currency = approvedVersion.currencyCode;
			const lines = await commercialRepository.listBudgetLines(
				actor.organisationId,
				approvedVersion.id
			);
			budgetValues.push(...lines.map((line) => line.budgetAmount));
		}
		const approvedBaselineBudget = sumMoney(budgetValues);

		const commitmentValues: string[] = [];
		const issuedItemIds: string[] = [];
		for (const order of orders.filter(
			(row) => row.projectId === project.id && row.status === 'active'
		)) {
			const latest = (
				await procurementRepository.listPurchaseOrderVersions(actor.organisationId, order.id)
			)[0];
			if (!latest || latest.status !== 'issued') continue;
			currency = order.currencyCode;
			const items = await procurementRepository.listPurchaseOrderItems(
				actor.organisationId,
				latest.id
			);
			commitmentValues.push(...items.map((item) => lineAmount(item.quantity, item.unitRate)));
			issuedItemIds.push(...items.map((item) => item.id));
		}
		const issuedPurchaseOrderCommitment = sumMoney(commitmentValues);
		const classifiedCommitment = sumMoney(
			(
				await commercialRepository.listPurchaseOrderCostAllocations(
					actor.organisationId,
					issuedItemIds
				)
			).map((allocation) => allocation.allocatedNetAmount)
		);

		const receiptValues: string[] = [];
		for (const fact of await commercialRepository.listReceiptCostFacts(
			actor.organisationId,
			project.id
		)) {
			const acceptedQuantity =
				parseScaledDecimal(fact.quantityReceived, 6, 'Received quantity') -
				parseScaledDecimal(fact.quantityRejected, 6, 'Rejected quantity');
			receiptValues.push(lineAmount(formatScaledDecimal(acceptedQuantity, 6), fact.unitRate));
		}
		const acceptedReceiptCost = sumMoney(receiptValues);

		const approvedChangeValues: string[] = [];
		const pendingChangeValues: string[] = [];
		for (const variation of variations.filter(
			(row) => row.projectId === project.id && row.status === 'active'
		)) {
			const issuedVersion = (
				await commercialRepository.listVariationVersions(actor.organisationId, variation.id)
			).find((version) => version.status === 'issued');
			if (!issuedVersion) continue;
			currency = variation.currencyCode;
			const versionTotal = sumMoney(
				(await commercialRepository.listVariationItems(actor.organisationId, issuedVersion.id)).map(
					(item) => lineAmount(item.quantity, item.unitRate)
				)
			);
			const latestDecision = (
				await commercialRepository.listVariationDecisions(actor.organisationId, issuedVersion.id)
			)[0];
			if (
				latestDecision?.decision === 'accepted' ||
				latestDecision?.decision === 'partially_accepted'
			) {
				approvedChangeValues.push(latestDecision.decisionAmount ?? versionTotal);
			} else if (!latestDecision || latestDecision.decision === 'pending') {
				pendingChangeValues.push(versionTotal);
			}
		}
		const approvedChange = sumMoney(approvedChangeValues);
		const pendingChangeExposure = sumMoney(pendingChangeValues);
		const budgetHeadroom = subtractMoney(approvedBaselineBudget, issuedPurchaseOrderCommitment);
		const exposedHeadroom = subtractMoney(budgetHeadroom, pendingChangeExposure);

		return {
			projectPublicId: project.publicId,
			currencyCode: currency,
			approvedBaselineBudget,
			issuedPurchaseOrderCommitment,
			classifiedCommitment,
			acceptedReceiptCost,
			approvedChange,
			pendingChangeExposure,
			budgetHeadroom,
			exposedHeadroom
		};
	}

	async getWorkspace(
		actor: TenantActorContext,
		selectedProjectPublicIdInput?: string | null
	): Promise<CommercialControlWorkspace> {
		await this.assertActiveActor(actor);
		const flags = await this.permissionFlags(actor);
		if (!flags.canView) {
			return {
				...flags,
				projects: [],
				costCategories: [],
				variationTypes: [],
				costCodes: [],
				budgets: [],
				purchaseOrders: [],
				variations: [],
				selectedProjectPublicId: null,
				position: null
			};
		}
		const projects = await new ProjectRepository(this.db).listForMember(
			actor.organisationId,
			actor.memberId
		);
		const projectIds = projects.map((project) => project.id);
		const repository = new ProjectCommercialControlRepository(this.db);
		const procurementRepository = new ProcurementRepository(this.db);
		const [costCategories, variationTypes, costCodes, budgetRows, purchaseOrders, variationRows] =
			await Promise.all([
				repository.listCostCategories(),
				repository.listVariationTypes(),
				repository.listCostCodes(actor.organisationId, projectIds),
				repository.listBudgets(actor.organisationId, projectIds),
				procurementRepository.listPurchaseOrders(actor.organisationId, projectIds),
				repository.listVariations(actor.organisationId, projectIds)
			]);

		const budgets: BudgetWorkspace[] = [];
		for (const row of budgetRows) {
			const versions = await repository.listBudgetVersions(actor.organisationId, row.id);
			const latestVersion = versions[0] ?? null;
			const lines = latestVersion
				? await repository.listBudgetLines(actor.organisationId, latestVersion.id)
				: [];
			budgets.push({
				...row,
				latestVersion,
				total: sumMoney(lines.map((line) => line.budgetAmount))
			});
		}

		const variations: VariationWorkspace[] = [];
		for (const row of variationRows) {
			const versions = await repository.listVariationVersions(actor.organisationId, row.id);
			const latestVersion = versions[0] ?? null;
			const items = latestVersion
				? await repository.listVariationItems(actor.organisationId, latestVersion.id)
				: [];
			const latestDecision = latestVersion
				? ((await repository.listVariationDecisions(actor.organisationId, latestVersion.id))[0] ??
					null)
				: null;
			variations.push({
				...row,
				latestVersion,
				versionTotal: sumMoney(items.map((item) => lineAmount(item.quantity, item.unitRate))),
				latestDecision: latestDecision?.decision ?? null,
				decisionAmount: latestDecision?.decisionAmount ?? null
			});
		}

		let selectedProject: ProjectRecord | null = null;
		if (selectedProjectPublicIdInput?.trim()) {
			selectedProject = await this.requireProject(actor, selectedProjectPublicIdInput);
		} else {
			selectedProject = projects[0] ?? null;
		}
		const position = selectedProject
			? await this.calculatePosition(
					actor,
					selectedProject,
					budgetRows,
					variationRows,
					purchaseOrders
				)
			: null;

		return {
			...flags,
			projects,
			costCategories,
			variationTypes,
			costCodes,
			budgets,
			purchaseOrders,
			variations,
			selectedProjectPublicId: selectedProject?.publicId ?? null,
			position
		};
	}

	async createCostCode(actor: TenantActorContext, input: CreateCostCodeInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.cost_code.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const code = requiredText(input.code, 'Cost code', 120).toUpperCase();
		const name = requiredText(input.name, 'Cost-code name', 255);
		const description = optionalText(input.description, 10_000);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'commercial.cost_code.manage', trx);
			await this.requireProject(actor, project.publicId, trx);
			const repository = new ProjectCommercialControlRepository(trx);
			const category = await repository.findCostCategoryByCode(
				requiredText(input.categoryCode, 'Cost category', 64)
			);
			if (!category)
				throw new ProjectCommercialControlValidationError(
					'The selected cost category is unavailable.'
				);
			const publicIdValue = this.publicIdFactory();
			await repository.insertCostCode({
				organisationId: actor.organisationId,
				projectId: project.id,
				publicId: publicIdValue,
				categoryId: category.id,
				parentCostCodeId: null,
				code,
				name,
				description,
				sortOrder: 10
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'commercial.cost_code.created',
				subjectType: 'project_cost_code',
				subjectPublicId: publicIdValue,
				correlationId: actor.correlationId,
				changeSummary: { code, categoryCode: category.code }
			});
			return publicIdValue;
		});
	}

	async createBudget(actor: TenantActorContext, input: CreateBudgetInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.budget.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const costCodePublicId = publicId(input.costCodePublicId, 'Cost code');
		const name = requiredText(input.name, 'Budget name', 255);
		const currency = currencyCode(input.currencyCode);
		const effectiveOn = dateOnly(input.effectiveOn, 'Effective date');
		const description = optionalText(input.description, 500);
		const amount = decimal(input.budgetAmount, 4, 'Budget amount', true);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'commercial.budget.manage', trx);
			await this.requireProject(actor, project.publicId, trx);
			const repository = new ProjectCommercialControlRepository(trx);
			const costCode = await repository.findCostCodeByPublicId(
				actor.organisationId,
				costCodePublicId
			);
			if (!costCode || costCode.projectId !== project.id || !costCode.isActive)
				throw new ProjectCommercialControlValidationError(
					'The selected cost code does not belong to this project.'
				);
			const budgetPublicId = this.publicIdFactory();
			const budgetId = await repository.insertBudget({
				organisationId: actor.organisationId,
				projectId: project.id,
				publicId: budgetPublicId,
				budgetNumber: documentNumber('BUD', budgetPublicId, this.now()),
				name,
				createdByMemberId: membership.id
			});
			const versionId = await repository.insertBudgetVersion({
				organisationId: actor.organisationId,
				budgetId,
				versionNumber: 1,
				currencyCode: currency,
				effectiveOn,
				createdByMemberId: membership.id
			});
			await repository.insertBudgetLine({
				organisationId: actor.organisationId,
				versionId,
				costCodeId: costCode.id,
				lineNumber: 10,
				description,
				budgetAmount: amount
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'commercial.budget.created',
				subjectType: 'project_budget',
				subjectPublicId: budgetPublicId,
				correlationId: actor.correlationId,
				changeSummary: { costCodePublicId, amount, currencyCode: currency }
			});
			return budgetPublicId;
		});
	}

	async approveBudget(actor: TenantActorContext, budgetPublicIdInput: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.budget.approve');
		const budgetPublicId = publicId(budgetPublicIdInput, 'Budget');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'commercial.budget.approve', trx);
			const repository = new ProjectCommercialControlRepository(trx);
			const budget = await repository.findBudgetByPublicId(actor.organisationId, budgetPublicId);
			if (!budget) throw new ProjectCommercialControlValidationError('Budget not found.');
			const project = await this.projectForId(actor, budget.projectId, trx);
			const version = (await repository.listBudgetVersions(actor.organisationId, budget.id))[0];
			if (!version || version.status !== 'draft')
				throw new ProjectCommercialControlValidationError(
					'Only the current draft budget version can be approved.'
				);
			if ((await repository.listBudgetLines(actor.organisationId, version.id)).length === 0)
				throw new ProjectCommercialControlValidationError(
					'A budget requires at least one line before approval.'
				);
			if (
				(await repository.approveBudgetVersion({
					organisationId: actor.organisationId,
					versionId: version.id,
					memberId: membership.id,
					approvedAt: this.now()
				})) !== 1
			)
				throw new ProjectCommercialControlValidationError(
					'The budget version changed before approval.'
				);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'commercial.budget.approved',
				subjectType: 'project_budget',
				subjectPublicId: budget.publicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber: version.versionNumber, currencyCode: version.currencyCode }
			});
		});
	}

	async allocatePurchaseOrderLine(
		actor: TenantActorContext,
		purchaseOrderPublicIdInput: string,
		lineNumberInput: number,
		costCodePublicIdInput: string
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.cost_code.manage');
		const purchaseOrderPublicId = publicId(purchaseOrderPublicIdInput, 'Purchase order');
		const costCodePublicId = publicId(costCodePublicIdInput, 'Cost code');
		if (!Number.isSafeInteger(lineNumberInput) || lineNumberInput <= 0)
			throw new ProjectCommercialControlValidationError('Purchase-order line is invalid.');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'commercial.cost_code.manage', trx);
			const procurementRepository = new ProcurementRepository(trx);
			const order = await procurementRepository.findPurchaseOrderByPublicId(
				actor.organisationId,
				purchaseOrderPublicId
			);
			if (!order?.projectPublicId)
				throw new ProjectCommercialControlValidationError('Purchase order not found.');
			const project = await this.requireProject(actor, order.projectPublicId, trx);
			const version = (
				await procurementRepository.listPurchaseOrderVersions(actor.organisationId, order.id)
			)[0];
			if (!version || version.status !== 'issued')
				throw new ProjectCommercialControlValidationError(
					'Only a current issued purchase order can be classified as a commitment.'
				);
			const item = (
				await procurementRepository.listPurchaseOrderItems(actor.organisationId, version.id)
			).find((row) => row.lineNumber === lineNumberInput);
			if (!item)
				throw new ProjectCommercialControlValidationError('Purchase-order line not found.');
			const repository = new ProjectCommercialControlRepository(trx);
			const costCode = await repository.findCostCodeByPublicId(
				actor.organisationId,
				costCodePublicId
			);
			if (!costCode || costCode.projectId !== project.id || !costCode.isActive)
				throw new ProjectCommercialControlValidationError(
					'The selected cost code belongs to another project or is inactive.'
				);
			const existing = await repository.listPurchaseOrderCostAllocations(actor.organisationId, [
				item.id
			]);
			if (existing.length > 0)
				throw new ProjectCommercialControlValidationError(
					'This purchase-order line is already classified. Split allocation editing is not enabled in this V1 flow.'
				);
			const netAmount = lineAmount(item.quantity, item.unitRate);
			await repository.insertPurchaseOrderCostAllocation({
				organisationId: actor.organisationId,
				purchaseOrderItemId: item.id,
				costCodeId: costCode.id,
				allocatedNetAmount: netAmount,
				createdByMemberId: membership.id
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'commercial.commitment.classified',
				subjectType: 'purchase_order',
				subjectPublicId: order.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					lineNumber: lineNumberInput,
					costCodePublicId,
					allocatedNetAmount: netAmount
				}
			});
		});
	}

	async createVariation(actor: TenantActorContext, input: CreateVariationInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.variation.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const side = commercialSide(input.commercialSide);
		const title = requiredText(input.title, 'Variation title', 500);
		const currency = currencyCode(input.currencyCode);
		const description = requiredText(input.description, 'Variation description', 10_000);
		const quantity = decimal(input.quantity, 6, 'Variation quantity');
		const unitRate = decimal(input.unitRate, 4, 'Variation unit rate', true);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'commercial.variation.manage', trx);
			await this.requireProject(actor, project.publicId, trx);
			const repository = new ProjectCommercialControlRepository(trx);
			const variationType = await repository.findVariationTypeByCode(
				requiredText(input.variationTypeCode, 'Variation type', 64)
			);
			if (!variationType)
				throw new ProjectCommercialControlValidationError(
					'The selected variation type is unavailable.'
				);
			let costCodeId: string | null = null;
			if (input.costCodePublicId?.trim()) {
				const costCode = await repository.findCostCodeByPublicId(
					actor.organisationId,
					publicId(input.costCodePublicId, 'Cost code')
				);
				if (!costCode || costCode.projectId !== project.id || !costCode.isActive)
					throw new ProjectCommercialControlValidationError(
						'The selected cost code belongs to another project or is inactive.'
					);
				costCodeId = costCode.id;
			}
			let purchaseOrder: PurchaseOrderSummary | null = null;
			if (input.purchaseOrderPublicId?.trim()) {
				if (side !== 'cost')
					throw new ProjectCommercialControlValidationError(
						'Only cost-side variations can link directly to a purchase order.'
					);
				purchaseOrder = await new ProcurementRepository(trx).findPurchaseOrderByPublicId(
					actor.organisationId,
					publicId(input.purchaseOrderPublicId, 'Purchase order')
				);
				if (!purchaseOrder || purchaseOrder.projectId !== project.id)
					throw new ProjectCommercialControlValidationError(
						'The selected purchase order belongs to another project.'
					);
			}
			const variationPublicId = this.publicIdFactory();
			const variationId = await repository.insertVariation({
				organisationId: actor.organisationId,
				projectId: project.id,
				publicId: variationPublicId,
				variationNumber: documentNumber('VAR', variationPublicId, this.now()),
				variationTypeId: variationType.id,
				commercialSide: side,
				counterpartyPartyId: purchaseOrder?.supplierPartyId ?? null,
				currencyCode: currency,
				title,
				ownerMemberId: membership.id
			});
			if (purchaseOrder) {
				await repository.insertPurchaseOrderVariationLink({
					organisationId: actor.organisationId,
					variationId,
					purchaseOrderId: purchaseOrder.id
				});
			}
			const versionId = await repository.insertVariationVersion({
				organisationId: actor.organisationId,
				variationId,
				versionNumber: 1,
				title,
				createdByMemberId: membership.id
			});
			await repository.insertVariationItem({
				organisationId: actor.organisationId,
				versionId,
				costCodeId,
				lineNumber: 10,
				description,
				quantity,
				unitRate
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'commercial.variation.created',
				subjectType: 'commercial_variation',
				subjectPublicId: variationPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					commercialSide: side,
					variationTypeCode: variationType.code,
					purchaseOrderPublicId: purchaseOrder?.publicId ?? null,
					value: lineAmount(quantity, unitRate)
				}
			});
			return variationPublicId;
		});
	}

	async issueVariation(actor: TenantActorContext, variationPublicIdInput: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.variation.issue');
		const variationPublicId = publicId(variationPublicIdInput, 'Variation');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'commercial.variation.issue', trx);
			const repository = new ProjectCommercialControlRepository(trx);
			const variation = await repository.findVariationByPublicId(
				actor.organisationId,
				variationPublicId
			);
			if (!variation) throw new ProjectCommercialControlValidationError('Variation not found.');
			const project = await this.projectForId(actor, variation.projectId, trx);
			const version = (
				await repository.listVariationVersions(actor.organisationId, variation.id)
			)[0];
			if (!version || version.status !== 'draft')
				throw new ProjectCommercialControlValidationError(
					'Only the current draft variation version can be issued.'
				);
			if ((await repository.listVariationItems(actor.organisationId, version.id)).length === 0)
				throw new ProjectCommercialControlValidationError(
					'A variation requires at least one item before issue.'
				);
			if (
				(await repository.issueVariationVersion({
					organisationId: actor.organisationId,
					versionId: version.id,
					lockedAt: this.now()
				})) !== 1
			)
				throw new ProjectCommercialControlValidationError('The variation changed before issue.');
			await repository.insertVariationIssueEvent({
				organisationId: actor.organisationId,
				versionId: version.id,
				memberId: membership.id,
				channel: 'manual',
				note: 'Issued through NuBlox project commercial control.'
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'commercial.variation.issued',
				subjectType: 'commercial_variation',
				subjectPublicId: variation.publicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber: version.versionNumber }
			});
		});
	}

	async decideVariation(
		actor: TenantActorContext,
		variationPublicIdInput: string,
		decisionInput: string,
		decisionAmountInput?: string | null,
		commentsInput?: string | null
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.variation.decide');
		const variationPublicId = publicId(variationPublicIdInput, 'Variation');
		const decision = variationDecision(decisionInput);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'commercial.variation.decide', trx);
			const repository = new ProjectCommercialControlRepository(trx);
			const variation = await repository.findVariationByPublicId(
				actor.organisationId,
				variationPublicId
			);
			if (!variation) throw new ProjectCommercialControlValidationError('Variation not found.');
			const project = await this.projectForId(actor, variation.projectId, trx);
			const version = (
				await repository.listVariationVersions(actor.organisationId, variation.id)
			).find((row) => row.status === 'issued');
			if (!version)
				throw new ProjectCommercialControlValidationError(
					'Only an issued variation can receive a decision.'
				);
			const versionTotal = sumMoney(
				(await repository.listVariationItems(actor.organisationId, version.id)).map((item) =>
					lineAmount(item.quantity, item.unitRate)
				)
			);
			let decisionAmount: string | null = null;
			if (decision === 'accepted' || decision === 'partially_accepted') {
				const supplied = decisionAmountInput?.trim();
				decisionAmount = supplied ? decimal(supplied, 4, 'Decision amount', true) : versionTotal;
			} else if (decisionAmountInput?.trim()) {
				throw new ProjectCommercialControlValidationError(
					'A decision amount is only valid for accepted or partially accepted variations.'
				);
			}
			await repository.insertVariationDecision({
				organisationId: actor.organisationId,
				versionId: version.id,
				decision,
				decisionAmount,
				respondingPartyId: variation.counterpartyPartyId,
				recordedByMemberId: membership.id,
				decidedAt: this.now(),
				comments: optionalText(commentsInput, 10_000)
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'commercial.variation.decision_recorded',
				subjectType: 'commercial_variation',
				subjectPublicId: variation.publicId,
				correlationId: actor.correlationId,
				changeSummary: { decision, decisionAmount, versionNumber: version.versionNumber }
			});
		});
	}
}
