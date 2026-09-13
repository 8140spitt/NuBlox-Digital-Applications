<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		description: string;
		actions?: Snippet;
	};

	let { title, description, actions }: Props = $props();
</script>

<div class="empty-state">
	<div class="mark" aria-hidden="true">N</div>
	<h3>{title}</h3>
	<p>{description}</p>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.empty-state {
		display: grid;
		justify-items: center;
		padding: var(--nb-space-12) var(--nb-space-6);
		text-align: center;
	}
	.mark {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: var(--nb-radius-md);
		background: var(--nb-blue-95);
		color: var(--nb-blue-20);
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-bold);
	}
	h3 {
		margin: var(--nb-space-4) 0 0;
		font-size: var(--nb-font-size-lg);
	}
	p {
		max-width: 520px;
		margin: var(--nb-space-2) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		line-height: var(--nb-line-relaxed);
	}
	.actions {
		margin-top: var(--nb-space-5);
	}
</style>
