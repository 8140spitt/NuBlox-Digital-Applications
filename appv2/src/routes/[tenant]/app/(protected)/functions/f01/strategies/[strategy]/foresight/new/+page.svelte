<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Breadcrumbs, Button, Field, LinkButton, PageHeader, Panel } from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const submitted = $derived((form?.values ?? {}) as Record<string, string>);
	function value(name: string, fallback = ''): string {
		return submitted[name] ?? fallback;
	}
</script>

<svelte:head><title>Create strategic scenario · NuBlox</title></svelte:head>

<div class="nb-page-form">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{ label: data.workspace.framework.title, href: routes.strategyFramework(data.tenant.slug, data.workspace.framework.publicId) },
			{ label: 'Scenario & foresight', href: routes.strategyForesight(data.tenant.slug, data.workspace.framework.publicId) },
			{ label: 'Create scenario' }
		]}
	/>
	<PageHeader
		eyebrow="F01.08 · Scenario & foresight"
		title="Create an alternative future"
		description="Define the future you want to test. The scenario becomes decision-grade only after you add explicit changed assumptions and project at least one approved strategic KPI."
	/>

	{#if form?.formError}<Alert tone="danger" title="Scenario not created">{form.formError}</Alert>{/if}

	<Panel title="Scenario definition" description="Use one stable scenario code for a lineage. Controlled revisions increment the version while preserving approved history.">
		<form method="POST" use:enhance class="scenario-form">
			<div class="two-column">
				<Field id="scenarioCode" label="Scenario code" hint="For example SCN-DOWN-01" required>
					<input class="nb-control" id="scenarioCode" name="scenarioCode" value={value('scenarioCode')} required />
				</Field>
				<Field id="scenarioType" label="Scenario type" required>
					<select class="nb-control" id="scenarioType" name="scenarioType" required value={value('scenarioType', 'baseline')}>
						<option value="baseline">Baseline</option>
						<option value="upside">Upside</option>
						<option value="downside">Downside</option>
						<option value="stress">Stress</option>
						<option value="custom">Custom</option>
					</select>
				</Field>
			</div>
			<Field id="title" label="Scenario title" required>
				<input class="nb-control" id="title" name="title" value={value('title')} required />
			</Field>
			<div class="two-column">
				<Field id="horizonStart" label="Horizon start" required>
					<input class="nb-control" id="horizonStart" name="horizonStart" type="date" min={data.workspace.framework.horizonStart} max={data.workspace.framework.horizonEnd} value={value('horizonStart', data.workspace.framework.horizonStart)} required />
				</Field>
				<Field id="horizonEnd" label="Horizon end" required>
					<input class="nb-control" id="horizonEnd" name="horizonEnd" type="date" min={data.workspace.framework.horizonStart} max={data.workspace.framework.horizonEnd} value={value('horizonEnd', data.workspace.framework.horizonEnd)} required />
				</Field>
			</div>
			<Field id="narrative" label="Scenario narrative" hint="Describe the coherent future state, not just a list of risks." required>
				<textarea class="nb-control" id="narrative" name="narrative" rows="7" required>{value('narrative')}</textarea>
			</Field>
			<div class="form-actions">
				<Button type="submit">Create scenario</Button>
				<LinkButton href={routes.strategyForesight(data.tenant.slug, data.workspace.framework.publicId)} variant="secondary">Cancel</LinkButton>
			</div>
		</form>
	</Panel>
</div>

<style>
	.scenario-form { display: grid; gap: var(--nb-space-5); }
	.two-column { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--nb-space-4); }
	.form-actions { display: flex; justify-content: flex-end; gap: var(--nb-space-3); }
	@media (max-width: 700px) { .two-column { grid-template-columns: 1fr; } }
</style>
