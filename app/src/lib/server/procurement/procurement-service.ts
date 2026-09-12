import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import {
	formatScaledDecimal,
	lineAmount,
	parseScaledDecimal,
	sumMoney
} from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectRecord } from '$lib/server/projects/project-repository';
import {
	ProcurementRepository,
	type ProcurementPackageSummary,
	type PurchaseOrderItemSummary,
	type PurchaseOrderSummary,
	type PurchaseOrderVersionSummary
} from './procurement-repository';
import { SupplierRfqPortalService } from './supplier-rfq-portal-service';

export class ProcurementValidationError extends Error {
	readonly code = 'PROCUREMENT_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProcurementValidationError';
	}
}

export type ProcurementWorkspacePackage = ProcurementPackageSummary & {
	itemCount: number;
	rfqCount: number;
	latestRfqStatus: string | null;
};

export type ProcurementWorkspaceOrder = PurchaseOrderSummary & {
	latestVersion: PurchaseOrderVersionSummary | null;
	items: PurchaseOrderItemSummary[];
	netTotal: string;
	receiptCount: number;
};

export type ProcurementWorkspace = {
	canView: boolean;
	canManagePackages: boolean;
	canManageRfqs: boolean;
	canIssueRfqs: boolean;
	canManagePurchaseOrders: boolean;
	canApprovePurchaseOrders: boolean;
	canIssuePurchaseOrders: boolean;
	canManageReceipts: boolean;
	projects: ProjectRecord[];
	suppliers: Awaited<ReturnType<ProcurementRepository['listEligibleSuppliers']>>;
	packageTypes: Awaited<ReturnType<ProcurementRepository['listPackageTypes']>>;
	purchaseOrderTypes: Awaited<ReturnType<ProcurementRepository['listPurchaseOrderTypes']>>;
	salesItemTypes: Awaited<ReturnType<ProcurementRepository['listSalesItemTypes']>>;
	units: Awaited<ReturnType<ProcurementRepository['listUnitsOfMeasure']>>;
	packages: ProcurementWorkspacePackage[];
	orders: ProcurementWorkspaceOrder[];
};

export type CreateProcurementPackageInput = {
	projectPublicId: string;
	packageTypeCode: string;
	title: string;
	description?: string | null;
	currencyCode: string;
	requiredByDate?: string | null;
	salesItemTypeId: number;
	unitOfMeasureId?: number | null;
	lineDescription: string;
	quantity: string;
	targetUnitCost?: string | null;
};

export type CreateRfqInput = {
	packagePublicId: string;
	title: string;
	responseDeadlineAt?: string | null;
};

export type CreatePurchaseOrderInput = {
	projectPublicId: string;
	packagePublicId?: string | null;
	supplierPublicId: string;
	purchaseOrderTypeCode: string;
	title: string;
	supplierReference?: string | null;
	currencyCode: string;
	orderDate?: string | null;
	requiredByDate?: string | null;
	salesItemTypeId: number;
	unitOfMeasureId?: number | null;
	lineDescription: string;
	quantity: string;
	unitRate: string;
};

export type RecordReceiptInput = {
	purchaseOrderPublicId: string;
	lineNumber: number;
	receiptType: string;
	quantityReceived: string;
	quantityRejected?: string | null;
	supplierDeliveryReference?: string | null;
	notes?: string | null;
};

function requiredText(value: string, label: string, max = 500): string {
	const text = value.trim();
	if (!text) throw new ProcurementValidationError(`${label} is required.`);
	if (text.length > max) throw new ProcurementValidationError(`${label} is too long.`);
	return text;
}

function optionalText(value: string | null | undefined, max = 1000): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max) throw new ProcurementValidationError('A supplied value is too long.');
	return text;
}

function publicId(value: string, label: string): string {
	const text = requiredText(value, label, 36);
	if (!/^[0-9a-f-]{36}$/i.test(text)) throw new ProcurementValidationError(`${label} is invalid.`);
	return text;
}

function currencyCode(value: string): string {
	const code = value.trim().toUpperCase();
	if (!/^[A-Z]{3}$/.test(code))
		throw new ProcurementValidationError('Currency must be a three-letter ISO code.');
	return code;
}

function decimal(value: string, scale: number, label: string, allowZero = false): string {
	let parsed: bigint;
	try {
		parsed = parseScaledDecimal(value, scale, label);
	} catch (cause) {
		throw new ProcurementValidationError(
			cause instanceof Error ? cause.message : `${label} is invalid.`
		);
	}
	if (allowZero ? parsed < 0n : parsed <= 0n) {
		throw new ProcurementValidationError(
			`${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'}.`
		);
	}
	return formatScaledDecimal(parsed, scale);
}

function optionalMoney(value: string | null | undefined, label: string): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	return decimal(text, 4, label, true);
}

function dateOnly(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
		throw new ProcurementValidationError(`${label} is invalid.`);
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime())) throw new ProcurementValidationError(`${label} is invalid.`);
	return date;
}

function dateTime(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text}:00.000Z`;
	const date = new Date(normalized);
	if (Number.isNaN(date.getTime())) throw new ProcurementValidationError(`${label} is invalid.`);
	return date;
}

function positiveInteger(value: number, label: string): number {
	if (!Number.isSafeInteger(value) || value <= 0)
		throw new ProcurementValidationError(`${label} is invalid.`);
	return value;
}

function documentNumber(prefix: 'PKG' | 'RFQ' | 'PO' | 'GRN', id: string, now: Date): string {
	const stamp = now.toISOString().slice(0, 10).replaceAll('-', '');
	return `${prefix}-${stamp}-${id.replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

function receiptType(value: string): string {
	if (value === 'goods' || value === 'service' || value === 'mixed') return value;
	throw new ProcurementValidationError('Receipt type is invalid.');
}

export class ProcurementService {
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
		if (!decision.allowed) throw new TenantAccessError('This procurement action is not permitted.');
	}

	private async requireProject(
		actor: TenantActorContext,
		projectPublicId: string,
		db: DatabaseExecutor = this.db
	): Promise<ProjectRecord> {
		const project = await new ProjectRepository(db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			publicId(projectPublicId, 'Project')
		);
		if (!project)
			throw new TenantAccessError('The project is outside your effective project scope.');
		return project;
	}

	private async requirePackage(
		actor: TenantActorContext,
		packagePublicIdInput: string,
		db: DatabaseExecutor = this.db
	): Promise<ProcurementPackageSummary> {
		const repository = new ProcurementRepository(db);
		const procurementPackage = await repository.findPackageByPublicId(
			actor.organisationId,
			publicId(packagePublicIdInput, 'Procurement package')
		);
		if (!procurementPackage?.projectPublicId)
			throw new TenantAccessError('Procurement package not found in your project scope.');
		await this.requireProject(actor, procurementPackage.projectPublicId, db);
		return procurementPackage;
	}

	private async requirePurchaseOrder(
		actor: TenantActorContext,
		purchaseOrderPublicIdInput: string,
		db: DatabaseExecutor = this.db
	): Promise<PurchaseOrderSummary> {
		const repository = new ProcurementRepository(db);
		const order = await repository.findPurchaseOrderByPublicId(
			actor.organisationId,
			publicId(purchaseOrderPublicIdInput, 'Purchase order')
		);
		if (!order?.projectPublicId)
			throw new TenantAccessError('Purchase order not found in your project scope.');
		await this.requireProject(actor, order.projectPublicId, db);
		return order;
	}

	private async permissionFlags(actor: TenantActorContext) {
		const decisions = await new PermissionService(this.db).decideMany(actor, [
			'procurement.view',
			'procurement.package.manage',
			'procurement.rfq.manage',
			'procurement.rfq.issue',
			'procurement.po.manage',
			'procurement.po.approve',
			'procurement.po.issue',
			'procurement.receipt.manage'
		]);
		const allowed = (key: string) => decisions.get(key)?.allowed ?? false;
		return {
			canView: allowed('procurement.view'),
			canManagePackages: allowed('procurement.package.manage'),
			canManageRfqs: allowed('procurement.rfq.manage'),
			canIssueRfqs: allowed('procurement.rfq.issue'),
			canManagePurchaseOrders: allowed('procurement.po.manage'),
			canApprovePurchaseOrders: allowed('procurement.po.approve'),
			canIssuePurchaseOrders: allowed('procurement.po.issue'),
			canManageReceipts: allowed('procurement.receipt.manage')
		};
	}

	async getWorkspace(actor: TenantActorContext): Promise<ProcurementWorkspace> {
		await this.assertActiveActor(actor);
		const flags = await this.permissionFlags(actor);
		if (!flags.canView) {
			return {
				...flags,
				projects: [],
				suppliers: [],
				packageTypes: [],
				purchaseOrderTypes: [],
				salesItemTypes: [],
				units: [],
				packages: [],
				orders: []
			};
		}
		const projects = await new ProjectRepository(this.db).listForMember(
			actor.organisationId,
			actor.memberId
		);
		const repository = new ProcurementRepository(this.db);
		const projectIds = projects.map((project) => project.id);
		const [
			suppliers,
			packageTypes,
			purchaseOrderTypes,
			salesItemTypes,
			units,
			packageRows,
			orderRows
		] = await Promise.all([
			repository.listEligibleSuppliers(actor.organisationId),
			repository.listPackageTypes(),
			repository.listPurchaseOrderTypes(),
			repository.listSalesItemTypes(),
			repository.listUnitsOfMeasure(),
			repository.listPackages(actor.organisationId, projectIds),
			repository.listPurchaseOrders(actor.organisationId, projectIds)
		]);

		const rfqs = await repository.listRfqsForPackages(
			actor.organisationId,
			packageRows.map((row) => row.id)
		);
		const packages: ProcurementWorkspacePackage[] = [];
		for (const row of packageRows) {
			const packageRfqs = rfqs.filter((rfq) => rfq.packageId === row.id);
			let latestRfqStatus: string | null = null;
			if (packageRfqs[0]) {
				latestRfqStatus =
					(await repository.listRfqVersions(actor.organisationId, packageRfqs[0].id))[0]?.status ??
					null;
			}
			packages.push({
				...row,
				itemCount: (await repository.listPackageItems(actor.organisationId, row.id)).length,
				rfqCount: packageRfqs.length,
				latestRfqStatus
			});
		}

		const orders: ProcurementWorkspaceOrder[] = [];
		for (const row of orderRows) {
			const versions = await repository.listPurchaseOrderVersions(actor.organisationId, row.id);
			const latestVersion = versions[0] ?? null;
			const items = latestVersion
				? await repository.listPurchaseOrderItems(actor.organisationId, latestVersion.id)
				: [];
			orders.push({
				...row,
				latestVersion,
				items,
				netTotal: sumMoney(items.map((item) => lineAmount(item.quantity, item.unitRate))),
				receiptCount: (await repository.listReceipts(actor.organisationId, row.id)).filter(
					(receipt) => receipt.status !== 'reversed' && receipt.status !== 'cancelled'
				).length
			});
		}

		return {
			...flags,
			projects,
			suppliers,
			packageTypes,
			purchaseOrderTypes,
			salesItemTypes,
			units,
			packages,
			orders
		};
	}

	async createPackage(
		actor: TenantActorContext,
		input: CreateProcurementPackageInput
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'procurement.package.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const title = requiredText(input.title, 'Package title', 255);
		const description = optionalText(input.description, 10_000);
		const currency = currencyCode(input.currencyCode);
		const requiredBy = dateOnly(input.requiredByDate, 'Required-by date');
		const salesItemTypeId = positiveInteger(input.salesItemTypeId, 'Item type');
		const unitOfMeasureId = input.unitOfMeasureId
			? positiveInteger(input.unitOfMeasureId, 'Unit')
			: null;
		const lineDescription = requiredText(input.lineDescription, 'Requirement description', 1000);
		const quantity = decimal(input.quantity, 4, 'Quantity');
		const targetUnitCost = optionalMoney(input.targetUnitCost, 'Target unit cost');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'procurement.package.manage', trx);
			await this.requireProject(actor, project.publicId, trx);
			const repository = new ProcurementRepository(trx);
			const packageType = await repository.findPackageTypeByCode(
				requiredText(input.packageTypeCode, 'Package type', 80)
			);
			if (!packageType) throw new ProcurementValidationError('Package type is invalid.');
			if (!(await repository.listSalesItemTypes()).some((row) => row.id === salesItemTypeId))
				throw new ProcurementValidationError('The selected item type is unavailable.');
			if (
				unitOfMeasureId !== null &&
				!(await repository.listUnitsOfMeasure()).some((row) => row.id === unitOfMeasureId)
			)
				throw new ProcurementValidationError('The selected unit is unavailable.');
			const packagePublicId = this.publicIdFactory();
			const packageId = await repository.insertPackage({
				organisationId: actor.organisationId,
				publicId: packagePublicId,
				packageNumber: documentNumber('PKG', packagePublicId, this.now()),
				packageTypeId: packageType.id,
				projectId: project.id,
				ownerMemberId: membership.id,
				title,
				description,
				currencyCode: currency,
				requiredByDate: requiredBy
			});
			await repository.insertPackageItem({
				organisationId: actor.organisationId,
				packageId,
				salesItemTypeId,
				unitOfMeasureId,
				lineNumber: 10,
				description: lineDescription,
				quantity,
				targetUnitCost,
				requiredByDate: requiredBy
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'procurement.package.created',
				subjectType: 'procurement_package',
				subjectPublicId: packagePublicId,
				correlationId: actor.correlationId,
				changeSummary: { projectPublicId: project.publicId, quantity, targetUnitCost }
			});
			return packagePublicId;
		});
	}

	async createRfq(actor: TenantActorContext, input: CreateRfqInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'procurement.rfq.manage');
		const procurementPackage = await this.requirePackage(actor, input.packagePublicId);
		const title = requiredText(input.title, 'RFQ title', 255);
		const deadline = dateTime(input.responseDeadlineAt, 'Response deadline');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'procurement.rfq.manage', trx);
			const currentPackage = await this.requirePackage(actor, procurementPackage.publicId, trx);
			const repository = new ProcurementRepository(trx);
			const packageItems = await repository.listPackageItems(
				actor.organisationId,
				currentPackage.id
			);
			if (packageItems.length === 0)
				throw new ProcurementValidationError(
					'The procurement package has no requirements to enquire.'
				);
			const rfqPublicId = this.publicIdFactory();
			const rfqId = await repository.insertRfq({
				organisationId: actor.organisationId,
				publicId: rfqPublicId,
				rfqNumber: documentNumber('RFQ', rfqPublicId, this.now()),
				packageId: currentPackage.id,
				ownerMemberId: membership.id
			});
			const versionId = await repository.insertRfqVersion({
				organisationId: actor.organisationId,
				rfqId,
				versionNumber: 1,
				title,
				currencyCode: currentPackage.currencyCode,
				responseDeadlineAt: deadline,
				createdByMemberId: membership.id
			});
			for (const item of packageItems) {
				await repository.insertRfqItem({
					organisationId: actor.organisationId,
					versionId,
					sourcePackageItemId: item.id,
					salesItemTypeId: item.salesItemTypeId,
					unitOfMeasureId: item.unitOfMeasureId,
					lineNumber: item.lineNumber,
					description: item.description,
					quantity: item.quantity,
					requiredByDate: item.requiredByDate
				});
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: currentPackage.projectId,
				actionKey: 'procurement.rfq.created',
				subjectType: 'rfq',
				subjectPublicId: rfqPublicId,
				correlationId: actor.correlationId,
				changeSummary: { packagePublicId: currentPackage.publicId, versionNumber: 1 }
			});
			return rfqPublicId;
		});
	}

	async issueRfq(
		actor: TenantActorContext,
		rfqPublicIdInput: string,
		supplierPublicIdInput: string
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'procurement.rfq.issue');
		const rfqPublicId = publicId(rfqPublicIdInput, 'RFQ');
		const supplierPublicId = publicId(supplierPublicIdInput, 'Supplier');
		const invitationId = await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'procurement.rfq.issue', trx);
			const repository = new ProcurementRepository(trx);
			const rfq = await repository.findRfqByPublicId(actor.organisationId, rfqPublicId);
			if (!rfq) throw new ProcurementValidationError('RFQ not found.');
			const procurementPackage = await repository.findPackageByPublicId(
				actor.organisationId,
				(
					await trx
						.selectFrom('procurement_packages')
						.select('public_id')
						.where('id', '=', rfq.packageId)
						.where('organisation_id', '=', actor.organisationId)
						.executeTakeFirstOrThrow()
				).public_id
			);
			if (!procurementPackage?.projectPublicId) throw new TenantAccessError();
			await this.requireProject(actor, procurementPackage.projectPublicId, trx);
			const supplier = await repository.findEligibleSupplierByPublicId(
				actor.organisationId,
				supplierPublicId
			);
			if (!supplier)
				throw new ProcurementValidationError(
					'The selected CRM party is not an active supplier-side party.'
				);
			if (!supplier.primaryEmail)
				throw new ProcurementValidationError(
					'The selected supplier needs a primary email address before an RFQ can be issued to the portal.'
				);
			const version = (await repository.listRfqVersions(actor.organisationId, rfq.id))[0];
			if (!version || !['draft', 'issued'].includes(version.status))
				throw new ProcurementValidationError(
					'Only the current draft or issued RFQ version can invite suppliers.'
				);
			if (version.responseDeadlineAt && version.responseDeadlineAt <= this.now())
				throw new ProcurementValidationError(
					'The RFQ response deadline must be in the future before issue.'
				);
			const duplicateInvitation = await trx
				.selectFrom('rfq_invitations')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('rfq_version_id', '=', version.id)
				.where('supplier_party_id', '=', supplier.id)
				.executeTakeFirst();
			if (duplicateInvitation)
				throw new ProcurementValidationError('This supplier has already been invited to this RFQ.');
			if (
				version.status === 'draft' &&
				(await repository.issueRfqVersion({
					organisationId: actor.organisationId,
					versionId: version.id,
					memberId: membership.id
				})) !== 1
			)
				throw new ProcurementValidationError('The RFQ version changed before it could be issued.');
			const issueEventId = await repository.insertRfqIssueEvent({
				organisationId: actor.organisationId,
				versionId: version.id,
				memberId: membership.id,
				channel: 'portal',
				note: 'Issued through the NuBlox supplier quotation portal.'
			});
			const createdInvitationId = await repository.insertRfqInvitation({
				organisationId: actor.organisationId,
				issueEventId,
				versionId: version.id,
				supplierPartyId: supplier.id,
				recipientName: supplier.displayName,
				recipientEmail: supplier.primaryEmail
			});
			await trx
				.updateTable('procurement_packages')
				.set({ lifecycle_status: 'enquiring' })
				.where('id', '=', procurementPackage.id)
				.where('organisation_id', '=', actor.organisationId)
				.where('lifecycle_status', 'in', ['draft', 'planned', 'enquiring'])
				.executeTakeFirst();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: procurementPackage.projectId,
				actionKey: 'procurement.rfq.issued',
				subjectType: 'rfq',
				subjectPublicId: rfq.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					versionNumber: version.versionNumber,
					supplierPublicId,
					deliveryChannel: 'portal',
					recipientEmail: supplier.primaryEmail
				}
			});
			return createdInvitationId;
		});
		await new SupplierRfqPortalService(this.db).sendInvitation(invitationId);
	}

	async createPurchaseOrder(
		actor: TenantActorContext,
		input: CreatePurchaseOrderInput
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'procurement.po.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const supplierPublicId = publicId(input.supplierPublicId, 'Supplier');
		const title = requiredText(input.title, 'Purchase-order title', 255);
		const supplierReference = optionalText(input.supplierReference, 160);
		const currency = currencyCode(input.currencyCode);
		const orderDate = dateOnly(input.orderDate, 'Order date');
		const requiredByDate = dateOnly(input.requiredByDate, 'Required-by date');
		const salesItemTypeId = positiveInteger(input.salesItemTypeId, 'Item type');
		const unitOfMeasureId = input.unitOfMeasureId
			? positiveInteger(input.unitOfMeasureId, 'Unit')
			: null;
		const lineDescription = requiredText(input.lineDescription, 'Order line description', 1000);
		const quantity = decimal(input.quantity, 4, 'Quantity');
		const unitRate = decimal(input.unitRate, 4, 'Unit rate', true);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'procurement.po.manage', trx);
			const currentProject = await this.requireProject(actor, project.publicId, trx);
			const repository = new ProcurementRepository(trx);
			const supplier = await repository.findEligibleSupplierByPublicId(
				actor.organisationId,
				supplierPublicId
			);
			if (!supplier) throw new ProcurementValidationError('Supplier is invalid.');
			const purchaseOrderType = await repository.findPurchaseOrderTypeByCode(
				requiredText(input.purchaseOrderTypeCode, 'Purchase-order type', 80)
			);
			if (!purchaseOrderType)
				throw new ProcurementValidationError('Purchase-order type is invalid.');
			if (!(await repository.listSalesItemTypes()).some((row) => row.id === salesItemTypeId))
				throw new ProcurementValidationError('The selected item type is unavailable.');
			if (
				unitOfMeasureId !== null &&
				!(await repository.listUnitsOfMeasure()).some((row) => row.id === unitOfMeasureId)
			)
				throw new ProcurementValidationError('The selected unit is unavailable.');
			let procurementPackageId: string | null = null;
			if (input.packagePublicId?.trim()) {
				const procurementPackage = await this.requirePackage(actor, input.packagePublicId, trx);
				if (procurementPackage.projectId !== currentProject.id)
					throw new ProcurementValidationError(
						'The procurement package belongs to another project.'
					);
				procurementPackageId = procurementPackage.id;
			}
			const orderPublicId = this.publicIdFactory();
			const orderId = await repository.insertPurchaseOrder({
				organisationId: actor.organisationId,
				publicId: orderPublicId,
				purchaseOrderNumber: documentNumber('PO', orderPublicId, this.now()),
				purchaseOrderTypeId: purchaseOrderType.id,
				supplierPartyId: supplier.id,
				projectId: currentProject.id,
				packageId: procurementPackageId,
				ownerMemberId: membership.id,
				currencyCode: currency
			});
			const versionId = await repository.insertPurchaseOrderVersion({
				organisationId: actor.organisationId,
				purchaseOrderId: orderId,
				versionNumber: 1,
				title,
				supplierReference,
				orderDate,
				requiredByDate,
				createdByMemberId: membership.id
			});
			await repository.insertPurchaseOrderItem({
				organisationId: actor.organisationId,
				versionId,
				salesItemTypeId,
				unitOfMeasureId,
				lineNumber: 10,
				description: lineDescription,
				quantity,
				unitRate,
				requiredByDate
			});
			await repository.insertPurchaseOrderPartySnapshot({
				organisationId: actor.organisationId,
				versionId,
				role: 'supplier',
				displayName: supplier.displayName,
				email: supplier.primaryEmail,
				sourcePartyId: supplier.id,
				referenceIdentifier: supplier.publicId,
				sortOrder: 10
			});
			const address = await repository.findPrimarySupplierAddress(
				actor.organisationId,
				supplier.id
			);
			if (address) {
				const snapshot = await trx
					.selectFrom('purchase_order_party_snapshots')
					.select('id')
					.where('organisation_id', '=', actor.organisationId)
					.where('purchase_order_version_id', '=', versionId)
					.where('snapshot_role', '=', 'supplier')
					.executeTakeFirstOrThrow();
				await repository.insertPurchaseOrderPartyAddressSnapshot({
					organisationId: actor.organisationId,
					versionId,
					partySnapshotId: snapshot.id,
					addressRole: address.addressRole,
					line1: address.line1,
					line2: address.line2,
					line3: address.line3,
					locality: address.locality,
					city: address.city,
					region: address.region,
					postalCode: address.postalCode,
					countryCode: address.countryCode
				});
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: currentProject.id,
				actionKey: 'procurement.po.created',
				subjectType: 'purchase_order',
				subjectPublicId: orderPublicId,
				correlationId: actor.correlationId,
				changeSummary: { supplierPublicId: supplier.publicId, quantity, unitRate }
			});
			return orderPublicId;
		});
	}

	async approvePurchaseOrder(
		actor: TenantActorContext,
		purchaseOrderPublicIdInput: string
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'procurement.po.approve');
		const order = await this.requirePurchaseOrder(actor, purchaseOrderPublicIdInput);
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'procurement.po.approve', trx);
			const current = await this.requirePurchaseOrder(actor, order.publicId, trx);
			const repository = new ProcurementRepository(trx);
			const version = (
				await repository.listPurchaseOrderVersions(actor.organisationId, current.id)
			)[0];
			if (!version || version.status !== 'draft')
				throw new ProcurementValidationError(
					'Only the current draft purchase order can be approved.'
				);
			if (
				(await repository.approvePurchaseOrderVersion({
					organisationId: actor.organisationId,
					versionId: version.id,
					memberId: membership.id
				})) !== 1
			)
				throw new ProcurementValidationError(
					'The purchase order changed before it could be approved.'
				);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: current.projectId,
				actionKey: 'procurement.po.approved',
				subjectType: 'purchase_order',
				subjectPublicId: current.publicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber: version.versionNumber }
			});
		});
	}

	async issuePurchaseOrder(
		actor: TenantActorContext,
		purchaseOrderPublicIdInput: string
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'procurement.po.issue');
		const order = await this.requirePurchaseOrder(actor, purchaseOrderPublicIdInput);
		await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'procurement.po.issue', trx);
			const current = await this.requirePurchaseOrder(actor, order.publicId, trx);
			const repository = new ProcurementRepository(trx);
			const version = (
				await repository.listPurchaseOrderVersions(actor.organisationId, current.id)
			)[0];
			if (!version || version.status !== 'approved')
				throw new ProcurementValidationError(
					'Only the approved purchase-order version can be issued.'
				);
			if (
				(await repository.issuePurchaseOrderVersion({
					organisationId: actor.organisationId,
					versionId: version.id,
					memberId: membership.id
				})) !== 1
			)
				throw new ProcurementValidationError(
					'The purchase order changed before it could be issued.'
				);
			const issueEventId = await repository.insertPurchaseOrderIssueEvent({
				organisationId: actor.organisationId,
				versionId: version.id,
				memberId: membership.id,
				channel: 'manual',
				note: 'Issued through NuBlox procurement control.'
			});
			await repository.insertPurchaseOrderIssueRecipient({
				organisationId: actor.organisationId,
				issueEventId,
				versionId: version.id,
				partyId: current.supplierPartyId,
				recipientName: current.supplierName,
				recipientEmail:
					(
						await repository.findEligibleSupplierByPublicId(
							actor.organisationId,
							current.supplierPublicId
						)
					)?.primaryEmail ?? null
			});
			await trx
				.updateTable('purchase_orders')
				.set({ lifecycle_status: 'issued' })
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', current.id)
				.executeTakeFirst();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: current.projectId,
				actionKey: 'procurement.po.issued',
				subjectType: 'purchase_order',
				subjectPublicId: current.publicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber: version.versionNumber }
			});
		});
	}

	async recordReceipt(actor: TenantActorContext, input: RecordReceiptInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'procurement.receipt.manage');
		const order = await this.requirePurchaseOrder(actor, input.purchaseOrderPublicId);
		const receiptKind = receiptType(input.receiptType);
		const quantityReceived = decimal(input.quantityReceived, 4, 'Quantity received');
		const quantityRejected = decimal(
			input.quantityRejected?.trim() || '0',
			4,
			'Quantity rejected',
			true
		);
		const deliveryReference = optionalText(input.supplierDeliveryReference, 160);
		const notes = optionalText(input.notes, 4000);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'procurement.receipt.manage', trx);
			const current = await this.requirePurchaseOrder(actor, order.publicId, trx);
			const repository = new ProcurementRepository(trx);
			const version = (
				await repository.listPurchaseOrderVersions(actor.organisationId, current.id)
			)[0];
			if (!version || version.status !== 'issued')
				throw new ProcurementValidationError(
					'Receipts can only be recorded against an issued purchase order.'
				);
			const item = (await repository.listPurchaseOrderItems(actor.organisationId, version.id)).find(
				(row) => row.lineNumber === positiveInteger(input.lineNumber, 'Purchase-order line')
			);
			if (!item) throw new ProcurementValidationError('Purchase-order line not found.');
			if (
				parseScaledDecimal(quantityRejected, 4, 'Quantity rejected') >
				parseScaledDecimal(quantityReceived, 4, 'Quantity received')
			)
				throw new ProcurementValidationError('Rejected quantity cannot exceed received quantity.');
			const receiptPublicId = this.publicIdFactory();
			const receiptId = await repository.insertReceipt({
				organisationId: actor.organisationId,
				publicId: receiptPublicId,
				purchaseOrderId: current.id,
				receiptNumber: documentNumber('GRN', receiptPublicId, this.now()),
				receiptType: receiptKind,
				receivedAt: this.now(),
				receivedByMemberId: membership.id,
				supplierDeliveryReference: deliveryReference,
				notes
			});
			await repository.insertReceiptItem({
				organisationId: actor.organisationId,
				receiptId,
				purchaseOrderItemId: item.id,
				quantityReceived,
				quantityRejected,
				rejectionReason:
					parseScaledDecimal(quantityRejected, 4, 'Quantity rejected') > 0n ? notes : null
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: current.projectId,
				actionKey: 'procurement.receipt.recorded',
				subjectType: 'purchase_order_receipt',
				subjectPublicId: receiptPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					purchaseOrderPublicId: current.publicId,
					lineNumber: item.lineNumber,
					quantityReceived,
					quantityRejected
				}
			});
			return receiptPublicId;
		});
	}
}
