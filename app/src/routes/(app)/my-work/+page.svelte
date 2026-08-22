<script lang="ts">
	let { data, form } = $props();

	const statusLabels: Record<string, string> = {
		proposed: 'Proposed',
		active: 'Active',
		on_hold: 'On hold',
		completed: 'Completed',
		cancelled: 'Cancelled',
		archived: 'Archived',
		open: 'Open',
		in_progress: 'In progress',
		blocked: 'Blocked'
	};

	function workspace(id: string) {
		return data.workspaceDirectory
			.flatMap((section) => section.items)
			.find((item) => item.id === id);
	}

	function formatDueDate(value: Date | null): string {
		if (!value) return 'No due date';
		return new Intl.DateTimeFormat('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		}).format(new Date(value));
	}

	function workType(value: string): string {
		return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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
			Start with accountable work or the project you are working on, then move through its business
			functions without losing context.
		</p>
	</div>
</section>

{#if form?.workError}
	<p class="notice error" role="alert">{form.workError}</p>
{:else if data.workUpdated}
	<p class="notice success" role="status">Work item updated.</p>
{/if}

<section class="work-section" aria-labelledby="assigned-work-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Work Kernel</p>
			<h2 id="assigned-work-heading">Assigned work</h2>
			<p>
				Canonical actions, tasks, reviews and approvals assigned directly to you across NuBlox.
			</p>
		</div>
		{#if data.canViewWork}
			<div class="work-summary" aria-label="Assigned work summary">
				<span><strong>{data.workSummary.total}</strong> active</span>
				<span><strong>{data.workSummary.overdue}</strong> overdue</span>
				<span><strong>{data.workSummary.critical}</strong> critical</span>
			</div>
		{/if}
	</div>

	{#if !data.canViewWork}
		<div class="empty-state">
			<strong>Assigned Work Kernel items are not available for this role.</strong>
			<p>Project and workspace navigation remain available below.</p>
		</div>
	{:else if data.workItems.length === 0}
		<div class="empty-state">
			<strong>No active Work Kernel items are assigned directly to you.</strong>
			<p>New actions, tasks, reviews and approvals will appear here when they are assigned.</p>
		</div>
	{:else}
		<div class="assigned-work-list">
			{#each data.workItems as workItem (workItem.publicId)}
				<article class="work-card" class:overdue={workItem.isOverdue}>
					<div class="work-card-main">
						<div class="work-meta">
							<span class={`status status-${workItem.status}`}
								>{statusLabels[workItem.status] ?? workItem.status}</span
							>
							<span class={`priority priority-${workItem.priority}`}>{workType(workItem.priority)}</span>
							<span>{workType(workItem.kind)}</span>
						</div>
						<h3>{workItem.title}</h3>
						{#if workItem.description}
							<p>{workItem.description}</p>
						{/if}
						<div class="work-provenance">
							<span>{workType(workItem.sourceDomain)}</span>
							{#if workItem.sourceType}
								<span>{workType(workItem.sourceType)}</span>
							{/if}
							<span class:due-overdue={workItem.isOverdue}>{formatDueDate(workItem.dueAt)}</span>
						</div>
					</div>

					{#if workItem.canProgress || workItem.canComplete}
						<div class="work-actions" aria-label={`Actions for ${workItem.title}`}>
							{#if workItem.status === 'open' && workItem.canProgress}
								<form method="POST" action="?/transitionWork">
									<input type="hidden" name="workItemPublicId" value={workItem.publicId} />
									<input type="hidden" name="toStatus" value="in_progress" />
									<button type="submit">Start</button>
								</form>
							{:else if workItem.status === 'in_progress'}
								{#if workItem.canProgress}
									<form method="POST" action="?/transitionWork">
										<input type="hidden" name="workItemPublicId" value={workItem.publicId} />
										<input type="hidden" name="toStatus" value="blocked" />
										<button class="secondary" type="submit">Block</button>
									</form>
								{/if}
								{#if workItem.canComplete}
									<form method="POST" action="?/transitionWork">
										<input type="hidden" name="workItemPublicId" value={workItem.publicId} />
										<input type="hidden" name="toStatus" value="completed" />
										<button type="submit">Complete</button>
									</form>
								{/if}
							{:else if workItem.status === 'blocked' && workItem.canProgress}
								<form method="POST" action="?/transitionWork">
									<input type="hidden" name="workItemPublicId" value={workItem.publicId} />
									<input type="hidden" name="toStatus" value="in_progress" />
									<button type="submit">Resume</button>
								</form>
							{/if}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<section class="work-section" aria-labelledby="continue-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Project context</p>
			<h2 id="continue-heading">Continue in a project</h2>
			<p>
				Opening a project pins it above the workspace so Documents, Procurement, Commercial and Site
				stay connected.
			</p>
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
			<p>
				Once you create or join a project, it will become the primary route into delivery work here.
			</p>
		</div>
	{:else}
		<div class="project-list">
			{#each data.projects.slice(0, 8) as project}
				<a class="project-row" href={`/projects/${project.publicId}?project=${project.publicId}`}>
					<div>
						<span class="project-number">{project.projectNumber}</span>
						<strong>{project.name}</strong>
					</div>
					<span class={`status status-${project.status}`}
						>{statusLabels[project.status] ?? project.status}</span
					>
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
			<p>
				Use these when the job is genuinely cross-project. Project-specific work should start from
				the project above.
			</p>
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
		<p>
			Accounting, contracts, estimates, workforce and other specialist functions are grouped in one
			directory instead of filling the sidebar.
		</p>
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

	h3 {
		margin: 0;
		font-size: 1rem;
		color: var(--nb-ink);
	}

	.page-header p:last-child,
	.section-heading p,
	.empty-state p,
	.directory-callout p,
	.queue-card span,
	.work-card-main > p {
		color: var(--nb-text-muted);
		line-height: 1.55;
	}

	.notice {
		margin: 0 0 1rem;
		padding: 0.8rem 1rem;
		border: 1px solid;
		border-radius: var(--nb-radius-sm);
		font-size: 0.86rem;
		font-weight: 700;
	}

	.notice.error {
		border-color: #e1aaaa;
		background: #fff2f2;
		color: #8d1717;
	}

	.notice.success {
		border-color: #a7d5b9;
		background: #effaf3;
		color: #08643c;
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

	.work-summary {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.45rem;
	}

	.work-summary span {
		padding: 0.4rem 0.58rem;
		border-radius: 999px;
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
		font-size: 0.72rem;
		white-space: nowrap;
	}

	.work-summary strong {
		color: var(--nb-ink);
	}

	.assigned-work-list {
		display: grid;
		gap: 0.55rem;
	}

	.work-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: center;
		padding: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
	}

	.work-card.overdue {
		border-left: 3px solid #a54123;
	}

	.work-card-main {
		min-width: 0;
		display: grid;
		gap: 0.5rem;
	}

	.work-card-main > p {
		margin: 0;
		font-size: 0.84rem;
	}

	.work-meta,
	.work-provenance,
	.work-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	.work-meta > span:not(.status):not(.priority),
	.work-provenance span {
		color: var(--nb-text-muted);
		font-size: 0.7rem;
		font-weight: 700;
	}

	.priority {
		padding: 0.2rem 0.45rem;
		border-radius: 999px;
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
		font-size: 0.67rem;
		font-weight: 800;
	}

	.priority-critical,
	.priority-urgent {
		background: #fff0ed;
		color: #8d2e18;
	}

	.priority-high {
		background: #fff3d6;
		color: #805900;
	}

	.due-overdue {
		color: #a54123 !important;
	}

	.work-actions {
		justify-content: flex-end;
	}

	.work-actions form {
		margin: 0;
	}

	.work-actions button {
		border: 1px solid var(--nb-ink);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-ink);
		color: var(--nb-white);
		padding: 0.5rem 0.7rem;
		font: inherit;
		font-size: 0.76rem;
		font-weight: 800;
		cursor: pointer;
	}

	.work-actions button.secondary {
		background: var(--nb-white);
		color: var(--nb-ink);
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

	.status-active,
	.status-in_progress {
		color: #08643c;
		background: #e5f6ed;
	}

	.status-on_hold,
	.status-blocked {
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

		.work-summary {
			justify-content: flex-start;
		}

		.work-card {
			grid-template-columns: 1fr;
		}

		.work-actions {
			justify-content: flex-start;
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
