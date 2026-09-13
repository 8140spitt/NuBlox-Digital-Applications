<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { Tabs } from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { children }: { children: Snippet } = $props();
	const tenant = $derived(page.params.tenant ?? '');
	const strategy = $derived(page.params.strategy ?? '');
	const pathname = $derived(page.url.pathname);
	const overview = $derived(routes.strategyFramework(tenant, strategy));
	const analysis = $derived(routes.strategyAnalysis(tenant, strategy));
	const planning = $derived(routes.strategyPlanning(tenant, strategy));
	const businessPlanning = $derived(routes.strategyBusinessPlanning(tenant, strategy));
	const performance = $derived(routes.strategyPerformance(tenant, strategy));
	const review = $derived(routes.strategyReview(tenant, strategy));
	const tabs = $derived([
		{ label: 'Overview', href: overview, active: pathname === overview },
		{ label: 'F01.02 Environment', href: analysis, active: pathname.startsWith(analysis) },
		{ label: 'F01.03 Strategy', href: planning, active: pathname.startsWith(planning) },
		{
			label: 'F01.04 Business plan',
			href: businessPlanning,
			active: pathname.startsWith(businessPlanning)
		},
		{ label: 'F01.06 Performance', href: performance, active: pathname.startsWith(performance) },
		{ label: 'F01.07 Review', href: review, active: pathname.startsWith(review) }
	]);
</script>

<div class="strategy-context-nav">
	<Tabs items={tabs} label="Strategy cycle workspace" />
</div>

{@render children()}

<style>
	.strategy-context-nav {
		position: sticky;
		top: 0;
		z-index: 8;
		max-width: var(--nb-page-wide, 1440px);
		margin-inline: auto;
		padding: 0 var(--nb-space-6);
		background: color-mix(in srgb, var(--nb-color-bg-canvas) 94%, transparent);
		backdrop-filter: blur(12px);
	}

	@media (max-width: 640px) {
		.strategy-context-nav {
			padding-inline: var(--nb-space-4);
		}
	}
</style>
