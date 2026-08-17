import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';

export class FinanceValidationError extends Error {
	readonly code = 'FINANCE_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'FinanceValidationError';
	}
}

export type FinanceMutationPermission =
	| 'finance.billing.manage'
	| 'finance.invoice.create'
	| 'finance.invoice.draft.manage'
	| 'finance.invoice.issue'
	| 'finance.invoice.void'
	| 'finance.credit_note.create'
	| 'finance.credit_note.draft.manage'
	| 'finance.credit_note.issue'
	| 'finance.payment.create'
	| 'finance.payment.allocate'
	| 'finance.payment.allocation.reverse'
	| 'finance.payment.reverse'
	| 'finance.collections.case.manage'
	| 'finance.collections.action.record'
	| 'finance.collections.promise.manage'
	| 'finance.collections.dispute.manage';

export const INVOICE_TYPES = new Set([
	'standard',
	'deposit',
	'interim',
	'final',
	'retention',
	'other'
]);

export const PAYMENT_TERM_BASES = new Set(['invoice_date', 'end_of_month', 'manual']);
export const FINANCE_DELIVERY_CHANNELS = new Set(['email', 'portal', 'manual', 'api', 'other']);

export function cleanFinanceText(
	value: string | null | undefined,
	maxLength: number,
	label: string,
	required = false
): string | null {
	const text = value?.trim() ?? '';
	if (required && !text) throw new FinanceValidationError(`${label} is required.`);
	if (text.length > maxLength) {
		throw new FinanceValidationError(`${label} must not exceed ${maxLength} characters.`);
	}
	return text || null;
}

export function validateCurrencyCode(value: string | null | undefined, label = 'Currency'): string | null {
	const text = value?.trim().toUpperCase() ?? '';
	if (!text) return null;
	if (!/^[A-Z]{3}$/.test(text)) throw new FinanceValidationError(`${label} must be a three-letter ISO code.`);
	return text;
}

export function validateFinanceDate(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new FinanceValidationError(`${label} is invalid.`);
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime())) throw new FinanceValidationError(`${label} is invalid.`);
	return date;
}

export function validateQuantity(value: string): string {
	let parsed: bigint;
	try {
		parsed = parseScaledDecimal(value, 6, 'Quantity');
	} catch (cause) {
		throw new FinanceValidationError(cause instanceof Error ? cause.message : 'Quantity is invalid.');
	}
	if (parsed <= 0n) throw new FinanceValidationError('Quantity must be greater than zero.');
	return formatScaledDecimal(parsed, 6);
}

export function validateUnitRate(value: string): string {
	let parsed: bigint;
	try {
		parsed = parseScaledDecimal(value, 4, 'Unit rate');
	} catch (cause) {
		throw new FinanceValidationError(cause instanceof Error ? cause.message : 'Unit rate is invalid.');
	}
	if (parsed < 0n) throw new FinanceValidationError('Unit rate must not be negative.');
	return formatScaledDecimal(parsed, 4);
}

export function validateMoneyAmount(value: string, label = 'Amount'): string {
	let parsed: bigint;
	try {
		parsed = parseScaledDecimal(value, 4, label);
	} catch (cause) {
		throw new FinanceValidationError(cause instanceof Error ? cause.message : `${label} is invalid.`);
	}
	if (parsed <= 0n) throw new FinanceValidationError(`${label} must be greater than zero.`);
	return formatScaledDecimal(parsed, 4);
}

export function formatDateOnly(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number): Date {
	const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

export function endOfUtcMonth(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

export class FinanceAccessPolicy {
	constructor(private readonly db: DatabaseExecutor) {}

	async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	async viewDecision(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		return new PermissionService(db).decide(actor, 'finance.view');
	}

	async collectionsViewDecision(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		return new PermissionService(db).decideWithUmbrella(actor, 'finance.collections.view', 'finance.manage');
	}

	async mutationDecision(
		actor: TenantActorContext,
		permissionKey: FinanceMutationPermission,
		db: DatabaseExecutor = this.db
	) {
		return new PermissionService(db).decideWithUmbrella(actor, permissionKey, 'finance.manage');
	}
}
