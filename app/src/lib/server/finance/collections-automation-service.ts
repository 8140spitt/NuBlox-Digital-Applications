import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import type { Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { getEmailDelivery, type EmailDelivery } from '$lib/server/email/email-delivery';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { CollectionsService } from './collections-service';
import {
	cleanFinanceText,
	FinanceAccessPolicy,
	FinanceValidationError,
	insertedId
} from './finance-common';

export type CollectionPolicyStatus = 'draft' | 'active' | 'retired';
export type CollectionReminderStatus = 'pending' | 'sent';

export type CollectionPolicyStageSummary = {
	id: string;
	publicId: string;
	sequenceNumber: number;
	name: string;
	triggerDaysOverdue: number;
	deliveryChannel: string;
	subjectTemplate: string;
	bodyTemplate: string;
	suppressOnOpenDispute: boolean;
	suppressOnCurrentPromise: boolean;
};

export type CollectionPolicySummary = {
	id: string;
	publicId: string;
	versionNumber: number;
	name: string;
	status: CollectionPolicyStatus;
	createdAt: Date;
	activatedAt: Date | null;
	retiredAt: Date | null;
	stages: CollectionPolicyStageSummary[];
};

export type ReminderRecipient = {
	partyId: string;
	partyPublicId: string;
	displayName: string;
	email: string;
};

export type DueReminderCandidate = {
	casePublicId: string;
	customerPartyPublicId: string;
	customerDisplayName: string;
	customerAccountReference: string | null;
	stagePublicId: string;
	stageName: string;
	sequenceNumber: number;
	triggerDaysOverdue: number;
	maxDaysOverdue: number;
	overdueInvoiceCount: number;
	recipient: ReminderRecipient | null;
	blockedReasons: string[];
	canGenerate: boolean;
};

export type CollectionReminderSummary = {
	publicId: string;
	casePublicId: string;
	customerPartyPublicId: string;
	customerDisplayName: string;
	stageName: string;
	policyVersionNumber: number;
	recipientEmail: string;
	subject: string;
	messageBody: string;
	asOfDate: Date;
	status: CollectionReminderStatus;
	generatedAt: Date;
	sentAt: Date | null;
	attemptCount: number;
	lastAttemptOutcome: string | null;
	lastAttemptAt: Date | null;
	lastAttemptError: string | null;
};

export type PromiseReviewSummary = {
	promisePublicId: string;
	casePublicId: string;
	customerPartyPublicId: string;
	customerDisplayName: string;
	promisedAmount: string;
	currencyCode: string;
	dueOn: Date;
	daysPastDue: number;
};

export type CollectionsAutomationWorkspace = {
	asOf: string;
	activePolicy: CollectionPolicySummary | null;
	draftPolicy: CollectionPolicySummary | null;
	dueReminders: DueReminderCandidate[];
	reminders: CollectionReminderSummary[];
	promiseReviews: PromiseReviewSummary[];
	canManagePolicy: boolean;
	canGenerateReminders: boolean;
	canDispatchReminders: boolean;
	canViewCrm: boolean;
};

type TemplateContext = {
	customer_name: string;
	account_reference: string;
	days_overdue: string;
	invoice_count: string;
	as_of_date: string;
};

const TEMPLATE_KEYS = new Set<keyof TemplateContext>([
	'customer_name',
	'account_reference',
	'days_overdue',
	'invoice_count',
	'as_of_date'
]);

function asPolicyStatus(value: string): CollectionPolicyStatus {
	if (value === 'draft' || value === 'active' || value === 'retired') return value;
	throw new Error(`Unexpected collections policy status: ${value}`);
}

function asReminderStatus(value: string): CollectionReminderStatus {
	if (value === 'pending' || value === 'sent') return value;
	throw new Error(`Unexpected collections reminder status: ${value}`);
}

function dateText(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function dayNumber(value: string | Date): number {
	const text = typeof value === 'string' ? value : dateText(value);
	return Math.floor(new Date(`${text}T00:00:00.000Z`).getTime() / 86_400_000);
}

function validateTemplate(
	value: string | null | undefined,
	maxLength: number,
	label: string
): string {
	const text = cleanFinanceText(value, maxLength, label, true)!;
	for (const match of text.matchAll(/{{\s*([a-z_]+)\s*}}/g)) {
		if (!TEMPLATE_KEYS.has(match[1] as keyof TemplateContext)) {
			throw new FinanceValidationError(
				`${label} contains an unsupported placeholder: ${match[1]}.`
			);
		}
	}
	return text;
}

function renderTemplate(template: string, context: TemplateContext): string {
	return template.replace(
		/{{\s*([a-z_]+)\s*}}/g,
		(_match, key: string) => context[key as keyof TemplateContext] ?? ''
	);
}

function isDuplicateKeyError(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		(error as { code?: unknown }).code === 'ER_DUP_ENTRY'
	);
}

function displayName(row: {
	partyKind: string;
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
	legalName: string | null;
	tradingName: string | null;
}): string {
	if (row.partyKind === 'person') {
		const preferred = row.preferredName?.trim();
		const family = row.familyName?.trim();
		return (
			[preferred || row.givenNames?.trim(), family].filter(Boolean).join(' ') || 'Unnamed person'
		);
	}
	return row.tradingName?.trim() || row.legalName?.trim() || 'Unnamed organisation';
}

export class CollectionsAutomationService {
	constructor(
		private readonly db: Database,
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date(),
		private readonly emailDeliveryFactory: () => EmailDelivery = getEmailDelivery
	) {}

	private async assertRead(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const policy = new FinanceAccessPolicy(db);
		await policy.assertActiveActor(actor, db);
		const [financeView, collectionsView] = await Promise.all([
			policy.viewDecision(actor, db),
			policy.collectionsViewDecision(actor, db)
		]);
		if (!financeView.allowed || !collectionsView.allowed)
			throw new TenantAccessError('Collections viewing is not permitted.');
	}

	private async mutationDecision(
		actor: TenantActorContext,
		permission:
			| 'finance.collections.policy.manage'
			| 'finance.collections.reminder.generate'
			| 'finance.collections.reminder.dispatch',
		db: DatabaseExecutor = this.db
	) {
		return new PermissionService(db).decideWithUmbrella(actor, permission, 'finance.manage');
	}

	private async audit(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		memberId: string,
		actionKey: string,
		subjectType: string,
		subjectPublicId: string,
		changeSummary: Record<string, unknown>
	) {
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: memberId,
			projectId: null,
			actionKey,
			subjectType,
			subjectPublicId,
			correlationId: actor.correlationId,
			changeSummary
		});
	}

	private async stages(
		db: DatabaseExecutor,
		organisationId: string,
		policyId: string
	): Promise<CollectionPolicyStageSummary[]> {
		const rows = await db
			.selectFrom('receivable_collection_policy_stages')
			.select([
				'id',
				'public_id as publicId',
				'sequence_number as sequenceNumber',
				'name',
				'trigger_days_overdue as triggerDaysOverdue',
				'delivery_channel as deliveryChannel',
				'subject_template as subjectTemplate',
				'body_template as bodyTemplate',
				'suppress_on_open_dispute as suppressOnOpenDispute',
				'suppress_on_current_promise as suppressOnCurrentPromise'
			])
			.where('organisation_id', '=', organisationId)
			.where('collection_policy_id', '=', policyId)
			.orderBy('sequence_number', 'asc')
			.execute();
		return rows.map((row) => ({
			...row,
			suppressOnOpenDispute: row.suppressOnOpenDispute === 1,
			suppressOnCurrentPromise: row.suppressOnCurrentPromise === 1
		}));
	}

	private async policyByStatus(
		db: DatabaseExecutor,
		organisationId: string,
		status: CollectionPolicyStatus
	): Promise<CollectionPolicySummary | null> {
		const row = await db
			.selectFrom('receivable_collection_policies')
			.select([
				'id',
				'public_id as publicId',
				'version_number as versionNumber',
				'name',
				'status',
				'created_at as createdAt',
				'activated_at as activatedAt',
				'retired_at as retiredAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('status', '=', status)
			.orderBy('version_number', 'desc')
			.executeTakeFirst();
		if (!row) return null;
		return {
			...row,
			status: asPolicyStatus(row.status),
			stages: await this.stages(db, organisationId, row.id)
		};
	}

	private async policyByPublicId(
		db: DatabaseExecutor,
		organisationId: string,
		publicIdInput: string,
		lock = false
	) {
		const publicId = cleanFinanceText(publicIdInput, 64, 'Policy ID', true)!;
		let query = db
			.selectFrom('receivable_collection_policies')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId);
		if (lock) query = query.forUpdate();
		const row = await query.executeTakeFirst();
		if (!row) throw new RecordNotFoundError('Collections policy not found.');
		return row;
	}

	private async resolveRecipient(
		actor: TenantActorContext,
		customerPartyId: string
	): Promise<ReminderRecipient | null> {
		const customer = await this.db
			.selectFrom('parties as party')
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'party.id')
					.onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_email_addresses as email', (join) =>
				join
					.onRef('email.party_id', '=', 'party.id')
					.onRef('email.organisation_id', '=', 'party.organisation_id')
					.on('email.is_primary', '=', 1)
			)
			.select([
				'party.id as partyId',
				'party.public_id as partyPublicId',
				'party.party_kind as partyKind',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'email.email as email'
			])
			.where('party.organisation_id', '=', actor.organisationId)
			.where('party.id', '=', customerPartyId)
			.where('party.status', '=', 'active')
			.executeTakeFirst();
		if (!customer) return null;
		if (customer.email)
			return {
				partyId: customer.partyId,
				partyPublicId: customer.partyPublicId,
				displayName: displayName(customer),
				email: customer.email
			};
		if (customer.partyKind !== 'organisation') return null;
		const contact = await this.db
			.selectFrom('party_organisation_contacts as contact')
			.innerJoin('parties as personParty', (join) =>
				join
					.onRef('personParty.id', '=', 'contact.person_party_id')
					.onRef('personParty.organisation_id', '=', 'contact.organisation_id')
			)
			.innerJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'personParty.id')
					.onRef('person.organisation_id', '=', 'personParty.organisation_id')
			)
			.innerJoin('party_email_addresses as email', (join) =>
				join
					.onRef('email.party_id', '=', 'personParty.id')
					.onRef('email.organisation_id', '=', 'personParty.organisation_id')
					.on('email.is_primary', '=', 1)
			)
			.select([
				'personParty.id as partyId',
				'personParty.public_id as partyPublicId',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'email.email as email'
			])
			.where('contact.organisation_id', '=', actor.organisationId)
			.where('contact.organisation_party_id', '=', customerPartyId)
			.where('contact.ended_on', 'is', null)
			.where('contact.is_primary_contact', '=', 1)
			.where('personParty.status', '=', 'active')
			.executeTakeFirst();
		return contact
			? {
					partyId: contact.partyId,
					partyPublicId: contact.partyPublicId,
					displayName: displayName({
						...contact,
						partyKind: 'person',
						legalName: null,
						tradingName: null
					}),
					email: contact.email
				}
			: null;
	}

	private async suppressionReasons(
		db: DatabaseExecutor,
		organisationId: string,
		caseId: string,
		stage: CollectionPolicyStageSummary,
		asOf: string
	): Promise<string[]> {
		const reasons: string[] = [];
		if (stage.suppressOnOpenDispute) {
			const dispute = await db
				.selectFrom('receivable_disputes')
				.select('id')
				.where('organisation_id', '=', organisationId)
				.where('collection_case_id', '=', caseId)
				.where('status', '=', 'open')
				.executeTakeFirst();
			if (dispute) reasons.push('Open receivable dispute');
		}
		if (stage.suppressOnCurrentPromise) {
			const promise = await db
				.selectFrom('receivable_promises_to_pay')
				.select('id')
				.where('organisation_id', '=', organisationId)
				.where('collection_case_id', '=', caseId)
				.where('status', '=', 'open')
				.where('due_on', '>=', new Date(`${asOf}T00:00:00.000Z`))
				.executeTakeFirst();
			if (promise) reasons.push('Current promise to pay');
		}
		return reasons;
	}

	private async dueCandidates(
		actor: TenantActorContext,
		activePolicy: CollectionPolicySummary | null,
		canViewCrm: boolean
	) {
		if (!activePolicy)
			return {
				asOf: (
					await new CollectionsService(this.db, this.publicIdFactory, this.now).getPortfolio(actor)
				).asOf,
				candidates: [] as DueReminderCandidate[]
			};
		const portfolio = await new CollectionsService(
			this.db,
			this.publicIdFactory,
			this.now
		).getPortfolio(actor);
		const candidates: DueReminderCandidate[] = [];
		for (const account of portfolio.accounts) {
			const activeCase = account.activeCase;
			if (!activeCase || activeCase.status !== 'open') continue;
			const invoices = account.overduePositions.flatMap((position) => position.invoices);
			if (invoices.length === 0) continue;
			const maxDaysOverdue = Math.max(...invoices.map((invoice) => invoice.daysOverdue));
			const existingRows = await this.db
				.selectFrom('receivable_collection_reminders')
				.select('policy_stage_id as stageId')
				.where('organisation_id', '=', actor.organisationId)
				.where('collection_case_id', '=', activeCase.id)
				.execute();
			const existing = new Set(existingRows.map((row) => row.stageId));
			const recipient = canViewCrm
				? await this.resolveRecipient(actor, activeCase.customerPartyId)
				: null;
			for (const stage of activePolicy.stages) {
				if (stage.triggerDaysOverdue > maxDaysOverdue || existing.has(stage.id)) continue;
				const blockedReasons = await this.suppressionReasons(
					this.db,
					actor.organisationId,
					activeCase.id,
					stage,
					portfolio.asOf
				);
				if (!canViewCrm)
					blockedReasons.push('CRM viewing authority is required to resolve a reminder recipient');
				else if (!recipient)
					blockedReasons.push('No active primary customer or primary-contact email is available');
				candidates.push({
					casePublicId: activeCase.publicId,
					customerPartyPublicId: account.customerPartyPublicId,
					customerDisplayName: account.customerDisplayName,
					customerAccountReference: account.customerAccountReference,
					stagePublicId: stage.publicId,
					stageName: stage.name,
					sequenceNumber: stage.sequenceNumber,
					triggerDaysOverdue: stage.triggerDaysOverdue,
					maxDaysOverdue,
					overdueInvoiceCount: invoices.length,
					recipient,
					blockedReasons,
					canGenerate: blockedReasons.length === 0
				});
			}
		}
		return { asOf: portfolio.asOf, candidates };
	}

	private async reminderRows(actor: TenantActorContext): Promise<CollectionReminderSummary[]> {
		const rows = await this.db
			.selectFrom('receivable_collection_reminders as reminder')
			.innerJoin('receivable_collection_cases as collectionCase', (join) =>
				join
					.onRef('collectionCase.id', '=', 'reminder.collection_case_id')
					.onRef('collectionCase.organisation_id', '=', 'reminder.organisation_id')
			)
			.innerJoin('receivable_collection_policies as policy', (join) =>
				join
					.onRef('policy.id', '=', 'reminder.collection_policy_id')
					.onRef('policy.organisation_id', '=', 'reminder.organisation_id')
			)
			.innerJoin('receivable_collection_policy_stages as stage', (join) =>
				join
					.onRef('stage.id', '=', 'reminder.policy_stage_id')
					.onRef('stage.organisation_id', '=', 'reminder.organisation_id')
			)
			.innerJoin('parties as party', (join) =>
				join
					.onRef('party.id', '=', 'reminder.customer_party_id')
					.onRef('party.organisation_id', '=', 'reminder.organisation_id')
			)
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'party.id')
					.onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.select([
				'reminder.id as id',
				'reminder.public_id as publicId',
				'collectionCase.public_id as casePublicId',
				'party.public_id as customerPartyPublicId',
				'party.party_kind as partyKind',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'stage.name as stageName',
				'policy.version_number as policyVersionNumber',
				'reminder.recipient_email as recipientEmail',
				'reminder.subject as subject',
				'reminder.message_body as messageBody',
				'reminder.as_of_date as asOfDate',
				'reminder.status as status',
				'reminder.generated_at as generatedAt',
				'reminder.sent_at as sentAt'
			])
			.where('reminder.organisation_id', '=', actor.organisationId)
			.orderBy('reminder.generated_at', 'desc')
			.limit(100)
			.execute();
		const result: CollectionReminderSummary[] = [];
		for (const row of rows) {
			const attempts = await this.db
				.selectFrom('receivable_collection_reminder_deliveries')
				.select(['outcome', 'attempted_at as attemptedAt', 'error_message as errorMessage'])
				.where('organisation_id', '=', actor.organisationId)
				.where('reminder_id', '=', row.id)
				.orderBy('attempt_number', 'desc')
				.execute();
			const last = attempts[0];
			result.push({
				publicId: row.publicId,
				casePublicId: row.casePublicId,
				customerPartyPublicId: row.customerPartyPublicId,
				customerDisplayName: displayName(row),
				stageName: row.stageName,
				policyVersionNumber: row.policyVersionNumber,
				recipientEmail: row.recipientEmail,
				subject: row.subject,
				messageBody: row.messageBody,
				asOfDate: row.asOfDate,
				status: asReminderStatus(row.status),
				generatedAt: row.generatedAt,
				sentAt: row.sentAt,
				attemptCount: attempts.length,
				lastAttemptOutcome: last?.outcome ?? null,
				lastAttemptAt: last?.attemptedAt ?? null,
				lastAttemptError: last?.errorMessage ?? null
			});
		}
		return result;
	}

	private async promiseReviews(
		actor: TenantActorContext,
		asOf: string
	): Promise<PromiseReviewSummary[]> {
		const rows = await this.db
			.selectFrom('receivable_promises_to_pay as promise')
			.innerJoin('receivable_collection_cases as collectionCase', (join) =>
				join
					.onRef('collectionCase.id', '=', 'promise.collection_case_id')
					.onRef('collectionCase.organisation_id', '=', 'promise.organisation_id')
			)
			.innerJoin('parties as party', (join) =>
				join
					.onRef('party.id', '=', 'collectionCase.customer_party_id')
					.onRef('party.organisation_id', '=', 'collectionCase.organisation_id')
			)
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'party.id')
					.onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.select([
				'promise.public_id as promisePublicId',
				'collectionCase.public_id as casePublicId',
				'party.public_id as customerPartyPublicId',
				'party.party_kind as partyKind',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'promise.promised_amount as promisedAmount',
				'promise.currency_code as currencyCode',
				'promise.due_on as dueOn'
			])
			.where('promise.organisation_id', '=', actor.organisationId)
			.where('promise.status', '=', 'open')
			.where('collectionCase.status', 'in', ['open', 'paused'])
			.where('promise.due_on', '<=', new Date(`${asOf}T00:00:00.000Z`))
			.orderBy('promise.due_on', 'asc')
			.execute();
		return rows.map((row) => ({
			promisePublicId: row.promisePublicId,
			casePublicId: row.casePublicId,
			customerPartyPublicId: row.customerPartyPublicId,
			customerDisplayName: displayName(row),
			promisedAmount: row.promisedAmount,
			currencyCode: row.currencyCode,
			dueOn: row.dueOn,
			daysPastDue: Math.max(0, dayNumber(asOf) - dayNumber(row.dueOn))
		}));
	}

	async getWorkspace(actor: TenantActorContext): Promise<CollectionsAutomationWorkspace> {
		await this.assertRead(actor);
		const permissionService = new PermissionService(this.db);
		const [policyDecision, generateDecision, dispatchDecision, crmViewDecision, activePolicy] =
			await Promise.all([
				this.mutationDecision(actor, 'finance.collections.policy.manage'),
				this.mutationDecision(actor, 'finance.collections.reminder.generate'),
				this.mutationDecision(actor, 'finance.collections.reminder.dispatch'),
				permissionService.decide(actor, 'crm.view'),
				this.policyByStatus(this.db, actor.organisationId, 'active')
			]);
		const draftPolicy = policyDecision.allowed
			? await this.policyByStatus(this.db, actor.organisationId, 'draft')
			: null;
		const due = await this.dueCandidates(actor, activePolicy, crmViewDecision.allowed);
		const [reminders, promiseReviews] = await Promise.all([
			this.reminderRows(actor),
			this.promiseReviews(actor, due.asOf)
		]);
		return {
			asOf: due.asOf,
			activePolicy,
			draftPolicy,
			dueReminders: due.candidates,
			reminders,
			promiseReviews,
			canManagePolicy: policyDecision.allowed,
			canGenerateReminders: generateDecision.allowed && crmViewDecision.allowed,
			canDispatchReminders: dispatchDecision.allowed,
			canViewCrm: crmViewDecision.allowed
		};
	}

	async createDraftPolicy(actor: TenantActorContext, nameInput: string): Promise<string> {
		const name = cleanFinanceText(nameInput, 160, 'Policy name', true)!;
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'finance.collections.policy.manage', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Collections policy management is not permitted.');
			await trx
				.selectFrom('organisations')
				.select('id')
				.where('id', '=', actor.organisationId)
				.forUpdate()
				.executeTakeFirstOrThrow();
			const existing = await trx
				.selectFrom('receivable_collection_policies')
				.select('public_id as publicId')
				.where('organisation_id', '=', actor.organisationId)
				.where('status', '=', 'draft')
				.orderBy('version_number', 'desc')
				.executeTakeFirst();
			if (existing) return existing.publicId;
			const latest = await trx
				.selectFrom('receivable_collection_policies')
				.select('version_number as versionNumber')
				.where('organisation_id', '=', actor.organisationId)
				.orderBy('version_number', 'desc')
				.executeTakeFirst();
			const publicId = this.publicIdFactory();
			await trx
				.insertInto('receivable_collection_policies')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					version_number: (latest?.versionNumber ?? 0) + 1,
					name,
					status: 'draft',
					created_by_member_id: membership.id,
					created_at: this.now(),
					activated_by_member_id: null,
					activated_at: null,
					retired_at: null
				})
				.executeTakeFirstOrThrow();
			await this.audit(
				trx,
				actor,
				membership.id,
				'finance.collections.policy.draft.created',
				'receivable_collection_policy',
				publicId,
				{ name }
			);
			return publicId;
		});
	}

	async saveDraftStage(
		actor: TenantActorContext,
		input: {
			policyPublicId: string;
			stagePublicId?: string | null;
			sequenceNumber: number;
			name: string;
			triggerDaysOverdue: number;
			subjectTemplate: string;
			bodyTemplate: string;
			suppressOnOpenDispute: boolean;
			suppressOnCurrentPromise: boolean;
		}
	): Promise<string> {
		if (
			!Number.isSafeInteger(input.sequenceNumber) ||
			input.sequenceNumber < 1 ||
			input.sequenceNumber > 100
		)
			throw new FinanceValidationError('Stage sequence must be between 1 and 100.');
		if (
			!Number.isSafeInteger(input.triggerDaysOverdue) ||
			input.triggerDaysOverdue < 1 ||
			input.triggerDaysOverdue > 3650
		)
			throw new FinanceValidationError('Days overdue must be between 1 and 3650.');
		const name = cleanFinanceText(input.name, 160, 'Stage name', true)!;
		const subjectTemplate = validateTemplate(input.subjectTemplate, 255, 'Subject template');
		const bodyTemplate = validateTemplate(input.bodyTemplate, 10000, 'Body template');
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'finance.collections.policy.manage', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Collections policy management is not permitted.');
			const policyRow = await this.policyByPublicId(
				trx,
				actor.organisationId,
				input.policyPublicId,
				true
			);
			if (policyRow.status !== 'draft')
				throw new FinanceValidationError('Only draft collections policies can be edited.');
			const values = {
				sequence_number: input.sequenceNumber,
				name,
				trigger_days_overdue: input.triggerDaysOverdue,
				delivery_channel: 'email',
				subject_template: subjectTemplate,
				body_template: bodyTemplate,
				suppress_on_open_dispute: input.suppressOnOpenDispute ? 1 : 0,
				suppress_on_current_promise: input.suppressOnCurrentPromise ? 1 : 0
			};
			let publicId = input.stagePublicId?.trim() ?? '';
			try {
				if (publicId) {
					const stage = await trx
						.selectFrom('receivable_collection_policy_stages')
						.select('id')
						.where('organisation_id', '=', actor.organisationId)
						.where('collection_policy_id', '=', policyRow.id)
						.where('public_id', '=', publicId)
						.forUpdate()
						.executeTakeFirst();
					if (!stage) throw new RecordNotFoundError('Collections policy stage not found.');
					await trx
						.updateTable('receivable_collection_policy_stages')
						.set(values)
						.where('id', '=', stage.id)
						.where('organisation_id', '=', actor.organisationId)
						.executeTakeFirstOrThrow();
				} else {
					publicId = this.publicIdFactory();
					await trx
						.insertInto('receivable_collection_policy_stages')
						.values({
							organisation_id: actor.organisationId,
							public_id: publicId,
							collection_policy_id: policyRow.id,
							...values
						})
						.executeTakeFirstOrThrow();
				}
			} catch (cause) {
				if (isDuplicateKeyError(cause))
					throw new FinanceValidationError(
						'Stage sequence and days-overdue triggers must be unique within the draft policy.'
					);
				throw cause;
			}
			await this.audit(
				trx,
				actor,
				membership.id,
				'finance.collections.policy.stage.saved',
				'receivable_collection_policy_stage',
				publicId,
				{
					policyPublicId: policyRow.public_id,
					sequenceNumber: input.sequenceNumber,
					triggerDaysOverdue: input.triggerDaysOverdue
				}
			);
			return publicId;
		});
	}

	async deleteDraftStage(
		actor: TenantActorContext,
		policyPublicId: string,
		stagePublicIdInput: string
	): Promise<void> {
		const stagePublicId = cleanFinanceText(stagePublicIdInput, 64, 'Stage ID', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'finance.collections.policy.manage', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Collections policy management is not permitted.');
			const policyRow = await this.policyByPublicId(
				trx,
				actor.organisationId,
				policyPublicId,
				true
			);
			if (policyRow.status !== 'draft')
				throw new FinanceValidationError('Only draft collections policies can be edited.');
			const stage = await trx
				.selectFrom('receivable_collection_policy_stages')
				.select(['id', 'public_id as publicId'])
				.where('organisation_id', '=', actor.organisationId)
				.where('collection_policy_id', '=', policyRow.id)
				.where('public_id', '=', stagePublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!stage) throw new RecordNotFoundError('Collections policy stage not found.');
			await trx
				.deleteFrom('receivable_collection_policy_stages')
				.where('id', '=', stage.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await this.audit(
				trx,
				actor,
				membership.id,
				'finance.collections.policy.stage.deleted',
				'receivable_collection_policy_stage',
				stage.publicId,
				{ policyPublicId: policyRow.public_id }
			);
		});
	}

	async activatePolicy(actor: TenantActorContext, policyPublicId: string): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(actor, 'finance.collections.policy.manage', trx);
			if (!decision.allowed)
				throw new TenantAccessError('Collections policy management is not permitted.');
			await trx
				.selectFrom('organisations')
				.select('id')
				.where('id', '=', actor.organisationId)
				.forUpdate()
				.executeTakeFirstOrThrow();
			const row = await this.policyByPublicId(trx, actor.organisationId, policyPublicId, true);
			if (row.status !== 'draft')
				throw new FinanceValidationError('Only a draft collections policy can be activated.');
			const stages = await this.stages(trx, actor.organisationId, row.id);
			if (stages.length === 0)
				throw new FinanceValidationError('Add at least one collections stage before activation.');
			for (let index = 0; index < stages.length; index += 1) {
				if (stages[index].sequenceNumber !== index + 1)
					throw new FinanceValidationError(
						'Policy stage sequence must be contiguous starting at 1.'
					);
				if (index > 0 && stages[index].triggerDaysOverdue <= stages[index - 1].triggerDaysOverdue)
					throw new FinanceValidationError(
						'Days-overdue triggers must increase with each policy stage.'
					);
			}
			const activatedAt = this.now();
			await trx
				.updateTable('receivable_collection_policies')
				.set({ status: 'retired', retired_at: activatedAt })
				.where('organisation_id', '=', actor.organisationId)
				.where('status', '=', 'active')
				.execute();
			await trx
				.updateTable('receivable_collection_policies')
				.set({
					status: 'active',
					activated_by_member_id: membership.id,
					activated_at: activatedAt,
					retired_at: null
				})
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', row.id)
				.executeTakeFirstOrThrow();
			await this.audit(
				trx,
				actor,
				membership.id,
				'finance.collections.policy.activated',
				'receivable_collection_policy',
				row.public_id,
				{ versionNumber: row.version_number, stageCount: stages.length }
			);
		});
	}

	async generateReminder(
		actor: TenantActorContext,
		casePublicIdInput: string,
		stagePublicIdInput: string
	): Promise<string> {
		await this.assertRead(actor);
		const decision = await this.mutationDecision(actor, 'finance.collections.reminder.generate');
		if (!decision.allowed)
			throw new TenantAccessError('Collections reminder generation is not permitted.');
		const crmView = await new PermissionService(this.db).decide(actor, 'crm.view');
		if (!crmView.allowed)
			throw new TenantAccessError(
				'CRM viewing is required to resolve a collections reminder recipient.'
			);
		const casePublicId = cleanFinanceText(casePublicIdInput, 64, 'Case ID', true)!;
		const stagePublicId = cleanFinanceText(stagePublicIdInput, 64, 'Stage ID', true)!;
		const activePolicy = await this.policyByStatus(this.db, actor.organisationId, 'active');
		if (!activePolicy)
			throw new FinanceValidationError('No active collections policy is configured.');
		const stage = activePolicy.stages.find((item) => item.publicId === stagePublicId);
		if (!stage) throw new RecordNotFoundError('Active collections policy stage not found.');
		const portfolio = await new CollectionsService(
			this.db,
			this.publicIdFactory,
			this.now
		).getPortfolio(actor);
		const account = portfolio.accounts.find(
			(item) => item.activeCase?.publicId === casePublicId && item.activeCase.status === 'open'
		);
		if (!account?.activeCase)
			throw new FinanceValidationError(
				'The collections case is no longer open with an overdue receivable.'
			);
		const invoices = account.overduePositions.flatMap((position) => position.invoices);
		const maxDaysOverdue = Math.max(...invoices.map((invoice) => invoice.daysOverdue));
		if (maxDaysOverdue < stage.triggerDaysOverdue)
			throw new FinanceValidationError('This collections policy stage is not yet due.');
		const suppression = await this.suppressionReasons(
			this.db,
			actor.organisationId,
			account.activeCase.id,
			stage,
			portfolio.asOf
		);
		if (suppression.length > 0)
			throw new FinanceValidationError(
				`Reminder generation is suppressed: ${suppression.join(', ')}.`
			);
		const recipient = await this.resolveRecipient(actor, account.activeCase.customerPartyId);
		if (!recipient)
			throw new FinanceValidationError(
				'No active primary customer or primary-contact email is available.'
			);
		const context: TemplateContext = {
			customer_name: account.customerDisplayName,
			account_reference: account.customerAccountReference ?? '',
			days_overdue: String(maxDaysOverdue),
			invoice_count: String(invoices.length),
			as_of_date: portfolio.asOf
		};
		const subject = renderTemplate(stage.subjectTemplate, context);
		const messageBody = renderTemplate(stage.bodyTemplate, context);
		try {
			return await this.db.transaction().execute(async (trx) => {
				const policy = new FinanceAccessPolicy(trx);
				const membership = await policy.assertActiveActor(actor, trx);
				const currentDecision = await this.mutationDecision(
					actor,
					'finance.collections.reminder.generate',
					trx
				);
				if (!currentDecision.allowed)
					throw new TenantAccessError('Collections reminder generation is not permitted.');
				const caseRow = await trx
					.selectFrom('receivable_collection_cases')
					.selectAll()
					.where('organisation_id', '=', actor.organisationId)
					.where('public_id', '=', casePublicId)
					.forUpdate()
					.executeTakeFirst();
				if (!caseRow || caseRow.status !== 'open')
					throw new FinanceValidationError('The collections case is no longer open.');
				const policyRow = await trx
					.selectFrom('receivable_collection_policies')
					.select('status')
					.where('organisation_id', '=', actor.organisationId)
					.where('id', '=', activePolicy.id)
					.forUpdate()
					.executeTakeFirst();
				if (!policyRow || policyRow.status !== 'active')
					throw new FinanceValidationError(
						'The collections policy changed before reminder generation.'
					);
				const existing = await trx
					.selectFrom('receivable_collection_reminders')
					.select('public_id as publicId')
					.where('organisation_id', '=', actor.organisationId)
					.where('collection_case_id', '=', caseRow.id)
					.where('policy_stage_id', '=', stage.id)
					.executeTakeFirst();
				if (existing) return existing.publicId;
				const publicId = this.publicIdFactory();
				await trx
					.insertInto('receivable_collection_reminders')
					.values({
						organisation_id: actor.organisationId,
						public_id: publicId,
						collection_case_id: caseRow.id,
						collection_policy_id: activePolicy.id,
						policy_stage_id: stage.id,
						customer_party_id: caseRow.customer_party_id,
						recipient_party_id: recipient.partyId,
						recipient_email: recipient.email,
						subject,
						message_body: messageBody,
						as_of_date: new Date(`${portfolio.asOf}T00:00:00.000Z`),
						status: 'pending',
						generated_by_member_id: membership.id,
						generated_at: this.now(),
						sent_at: null
					})
					.executeTakeFirstOrThrow();
				await this.audit(
					trx,
					actor,
					membership.id,
					'finance.collections.reminder.generated',
					'receivable_collection_reminder',
					publicId,
					{ casePublicId, stagePublicId, recipientEmail: recipient.email, asOf: portfolio.asOf }
				);
				return publicId;
			});
		} catch (cause) {
			if (isDuplicateKeyError(cause)) {
				const existing = await this.db
					.selectFrom('receivable_collection_reminders as reminder')
					.innerJoin('receivable_collection_cases as collectionCase', (join) =>
						join
							.onRef('collectionCase.id', '=', 'reminder.collection_case_id')
							.onRef('collectionCase.organisation_id', '=', 'reminder.organisation_id')
					)
					.innerJoin('receivable_collection_policy_stages as policyStage', (join) =>
						join
							.onRef('policyStage.id', '=', 'reminder.policy_stage_id')
							.onRef('policyStage.organisation_id', '=', 'reminder.organisation_id')
					)
					.select('reminder.public_id as publicId')
					.where('reminder.organisation_id', '=', actor.organisationId)
					.where('collectionCase.public_id', '=', casePublicId)
					.where('policyStage.public_id', '=', stagePublicId)
					.executeTakeFirst();
				if (existing) return existing.publicId;
			}
			throw cause;
		}
	}

	private async lockCustomerIssuedInvoices(
		db: DatabaseExecutor,
		organisationId: string,
		customerPartyId: string
	): Promise<void> {
		await db
			.selectFrom('financial_documents as document')
			.innerJoin('invoices as invoice', (join) =>
				join
					.onRef('invoice.financial_document_id', '=', 'document.id')
					.onRef('invoice.organisation_id', '=', 'document.organisation_id')
			)
			.select('document.id')
			.where('document.organisation_id', '=', organisationId)
			.where('document.customer_party_id', '=', customerPartyId)
			.where('document.document_kind', '=', 'invoice')
			.where('document.lifecycle_status', '=', 'issued')
			.orderBy('document.id', 'asc')
			.forUpdate()
			.execute();
	}

	async dispatchReminder(
		actor: TenantActorContext,
		reminderPublicIdInput: string
	): Promise<{ sent: boolean; errorMessage: string | null }> {
		await this.assertRead(actor);
		const reminderPublicId = cleanFinanceText(reminderPublicIdInput, 64, 'Reminder ID', true)!;
		const delivery = this.emailDeliveryFactory();
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await this.mutationDecision(
				actor,
				'finance.collections.reminder.dispatch',
				trx
			);
			if (!decision.allowed)
				throw new TenantAccessError('Collections reminder dispatch is not permitted.');
			const reminder = await trx
				.selectFrom('receivable_collection_reminders')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', reminderPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!reminder) throw new RecordNotFoundError('Collections reminder not found.');
			if (reminder.status === 'sent') return { sent: true, errorMessage: null };
			const [caseRow, stage] = await Promise.all([
				trx
					.selectFrom('receivable_collection_cases')
					.select(['id', 'public_id as publicId', 'customer_party_id as customerPartyId', 'status'])
					.where('organisation_id', '=', actor.organisationId)
					.where('id', '=', reminder.collection_case_id)
					.forUpdate()
					.executeTakeFirstOrThrow(),
				trx
					.selectFrom('receivable_collection_policy_stages')
					.select([
						'id',
						'trigger_days_overdue as triggerDaysOverdue',
						'suppress_on_open_dispute as suppressOnOpenDispute',
						'suppress_on_current_promise as suppressOnCurrentPromise'
					])
					.where('organisation_id', '=', actor.organisationId)
					.where('id', '=', reminder.policy_stage_id)
					.executeTakeFirstOrThrow()
			]);
			if (caseRow.status !== 'open')
				throw new FinanceValidationError(
					'Only reminders for an open collections case can be dispatched.'
				);
			await trx
				.selectFrom('parties')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', caseRow.customerPartyId)
				.forUpdate()
				.executeTakeFirstOrThrow();
			await this.lockCustomerIssuedInvoices(trx, actor.organisationId, caseRow.customerPartyId);
			const customer = await trx
				.selectFrom('parties')
				.select('public_id as publicId')
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', caseRow.customerPartyId)
				.executeTakeFirstOrThrow();
			const current = await new CollectionsService(
				this.db,
				this.publicIdFactory,
				this.now
			).getWorkspace(actor, customer.publicId);
			const invoices = current.receivable.aging.flatMap((position) =>
				position.invoices.filter((invoice) => invoice.daysOverdue > 0)
			);
			if (invoices.length === 0)
				throw new FinanceValidationError('The customer no longer has an overdue receivable.');
			const maxDaysOverdue = Math.max(...invoices.map((invoice) => invoice.daysOverdue));
			if (maxDaysOverdue < stage.triggerDaysOverdue)
				throw new FinanceValidationError('The reminder policy stage is no longer due.');
			const currentStage: CollectionPolicyStageSummary = {
				id: stage.id,
				publicId: '',
				sequenceNumber: 0,
				name: '',
				triggerDaysOverdue: stage.triggerDaysOverdue,
				deliveryChannel: 'email',
				subjectTemplate: '',
				bodyTemplate: '',
				suppressOnOpenDispute: stage.suppressOnOpenDispute === 1,
				suppressOnCurrentPromise: stage.suppressOnCurrentPromise === 1
			};
			const suppression = await this.suppressionReasons(
				trx,
				actor.organisationId,
				caseRow.id,
				currentStage,
				current.receivable.period.to
			);
			if (suppression.length > 0)
				throw new FinanceValidationError(
					`Reminder dispatch is suppressed: ${suppression.join(', ')}.`
				);
			const previousAttempt = await trx
				.selectFrom('receivable_collection_reminder_deliveries')
				.select('attempt_number as attemptNumber')
				.where('organisation_id', '=', actor.organisationId)
				.where('reminder_id', '=', reminder.id)
				.orderBy('attempt_number', 'desc')
				.executeTakeFirst();
			const attemptNumber = (previousAttempt?.attemptNumber ?? 0) + 1;
			let errorMessage: string | null = null;
			try {
				await delivery.send({
					to: reminder.recipient_email,
					subject: reminder.subject,
					text: reminder.message_body,
					idempotencyKey: reminder.public_id
				});
			} catch (cause) {
				errorMessage = cleanFinanceText(
					cause instanceof Error ? cause.message : 'Email delivery failed.',
					1000,
					'Delivery error',
					true
				)!;
			}
			await trx
				.insertInto('receivable_collection_reminder_deliveries')
				.values({
					organisation_id: actor.organisationId,
					public_id: this.publicIdFactory(),
					reminder_id: reminder.id,
					attempt_number: attemptNumber,
					attempted_by_member_id: membership.id,
					attempted_at: this.now(),
					outcome: errorMessage ? 'failed' : 'sent',
					error_message: errorMessage
				})
				.executeTakeFirstOrThrow();
			if (errorMessage) {
				await this.audit(
					trx,
					actor,
					membership.id,
					'finance.collections.reminder.delivery.failed',
					'receivable_collection_reminder',
					reminder.public_id,
					{ attemptNumber, errorMessage }
				);
				return { sent: false, errorMessage };
			}
			const sentAt = this.now();
			await trx
				.updateTable('receivable_collection_reminders')
				.set({ status: 'sent', sent_at: sentAt })
				.where('id', '=', reminder.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('receivable_collection_actions')
				.values({
					organisation_id: actor.organisationId,
					public_id: this.publicIdFactory(),
					collection_case_id: caseRow.id,
					action_type: 'reminder',
					delivery_channel: 'email',
					occurred_at: sentAt,
					recorded_by_member_id: membership.id,
					contact_party_id: reminder.recipient_party_id,
					invoice_document_id: null,
					promise_to_pay_id: null,
					dispute_id: null,
					subject: reminder.subject,
					message_body: reminder.message_body,
					outcome: `Sent to ${reminder.recipient_email}`
				})
				.executeTakeFirstOrThrow();
			await this.audit(
				trx,
				actor,
				membership.id,
				'finance.collections.reminder.dispatched',
				'receivable_collection_reminder',
				reminder.public_id,
				{ attemptNumber, recipientEmail: reminder.recipient_email }
			);
			return { sent: true, errorMessage: null };
		});
	}
}
