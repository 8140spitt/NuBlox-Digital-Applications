<script lang="ts">
	let { data, form } = $props();

	const statusLabels: Record<string, string> = {
		proposed: 'Proposed',
		active: 'Active',
		on_hold: 'On hold',
		completed: 'Completed',
		cancelled: 'Cancelled',
		archived: 'Archived'
	};
</script>

<svelte:head>
	<title>Projects · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Project delivery</p>
		<h1>Projects</h1>
		<p>Projects visible here require both organisation permission and your active project membership.</p>
	</div>
	{#if data.canCreate}<a class="header-action" href="#create-project">Create project</a>{/if}
</section>

{#if !data.canView}
	<section class="notice">
		<h2>Project access is not enabled</h2>
		<p>Your current organisation role does not grant <code>project.view</code>.</p>
	</section>
{:else}
	<section class="portfolio" aria-label="Project portfolio">
		{#if data.projects.length === 0}
			<div class="empty-state">
				<h2>No projects in your workspace</h2>
				<p>
					Projects appear here only when you are an active project member. Creating a project adds you
					as its first project member automatically.
				</p>
			</div>
		{:else}
			<div class="project-grid">
				{#each data.projects as project}
					<a class="project-card" href={`/projects/${project.publicId}`}>
						<div class="card-topline">
							<span class="project-number">{project.projectNumber}</span>
							<span class={`status status-${project.status}`}>{statusLabels[project.status] ?? project.status}</span>
						</div>
						<h2>{project.name}</h2>
						{#if project.description}<p>{project.description}</p>{/if}
						<div class="card-meta">
							{#if project.startedOn}<span>Started {new Date(project.startedOn).toLocaleDateString()}</span>{/if}
							{#if project.completedOn}<span>Completed {new Date(project.completedOn).toLocaleDateString()}</span>{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<section id="create-project" class="create-panel">
	<div>
		<p class="eyebrow">New project</p>
		<h2>Create an organisation-owned project</h2>
		<p class="muted">
			The creating organisation becomes the project owner and first participant. You become the first
			active project member.
		</p>
	</div>

	{#if data.canCreate}
		<form method="POST" action="?/create" class="project-form">
			<label>
				<span>Project number</span>
				<input
					name="projectNumber"
					required
					maxlength="80"
					value={form?.projectNumber ?? ''}
					placeholder="NBX-001"
				/>
			</label>
			<label>
				<span>Project name</span>
				<input
					name="name"
					required
					maxlength="255"
					value={form?.name ?? ''}
					placeholder="Project name"
				/>
			</label>
			<label class="full">
				<span>Description <small>optional</small></span>
				<textarea name="description" maxlength="10000" rows="5">{form?.description ?? ''}</textarea>
			</label>
			{#if form?.createError}<p class="error full" role="alert">{form.createError}</p>{/if}
			<button type="submit">Create project</button>
		</form>
	{:else}
		<p class="muted">You do not have the <code>project.create</code> permission in this organisation.</p>
	{/if}
</section>

<style>
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}
	.eyebrow {
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.75rem;
		font-weight: 750;
		color: #61615b;
	}
	h1 { margin: 0; font-size: clamp(2rem, 5vw, 3rem); letter-spacing: -0.04em; }
	.page-header p:last-child, .muted { color: #5d5d57; line-height: 1.6; }
	.header-action, button {
		font: inherit;
		font-weight: 750;
		border: 1px solid #111;
		border-radius: 0.55rem;
		padding: 0.75rem 1rem;
		background: #111;
		color: white;
		text-decoration: none;
		cursor: pointer;
	}
	.notice, .empty-state, .create-panel {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.25rem;
	}
	.notice, .empty-state { margin-bottom: 1rem; }
	.notice h2, .empty-state h2, .create-panel h2 { margin-top: 0; }
	.project-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.project-card {
		display: block;
		min-height: 12rem;
		padding: 1.1rem;
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		color: inherit;
		text-decoration: none;
		transition: border-color 120ms ease, transform 120ms ease;
	}
	.project-card:hover, .project-card:focus-visible { border-color: #777; transform: translateY(-1px); }
	.card-topline { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
	.project-number { font-size: 0.8rem; font-weight: 750; color: #666; }
	.project-card h2 { margin: 1rem 0 0.55rem; font-size: 1.25rem; }
	.project-card p { color: #5d5d57; line-height: 1.5; }
	.status { font-size: 0.72rem; font-weight: 750; padding: 0.28rem 0.48rem; border-radius: 999px; background: #ecece6; }
	.status-active { background: #e4f5e8; }
	.status-on_hold { background: #fff1cd; }
	.status-completed { background: #e5eef9; }
	.status-cancelled, .status-archived { background: #ececec; color: #666; }
	.card-meta { display: flex; flex-wrap: wrap; gap: 0.65rem; font-size: 0.78rem; color: #777; }
	.create-panel { display: grid; grid-template-columns: minmax(14rem, 0.75fr) minmax(20rem, 1.25fr); gap: 2rem; align-items: start; }
	.project-form { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
	.project-form label { display: grid; gap: 0.4rem; font-weight: 650; }
	.project-form small { color: #777; font-weight: 500; }
	.project-form input, .project-form textarea {
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.5rem;
		padding: 0.72rem;
		background: white;
	}
	.project-form input:focus, .project-form textarea:focus { outline: 2px solid #222; outline-offset: 2px; }
	.full { grid-column: 1 / -1; }
	.error { color: #9b1c1c; margin: 0; }
	.project-form button { justify-self: start; }
	@media (max-width: 820px) {
		.page-header { display: block; }
		.header-action { display: inline-block; margin-top: 0.5rem; }
		.create-panel { grid-template-columns: 1fr; }
		.project-form { grid-template-columns: 1fr; }
		.full { grid-column: auto; }
	}
</style>
