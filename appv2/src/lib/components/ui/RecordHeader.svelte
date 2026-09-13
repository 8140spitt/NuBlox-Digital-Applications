<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		eyebrow?: string;
		title: string;
		subtitle?: string;
		status?: Snippet;
		meta?: Snippet;
		actions?: Snippet;
	};

	let { eyebrow, title, subtitle, status, meta, actions }: Props = $props();
</script>

<header class="record-header">
	<div class="identity">
		{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
		<div class="title-row">
			<h1>{title}</h1>
			{#if status}<div class="status">{@render status()}</div>{/if}
		</div>
		{#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
		{#if meta}<div class="meta">{@render meta()}</div>{/if}
	</div>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
	.record-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-6);
		border-bottom: 1px solid var(--nb-color-border-default);
		padding: var(--nb-space-5) 0 var(--nb-space-6);
	}
	.identity {
		min-width: 0;
	}
	.eyebrow {
		margin: 0 0 var(--nb-space-2);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.title-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--nb-space-3);
	}
	h1 {
		margin: 0;
		font-size: var(--nb-font-size-2xl);
		line-height: var(--nb-line-tight);
		letter-spacing: -0.03em;
	}
	.subtitle {
		max-width: 760px;
		margin: var(--nb-space-2) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
	}
	.meta {
		margin-top: var(--nb-space-3);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}
	.actions {
		display: flex;
		align-items: center;
		flex: 0 0 auto;
		gap: var(--nb-space-2);
	}
	@media (max-width: 720px) {
		.record-header {
			flex-direction: column;
		}
		.actions {
			width: 100%;
			flex-wrap: wrap;
		}
	}
</style>
