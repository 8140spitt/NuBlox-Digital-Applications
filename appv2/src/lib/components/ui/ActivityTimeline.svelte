<script lang="ts">
	type ActivityItem = {
		title: string;
		detail?: string;
		actor?: string;
		timestamp: string;
		tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
	};

	type Props = {
		items: ActivityItem[];
		emptyMessage?: string;
	};

	let { items, emptyMessage = 'No activity has been recorded.' }: Props = $props();
</script>

{#if items.length === 0}
	<p class="empty">{emptyMessage}</p>
{:else}
	<ol class="timeline">
		{#each items as item, index (`${item.timestamp}-${index}`)}
			<li class={`item item--${item.tone ?? 'neutral'}`}>
				<span class="marker" aria-hidden="true"></span>
				<div class="content">
					<div class="heading">
						<strong>{item.title}</strong>
						<time>{item.timestamp}</time>
					</div>
					{#if item.detail}<p>{item.detail}</p>{/if}
					{#if item.actor}<span class="actor">{item.actor}</span>{/if}
				</div>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.timeline {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.item {
		position: relative;
		display: grid;
		grid-template-columns: 18px minmax(0, 1fr);
		gap: var(--nb-space-3);
		padding-bottom: var(--nb-space-5);
	}
	.item:not(:last-child)::before {
		position: absolute;
		top: 14px;
		bottom: 0;
		left: 8px;
		width: 1px;
		background: var(--nb-color-border-default);
		content: '';
	}
	.marker {
		position: relative;
		z-index: 1;
		width: 9px;
		height: 9px;
		margin: 5px 0 0 4px;
		border: 2px solid var(--nb-color-bg-surface);
		border-radius: 50%;
		background: var(--nb-color-border-strong);
		box-shadow: 0 0 0 1px var(--nb-color-border-default);
	}
	.item--success .marker {
		background: var(--nb-color-success);
	}
	.item--warning .marker {
		background: var(--nb-color-warning);
	}
	.item--danger .marker {
		background: var(--nb-color-danger);
	}
	.item--info .marker {
		background: var(--nb-color-info);
	}
	.heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--nb-space-4);
	}
	strong {
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-semibold);
	}
	time,
	.actor {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}
	p {
		margin: var(--nb-space-1) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		line-height: var(--nb-line-normal);
	}
	.actor {
		display: inline-block;
		margin-top: var(--nb-space-1);
	}
	.empty {
		margin: 0;
		padding: var(--nb-space-6) 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
		text-align: center;
	}
</style>
