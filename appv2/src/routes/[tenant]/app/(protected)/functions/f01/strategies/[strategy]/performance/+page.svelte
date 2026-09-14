<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		Field,
		LinkButton,
		PageHeader,
		Panel,
		Stat,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const approvedKpis = $derived(data.kpis.filter((kpi) => kpi.lifecycleStatus === 'approved'));
	const observedKpis = $derived(data.kpis.filter((kpi) => kpi.latestActualValue !== null));
	const linkedKpis = $derived(data.kpis.filter((kpi) => kpi.linkedInitiativeCount > 0));
	const canCreate = $derived(
		data.permissions.canManage && data.framework.lifecycleStatus === 'approved'
	);

	function statusTone(status: string): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
		if (status === 'approved') return 'success';
		if (status === 'draft') return 'warning';
		if (status === 'retired' || status === 'superseded') return 'neutral';
		return 'info';
	}
</script>

<svelte:head>
	<title>Performance · {data.framework.title} · NuBlox</title>
	<meta
		name="description"
		content="F01.06 Goal & KPI Management — governed KPI definitions, targets, actual observations and strategic outcome traceability."
	/>
</svelte:head>

{#snippet headerActions()}
	{#if canCreate}
		<LinkButton
			href={routes.strategyPerformanceNew(data.tenant.slug, data.framework.publicId, 'kpi')}
			>Add KPI</LinkButton
		>
	{/if}
{/snippet}

<div class="nb-page-wide performance-page">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: data.framework.title,
				href: routes.strategyFramework(data.tenant.slug, data.framework.publicId)
			},
			{ label: 'Performance' }
		]}
	/>

	<PageHeader
		eyebrow="F01.06 · Goal & KPI management"
		title="Measure whether strategy is producing the intended outcome"
		description="KPI definitions are governed records linked to strategic objectives. Initiatives can declare contribution, targets are explicit, and actual observations remain distinguishable from authoritative source-backed actuals that will come from downstream domains."
		actions={headerActions}
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Performance action not completed">{form.formError}</Alert>
	{/if}

	<section class="stat-grid" aria-label="Strategy performance summary">
		<Stat label="KPIs" value={String(data.kpis.length)} detail="Current definitions" />
		<Stat
			label="Approved"
			value={String(approvedKpis.length)}
			detail="Governed measures"
			tone="success"
		/>
		<Stat
			label="Observed"
			value={String(observedKpis.length)}
			detail="Measures with actual evidence"
			tone="info"
		/>
		<Stat
			label="Initiative-linked"
			value={String(linkedKpis.length)}
			detail="Measures with execution contribution"
		/>
	</section>

	<section class="performance-thread" aria-labelledby="performance-thread-title">
		<div>
			<p class="section-kicker">Performance digital thread</p>
			<h2 id="performance-thread-title">
				Objective → initiative contribution → KPI → target → actual
			</h2>
			<p>
				NuBlox keeps the definition, target and observation lineage explicit. Manual observations
				are allowed as attributable evidence, while canonical source integration remains visibly
				distinct.
			</p>
		</div>
		<div class="thread-actions">
			<LinkButton
				href={routes.strategyBusinessPlanning(data.tenant.slug, data.framework.publicId)}
				variant="secondary">Review F01.04 execution</LinkButton
			>
			<LinkButton href={routes.strategyReview(data.tenant.slug, data.framework.publicId)}
				>Continue to F01.07 review</LinkButton
			>
		</div>
	</section>

	{#if data.kpis.length > 0}
		<section class="kpi-list" aria-label="Strategy KPIs">
			{#each data.kpis as kpi (kpi.publicId)}
				<article>
					<div class="kpi-heading">
						<div>
							<span class="record-code">{kpi.code} · {kpi.objectiveCode}</span>
							<h2>{kpi.title}</h2>
							<p>{kpi.objectiveTitle}</p>
						</div>
						<StatusBadge label={kpi.lifecycleStatus} tone={statusTone(kpi.lifecycleStatus)} />
					</div>

					<div class="measure-grid">
						<div><span>Baseline</span><strong>{kpi.baselineValue} {kpi.unitLabel}</strong></div>
						<div><span>Target</span><strong>{kpi.targetValue} {kpi.unitLabel}</strong></div>
						<div><span>Target date</span><strong>{kpi.targetDate ?? 'Not set'}</strong></div>
						<div>
							<span>Initiatives</span><strong>{kpi.linkedInitiativeCount} contributing</strong>
						</div>
						<div class="actual">
							<span>Latest actual</span>
							<strong
								>{kpi.latestActualValue ?? 'No observation'}{kpi.latestActualValue !== null
									? ` ${kpi.unitLabel}`
									: ''}</strong
							>
							<small>{kpi.latestObservedOn ?? 'No evidence date'}</small>
						</div>
					</div>

					{#if kpi.lifecycleStatus === 'draft' && data.permissions.canApprove}
						<form method="POST" action="?/approveKpi" use:enhance class="approval-row">
							<input type="hidden" name="kpiPublicId" value={kpi.publicId} />
							<div>
								<strong>Govern KPI definition</strong>
								<p>
									Submit this definition for approval before actual performance can be recorded
									against it.
								</p>
							</div>
							<Button type="submit" variant="secondary" size="sm">Submit KPI for approval</Button>
						</form>
					{/if}

					{#if kpi.lifecycleStatus === 'approved' && data.permissions.canManage}
						<form method="POST" action="?/observe" use:enhance class="observation-form">
							<input type="hidden" name="kpiPublicId" value={kpi.publicId} />
							<div class="observation-heading">
								<div>
									<strong>Record manual observation</strong>
									<p>
										This is attributable F01 evidence, not a substitute for a canonical downstream
										actual.
									</p>
								</div>
								<StatusBadge label="Manual source" tone="neutral" />
							</div>
							<div class="form-grid three">
								<Field
									id={`observedOn-${kpi.publicId}`}
									label="Observed on"
									hint={`Must fall within the strategy horizon ${data.framework.horizonStart} to ${data.framework.horizonEnd}.`}
									required
								>
									<input
										class="nb-control"
										id={`observedOn-${kpi.publicId}`}
										name="observedOn"
										type="date"
										min={data.framework.horizonStart}
										max={data.framework.horizonEnd}
										required
									/>
								</Field>
								<Field
									id={`actualValue-${kpi.publicId}`}
									label={`Actual (${kpi.unitLabel})`}
									required
								>
									<input
										class="nb-control"
										id={`actualValue-${kpi.publicId}`}
										name="actualValue"
										inputmode="decimal"
										required
									/>
								</Field>
								<Field id={`forecastValue-${kpi.publicId}`} label={`Forecast (${kpi.unitLabel})`}>
									<input
										class="nb-control"
										id={`forecastValue-${kpi.publicId}`}
										name="forecastValue"
										inputmode="decimal"
									/>
								</Field>
							</div>
							<Field id={`commentary-${kpi.publicId}`} label="Commentary">
								<textarea
									class="nb-control"
									id={`commentary-${kpi.publicId}`}
									name="commentary"
									rows="3"></textarea>
							</Field>
							<div class="observation-actions">
								<Button type="submit" size="sm">Record observation</Button>
							</div>
						</form>
					{/if}

					<LinkButton
						href={routes.strategyManage(
							data.tenant.slug,
							data.framework.publicId,
							'kpi',
							kpi.publicId
						)}
						variant="quiet">Manage / lifecycle</LinkButton
					>
				</article>
			{/each}
		</section>
	{:else}
		<Panel
			title="No strategic KPIs yet"
			description="Create a KPI only when an approved strategy has active objectives. Link delivery initiatives where their contribution to the outcome should be visible."
		>
			{#if canCreate}
				<LinkButton
					href={routes.strategyPerformanceNew(data.tenant.slug, data.framework.publicId, 'kpi')}
					>Create first KPI</LinkButton
				>
			{/if}
		</Panel>
	{/if}

	<Alert tone="info" title="Canonical actuals are the target state">
		Manual observations are an explicit interim evidence mode. As F14 Finance, F15 Human Capital,
		F27 Portfolio/Programme/Project Management and other domains mature, KPI actuals should resolve
		from their authoritative records with drill-through rather than being re-keyed into Strategy.
	</Alert>
</div>

<style>
	.performance-page,
	.kpi-list {
		display: grid;
		gap: var(--nb-space-8);
		padding-bottom: var(--nb-space-16);
	}
	.kpi-list {
		padding-bottom: 0;
	}
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-5);
	}
	.performance-thread {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.6fr);
		gap: var(--nb-space-8);
		align-items: center;
		padding: var(--nb-space-6);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.section-kicker,
	.record-code {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.performance-thread h2 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-xl);
	}
	.performance-thread p:not(.section-kicker),
	.kpi-heading p,
	.approval-row p,
	.observation-heading p {
		margin: var(--nb-space-2) 0 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.thread-actions {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: var(--nb-space-3);
	}
	.kpi-list article {
		padding: var(--nb-space-6);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.kpi-heading,
	.approval-row,
	.observation-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-5);
	}
	.kpi-heading h2 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-lg);
	}
	.measure-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: var(--nb-space-4);
		margin-top: var(--nb-space-6);
		padding-top: var(--nb-space-5);
		border-top: 1px solid var(--nb-color-border-default);
	}
	.measure-grid div {
		display: grid;
		gap: var(--nb-space-1);
	}
	.measure-grid span,
	.measure-grid small {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}
	.measure-grid .actual {
		padding-left: var(--nb-space-4);
		border-left: 2px solid var(--nb-color-action-primary);
	}
	.approval-row,
	.observation-form {
		margin-top: var(--nb-space-6);
		padding: var(--nb-space-4);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}
	.observation-form {
		display: grid;
		gap: var(--nb-space-4);
	}
	.form-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}
	.observation-actions {
		display: flex;
		justify-content: flex-end;
	}
	@media (max-width: 980px) {
		.stat-grid,
		.measure-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.performance-thread,
		.form-grid {
			grid-template-columns: 1fr;
		}
		.thread-actions {
			justify-content: flex-start;
		}
	}
	@media (max-width: 640px) {
		.stat-grid,
		.measure-grid {
			grid-template-columns: 1fr;
		}
		.kpi-heading,
		.approval-row,
		.observation-heading {
			flex-direction: column;
		}
	}
</style>
