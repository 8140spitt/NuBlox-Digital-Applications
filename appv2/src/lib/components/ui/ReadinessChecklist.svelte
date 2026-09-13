<script lang="ts">
	import LinkButton from './LinkButton.svelte';
	import StatusBadge from './StatusBadge.svelte';

	type ReadinessItem = {
		key: string;
		label: string;
		detail: string;
		ready: boolean;
		actionLabel?: string;
		actionHref?: string;
	};

	type Props = {
		title: string;
		description?: string;
		items: ReadinessItem[];
	};

	let { title, description, items }: Props = $props();
	const completeCount = $derived(items.filter((item) => item.ready).length);
	const allReady = $derived(items.length > 0 && completeCount === items.length);
</script>

<section class="readiness-checklist">
	<header class="readiness-header">
		<div>
			<p class="readiness-kicker">Governed readiness</p>
			<h2>{title}</h2>
			{#if description}<p>{description}</p>{/if}
		</div>
		<StatusBadge
			label={allReady ? 'Ready for approval' : `${completeCount}/${items.length} ready`}
			tone={allReady ? 'success' : 'warning'}
		/>
	</header>

	<ul class="readiness-items">
		{#each items as item (item.key)}
			<li class:ready={item.ready}>
				<div class="readiness-status" aria-hidden="true">{item.ready ? '✓' : '!'}</div>
				<div class="readiness-copy">
					<div class="readiness-label-row">
						<strong>{item.label}</strong>
						<StatusBadge
							label={item.ready ? 'Ready' : 'Action required'}
							tone={item.ready ? 'success' : 'warning'}
						/>
					</div>
					<p>{item.detail}</p>
				</div>
				{#if !item.ready && item.actionHref && item.actionLabel}
					<div class="readiness-action">
						<LinkButton href={item.actionHref} variant="secondary" size="sm">
							{item.actionLabel}
						</LinkButton>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.readiness-checklist {
		display: grid;
		gap: var(--nb-space-5);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		padding: var(--nb-space-6);
		background: var(--nb-color-bg-surface);
		box-shadow: var(--nb-shadow-sm);
	}
	.readiness-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-4);
	}
	.readiness-header > div {
		display: grid;
		gap: var(--nb-space-2);
		max-width: 780px;
	}
	.readiness-kicker {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-bold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.readiness-header h2,
	.readiness-header p,
	.readiness-copy p {
		margin: 0;
	}
	.readiness-header h2 {
		font-size: var(--nb-font-size-xl);
	}
	.readiness-header > div > p:last-child,
	.readiness-copy p {
		color: var(--nb-color-text-secondary);
		line-height: 1.55;
	}
	.readiness-items {
		display: grid;
		gap: var(--nb-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.readiness-items li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-md);
		padding: var(--nb-space-4);
		background: var(--nb-color-bg-subtle);
	}
	.readiness-items li.ready {
		background: var(--nb-color-success-bg);
	}
	.readiness-status {
		display: grid;
		width: 28px;
		height: 28px;
		place-items: center;
		border-radius: var(--nb-radius-pill);
		background: var(--nb-color-warning-bg);
		color: var(--nb-color-warning);
		font-weight: var(--nb-weight-bold);
	}
	.ready .readiness-status {
		background: var(--nb-color-success-bg);
		color: var(--nb-color-success);
	}
	.readiness-copy {
		display: grid;
		gap: var(--nb-space-1);
		min-width: 0;
	}
	.readiness-label-row {
		display: flex;
		align-items: center;
		gap: var(--nb-space-2);
		flex-wrap: wrap;
	}
	.readiness-action {
		justify-self: end;
	}
	@media (max-width: 760px) {
		.readiness-header {
			align-items: stretch;
			flex-direction: column;
		}
		.readiness-items li {
			grid-template-columns: auto minmax(0, 1fr);
		}
		.readiness-action {
			grid-column: 2;
			justify-self: start;
		}
	}
</style>
