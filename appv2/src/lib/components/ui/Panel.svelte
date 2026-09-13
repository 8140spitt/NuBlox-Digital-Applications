<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title?: string;
		description?: string;
		children?: Snippet;
		actions?: Snippet;
		padding?: 'none' | 'standard' | 'spacious';
	};

	let { title, description, children, actions, padding = 'standard' }: Props = $props();
</script>

<section class={`panel panel--${padding}`}>
	{#if title || description || actions}
		<header class:panel-header--without-body={!children} class="panel-header">
			<div class="panel-heading">
				{#if title}<h2>{title}</h2>{/if}
				{#if description}<p>{description}</p>{/if}
			</div>
			{#if actions}<div class="panel-actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	{#if children}<div class="panel-body">{@render children()}</div>{/if}
</section>

<style>
	.panel {
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
		box-shadow: var(--nb-shadow-sm);
	}
	.panel--standard,
	.panel--spacious {
		padding: var(--nb-space-5);
	}
	.panel--spacious {
		padding: var(--nb-space-8);
	}
	.panel--none {
		padding: 0;
	}
	.panel-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-4);
		margin-bottom: var(--nb-space-5);
	}
	.panel-header--without-body {
		margin-bottom: 0;
	}
	.panel--none .panel-header {
		padding: var(--nb-space-5) var(--nb-space-5) 0;
	}
	.panel--none .panel-header--without-body {
		padding-bottom: var(--nb-space-5);
	}
	.panel-heading {
		min-width: 0;
	}
	h2 {
		margin: 0;
		font-size: var(--nb-font-size-lg);
		line-height: var(--nb-line-tight);
		letter-spacing: -0.015em;
	}
	p {
		max-width: 720px;
		margin: var(--nb-space-2) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
	}
	.panel-actions {
		flex: 0 0 auto;
	}
	@media (max-width: 640px) {
		.panel--spacious {
			padding: var(--nb-space-5);
		}
		.panel-header {
			flex-direction: column;
		}
	}
</style>
