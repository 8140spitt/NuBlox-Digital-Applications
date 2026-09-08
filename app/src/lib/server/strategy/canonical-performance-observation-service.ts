import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	CanonicalKpiSourceService,
	CanonicalKpiSourceValidationError,
	type CanonicalKpiSourceResolution
} from './canonical-kpi-source-service';
import {
	PerformanceForesightRepository,
	type StrategyKpiObservationRecord
} from './performance-foresight-repository';
import { PerformanceForesightValidationError } from './performance-foresight-service';

export type CanonicalObservationInput = {
	kpiPublicId: string;
	sourcePublicId: string;
	forecastValue?: string | number | null;
	commentary?: string | null;
};

export type CanonicalObservationResult = {
	observation: StrategyKpiObservationRecord;
	source: CanonicalKpiSourceResolution;
};

function optionalText(value: string | null | undefined, maximum: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > maximum)
		throw new PerformanceForesightValidationError(`Text must not exceed ${maximum} characters.`);
	return normalized;
}

function optionalDecimal(value: string | number | null | undefined, label: string): string | null {
	if (value === null || value === undefined || value === '') return null;
	const normalized = typeof value === 'number' ? String(value) : value.trim();
	if (!normalized || !Number.isFinite(Number(normalized)))
		throw new PerformanceForesightValidationError(`${label} must be a finite number.`);
	return normalized;
}

function sameDecimalValue(left: string, right: string): boolean {
	const leftNumber = Number(left);
	const rightNumber = Number(right);
	return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber;
}

export class CanonicalPerformanceObservationService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async requireManage(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		const decision = await new PermissionService(this.db).decide(actor, 'strategy.manage');
		if (!decision.allowed)
			throw new TenantAccessError('Canonical strategy observation is not permitted.');
	}

	async record(
		actor: TenantActorContext,
		input: CanonicalObservationInput
	): Promise<CanonicalObservationResult> {
		await this.requireManage(actor);
		const repository = new PerformanceForesightRepository(this.db);
		const kpi = await repository.findKpiByPublicId(actor.organisationId, input.kpiPublicId.trim());
		if (!kpi || kpi.lifecycle_status !== 'approved')
			throw new RecordNotFoundError('Approved strategy KPI not found.');
		if (kpi.source_mode !== 'canonical')
			throw new PerformanceForesightValidationError(
				'Only canonical KPIs can be refreshed from an authoritative source.'
			);
		if (!kpi.source_domain || !kpi.source_record_type || !kpi.source_measure_key)
			throw new PerformanceForesightValidationError(
				'Canonical KPI definition is missing source metadata.'
			);

		let source: CanonicalKpiSourceResolution;
		try {
			source = await new CanonicalKpiSourceService(this.db).resolve(actor, {
				sourceDomain: kpi.source_domain,
				sourceRecordType: kpi.source_record_type,
				sourcePublicId: input.sourcePublicId,
				sourceMeasureKey: kpi.source_measure_key
			});
		} catch (error) {
			if (error instanceof CanonicalKpiSourceValidationError)
				throw new PerformanceForesightValidationError(error.message);
			throw error;
		}

		return this.db.transaction().execute(async (trx) => {
			const txRepository = new PerformanceForesightRepository(trx);
			const latestKpi = await txRepository.findKpiByPublicId(actor.organisationId, kpi.public_id);
			if (!latestKpi || latestKpi.lifecycle_status !== 'approved')
				throw new PerformanceForesightValidationError(
					'KPI changed while canonical evidence was being resolved; refresh again.'
				);

			const existing = (await txRepository.listObservationsForKpi(latestKpi.id)).find(
				(row) =>
					row.source_mode === 'canonical' &&
					row.source_domain === source.sourceDomain &&
					row.source_record_type === source.sourceRecordType &&
					row.source_public_id === source.sourcePublicId &&
					row.source_measure_key === source.sourceMeasureKey &&
					sameDecimalValue(row.actual_value, source.value)
			);
			if (existing) return { observation: existing, source };

			const observation = await txRepository.insertObservation({
				organisation_id: actor.organisationId,
				strategy_kpi_id: latestKpi.id,
				public_id: this.publicIdFactory(),
				observed_on: source.observedOn,
				actual_value: source.value,
				forecast_value: optionalDecimal(input.forecastValue, 'Forecast value'),
				commentary: optionalText(input.commentary, 20_000),
				source_mode: 'canonical',
				source_domain: source.sourceDomain,
				source_record_type: source.sourceRecordType,
				source_public_id: source.sourcePublicId,
				source_measure_key: source.sourceMeasureKey,
				created_by_member_id: actor.memberId
			});

			const changeSummary = {
				kpiPublicId: latestKpi.public_id,
				actualValue: observation.actual_value,
				forecastValue: observation.forecast_value,
				sourceDomain: source.sourceDomain,
				sourceRecordType: source.sourceRecordType,
				sourcePublicId: source.sourcePublicId,
				sourceMeasureKey: source.sourceMeasureKey,
				sourceHref: source.sourceHref
			};
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'strategy.kpi.observe.canonical',
				subjectType: 'strategy_kpi_observation',
				subjectPublicId: observation.public_id,
				correlationId: actor.correlationId,
				changeSummary,
				eventMetadata: { function: 'F01', subfunctions: ['F01.06', 'F01.07'] }
			});
			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'strategy.kpi.observe.canonical',
				aggregateType: 'strategy_kpi_observation',
				aggregatePublicId: observation.public_id,
				correlationId: actor.correlationId,
				payload: {
					...changeSummary,
					function: 'F01',
					subfunctions: ['F01.06', 'F01.07']
				}
			});
			return { observation, source };
		});
	}
}
