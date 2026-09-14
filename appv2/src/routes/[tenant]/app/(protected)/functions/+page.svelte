<script lang="ts">
	import { enterpriseFunctions } from '$lib/enterprise/enterprise-functions';
	import { appPath, routes } from '$lib/routing/route-contract';
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

	function functionHref(id: string): string {
		return id === 'F01'
			? routes.strategy(data.tenant.slug)
			: appPath(data.tenant.slug, `functions/${id.toLowerCase()}`);
	}
</script>

<svelte:head>
	<title>Enterprise functions · NuBlox</title>
	<meta
		name="description"
		content="Browse the 29 NuBlox enterprise functions as one coherent operating-system capability map."
	/>
</svelte:head>

<section class="nb-page-wide function-page">
	<header class="page-heading">
		<div>
			<p class="nb-eyebrow">{data.tenant.displayName} · Enterprise operating system</p>
			<h1>29 functions. One NuBlox.</h1>
			<p class="nb-lede">
				Every function uses the same visual language, business-process structure and platform
				controls. Open any function to see its sub-functions, canonical business objects, user
				journey and underpinning services.
			</p>
		</div>
		<label class="function-search">
			<span>Find a function</span>
			<input bind:value={query} type="search" placeholder="F27, procurement, assets…" />
		</label>
	</header>

	<div class="directory-meta">
		<div>
			<strong>{filteredFunctions.length}</strong>
			<span>{filteredFunctions.length === 1 ? 'function' : 'functions'}</span>
		</div>
		<span>F01 is operational · F02–F29 expose the governed capability blueprint</span>
	</div>

	<div class="function-directory">
		{#each filteredFunctions as entry (entry.id)}
			<a
				class="function-card"
				class:active-function={entry.id === 'F01'}
				href={resolve(functionHref(entry.id))}
			>
				<div class="function-id">{entry.id}</div>
				<div class="function-copy">
					<h2>{entry.name}</h2>
					<p>{entry.purpose}</p>
				</div>
				<div class="function-footer">
					<span class:live={entry.id === 'F01'}
						>{entry.id === 'F01' ? 'Operating workspace' : 'Capability blueprint'}</span
					>
					<strong>Open →</strong>
				</div>
			</a>
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
		gap: var(--nb-space-6);
	}

	.page-heading {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
		align-items: end;
		gap: var(--nb-space-10);
		padding: var(--nb-space-6);
		border: 1px solid var(--nb-blue-80);
		border-radius: var(--nb-radius-xl);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--nb-blue-95) 70%, white),
			white 72%
		);
	}

	h1 {
		margin: 0 0 var(--nb-space-3);
		font-size: clamp(2rem, 5vw, 3.4rem);
		letter-spacing: -0.045em;
	}

	.function-search {
		display: grid;
		gap: var(--nb-space-2);
	}

	.function-search span {
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		color: var(--nb-color-text-muted);
	}

	.function-search input {
		width: 100%;
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-md);
		padding: 12px 14px;
		background: rgba(255, 255, 255, 0.9);
		color: var(--nb-color-text-primary);
		font: inherit;
	}

	.directory-meta {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--nb-space-4);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}

	.directory-meta strong {
		font-size: var(--nb-font-size-lg);
		color: var(--nb-color-text-primary);
	}

	.function-directory {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}

	.function-card {
		display: grid;
		align-content: start;
		gap: var(--nb-space-4);
		min-height: 250px;
		padding: var(--nb-space-5);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-xl);
		background: var(--nb-color-bg-surface);
		color: inherit;
		text-decoration: none;
		transition:
			transform 140ms ease,
			border-color 140ms ease,
			box-shadow 140ms ease;
	}

	.function-card:hover {
		transform: translateY(-2px);
		border-color: var(--nb-blue-70);
		box-shadow: 0 12px 30px rgba(12, 52, 82, 0.08);
	}

	.function-card.active-function {
		border-color: var(--nb-blue-60);
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--nb-blue-95) 65%, white),
			white 70%
		);
	}

	.function-id {
		display: inline-grid;
		place-items: center;
		width: 54px;
		height: 38px;
		border-radius: var(--nb-radius-md);
		background: var(--nb-blue-10);
		color: white;
		font-size: 0.72rem;
		font-weight: var(--nb-weight-bold);
		letter-spacing: 0.08em;
	}

	.function-copy h2 {
		margin: 0 0 var(--nb-space-2);
		font-size: var(--nb-font-size-lg);
		letter-spacing: -0.02em;
	}

	.function-copy p {
		margin: 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		line-height: var(--nb-line-relaxed);
	}

	.function-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-4);
		margin-top: auto;
		padding-top: var(--nb-space-4);
		border-top: 1px solid var(--nb-color-border-subtle);
		font-size: var(--nb-font-size-xs);
	}

	.function-footer span {
		color: var(--nb-color-text-muted);
		font-weight: var(--nb-weight-semibold);
	}

	.function-footer span.live,
	.function-footer strong {
		color: var(--nb-color-action-primary);
	}

	.no-results {
		grid-column: 1 / -1;
		padding: var(--nb-space-12) 0;
	}

	.no-results h2 {
		margin: 0 0 var(--nb-space-2);
	}

	.no-results p {
		margin: 0;
		color: var(--nb-color-text-muted);
	}

	@media (max-width: 1050px) {
		.function-directory {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 760px) {
		.page-heading,
		.function-directory {
			grid-template-columns: 1fr;
		}

		.page-heading {
			gap: var(--nb-space-5);
		}

		.directory-meta {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
