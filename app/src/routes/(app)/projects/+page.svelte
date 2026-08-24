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

	function programmesForPortfolio(portfolioId: string) {
		return data.hierarchy.programmes.filter((programme) => programme.portfolioId === portfolioId);
	}
</script>

<svelte:head>
	<title>Projects · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Project delivery</p>
		<h1>Projects</h1>
		<p>
			Projects visible here require both organisation permission and your active project membership.
		</p>
	</div>
	{#if data.canCreate}<a class="header-action" href="#create-project">Create project</a>{/if}
</section>

{#if data.invitations.length > 0}
	<section class="invitation-panel" aria-labelledby="project-invitations-heading">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Collaboration</p>
				<h2 id="project-invitations-heading">Project invitations</h2>
				<p class="muted">
					Accepting establishes this organisation as an active participant and adds you as its first
					active project member.
				</p>
			</div>
			<span class="count">{data.invitations.length}</span>
		</div>
		<div class="invitation-list">
			{#each data.invitations as invitation}
				<article class="invitation-card">
					<div>
						<div class="card-topline">
							<span class="project-number">{invitation.projectNumber}</span>
							<span>{invitation.owningOrganisationName}</span>
						</div>
						<h3>{invitation.projectName}</h3>
						<div class="role-list" aria-label="Invited project roles">
							{#each invitation.roles as role}<span>{role.name}</span>{/each}
						</div>
						<small>Invited {new Date(invitation.invitedAt).toLocaleDateString()}</small>
					</div>
					<div class="invitation-actions">
						<form method="POST" action="?/acceptInvitation">
							<input type="hidden" name="projectPublicId" value={invitation.projectPublicId} />
							<button type="submit">Accept</button>
						</form>
						<form method="POST" action="?/declineInvitation">
							<input type="hidden" name="projectPublicId" value={invitation.projectPublicId} />
							<button class="secondary" type="submit">Decline</button>
						</form>
					</div>
					{#if form?.invitationError && form.invitationProjectPublicId === invitation.projectPublicId}
						<p class="error invitation-error" role="alert">{form.invitationError}</p>
					{/if}
				</article>
			{/each}
		</div>
	</section>
{/if}

<section id="project-hierarchy" class="hierarchy-panel" aria-labelledby="hierarchy-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Project controls</p>
			<h2 id="hierarchy-heading">Portfolio & programme structure</h2>
			<p class="muted">
				Govern organisation-owned projects through a stable Portfolio → Programme → Project
				hierarchy. Projects may remain standalone where no programme is required.
			</p>
		</div>
		<div class="hierarchy-counts" aria-label="Hierarchy counts">
			<span><strong>{data.hierarchy.portfolios.length}</strong> portfolios</span>
			<span><strong>{data.hierarchy.programmes.length}</strong> programmes</span>
		</div>
	</div>

	{#if data.hierarchy.canViewPortfolios || data.hierarchy.canViewProgrammes}
		<div class="hierarchy-tree">
			{#each data.hierarchy.portfolios as portfolio}
				<article class="portfolio-card">
					<div class="hierarchy-card-heading">
						<div>
							<small>{portfolio.portfolioNumber}</small>
							<h3>{portfolio.name}</h3>
						</div>
						<span class="status">{portfolio.lifecycleStatus}</span>
					</div>
					{#if portfolio.description}<p>{portfolio.description}</p>{/if}
					<div class="programme-list">
						{#each programmesForPortfolio(portfolio.id) as programme}
							<div class="programme-row">
								<span>{programme.programmeNumber}</span>
								<strong>{programme.name}</strong>
							</div>
						{:else}
							<p class="muted compact">No programmes assigned to this portfolio.</p>
						{/each}
					</div>
				</article>
			{/each}

			{#if data.hierarchy.programmes.some((programme) => !programme.portfolioId)}
				<article class="portfolio-card standalone-programmes">
					<div class="hierarchy-card-heading">
						<div>
							<small>Independent programme layer</small>
							<h3>Standalone programmes</h3>
						</div>
					</div>
					<div class="programme-list">
						{#each data.hierarchy.programmes.filter((programme) => !programme.portfolioId) as programme}
							<div class="programme-row">
								<span>{programme.programmeNumber}</span>
								<strong>{programme.name}</strong>
							</div>
						{/each}
					</div>
				</article>
			{/if}

			{#if data.hierarchy.portfolios.length === 0 && data.hierarchy.programmes.length === 0}
				<div class="hierarchy-empty">
					<strong>No portfolio or programme structure yet</strong>
					<p>Create only the levels your organisation actually needs. Existing projects remain valid.</p>
				</div>
			{/if}
		</div>
	{:else}
		<p class="muted">Your current role does not grant organisation-wide portfolio or programme visibility.</p>
	{/if}

	{#if data.hierarchy.canManagePortfolios || data.hierarchy.canManageProgrammes}
		<div class="hierarchy-forms">
			{#if data.hierarchy.canManagePortfolios}
				<form method="POST" action="?/createPortfolio" class="hierarchy-form">
					<h3>Create portfolio</h3>
					<label>
						<span>Portfolio number</span>
						<input
							name="portfolioNumber"
							required
							maxlength="80"
							value={form?.hierarchyAction === 'create-portfolio' ? form.portfolioNumber : ''}
							placeholder="PORT-001"
						/>
					</label>
					<label>
						<span>Portfolio name</span>
						<input
							name="portfolioName"
							required
							maxlength="255"
							value={form?.hierarchyAction === 'create-portfolio' ? form.portfolioName : ''}
							placeholder="Strategic capital programme"
						/>
					</label>
					<label>
						<span>Description <small>optional</small></span>
						<textarea name="portfolioDescription" maxlength="10000" rows="3">{form?.hierarchyAction === 'create-portfolio' ? form.portfolioDescription : ''}</textarea>
					</label>
					{#if form?.hierarchyError && form.hierarchyAction === 'create-portfolio'}
						<p class="error" role="alert">{form.hierarchyError}</p>
					{/if}
					<button type="submit">Create portfolio</button>
				</form>
			{/if}

			{#if data.hierarchy.canManageProgrammes}
				<form method="POST" action="?/createProgramme" class="hierarchy-form">
					<h3>Create programme</h3>
					<label>
						<span>Programme number</span>
						<input
							name="programmeNumber"
							required
							maxlength="80"
							value={form?.hierarchyAction === 'create-programme' ? form.programmeNumber : ''}
							placeholder="PROG-001"
						/>
					</label>
					<label>
						<span>Programme name</span>
						<input
							name="programmeName"
							required
							maxlength="255"
							value={form?.hierarchyAction === 'create-programme' ? form.programmeName : ''}
							placeholder="Regional delivery programme"
						/>
					</label>
					<label>
						<span>Portfolio <small>optional</small></span>
						<select name="portfolioPublicId">
							<option value="">No portfolio</option>
							{#each data.hierarchy.portfolios as portfolio}
								<option
									value={portfolio.publicId}
									selected={form?.hierarchyAction === 'create-programme' && form.portfolioPublicId === portfolio.publicId}
								>{portfolio.portfolioNumber} · {portfolio.name}</option
								>
							{/each}
						</select>
					</label>
					<label>
						<span>Description <small>optional</small></span>
						<textarea name="programmeDescription" maxlength="10000" rows="3">{form?.hierarchyAction === 'create-programme' ? form.programmeDescription : ''}</textarea>
					</label>
					{#if form?.hierarchyError && form.hierarchyAction === 'create-programme'}
						<p class="error" role="alert">{form.hierarchyError}</p>
					{/if}
					<button type="submit">Create programme</button>
				</form>
			{/if}
		</div>
	{/if}
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
					Projects appear here only when you are an active project member. Creating a project adds
					you as its first project member automatically.
				</p>
			</div>
		{:else}
			<div class="project-grid">
				{#each data.projects as project}
					<a class="project-card" href={`/projects/${project.publicId}`}>
						<div class="card-topline">
							<span class="project-number">{project.projectNumber}</span>
							<span class={`status status-${project.status}`}
								>{statusLabels[project.status] ?? project.status}</span
							>
						</div>
						<div class="project-context">
							{#if project.hierarchy?.programmeName}
								{#if project.hierarchy.portfolioName}
									<span>{project.hierarchy.portfolioName}</span><span aria-hidden="true">/</span>
								{/if}
								<strong>{project.hierarchy.programmeName}</strong>
							{:else}
								<span>Standalone project</span>
							{/if}
						</div>
						<h2>{project.name}</h2>
						{#if project.description}<p>{project.description}</p>{/if}
						<div class="card-meta">
							{#if project.startedOn}<span
									>Started {new Date(project.startedOn).toLocaleDateString()}</span
								>{/if}
							{#if project.completedOn}<span
									>Completed {new Date(project.completedOn).toLocaleDateString()}</span
								>{/if}
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
			The creating organisation becomes the project owner and first participant. You become the
			first active project member. Programme assignment can be controlled from the project record.
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
		<p class="muted">
			You do not have the <code>project.create</code> permission in this organisation.
		</p>
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
	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.04em;
	}
	.page-header p:last-child,
	.muted {
		color: #5d5d57;
		line-height: 1.6;
	}
	.muted.compact {
		margin: 0;
		font-size: 0.82rem;
	}
	.header-action,
	button {
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
	button.secondary {
		background: white;
		color: #222;
		border-color: #aaa;
	}
	.notice,
	.empty-state,
	.create-panel,
	.invitation-panel,
	.hierarchy-panel {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.25rem;
	}
	.notice,
	.empty-state,
	.invitation-panel,
	.hierarchy-panel {
		margin-bottom: 1rem;
	}
	.notice h2,
	.empty-state h2,
	.create-panel h2,
	.invitation-panel h2,
	.hierarchy-panel h2 {
		margin-top: 0;
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
		margin-bottom: 1rem;
	}
	.count {
		min-width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		background: #f0f0eb;
		font-weight: 750;
	}
	.hierarchy-counts {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: end;
	}
	.hierarchy-counts span {
		padding: 0.45rem 0.65rem;
		border-radius: 999px;
		background: #f0f0eb;
		font-size: 0.78rem;
	}
	.hierarchy-tree {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 0.75rem;
	}
	.portfolio-card,
	.hierarchy-empty {
		padding: 1rem;
		border: 1px solid #deded7;
		border-radius: 0.65rem;
		background: #fafaf7;
	}
	.hierarchy-card-heading {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: start;
	}
	.hierarchy-card-heading small,
	.project-context {
		color: #74746d;
		font-size: 0.75rem;
	}
	.hierarchy-card-heading h3 {
		margin: 0.25rem 0 0;
	}
	.portfolio-card > p {
		color: #666;
		font-size: 0.84rem;
		line-height: 1.5;
	}
	.programme-list {
		display: grid;
		gap: 0.4rem;
		margin-top: 0.85rem;
	}
	.programme-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.65rem;
		padding: 0.6rem;
		border-radius: 0.45rem;
		background: white;
		font-size: 0.82rem;
	}
	.programme-row span {
		color: #74746d;
		font-weight: 700;
	}
	.hierarchy-forms {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e5df;
	}
	.hierarchy-form {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 0.65rem;
		background: #f7f7f3;
	}
	.hierarchy-form h3 {
		margin: 0;
	}
	.hierarchy-form label,
	.project-form label {
		display: grid;
		gap: 0.4rem;
		font-weight: 650;
	}
	.hierarchy-form input,
	.hierarchy-form textarea,
	.hierarchy-form select,
	.project-form input,
	.project-form textarea {
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.5rem;
		padding: 0.72rem;
		background: white;
	}
	.hierarchy-form button,
	.project-form button {
		justify-self: start;
	}
	.invitation-list {
		display: grid;
		gap: 0.75rem;
	}
	.invitation-card {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1rem;
		align-items: center;
		padding: 1rem;
		border: 1px solid #deded7;
		border-radius: 0.65rem;
		background: #fafaf7;
	}
	.invitation-card h3 {
		margin: 0.45rem 0;
	}
	.invitation-card small {
		display: block;
		margin-top: 0.55rem;
		color: #6b6b65;
	}
	.invitation-actions {
		display: flex;
		gap: 0.55rem;
	}
	.invitation-error {
		grid-column: 1 / -1;
	}
	.role-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.role-list span {
		border-radius: 999px;
		background: #ecece6;
		padding: 0.24rem 0.48rem;
		font-size: 0.75rem;
		font-weight: 650;
	}
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
		transition:
			border-color 120ms ease,
			transform 120ms ease;
	}
	.project-card:hover,
	.project-card:focus-visible {
		border-color: #777;
		transform: translateY(-1px);
	}
	.card-topline {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		color: #666;
		font-size: 0.8rem;
	}
	.project-number {
		font-size: 0.8rem;
		font-weight: 750;
		color: #666;
	}
	.project-context {
		display: flex;
		gap: 0.35rem;
		margin-top: 0.85rem;
		flex-wrap: wrap;
	}
	.project-card h2 {
		margin: 0.45rem 0 0.55rem;
		font-size: 1.25rem;
	}
	.project-card p {
		color: #5d5d57;
		line-height: 1.5;
	}
	.status {
		font-size: 0.72rem;
		font-weight: 750;
		padding: 0.28rem 0.48rem;
		border-radius: 999px;
		background: #ecece6;
	}
	.status-active {
		background: #e4f5e8;
	}
	.status-on_hold {
		background: #fff1cd;
	}
	.status-completed {
		background: #e5eef9;
	}
	.status-cancelled,
	.status-archived {
		background: #ececec;
		color: #666;
	}
	.card-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		font-size: 0.78rem;
		color: #777;
	}
	.create-panel {
		display: grid;
		grid-template-columns: minmax(14rem, 0.75fr) minmax(20rem, 1.25fr);
		gap: 2rem;
		align-items: start;
	}
	.project-form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}
	.project-form small,
	.hierarchy-form small {
		color: #777;
		font-weight: 500;
	}
	.project-form input:focus,
	.project-form textarea:focus,
	.hierarchy-form input:focus,
	.hierarchy-form textarea:focus,
	.hierarchy-form select:focus {
		outline: 2px solid #222;
		outline-offset: 2px;
	}
	.full {
		grid-column: 1 / -1;
	}
	.error {
		color: #9b1c1c;
		margin: 0;
	}
	@media (max-width: 820px) {
		.page-header,
		.section-heading {
			display: block;
		}
		.header-action {
			display: inline-block;
			margin-top: 0.5rem;
		}
		.hierarchy-counts {
			justify-content: start;
			margin-top: 0.75rem;
		}
		.hierarchy-forms,
		.create-panel {
			grid-template-columns: 1fr;
		}
		.project-form {
			grid-template-columns: 1fr;
		}
		.full {
			grid-column: auto;
		}
		.invitation-card {
			grid-template-columns: 1fr;
		}
		.invitation-actions {
			justify-content: start;
		}
	}
</style>
