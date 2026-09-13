<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
	type Size = 'sm' | 'md';

	type Props = {
		children: Snippet;
		type?: 'button' | 'submit' | 'reset';
		variant?: Variant;
		size?: Size;
		disabled?: boolean;
		pending?: boolean;
		name?: string;
		value?: string;
		onclick?: (event: MouseEvent) => void;
	};

	let {
		children,
		type = 'button',
		variant = 'primary',
		size = 'md',
		disabled = false,
		pending = false,
		name,
		value,
		onclick
	}: Props = $props();
</script>

<button
	{type}
	{name}
	{value}
	{onclick}
	class={`nb-button nb-button--${variant} nb-button--${size}`}
	disabled={disabled || pending}
	aria-busy={pending || undefined}
>
	<span class="label">{@render children()}</span>
	{#if pending}<span class="pending" aria-hidden="true"></span>{/if}
</button>

<style>
	.nb-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--nb-space-2);
		min-height: var(--nb-density-control-height);
		border: 1px solid transparent;
		border-radius: var(--nb-radius-md);
		padding-inline: var(--nb-space-4);
		font: inherit;
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-semibold);
		line-height: 1;
		cursor: pointer;
		transition:
			background 120ms ease,
			border-color 120ms ease,
			color 120ms ease,
			box-shadow 120ms ease;
	}
	.nb-button--sm {
		min-height: 34px;
		padding-inline: var(--nb-space-3);
		font-size: var(--nb-font-size-xs);
	}
	.nb-button--primary {
		background: var(--nb-color-action-primary);
		color: var(--nb-color-text-inverse);
	}
	.nb-button--primary:hover:not(:disabled) {
		background: var(--nb-color-action-primary-hover);
	}
	.nb-button--secondary {
		border-color: var(--nb-color-border-default);
		background: var(--nb-color-bg-surface);
		color: var(--nb-color-text-primary);
	}
	.nb-button--secondary:hover:not(:disabled),
	.nb-button--quiet:hover:not(:disabled) {
		background: var(--nb-color-action-secondary-hover);
	}
	.nb-button--quiet {
		background: transparent;
		color: var(--nb-color-text-secondary);
	}
	.nb-button--danger {
		background: var(--nb-color-danger);
		color: var(--nb-color-text-inverse);
	}
	.nb-button--danger:hover:not(:disabled) {
		background: var(--nb-red-30);
	}
	.nb-button:disabled {
		cursor: not-allowed;
		opacity: 0.56;
	}
	.pending {
		width: 14px;
		height: 14px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 700ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
