import type { Insertable, Selectable, Updateable } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';
import type {
	CorporateDevelopmentDiligenceFindings,
	CorporateDevelopmentDiligenceRequests,
	CorporateDevelopmentDiligenceWorkstreams,
	CorporateDevelopmentDivestiturePlans,
	CorporateDevelopmentIntegrationPlans,
	CorporateDevelopmentIntegrationWorkstreams,
	CorporateDevelopmentPartnershipCommitments,
	CorporateDevelopmentPartnershipReviews,
	CorporateDevelopmentPartnerships,
	CorporateDevelopmentSeparationObligations,
	CorporateDevelopmentTransactionConditions,
	CorporateDevelopmentTransactionMilestones,
	CorporateDevelopmentTransactions,
	CorporateDevelopmentTransactionTerms
} from '$lib/server/db/generated/corporate-development';

export type DiligenceWorkstreamRecord = Selectable<CorporateDevelopmentDiligenceWorkstreams>;
export type DiligenceRequestRecord = Selectable<CorporateDevelopmentDiligenceRequests>;
export type DiligenceFindingRecord = Selectable<CorporateDevelopmentDiligenceFindings>;
export type TransactionRecord = Selectable<CorporateDevelopmentTransactions>;
export type TransactionTermRecord = Selectable<CorporateDevelopmentTransactionTerms>;
export type TransactionMilestoneRecord = Selectable<CorporateDevelopmentTransactionMilestones>;
export type TransactionConditionRecord = Selectable<CorporateDevelopmentTransactionConditions>;
export type IntegrationPlanRecord = Selectable<CorporateDevelopmentIntegrationPlans>;
export type IntegrationWorkstreamRecord = Selectable<CorporateDevelopmentIntegrationWorkstreams>;
export type DivestiturePlanRecord = Selectable<CorporateDevelopmentDivestiturePlans>;
export type SeparationObligationRecord = Selectable<CorporateDevelopmentSeparationObligations>;
export type PartnershipRecord = Selectable<CorporateDevelopmentPartnerships>;
export type PartnershipCommitmentRecord = Selectable<CorporateDevelopmentPartnershipCommitments>;
export type PartnershipReviewRecord = Selectable<CorporateDevelopmentPartnershipReviews>;

function insertedId(result: { insertId?: bigint }, label: string): string {
	const id = result.insertId?.toString();
	if (!id) throw new Error(`${label} insert did not return an identifier.`);
	return id;
}

export class CorporateDevelopmentLifecycleRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	listDiligenceWorkstreams(organisationId: string, opportunityId: string) {
		return this.db.selectFrom('corporate_development_diligence_workstreams').selectAll()
			.where('organisation_id', '=', organisationId).where('opportunity_id', '=', opportunityId)
			.orderBy('workstream_code', 'asc').execute();
	}
	async insertDiligenceWorkstream(values: Insertable<CorporateDevelopmentDiligenceWorkstreams>) {
		const result = await this.db.insertInto('corporate_development_diligence_workstreams').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_diligence_workstreams').selectAll().where('id', '=', insertedId(result, 'Diligence workstream')).executeTakeFirstOrThrow();
	}
	listDiligenceRequests(organisationId: string, workstreamIds: string[]) {
		if (!workstreamIds.length) return Promise.resolve([] as DiligenceRequestRecord[]);
		return this.db.selectFrom('corporate_development_diligence_requests').selectAll().where('organisation_id', '=', organisationId).where('diligence_workstream_id', 'in', workstreamIds).orderBy('due_date', 'asc').execute();
	}
	findDiligenceRequest(organisationId: string, publicId: string) {
		return this.db.selectFrom('corporate_development_diligence_requests').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}
	async insertDiligenceRequest(values: Insertable<CorporateDevelopmentDiligenceRequests>) {
		const result = await this.db.insertInto('corporate_development_diligence_requests').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_diligence_requests').selectAll().where('id', '=', insertedId(result, 'Diligence request')).executeTakeFirstOrThrow();
	}
	async updateDiligenceRequest(organisationId: string, id: string, values: Updateable<CorporateDevelopmentDiligenceRequests>) {
		await this.db.updateTable('corporate_development_diligence_requests').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_diligence_requests').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}
	listDiligenceFindings(organisationId: string, workstreamIds: string[]) {
		if (!workstreamIds.length) return Promise.resolve([] as DiligenceFindingRecord[]);
		return this.db.selectFrom('corporate_development_diligence_findings').selectAll().where('organisation_id', '=', organisationId).where('diligence_workstream_id', 'in', workstreamIds).orderBy('severity', 'desc').execute();
	}
	findDiligenceFinding(organisationId: string, publicId: string) {
		return this.db.selectFrom('corporate_development_diligence_findings').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}
	async insertDiligenceFinding(values: Insertable<CorporateDevelopmentDiligenceFindings>) {
		const result = await this.db.insertInto('corporate_development_diligence_findings').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_diligence_findings').selectAll().where('id', '=', insertedId(result, 'Diligence finding')).executeTakeFirstOrThrow();
	}
	async updateDiligenceFinding(organisationId: string, id: string, values: Updateable<CorporateDevelopmentDiligenceFindings>) {
		await this.db.updateTable('corporate_development_diligence_findings').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_diligence_findings').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listTransactions(organisationId: string, opportunityId: string) {
		return this.db.selectFrom('corporate_development_transactions').selectAll().where('organisation_id', '=', organisationId).where('opportunity_id', '=', opportunityId).orderBy('created_at', 'desc').execute();
	}
	findTransaction(organisationId: string, publicId: string) {
		return this.db.selectFrom('corporate_development_transactions').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}
	async insertTransaction(values: Insertable<CorporateDevelopmentTransactions>) {
		const result = await this.db.insertInto('corporate_development_transactions').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_transactions').selectAll().where('id', '=', insertedId(result, 'Transaction')).executeTakeFirstOrThrow();
	}
	async updateTransaction(organisationId: string, id: string, values: Updateable<CorporateDevelopmentTransactions>) {
		await this.db.updateTable('corporate_development_transactions').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_transactions').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}
	listTransactionTerms(organisationId: string, transactionIds: string[]) {
		if (!transactionIds.length) return Promise.resolve([] as TransactionTermRecord[]);
		return this.db.selectFrom('corporate_development_transaction_terms').selectAll().where('organisation_id', '=', organisationId).where('transaction_id', 'in', transactionIds).execute();
	}
	async insertTransactionTerm(values: Insertable<CorporateDevelopmentTransactionTerms>) {
		const result = await this.db.insertInto('corporate_development_transaction_terms').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_transaction_terms').selectAll().where('id', '=', insertedId(result, 'Transaction term')).executeTakeFirstOrThrow();
	}
	listTransactionMilestones(organisationId: string, transactionIds: string[]) {
		if (!transactionIds.length) return Promise.resolve([] as TransactionMilestoneRecord[]);
		return this.db.selectFrom('corporate_development_transaction_milestones').selectAll().where('organisation_id', '=', organisationId).where('transaction_id', 'in', transactionIds).orderBy('planned_date', 'asc').execute();
	}
	async insertTransactionMilestone(values: Insertable<CorporateDevelopmentTransactionMilestones>) {
		const result = await this.db.insertInto('corporate_development_transaction_milestones').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_transaction_milestones').selectAll().where('id', '=', insertedId(result, 'Transaction milestone')).executeTakeFirstOrThrow();
	}
	listTransactionConditions(organisationId: string, transactionIds: string[]) {
		if (!transactionIds.length) return Promise.resolve([] as TransactionConditionRecord[]);
		return this.db.selectFrom('corporate_development_transaction_conditions').selectAll().where('organisation_id', '=', organisationId).where('transaction_id', 'in', transactionIds).orderBy('due_date', 'asc').execute();
	}
	findTransactionCondition(organisationId: string, publicId: string) {
		return this.db.selectFrom('corporate_development_transaction_conditions').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}
	async insertTransactionCondition(values: Insertable<CorporateDevelopmentTransactionConditions>) {
		const result = await this.db.insertInto('corporate_development_transaction_conditions').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_transaction_conditions').selectAll().where('id', '=', insertedId(result, 'Transaction condition')).executeTakeFirstOrThrow();
	}
	async updateTransactionCondition(organisationId: string, id: string, values: Updateable<CorporateDevelopmentTransactionConditions>) {
		await this.db.updateTable('corporate_development_transaction_conditions').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_transaction_conditions').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listIntegrationPlans(organisationId: string, opportunityId: string) {
		return this.db.selectFrom('corporate_development_integration_plans').selectAll().where('organisation_id', '=', organisationId).where('opportunity_id', '=', opportunityId).orderBy('created_at', 'desc').execute();
	}
	async insertIntegrationPlan(values: Insertable<CorporateDevelopmentIntegrationPlans>) {
		const result = await this.db.insertInto('corporate_development_integration_plans').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_integration_plans').selectAll().where('id', '=', insertedId(result, 'Integration plan')).executeTakeFirstOrThrow();
	}
	listIntegrationWorkstreams(organisationId: string, planIds: string[]) {
		if (!planIds.length) return Promise.resolve([] as IntegrationWorkstreamRecord[]);
		return this.db.selectFrom('corporate_development_integration_workstreams').selectAll().where('organisation_id', '=', organisationId).where('integration_plan_id', 'in', planIds).orderBy('workstream_code', 'asc').execute();
	}
	async insertIntegrationWorkstream(values: Insertable<CorporateDevelopmentIntegrationWorkstreams>) {
		const result = await this.db.insertInto('corporate_development_integration_workstreams').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_integration_workstreams').selectAll().where('id', '=', insertedId(result, 'Integration workstream')).executeTakeFirstOrThrow();
	}

	listDivestiturePlans(organisationId: string, opportunityId: string) {
		return this.db.selectFrom('corporate_development_divestiture_plans').selectAll().where('organisation_id', '=', organisationId).where('opportunity_id', '=', opportunityId).orderBy('created_at', 'desc').execute();
	}
	async insertDivestiturePlan(values: Insertable<CorporateDevelopmentDivestiturePlans>) {
		const result = await this.db.insertInto('corporate_development_divestiture_plans').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_divestiture_plans').selectAll().where('id', '=', insertedId(result, 'Divestiture plan')).executeTakeFirstOrThrow();
	}
	listSeparationObligations(organisationId: string, planIds: string[]) {
		if (!planIds.length) return Promise.resolve([] as SeparationObligationRecord[]);
		return this.db.selectFrom('corporate_development_separation_obligations').selectAll().where('organisation_id', '=', organisationId).where('divestiture_plan_id', 'in', planIds).orderBy('due_date', 'asc').execute();
	}
	async insertSeparationObligation(values: Insertable<CorporateDevelopmentSeparationObligations>) {
		const result = await this.db.insertInto('corporate_development_separation_obligations').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_separation_obligations').selectAll().where('id', '=', insertedId(result, 'Separation obligation')).executeTakeFirstOrThrow();
	}

	listPartnerships(organisationId: string) {
		return this.db.selectFrom('corporate_development_partnerships').selectAll().where('organisation_id', '=', organisationId).orderBy('updated_at', 'desc').execute();
	}
	findPartnership(organisationId: string, publicId: string) {
		return this.db.selectFrom('corporate_development_partnerships').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}
	async insertPartnership(values: Insertable<CorporateDevelopmentPartnerships>) {
		const result = await this.db.insertInto('corporate_development_partnerships').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_partnerships').selectAll().where('id', '=', insertedId(result, 'Partnership')).executeTakeFirstOrThrow();
	}
	async updatePartnership(organisationId: string, id: string, values: Updateable<CorporateDevelopmentPartnerships>) {
		await this.db.updateTable('corporate_development_partnerships').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_partnerships').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}
	listPartnershipCommitments(organisationId: string, partnershipIds: string[]) {
		if (!partnershipIds.length) return Promise.resolve([] as PartnershipCommitmentRecord[]);
		return this.db.selectFrom('corporate_development_partnership_commitments').selectAll().where('organisation_id', '=', organisationId).where('partnership_id', 'in', partnershipIds).orderBy('due_date', 'asc').execute();
	}
	async insertPartnershipCommitment(values: Insertable<CorporateDevelopmentPartnershipCommitments>) {
		const result = await this.db.insertInto('corporate_development_partnership_commitments').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_partnership_commitments').selectAll().where('id', '=', insertedId(result, 'Partnership commitment')).executeTakeFirstOrThrow();
	}
	listPartnershipReviews(organisationId: string, partnershipIds: string[]) {
		if (!partnershipIds.length) return Promise.resolve([] as PartnershipReviewRecord[]);
		return this.db.selectFrom('corporate_development_partnership_reviews').selectAll().where('organisation_id', '=', organisationId).where('partnership_id', 'in', partnershipIds).orderBy('review_date', 'desc').execute();
	}
	async insertPartnershipReview(values: Insertable<CorporateDevelopmentPartnershipReviews>) {
		const result = await this.db.insertInto('corporate_development_partnership_reviews').values(values).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_partnership_reviews').selectAll().where('id', '=', insertedId(result, 'Partnership review')).executeTakeFirstOrThrow();
	}
}