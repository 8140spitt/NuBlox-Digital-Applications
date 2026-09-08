import type { Insertable, Selectable, Updateable } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';
import type {
	GovernanceActions,
	GovernanceAgendaItems,
	GovernanceAuthorityRules,
	GovernanceBodies,
	GovernanceBodyMemberships,
	GovernanceConflictDeclarations,
	GovernanceDecisions,
	GovernanceEthicsCases,
	GovernanceFrameworks,
	GovernanceMeetingAttendees,
	GovernanceMeetings,
	GovernancePolicies,
	GovernancePolicyAttestations
} from '$lib/server/db/generated/governance';

export type GovernanceFrameworkRecord = Selectable<GovernanceFrameworks>;
export type GovernanceBodyRecord = Selectable<GovernanceBodies>;
export type GovernanceBodyMembershipRecord = Selectable<GovernanceBodyMemberships>;
export type GovernanceAuthorityRuleRecord = Selectable<GovernanceAuthorityRules>;
export type GovernanceMeetingRecord = Selectable<GovernanceMeetings>;
export type GovernanceMeetingAttendeeRecord = Selectable<GovernanceMeetingAttendees>;
export type GovernanceAgendaItemRecord = Selectable<GovernanceAgendaItems>;
export type GovernanceDecisionRecord = Selectable<GovernanceDecisions>;
export type GovernanceActionRecord = Selectable<GovernanceActions>;
export type GovernancePolicyRecord = Selectable<GovernancePolicies>;
export type GovernancePolicyAttestationRecord = Selectable<GovernancePolicyAttestations>;
export type GovernanceConflictDeclarationRecord = Selectable<GovernanceConflictDeclarations>;
export type GovernanceEthicsCaseRecord = Selectable<GovernanceEthicsCases>;

export class GovernanceRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listFrameworks(organisationId: string): Promise<GovernanceFrameworkRecord[]> {
		return this.db
			.selectFrom('governance_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('framework_code', 'asc')
			.orderBy('version_number', 'desc')
			.execute();
	}

	async findFrameworkByPublicId(
		organisationId: string,
		publicId: string
	): Promise<GovernanceFrameworkRecord | undefined> {
		return this.db
			.selectFrom('governance_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async findFrameworkById(
		organisationId: string,
		id: string
	): Promise<GovernanceFrameworkRecord | undefined> {
		return this.db
			.selectFrom('governance_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirst();
	}

	async findLatestFrameworkVersion(
		organisationId: string,
		frameworkCode: string
	): Promise<GovernanceFrameworkRecord | undefined> {
		return this.db
			.selectFrom('governance_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('framework_code', '=', frameworkCode)
			.orderBy('version_number', 'desc')
			.executeTakeFirst();
	}

	async insertFramework(values: Insertable<GovernanceFrameworks>): Promise<GovernanceFrameworkRecord> {
		const result = await this.db
			.insertInto('governance_frameworks')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance framework insert did not return an identifier.');
		return this.db
			.selectFrom('governance_frameworks')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateFramework(
		organisationId: string,
		id: string,
		values: Updateable<GovernanceFrameworks>
	): Promise<GovernanceFrameworkRecord> {
		await this.db
			.updateTable('governance_frameworks')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('governance_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listBodies(frameworkId: string): Promise<GovernanceBodyRecord[]> {
		return this.db
			.selectFrom('governance_bodies')
			.selectAll()
			.where('governance_framework_id', '=', frameworkId)
			.orderBy('body_type', 'asc')
			.orderBy('body_code', 'asc')
			.execute();
	}

	async findBodyByPublicId(
		organisationId: string,
		publicId: string
	): Promise<GovernanceBodyRecord | undefined> {
		return this.db
			.selectFrom('governance_bodies')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertBody(values: Insertable<GovernanceBodies>): Promise<GovernanceBodyRecord> {
		const result = await this.db
			.insertInto('governance_bodies')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance body insert did not return an identifier.');
		return this.db
			.selectFrom('governance_bodies')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listBodyMemberships(bodyIds: string[]): Promise<GovernanceBodyMembershipRecord[]> {
		if (bodyIds.length === 0) return [];
		return this.db
			.selectFrom('governance_body_memberships')
			.selectAll()
			.where('governance_body_id', 'in', bodyIds)
			.orderBy('governance_body_id', 'asc')
			.orderBy('appointed_on', 'asc')
			.execute();
	}

	async findActiveBodyMembership(
		bodyId: string,
		memberId: string
	): Promise<GovernanceBodyMembershipRecord | undefined> {
		return this.db
			.selectFrom('governance_body_memberships')
			.selectAll()
			.where('governance_body_id', '=', bodyId)
			.where('organisation_member_id', '=', memberId)
			.where('lifecycle_status', '=', 'active')
			.orderBy('appointed_on', 'desc')
			.executeTakeFirst();
	}

	async insertBodyMembership(
		values: Insertable<GovernanceBodyMemberships>
	): Promise<GovernanceBodyMembershipRecord> {
		const result = await this.db
			.insertInto('governance_body_memberships')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance body membership insert did not return an identifier.');
		return this.db
			.selectFrom('governance_body_memberships')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listAuthorityRules(frameworkId: string): Promise<GovernanceAuthorityRuleRecord[]> {
		return this.db
			.selectFrom('governance_authority_rules')
			.selectAll()
			.where('governance_framework_id', '=', frameworkId)
			.orderBy('subject_domain', 'asc')
			.orderBy('action_key', 'asc')
			.orderBy('min_amount', 'asc')
			.execute();
	}

	async insertAuthorityRule(
		values: Insertable<GovernanceAuthorityRules>
	): Promise<GovernanceAuthorityRuleRecord> {
		const result = await this.db
			.insertInto('governance_authority_rules')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance authority-rule insert did not return an identifier.');
		return this.db
			.selectFrom('governance_authority_rules')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listMeetings(bodyIds: string[]): Promise<GovernanceMeetingRecord[]> {
		if (bodyIds.length === 0) return [];
		return this.db
			.selectFrom('governance_meetings')
			.selectAll()
			.where('governance_body_id', 'in', bodyIds)
			.orderBy('scheduled_at', 'desc')
			.execute();
	}

	async findMeetingByPublicId(
		organisationId: string,
		publicId: string
	): Promise<GovernanceMeetingRecord | undefined> {
		return this.db
			.selectFrom('governance_meetings')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertMeeting(values: Insertable<GovernanceMeetings>): Promise<GovernanceMeetingRecord> {
		const result = await this.db
			.insertInto('governance_meetings')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance meeting insert did not return an identifier.');
		return this.db
			.selectFrom('governance_meetings')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateMeeting(
		organisationId: string,
		id: string,
		values: Updateable<GovernanceMeetings>
	): Promise<GovernanceMeetingRecord> {
		await this.db
			.updateTable('governance_meetings')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('governance_meetings')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listMeetingAttendees(meetingIds: string[]): Promise<GovernanceMeetingAttendeeRecord[]> {
		if (meetingIds.length === 0) return [];
		return this.db
			.selectFrom('governance_meeting_attendees')
			.selectAll()
			.where('governance_meeting_id', 'in', meetingIds)
			.orderBy('governance_meeting_id', 'asc')
			.orderBy('organisation_member_id', 'asc')
			.execute();
	}

	async upsertMeetingAttendee(values: Insertable<GovernanceMeetingAttendees>): Promise<void> {
		await this.db
			.insertInto('governance_meeting_attendees')
			.values(values)
			.onDuplicateKeyUpdate({
				attendance_status: values.attendance_status,
				voting_eligible: values.voting_eligible,
				created_by_member_id: values.created_by_member_id
			})
			.executeTakeFirstOrThrow();
	}

	async listAgendaItems(meetingIds: string[]): Promise<GovernanceAgendaItemRecord[]> {
		if (meetingIds.length === 0) return [];
		return this.db
			.selectFrom('governance_agenda_items')
			.selectAll()
			.where('governance_meeting_id', 'in', meetingIds)
			.orderBy('governance_meeting_id', 'asc')
			.orderBy('agenda_number', 'asc')
			.execute();
	}

	async findAgendaItemByPublicId(
		organisationId: string,
		publicId: string
	): Promise<GovernanceAgendaItemRecord | undefined> {
		return this.db
			.selectFrom('governance_agenda_items')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertAgendaItem(
		values: Insertable<GovernanceAgendaItems>
	): Promise<GovernanceAgendaItemRecord> {
		const result = await this.db
			.insertInto('governance_agenda_items')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance agenda-item insert did not return an identifier.');
		return this.db
			.selectFrom('governance_agenda_items')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listDecisions(meetingIds: string[]): Promise<GovernanceDecisionRecord[]> {
		if (meetingIds.length === 0) return [];
		return this.db
			.selectFrom('governance_decisions')
			.selectAll()
			.where('governance_meeting_id', 'in', meetingIds)
			.orderBy('decided_at', 'desc')
			.execute();
	}

	async findDecisionByPublicId(
		organisationId: string,
		publicId: string
	): Promise<GovernanceDecisionRecord | undefined> {
		return this.db
			.selectFrom('governance_decisions')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async findDecisionByAgendaItemId(agendaItemId: string): Promise<GovernanceDecisionRecord | undefined> {
		return this.db
			.selectFrom('governance_decisions')
			.selectAll()
			.where('governance_agenda_item_id', '=', agendaItemId)
			.executeTakeFirst();
	}

	async insertDecision(values: Insertable<GovernanceDecisions>): Promise<GovernanceDecisionRecord> {
		const result = await this.db
			.insertInto('governance_decisions')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance decision insert did not return an identifier.');
		return this.db
			.selectFrom('governance_decisions')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listActions(decisionIds: string[]): Promise<GovernanceActionRecord[]> {
		if (decisionIds.length === 0) return [];
		return this.db
			.selectFrom('governance_actions')
			.selectAll()
			.where('governance_decision_id', 'in', decisionIds)
			.orderBy('due_date', 'asc')
			.execute();
	}

	async findActionByPublicId(
		organisationId: string,
		publicId: string
	): Promise<GovernanceActionRecord | undefined> {
		return this.db
			.selectFrom('governance_actions')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertAction(values: Insertable<GovernanceActions>): Promise<GovernanceActionRecord> {
		const result = await this.db
			.insertInto('governance_actions')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance action insert did not return an identifier.');
		return this.db
			.selectFrom('governance_actions')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateAction(
		organisationId: string,
		id: string,
		values: Updateable<GovernanceActions>
	): Promise<GovernanceActionRecord> {
		await this.db
			.updateTable('governance_actions')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('governance_actions')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listPolicies(frameworkId: string): Promise<GovernancePolicyRecord[]> {
		return this.db
			.selectFrom('governance_policies')
			.selectAll()
			.where('governance_framework_id', '=', frameworkId)
			.orderBy('policy_code', 'asc')
			.orderBy('version_number', 'desc')
			.execute();
	}

	async findPolicyByPublicId(
		organisationId: string,
		publicId: string
	): Promise<GovernancePolicyRecord | undefined> {
		return this.db
			.selectFrom('governance_policies')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async findLatestPolicyVersion(
		organisationId: string,
		policyCode: string
	): Promise<GovernancePolicyRecord | undefined> {
		return this.db
			.selectFrom('governance_policies')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('policy_code', '=', policyCode)
			.orderBy('version_number', 'desc')
			.executeTakeFirst();
	}

	async insertPolicy(values: Insertable<GovernancePolicies>): Promise<GovernancePolicyRecord> {
		const result = await this.db
			.insertInto('governance_policies')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance policy insert did not return an identifier.');
		return this.db
			.selectFrom('governance_policies')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updatePolicy(
		organisationId: string,
		id: string,
		values: Updateable<GovernancePolicies>
	): Promise<GovernancePolicyRecord> {
		await this.db
			.updateTable('governance_policies')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('governance_policies')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listPolicyAttestations(policyIds: string[]): Promise<GovernancePolicyAttestationRecord[]> {
		if (policyIds.length === 0) return [];
		return this.db
			.selectFrom('governance_policy_attestations')
			.selectAll()
			.where('governance_policy_id', 'in', policyIds)
			.orderBy('attested_at', 'desc')
			.execute();
	}

	async findPolicyAttestation(
		policyId: string,
		memberId: string
	): Promise<GovernancePolicyAttestationRecord | undefined> {
		return this.db
			.selectFrom('governance_policy_attestations')
			.selectAll()
			.where('governance_policy_id', '=', policyId)
			.where('organisation_member_id', '=', memberId)
			.executeTakeFirst();
	}

	async insertPolicyAttestation(
		values: Insertable<GovernancePolicyAttestations>
	): Promise<GovernancePolicyAttestationRecord> {
		const result = await this.db
			.insertInto('governance_policy_attestations')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance policy attestation insert did not return an identifier.');
		return this.db
			.selectFrom('governance_policy_attestations')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listConflicts(organisationId: string): Promise<GovernanceConflictDeclarationRecord[]> {
		return this.db
			.selectFrom('governance_conflict_declarations')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('declared_on', 'desc')
			.execute();
	}

	async findConflictByPublicId(
		organisationId: string,
		publicId: string
	): Promise<GovernanceConflictDeclarationRecord | undefined> {
		return this.db
			.selectFrom('governance_conflict_declarations')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertConflict(
		values: Insertable<GovernanceConflictDeclarations>
	): Promise<GovernanceConflictDeclarationRecord> {
		const result = await this.db
			.insertInto('governance_conflict_declarations')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance conflict declaration insert did not return an identifier.');
		return this.db
			.selectFrom('governance_conflict_declarations')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateConflict(
		organisationId: string,
		id: string,
		values: Updateable<GovernanceConflictDeclarations>
	): Promise<GovernanceConflictDeclarationRecord> {
		await this.db
			.updateTable('governance_conflict_declarations')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('governance_conflict_declarations')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listEthicsCases(organisationId: string): Promise<GovernanceEthicsCaseRecord[]> {
		return this.db
			.selectFrom('governance_ethics_cases')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('created_at', 'desc')
			.execute();
	}

	async findEthicsCaseByPublicId(
		organisationId: string,
		publicId: string
	): Promise<GovernanceEthicsCaseRecord | undefined> {
		return this.db
			.selectFrom('governance_ethics_cases')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertEthicsCase(
		values: Insertable<GovernanceEthicsCases>
	): Promise<GovernanceEthicsCaseRecord> {
		const result = await this.db
			.insertInto('governance_ethics_cases')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Governance ethics case insert did not return an identifier.');
		return this.db
			.selectFrom('governance_ethics_cases')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateEthicsCase(
		organisationId: string,
		id: string,
		values: Updateable<GovernanceEthicsCases>
	): Promise<GovernanceEthicsCaseRecord> {
		await this.db
			.updateTable('governance_ethics_cases')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('governance_ethics_cases')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}
}
