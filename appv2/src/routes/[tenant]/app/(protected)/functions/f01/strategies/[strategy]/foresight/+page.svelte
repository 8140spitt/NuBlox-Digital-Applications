<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		Field,
		LinkButton,
		PageHeader,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const workspace = $derived(data.workspace);

	function label(value: string): string {
		return value
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function assumptions(scenarioPublicId: string) {
		return workspace.assumptions.filter((item) => item.scenarioPublicId === scenarioPublicId);
	}

	function projections(scenarioPublicId: string) {
		return workspace.projections.filter((item) => item.scenarioPublicId === scenarioPublicId);
	}

	function delta(baseline: string, scenario: string): string {
		const difference = Number(scenario) - Number(baseline);
		if (!Number.isFinite(difference)) return '—';
		return `${difference >= 0 ? '+' : ''}${difference.toLocaleString()}`;
	}
</script>

<svelte:head>
	<title>Scenario & foresight · {workspace.framework.title} · NuBlox</title>
</svelte:head>

<div class="nb-page-wide foresight-page">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: workspace.framework.title,
				href: routes.strategyFramework(data.tenant.slug, workspace.framework.publicId)
			},
			{ label: 'Scenario & foresight' }
		]}
	/>

	<PageHeader
		eyebrow="F01.08 · Scenario & foresight"
		title="Test the strategy against alternative futures"
		description="Make assumptions explicit, stress strategic KPIs and compare plausible futures before committing to material strategic change. Approved scenarios remain controlled evidence; revisions preserve their history."
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Action not completed">{form.formError}</Alert>
	{/if}

	<section class="foresight-summary" aria-label="Foresight summary">
		<div><span>Scenarios</span><strong>{workspace.scenarios.length}</strong></div>
		<div><span>Assumptions</span><strong>{workspace.assumptions.length}</strong></div>
		<div><span>KPI projections</span><strong>{workspace.projections.length}</strong></div>
		<div><span>Approved KPIs</span><strong>{workspace.kpis.length}</strong></div>
	</section>

	<section class="intro-card">
		<div>
			<p class="section-kicker">Foresight discipline</p>
			<h2>Change the assumptions, then observe the consequences.</h2>
			<p>
				Each scenario captures the changed variables that define the future and projects the
				strategic KPIs affected by those changes. Sensitivity highlights assumptions that warrant
				closer monitoring; approval turns the scenario into governed decision evidence.
			</p>
		</div>
		{#if workspace.permissions.canManage}
			<LinkButton href={routes.strategyForesightNew(data.tenant.slug, workspace.framework.publicId)}
				>Create scenario</LinkButton
			>
		{/if}
	</section>

	{#if workspace.scenarios.length > 0}
		<div class="scenario-list">
			{#each workspace.scenarios as scenario (scenario.publicId)}
				<article class="scenario-card">
					<header>
						<div>
							<p class="scenario-code">
								{scenario.code} · v{scenario.versionNumber} · {label(scenario.scenarioType)}
							</p>
							<h2>{scenario.title}</h2>
							<p>{scenario.horizonStart} → {scenario.horizonEnd}</p>
						</div>
						<StatusBadge
							label={scenario.status === 'draft' ? 'Working scenario' : label(scenario.status)}
							tone={scenario.status === 'approved'
								? 'success'
								: scenario.status === 'superseded'
									? 'neutral'
									: 'warning'}
						/>
					</header>

					<p class="narrative">{scenario.narrative}</p>

					<div class="scenario-data">
						<section>
							<div class="section-heading">
								<h3>Changed assumptions</h3>
								<span>{scenario.assumptionCount}</span>
							</div>
							{#if assumptions(scenario.publicId).length > 0}
								<div class="data-list">
									{#each assumptions(scenario.publicId) as assumption (assumption.publicId)}
										<div class="data-row">
											<div>
												<strong>{assumption.code} · {assumption.title}</strong>
												<small>{assumption.description}</small>
											</div>
											<div class="value-change">
												<span
													>{assumption.baselineValue} → {assumption.scenarioValue}
													{assumption.unitLabel}</span
												>
												<strong>{delta(assumption.baselineValue, assumption.scenarioValue)}</strong>
												{#if assumption.sensitivityPercent}<small
														>Sensitivity {assumption.sensitivityPercent}%</small
													>{/if}
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="empty-copy">No changed assumptions recorded yet.</p>
							{/if}
						</section>

						<section>
							<div class="section-heading">
								<h3>Strategic KPI projections</h3>
								<span>{scenario.projectionCount}</span>
							</div>
							{#if projections(scenario.publicId).length > 0}
								<div class="data-list">
									{#each projections(scenario.publicId) as projection (projection.publicId)}
										<div class="data-row">
											<div>
												<strong>{projection.kpiCode} · {projection.kpiTitle}</strong>
												<small>{projection.projectionDate} · {projection.rationale}</small>
											</div>
											<div class="projection-value">
												{projection.projectedValue}
												{projection.unitLabel}
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="empty-copy">No KPI projections recorded yet.</p>
							{/if}
						</section>
					</div>

					{#if scenario.status === 'draft' && workspace.permissions.canManage}
						<div class="scenario-tools">
							<details>
								<summary>Add changed assumption</summary>
								<form method="POST" action="?/addAssumption" use:enhance>
									<input type="hidden" name="scenarioPublicId" value={scenario.publicId} />
									<div class="two-column">
										<Field
											id={`assumptionCode-${scenario.publicId}`}
											label="Assumption code"
											required
										>
											<input
												class="nb-control"
												id={`assumptionCode-${scenario.publicId}`}
												name="assumptionCode"
												required
											/>
										</Field>
										<Field id={`variable-${scenario.publicId}`} label="Variable key" required>
											<input
												class="nb-control"
												id={`variable-${scenario.publicId}`}
												name="variableKey"
												placeholder="market.growth"
												required
											/>
										</Field>
									</div>
									<Field
										id={`assumptionTitle-${scenario.publicId}`}
										label="Assumption title"
										required
									>
										<input
											class="nb-control"
											id={`assumptionTitle-${scenario.publicId}`}
											name="title"
											required
										/>
									</Field>
									<Field
										id={`assumptionDescription-${scenario.publicId}`}
										label="Description"
										required
									>
										<textarea
											class="nb-control"
											id={`assumptionDescription-${scenario.publicId}`}
											name="description"
											rows="3"
											required></textarea>
									</Field>
									<div class="three-column">
										<Field id={`unit-${scenario.publicId}`} label="Unit" required
											><input
												class="nb-control"
												id={`unit-${scenario.publicId}`}
												name="unitLabel"
												required
											/></Field
										>
										<Field id={`baseline-${scenario.publicId}`} label="Baseline" required
											><input
												class="nb-control"
												id={`baseline-${scenario.publicId}`}
												name="baselineValue"
												type="number"
												step="any"
												required
											/></Field
										>
										<Field id={`scenarioValue-${scenario.publicId}`} label="Scenario value" required
											><input
												class="nb-control"
												id={`scenarioValue-${scenario.publicId}`}
												name="scenarioValue"
												type="number"
												step="any"
												required
											/></Field
										>
									</div>
									<Field
										id={`sensitivity-${scenario.publicId}`}
										label="Sensitivity %"
										hint="Optional"
										><input
											class="nb-control"
											id={`sensitivity-${scenario.publicId}`}
											name="sensitivityPercent"
											type="number"
											min="0"
											step="any"
										/></Field
									>
									<Button type="submit">Add assumption</Button>
								</form>
							</details>

							<details>
								<summary>Add KPI projection</summary>
								<form method="POST" action="?/addProjection" use:enhance>
									<input type="hidden" name="scenarioPublicId" value={scenario.publicId} />
									<Field id={`kpi-${scenario.publicId}`} label="KPI" required>
										<select
											class="nb-control"
											id={`kpi-${scenario.publicId}`}
											name="kpiPublicId"
											required
										>
											<option value="">Select approved KPI</option>
											{#each workspace.kpis as kpi (kpi.publicId)}
												<option value={kpi.publicId}
													>{kpi.code} · {kpi.title} · target {kpi.targetValue}
													{kpi.unitLabel}</option
												>
											{/each}
										</select>
									</Field>
									<div class="two-column">
										<Field
											id={`projectionDate-${scenario.publicId}`}
											label="Projection date"
											required
											><input
												class="nb-control"
												id={`projectionDate-${scenario.publicId}`}
												name="projectionDate"
												type="date"
												min={scenario.horizonStart}
												max={scenario.horizonEnd}
												required
											/></Field
										>
										<Field
											id={`projectedValue-${scenario.publicId}`}
											label="Projected value"
											required
											><input
												class="nb-control"
												id={`projectedValue-${scenario.publicId}`}
												name="projectedValue"
												type="number"
												step="any"
												required
											/></Field
										>
									</div>
									<Field id={`rationale-${scenario.publicId}`} label="Projection rationale" required
										><textarea
											class="nb-control"
											id={`rationale-${scenario.publicId}`}
											name="rationale"
											rows="3"
											required></textarea></Field
									>
									<Button type="submit">Add projection</Button>
								</form>
							</details>
						</div>
					{/if}

					<footer>
						{#if scenario.status === 'draft' && workspace.permissions.canApprove}
							<form method="POST" action="?/approve" use:enhance>
								<input type="hidden" name="scenarioPublicId" value={scenario.publicId} />
								<Button
									type="submit"
									disabled={scenario.assumptionCount === 0 || scenario.projectionCount === 0}
									>Approve scenario</Button
								>
							</form>
						{:else if scenario.status === 'approved' && workspace.permissions.canManage}
							<form method="POST" action="?/revise" use:enhance>
								<input type="hidden" name="scenarioPublicId" value={scenario.publicId} />
								<Button type="submit" variant="secondary">Create controlled revision</Button>
							</form>
						{/if}
					</footer>
				</article>
			{/each}
		</div>
	{:else}
		<section class="empty-state">
			<h2>No strategic scenarios yet.</h2>
			<p>
				Create a baseline, upside, downside, stress or custom scenario to test the approved strategy
				against changed assumptions and measurable KPI consequences.
			</p>
			{#if workspace.permissions.canManage}<LinkButton
					href={routes.strategyForesightNew(data.tenant.slug, workspace.framework.publicId)}
					>Create first scenario</LinkButton
				>{/if}
		</section>
	{/if}
</div>

<style>
	.foresight-page,
	.scenario-list {
		display: grid;
		gap: var(--nb-space-6);
	}
	.foresight-summary {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}
	.foresight-summary div,
	.intro-card,
	.scenario-card,
	.empty-state {
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.foresight-summary div {
		padding: var(--nb-space-5);
	}
	.foresight-summary span {
		display: block;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
	}
	.foresight-summary strong {
		display: block;
		margin-top: var(--nb-space-2);
		font-size: var(--nb-font-size-2xl);
	}
	.intro-card {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--nb-space-8);
		padding: var(--nb-space-6);
	}
	.intro-card h2,
	.scenario-card h2,
	.scenario-card h3,
	.empty-state h2 {
		margin: 0;
	}
	.section-kicker,
	.scenario-code {
		margin: 0 0 var(--nb-space-2);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.scenario-card {
		padding: var(--nb-space-6);
	}
	.scenario-card > header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-5);
	}
	.narrative {
		max-width: 950px;
		line-height: var(--nb-line-relaxed);
		color: var(--nb-color-text-secondary);
	}
	.scenario-data {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-5);
		margin-top: var(--nb-space-5);
	}
	.scenario-data section {
		padding: var(--nb-space-4);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--nb-space-3);
	}
	.section-heading > span {
		font-weight: var(--nb-weight-semibold);
	}
	.data-list {
		display: grid;
		gap: var(--nb-space-3);
		margin-top: var(--nb-space-4);
	}
	.data-row {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-4);
		padding-top: var(--nb-space-3);
		border-top: 1px solid var(--nb-color-border-default);
	}
	.data-row > div:first-child {
		display: grid;
		gap: 4px;
	}
	.data-row small,
	.empty-copy {
		color: var(--nb-color-text-muted);
	}
	.value-change {
		text-align: right;
		display: grid;
		gap: 3px;
		white-space: nowrap;
	}
	.projection-value {
		font-weight: var(--nb-weight-semibold);
		white-space: nowrap;
	}
	.scenario-tools {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-4);
		margin-top: var(--nb-space-5);
	}
	details {
		border-top: 1px solid var(--nb-color-border-default);
		padding-top: var(--nb-space-4);
	}
	summary {
		cursor: pointer;
		font-weight: var(--nb-weight-semibold);
	}
	details form {
		display: grid;
		gap: var(--nb-space-4);
		margin-top: var(--nb-space-4);
	}
	.two-column,
	.three-column {
		display: grid;
		gap: var(--nb-space-4);
	}
	.two-column {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.three-column {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.scenario-card footer {
		display: flex;
		justify-content: flex-end;
		margin-top: var(--nb-space-5);
	}
	.empty-state {
		padding: var(--nb-space-8);
	}
	@media (max-width: 850px) {
		.foresight-summary,
		.scenario-data,
		.scenario-tools,
		.two-column,
		.three-column {
			grid-template-columns: 1fr;
		}
		.intro-card,
		.scenario-card > header,
		.data-row {
			align-items: flex-start;
			flex-direction: column;
		}
		.value-change {
			text-align: left;
		}
	}
</style>
