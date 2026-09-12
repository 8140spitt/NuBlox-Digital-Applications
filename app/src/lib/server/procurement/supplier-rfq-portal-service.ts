import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import { getDatabase, type Database } from '$lib/server/db/database';
import { getEmailDelivery, type EmailDelivery } from '$lib/server/email/email-delivery';
import { ConcurrentUpdateError } from '$lib/server/kernel/errors';
import type { Actor } from '$lib/types/request-context';

const TOKEN_VERSION = 1;
const DEFAULT_INVITATION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export class SupplierRfqPortalAccessError extends Error {
	readonly code = 'SUPPLIER_RFQ_PORTAL_ACCESS';
	constructor(message = 'This supplier quotation invitation is invalid, expired or unavailable.') {
		super(message);
		this.name = 'SupplierRfqPortalAccessError';
	}
}

export class SupplierRfqPortalValidationError extends Error {
	readonly code = 'SUPPLIER_RFQ_PORTAL_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'SupplierRfqPortalValidationError';
	}
}

type SupplierRfqTokenPayload = {
	v: 1;
	invitationId: string;
	email: string;
	exp: number;
};

export type SupplierRfqPortalLine = {
	itemId: string;
	lineNumber: number;
	description: string;
	requestedQuantity: string;
	requiredByDate: Date | null;
	offeredQuantity: string | null;
	unitRate: string | null;
	leadTimeDays: number | null;
	qualificationNote: string | null;
};

export type SupplierRfqPortalQuote = {
	quoteRef: string;
	invitationId: string;
	rfqNumber: string;
	title: string;
	issuerName: string;
	supplierName: string;
	recipientEmail: string;
	currencyCode: string;
	responseDeadlineAt: Date | null;
	status: string;
	supplierReference: string | null;
	validUntil: Date | null;
	submittedAt: Date | null;
	lines: SupplierRfqPortalLine[];
};

export type SubmitSupplierQuoteInput = {
	quoteRef: string;
	supplierReference?: string | null;
	validUntil?: string | null;
	lines: Array<{
		itemId: string;
		offeredQuantity: string;
		unitRate: string;
		leadTimeDays?: string | null;
		qualificationNote?: string | null;
	}>;
};

function normaliseEmail(value: string): string {
	const email = value.trim().toLowerCase();
	if (!email || email.length > 320 || !email.includes('@')) {
		throw new SupplierRfqPortalValidationError('A valid supplier email address is required.');
	}
	return email;
}

function signingKey(): string {
	const secret = env.BETTER_AUTH_SECRET?.trim();
	if (!secret) throw new Error('BETTER_AUTH_SECRET is required for supplier RFQ links.');
	return `nublox:supplier-rfq-portal:v1:${secret}`;
}

function applicationBaseUrl(): string {
	const value = env.BETTER_AUTH_URL?.trim();
	if (!value) throw new Error('BETTER_AUTH_URL is required to build supplier RFQ links.');
	return value;
}

function sign(body: string): string {
	return createHmac('sha256', signingKey()).update(body).digest('base64url');
}

function encodeToken(payload: SupplierRfqTokenPayload): string {
	const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
	return `${body}.${sign(body)}`;
}

function decodeToken(rawToken: string): SupplierRfqTokenPayload {
	const token = rawToken.trim();
	const [body, suppliedSignature, ...rest] = token.split('.');
	if (!body || !suppliedSignature || rest.length) throw new SupplierRfqPortalAccessError();
	const expectedSignature = sign(body);
	const supplied = Buffer.from(suppliedSignature);
	const expected = Buffer.from(expectedSignature);
	if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
		throw new SupplierRfqPortalAccessError();
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
	} catch {
		throw new SupplierRfqPortalAccessError();
	}
	if (
		!parsed ||
		typeof parsed !== 'object' ||
		(parsed as Partial<SupplierRfqTokenPayload>).v !== TOKEN_VERSION ||
		typeof (parsed as Partial<SupplierRfqTokenPayload>).invitationId !== 'string' ||
		typeof (parsed as Partial<SupplierRfqTokenPayload>).email !== 'string' ||
		typeof (parsed as Partial<SupplierRfqTokenPayload>).exp !== 'number'
	) {
		throw new SupplierRfqPortalAccessError();
	}
	return parsed as SupplierRfqTokenPayload;
}

function optionalText(value: string | null | undefined, max: number): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max)
		throw new SupplierRfqPortalValidationError('A supplied value is too long.');
	return text;
}

function positiveDecimal(value: string, label: string): string {
	const text = value.trim();
	if (!/^\d+(?:\.\d{1,4})?$/.test(text) || Number(text) <= 0) {
		throw new SupplierRfqPortalValidationError(
			`${label} must be greater than zero with up to four decimal places.`
		);
	}
	return text;
}

function nonNegativeDecimal(value: string, label: string): string {
	const text = value.trim();
	if (!/^\d+(?:\.\d{1,4})?$/.test(text) || Number(text) < 0) {
		throw new SupplierRfqPortalValidationError(
			`${label} must be zero or greater with up to four decimal places.`
		);
	}
	return text;
}

function optionalDate(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
		throw new SupplierRfqPortalValidationError(`${label} is invalid.`);
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()))
		throw new SupplierRfqPortalValidationError(`${label} is invalid.`);
	return date;
}

function optionalLeadTime(value: string | null | undefined): number | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	const result = Number(text);
	if (!Number.isSafeInteger(result) || result < 0 || result > 36500) {
		throw new SupplierRfqPortalValidationError('Lead time must be a whole number of days.');
	}
	return result;
}

export class SupplierRfqPortalService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly emailDelivery: EmailDelivery = getEmailDelivery(),
		private readonly now: () => Date = () => new Date(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async invitationContext(invitationId: string, db: Database = this.db) {
		return db
			.selectFrom('rfq_invitations as invitation')
			.innerJoin('rfq_versions as version', 'version.id', 'invitation.rfq_version_id')
			.innerJoin('rfqs as rfq', 'rfq.id', 'version.rfq_id')
			.innerJoin('procurement_packages as package', 'package.id', 'rfq.procurement_package_id')
			.innerJoin('organisations as issuer', 'issuer.id', 'invitation.organisation_id')
			.innerJoin(
				'party_organisations as supplier',
				'supplier.party_id',
				'invitation.supplier_party_id'
			)
			.select([
				'invitation.id as invitationId',
				'invitation.organisation_id as organisationId',
				'invitation.invitation_status as invitationStatus',
				'invitation.recipient_email as recipientEmail',
				'invitation.recipient_name as recipientName',
				'invitation.supplier_party_id as supplierPartyId',
				'version.id as versionId',
				'version.title as title',
				'version.currency_code as currencyCode',
				'version.response_deadline_at as responseDeadlineAt',
				'version.version_status as versionStatus',
				'rfq.public_id as rfqPublicId',
				'rfq.rfq_number as rfqNumber',
				'package.project_id as projectId',
				'issuer.legal_name as issuerLegalName',
				'issuer.trading_name as issuerTradingName',
				'supplier.legal_name as supplierLegalName',
				'supplier.trading_name as supplierTradingName'
			])
			.where('invitation.id', '=', invitationId)
			.executeTakeFirst();
	}

	private expiryFor(responseDeadlineAt: Date | null): Date {
		return responseDeadlineAt ?? new Date(this.now().getTime() + DEFAULT_INVITATION_LIFETIME_MS);
	}

	private createQuoteRef(
		invitationId: string,
		email: string,
		responseDeadlineAt: Date | null
	): string {
		return encodeToken({
			v: TOKEN_VERSION,
			invitationId,
			email: normaliseEmail(email),
			exp: this.expiryFor(responseDeadlineAt).getTime()
		});
	}

	private assertToken(rawToken: string): SupplierRfqTokenPayload {
		const payload = decodeToken(rawToken);
		if (payload.exp <= this.now().getTime()) throw new SupplierRfqPortalAccessError();
		return payload;
	}

	async sendInvitation(invitationId: string): Promise<void> {
		const invitation = await this.invitationContext(invitationId);
		if (
			!invitation?.recipientEmail ||
			invitation.invitationStatus !== 'invited' ||
			invitation.versionStatus !== 'issued'
		) {
			throw new SupplierRfqPortalAccessError(
				'The supplier quotation invitation cannot be delivered.'
			);
		}
		const expiresAt = this.expiryFor(invitation.responseDeadlineAt);
		if (expiresAt <= this.now())
			throw new SupplierRfqPortalValidationError('The RFQ response deadline has already passed.');
		const token = this.createQuoteRef(
			invitation.invitationId,
			invitation.recipientEmail,
			invitation.responseDeadlineAt
		);
		const invitationUrl = new URL(
			`/supplier-quote/${encodeURIComponent(token)}`,
			applicationBaseUrl()
		).toString();
		const issuerName = invitation.issuerTradingName?.trim() || invitation.issuerLegalName;
		await this.emailDelivery.send({
			to: invitation.recipientEmail,
			subject: `${issuerName} requests your quotation for ${invitation.rfqNumber}`,
			idempotencyKey: `supplier-rfq-invitation:${invitation.invitationId}`,
			text: `${invitation.recipientName ?? 'Supplier'},\n\n${issuerName} has invited you to respond to ${invitation.rfqNumber} · ${invitation.title} in the NuBlox supplier portal.\n\nOpen the enquiry and submit your quotation: ${invitationUrl}\n\n${invitation.responseDeadlineAt ? `Response deadline: ${invitation.responseDeadlineAt.toISOString()}\n\n` : ''}The link is restricted to the invited email address and expires on ${expiresAt.toISOString()}.`
		});
	}

	async getInvitation(rawToken: string): Promise<SupplierRfqPortalQuote | null> {
		let payload: SupplierRfqTokenPayload;
		try {
			payload = this.assertToken(rawToken);
		} catch (cause) {
			if (cause instanceof SupplierRfqPortalAccessError) return null;
			throw cause;
		}
		const invitation = await this.invitationContext(payload.invitationId);
		if (
			!invitation?.recipientEmail ||
			normaliseEmail(invitation.recipientEmail) !== normaliseEmail(payload.email) ||
			!['invited', 'responded'].includes(invitation.invitationStatus) ||
			invitation.versionStatus !== 'issued' ||
			(invitation.responseDeadlineAt && invitation.responseDeadlineAt <= this.now())
		)
			return null;
		return this.buildPortalQuote(invitation, rawToken);
	}

	async validateSignup(rawToken: string, emailInput: string): Promise<void> {
		const invitation = await this.getInvitation(rawToken);
		if (!invitation || normaliseEmail(invitation.recipientEmail) !== normaliseEmail(emailInput)) {
			throw new SupplierRfqPortalAccessError();
		}
	}

	async hasPortalQuotes(emailInput: string): Promise<boolean> {
		const email = normaliseEmail(emailInput);
		const rows = await this.db
			.selectFrom('rfq_invitations as invitation')
			.innerJoin('rfq_versions as version', 'version.id', 'invitation.rfq_version_id')
			.select(['invitation.recipient_email as recipientEmail'])
			.where('invitation.invitation_status', 'in', ['invited', 'responded'])
			.where('version.version_status', '=', 'issued')
			.where((eb) =>
				eb.or([
					eb('version.response_deadline_at', 'is', null),
					eb('version.response_deadline_at', '>', this.now())
				])
			)
			.execute();
		return rows.some((row) => row.recipientEmail && normaliseEmail(row.recipientEmail) === email);
	}

	async listPortalQuotes(emailInput: string): Promise<SupplierRfqPortalQuote[]> {
		const email = normaliseEmail(emailInput);
		const invitationRows = await this.db
			.selectFrom('rfq_invitations as invitation')
			.innerJoin('rfq_versions as version', 'version.id', 'invitation.rfq_version_id')
			.select(['invitation.id as invitationId', 'invitation.recipient_email as recipientEmail'])
			.where('invitation.invitation_status', 'in', ['invited', 'responded'])
			.where('version.version_status', '=', 'issued')
			.orderBy('invitation.created_at', 'desc')
			.execute();
		const matching = invitationRows.filter(
			(row) => row.recipientEmail && normaliseEmail(row.recipientEmail) === email
		);
		const quotes: SupplierRfqPortalQuote[] = [];
		for (const row of matching) {
			const context = await this.invitationContext(row.invitationId);
			if (!context?.recipientEmail) continue;
			const token = this.createQuoteRef(
				context.invitationId,
				context.recipientEmail,
				context.responseDeadlineAt
			);
			const quote = await this.buildPortalQuote(context, token);
			quotes.push(quote);
		}
		return quotes;
	}

	private async buildPortalQuote(
		invitation: NonNullable<Awaited<ReturnType<SupplierRfqPortalService['invitationContext']>>>,
		quoteRef: string
	): Promise<SupplierRfqPortalQuote> {
		const returnRow = await this.db
			.selectFrom('supplier_returns')
			.select([
				'id',
				'supplier_reference as supplierReference',
				'valid_until as validUntil',
				'submitted_at as submittedAt',
				'return_status as returnStatus'
			])
			.where('rfq_invitation_id', '=', invitation.invitationId)
			.where('return_status', 'not in', ['withdrawn', 'superseded'])
			.orderBy('submission_number', 'desc')
			.executeTakeFirst();
		const items = await this.db
			.selectFrom('rfq_items as item')
			.leftJoin('supplier_return_items as responseItem', (join) =>
				join
					.onRef('responseItem.rfq_item_id', '=', 'item.id')
					.on('responseItem.supplier_return_id', '=', returnRow?.id ?? '__none__')
			)
			.select([
				'item.id as itemId',
				'item.line_number as lineNumber',
				'item.description as description',
				'item.quantity as requestedQuantity',
				'item.required_by_date as requiredByDate',
				'responseItem.offered_quantity as offeredQuantity',
				'responseItem.unit_rate as unitRate',
				'responseItem.lead_time_days as leadTimeDays',
				'responseItem.qualification_note as qualificationNote'
			])
			.where('item.rfq_version_id', '=', invitation.versionId)
			.orderBy('item.line_number', 'asc')
			.execute();
		return {
			quoteRef,
			invitationId: invitation.invitationId,
			rfqNumber: invitation.rfqNumber,
			title: invitation.title,
			issuerName: invitation.issuerTradingName?.trim() || invitation.issuerLegalName,
			supplierName: invitation.supplierTradingName?.trim() || invitation.supplierLegalName,
			recipientEmail: invitation.recipientEmail!,
			currencyCode: invitation.currencyCode,
			responseDeadlineAt: invitation.responseDeadlineAt,
			status: returnRow?.returnStatus ?? invitation.invitationStatus,
			supplierReference: returnRow?.supplierReference ?? null,
			validUntil: returnRow?.validUntil ?? null,
			submittedAt: returnRow?.submittedAt ?? null,
			lines: items.map((item) => ({
				itemId: item.itemId,
				lineNumber: item.lineNumber,
				description: item.description,
				requestedQuantity: String(item.requestedQuantity),
				requiredByDate: item.requiredByDate,
				offeredQuantity: item.offeredQuantity === null ? null : String(item.offeredQuantity),
				unitRate: item.unitRate === null ? null : String(item.unitRate),
				leadTimeDays: item.leadTimeDays,
				qualificationNote: item.qualificationNote
			}))
		};
	}

	async submitQuote(actor: Actor, input: SubmitSupplierQuoteInput): Promise<string> {
		const payload = this.assertToken(input.quoteRef);
		if (normaliseEmail(payload.email) !== normaliseEmail(actor.email)) {
			throw new SupplierRfqPortalAccessError(
				'This quotation invitation is addressed to a different verified email address.'
			);
		}
		const supplierReference = optionalText(input.supplierReference, 160);
		const validUntil = optionalDate(input.validUntil, 'Valid-until date');
		return this.db.transaction().execute(async (trx) => {
			const invitation = await this.invitationContext(payload.invitationId, trx as Database);
			if (
				!invitation?.recipientEmail ||
				normaliseEmail(invitation.recipientEmail) !== normaliseEmail(actor.email) ||
				invitation.invitationStatus !== 'invited' ||
				invitation.versionStatus !== 'issued' ||
				(invitation.responseDeadlineAt && invitation.responseDeadlineAt <= this.now())
			)
				throw new SupplierRfqPortalAccessError();

			const rfqItems = await trx
				.selectFrom('rfq_items')
				.select(['id', 'line_number as lineNumber'])
				.where('rfq_version_id', '=', invitation.versionId)
				.orderBy('line_number', 'asc')
				.execute();
			if (!rfqItems.length)
				throw new SupplierRfqPortalValidationError('This RFQ has no lines to price.');
			if (input.lines.length !== rfqItems.length) {
				throw new SupplierRfqPortalValidationError('Price every RFQ line before submitting.');
			}
			const submittedById = new Map(input.lines.map((line) => [line.itemId, line]));
			if (
				submittedById.size !== rfqItems.length ||
				rfqItems.some((item) => !submittedById.has(item.id))
			) {
				throw new SupplierRfqPortalValidationError(
					'The submitted RFQ lines do not match the issued enquiry.'
				);
			}
			const existing = await trx
				.selectFrom('supplier_returns')
				.select('id')
				.where('rfq_invitation_id', '=', invitation.invitationId)
				.where('return_status', 'not in', ['withdrawn', 'superseded'])
				.executeTakeFirst();
			if (existing)
				throw new SupplierRfqPortalValidationError(
					'A quotation has already been submitted for this invitation.'
				);

			const previous = await trx
				.selectFrom('supplier_returns')
				.select((eb) => eb.fn.max<number>('submission_number').as('maxSubmission'))
				.where('rfq_invitation_id', '=', invitation.invitationId)
				.executeTakeFirst();
			const returnPublicId = this.publicIdFactory();
			const inserted = await trx
				.insertInto('supplier_returns')
				.values({
					organisation_id: invitation.organisationId,
					public_id: returnPublicId,
					rfq_invitation_id: invitation.invitationId,
					rfq_version_id: invitation.versionId,
					submission_number: Number(previous?.maxSubmission ?? 0) + 1,
					currency_code: invitation.currencyCode,
					supplier_reference: supplierReference,
					valid_until: validUntil,
					return_status: 'submitted',
					submitted_at: this.now(),
					recorded_by_member_id: null
				})
				.executeTakeFirstOrThrow();
			if (inserted.insertId === undefined)
				throw new Error('Supplier return insert did not return an ID.');
			const supplierReturnId = inserted.insertId.toString();
			for (const item of rfqItems) {
				const line = submittedById.get(item.id)!;
				await trx
					.insertInto('supplier_return_items')
					.values({
						organisation_id: invitation.organisationId,
						supplier_return_id: supplierReturnId,
						rfq_item_id: item.id,
						line_number: item.lineNumber,
						description: null,
						offered_quantity: positiveDecimal(
							line.offeredQuantity,
							`Line ${item.lineNumber} quantity`
						),
						unit_rate: nonNegativeDecimal(line.unitRate, `Line ${item.lineNumber} unit rate`),
						lead_time_days: optionalLeadTime(line.leadTimeDays),
						qualification_note: optionalText(line.qualificationNote, 4000)
					})
					.executeTakeFirstOrThrow();
			}
			const updated = await trx
				.updateTable('rfq_invitations')
				.set({ invitation_status: 'responded', responded_at: this.now() })
				.where('id', '=', invitation.invitationId)
				.where('invitation_status', '=', 'invited')
				.executeTakeFirst();
			if (updated.numUpdatedRows !== 1n) throw new ConcurrentUpdateError();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: invitation.organisationId,
				actorUserId: actor.userId,
				actorMemberId: null,
				externalAuthUserId: actor.authUserId,
				projectId: invitation.projectId,
				actionKey: 'procurement.rfq.return.submitted',
				subjectType: 'supplier_return',
				subjectPublicId: returnPublicId,
				correlationId: randomUUID(),
				changeSummary: {
					rfqPublicId: invitation.rfqPublicId,
					rfqNumber: invitation.rfqNumber,
					supplierPartyId: invitation.supplierPartyId,
					submissionNumber: Number(previous?.maxSubmission ?? 0) + 1
				}
			});
			return returnPublicId;
		});
	}
}
