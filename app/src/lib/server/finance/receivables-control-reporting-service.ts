import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import { ReceivablesReportingService } from './receivables-reporting-service';
import { issuedInvoiceOutstanding } from './receivable-ledger';

const DAY_MS = 24 * 60 * 60 * 1000;

function money(value: bigint): string { return formatScaledDecimal(value, 4); }
function amount(value: string): bigint { return parseScaledDecimal(value, 4, 'Money amount', true); }

function dateParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? '0');
	return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour'), minute: value('minute'), second: value('second') };
}
function timezoneOffsetMs(date: Date, timeZone: string): number {
	const rounded = new Date(Math.floor(date.getTime() / 1000) * 1000);
	const parts = dateParts(rounded, timeZone);
	return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - rounded.getTime();
}
function zonedStartOfDay(value: string, timeZone: string): Date {
	const [year, month, day] = value.split('-').map(Number);
	const wallClockUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
	const first = new Date(wallClockUtc);
	const firstOffset = timezoneOffsetMs(first, timeZone);
	let result = new Date(wallClockUtc - firstOffset);
	const secondOffset = timezoneOffsetMs(result, timeZone);
	if (secondOffset !== firstOffset) result = new Date(wallClockUtc - secondOffset);
	return result;
}
function addDateOnlyDays(value: string, days: number): string {
	const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}

export class ReceivablesControlReportingService {
	private readonly base: ReceivablesReportingService;
	constructor(private readonly db: Database = getDatabase(), now: () => Date = () => new Date()) { this.base = new ReceivablesReportingService(db, now); }

	private async activeWriteOffAsOf(organisationId: string, invoiceDocumentId: string, cutoff: Date): Promise<string> {
		const rows = await this.db.selectFrom('receivable_write_offs as writeOff')
			.leftJoin('receivable_write_off_reversals as reversal', (join) => join.onRef('reversal.write_off_id', '=', 'writeOff.id').onRef('reversal.organisation_id', '=', 'writeOff.organisation_id'))
			.select(['writeOff.write_off_amount as amount', 'writeOff.authorised_at as authorisedAt', 'reversal.reversed_at as reversedAt'])
			.where('writeOff.organisation_id', '=', organisationId).where('writeOff.invoice_document_id', '=', invoiceDocumentId).where('writeOff.authorised_at', '<', cutoff).execute();
		let total = 0n;
		for (const row of rows) if (row.reversedAt === null || row.reversedAt >= cutoff) total += amount(row.amount);
		return money(total);
	}

	private rebuildPosition(position: any) {
		const buckets = new Map<string, { label: string; amount: bigint; invoiceCount: number }>();
		for (const bucket of position.buckets) buckets.set(bucket.code, { label: bucket.label, amount: 0n, invoiceCount: 0 });
		let total = 0n;
		for (const invoice of position.invoices) {
			const value = amount(invoice.outstandingAmount); total += value;
			const bucket = buckets.get(invoice.bucket); if (bucket) { bucket.amount += value; bucket.invoiceCount += 1; }
		}
		position.openInvoiceCount = position.invoices.length;
		position.totalOutstanding = money(total);
		position.buckets = [...buckets.entries()].map(([code, bucket]) => ({ code, label: bucket.label, amount: money(bucket.amount), invoiceCount: bucket.invoiceCount }));
		return position;
	}

	async getPortfolio(actor: TenantActorContext) {
		const portfolio: any = await this.base.getPortfolio(actor);
		for (const account of portfolio.accounts) {
			for (const position of account.positions) {
				const adjusted = [];
				for (const invoice of position.invoices) {
					const document = await this.db.selectFrom('financial_documents').select('id').where('organisation_id', '=', actor.organisationId).where('public_id', '=', invoice.invoicePublicId).where('document_kind', '=', 'invoice').executeTakeFirst();
					if (!document) continue;
					const current = await issuedInvoiceOutstanding(this.db, actor.organisationId, document.id);
					if (amount(current.outstandingAmount) <= 0n) continue;
					adjusted.push({ ...invoice, issuedCreditGross: current.issuedCreditGross, activeAllocatedAmount: current.activeAllocatedAmount, activeWriteOffAmount: current.activeWriteOffAmount, outstandingAmount: current.outstandingAmount });
				}
				position.invoices = adjusted;
				this.rebuildPosition(position);
			}
		}
		const totals = new Map<string, any>();
		for (const account of portfolio.accounts) for (const position of account.positions) {
			let total = totals.get(position.currencyCode);
			if (!total) { total = { currencyCode: position.currencyCode, issuedInvoiceCount: 0, openInvoiceCount: 0, totalOutstanding: 0n, buckets: new Map<string, any>(), invoices: [] }; totals.set(position.currencyCode, total); }
			total.issuedInvoiceCount += position.issuedInvoiceCount; total.openInvoiceCount += position.openInvoiceCount; total.totalOutstanding += amount(position.totalOutstanding);
			for (const bucket of position.buckets) { let target = total.buckets.get(bucket.code); if (!target) { target = { code: bucket.code, label: bucket.label, amount: 0n, invoiceCount: 0 }; total.buckets.set(bucket.code, target); } target.amount += amount(bucket.amount); target.invoiceCount += bucket.invoiceCount; }
		}
		portfolio.totals = [...totals.values()].map((total) => ({ currencyCode: total.currencyCode, issuedInvoiceCount: total.issuedInvoiceCount, openInvoiceCount: total.openInvoiceCount, totalOutstanding: money(total.totalOutstanding), buckets: [...total.buckets.values()].map((bucket: any) => ({ ...bucket, amount: money(bucket.amount) })), invoices: [] })).sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
		return portfolio;
	}

	async getCustomerStatement(actor: TenantActorContext, customerPartyPublicId: string, input: { from?: string | null; to?: string | null } = {}) {
		const workspace: any = await this.base.getCustomerStatement(actor, customerPartyPublicId, input);
		const customer = await this.db.selectFrom('parties').select('id').where('organisation_id', '=', actor.organisationId).where('public_id', '=', customerPartyPublicId).executeTakeFirst();
		if (!customer) return workspace;
		const fromInstant = zonedStartOfDay(workspace.period.from, workspace.period.timezone);
		const cutoff = zonedStartOfDay(addDateOnlyDays(workspace.period.to, 1), workspace.period.timezone);
		const writeOffRows = await this.db.selectFrom('receivable_write_offs as writeOff')
			.innerJoin('financial_documents as invoice', (join) => join.onRef('invoice.id', '=', 'writeOff.invoice_document_id').onRef('invoice.organisation_id', '=', 'writeOff.organisation_id'))
			.leftJoin('receivable_write_off_reversals as reversal', (join) => join.onRef('reversal.write_off_id', '=', 'writeOff.id').onRef('reversal.organisation_id', '=', 'writeOff.organisation_id'))
			.select(['writeOff.id', 'writeOff.public_id as publicId', 'writeOff.write_off_amount as amount', 'writeOff.authorised_at as authorisedAt', 'writeOff.reason', 'invoice.public_id as invoicePublicId', 'invoice.document_number as invoiceNumber', 'invoice.currency_code as currencyCode', 'reversal.reversed_at as reversedAt', 'reversal.reason as reversalReason'])
			.where('writeOff.organisation_id', '=', actor.organisationId).where('invoice.customer_party_id', '=', customer.id).where('writeOff.authorised_at', '<', cutoff).orderBy('writeOff.authorised_at', 'asc').execute();
		const statementByCurrency = new Map(workspace.statements.map((statement: any) => [statement.currencyCode, statement]));
		for (const row of writeOffRows) {
			let statement: any = statementByCurrency.get(row.currencyCode);
			if (!statement) { statement = { currencyCode: row.currencyCode, openingBalance: '0.0000', movements: [], closingBalance: '0.0000' }; workspace.statements.push(statement); statementByCurrency.set(row.currencyCode, statement); }
			let opening = amount(statement.openingBalance);
			if (row.authorisedAt < fromInstant) opening -= amount(row.amount); else statement.movements.push({ id: `write-off:${row.id}`, occurredAt: row.authorisedAt, kind: 'write_off', reference: row.invoiceNumber ?? row.publicId, description: `Bad-debt write-off — ${row.reason}`, invoicePublicId: row.invoicePublicId, debitAmount: '0.0000', creditAmount: row.amount, runningBalance: '0.0000' });
			if (row.reversedAt && row.reversedAt < cutoff) {
				if (row.reversedAt < fromInstant) opening += amount(row.amount); else statement.movements.push({ id: `write-off-reversal:${row.id}`, occurredAt: row.reversedAt, kind: 'write_off_reversal', reference: row.invoiceNumber ?? row.publicId, description: row.reversalReason ? `Write-off reversal — ${row.reversalReason}` : 'Write-off reversal', invoicePublicId: row.invoicePublicId, debitAmount: row.amount, creditAmount: '0.0000', runningBalance: '0.0000' });
			}
			statement.openingBalance = money(opening);
		}
		for (const statement of workspace.statements) {
			statement.movements.sort((a: any, b: any) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() || String(a.id).localeCompare(String(b.id)));
			let running = amount(statement.openingBalance);
			for (const movement of statement.movements) { running += amount(movement.debitAmount) - amount(movement.creditAmount); movement.runningBalance = money(running); }
			statement.closingBalance = money(running);
		}
		workspace.statements.sort((a: any, b: any) => a.currencyCode.localeCompare(b.currencyCode));
		for (const position of workspace.aging) {
			const adjusted = [];
			for (const invoice of position.invoices) {
				const document = await this.db.selectFrom('financial_documents').select('id').where('organisation_id', '=', actor.organisationId).where('public_id', '=', invoice.invoicePublicId).where('document_kind', '=', 'invoice').executeTakeFirst();
				if (!document) continue;
				const writeOffAmount = await this.activeWriteOffAsOf(actor.organisationId, document.id, cutoff);
				const outstanding = amount(invoice.outstandingAmount) - amount(writeOffAmount);
				if (outstanding <= 0n) continue;
				adjusted.push({ ...invoice, activeWriteOffAmount: writeOffAmount, outstandingAmount: money(outstanding) });
			}
			position.invoices = adjusted;
			this.rebuildPosition(position);
		}
		return workspace;
	}
}
