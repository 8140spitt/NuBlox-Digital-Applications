<script lang="ts">
	type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

	type Props = {
		label: string;
		value: string;
		detail?: string;
		tone?: Tone;
	};

	let { label, value, detail, tone = 'neutral' }: Props = $props();
</script>

<div class={`stat stat--${tone}`}>
	<p class="label">{label}</p>
	<p class="value">{value}</p>
	{#if detail}<p class="detail">{detail}</p>{/if}
</div>

<style>
	.stat {
		border-left: 3px solid var(--nb-color-border-strong);
		padding-left: var(--nb-space-4);
	}
	.stat--success {
		border-color: var(--nb-color-success);
	}
	.stat--warning {
		border-color: var(--nb-color-warning);
	}
	.stat--danger {
		border-color: var(--nb-color-danger);
	}
	.stat--info {
		border-color: var(--nb-color-info);
	}
	.label,
	.value,
	.detail {
		margin: 0;
	}
	.label {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.value {
		margin-top: var(--nb-space-1);
		font-size: var(--nb-font-size-2xl);
		font-weight: var(--nb-weight-bold);
		letter-spacing: -0.035em;
	}
	.detail {
		margin-top: var(--nb-space-1);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-xs);
	}
</style>
