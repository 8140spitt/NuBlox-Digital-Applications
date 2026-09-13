<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolveInternalPath } from '$lib/routing/resolve-path';

	type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
	type Size = 'sm' | 'md';

	type Props = {
		href: string;
		children: Snippet;
		variant?: Variant;
		size?: Size;
	};

	let { href, children, variant = 'primary', size = 'md' }: Props = $props();
</script>

<a
	href={resolveInternalPath(href)}
	class={`nb-link-button nb-link-button--${variant} nb-link-button--${size}`}
>
	{@render children()}
</a>

<style>
	.nb-link-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: var(--nb-density-control-height);
		border: 1px solid transparent;
		border-radius: var(--nb-radius-md);
		padding-inline: var(--nb-space-4);
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-semibold);
		line-height: 1;
		text-decoration: none;
		transition:
			background 120ms ease,
			border-color 120ms ease,
			color 120ms ease,
			box-shadow 120ms ease;
	}
	.nb-link-button--sm {
		min-height: 34px;
		padding-inline: var(--nb-space-3);
		font-size: var(--nb-font-size-xs);
	}
	.nb-link-button--primary {
		background: var(--nb-color-action-primary);
		color: var(--nb-color-text-inverse);
	}
	.nb-link-button--primary:hover {
		background: var(--nb-color-action-primary-hover);
	}
	.nb-link-button--secondary {
		border-color: var(--nb-color-border-default);
		background: var(--nb-color-bg-surface);
		color: var(--nb-color-text-primary);
	}
	.nb-link-button--secondary:hover,
	.nb-link-button--quiet:hover {
		background: var(--nb-color-action-secondary-hover);
	}
	.nb-link-button--quiet {
		background: transparent;
		color: var(--nb-color-text-secondary);
	}
	.nb-link-button--danger {
		background: var(--nb-color-danger);
		color: var(--nb-color-text-inverse);
	}
	.nb-link-button--danger:hover {
		background: var(--nb-red-30);
	}
</style>
