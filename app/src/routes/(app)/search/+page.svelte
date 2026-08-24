<script lang="ts">
	let { data } = $props();

	function kindLabel(kind: 'project' | 'document' | 'work'): string {
		if (kind === 'project') return 'Project';
		if (kind === 'document') return 'Document';
		return 'Work item';
	}
</script>

<svelte:head>
	<title>Enterprise search · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Operating-system search</p>
		<h1>Enterprise search</h1>
		<p>
			Search governed NuBlox records across projects, controlled information and the Work Kernel.
			Results are filtered by your active organisation, project scope and effective permissions.
		</p>
	</div>
</section>

<section class="search-panel" aria-labelledby="search-heading">
	<div class="search-heading">
		<div>
			<p class="eyebrow">Find records</p>
			<h2 id="search-heading">Search authorised records</h2>
		</div>
		{#if data.searched && !data.searchError}
			<span class="result-count">{data.results.length} result{data.results.length === 1 ? '' : 's'}</span>
		{/if}
	</div>

	<form method="GET" action="/search" class="search-form">
		<label for="enterprise-search">Search term</label>
		<div class="search-row">
			<input
				id="enterprise-search"
				name="q"
				type="search"
				value={data.query}
				maxlength="120"
				placeholder="Project number, document title, work item…"
				autocomplete="off"
			/>
			<button type="submit">Search</button>
		</div>
		<small>Enter at least two characters. Search never bypasses tenant or project permissions.</small>
	</form>
</section>

{#if data.searchError}
	<section class="message error-message" role="alert">
		<strong>Search could not run</strong>
		<span>{data.searchError}</span>
	</section>
{:else if data.searched && data.results.length === 0}
	<section class="message empty-message">
		<strong>No authorised records matched “{data.query}”.</strong>
		<span>Try a project number, document number, title, work item or source domain.</span>
	</section>
{:else if data.results.length > 0}
	<section class="results" aria-label="Enterprise search results">
		{#each data.results as result (result.id)}
			<a class="result-card" href={result.href}>
				<div class="result-topline">
					<span class={`kind kind-${result.kind}`}>{kindLabel(result.kind)}</span>
					<span class="status">{result.status.replaceAll('_', ' ')}</span>
				</div>
				<div>
					<strong>{result.title}</strong>
					<p>{result.description}</p>
				</div>
				<div class="result-meta">
					<span>{result.reference}</span>
					<span>{result.context}</span>
					<span>Open →</span>
				</div>
			</a>
		{/each}
	</section>
{:else}
	<section class="search-primer" aria-label="Search scope">
		<div>
			<strong>Projects</strong>
			<span>Project number, name and description.</span>
		</div>
		<div>
			<strong>Controlled information</strong>
			<span>Document number, title and information-container type.</span>
		</div>
		<div>
			<strong>Work Kernel</strong>
			<span>Assigned or created work items, including source domain and description.</span>
		</div>
	</section>
{/if}

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

	.search-panel,
	.message,
	.result-card,
	.search-primer {
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-white);
	}

	.search-panel {
		padding: 1.2rem;
	}

	.search-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.9rem;
	}

	.search-heading h2 {
		margin-bottom: 0;
		font-size: 1.2rem;
	}

	.result-count,
	.kind,
	.status {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		font-size: 0.66rem;
		font-weight: 820;
	}

	.result-count {
		padding: 0.3rem 0.55rem;
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
	}

	.search-form {
		display: grid;
		gap: 0.45rem;
	}

	.search-form label {
		font-size: 0.78rem;
		font-weight: 760;
	}

	.search-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.6rem;
	}

	.search-row input {
		min-width: 0;
		padding: 0.78rem 0.85rem;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
		color: var(--nb-text);
	}

	.search-row button {
		padding: 0.75rem 1rem;
		border: 1px solid var(--nb-blue);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-blue);
		color: white;
		font-weight: 780;
		cursor: pointer;
	}

	.search-form small {
		color: var(--nb-text-muted);
		line-height: 1.4;
	}

	.message {
		display: grid;
		gap: 0.3rem;
		margin-top: 1rem;
		padding: 1rem 1.1rem;
	}

	.message span {
		color: var(--nb-text-muted);
		font-size: 0.82rem;
	}

	.error-message {
		border-color: var(--nb-danger, #b42318);
	}

	.results {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.result-card {
		display: grid;
		gap: 0.8rem;
		min-height: 12rem;
		padding: 1rem;
		color: var(--nb-text);
		text-decoration: none;
	}

	.result-card:hover,
	.result-card:focus-visible {
		border-color: var(--nb-border-strong);
		background: var(--nb-surface-muted);
	}

	.result-topline,
	.result-meta {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.result-topline {
		justify-content: space-between;
	}

	.kind,
	.status {
		padding: 0.2rem 0.45rem;
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
		text-transform: capitalize;
	}

	.result-card strong {
		font-size: 1rem;
	}

	.result-card p {
		margin: 0.35rem 0 0;
		color: var(--nb-text-muted);
		font-size: 0.82rem;
		line-height: 1.5;
	}

	.result-meta {
		align-self: end;
		flex-wrap: wrap;
		color: var(--nb-text-muted);
		font-size: 0.72rem;
	}

	.result-meta span:last-child {
		margin-left: auto;
		color: var(--nb-blue);
		font-weight: 780;
	}

	.search-primer {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0;
		margin-top: 1rem;
		overflow: hidden;
	}

	.search-primer div {
		display: grid;
		gap: 0.3rem;
		padding: 1rem;
	}

	.search-primer div + div {
		border-left: 1px solid var(--nb-border);
	}

	.search-primer span {
		color: var(--nb-text-muted);
		font-size: 0.8rem;
		line-height: 1.45;
	}

	@media (max-width: 700px) {
		.search-row,
		.search-primer {
			grid-template-columns: 1fr;
		}

		.search-primer div + div {
			border-top: 1px solid var(--nb-border);
			border-left: 0;
		}
	}
</style>
