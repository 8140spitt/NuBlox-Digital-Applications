<script lang="ts">
	import { resolveInternalPath } from '$lib/routing/resolve-path';

	type TabItem = {
		label: string;
		href: string;
		active?: boolean;
		badge?: string;
	};

	type Props = {
		items: TabItem[];
		label?: string;
	};

	let { items, label = 'Section navigation' }: Props = $props();
</script>

<nav class="tabs" aria-label={label}>
	{#each items as item (item.href)}
		<a href={resolveInternalPath(item.href)} class:active={item.active} aria-current={item.active ? 'page' : undefined}>
			<span>{item.label}</span>
			{#if item.badge}<span class="badge">{item.badge}</span>{/if}
		</a>
	{/each}
</nav>

<style>
	.tabs {
		display: flex;
		align-items: center;
		gap: var(--nb-space-1);
		overflow-x: auto;
		border-bottom: 1px solid var(--nb-color-border-default);
	}
	a {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--nb-space-2);
		min-height: 44px;
		padding-inline: var(--nb-space-3);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-medium);
		text-decoration: none;
		white-space: nowrap;
	}
	a:hover {
		color: var(--nb-color-text-primary);
		background: var(--nb-color-bg-subtle);
	}
	a.active {
		color: var(--nb-color-text-primary);
		font-weight: var(--nb-weight-semibold);
	}
	a.active::after {
		position: absolute;
		right: var(--nb-space-3);
		bottom: -1px;
		left: var(--nb-space-3);
		height: 2px;
		background: var(--nb-color-action-primary);
		content: '';
	}
	.badge {
		min-width: 20px;
		border-radius: var(--nb-radius-pill);
		padding: 2px 6px;
		background: var(--nb-neutral-95);
		color: var(--nb-color-text-muted);
		font-size: 0.6875rem;
		text-align: center;
	}
</style>
