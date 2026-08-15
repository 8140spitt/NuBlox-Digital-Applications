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

	const transitionLabels: Record<string, string> = {
		active: 'Set active',
		on_hold: 'Put on hold',
		completed: 'Complete project',
		cancelled: 'Cancel project',
		archived: 'Archive project'
	};
</script>

<svelte:head>
	<title>{data.project.name} · Projects · NuBlox</title>
</svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/projects">Projects</a>
	<span aria-hidden="true">/</span>
	<span>{data.project.projectNumber}</span>
</nav>

<section class="project-header">
	<div>
		<div class="header-meta">
			<span class="project-number">{data.project.projectNumber}</span>
			<span class={`status status-${data.project.status}`}>
				{statusLabels[data.project.status] ?? data.project.status}
			</span>
		</div>
		<h1>{data.project.name}</h1>
		{#if data.project.description}<p>{data.project.description}</p>{/if}
	</div>
</section>

<div class="workspace-grid">
	<section class="panel overview">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Overview</p>
				<h2>Project record</h2>
			</div>
		</div>
		<dl>
			<div><dt>Project number</dt><dd>{data.project.projectNumber}</dd></div>
			<div><dt>Status</dt><dd>{statusLabels[data.project.status] ?? data.project.status}</dd></div>
			<div>
				<dt>Ownership</dt>
				<dd>{data.isOwningOrganisation ? 'Owned by this organisation' : 'Participating organisation'}</dd>
			</div>
			<div>
				<dt>Started</dt>
				<dd>{data.project.startedOn ? new Date(data.project.startedOn).toLocaleDateString() : 'Not started'}</dd>
			</div>
			<div>
				<dt>Completed</dt>
				<dd>{data.project.completedOn ? new Date(data.project.completedOn).toLocaleDateString() : 'Not completed'}</dd>
			</div>
		</dl>
	</section>

	<section class="panel participants">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Participants</p>
				<h2>Project organisations</h2>
			</div>
			<span class="count">{data.participants.length}</span>
		</div>
		<div class="participant-list">
			{#each data.participants as participant}
				<div class="participant">
					<div>
						<strong>{participant.organisationName}</strong>
						<small>{participant.organisationId === data.project.owningOrganisationId ? 'Project owner' : 'Participant'}</small>
					</div>
					<span>{participant.status}</span>
				</div>
			{/each}
		</div>
		<p class="hint">Participant administration will be added as a separate permission-controlled workflow.</p>
	</section>

	<section class="panel lifecycle">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Lifecycle</p>
				<h2>Project status</h2>
			</div>
		</div>

		{#if form?.transitionError}<p class="error" role="alert">{form.transitionError}</p>{/if}

		{#if data.canManageLifecycle && data.allowedTransitions.length > 0}
			<p class="muted">Choose a valid transition from the current <strong>{statusLabels[data.project.status]}</strong> state.</p>
			<div class="transition-list">
				{#each data.allowedTransitions as target}
					<form method="POST" action="?/transition" class="transition-form">
						<input type="hidden" name="toStatus" value={target} />
						{#if target === 'active' || target === 'completed'}
							<label>
								<span>Effective date</span>
								<input type="date" name="effectiveDate" />
							</label>
						{/if}
						<button class:danger={target === 'cancelled'} type="submit">
							{transitionLabels[target] ?? target}
						</button>
					</form>
				{/each}
			</div>
		{:else if data.canManageLifecycle}
			<p class="muted">No further lifecycle transitions are available from this state.</p>
		{:else if !data.isOwningOrganisation}
			<p class="muted">Only the owning organisation can change this project's lifecycle.</p>
		{:else}
			<p class="muted">You do not have the <code>project.manage</code> permission for this project.</p>
		{/if}
	</section>

	<section class="panel modules">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Workspace</p>
				<h2>Project modules</h2>
			</div>
		</div>
		<div class="module-grid">
			<div><strong>Information</strong><span>Controlled documents, RFIs, submittals and instructions</span></div>
			<div><strong>Commercial</strong><span>Cost control, change, valuations and forecasting</span></div>
			<div><strong>Site</strong><span>Diaries, quality, safety and field evidence</span></div>
			<div><strong>Assets</strong><span>Asset handover, maintenance and operational records</span></div>
		</div>
		<p class="hint">These domain modules are represented in the relational baseline and will be activated through subsequent application slices.</p>
	</section>
</div>

<style>
	.breadcrumbs { display: flex; gap: 0.55rem; align-items: center; margin-bottom: 1.1rem; color: #686862; font-size: 0.9rem; }
	.breadcrumbs a { color: inherit; font-weight: 650; }
	.project-header { margin-bottom: 1.5rem; }
	.header-meta { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.5rem; }
	.project-number { font-weight: 750; color: #62625c; }
	h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.2rem); letter-spacing: -0.045em; }
	.project-header p { max-width: 60rem; color: #5d5d57; line-height: 1.6; }
	.status { font-size: 0.72rem; font-weight: 750; padding: 0.28rem 0.48rem; border-radius: 999px; background: #ecece6; }
	.status-active { background: #e4f5e8; }
	.status-on_hold { background: #fff1cd; }
	.status-completed { background: #e5eef9; }
	.status-cancelled, .status-archived { background: #ececec; color: #666; }
	.workspace-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; }
	.panel { background: white; border: 1px solid #d9d9d2; border-radius: 0.8rem; padding: 1.25rem; }
	.panel-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: start; margin-bottom: 1rem; }
	.eyebrow { margin: 0 0 0.28rem; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.72rem; font-weight: 750; color: #666; }
	.panel h2 { margin: 0; }
	.count { min-width: 2rem; height: 2rem; display: grid; place-items: center; border-radius: 999px; background: #f0f0eb; font-weight: 750; }
	dl { display: grid; gap: 0.75rem; margin: 0; }
	dl div { display: grid; grid-template-columns: 8rem 1fr; gap: 1rem; }
	dt { color: #6a6a64; }
	dd { margin: 0; font-weight: 650; }
	.participant-list { display: grid; gap: 0.6rem; }
	.participant { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 0.8rem; border: 1px solid #e1e1db; border-radius: 0.55rem; }
	.participant div { display: grid; gap: 0.18rem; }
	.participant small, .participant > span { color: #6b6b65; font-size: 0.78rem; }
	.hint, .muted { color: #65655f; line-height: 1.55; font-size: 0.9rem; }
	.hint { margin-bottom: 0; }
	.transition-list { display: grid; gap: 0.75rem; }
	.transition-form { display: flex; flex-wrap: wrap; align-items: end; gap: 0.75rem; padding: 0.75rem; border: 1px solid #e0e0da; border-radius: 0.55rem; }
	.transition-form label { display: grid; gap: 0.3rem; font-size: 0.82rem; font-weight: 650; }
	.transition-form input[type='date'] { font: inherit; border: 1px solid #b9b9b1; border-radius: 0.45rem; padding: 0.55rem; }
	button { font: inherit; font-weight: 750; border: 1px solid #111; border-radius: 0.5rem; padding: 0.65rem 0.9rem; background: #111; color: white; cursor: pointer; }
	button.danger { background: #8f2222; border-color: #8f2222; }
	.error { color: #9b1c1c; }
	.modules { grid-column: 1 / -1; }
	.module-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.7rem; }
	.module-grid div { display: grid; gap: 0.35rem; padding: 0.85rem; border: 1px solid #e0e0da; border-radius: 0.55rem; background: #fafaf7; }
	.module-grid span { color: #666; font-size: 0.85rem; line-height: 1.45; }
	@media (max-width: 920px) {
		.workspace-grid { grid-template-columns: 1fr; }
		.modules { grid-column: auto; }
		.module-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (max-width: 560px) {
		dl div { grid-template-columns: 1fr; gap: 0.15rem; }
		.module-grid { grid-template-columns: 1fr; }
	}
</style>
