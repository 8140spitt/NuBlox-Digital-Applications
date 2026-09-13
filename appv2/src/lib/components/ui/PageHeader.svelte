<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		eyebrow?: string;
		title: string;
		description?: string;
		actions?: Snippet;
		meta?: Snippet;
	};

	let { eyebrow, title, description, actions, meta }: Props = $props();
</script>

<header class="page-header">
	<div class="copy">
		{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
		<h1>{title}</h1>
		{#if description}<p class="description">{description}</p>{/if}
		{#if meta}<div class="meta">{@render meta()}</div>{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-8);
		padding-block: var(--nb-space-8) var(--nb-space-6);
	}
	.copy {
		min-width: 0;
		max-width: 820px;
	}
	.eyebrow {
		margin: 0 0 var(--nb-space-2);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-size: var(--nb-font-size-3xl);
		line-height: var(--nb-line-tight);
		letter-spacing: -0.04em;
	}
	.description {
		max-width: 760px;
		margin: var(--nb-space-3) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-lg);
		line-height: var(--nb-line-relaxed);
	}
	.meta {
		margin-top: var(--nb-space-4);
	}
	.actions {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: var(--nb-space-2);
		padding-top: var(--nb-space-1);
	}
	@media (max-width: 760px) {
		.page-header {
			flex-direction: column;
			gap: var(--nb-space-4);
		}
		.actions {
			width: 100%;
		}
	}
</style>
