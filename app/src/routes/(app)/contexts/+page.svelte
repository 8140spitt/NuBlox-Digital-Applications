<script lang="ts">
	let { data, form } = $props();

	function kindLabel(kind: 'organisation' | 'project' | 'facility' | 'asset'): string {
		if (kind === 'organisation') return 'Organisation';
		if (kind === 'project') return 'Project';
		if (kind === 'facility') return 'Property / facility';
		return 'Asset';
	}

	function openHref(kind: string, publicId: string): string {
		return `/contexts/open?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(publicId)}`;
	}

	function recentLabel(value: Date | string | null): string {
		if (!value) return 'Not opened yet';
		return new Intl.DateTimeFormat('en-GB', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));
	}
</script>

<svelte:head>
	<title>Contexts · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Stay in context</p>
		<h1>Contexts</h1>
		<p>
			Keep the projects, organisations, properties and assets you work with most close at hand.
			Shortcuts never bypass your current tenant or effective permissions.
		</p>
	</div>
</section>

{#if form?.error}
	<p class="error" role="alert">{form.error}</p>
{/if}

<section class="shortcut-grid" aria-label="Context shortcuts">
	<article class="shortcut-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Priority</p>
				<h2>Pinned</h2>
			</div>
			<span>{data.pinned.length}</span>
		</div>
		<div class="compact-list">
			{#each data.pinned as item (item.id)}
				<a href={openHref(item.kind, item.publicId)}>
					<strong>{item.label}</strong>
					<small>{kindLabel(item.kind)} · {item.reference}</small>
				</a>
			{:else}
				<p>No pinned contexts yet.</p>
			{/each}
		</div>
	</article>

	<article class="shortcut-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Saved</p>
				<h2>Favourites</h2>
			</div>
			<span>{data.favourites.length}</span>
		</div>
		<div class="compact-list">
			{#each data.favourites as item (item.id)}
				<a href={openHref(item.kind, item.publicId)}>
					<strong>{item.label}</strong>
					<small>{kindLabel(item.kind)} · {item.reference}</small>
				</a>
			{:else}
				<p>No favourite contexts yet.</p>
			{/each}
		</div>
	</article>

	<article class="shortcut-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">History</p>
				<h2>Recent</h2>
			</div>
			<span>{data.recent.length}</span>
		</div>
		<div class="compact-list">
			{#each data.recent as item (item.id)}
				<a href={openHref(item.kind, item.publicId)}>
					<strong>{item.label}</strong>
					<small>{kindLabel(item.kind)} · {recentLabel(item.lastOpenedAt)}</small>
				</a>
			{:else}
				<p>Contexts you open from here will appear in your recent list.</p>
			{/each}
		</div>
	</article>
</section>

<section class="available" aria-labelledby="available-contexts">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Available to you</p>
			<h2 id="available-contexts">All contexts</h2>
		</div>
		<span>{data.items.length}</span>
	</div>

	<div class="context-grid">
		{#each data.items as item (item.id)}
			<article class="context-card">
				<div class="context-topline">
					<span class="kind">{kindLabel(item.kind)}</span>
					<span class="status">{item.status.replaceAll('_', ' ')}</span>
				</div>
				<div>
					<strong>{item.label}</strong>
					<p>{item.reference}</p>
				</div>
				{#if item.lastOpenedAt}
					<small>Last opened {recentLabel(item.lastOpenedAt)}</small>
				{/if}
				<div class="actions">
					<a class="open" href={openHref(item.kind, item.publicId)}>Open</a>

					<form method="POST" action="?/preference">
						<input type="hidden" name="kind" value={item.kind} />
						<input type="hidden" name="publicId" value={item.publicId} />
						<input type="hidden" name="isFavourite" value={item.isFavourite ? 'false' : 'true'} />
						<input
							type="hidden"
							name="isPinned"
							value={item.isFavourite ? 'false' : item.isPinned ? 'true' : 'false'}
						/>
						<button type="submit">{item.isFavourite ? 'Remove favourite' : 'Favourite'}</button>
					</form>

					<form method="POST" action="?/preference">
						<input type="hidden" name="kind" value={item.kind} />
						<input type="hidden" name="publicId" value={item.publicId} />
						<input type="hidden" name="isFavourite" value="true" />
						<input type="hidden" name="isPinned" value={item.isPinned ? 'false' : 'true'} />
						<button type="submit">{item.isPinned ? 'Unpin' : 'Pin'}</button>
					</form>
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	.page-header {
		max-width: 62rem;
		margin-bottom: 1.25rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		color: var(--nb-text-muted);
		font-size: 0.7rem;
		font-weight: 850;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 0.55rem;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.04em;
	}

	.page-header p:last-child {
		max-width: 52rem;
		color: var(--nb-text-muted);
		line-height: 1.55;
	}

	.error {
		padding: 0.8rem 1rem;
		border: 1px solid var(--nb-danger, #b42318);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
	}

	.shortcut-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.shortcut-panel,
	.available,
	.context-card {
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-white);
	}

	.shortcut-panel {
		padding: 1rem;
	}

	.panel-heading,
	.section-heading,
	.context-topline,
	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.7rem;
	}

	.panel-heading {
		align-items: flex-start;
		margin-bottom: 0.65rem;
	}

	.panel-heading h2,
	.section-heading h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.panel-heading > span,
	.section-heading > span,
	.kind,
	.status {
		padding: 0.2rem 0.45rem;
		border-radius: 999px;
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
		font-size: 0.66rem;
		font-weight: 800;
	}

	.compact-list {
		display: grid;
		gap: 0.25rem;
	}

	.compact-list a {
		display: grid;
		gap: 0.12rem;
		padding: 0.55rem 0.6rem;
		border-radius: var(--nb-radius-sm);
		color: var(--nb-text);
		text-decoration: none;
	}

	.compact-list a:hover,
	.compact-list a:focus-visible {
		background: var(--nb-surface-muted);
	}

	.compact-list strong {
		font-size: 0.82rem;
	}

	.compact-list small,
	.compact-list p,
	.context-card small,
	.context-card p {
		color: var(--nb-text-muted);
		font-size: 0.72rem;
	}

	.compact-list p {
		margin: 0;
		padding: 0.5rem 0.6rem;
		line-height: 1.45;
	}

	.available {
		padding: 1rem;
	}

	.section-heading {
		margin-bottom: 0.8rem;
	}

	.context-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 0.7rem;
	}

	.context-card {
		display: grid;
		gap: 0.75rem;
		min-height: 12rem;
		padding: 0.9rem;
	}

	.context-topline {
		align-items: flex-start;
	}

	.kind,
	.status {
		text-transform: capitalize;
	}

	.context-card > div:nth-child(2) > strong {
		font-size: 0.95rem;
	}

	.context-card p {
		margin: 0.25rem 0 0;
	}

	.actions {
		align-self: end;
		justify-content: flex-start;
		flex-wrap: wrap;
	}

	.actions form {
		margin: 0;
	}

	.actions button,
	.actions .open {
		display: inline-flex;
		align-items: center;
		min-height: 2rem;
		padding: 0.38rem 0.6rem;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
		color: var(--nb-text);
		font-size: 0.72rem;
		font-weight: 760;
		text-decoration: none;
		cursor: pointer;
	}

	.actions .open {
		border-color: var(--nb-blue);
		background: var(--nb-blue);
		color: white;
	}

	.actions button:hover,
	.actions button:focus-visible {
		background: var(--nb-surface-muted);
	}

	@media (max-width: 850px) {
		.shortcut-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
