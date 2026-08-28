<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ProgressiveActionScope from '$lib/components/ProgressiveActionScope.svelte';

	type RuntimePathResolver = (path: string) => string;

	function requiredProjectPublicId(value: string | undefined): string {
		if (!value) throw new Error('Project financial route is missing its project context.');
		return value;
	}

	let { children } = $props();
	const projectPublicId = $derived(requiredProjectPublicId(page.params.projectPublicId));
	const financialControlHref = $derived(
		(resolve as unknown as RuntimePathResolver)(
			`/projects/${encodeURIComponent(projectPublicId)}/financials`
		)
	);
	const procurementSettlementHref = $derived(
		(resolve as unknown as RuntimePathResolver)(
			`/projects/${encodeURIComponent(projectPublicId)}/financials/settlement`
		)
	);
</script>

<nav class="financial-subnav" aria-label="Project financial workspaces">
	<a href={financialControlHref}>Financial control</a>
	<a href={procurementSettlementHref}>Procurement settlement</a>
</nav>

<ProgressiveActionScope>
	{@render children()}
</ProgressiveActionScope>

<style>
	.financial-subnav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin: 0 0 1rem;
		padding: 0.45rem;
		border: 1px solid var(--color-border, #dbe2ea);
		border-radius: 0.7rem;
		background: var(--color-surface, #fff);
	}

	.financial-subnav a {
		padding: 0.5rem 0.7rem;
		border-radius: 0.5rem;
		color: inherit;
		font-weight: 650;
		text-decoration: none;
	}

	.financial-subnav a:hover,
	.financial-subnav a:focus-visible {
		background: var(--color-surface-subtle, #f1f5f9);
	}
</style>
