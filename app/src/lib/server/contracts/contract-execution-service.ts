import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase, type Database } from '$lib/server/db/database';
import { CreditControlBlockedError, CreditControlService } from '$lib/server/finance/credit-control-service';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	ContractAccessPolicy,
	ContractValidationError,
	EXECUTION_METHODS,
	cleanText,
	positiveInt,
	validateDateTime,
	type ExecuteContractInput
} from './contract-common';

export type CreditControlledExecuteContractInput = ExecuteContractInput & {
	creditOverrideReason?: string | null;
};

export class ContractExecutionService {
	private readonly policy: ContractAccessPolicy;

	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {
		this.policy = new ContractAccessPolicy(db);
	}

	async execute(actor: TenantActorContext, input: CreditControlledExecuteContractInput): Promise<void> {
		const contractPublicId = cleanText(input.contractPublicId, 64, 'Contract ID', true)!;
		const versionNumber = positiveInt(input.versionNumber, 'Contract version');
		const executionMethod = input.executionMethod.trim();
		if (!EXECUTION_METHODS.has(executionMethod)) throw new ContractValidationError('Execution method is invalid.');
		const executedAt = validateDateTime(input.executedAt, 'Execution date/time');
		const signatoryName = cleanText(input.signatoryName, 255, 'Signatory name', true)!;
		const signatoryEmail = cleanText(input.signatoryEmail, 320, 'Signatory email');
		if (signatoryEmail && !signatoryEmail.includes('@')) throw new ContractValidationError('Signatory email is invalid.');
		const signingRole = cleanText(input.signingRole, 160, 'Signing role');
		const externalTransactionReference = cleanText(input.externalTransactionReference, 255, 'External transaction reference');
		const note = cleanText(input.note, 1000, 'Execution note');
		const creditOverrideReason = cleanText(input.creditOverrideReason, 1000, 'Credit-control override reason');

		await this.db.transaction().execute(async (trx) => {
			const membership = await this.policy.assertActiveActor(actor, trx);
			const decision = await this.policy.mutationDecision(actor, 'contract.execute', trx);
			if (!decision.allowed) throw new TenantAccessError('Contract execution recording is not permitted.');

			const contract = await trx
				.selectFrom('contracts')
				.select([
					'id',
					'public_id as publicId',
					'lifecycle_status as lifecycleStatus',
					'project_id as projectId',
					'started_on as startedOn',
					'currency_code as currencyCode'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', contractPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!contract) throw new RecordNotFoundError('Contract not found.');

			const version = await trx
				.selectFrom('contract_versions')
				.select(['id', 'version_status as versionStatus', 'locked_at as lockedAt'])
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_id', '=', contract.id)
				.where('version_number', '=', versionNumber)
				.forUpdate()
				.executeTakeFirst();
			if (!version) throw new RecordNotFoundError('Contract version not found.');
			if (version.versionStatus !== 'issued' || !version.lockedAt) {
				throw new ContractValidationError('Only an issued and locked contract version can be executed.');
			}
			if (contract.lifecycleStatus !== 'under_review') {
				throw new ContractValidationError('The contract is not awaiting execution.');
			}

			const existingExecution = await trx
				.selectFrom('contract_execution_events')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_version_id', '=', version.id)
				.executeTakeFirst();
			if (existingExecution) throw new ContractValidationError('Execution evidence already exists for this contract version.');

			const clientParty = await trx
				.selectFrom('contract_version_parties as party')
				.innerJoin('contract_party_role_types as role', 'role.id', 'party.contract_party_role_type_id')
				.select('party.source_party_id as sourcePartyId')
				.where('party.organisation_id', '=', actor.organisationId)
				.where('party.contract_version_id', '=', version.id)
				.where('role.code', '=', 'client')
				.orderBy('party.sort_order')
				.executeTakeFirst();

			if (clientParty?.sourcePartyId) {
				try {
					await new CreditControlService(this.db, this.publicIdFactory, this.now).enforceCommitment(
						actor,
						{
							customerPartyId: clientParty.sourcePartyId,
							currencyCode: contract.currencyCode,
							workflowType: 'contract_execution',
							subjectPublicId: contract.publicId,
							overrideReason: creditOverrideReason
						},
						trx
					);
				} catch (cause) {
					if (cause instanceof CreditControlBlockedError) throw new ContractValidationError(cause.message);
					throw cause;
				}
			}

			const executionInsert = await trx
				.insertInto('contract_execution_events')
				.values({
					organisation_id: actor.organisationId,
					contract_version_id: version.id,
					execution_method: executionMethod,
					executed_at: executedAt,
					recorded_by_member_id: membership.id,
					external_transaction_reference: externalTransactionReference,
					note
				})
				.executeTakeFirstOrThrow();
			if (executionInsert.insertId === undefined) throw new Error('Contract execution event insert did not return an ID.');

			await trx
				.insertInto('contract_execution_signatories')
				.values({
					organisation_id: actor.organisationId,
					contract_execution_event_id: executionInsert.insertId.toString(),
					contract_version_id: version.id,
					source_party_id: clientParty?.sourcePartyId ?? null,
					signatory_name: signatoryName,
					signatory_email: signatoryEmail,
					signing_role: signingRole,
					signed_at: executedAt,
					external_signature_reference: externalTransactionReference
				})
				.executeTakeFirstOrThrow();

			await trx
				.updateTable('contract_versions')
				.set({ version_status: 'executed' })
				.where('id', '=', version.id)
				.where('organisation_id', '=', actor.organisationId)
				.where('version_status', '=', 'issued')
				.executeTakeFirstOrThrow();
			await trx
				.updateTable('contracts')
				.set({ lifecycle_status: 'active', started_on: contract.startedOn ?? executedAt })
				.where('id', '=', contract.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();

			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: contract.projectId,
				actionKey: 'contract.executed',
				subjectType: 'contract',
				subjectPublicId: contract.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					versionNumber,
					executionMethod,
					executedAt: executedAt.toISOString(),
					signatoryName,
					creditControlOverrideRequested: Boolean(creditOverrideReason)
				}
			});
		});
	}
}
