import { randomUUID } from 'node:crypto';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase, type Database } from '$lib/server/db/database';
import { ContractFormationService } from './contract-formation-service';
import { ContractLifecycleService } from './contract-lifecycle-service';
import type {
	AddContractKeyDateInput,
	AddContractValueInput,
	ContractFormationWorkspace,
	ContractPortfolio,
	ContractSummary,
	ContractWorkspace,
	CreateContractInput,
	ExecuteContractInput,
	IssueContractInput,
	UpdateContractDraftInput
} from './contract-common';

export * from './contract-common';

export class ContractService {
	private readonly formation: ContractFormationService;
	private readonly lifecycle: ContractLifecycleService;

	constructor(
		db: Database = getDatabase(),
		publicIdFactory: () => string = randomUUID,
		now: () => Date = () => new Date()
	) {
		this.formation = new ContractFormationService(db, publicIdFactory);
		this.lifecycle = new ContractLifecycleService(db, publicIdFactory, now);
	}

	listPortfolio(actor: TenantActorContext): Promise<ContractPortfolio> {
		return this.formation.listPortfolio(actor);
	}

	getFormationWorkspace(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ContractFormationWorkspace> {
		return this.formation.getFormationWorkspace(actor, projectPublicId);
	}

	createFromProject(actor: TenantActorContext, input: CreateContractInput): Promise<ContractSummary> {
		return this.formation.createFromProject(actor, input);
	}

	getWorkspace(actor: TenantActorContext, contractPublicId: string): Promise<ContractWorkspace> {
		return this.lifecycle.getWorkspace(actor, contractPublicId);
	}

	updateDraft(actor: TenantActorContext, input: UpdateContractDraftInput): Promise<void> {
		return this.lifecycle.updateDraft(actor, input);
	}

	addValueComponent(actor: TenantActorContext, input: AddContractValueInput): Promise<void> {
		return this.lifecycle.addValueComponent(actor, input);
	}

	removeValueComponent(
		actor: TenantActorContext,
		contractPublicId: string,
		versionNumber: number,
		sortOrder: number
	): Promise<void> {
		return this.lifecycle.removeValueComponent(actor, contractPublicId, versionNumber, sortOrder);
	}

	addKeyDate(actor: TenantActorContext, input: AddContractKeyDateInput): Promise<void> {
		return this.lifecycle.addKeyDate(actor, input);
	}

	removeKeyDate(
		actor: TenantActorContext,
		contractPublicId: string,
		versionNumber: number,
		sortOrder: number
	): Promise<void> {
		return this.lifecycle.removeKeyDate(actor, contractPublicId, versionNumber, sortOrder);
	}

	issue(actor: TenantActorContext, input: IssueContractInput): Promise<void> {
		return this.lifecycle.issue(actor, input);
	}

	execute(actor: TenantActorContext, input: ExecuteContractInput): Promise<void> {
		return this.lifecycle.execute(actor, input);
	}
}
