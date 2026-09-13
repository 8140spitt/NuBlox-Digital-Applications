<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Breadcrumbs, Button, Field, LinkButton, PageHeader, Panel } from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const values = $derived((form?.values ?? {}) as Record<string, string>);

	function fieldValue(key: string, fallback = ''): string {
		return values[key] ?? fallback;
	}
</script>

<svelte:head>
	<title>Define KPI · {data.framework.title} · NuBlox</title>
</svelte:head>

<div class="nb-page-form transaction-page">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: data.framework.title,
				href: routes.strategyFramework(data.tenant.slug, data.framework.publicId)
			},
			{
				label: 'Performance',
				href: routes.strategyPerformance(data.tenant.slug, data.framework.publicId)
			},
			{ label: 'Define KPI' }
		]}
	/>

	<PageHeader
		eyebrow="F01.06 · KPI definition"
		title="Define the measure before recording the result"
		description="A KPI belongs to a strategic objective and can identify initiatives that contribute to it. The definition remains draft until an authorised approver governs the measure."
	/>

	{#if form?.formError}
		<Alert tone="danger" title="KPI not created">{form.formError}</Alert>
	{/if}

	<form method="POST" action="?/create" use:enhance class="transaction-form">
		<Panel title="Outcome measure" description="Define the outcome, unit, direction and strategic ownership context.">
			<div class="form-grid two">
				<Field id="objectivePublicId" label="Strategic objective" required>
					<select class="nb-control" id="objectivePublicId" name="objectivePublicId" required>
						<option value="">Choose objective</option>
						{#each data.objectives as objective (objective.publicId)}
							<option value={objective.publicId}>{objective.code} · {objective.title}</option>
						{/each}
					</select>
				</Field>
				<Field id="title" label="KPI title" required>
					<input class="nb-control" id="title" name="title" value={fieldValue('title')} maxlength="255" required />
				</Field>
				<Field id="unitLabel" label="Unit" hint="Examples: %, GBP, days, incidents, tCO₂e." required>
					<input class="nb-control" id="unitLabel" name="unitLabel" value={fieldValue('unitLabel')} maxlength="64" required />
				</Field>
				<Field id="direction" label="Performance direction" required>
					<select class="nb-control" id="direction" name="direction" required>
						<option value="higher_is_better">Higher is better</option>
						<option value="lower_is_better">Lower is better</option>
						<option value="target_is_best">Target is best</option>
						<option value="band">Acceptable band</option>
					</select>
				</Field>
			</div>
			<Field id="description" label="Measure definition" hint="State precisely what is measured, how it should be interpreted and what business outcome it represents." required>
				<textarea class="nb-control" id="description" name="description" rows="6" required>{fieldValue('description')}</textarea>
			</Field>
		</Panel>

		<Panel title="Baseline and target" description="The target should represent the strategic outcome, not merely an activity count.">
			<div class="form-grid three">
				<Field id="baselineValue" label="Baseline" required>
					<input class="nb-control" id="baselineValue" name="baselineValue" inputmode="decimal" value={fieldValue('baselineValue')} required />
				</Field>
				<Field id="targetValue" label="Target" required>
					<input class="nb-control" id="targetValue" name="targetValue" inputmode="decimal" value={fieldValue('targetValue')} required />
				</Field>
				<Field id="targetDate" label="Target date">
					<input class="nb-control" id="targetDate" name="targetDate" type="date" value={fieldValue('targetDate')} />
				</Field>
			</div>
		</Panel>

		<Panel
			title="Initiative contribution"
			description="Optionally identify strategic initiatives expected to move this KPI. NuBlox validates that selected initiatives contribute to the chosen objective."
		>
			<div class="selection-list">
				{#each data.initiatives as initiative (initiative.publicId)}
					<label class="selection-row">
						<input type="checkbox" name="initiativePublicIds" value={initiative.publicId} />
						<span>
							<strong>{initiative.code} · {initiative.title}</strong>
							<small>{initiative.objectiveCode} · {initiative.objectiveTitle}</small>
						</span>
					</label>
				{:else}
					<p>No initiatives exist yet. A KPI may still measure the objective directly.</p>
				{/each}
			</div>
		</Panel>

		<Alert tone="info" title="Definition and actuals are separate controls">
			Creating this record does not approve it and does not create performance actuals. An authorised
			approver governs the KPI definition first; observations are then recorded against that approved
			definition.
		</Alert>

		<div class="form-actions">
			<LinkButton href={routes.strategyPerformance(data.tenant.slug, data.framework.publicId)} variant="quiet">Cancel</LinkButton>
			<Button type="submit">Create KPI definition</Button>
		</div>
	</form>
</div>

<style>
	.transaction-page,
	.transaction-form,
	.selection-list {
		display: grid;
		gap: var(--nb-space-6);
	}
	.transaction-page {
		padding-bottom: var(--nb-space-16);
	}
	.form-grid {
		display: grid;
		gap: var(--nb-space-5);
	}
	.form-grid.two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.form-grid.three {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.selection-list {
		gap: var(--nb-space-3);
	}
	.selection-row {
		display: flex;
		align-items: flex-start;
		gap: var(--nb-space-3);
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-md);
		cursor: pointer;
	}
	.selection-row span {
		display: grid;
		gap: var(--nb-space-1);
	}
	.selection-row small {
		color: var(--nb-color-text-muted);
	}
	.form-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--nb-space-4);
	}
	@media (max-width: 720px) {
		.form-grid.two,
		.form-grid.three {
			grid-template-columns: 1fr;
		}
	}
</style>
