<script lang="ts">
	import { resolveInternalPath } from '$lib/routing/resolve-path';

	type BreadcrumbItem = {
		label: string;
		href?: string;
	};

	type Props = {
		items: BreadcrumbItem[];
	};

	let { items }: Props = $props();
</script>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<ol>
		{#each items as item, index (`${item.label}-${index}`)}
			<li>
				{#if item.href && index < items.length - 1}
					<a href={resolveInternalPath(item.href)}>{item.label}</a>
				{:else}
					<span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.breadcrumbs {
		min-width: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}
	ol {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: inline-flex;
		align-items: center;
		gap: var(--nb-space-2);
		min-width: 0;
	}
	li:not(:last-child)::after {
		content: '/';
		color: var(--nb-color-border-strong);
	}
	a {
		color: var(--nb-color-text-secondary);
		text-decoration: none;
	}
	a:hover {
		color: var(--nb-color-text-primary);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	span[aria-current='page'] {
		max-width: 320px;
		overflow: hidden;
		color: var(--nb-color-text-primary);
		font-weight: var(--nb-weight-medium);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
