<script lang="ts">
	type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

	type Props = {
		label: string;
		tone?: Tone;
	};

	let { label, tone = 'neutral' }: Props = $props();
</script>

<span class={`badge badge--${tone}`}>{label}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		min-height: 24px;
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-pill);
		padding-inline: var(--nb-space-2);
		background: var(--nb-color-bg-subtle);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		line-height: 1;
		white-space: nowrap;
	}
	.badge--success {
		border-color: var(--nb-green-80);
		background: var(--nb-color-success-bg);
		color: var(--nb-color-success);
	}
	.badge--warning {
		border-color: var(--nb-orange-80);
		background: var(--nb-color-warning-bg);
		color: var(--nb-color-warning);
	}
	.badge--danger {
		border-color: var(--nb-red-80);
		background: var(--nb-color-danger-bg);
		color: var(--nb-color-danger);
	}
	.badge--info {
		border-color: var(--nb-blue-80);
		background: var(--nb-color-info-bg);
		color: var(--nb-color-info);
	}
</style>
