<script lang="ts">
	let { data } = $props();

	function dateTime(value: Date | string | null): string {
		if (!value) return 'No due date';
		return new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	function titleCase(value: string): string {
		return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	let openWork = $derived(data.externalWork.filter((item) => item.state === 'open'));
	let completedWork = $derived(data.externalWork.filter((item) => item.state === 'completed'));
</script>

<section class="hero">
	<div>
		<p class="eyebrow">{data.organisation?.name} portal</p>
		<h1>Your shared work</h1>
		<p class="lede">
			{#if data.party?.name}
				Signed in for <strong>{data.party.name}</strong>. Only records and actions explicitly shared
				with this CRM party and your verified identity appear here.
			{:else}
				Only records and actions explicitly shared with your verified identity appear here.
			{/if}
		</p>
	</div>
</section>

<section class="metrics" aria-label="Portal summary">
	<article>
		<strong>{openWork.length}</strong>
		<span>Actions awaiting you</span>
	</article>
	<article>
		<strong>{data.externalProjects.length}</strong>
		<span>Shared projects</span>
	</article>
	<article>
		<strong>{completedWork.length}</strong>
		<span>Completed actions</span>
	</article>
</section>

<section class="section-block" aria-labelledby="portal-actions-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">My actions</p>
			<h2 id="portal-actions-heading">Work assigned to you</h2>
		</div>
		<span class="count-badge">{openWork.length}</span>
	</div>

	{#if openWork.length === 0}
		<div class="empty-state">
			<strong>No action is waiting for you.</strong>
			<p>New work appears here only when the sharing organisation grants it to this portal context.</p>
		</div>
	{:else}
		<div class="work-list">
			{#each openWork as item (item.publicId)}
				<article class="work-card">
					<div class="work-icon" aria-hidden="true">
						{item.domainKey.slice(0, 1).toUpperCase()}
					</div>
					<div class="work-copy">
						<div class="meta-line">
							<span>{titleCase(item.domainKey)}</span>
							<span>From {item.owningOrganisationName}</span>
							<span>{dateTime(item.dueAt)}</span>
						</div>
						<h3>{item.title}</h3>
						{#if item.summary}<p>{item.summary}</p>{/if}
					</div>
					{#if item.href}
						<a class="primary-link" href={item.href}>Open action</a>
					{:else}
						<span class="status-pill">Shared</span>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

{#if data.externalProjects.length}
	<section class="section-block" aria-labelledby="external-projects-heading">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Project participation</p>
				<h2 id="external-projects-heading">Projects shared with you personally</h2>
			</div>
			<span class="count-badge">{data.externalProjects.length}</span>
		</div>
		<div class="project-grid">
			{#each data.externalProjects as project (project.collaboratorPublicId)}
				<article class="project-card">
					<div class="meta-line">
						<span>{project.projectNumber}</span>
						<span>{titleCase(project.projectStatus)}</span>
					</div>
					<h3>{project.projectName}</h3>
					<p>Shared by {project.owningOrganisationName}</p>
					{#if project.roles.length}<p class="muted">Roles: {project.roles.join(', ')}</p>{/if}
				</article>
			{/each}
		</div>
	</section>
{/if}

{#if completedWork.length}
	<details class="completed-block">
		<summary>Completed work ({completedWork.length})</summary>
		<div class="work-list">
			{#each completedWork as item (item.publicId)}
				<article class="work-card completed">
					<div class="work-icon" aria-hidden="true">✓</div>
					<div class="work-copy">
						<div class="meta-line">
							<span>{titleCase(item.domainKey)}</span>
							<span>{item.owningOrganisationName}</span>
							<span>Completed {dateTime(item.completedAt)}</span>
						</div>
						<h3>{item.title}</h3>
					</div>
					{#if item.href}<a class="secondary-link" href={item.href}>View</a>{/if}
				</article>
			{/each}
		</div>
	</details>
{/if}

<section class="boundary-panel">
	<strong>External access is deny-by-default.</strong>
	<p>
		This portal does not make you a member of {data.organisation?.name ?? 'the sharing organisation'}.
		Every page and action is checked against the tenant, CRM party, active grant, record context and
		permitted capability on the server.
	</p>
</section>

<style>
	.hero {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}
	.eyebrow {
		margin: 0 0 0.3rem;
		color: var(--nb-text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	h1,
	h2,
	h3 {
		margin: 0;
	}
	h1 {
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.045em;
	}
	.lede {
		max-width: 48rem;
		margin: 0.5rem 0 0;
		color: var(--nb-text-muted);
		line-height: 1.55;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.7rem;
		margin-bottom: 1.5rem;
	}
	.metrics article {
		display: grid;
		gap: 0.15rem;
		padding: 0.9rem 1rem;
		border: 1px solid #dde2e9;
		border-radius: 0.7rem;
		background: white;
	}
	.metrics strong {
		font-size: 1.45rem;
	}
	.metrics span,
	.muted {
		color: var(--nb-text-muted);
		font-size: 0.82rem;
	}
	.section-block {
		margin-top: 1.5rem;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.7rem;
	}
	.count-badge,
	.status-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.8rem;
		min-height: 1.8rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: #edf1f6;
		font-size: 0.75rem;
		font-weight: 800;
	}
	.work-list {
		display: grid;
		gap: 0.7rem;
	}
	.work-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		border: 1px solid #dce2ea;
		border-radius: 0.75rem;
		background: white;
	}
	.work-card.completed {
		opacity: 0.8;
	}
	.work-icon {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.55rem;
		background: #edf4ff;
		font-weight: 850;
	}
	.work-copy {
		min-width: 0;
	}
	.work-copy h3 {
		margin-top: 0.2rem;
		font-size: 1rem;
	}
	.work-copy p {
		margin: 0.3rem 0 0;
		color: var(--nb-text-muted);
		font-size: 0.86rem;
	}
	.meta-line {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.85rem;
		color: var(--nb-text-muted);
		font-size: 0.74rem;
	}
	.primary-link,
	.secondary-link {
		flex: none;
		border-radius: 0.55rem;
		padding: 0.65rem 0.85rem;
		text-decoration: none;
		font-weight: 800;
	}
	.primary-link {
		background: var(--nb-ink);
		color: white;
	}
	.secondary-link {
		border: 1px solid #cbd2dc;
		background: white;
		color: var(--nb-text);
	}
	.project-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.7rem;
	}
	.project-card {
		padding: 1rem;
		border: 1px solid #dce2ea;
		border-radius: 0.75rem;
		background: white;
	}
	.project-card h3 {
		margin-top: 0.45rem;
	}
	.project-card p {
		margin: 0.35rem 0 0;
	}
	.empty-state,
	.boundary-panel {
		padding: 1rem;
		border: 1px solid #ced9e8;
		border-radius: 0.75rem;
		background: #f6f9fd;
	}
	.empty-state p,
	.boundary-panel p {
		margin: 0.35rem 0 0;
		color: var(--nb-text-muted);
		line-height: 1.5;
	}
	.boundary-panel {
		margin-top: 1.5rem;
	}
	.completed-block {
		margin-top: 1.5rem;
		border: 1px solid #dce2ea;
		border-radius: 0.7rem;
		background: white;
	}
	.completed-block summary {
		padding: 0.8rem 1rem;
		cursor: pointer;
		font-weight: 800;
	}
	.completed-block .work-list {
		padding: 0 0.8rem 0.8rem;
	}
	@media (max-width: 720px) {
		.metrics {
			grid-template-columns: 1fr;
		}
		.work-card {
			grid-template-columns: auto minmax(0, 1fr);
		}
		.work-card > :last-child {
			grid-column: 2;
			justify-self: start;
		}
	}
</style>
