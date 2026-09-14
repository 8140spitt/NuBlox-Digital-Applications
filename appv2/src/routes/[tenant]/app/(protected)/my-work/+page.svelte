<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page work-page">
	<header class="page-heading">
		<div>
			<p class="nb-eyebrow">{data.tenant.slug} · Work</p>
			<h1>My work</h1>
			<p class="nb-lede">
				One governed queue for actions, approvals, decisions, exceptions and reviews across every
				enterprise function.
			</p>
		</div>
		<div class="connection-state" class:connected={data.work.connected}>
			<span aria-hidden="true"></span>
			{data.work.connected ? 'Work sources connected' : 'Work sources not connected'}
		</div>
	</header>

	<div class="summary-grid" aria-label="Work summary">
		<article>
			<span>Open</span>
			<strong>{data.work.summary.total}</strong>
		</article>
		<article>
			<span>Critical</span>
			<strong>{data.work.summary.critical}</strong>
		</article>
		<article>
			<span>Due in 48h</span>
			<strong>{data.work.summary.dueSoon}</strong>
		</article>
		<article>
			<span>Blocked</span>
			<strong>{data.work.summary.blocked}</strong>
		</article>
	</div>

	<section class="work-surface" aria-labelledby="queue-heading">
		<div class="surface-heading">
			<div>
				<p class="nb-eyebrow">Priority queue</p>
				<h2 id="queue-heading">Work requiring attention</h2>
			</div>
			<div class="queue-tools" aria-label="Work filters">
				<button type="button" class="selected">All</button>
				<button type="button">Approvals</button>
				<button type="button">Decisions</button>
				<button type="button">Exceptions</button>
			</div>
		</div>

		{#if data.work.items.length}
			<div class="work-list">
				{#each data.work.items as item (item.id)}
					<article class="work-item">
						<div class="work-meta">
							<span>{item.functionId}</span>
							<span>{item.kind}</span>
							<span>{item.context}</span>
						</div>
						<h3>{item.title}</h3>
						{#if item.description}
							<p>{item.description}</p>
						{/if}
						<a href={item.reference.href}>{item.reference.label}</a>
					</article>
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				<p class="empty-kicker">Queue ready</p>
				{#if data.work.connected}
					<h3>Nothing is assigned to you right now.</h3>
					<p>
						Governed work sources are connected. Tasks assigned to another member, another team or
						an approval group you are not authorised to act for will not appear in your personal
						queue. When a workflow step becomes your responsibility, it will appear here
						automatically.
					</p>
				{:else}
					<h3>No governed work sources are connected.</h3>
					<p>Connect a governed work source before expecting items in this queue.</p>
				{/if}
			</div>
		{/if}
	</section>
</section>

<style>
	.work-page {
		display: grid;
		gap: 32px;
	}

	.page-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 32px;
	}

	h1 {
		margin: 0 0 16px;
		font-size: clamp(2rem, 5vw, 3.4rem);
		letter-spacing: -0.045em;
	}

	.connection-state {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--nb-muted);
	}

	.connection-state span {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--nb-border-strong, #9ca3af);
	}

	.connection-state.connected span {
		background: var(--nb-accent);
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
	}

	.summary-grid article {
		padding: 18px 20px;
		border: 1px solid var(--nb-border);
		border-radius: 14px;
		background: var(--nb-surface);
	}

	.summary-grid span {
		display: block;
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--nb-muted);
	}

	.summary-grid strong {
		display: block;
		margin-top: 10px;
		font-size: 1.7rem;
		letter-spacing: -0.04em;
	}

	.work-surface {
		border: 1px solid var(--nb-border);
		border-radius: 16px;
		background: var(--nb-surface);
		overflow: hidden;
	}

	.surface-heading {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
		padding: 22px 24px;
		border-bottom: 1px solid var(--nb-border);
	}

	.surface-heading h2 {
		margin: 3px 0 0;
		font-size: 1.2rem;
	}

	.queue-tools {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.queue-tools button {
		border: 0;
		border-radius: 8px;
		padding: 8px 10px;
		background: transparent;
		color: var(--nb-muted);
		font: inherit;
		font-size: 0.82rem;
		font-weight: 700;
	}

	.queue-tools button.selected {
		background: var(--nb-surface-subtle);
		color: var(--nb-ink);
	}

	.work-list {
		display: grid;
	}

	.work-item {
		padding: 20px 24px;
		border-bottom: 1px solid var(--nb-border);
	}

	.work-item:last-child {
		border-bottom: 0;
	}

	.work-meta {
		display: flex;
		gap: 10px;
		font-size: 0.74rem;
		font-weight: 750;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--nb-muted);
	}

	.work-item h3 {
		margin: 8px 0;
	}

	.empty-state {
		max-width: 720px;
		padding: 52px 24px 58px;
	}

	.empty-kicker {
		margin: 0 0 8px;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--nb-accent);
	}

	.empty-state h3 {
		margin: 0 0 10px;
		font-size: 1.35rem;
	}

	.empty-state p:last-child {
		margin: 0;
		line-height: 1.65;
		color: var(--nb-muted);
	}

	@media (max-width: 800px) {
		.page-heading,
		.surface-heading {
			align-items: flex-start;
			flex-direction: column;
		}

		.summary-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
