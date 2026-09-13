<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		id: string;
		label: string;
		children: Snippet;
		hint?: string;
		error?: string;
		required?: boolean;
	};

	let { id, label, children, hint, error, required = false }: Props = $props();
</script>

<div class="field" data-invalid={error ? 'true' : undefined}>
	<label for={id}>
		<span>{label}</span>
		{#if required}<span class="required" aria-hidden="true">Required</span>{/if}
	</label>
	{@render children()}
	{#if error}
		<p class="message error" id={`${id}-error`}>{error}</p>
	{:else if hint}
		<p class="message" id={`${id}-hint`}>{hint}</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--nb-space-2);
	}
	label {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--nb-space-3);
		color: var(--nb-color-text-primary);
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-semibold);
	}
	.required {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-regular);
	}
	.message {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		line-height: var(--nb-line-normal);
	}
	.error {
		color: var(--nb-color-danger);
		font-weight: var(--nb-weight-medium);
	}
</style>
