<script lang="ts">
	let { data } = $props();

	const statusLabels: Record<string, string> = {
		proposed: 'Proposed',
		active: 'Active',
		on_hold: 'On hold',
		completed: 'Completed',
		cancelled: 'Cancelled',
		archived: 'Archived'
	};

	function workspace(id: string) {
		return data.workspaceDirectory.flatMap((section) => section.items).find((item) => item.id === id);
	}

	const queueIds = ['portal', 'schedule', 'time', 'documents', 'site', 'purchasing'];
</script>

<svelte:head>
	<title>My work · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Your starting point</p>
		<h1>My work</h1>
		<p>
			Start with the thing you are working on, then move through its business functions without
			losing context.
		</p>
	</div>
</section>

<section class="work-section" aria-labelledby="continue-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Project context</p>
			<h2 id="continue-heading">Continue in a project</h2>
			<p>Opening a project pins it above the workspace so Documents, Procurement, Commercial and Site stay connected.</p>
		</div>
		<a href="/projects">All projects</a>
	</div>

	{#if !data.canViewProjects}
		<div class="empty-state">
			<strong>Project work is not available for this role.</strong>
			<p>Your other permitted workspaces remain available below and through More.</p>
		</div>
	{:else if data.projects.length === 0}
		<div class="empty-state">
			<strong>No projects are currently in your member scope.</strong>
			<p>Once you create or join a project, it will become the primary route into delivery work here.</p>
		</div>
	{:else}
		<div class="project-list">
			{#each data.projects.slice(0, 8) as project}
				<a class="project-row" href={`/projects/${project.publicId}?project=${project.publicId}`}>
					<div>
						<span class="project-number">{project.projectNumber}</span>
						<strong>{project.name}</strong>
					</div>
					<span class={`status status-${project.status}`}>{statusLabels[project.status] ?? project.status}</span>
					<span class="open-label">Open workspace →</span>
				</a>
			{/each}
		</div>
	{/if}
</section>

<section class="work-section" aria-labelledby="queues-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Cross-project work</p>
			<h2 id="queues-heading">Work queues</h2>
			<p>Use these when the job is genuinely cross-project. Project-specific work should start from the project above.</p>
		</div>
	</div>

	<div class="queue-grid">
		{#each queueIds as id}
			{@const item = workspace(id)}
			{#if item}
				<a class="queue-card" href={item.href}>
					<strong>{item.label}</strong>
					<span>{item.description ?? 'Open workspace'}</span>
					<small>Open →</small>
				</a>
			{/if}
		{/each}
	</div>
</section>

<section class="directory-callout">
	<div>
		<p class="eyebrow">Everything else</p>
		<h2>Need a specialist workspace?</h2>
		<p>Accounting, contracts, estimates, workforce and other specialist functions are grouped in one directory instead of filling the sidebar.</p>
	</div>
	<a href="/more">Browse more workspaces</a>
</section>

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

	.page-header p:last-child,
	.section-heading p,
	.empty-state p,
	.directory-callout p,
	.queue-card span {
		color: var(--nb-text-muted);
		line-height: 1.55;
	}

	.work-section,
	.directory-callout {
		margin-bottom: 1rem;
		padding: 1.25rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-white);
	}

	.section-heading,
	.directory-callout {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.section-heading {
		margin-bottom: 1rem;
	}

	.section-heading h2,
	.directory-callout h2 {
		margin: 0;
		font-size: 1.15rem;
	}

	.section-heading p,
	.directory-callout p {
		margin: 0.35rem 0 0;
		max-width: 48rem;
		font-size: 0.86rem;
	}

	.section-heading > a,
	.directory-callout > a {
		flex: 0 0 auto;
		color: var(--nb-blue);
		font-size: 0.82rem;
		font-weight: 750;
		text-decoration: none;
	}

	.project-list {
		display: grid;
		gap: 0.45rem;
	}

	.project-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 1rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		color: var(--nb-text);
		text-decoration: none;
	}

	.project-row:hover,
	.project-row:focus-visible {
		border-color: var(--nb-border-strong);
		background: var(--nb-surface-muted);
	}

	.project-row > div {
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: 0.65rem;
	}

	.project-row strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.project-number {
		flex: 0 0 auto;
		color: var(--nb-text-muted);
		font-size: 0.76rem;
		font-weight: 800;
	}

	.status {
		padding: 0.22rem 0.48rem;
		border-radius: 999px;
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
		font-size: 0.68rem;
		font-weight: 750;
	}

	.status-active {
		color: #08643c;
		background: #e5f6ed;
	}

	.status-on_hold {
		color: #805900;
		background: #fff3d6;
	}

	.open-label {
		color: var(--nb-blue);
		font-size: 0.75rem;
		font-weight: 750;
	}

	.queue-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.65rem;
	}

	.queue-card {
		display: grid;
		gap: 0.35rem;
		min-height: 8rem;
		padding: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		color: var(--nb-text);
		text-decoration: none;
	}

	.queue-card:hover,
	.queue-card:focus-visible {
		border-color: var(--nb-border-strong);
		background: var(--nb-surface-muted);
	}

	.queue-card span {
		font-size: 0.82rem;
	}

	.queue-card small {
		align-self: end;
		color: var(--nb-blue);
		font-weight: 750;
	}

	.empty-state {
		padding: 1rem;
		border-radius: var(--nb-radius-sm);
		background: var(--nb-surface-muted);
	}

	.empty-state p {
		margin: 0.3rem 0 0;
		font-size: 0.84rem;
	}

	@media (max-width: 680px) {
		.section-heading,
		.directory-callout {
			flex-direction: column;
		}

		.project-row {
			grid-template-columns: 1fr auto;
		}

		.project-row > div {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.15rem;
		}

		.open-label {
			grid-column: 1 / -1;
		}
	}
</style>
