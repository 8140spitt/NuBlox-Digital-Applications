<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>More workspaces · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Workspace directory</p>
		<h1>More workspaces</h1>
		<p>
			Specialist business functions live here instead of permanently occupying the sidebar. Use
			enterprise search to find authorised records across NuBlox, keep important contexts close at
			hand, inspect native capability coverage, or open a specialist workspace below.
		</p>
	</div>
</section>

<div class="utility-grid" aria-label="Operating-system utilities">
	<a class="utility-card" href="/search">
		<div>
			<p class="eyebrow">Operating-system utility</p>
			<strong>Enterprise search</strong>
			<span>Find authorised projects, controlled information and Work Kernel records.</span>
		</div>
		<small>Search NuBlox →</small>
	</a>

	<a class="utility-card" href="/contexts">
		<div>
			<p class="eyebrow">Personal context</p>
			<strong>Contexts</strong>
			<span
				>Switch quickly between pinned, favourite and recent projects, properties and assets.</span
			>
		</div>
		<small>Open contexts →</small>
	</a>

	<a class="utility-card" href="/capabilities">
		<div>
			<p class="eyebrow">Product architecture</p>
			<strong>Capability map</strong>
			<span>Inspect the 19 native domains, implementation maturity and your authorised routes.</span
			>
		</div>
		<small>View capabilities →</small>
	</a>
</div>

<div class="directory">
	{#each data.workspaceDirectory as section (section.id)}
		<section class="directory-section" aria-labelledby={`directory-${section.id}`}>
			<div class="section-heading">
				<p class="eyebrow">Workspace group</p>
				<h2 id={`directory-${section.id}`}>{section.label}</h2>
			</div>
			<div class="workspace-grid">
				{#each section.items as item (item.id)}
					<a class="workspace-card" href={item.href}>
						<strong>{item.label}</strong>
						<span>{item.description ?? 'Open workspace'}</span>
						<small>Open →</small>
					</a>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.page-header {
		max-width: 58rem;
		margin-bottom: 1.5rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--nb-text-muted);
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.04em;
	}

	.page-header p:last-child {
		color: var(--nb-text-muted);
		line-height: 1.55;
	}

	.utility-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.utility-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.1rem 1.25rem;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-md);
		background: var(--nb-white);
		color: var(--nb-text);
		text-decoration: none;
	}

	.utility-card:hover,
	.utility-card:focus-visible {
		background: var(--nb-surface-muted);
	}

	.utility-card div {
		display: grid;
		gap: 0.25rem;
	}

	.utility-card strong {
		font-size: 1.05rem;
	}

	.utility-card span {
		color: var(--nb-text-muted);
		font-size: 0.82rem;
	}

	.utility-card small {
		flex: 0 0 auto;
		color: var(--nb-blue);
		font-weight: 750;
	}

	.directory {
		display: grid;
		gap: 1rem;
	}

	.directory-section {
		padding: 1.25rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-white);
	}

	.section-heading {
		margin-bottom: 0.9rem;
	}

	.section-heading h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.workspace-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0.65rem;
	}

	.workspace-card {
		display: grid;
		gap: 0.35rem;
		min-height: 8.2rem;
		padding: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		color: var(--nb-text);
		text-decoration: none;
	}

	.workspace-card:hover,
	.workspace-card:focus-visible {
		border-color: var(--nb-border-strong);
		background: var(--nb-surface-muted);
	}

	.workspace-card span {
		color: var(--nb-text-muted);
		font-size: 0.82rem;
		line-height: 1.5;
	}

	.workspace-card small {
		align-self: end;
		color: var(--nb-blue);
		font-weight: 750;
	}

	@media (max-width: 960px) {
		.utility-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.utility-card {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
