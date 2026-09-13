<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		LinkButton,
		PageHeader,
		Panel,
		Stat,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const editable = $derived(
		data.permissions.canManage && data.framework.lifecycleStatus === 'draft'
	);
	const proposedOptions = $derived(
		data.options.filter((option) => option.decisionStatus === 'proposed')
	);
	const selectedOptions = $derived(
		data.options.filter((option) => option.decisionStatus === 'selected')
	);
	const rejectedOptions = $derived(
		data.options.filter((option) => option.decisionStatus === 'rejected')
	);
	const traceableObjectives = $derived(
		data.objectives.filter((objective) => objective.optionCount > 0 && objective.themeCount > 0)
	);

	function statusTone(
		status: 'proposed' | 'selected' | 'rejected'
	): 'neutral' | 'success' | 'danger' {
		if (status === 'selected') return 'success';
		if (status === 'rejected') return 'danger';
		return 'neutral';
	}
</script>

<svelte:head>
	<title>Strategic planning · {data.framework.title} · NuBlox</title>
	<meta
		name="description"
		content="F01.03 Strategic Planning — evidence-led strategic options, decisions, themes and traceable objectives."
	/>
</svelte:head>

{#snippet headerActions()}
	{#if editable}
		<LinkButton
			href={routes.strategyPlanningNew(data.tenant.slug, data.framework.publicId, 'option')}
			variant="secondary">Add option</LinkButton
		>
		<LinkButton
			href={routes.strategyPlanningNew(data.tenant.slug, data.framework.publicId, 'objective')}
			>Add objective</LinkButton
		>
	{/if}
{/snippet}

<div class="nb-page-wide planning-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(data.tenant.slug) },
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: data.framework.title,
				href: routes.strategyFramework(data.tenant.slug, data.framework.publicId)
			},
			{ label: 'Strategic planning' }
		]}
	/>

	<PageHeader
		eyebrow="F01.03 · Strategic planning"
		title="Make the choice visible, then turn it into accountable outcomes"
		description="Strategic options must trace to environmental factors or assumptions. Selected and rejected alternatives retain rationale. Themes organise the direction and objectives inherit that decision lineage."
		actions={headerActions}
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Decision not recorded">{form.formError}</Alert>
	{/if}

	<section class="stat-grid" aria-label="Strategic planning summary">
		<Stat
			label="Options proposed"
			value={String(proposedOptions.length)}
			detail="Awaiting decision"
			tone="info"
		/>
		<Stat
			label="Options selected"
			value={String(selectedOptions.length)}
			detail="Chosen strategic direction"
		/>
		<Stat label="Strategic themes" value={String(data.themes.length)} detail="Outcome groupings" />
		<Stat
			label="Objectives"
			value={String(data.objectives.length)}
			detail={`${traceableObjectives.length} lineage complete`}
		/>
	</section>

	<section class="decision-thread" aria-labelledby="decision-thread-title">
		<div>
			<p class="section-kicker">Decision lineage</p>
			<h2 id="decision-thread-title">Evidence → choice → theme → objective</h2>
			<p>
				The planning workspace does not allow objectives to appear from nowhere. A new objective
				must derive from at least one selected option and belong to a strategic theme.
			</p>
		</div>
		<div class="lineage-status">
			<div><span>Environmental factors</span><strong>{data.factors.length}</strong></div>
			<div><span>Assumptions</span><strong>{data.assumptions.length}</strong></div>
			<div><span>Selected choices</span><strong>{selectedOptions.length}</strong></div>
			<LinkButton
				href={routes.strategyAnalysis(data.tenant.slug, data.framework.publicId)}
				variant="secondary">Review environmental analysis</LinkButton
			>
		</div>
	</section>

	<section class="workspace-section" aria-labelledby="options-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">Strategic options</p>
				<h2 id="options-title">Alternatives are preserved, including the ones not chosen</h2>
			</div>
			{#if editable}<LinkButton
					href={routes.strategyPlanningNew(data.tenant.slug, data.framework.publicId, 'option')}
					variant="quiet">Add option</LinkButton
				>{/if}
		</div>

		{#if data.options.length > 0}
			<div class="option-list">
				{#each data.options as option (option.publicId)}
					<article class:selected={option.decisionStatus === 'selected'}>
						<div class="option-heading">
							<div>
								<div class="option-kicker">
									<StatusBadge
										label={option.decisionStatus}
										tone={statusTone(option.decisionStatus)}
									/><span>Priority {option.priorityRank ?? '—'}</span>
								</div>
								<h3>{option.title}</h3>
							</div>
							<div class="trace-counts">
								<span>{option.factorCount} factors</span><span
									>{option.assumptionCount} assumptions</span
								><span>{option.objectiveCount} objectives</span>
							</div>
						</div>
						<p>{option.description}</p>
						{#if option.evaluationSummary}<div class="evaluation">
								<strong>Evaluation</strong>
								<p>{option.evaluationSummary}</p>
							</div>{/if}
						{#if option.decisionStatus !== 'proposed'}
							<div class="decision-rationale">
								<strong>Decision rationale</strong>
								<p>{option.decisionRationale ?? 'No rationale recorded.'}</p>
							</div>
						{:else if editable}
							<form method="POST" action="?/decide" use:enhance class="decision-form">
								<input type="hidden" name="optionPublicId" value={option.publicId} />
								<label for={`rationale-${option.publicId}`}>Decision rationale</label>
								<textarea
									class="nb-control"
									id={`rationale-${option.publicId}`}
									name="decisionRationale"
									rows="3"
									required
									placeholder="Why is this option being selected or rejected?"></textarea>
								<div class="decision-actions">
									<Button type="submit" name="decisionStatus" value="selected" size="sm"
										>Select option</Button
									>
									<Button
										type="submit"
										name="decisionStatus"
										value="rejected"
										variant="secondary"
										size="sm">Reject option</Button
									>
								</div>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{:else}
			<Panel
				title="No strategic options yet"
				description="Create an option only after environmental factors or assumptions exist, so the choice has visible drivers."
			>
				{#if editable && (data.factors.length > 0 || data.assumptions.length > 0)}<LinkButton
						href={routes.strategyPlanningNew(data.tenant.slug, data.framework.publicId, 'option')}
						>Add first option</LinkButton
					>{/if}
			</Panel>
		{/if}
	</section>

	<section class="workspace-section" aria-labelledby="themes-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">Strategic themes</p>
				<h2 id="themes-title">
					Organise the strategy around a small number of enterprise outcomes
				</h2>
			</div>
			{#if editable}<LinkButton
					href={routes.strategyPlanningNew(data.tenant.slug, data.framework.publicId, 'theme')}
					variant="quiet">Add theme</LinkButton
				>{/if}
		</div>
		{#if data.themes.length > 0}
			<div class="theme-grid">
				{#each data.themes as theme (theme.publicId)}
					<article>
						<span>{theme.code}</span>
						<h3>{theme.title}</h3>
						<p>{theme.description}</p>
						<strong>{theme.objectiveCount} linked objectives</strong>
					</article>
				{/each}
			</div>
		{:else}
			<Panel
				title="No strategic themes yet"
				description="Themes provide the stable outcome structure against which objectives are organised."
			>
				{#if editable}<LinkButton
						href={routes.strategyPlanningNew(data.tenant.slug, data.framework.publicId, 'theme')}
						>Add first theme</LinkButton
					>{/if}
			</Panel>
		{/if}
	</section>

	<section class="workspace-section" aria-labelledby="objectives-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">Strategic objectives</p>
				<h2 id="objectives-title">Accountable outcomes with explicit strategic lineage</h2>
			</div>
			{#if editable}<LinkButton
					href={routes.strategyPlanningNew(data.tenant.slug, data.framework.publicId, 'objective')}
					variant="quiet">Add objective</LinkButton
				>{/if}
		</div>
		{#if data.objectives.length > 0}
			<div class="objective-list">
				{#each data.objectives as objective (objective.publicId)}
					<article>
						<div class="objective-identity">
							<span>{objective.code}</span>
							<div>
								<h3>{objective.title}</h3>
								<p>{objective.description}</p>
							</div>
						</div>
						<div class="objective-meta">
							<span>Lifecycle <strong>{objective.lifecycleStatus}</strong></span>
							<span>Priority <strong>{objective.priorityRank}</strong></span>
							<span>Target <strong>{objective.targetDate ?? 'Not set'}</strong></span>
							<span>Parent <strong>{objective.parentCode ?? 'Enterprise'}</strong></span>
							<span
								>Lineage <strong
									>{objective.optionCount} choices · {objective.themeCount} themes</strong
								></span
							>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<Panel
				title="No strategic objectives yet"
				description="Objectives can be created once at least one option has been explicitly selected and a strategic theme exists."
			>
				{#if editable && selectedOptions.length > 0 && data.themes.length > 0}<LinkButton
						href={routes.strategyPlanningNew(
							data.tenant.slug,
							data.framework.publicId,
							'objective'
						)}>Add first objective</LinkButton
					>{/if}
			</Panel>
		{/if}
	</section>

	{#if rejectedOptions.length > 0}
		<Panel
			title="Rejected alternatives remain part of the record"
			description="Rejected options are preserved so future reviews can understand what was considered and why the organisation chose a different path."
		>
			<p class="history-note">
				{rejectedOptions.length} rejected {rejectedOptions.length === 1
					? 'option is'
					: 'options are'} retained in this strategy cycle.
			</p>
		</Panel>
	{/if}
</div>

<style>
	.planning-page {
		display: grid;
		gap: var(--nb-space-8);
		padding-bottom: var(--nb-space-16);
	}
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-5);
	}
	.decision-thread {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
		gap: var(--nb-space-8);
		padding: var(--nb-space-6);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.section-kicker {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.decision-thread h2,
	.section-heading h2 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-xl);
		letter-spacing: -0.025em;
	}
	.decision-thread p {
		margin: var(--nb-space-3) 0 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.lineage-status {
		display: grid;
		gap: var(--nb-space-3);
	}
	.lineage-status > div {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-4);
		padding-bottom: var(--nb-space-3);
		border-bottom: 1px solid var(--nb-color-border-default);
		font-size: var(--nb-font-size-sm);
	}
	.lineage-status span {
		color: var(--nb-color-text-muted);
	}
	.workspace-section {
		display: grid;
		gap: var(--nb-space-5);
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: var(--nb-space-6);
	}
	.option-list,
	.objective-list {
		display: grid;
		border-top: 1px solid var(--nb-color-border-default);
	}
	.option-list article {
		display: grid;
		gap: var(--nb-space-4);
		padding: var(--nb-space-5) 0;
		border-bottom: 1px solid var(--nb-color-border-default);
	}
	.option-list article.selected {
		padding-inline: var(--nb-space-5);
		border: 1px solid var(--nb-color-border-strong);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.option-heading {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-6);
	}
	.option-kicker,
	.trace-counts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-3);
		align-items: center;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}
	.option-list h3,
	.theme-grid h3,
	.objective-list h3 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-md);
	}
	.option-list article > p,
	.evaluation p,
	.decision-rationale p {
		margin: 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.evaluation,
	.decision-rationale {
		display: grid;
		gap: var(--nb-space-2);
	}
	.evaluation strong,
	.decision-rationale strong {
		font-size: var(--nb-font-size-xs);
	}
	.decision-form {
		display: grid;
		gap: var(--nb-space-2);
		max-width: 760px;
		padding: var(--nb-space-4);
		background: var(--nb-color-bg-subtle);
		border-radius: var(--nb-radius-md);
	}
	.decision-form label {
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
	}
	.decision-form textarea {
		resize: vertical;
		line-height: var(--nb-line-relaxed);
	}
	.decision-actions {
		display: flex;
		gap: var(--nb-space-2);
	}
	.theme-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--nb-space-5);
	}
	.theme-grid article {
		display: flex;
		min-height: 210px;
		flex-direction: column;
		padding: var(--nb-space-5);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.theme-grid article > span {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
	}
	.theme-grid p {
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		line-height: var(--nb-line-relaxed);
	}
	.theme-grid strong {
		margin-top: auto;
		font-size: var(--nb-font-size-xs);
	}
	.objective-list article {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--nb-space-8);
		padding: var(--nb-space-5) 0;
		border-bottom: 1px solid var(--nb-color-border-default);
	}
	.objective-identity {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr);
		gap: var(--nb-space-4);
	}
	.objective-identity > span {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
	}
	.objective-list p {
		margin: var(--nb-space-2) 0 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.objective-meta {
		display: grid;
		gap: var(--nb-space-2);
		min-width: 220px;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}
	.objective-meta span {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-4);
	}
	.objective-meta strong {
		color: var(--nb-color-text-primary);
		text-align: right;
	}
	.history-note {
		margin: 0;
		color: var(--nb-color-text-secondary);
	}
	@media (max-width: 950px) {
		.stat-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.decision-thread {
			grid-template-columns: 1fr;
		}
		.theme-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 700px) {
		.stat-grid,
		.theme-grid {
			grid-template-columns: 1fr;
		}
		.section-heading,
		.option-heading {
			align-items: start;
			flex-direction: column;
		}
		.objective-list article {
			grid-template-columns: 1fr;
		}
		.objective-identity {
			grid-template-columns: 1fr;
		}
		.decision-actions {
			flex-wrap: wrap;
		}
	}
</style>
