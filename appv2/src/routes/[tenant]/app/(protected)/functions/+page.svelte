<script lang="ts">
	import { enterpriseFunctions } from '$lib/enterprise/enterprise-functions';
	import { routes } from '$lib/routing/route-contract';
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';

	let { data } = $props();
	let query = $state('');

	let filteredFunctions = $derived(
		enterpriseFunctions.filter((entry) => {
			const needle = query.trim().toLocaleLowerCase();
			if (!needle) return true;
			return `${entry.id} ${entry.name} ${entry.shortName} ${entry.purpose}`
				.toLocaleLowerCase()
				.includes(needle);
		})
	);
</script>

<section class="nb-page function-page">
	<header class="page-heading">
		<div>
			<p class="nb-eyebrow">{data.tenant.displayName} · Enterprise functions</p>
			<h1>How the business operates</h1>
			<p class="nb-lede">
				The 29 enterprise functions are NuBlox's stable business taxonomy. They define outcomes and
				ownership; they do not become 29 disconnected applications.
			</p>
		</div>
		<label class="function-search">
			<span>Find a function</span>
			<input bind:value={query} type="search" placeholder="F27, procurement, assets…" />
		</label>
	</header>

	<div class="directory-meta">
		<strong>{filteredFunctions.length}</strong>
		<span>{filteredFunctions.length === 1 ? 'function' : 'functions'}</span>
	</div>

	<div class="function-directory">
		{#each filteredFunctions as entry (entry.id)}
			<article class:active-function={entry.id === 'F01'}>
				<div class="function-id">{entry.id}</div>
				<div class="function-copy">
					<h2>
						{#if entry.id === 'F01'}
							<a href={resolve(routes.strategy(data.tenant.slug))}>{entry.name}</a>
						{:else}
							{entry.name}
						{/if}
					</h2>
					<p>{entry.purpose}</p>
				</div>
				{#if entry.id === 'F01'}
					<a class="function-state active-state" href={resolve(routes.strategy(data.tenant.slug))}
						>Open workspace</a
					>
				{:else}
					<div class="function-state">Not yet activated in V2</div>
				{/if}
			</article>
		{:else}
			<div class="no-results">
				<h2>No matching function</h2>
				<p>Try a function number, business outcome or discipline.</p>
			</div>
		{/each}
	</div>
</section>

<style>
	.function-page {
		display: grid;
		gap: 28px;
	}

	.page-heading {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
		align-items: end;
		gap: 40px;
	}

	h1 {
		margin: 0 0 16px;
		font-size: clamp(2rem, 5vw, 3.4rem);
		letter-spacing: -0.045em;
	}

	.function-search {
		display: grid;
		gap: 7px;
	}

	.function-search span {
		font-size: 0.78rem;
		font-weight: 750;
		color: var(--nb-muted);
	}

	.function-search input {
		width: 100%;
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 11px 12px;
		background: var(--nb-surface);
		color: var(--nb-ink);
		font: inherit;
	}

	.directory-meta {
		display: flex;
		align-items: baseline;
		gap: 7px;
		padding-top: 8px;
		border-top: 1px solid var(--nb-border);
		color: var(--nb-muted);
	}

	.directory-meta strong {
		font-size: 1.1rem;
		color: var(--nb-ink);
	}

	.function-directory {
		display: grid;
		border-top: 1px solid var(--nb-border);
	}

	.function-directory article {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr) 180px;
		gap: 20px;
		align-items: start;
		padding: 22px 0;
		border-bottom: 1px solid var(--nb-border);
	}

	.function-directory article.active-function {
		margin-inline: -16px;
		padding-inline: 16px;
		background: color-mix(in srgb, var(--nb-blue-95) 52%, transparent);
	}

	.function-id {
		font-size: 0.78rem;
		font-weight: 850;
		letter-spacing: 0.08em;
		color: var(--nb-accent);
	}

	.function-copy h2 {
		margin: 0 0 6px;
		font-size: 1rem;
		letter-spacing: -0.015em;
	}

	.function-copy h2 a {
		text-decoration: none;
	}

	.function-copy h2 a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.function-copy p {
		margin: 0;
		line-height: 1.55;
		color: var(--nb-muted);
	}

	.function-state {
		justify-self: end;
		font-size: 0.76rem;
		font-weight: 700;
		color: var(--nb-muted);
	}

	.active-state {
		color: var(--nb-color-action-primary);
		text-decoration: none;
	}

	.active-state:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.no-results {
		padding: 48px 0;
	}

	.no-results h2 {
		margin: 0 0 8px;
	}

	.no-results p {
		margin: 0;
		color: var(--nb-muted);
	}

	@media (max-width: 800px) {
		.page-heading {
			grid-template-columns: 1fr;
			gap: 24px;
		}

		.function-directory article {
			grid-template-columns: 54px minmax(0, 1fr);
		}

		.function-state {
			grid-column: 2;
			justify-self: start;
		}
	}
</style>
