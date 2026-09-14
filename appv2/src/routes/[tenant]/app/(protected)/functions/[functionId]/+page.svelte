<script lang="ts">
	import FunctionBlueprint from '$lib/components/enterprise/FunctionBlueprint.svelte';
	import { Breadcrumbs, Panel, Stat } from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';

	let { data } = $props();

	const architectureHref = $derived(appPath(data.tenant.slug, 'organisation/job-architecture'));
</script>

<svelte:head>
	<title>{data.enterpriseFunction.id} {data.enterpriseFunction.name} · NuBlox</title>
	<meta name="description" content={data.enterpriseFunction.purpose} />
</svelte:head>

<div class="nb-page-wide function-workspace-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(data.tenant.slug) },
			{ label: 'Functions', href: routes.functions(data.tenant.slug) },
			{ label: `${data.enterpriseFunction.id} ${data.enterpriseFunction.name}` }
		]}
	/>

	<FunctionBlueprint
		functionSummary={data.enterpriseFunction}
		subfunctions={data.subfunctions}
		objects={data.objects}
		journey={data.journey}
		statusLabel="Capability blueprint"
	/>

	<section class="function-readiness" aria-label="Function readiness">
		<Stat
			label="Sub-functions"
			value={String(data.subfunctions.length)}
			detail="Canonical L2 capability areas"
			tone="info"
		/>
		<Stat
			label="Business objects"
			value={String(data.objects.length)}
			detail="Canonical governed object types"
		/>
		<Stat
			label="Functional roles"
			value={String(data.functionalRoleCount)}
			detail="Job architecture coverage"
		/>
	</section>

	<Panel
		title="Capability map, not a disconnected module"
		description="This page is the business-facing map for the function. Native workspaces, transactions and records will activate within this structure as delivery progresses; the enterprise taxonomy, object model, job architecture and platform controls stay stable underneath it."
	>
		<div class="activation-copy">
			<div>
				<strong>What is already governed</strong>
				<p>
					The function definition, L2 sub-functions, functional roles, canonical business objects,
					starter lifecycle patterns and workflow families are already part of the NuBlox operating
					model.
				</p>
			</div>
			<a href={architectureHref}>Open job architecture</a>
		</div>
	</Panel>
</div>

<style>
	.function-workspace-page {
		display: grid;
		gap: var(--nb-space-6);
	}

	.function-readiness {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}

	.activation-copy {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--nb-space-6);
	}

	.activation-copy strong {
		display: block;
		margin-bottom: var(--nb-space-2);
	}

	.activation-copy p {
		max-width: 780px;
		margin: 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}

	.activation-copy a {
		flex: 0 0 auto;
		color: var(--nb-color-action-primary);
		font-weight: var(--nb-weight-semibold);
		text-decoration: none;
	}

	.activation-copy a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	@media (max-width: 760px) {
		.function-readiness {
			grid-template-columns: 1fr;
		}

		.activation-copy {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
