<script lang="ts">
	type LifecycleStep = {
		label: string;
		state: 'complete' | 'current' | 'upcoming' | 'blocked';
	};

	type Props = {
		steps: LifecycleStep[];
		label?: string;
	};

	let { steps, label = 'Record lifecycle' }: Props = $props();
</script>

<ol class="lifecycle" aria-label={label}>
	{#each steps as step, index (`${step.label}-${index}`)}
		<li
			class={`step step--${step.state}`}
			aria-current={step.state === 'current' ? 'step' : undefined}
		>
			<span class="marker" aria-hidden="true">{index + 1}</span>
			<span class="label">{step.label}</span>
		</li>
	{/each}
</ol>

<style>
	.lifecycle {
		display: flex;
		align-items: flex-start;
		gap: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.step {
		position: relative;
		display: grid;
		flex: 1 1 0;
		justify-items: start;
		gap: var(--nb-space-2);
		min-width: 100px;
		padding-right: var(--nb-space-4);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-medium);
	}
	.step:not(:last-child)::before {
		position: absolute;
		top: 13px;
		right: 0;
		left: 26px;
		height: 2px;
		background: var(--nb-color-border-default);
		content: '';
	}
	.marker {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 2px solid var(--nb-color-border-default);
		border-radius: 50%;
		background: var(--nb-color-bg-surface);
		color: var(--nb-color-text-muted);
		font-size: 0.6875rem;
		font-weight: var(--nb-weight-semibold);
	}
	.step--complete::before {
		background: var(--nb-color-success);
	}
	.step--complete .marker {
		border-color: var(--nb-color-success);
		background: var(--nb-color-success);
		color: var(--nb-color-text-inverse);
	}
	.step--current {
		color: var(--nb-color-text-primary);
		font-weight: var(--nb-weight-semibold);
	}
	.step--current .marker {
		border-color: var(--nb-color-action-primary);
		color: var(--nb-color-action-primary);
		box-shadow: 0 0 0 3px var(--nb-blue-95);
	}
	.step--blocked .marker {
		border-color: var(--nb-color-danger);
		background: var(--nb-color-danger-bg);
		color: var(--nb-color-danger);
	}
	@media (max-width: 700px) {
		.lifecycle {
			display: grid;
			gap: var(--nb-space-3);
		}
		.step {
			grid-template-columns: 28px minmax(0, 1fr);
			align-items: center;
			gap: var(--nb-space-3);
			padding: 0;
		}
		.step:not(:last-child)::before {
			top: 27px;
			bottom: calc(-1 * var(--nb-space-3));
			left: 13px;
			width: 2px;
			height: auto;
		}
	}
</style>
