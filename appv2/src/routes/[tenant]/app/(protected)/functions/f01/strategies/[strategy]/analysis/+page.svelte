<script lang="ts">
	import {
		Breadcrumbs,
		LinkButton,
		PageHeader,
		Panel,
		Stat,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data } = $props();
	const editable = $derived(
		data.permissions.canManage && data.framework.lifecycleStatus === 'draft'
	);
	const materialFactors = $derived(
		data.factors.filter(
			(factor) => (factor.impactScore ?? 0) >= 4 && (factor.likelihoodScore ?? 0) >= 3
		)
	);
	const unsupportedFactors = $derived(data.factors.filter((factor) => factor.evidenceCount === 0));
	const untestedAssumptions = $derived(
		data.assumptions.filter((assumption) => assumption.validationStatus === 'unvalidated')
	);

	function titleCase(value: string): string {
		return value
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}
</script>

<svelte:head>
	<title>Environmental analysis · {data.framework.title} · NuBlox</title>
	<meta
		name="description"
		content="F01.02 Environmental Analysis — structured evidence, environmental factors, implications and strategic assumptions."
	/>
</svelte:head>

{#snippet headerActions()}
	{#if editable}
		<LinkButton
			href={routes.strategyAnalysisNew(data.tenant.slug, data.framework.publicId, 'evidence')}
			variant="secondary">Add evidence</LinkButton
		>
		<LinkButton
			href={routes.strategyAnalysisNew(data.tenant.slug, data.framework.publicId, 'factor')}
			>Add factor</LinkButton
		>
	{/if}
{/snippet}

<div class="nb-page-wide analysis-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(data.tenant.slug) },
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: data.framework.title,
				href: routes.strategyFramework(data.tenant.slug, data.framework.publicId)
			},
			{ label: 'Environmental analysis' }
		]}
	/>

	<PageHeader
		eyebrow="F01.02 · Environmental analysis"
		title="Build strategy from evidence, not intuition alone"
		description="Capture authoritative evidence, convert it into material internal and external factors, state the strategic implication explicitly, and keep assumptions visible for challenge and review."
		actions={headerActions}
	/>

	<section class="stat-grid" aria-label="Environmental analysis summary">
		<Stat
			label="Evidence items"
			value={String(data.evidence.length)}
			detail="Structured sources"
			tone="info"
		/>
		<Stat
			label="Active factors"
			value={String(data.factors.length)}
			detail="Evidence-led observations"
		/>
		<Stat
			label="Material factors"
			value={String(materialFactors.length)}
			detail="Impact ≥4 · likelihood ≥3"
		/>
		<Stat
			label="Open assumptions"
			value={String(untestedAssumptions.length)}
			detail="Awaiting validation"
		/>
	</section>

	<section class="thread" aria-labelledby="thread-title">
		<div>
			<p class="section-kicker">Evidence-to-choice control</p>
			<h2 id="thread-title">Nothing should become a strategic option without a visible reason.</h2>
			<p>
				Evidence supports factors. Factors state implications. Assumptions expose what is believed
				but not yet proven. F01.03 then uses those records as explicit strategic-choice drivers.
			</p>
		</div>
		<div class="thread-status">
			<div><span>Unsupported factors</span><strong>{unsupportedFactors.length}</strong></div>
			<div>
				<span>Factors used by options</span><strong
					>{data.factors.filter((factor) => factor.optionCount > 0).length}</strong
				>
			</div>
			<LinkButton
				href={routes.strategyPlanning(data.tenant.slug, data.framework.publicId)}
				variant="secondary">Continue to strategic planning</LinkButton
			>
		</div>
	</section>

	<section class="workspace-section" aria-labelledby="evidence-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">Evidence ledger</p>
				<h2 id="evidence-title">Sources that can be challenged and traced</h2>
			</div>
			{#if editable}
				<LinkButton
					href={routes.strategyAnalysisNew(data.tenant.slug, data.framework.publicId, 'evidence')}
					variant="quiet">Add evidence</LinkButton
				>
			{/if}
		</div>

		{#if data.evidence.length > 0}
			<div class="record-list">
				{#each data.evidence as evidence (evidence.publicId)}
					<article>
						<div class="record-title">
							<div>
								<span class="record-kicker">{titleCase(evidence.evidenceType)}</span>
								<h3>{evidence.title}</h3>
							</div>
							<StatusBadge
								label={`Reliability ${evidence.reliabilityScore ?? '—'}/5`}
								tone={(evidence.reliabilityScore ?? 0) >= 4 ? 'success' : 'neutral'}
							/>
						</div>
						<p>{evidence.summaryText}</p>
						<div class="record-meta">
							<span>{evidence.publisherName ?? evidence.sourceReference ?? 'Source recorded'}</span>
							{#if evidence.observedOn}<span>Observed {evidence.observedOn}</span>{/if}
							<span
								>{evidence.factorCount} linked {evidence.factorCount === 1
									? 'factor'
									: 'factors'}</span
							>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<Panel
				title="No structured evidence yet"
				description="Create the first evidence item before adding an environmental factor."
			>
				{#if editable}<LinkButton
						href={routes.strategyAnalysisNew(data.tenant.slug, data.framework.publicId, 'evidence')}
						>Add first evidence item</LinkButton
					>{/if}
			</Panel>
		{/if}
	</section>

	<section class="workspace-section" aria-labelledby="factor-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">Environmental factors</p>
				<h2 id="factor-title">Observation → analysis → implication</h2>
			</div>
			{#if editable}
				<LinkButton
					href={routes.strategyAnalysisNew(data.tenant.slug, data.framework.publicId, 'factor')}
					variant="quiet">Add factor</LinkButton
				>
			{/if}
		</div>

		{#if data.factors.length > 0}
			<div class="factor-grid">
				{#each data.factors as factor (factor.publicId)}
					<article>
						<div class="factor-heading">
							<div class="factor-labels">
								<span>{factor.contextScope}</span><span>{factor.dimension}</span><span
									>{factor.direction}</span
								>
							</div>
							<strong>{factor.impactScore ?? '—'} × {factor.likelihoodScore ?? '—'}</strong>
						</div>
						<h3>{factor.title}</h3>
						<div class="factor-copy">
							<div>
								<span>Analysis</span>
								<p>{factor.analysisText}</p>
							</div>
							<div>
								<span>Strategic implication</span>
								<p>{factor.implicationText ?? 'Not stated'}</p>
							</div>
						</div>
						<div class="record-meta">
							<span>{factor.evidenceCount} evidence links</span>
							<span>{factor.optionCount} strategic option links</span>
							<span>Confidence {factor.confidenceScore ?? '—'}/5</span>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<Panel
				title="No environmental factors yet"
				description="Factors are created from evidence and must state the implication for strategy."
			>
				{#if editable && data.evidence.length > 0}<LinkButton
						href={routes.strategyAnalysisNew(data.tenant.slug, data.framework.publicId, 'factor')}
						>Add first factor</LinkButton
					>{/if}
			</Panel>
		{/if}
	</section>

	<section class="workspace-section" aria-labelledby="assumption-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">Assumption register</p>
				<h2 id="assumption-title">Make uncertainty explicit before it drives a choice</h2>
			</div>
			{#if editable}
				<LinkButton
					href={routes.strategyAnalysisNew(data.tenant.slug, data.framework.publicId, 'assumption')}
					variant="quiet">Add assumption</LinkButton
				>
			{/if}
		</div>

		{#if data.assumptions.length > 0}
			<div class="assumption-list">
				{#each data.assumptions as assumption (assumption.publicId)}
					<article>
						<div>
							<StatusBadge
								label={titleCase(assumption.validationStatus)}
								tone={assumption.validationStatus === 'validated'
									? 'success'
									: assumption.validationStatus === 'invalidated'
										? 'danger'
										: 'warning'}
							/>
							<p>{assumption.statementText}</p>
							{#if assumption.rationaleText}<small>{assumption.rationaleText}</small>{/if}
						</div>
						<div class="assumption-meta">
							<span>Confidence <strong>{assumption.confidenceScore ?? '—'}/5</strong></span>
							<span>Review <strong>{assumption.reviewBy ?? 'Not set'}</strong></span>
							<span>Options <strong>{assumption.optionCount}</strong></span>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<Panel
				title="No assumptions recorded"
				description="Use assumptions for material beliefs that affect a strategic choice but are not yet established facts."
			>
				{#if editable}<LinkButton
						href={routes.strategyAnalysisNew(
							data.tenant.slug,
							data.framework.publicId,
							'assumption'
						)}>Add first assumption</LinkButton
					>{/if}
			</Panel>
		{/if}
	</section>
</div>

<style>
	.analysis-page {
		display: grid;
		gap: var(--nb-space-8);
		padding-bottom: var(--nb-space-16);
	}
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-5);
	}
	.thread {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
		gap: var(--nb-space-8);
		align-items: start;
		padding: var(--nb-space-6);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.thread h2,
	.section-heading h2 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-xl);
		letter-spacing: -0.025em;
	}
	.thread p {
		margin: var(--nb-space-3) 0 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.thread-status {
		display: grid;
		gap: var(--nb-space-3);
	}
	.thread-status > div {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-4);
		padding-bottom: var(--nb-space-3);
		border-bottom: 1px solid var(--nb-color-border-default);
		font-size: var(--nb-font-size-sm);
	}
	.thread-status span {
		color: var(--nb-color-text-muted);
	}
	.workspace-section {
		display: grid;
		gap: var(--nb-space-5);
	}
	.section-kicker,
	.record-kicker {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--nb-space-6);
	}
	.record-list,
	.assumption-list {
		display: grid;
		border-top: 1px solid var(--nb-color-border-default);
	}
	.record-list article,
	.assumption-list article {
		padding: var(--nb-space-5) 0;
		border-bottom: 1px solid var(--nb-color-border-default);
	}
	.record-title {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-5);
		align-items: start;
	}
	.record-title h3,
	.factor-grid h3 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-md);
	}
	.record-list article > p {
		margin: var(--nb-space-3) 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.record-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-4);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}
	.factor-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-5);
	}
	.factor-grid article {
		display: grid;
		gap: var(--nb-space-4);
		padding: var(--nb-space-5);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.factor-heading {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-4);
		align-items: center;
	}
	.factor-labels {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
	}
	.factor-labels span {
		padding: 3px 7px;
		border-radius: 999px;
		background: var(--nb-color-bg-subtle);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		text-transform: capitalize;
	}
	.factor-heading > strong {
		font-size: var(--nb-font-size-xs);
	}
	.factor-copy {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}
	.factor-copy span {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
	}
	.factor-copy p {
		margin: var(--nb-space-2) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		line-height: var(--nb-line-relaxed);
	}
	.assumption-list article {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--nb-space-8);
		align-items: start;
	}
	.assumption-list p {
		margin: var(--nb-space-3) 0 var(--nb-space-2);
		line-height: var(--nb-line-relaxed);
	}
	.assumption-list small {
		color: var(--nb-color-text-muted);
		line-height: var(--nb-line-relaxed);
	}
	.assumption-meta {
		display: grid;
		gap: var(--nb-space-2);
		min-width: 180px;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}
	.assumption-meta span {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-4);
	}
	.assumption-meta strong {
		color: var(--nb-color-text-primary);
	}
	@media (max-width: 900px) {
		.stat-grid,
		.factor-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.thread {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 650px) {
		.stat-grid,
		.factor-grid,
		.factor-copy {
			grid-template-columns: 1fr;
		}
		.section-heading,
		.record-title {
			align-items: start;
			flex-direction: column;
		}
		.assumption-list article {
			grid-template-columns: 1fr;
			gap: var(--nb-space-4);
		}
	}
</style>
