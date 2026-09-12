<script lang="ts">
	let { data, form } = $props();

	const dateText = (value: Date | string | null) =>
		value ? new Date(value).toLocaleDateString('en-GB') : 'Open ended';
</script>

<svelte:head>
	<title>People · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Business OS · Workforce</p>
		<h1>People</h1>
		<p>
			Manage workforce identity, engagement, competencies and project staffing without conflating
			login, CRM and employment records.
		</p>
	</div>
	<div class="header-metrics" aria-label="Workforce summary">
		<strong>{data.workers.length}</strong>
		<span>active workforce records</span>
	</div>
</section>

{#if form?.error}
	<p class="error-banner" role="alert">{form.error}</p>
{/if}

{#if !data.canView}
	<section class="notice">
		<h2>Workforce access is not enabled</h2>
		<p>Your current role does not grant access to workforce records.</p>
	</section>
{:else}
	<section class="workspace-grid">
		<div class="main-column">
			<section class="panel" aria-labelledby="workforce-directory-heading">
				<div class="section-heading">
					<div>
						<p class="eyebrow">Directory</p>
						<h2 id="workforce-directory-heading">Workforce directory</h2>
					</div>
					<span class="count">{data.workers.length}</span>
				</div>

				{#if data.workers.length === 0}
					<div class="empty-state">
						<h3>No workforce records yet</h3>
						<p>
							Link active organisation members to workforce records to begin staffing and scheduling
							work.
						</p>
					</div>
				{:else}
					<div class="worker-list">
						{#each data.workers as worker}
							<article class="worker-card">
								<div class="worker-heading">
									<div class="avatar" aria-hidden="true">
										{worker.displayName.slice(0, 1).toUpperCase()}
									</div>
									<div>
										<h3>{worker.displayName}</h3>
										<p>
											{worker.engagement?.jobTitle ??
												worker.engagement?.engagementTypeName ??
												'Workforce member'}
										</p>
									</div>
									<span class={`status status-${worker.status}`}>{worker.status}</span>
								</div>

								<dl class="worker-facts">
									<div>
										<dt>Worker no.</dt>
										<dd>{worker.workerNumber ?? '—'}</dd>
									</div>
									<div>
										<dt>Team</dt>
										<dd>{worker.engagement?.teamName ?? 'Unassigned'}</dd>
									</div>
									<div>
										<dt>Engagement</dt>
										<dd>{worker.engagement?.engagementTypeName ?? '—'}</dd>
									</div>
									<div>
										<dt>Started</dt>
										<dd>{worker.engagement ? dateText(worker.engagement.startedOn) : '—'}</dd>
									</div>
								</dl>

								<div class="competency-strip" aria-label={`Competencies for ${worker.displayName}`}>
									{#if worker.competencies.length === 0}
										<span class="muted">No competency evidence recorded</span>
									{:else}
										{#each worker.competencies as competency}
											<span class="competency-chip">
												{competency.competencyName}
												{#if competency.validTo}<small>to {dateText(competency.validTo)}</small
													>{/if}
											</span>
										{/each}
									{/if}
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</section>

			<section class="panel" aria-labelledby="staffing-heading">
				<div class="section-heading">
					<div>
						<p class="eyebrow">Project delivery</p>
						<h2 id="staffing-heading">Project staffing</h2>
					</div>
					<span class="count">{data.projectAssignments.length}</span>
				</div>
				{#if data.projectAssignments.length === 0}
					<p class="muted">No active project resource assignments.</p>
				{:else}
					<div class="table-wrap">
						<table>
							<thead
								><tr
									><th>Project</th><th>Worker</th><th>Allocation</th><th>Period</th><th>Status</th
									></tr
								></thead
							>
							<tbody>
								{#each data.projectAssignments as assignment}
									<tr>
										<td
											><strong>{assignment.projectNumber}</strong><span
												>{assignment.projectName}</span
											></td
										>
										<td>{assignment.workerName}</td>
										<td
											>{assignment.plannedAllocationPercent
												? `${assignment.plannedAllocationPercent}%`
												: 'Not set'}</td
										>
										<td
											>{assignment.startsOn ? dateText(assignment.startsOn) : 'Open'} → {assignment.endsOn
												? dateText(assignment.endsOn)
												: 'Open'}</td
										>
										<td><span class="status">{assignment.status}</span></td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>
		</div>

		<aside class="side-column" aria-label="Workforce actions">
			{#if data.canManage}
				<section class="panel action-panel" id="create-worker">
					<p class="eyebrow">Workforce identity</p>
					<h2>Add workforce member</h2>
					<p class="muted">
						Creates a workforce relationship for an existing active organisation member.
					</p>
					{#if data.memberCandidates.length === 0}
						<p class="empty-inline">
							Every active organisation member already has a workforce record.
						</p>
					{:else}
						<form method="POST" action="?/createWorker" class="stack-form">
							<label
								>Organisation member<select name="memberPublicId" required
									><option value="">Select member</option
									>{#each data.memberCandidates as member}<option value={member.memberPublicId}
											>{member.displayName}</option
										>{/each}</select
								></label
							>
							<div class="two-up">
								<label>Worker number<input name="workerNumber" maxlength="80" /></label>
								<label>Start date<input name="startedOn" type="date" required /></label>
							</div>
							<label
								>Engagement type<select name="engagementTypeCode" required
									><option value="">Select type</option>{#each data.engagementTypes as type}<option
											value={type.code}>{type.name}</option
										>{/each}</select
								></label
							>
							<label>Job title<input name="jobTitle" maxlength="200" /></label>
							<label
								>Primary team<select name="teamPublicId"
									><option value="">No team</option>{#each data.teams as team}<option
											value={team.publicId}>{team.name}</option
										>{/each}</select
								></label
							>
							<button type="submit">Add workforce member</button>
						</form>
					{/if}
				</section>
			{/if}

			{#if data.canManageAssignments && data.workers.length > 0 && data.projects.length > 0}
				<section class="panel action-panel">
					<p class="eyebrow">Resourcing</p>
					<h2>Staff a project</h2>
					<form method="POST" action="?/assignProject" class="stack-form">
						<label
							>Worker<select name="workerPublicId" required
								><option value="">Select worker</option>{#each data.workers as worker}<option
										value={worker.publicId}>{worker.displayName}</option
									>{/each}</select
							></label
						>
						<label
							>Project<select name="projectPublicId" required
								><option value="">Select project</option>{#each data.projects as project}<option
										value={project.publicId}>{project.projectNumber} · {project.name}</option
									>{/each}</select
							></label
						>
						<div class="two-up">
							<label>Starts<input name="startsOn" type="date" /></label>
							<label>Ends<input name="endsOn" type="date" /></label>
						</div>
						<label
							>Planned allocation %<input
								name="plannedAllocationPercent"
								inputmode="decimal"
								placeholder="100"
							/></label
						>
						<button type="submit">Create assignment</button>
					</form>
				</section>
			{/if}

			{#if data.canManageCompetencies}
				<section class="panel action-panel">
					<p class="eyebrow">Competence</p>
					<h2>Competency library</h2>
					<form method="POST" action="?/createCompetency" class="stack-form compact-form">
						<div class="two-up">
							<label>Code<input name="code" maxlength="80" required /></label><label
								>Name<input name="name" maxlength="200" required /></label
							>
						</div>
						<label>Description<textarea name="description" rows="2"></textarea></label>
						<label class="check"
							><input type="checkbox" name="requiresExpiry" /> Requires expiry date</label
						>
						<button class="secondary" type="submit">Add competency type</button>
					</form>

					{#if data.workers.length > 0 && data.competencyTypes.length > 0}
						<hr />
						<h3>Assign competency</h3>
						<form method="POST" action="?/assignCompetency" class="stack-form compact-form">
							<label
								>Worker<select name="workerPublicId" required
									><option value="">Select worker</option>{#each data.workers as worker}<option
											value={worker.publicId}>{worker.displayName}</option
										>{/each}</select
								></label
							>
							<label
								>Competency<select name="competencyTypePublicId" required
									><option value="">Select competency</option
									>{#each data.competencyTypes as competency}<option value={competency.publicId}
											>{competency.name}</option
										>{/each}</select
								></label
							>
							<label>Proficiency / level<input name="proficiencyLevel" maxlength="64" /></label>
							<div class="two-up">
								<label>Valid from<input name="validFrom" type="date" /></label><label
									>Valid to<input name="validTo" type="date" /></label
								>
							</div>
							<button class="secondary" type="submit">Record competency</button>
						</form>
					{/if}
				</section>
			{/if}
		</aside>
	</section>
{/if}

<style>
	.page-header {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: flex-end;
		margin-bottom: 1.5rem;
	}
	.page-header h1,
	.section-heading h2,
	.action-panel h2 {
		margin: 0.15rem 0 0.35rem;
	}
	.page-header p {
		max-width: 52rem;
		margin: 0.25rem 0 0;
		color: var(--text-muted);
	}
	.eyebrow {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--brand-blue);
	}
	.header-metrics {
		min-width: 9rem;
		padding: 1rem 1.15rem;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		box-shadow: var(--shadow-sm);
	}
	.header-metrics strong {
		display: block;
		font-size: 1.8rem;
	}
	.header-metrics span,
	.muted {
		color: var(--text-muted);
	}
	.error-banner,
	.notice {
		padding: 1rem 1.1rem;
		border-radius: var(--radius-md);
		margin-bottom: 1rem;
	}
	.error-banner {
		color: var(--danger-strong, #8b1e1e);
		background: #fff2f1;
		border: 1px solid #efb5b1;
	}
	.notice {
		border: 1px solid var(--border-subtle);
		background: var(--surface-raised);
	}
	.workspace-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
		gap: 1.25rem;
		align-items: start;
	}
	.main-column,
	.side-column {
		display: grid;
		gap: 1.25rem;
		min-width: 0;
	}
	.panel {
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		background: var(--surface-raised);
		padding: 1.15rem;
		box-shadow: var(--shadow-sm);
		min-width: 0;
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	.count {
		display: grid;
		place-items: center;
		min-width: 2rem;
		height: 2rem;
		padding: 0 0.55rem;
		border-radius: 999px;
		background: var(--surface-accent);
		font-weight: 800;
	}
	.worker-list {
		display: grid;
		gap: 0.8rem;
	}
	.worker-card {
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		padding: 1rem;
		background: var(--surface-base);
	}
	.worker-heading {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.75rem;
		align-items: center;
	}
	.worker-heading h3 {
		margin: 0;
	}
	.worker-heading p {
		margin: 0.15rem 0 0;
		color: var(--text-muted);
	}
	.avatar {
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 0.7rem;
		display: grid;
		place-items: center;
		font-weight: 900;
		background: var(--brand-ink);
		color: white;
	}
	.status {
		display: inline-flex;
		width: max-content;
		border-radius: 999px;
		padding: 0.2rem 0.55rem;
		font-size: 0.75rem;
		font-weight: 750;
		background: var(--surface-accent);
		text-transform: capitalize;
	}
	.status-active {
		background: #e8f7ef;
		color: #14633b;
	}
	.worker-facts {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.7rem;
		margin: 1rem 0;
	}
	.worker-facts div {
		min-width: 0;
	}
	.worker-facts dt {
		color: var(--text-muted);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.worker-facts dd {
		margin: 0.2rem 0 0;
		font-weight: 650;
		overflow-wrap: anywhere;
	}
	.competency-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.competency-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--border-subtle);
		border-radius: 999px;
		font-size: 0.78rem;
	}
	.competency-chip small {
		color: var(--text-muted);
	}
	.empty-state,
	.empty-inline {
		padding: 1rem;
		border-radius: var(--radius-md);
		background: var(--surface-soft);
	}
	.empty-state h3 {
		margin-top: 0;
	}
	.table-wrap {
		overflow: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 46rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.7rem 0.6rem;
		border-bottom: 1px solid var(--border-subtle);
		vertical-align: top;
	}
	th {
		color: var(--text-muted);
		font-size: 0.74rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	td span {
		display: block;
		color: var(--text-muted);
		font-size: 0.82rem;
		margin-top: 0.12rem;
	}
	.stack-form {
		display: grid;
		gap: 0.8rem;
		margin-top: 1rem;
	}
	.stack-form label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.82rem;
		font-weight: 700;
	}
	.stack-form input,
	.stack-form select,
	.stack-form textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--border-strong);
		background: var(--surface-base);
		color: var(--text-primary);
		border-radius: var(--radius-sm);
		padding: 0.65rem 0.7rem;
		font: inherit;
	}
	.stack-form textarea {
		resize: vertical;
	}
	.two-up {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
	}
	.check {
		display: flex !important;
		grid-template-columns: none;
		align-items: center;
		gap: 0.5rem !important;
	}
	.check input {
		width: auto;
	}
	button {
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--brand-blue);
		color: white;
		padding: 0.68rem 0.8rem;
		font: inherit;
		font-weight: 800;
		cursor: pointer;
	}
	button.secondary {
		background: var(--brand-ink);
	}
	hr {
		border: 0;
		border-top: 1px solid var(--border-subtle);
		margin: 1.15rem 0;
	}
	.action-panel h3 {
		margin: 0.6rem 0 0;
	}
	@media (max-width: 980px) {
		.workspace-grid {
			grid-template-columns: 1fr;
		}
		.side-column {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.action-panel:last-child:nth-child(odd) {
			grid-column: 1/-1;
		}
	}
	@media (max-width: 700px) {
		.page-header {
			display: grid;
			align-items: start;
		}
		.header-metrics {
			width: 100%;
			box-sizing: border-box;
		}
		.worker-facts {
			grid-template-columns: 1fr 1fr;
		}
		.side-column,
		.two-up {
			grid-template-columns: 1fr;
		}
		.worker-heading {
			grid-template-columns: auto 1fr;
		}
		.worker-heading .status {
			grid-column: 2;
		}
		.panel {
			padding: 0.9rem;
		}
	}
</style>
