<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		secondary?: Snippet;
	};

	let { children, secondary }: Props = $props();
</script>

<div class="action-bar">
	<div class="primary">{@render children()}</div>
	{#if secondary}<div class="secondary">{@render secondary()}</div>{/if}
</div>

<style>
	.action-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-4);
		min-height: 58px;
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		padding: var(--nb-space-2) var(--nb-space-3);
		background: var(--nb-color-bg-surface);
		box-shadow: var(--nb-shadow-sm);
	}
	.primary,
	.secondary {
		display: flex;
		align-items: center;
		gap: var(--nb-space-2);
		min-width: 0;
	}
	.secondary {
		justify-content: flex-end;
	}
	@media (max-width: 640px) {
		.action-bar {
			align-items: stretch;
			flex-direction: column;
		}
		.primary,
		.secondary {
			flex-wrap: wrap;
		}
	}
</style>
