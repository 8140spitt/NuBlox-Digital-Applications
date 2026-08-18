import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectRecord } from '$lib/server/projects/project-repository';

export class ContractValidationError extends Error {
	readonly code = 'CONTRACT_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ContractValidationError';
	}
}

export type ContractSummary = {
	id: string;
	publicId: string;
	contractNumber: string;
	title: string;
	contractTypeCode: string;
	contractTypeName: string;
	lifecycleStatus: string;
	currencyCode: string;
	projectPublicId: string | null;
	projectNumber: string | null;
	projectName: string | null;
	createdAt: Date;
};

export type EligibleContractProject = {
	projectId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	projectStatus: string;
	quotationNumber: string;
	quotationTitle: string;
	acceptedResponsePublicId: string;
	acceptedAt: Date;
	customerDisplayName: string;
};

export type ContractPortfolio = {
	canView: boolean;
	canCreate: boolean;
	contracts: ContractSummary[];
	eligibleProjects: EligibleContractProject[];
};

export type ContractTypeOption = {
	id: number;
	code: string;
	name: string;
};

export type ContractFormationWorkspace = {
	project: ProjectRecord;
	quotation: {
		id: string;
		publicId: string;
		quotationNumber: string;
		title: string;
		currencyCode: string;
		customerPartyId: string;
		customerDisplayName: string;
		acceptedResponseId: string;
		acceptedResponsePublicId: string;
		acceptedAt: Date;
		versionId: string;
		versionNumber: number;
		opportunityId: string | null;
		netAmount: string;
	};
	contractTypes: ContractTypeOption[];
	existingContract: ContractSummary | null;
	canCreate: boolean;
};

export type ContractParty = {
	id: string;
	roleCode: string;
	roleName: string;
	displayName: string;
	referenceIdentifier: string | null;
	sortOrder: number;
};

export type ContractValueComponent = {
	id: string;
	typeCode: string;
	typeName: string;
	description: string | null;
	amount: string;
	sortOrder: number;
};

export type ContractKeyDate = {
	id: string;
	typeCode: string;
	typeName: string;
	label: string | null;
	dateValue: Date;
	sortOrder: number;
};

export type ContractIssueEvent = {
	id: string;
	issueSequence: number;
	deliveryChannel: string;
	issuedAt: Date;
	note: string | null;
	recipientName: string | null;
	recipientEmail: string | null;
	deliveryStatus: string | null;
};

export type ContractExecution = {
	id: string;
	executionMethod: string;
	executedAt: Date;
	externalTransactionReference: string | null;
	note: string | null;
	signatories: Array<{
		id: string;
		signatoryName: string;
		signatoryEmail: string | null;
		signingRole: string | null;
		signedAt: Date | null;
	}>;
};

export type ContractWorkspace = {
	contract: ContractSummary & {
		sourceQuotationResponseId: string | null;
		sourceQuotationNumber: string | null;
	};
	version: {
		id: string;
		versionNumber: number;
		title: string;
		customerReference: string | null;
		versionStatus: string;
		lockedAt: Date | null;
	};
	parties: ContractParty[];
	valueComponents: ContractValueComponent[];
	keyDates: ContractKeyDate[];
	issueEvents: ContractIssueEvent[];
	execution: ContractExecution | null;
	valueComponentTypes: ContractTypeOption[];
	keyDateTypes: ContractTypeOption[];
	canManageDraft: boolean;
	canIssue: boolean;
	canExecute: boolean;
};

export type CreateContractInput = {
	projectPublicId: string;
	contractTypeCode: string;
	title: string;
	customerReference?: string | null;
};

export type UpdateContractDraftInput = {
	contractPublicId: string;
	versionNumber: number;
	title: string;
	customerReference?: string | null;
};

export type AddContractValueInput = {
	contractPublicId: string;
	versionNumber: number;
	typeCode: string;
	description?: string | null;
	amount: string;
};

export type AddContractKeyDateInput = {
	contractPublicId: string;
	versionNumber: number;
	typeCode: string;
	label?: string | null;
	dateValue: string;
};

export type IssueContractInput = {
	contractPublicId: string;
	versionNumber: number;
	deliveryChannel: string;
	recipientName: string;
	recipientEmail?: string | null;
	note?: string | null;
};

export type ExecuteContractInput = {
	contractPublicId: string;
	versionNumber: number;
	executionMethod: string;
	executedAt: string;
	signatoryName: string;
	signatoryEmail?: string | null;
	signingRole?: string | null;
	externalTransactionReference?: string | null;
	note?: string | null;
};

export type ContractSource = {
	projectId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	projectStatus: string;
	quotationId: string;
	quotationPublicId: string;
	quotationNumber: string;
	quotationTitle: string;
	quotationVersionId: string;
	quotationVersionNumber: number;
	quotationVersionStatus: string;
	quotationLockedAt: Date | null;
	currencyCode: string;
	customerPartyId: string;
	customerDisplayName: string | null;
	customerSnapshotId: string | null;
	opportunityId: string | null;
	acceptedResponseId: string;
	acceptedResponsePublicId: string;
	acceptedAt: Date;
	responseType: string;
};

export const DELIVERY_CHANNELS = new Set(['email', 'portal', 'manual', 'api', 'esign', 'other']);
export const EXECUTION_METHODS = new Set(['manual', 'portal', 'esign', 'api', 'other']);

export function cleanText(
	value: string | null | undefined,
	maxLength: number,
	label: string,
	required = false
): string | null {
	const text = value?.trim() ?? '';
	if (required && !text) throw new ContractValidationError(`${label} is required.`);
	if (text.length > maxLength) {
		throw new ContractValidationError(`${label} must not exceed ${maxLength} characters.`);
	}
	return text || null;
}

export function positiveInt(value: number, label: string): number {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new ContractValidationError(`${label} is invalid.`);
	}
	return value;
}

export function validateCode(value: string, label: string): string {
	const code = value.trim();
	if (!code || code.length > 64 || !/^[a-z0-9_]+$/.test(code)) {
		throw new ContractValidationError(`${label} is invalid.`);
	}
	return code;
}

export function validateMoney(value: string): string {
	const parsed = parseScaledDecimal(value, 4, 'Contract value');
	if (parsed < 0n) throw new ContractValidationError('Contract value must not be negative.');
	if (parsed > 9_999_999_999_999_999_999n) {
		throw new ContractValidationError('Contract value is too large.');
	}
	return formatScaledDecimal(parsed, 4);
}

export function validateDate(value: string, label: string): Date {
	const text = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		throw new ContractValidationError(`${label} is invalid.`);
	}
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime())) throw new ContractValidationError(`${label} is invalid.`);
	return date;
}

export function validateDateTime(value: string, label: string): Date {
	const text = value.trim();
	if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
		throw new ContractValidationError(`${label} must include an explicit timezone.`);
	}
	const date = new Date(text);
	if (!text || Number.isNaN(date.getTime())) {
		throw new ContractValidationError(`${label} is invalid.`);
	}
	return date;
}

export function generatedContractNumber(projectNumber: string, projectPublicId: string): string {
	if (projectNumber.startsWith('PRJ-')) return `CON-${projectNumber.slice(4)}`.slice(0, 80);
	return `CON-${projectPublicId.replaceAll('-', '').slice(0, 24).toUpperCase()}`;
}

export function isDuplicateKeyError(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		(error as { code?: unknown }).code === 'ER_DUP_ENTRY'
	);
}

export class ContractAccessPolicy {
	constructor(private readonly db: DatabaseExecutor) {}

	async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	async viewDecision(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		return new PermissionService(db).decide(actor, 'contract.view');
	}

	async mutationDecision(
		actor: TenantActorContext,
		permissionKey:
			'contract.create' | 'contract.draft.manage' | 'contract.issue' | 'contract.execute',
		db: DatabaseExecutor = this.db
	) {
		return new PermissionService(db).decideWithUmbrella(actor, permissionKey, 'contract.manage');
	}

	async assertProjectScope(
		actor: TenantActorContext,
		projectPublicId: string,
		db: DatabaseExecutor = this.db
	): Promise<ProjectRecord> {
		const project = await new ProjectRepository(db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId
		);
		if (!project || project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError('Project not found in the owning member scope.');
		}
		const decision = await new PermissionService(db).decide(actor, 'project.view', {
			projectId: project.id
		});
		if (!decision.allowed) {
			throw new RecordNotFoundError('Project not found in the owning member scope.');
		}
		return project;
	}
}
