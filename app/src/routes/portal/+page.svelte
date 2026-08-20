<script lang="ts">
	let { data, form } = $props();

	const reviewOutcomes = [
		['approved', 'Approved'],
		['approved_with_comments', 'Approved with comments'],
		['revise_resubmit', 'Revise and resubmit'],
		['rejected', 'Rejected'],
		['no_objection', 'No objection'],
		['for_information', 'For information']
	] as const;

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

	let openRfis = $derived(data.rfis.filter((row) => ['open', 'reopened'].includes(row.status)));
	let pendingSubmittals = $derived(
		data.submittals.filter((row) => ['submitted', 'under_review'].includes(row.status))
	);
	let pendingInstructions = $derived(data.instructions.filter((row) => !row.acknowledgedAt));
	let actionCount = $derived(
		openRfis.length +
			pendingSubmittals.length +
			pendingInstructions.length +
			data.invitations.length
	);
</script>

<section class="hero">
	<div>
		<p class="eyebrow">Collaboration portal</p>
		<h1>Shared work</h1>
		<p class="lede">
			Everything another project organisation has explicitly sent or assigned to your team, in one
			place.
		</p>
	</div>
	{#if data.canManage}
		<a class="manage-link" href="/portal/manage">Manage sharing</a>
	{/if}
</section>

<section class="metrics" aria-label="Shared work summary">
	<article>
		<strong>{actionCount}</strong>
		<span>Need attention</span>
	</article>
	<article>
		<strong>{data.projects.length}</strong>
		<span>Shared projects</span>
	</article>
	<article>
		<strong>{data.transmittals.length}</strong>
		<span>Information issues</span>
	</article>
</section>

{#if form?.message}
	<p class="form-message" role="alert">{form.message}</p>
{/if}

{#if data.invitations.length}
	<section class="section-block" aria-labelledby="invitations-heading">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Invitations</p>
				<h2 id="invitations-heading">Join a shared project</h2>
			</div>
			<span class="count-badge">{data.invitations.length}</span>
		</div>
		<div class="card-list">
			{#each data.invitations as invitation (invitation.projectPublicId)}
				<article class="work-card invitation-card">
					<div class="card-copy">
						<div class="meta-line">
							<span>{invitation.projectNumber}</span>
							<span>From {invitation.owningOrganisationName}</span>
						</div>
						<h3>{invitation.projectName}</h3>
						{#if invitation.roles.length}
							<p class="muted">Role: {invitation.roles.map((role) => role.name).join(', ')}</p>
						{/if}
						{#if form?.action === 'invitation' && form?.subjectPublicId === invitation.projectPublicId}
							<p class="inline-error" role="alert">{form.message}</p>
						{/if}
					</div>
					<div class="inline-actions">
						<form method="POST" action="?/acceptInvitation">
							<input type="hidden" name="projectPublicId" value={invitation.projectPublicId} />
							<button class="primary" type="submit">Accept</button>
						</form>
						<form method="POST" action="?/declineInvitation">
							<input type="hidden" name="projectPublicId" value={invitation.projectPublicId} />
							<button class="secondary" type="submit">Decline</button>
						</form>
					</div>
				</article>
			{/each}
		</div>
	</section>
{/if}

<section class="section-block" aria-labelledby="actions-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Action inbox</p>
			<h2 id="actions-heading">What needs your team</h2>
		</div>
		<span class="count-badge"
			>{openRfis.length + pendingSubmittals.length + pendingInstructions.length}</span
		>
	</div>

	{#if !openRfis.length && !pendingSubmittals.length && !pendingInstructions.length}
		<div class="empty-state">
			<strong>You’re clear.</strong>
			<p>No shared RFI, submittal or instruction currently needs action.</p>
		</div>
	{:else}
		<div class="action-grid">
			{#each openRfis as rfi (rfi.publicId)}
				<article class="work-card">
					<div class="card-type">RFI · {rfi.rfiNumber}</div>
					<h3>{rfi.subject}</h3>
					<p class="question">{rfi.question}</p>
					<div class="meta-grid">
						<span><strong>Project</strong>{rfi.projectNumber} · {rfi.projectName}</span>
						<span><strong>From</strong>{rfi.owningOrganisationName}</span>
						<span><strong>Due</strong>{dateTime(rfi.dueAt)}</span>
						<span><strong>Priority</strong>{titleCase(rfi.priority)}</span>
					</div>
					{#if rfi.latestResponse}
						<div class="previous-response">
							<strong>Your latest response</strong>
							<p>{rfi.latestResponse}</p>
						</div>
					{/if}
					{#if form?.action === 'rfi' && form?.subjectPublicId === rfi.publicId}
						<p class="inline-error" role="alert">{form.message}</p>
					{/if}
					{#if data.canRespond}
						<details>
							<summary>Respond to RFI</summary>
							<form class="response-form" method="POST" action="?/respondRfi">
								<input type="hidden" name="rfiPublicId" value={rfi.publicId} />
								<label>
									<span>Response</span>
									<textarea name="responseText" rows="5" required maxlength="20000"></textarea>
								</label>
								<label class="checkbox-row">
									<input type="checkbox" name="final" checked />
									<span>Mark this as the final response</span>
								</label>
								<button class="primary" type="submit">Send response</button>
							</form>
						</details>
					{/if}
				</article>
			{/each}

			{#each pendingSubmittals as submittal (submittal.publicId)}
				<article class="work-card">
					<div class="card-type">Submittal · {submittal.number}</div>
					<h3>{submittal.title}</h3>
					<div class="meta-grid">
						<span><strong>Project</strong>{submittal.projectNumber} · {submittal.projectName}</span>
						<span><strong>From</strong>{submittal.owningOrganisationName}</span>
						<span><strong>Type</strong>{submittal.typeName}</span>
						<span
							><strong>Review due</strong>{dateTime(
								submittal.reviewerDueAt ?? submittal.dueAt
							)}</span
						>
					</div>
					{#if form?.action === 'submittal' && form?.subjectPublicId === submittal.publicId}
						<p class="inline-error" role="alert">{form.message}</p>
					{/if}
					{#if data.canRespond}
						<details>
							<summary>Review submittal</summary>
							<form class="response-form" method="POST" action="?/reviewSubmittal">
								<input type="hidden" name="submittalPublicId" value={submittal.publicId} />
								<label>
									<span>Outcome</span>
									<select name="outcome" required>
										<option value="">Choose outcome</option>
										{#each reviewOutcomes as outcome}
											<option value={outcome[0]}>{outcome[1]}</option>
										{/each}
									</select>
								</label>
								<label>
									<span>Comments <small>optional</small></span>
									<textarea name="comments" rows="4" maxlength="20000"></textarea>
								</label>
								<button class="primary" type="submit">Submit review</button>
							</form>
						</details>
					{/if}
				</article>
			{/each}

			{#each pendingInstructions as instruction (instruction.publicId)}
				<article class="work-card">
					<div class="card-type">Instruction · {instruction.number}</div>
					<h3>{instruction.subject}</h3>
					<p class="question">{instruction.instructionText}</p>
					<div class="meta-grid">
						<span
							><strong>Project</strong>{instruction.projectNumber} · {instruction.projectName}</span
						>
						<span><strong>From</strong>{instruction.issuingOrganisationName}</span>
						<span><strong>Type</strong>{instruction.typeName}</span>
						<span><strong>Issued</strong>{dateTime(instruction.issuedAt)}</span>
					</div>
					{#if form?.action === 'instruction' && form?.subjectPublicId === instruction.publicId}
						<p class="inline-error" role="alert">{form.message}</p>
					{/if}
					{#if data.canRespond}
						<form method="POST" action="?/acknowledgeInstruction">
							<input type="hidden" name="instructionPublicId" value={instruction.publicId} />
							<button class="primary" type="submit">Acknowledge instruction</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<section class="section-block" aria-labelledby="information-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Shared information</p>
			<h2 id="information-heading">Issued to your organisation</h2>
		</div>
		<span class="count-badge">{data.transmittals.length}</span>
	</div>
	{#if data.transmittals.length}
		<div class="card-list">
			{#each data.transmittals as transmittal (transmittal.publicId)}
				<article class="work-card compact-card">
					<div class="card-copy">
						<div class="meta-line">
							<span>{transmittal.transmittalNumber}</span>
							<span>{dateTime(transmittal.issuedAt)}</span>
						</div>
						<h3>{transmittal.subject}</h3>
						<p class="muted">
							{transmittal.projectNumber} · {transmittal.projectName} · From {transmittal.issuingOrganisationName}
						</p>
						{#if transmittal.purpose}<p class="muted">Purpose: {transmittal.purpose}</p>{/if}
					</div>
					<ul class="revision-list" aria-label={`Revisions in ${transmittal.transmittalNumber}`}>
						{#each transmittal.items as item (item.versionPublicId)}
							<li>
								<strong>{item.containerNumber}</strong>
								<span>{item.title}</span>
								<small>Rev {item.revisionCode} · {titleCase(item.versionStatus)}</small>
							</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<p>No controlled information has been issued to this organisation yet.</p>
		</div>
	{/if}
</section>

<section class="section-block" aria-labelledby="projects-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Project access</p>
			<h2 id="projects-heading">Your shared projects</h2>
		</div>
	</div>
	{#if data.projects.length}
		<div class="project-grid">
			{#each data.projects as project (project.publicId)}
				<article class="project-card">
					<div>
						<span class="project-number">{project.projectNumber}</span>
						<span class="status-pill">{titleCase(project.status)}</span>
					</div>
					<h3>{project.name}</h3>
					<p>
						{project.isOwnedByCurrentOrganisation
							? 'Owned by your organisation'
							: `Owned by ${project.owningOrganisationName}`}
					</p>
				</article>
			{/each}
		</div>
	{:else}
		<div class="empty-state"><p>No active shared projects are assigned to this member.</p></div>
	{/if}
</section>

<style>
	.hero,
	.section-heading,
	.meta-line,
	.inline-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.hero {
		align-items: flex-end;
		margin-bottom: 1.4rem;
	}

	.eyebrow {
		margin: 0 0 0.25rem;
		color: var(--nb-blue);
		font-size: 0.72rem;
		font-weight: 850;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 0.45rem;
		font-size: clamp(2rem, 5vw, 3.3rem);
		letter-spacing: -0.045em;
	}

	h2 {
		margin-bottom: 0;
		font-size: clamp(1.3rem, 3vw, 1.75rem);
		letter-spacing: -0.025em;
	}

	h3 {
		margin-bottom: 0.55rem;
		font-size: 1.05rem;
	}

	.lede {
		max-width: 44rem;
		margin-bottom: 0;
		color: var(--nb-text-muted);
		font-size: 1.03rem;
		line-height: 1.55;
	}

	.manage-link,
	.primary,
	.secondary {
		min-height: 2.65rem;
		border-radius: var(--nb-radius-sm);
		font-weight: 800;
	}

	.manage-link {
		display: inline-flex;
		align-items: center;
		padding: 0.65rem 0.9rem;
		background: var(--nb-ink);
		color: white;
		text-decoration: none;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin-bottom: 2rem;
	}

	.metrics article {
		display: grid;
		gap: 0.15rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: rgb(255 255 255 / 0.84);
		box-shadow: var(--nb-shadow-sm);
	}

	.metrics strong {
		font-size: 1.7rem;
		letter-spacing: -0.04em;
	}

	.metrics span,
	.muted,
	.project-card p {
		color: var(--nb-text-muted);
	}

	.section-block {
		margin: 2.1rem 0;
	}

	.section-heading {
		margin-bottom: 0.9rem;
	}

	.count-badge,
	.status-pill,
	.project-number,
	.card-type {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.04em;
	}

	.count-badge {
		display: inline-grid;
		place-items: center;
		min-width: 2rem;
		height: 2rem;
		padding: 0 0.45rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--nb-blue) 12%, white);
		color: var(--nb-blue);
	}

	.card-list,
	.action-grid {
		display: grid;
		gap: 0.8rem;
	}

	.action-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.work-card,
	.empty-state,
	.project-card {
		min-width: 0;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-surface);
		box-shadow: var(--nb-shadow-sm);
	}

	.work-card {
		padding: 1.1rem;
	}

	.invitation-card,
	.compact-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 1.2rem;
	}

	.compact-card {
		grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.8fr);
		align-items: start;
	}

	.card-type,
	.project-number {
		margin-bottom: 0.5rem;
		color: var(--nb-blue);
		text-transform: uppercase;
	}

	.meta-line {
		justify-content: flex-start;
		color: var(--nb-text-muted);
		font-size: 0.78rem;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem 1rem;
		margin: 0.9rem 0;
		padding: 0.8rem;
		border-radius: var(--nb-radius-sm);
		background: var(--nb-surface-muted);
		font-size: 0.82rem;
	}

	.meta-grid span,
	.meta-grid strong {
		display: grid;
		gap: 0.12rem;
	}

	.meta-grid strong {
		color: var(--nb-text-muted);
		font-size: 0.68rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	.question {
		max-height: 9rem;
		overflow: auto;
		white-space: pre-wrap;
		line-height: 1.55;
	}

	.previous-response {
		margin: 0.8rem 0;
		padding-left: 0.8rem;
		border-left: 3px solid var(--nb-cyan);
		font-size: 0.86rem;
	}

	.previous-response p {
		margin: 0.25rem 0 0;
		white-space: pre-wrap;
	}

	details {
		margin-top: 0.85rem;
		border-top: 1px solid var(--nb-border);
		padding-top: 0.75rem;
	}

	summary {
		cursor: pointer;
		font-weight: 800;
		color: var(--nb-blue);
	}

	.response-form {
		display: grid;
		gap: 0.75rem;
		margin-top: 0.8rem;
	}

	.response-form label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.82rem;
		font-weight: 700;
	}

	textarea,
	select {
		width: 100%;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		background: white;
		padding: 0.7rem;
		color: var(--nb-text);
	}

	.checkbox-row {
		display: flex !important;
		align-items: center;
		font-weight: 600 !important;
	}

	.checkbox-row input {
		width: 1.1rem;
		height: 1.1rem;
	}

	.primary,
	.secondary {
		border: 1px solid transparent;
		padding: 0.55rem 0.8rem;
		cursor: pointer;
	}

	.primary {
		background: var(--nb-blue);
		color: white;
	}

	.secondary {
		border-color: var(--nb-border-strong);
		background: white;
		color: var(--nb-text);
	}

	.inline-actions {
		justify-content: flex-end;
	}

	.inline-error,
	.form-message {
		padding: 0.65rem 0.8rem;
		border-radius: var(--nb-radius-sm);
		background: #fff3f2;
		color: #9b1c1c;
		font-size: 0.84rem;
	}

	.form-message {
		margin-bottom: 1rem;
	}

	.empty-state {
		padding: 1.3rem;
		color: var(--nb-text-muted);
	}

	.empty-state p {
		margin-bottom: 0;
	}

	.revision-list {
		display: grid;
		gap: 0.45rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.revision-list li {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.6rem;
		align-items: baseline;
		padding: 0.6rem 0.7rem;
		border-radius: var(--nb-radius-sm);
		background: var(--nb-surface-muted);
		font-size: 0.82rem;
	}

	.revision-list small {
		color: var(--nb-text-muted);
	}

	.project-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.project-card {
		padding: 1rem;
	}

	.project-card > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.status-pill {
		padding: 0.28rem 0.45rem;
		border-radius: 999px;
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
		text-transform: none;
	}

	.project-card p {
		margin-bottom: 0;
		font-size: 0.82rem;
	}

	@media (max-width: 840px) {
		.action-grid,
		.project-grid {
			grid-template-columns: 1fr;
		}

		.compact-card {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 580px) {
		.hero,
		.invitation-card,
		.meta-grid,
		.metrics {
			display: grid;
			grid-template-columns: 1fr;
		}

		.hero {
			align-items: start;
		}

		.manage-link {
			justify-self: start;
		}

		.inline-actions {
			justify-content: stretch;
		}

		.inline-actions form,
		.inline-actions button {
			width: 100%;
		}

		.revision-list li {
			grid-template-columns: 1fr;
			gap: 0.2rem;
		}
	}
</style>
