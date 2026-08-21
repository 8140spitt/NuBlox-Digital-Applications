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
			Specialist business functions live here instead of permanently occupying the sidebar. Search
			from the top bar reaches the same directory from anywhere in NuBlox.
		</p>
	</div>
</section>

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
</style>
