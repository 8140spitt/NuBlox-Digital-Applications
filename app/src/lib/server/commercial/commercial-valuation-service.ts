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
import { ProcurementRepository } from '$lib/server/procurement/procurement-repository';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { CommercialValuationRepository } from './commercial-valuation-repository';
import { ProjectCommercialControlRepository } from './project-commercial-control-repository';

export class CommercialValuationValidationError extends Error {
	readonly code = 'COMMERCIAL_VALUATION_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'CommercialValuationValidationError';
	}
}

export type CommercialValuationWorkspaceRow = Awaited<
	ReturnType<CommercialValuationRepository['listForProjects']>
>[number] & {
	totalGrossValueToDate: string;
};

export type CommercialValuationWorkspace = {
	canManage: boolean;
	canAssess: boolean;
	valuations: CommercialValuationWorkspaceRow[];
};

export type CreateSupplierApplicationInput = {
	projectPublicId: string;
	purchaseOrderPublicId: string;
	costCodePublicId?: string | null;
	valuationDate: string;
	description: string;
	grossValueToDate: string;
};

function requiredText(value: string, label: string, max = 500): string {
	const text = value.trim();
	if (!text) throw new CommercialValuationValidationError(`${label} is required.`);
	if (text.length > max) throw new CommercialValuationValidationError(`${label} is too long.`);
	return text;
}

function publicId(value: string, label: string): string {
	const text = requiredText(value, label, 36);
	if (!/^[0-9a-f-]{36}$/i.test(text))
		throw new CommercialValuationValidationError(`${label} is invalid.`);
	return text;
}

function money(value: string, label: string): string {
	let parsed: bigint;
	try {
		parsed = parseScaledDecimal(value, 4, label);
	} catch (cause) {
		throw new CommercialValuationValidationError(
			cause instanceof Error ? cause.message : `${label} is invalid.`
		);
	}
	if (parsed < 0n) throw new CommercialValuationValidationError(`${label} cannot be negative.`);
	return formatScaledDecimal(parsed, 4);
}

function dateOnly(value: string, label: string): Date {
	const text = requiredText(value, label, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
		throw new CommercialValuationValidationError(`${label} is invalid.`);
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()))
		throw new CommercialValuationValidationError(`${label} is invalid.`);
	return date;
}

function valuationNumber(id: string, now: Date): string {
	return `VAL-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${id.replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

export class CommercialValuationService {
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
	) {
		const decision = await new PermissionService(db).decide(actor, permissionKey);
		if (!decision.allowed)
			throw new TenantAccessError('This commercial valuation action is not permitted.');
	}

	private async requireProject(
		actor: TenantActorContext,
		projectPublicId: string,
		db: DatabaseExecutor = this.db
	) {
		const project = await new ProjectRepository(db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			publicId(projectPublicId, 'Project')
		);
		if (!project)
			throw new TenantAccessError('The project is outside your effective project scope.');
		return project;
	}

	private async requireValuation(
		actor: TenantActorContext,
		valuationPublicId: string,
		db: DatabaseExecutor = this.db
	) {
		const valuation = await new CommercialValuationRepository(db).findByPublicId(
			actor.organisationId,
			publicId(valuationPublicId, 'Valuation')
		);
		if (!valuation) throw new CommercialValuationValidationError('Valuation not found.');
		const projects = await new ProjectRepository(db).listForMember(
			actor.organisationId,
			actor.memberId
		);
		if (!projects.some((project) => project.id === valuation.projectId))
			throw new TenantAccessError();
		return valuation;
	}

	async getWorkspace(
		actor: TenantActorContext,
		selectedProjectPublicId?: string | null
	): Promise<CommercialValuationWorkspace> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.cost_control.view');
		const decisions = await new PermissionService(this.db).decideMany(actor, [
			'commercial.valuation.manage',
			'commercial.valuation.assess'
		]);
		const projects = await new ProjectRepository(this.db).listForMember(
			actor.organisationId,
			actor.memberId
		);
		let projectIds = projects.map((project) => project.id);
		if (selectedProjectPublicId?.trim()) {
			const selected = await this.requireProject(actor, selectedProjectPublicId);
			projectIds = [selected.id];
		}
		const repository = new CommercialValuationRepository(this.db);
		const valuations: CommercialValuationWorkspaceRow[] = [];
		for (const row of await repository.listForProjects(actor.organisationId, projectIds)) {
			valuations.push({
				...row,
				totalGrossValueToDate: sumMoney(
					(await repository.listItems(actor.organisationId, row.id)).map(
						(item) => item.grossValueToDate
					)
				)
			});
		}
		return {
			canManage: decisions.get('commercial.valuation.manage')?.allowed ?? false,
			canAssess: decisions.get('commercial.valuation.assess')?.allowed ?? false,
			valuations
		};
	}

	async createSupplierApplication(
		actor: TenantActorContext,
		input: CreateSupplierApplicationInput
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.valuation.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const purchaseOrderPublicId = publicId(input.purchaseOrderPublicId, 'Purchase order');
		const description = requiredText(input.description, 'Valuation description', 10_000);
		const grossValueToDate = money(input.grossValueToDate, 'Gross value to date');
		const valuationDate = dateOnly(input.valuationDate, 'Valuation date');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'commercial.valuation.manage', trx);
			await this.requireProject(actor, project.publicId, trx);
			const procurementRepository = new ProcurementRepository(trx);
			const order = await procurementRepository.findPurchaseOrderByPublicId(
				actor.organisationId,
				purchaseOrderPublicId
			);
			if (!order || order.projectId !== project.id) {
				throw new CommercialValuationValidationError(
					'The selected purchase order belongs to another project.'
				);
			}
			const version = (
				await procurementRepository.listPurchaseOrderVersions(actor.organisationId, order.id)
			)[0];
			if (!version || version.status !== 'issued') {
				throw new CommercialValuationValidationError(
					'Supplier applications require a current issued purchase order.'
				);
			}
			const orderTotal = sumMoney(
				(await procurementRepository.listPurchaseOrderItems(actor.organisationId, version.id)).map(
					(item) => lineAmount(item.quantity, item.unitRate)
				)
			);
			if (
				parseScaledDecimal(grossValueToDate, 4, 'Gross value to date') >
				parseScaledDecimal(orderTotal, 4, 'Purchase-order total')
			) {
				throw new CommercialValuationValidationError(
					'Gross value to date cannot exceed the issued purchase-order value.'
				);
			}
			let costCodeId: string | null = null;
			if (input.costCodePublicId?.trim()) {
				const costCode = await new ProjectCommercialControlRepository(trx).findCostCodeByPublicId(
					actor.organisationId,
					publicId(input.costCodePublicId, 'Cost code')
				);
				if (!costCode || costCode.projectId !== project.id || !costCode.isActive) {
					throw new CommercialValuationValidationError(
						'The selected cost code belongs to another project or is inactive.'
					);
				}
				costCodeId = costCode.id;
			}
			const repository = new CommercialValuationRepository(trx);
			const valuationPublicId = this.publicIdFactory();
			const valuationId = await repository.insertSupplierApplication({
				organisationId: actor.organisationId,
				projectId: project.id,
				publicId: valuationPublicId,
				valuationNumber: valuationNumber(valuationPublicId, this.now()),
				counterpartyPartyId: order.supplierPartyId,
				currencyCode: order.currencyCode,
				valuationDate,
				recordedByMemberId: membership.id
			});
			await repository.linkPurchaseOrder({
				organisationId: actor.organisationId,
				valuationId,
				purchaseOrderId: order.id
			});
			await repository.insertItem({
				organisationId: actor.organisationId,
				valuationId,
				costCodeId,
				lineNumber: 10,
				description,
				grossValueToDate
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'commercial.valuation.created',
				subjectType: 'commercial_valuation',
				subjectPublicId: valuationPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					purchaseOrderPublicId,
					grossValueToDate,
					valuationKind: 'supplier_application'
				}
			});
			return valuationPublicId;
		});
	}

	async submit(actor: TenantActorContext, valuationPublicId: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.valuation.manage');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'commercial.valuation.manage', trx);
			const valuation = await this.requireValuation(actor, valuationPublicId, trx);
			const repository = new CommercialValuationRepository(trx);
			if ((await repository.listItems(actor.organisationId, valuation.id)).length === 0) {
				throw new CommercialValuationValidationError(
					'A valuation requires at least one item before submission.'
				);
			}
			if (
				(await repository.submit({
					organisationId: actor.organisationId,
					valuationId: valuation.id,
					submittedAt: this.now()
				})) !== 1
			) {
				throw new CommercialValuationValidationError('Only a draft valuation can be submitted.');
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: valuation.projectId,
				actionKey: 'commercial.valuation.submitted',
				subjectType: 'commercial_valuation',
				subjectPublicId: valuation.publicId,
				correlationId: actor.correlationId,
				changeSummary: { valuationKind: valuation.kind }
			});
		});
	}

	async assess(actor: TenantActorContext, valuationPublicId: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'commercial.valuation.assess');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'commercial.valuation.assess', trx);
			const valuation = await this.requireValuation(actor, valuationPublicId, trx);
			const repository = new CommercialValuationRepository(trx);
			if (
				(await repository.assess({
					organisationId: actor.organisationId,
					valuationId: valuation.id,
					assessedByMemberId: membership.id,
					assessedAt: this.now()
				})) !== 1
			) {
				throw new CommercialValuationValidationError('Only a submitted valuation can be assessed.');
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: valuation.projectId,
				actionKey: 'commercial.valuation.assessed',
				subjectType: 'commercial_valuation',
				subjectPublicId: valuation.publicId,
				correlationId: actor.correlationId,
				changeSummary: { valuationKind: valuation.kind }
			});
		});
	}
}
