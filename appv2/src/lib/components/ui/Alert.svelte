<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'info' | 'success' | 'warning' | 'danger';

	type Props = {
		tone?: Tone;
		title: string;
		children?: Snippet;
	};

	let { tone = 'info', title, children }: Props = $props();
</script>

<div class={`alert alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
	<strong>{title}</strong>
	{#if children}<div class="detail">{@render children()}</div>{/if}
</div>

<style>
	.alert {
		border: 1px solid var(--nb-blue-80);
		border-radius: var(--nb-radius-md);
		padding: var(--nb-space-3) var(--nb-space-4);
		background: var(--nb-color-info-bg);
		color: var(--nb-color-info);
		font-size: var(--nb-font-size-sm);
	}
	.alert--success {
		border-color: var(--nb-green-80);
		background: var(--nb-color-success-bg);
		color: var(--nb-color-success);
	}
	.alert--warning {
		border-color: var(--nb-orange-80);
		background: var(--nb-color-warning-bg);
		color: var(--nb-color-warning);
	}
	.alert--danger {
		border-color: var(--nb-red-80);
		background: var(--nb-color-danger-bg);
		color: var(--nb-color-danger);
	}
	strong {
		display: block;
		font-weight: var(--nb-weight-semibold);
	}
	.detail {
		margin-top: var(--nb-space-1);
		color: var(--nb-color-text-secondary);
	}
</style>
