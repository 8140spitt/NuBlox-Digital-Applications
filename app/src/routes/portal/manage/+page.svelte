<script lang="ts">
	let { data, form } = $props();

	function titleCase(value: string): string {
		return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	}
</script>

<section class="hero">
	<div>
		<p class="eyebrow">Internal collaboration control</p>
		<h1>Manage sharing</h1>
		<p class="lede">
			Assign only the project information another organisation needs to act on. Project membership
			alone never exposes the rest of your organisation’s records.
		</p>
	</div>
	<a class="back-link" href="/portal">View shared work</a>
</section>

{#if data.projects.length}
	<form class="project-switcher" method="GET">
		<label for="project">Project</label>
		<select id="project" name="project" onchange={(event) => event.currentTarget.form?.requestSubmit()}>
			{#each data.projects as project (project.publicId)}
				<option
					value={project.publicId}
					selected={data.selectedProject?.publicId === project.publicId}
				>
					{project.projectNumber} · {project.name}
				</option>
			{/each}
		</select>
	</form>
{/if}

{#if form?.message}
	<p class="form-message" role="alert">{form.message}</p>
{/if}

{#if !data.selectedProject}
	<section class="empty-state">
		<h2>No owned project is available</h2>
		<p>
			Manage sharing becomes available when this organisation owns a project that is in your active
			project scope.
		</p>
	</section>
{:else}
	<section class="project-context">
		<div>
			<p class="eyebrow">Selected project</p>
			<h2>{data.selectedProject.projectNumber} · {data.selectedProject.name}</h2>
		</div>
		<span class="status-pill">{titleCase(data.selectedProject.status)}</span>
	</section>

	<section class="participants" aria-labelledby="participants-heading">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Active participants</p>
				<h2 id="participants-heading">Who you can share with</h2>
			</div>
			<span class="count-badge">{data.participants.length}</span>
		</div>
		{#if data.participants.length}
			<div class="participant-list">
				{#each data.participants as participant (participant.organisationPublicId)}
					<span>{participant.organisationName}</span>
				{/each}
			</div>
		{:else}
			<div class="empty-inline">
				No external organisation is active on this project yet. Invite participants from the project
				team workspace first.
			</div>
		{/if}
	</section>

	<section class="sharing-grid" aria-label="Sharing actions">
		<article class="share-card">
			<div class="card-heading">
				<span class="step">01</span>
				<div>
					<p class="eyebrow">Question</p>
					<h2>Assign an RFI</h2>
				</div>
			</div>
			<p>
				Make one open RFI visible to a participating organisation so its portal members can respond.
			</p>
			{#if data.rfis.length && data.participants.length}
				<form method="POST" action="?/assignRfi">
					<input type="hidden" name="projectPublicId" value={data.selectedProject.publicId} />
					<label>
						<span>RFI</span>
						<select name="rfiPublicId" required>
							<option value="">Choose RFI</option>
							{#each data.rfis as rfi (rfi.publicId)}
								<option value={rfi.publicId}>{rfi.rfiNumber} · {rfi.subject}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Organisation</span>
						<select name="organisationPublicId" required>
							<option value="">Choose participant</option>
							{#each data.participants as participant (participant.organisationPublicId)}
								<option value={participant.organisationPublicId}
									>{participant.organisationName}</option
								>
							{/each}
						</select>
					</label>
					<button type="submit">Assign RFI</button>
				</form>
			{:else}
				<p class="empty-inline">You need an open RFI and an active external participant.</p>
			{/if}
		</article>

		<article class="share-card">
			<div class="card-heading">
				<span class="step">02</span>
				<div>
					<p class="eyebrow">Review</p>
					<h2>Assign a submittal</h2>
				</div>
			</div>
			<p>Route a submitted item to an external organisation for a controlled review outcome.</p>
			{#if data.submittals.length && data.participants.length}
				<form method="POST" action="?/assignSubmittal">
					<input type="hidden" name="projectPublicId" value={data.selectedProject.publicId} />
					<label>
						<span>Submittal</span>
						<select name="submittalPublicId" required>
							<option value="">Choose submittal</option>
							{#each data.submittals as submittal (submittal.publicId)}
								<option value={submittal.publicId}>{submittal.number} · {submittal.title}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Organisation</span>
						<select name="organisationPublicId" required>
							<option value="">Choose participant</option>
							{#each data.participants as participant (participant.organisationPublicId)}
								<option value={participant.organisationPublicId}
									>{participant.organisationName}</option
								>
							{/each}
						</select>
					</label>
					<label>
						<span>Review due <small>optional</small></span>
						<input type="datetime-local" name="dueAt" />
					</label>
					<button type="submit">Assign review</button>
				</form>
			{:else}
				<p class="empty-inline">
					You need a submitted submittal and an active external participant.
				</p>
			{/if}
		</article>

		<article class="share-card">
			<div class="card-heading">
				<span class="step">03</span>
				<div>
					<p class="eyebrow">Formal action</p>
					<h2>Send an instruction</h2>
				</div>
			</div>
			<p>Add a participant as an explicit recipient of an issued project instruction.</p>
			{#if data.instructions.length && data.participants.length}
				<form method="POST" action="?/assignInstruction">
					<input type="hidden" name="projectPublicId" value={data.selectedProject.publicId} />
					<label>
						<span>Instruction</span>
						<select name="instructionPublicId" required>
							<option value="">Choose instruction</option>
							{#each data.instructions as instruction (instruction.publicId)}
								<option value={instruction.publicId}
									>{instruction.number} · {instruction.subject}</option
								>
							{/each}
						</select>
					</label>
					<label>
						<span>Organisation</span>
						<select name="organisationPublicId" required>
							<option value="">Choose participant</option>
							{#each data.participants as participant (participant.organisationPublicId)}
								<option value={participant.organisationPublicId}
									>{participant.organisationName}</option
								>
							{/each}
						</select>
					</label>
					<button type="submit">Add recipient</button>
				</form>
			{:else}
				<p class="empty-inline">
					You need an issued instruction and an active external participant.
				</p>
			{/if}
		</article>

		<article class="share-card emphasis">
			<div class="card-heading">
				<span class="step">04</span>
				<div>
					<p class="eyebrow">Controlled information</p>
					<h2>Issue a revision</h2>
				</div>
			</div>
			<p>
				Create a formal portal transmittal containing one exact issued revision. The receiving
				organisation sees that revision, not your wider document register.
			</p>
			{#if data.versions.length && data.participants.length}
				<form method="POST" action="?/issueTransmittal">
					<input type="hidden" name="projectPublicId" value={data.selectedProject.publicId} />
					<label>
						<span>Revision</span>
						<select name="versionPublicId" required>
							<option value="">Choose exact revision</option>
							{#each data.versions as version (version.publicId)}
								<option value={version.publicId}>
									{version.containerNumber} · Rev {version.revisionCode} · {version.title}
								</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Organisation</span>
						<select name="organisationPublicId" required>
							<option value="">Choose participant</option>
							{#each data.participants as participant (participant.organisationPublicId)}
								<option value={participant.organisationPublicId}
									>{participant.organisationName}</option
								>
							{/each}
						</select>
					</label>
					<div class="two-fields">
						<label>
							<span>Transmittal number</span>
							<input name="transmittalNumber" required maxlength="120" placeholder="TR-001" />
						</label>
						<label>
							<span>Purpose <small>optional</small></span>
							<input name="purpose" maxlength="160" placeholder="For construction" />
						</label>
					</div>
					<label>
						<span>Subject</span>
						<input name="subject" required maxlength="500" />
					</label>
					<button type="submit">Issue to portal</button>
				</form>
			{:else}
				<p class="empty-inline">You need an issued revision and an active external participant.</p>
			{/if}
		</article>
	</section>
{/if}

<style>
	.hero,
	.section-heading,
	.project-context,
	.card-heading {
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
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 0.45rem;
		font-size: clamp(2rem, 5vw, 3.1rem);
		letter-spacing: -0.045em;
	}

	h2 {
		margin-bottom: 0;
		font-size: 1.15rem;
		letter-spacing: -0.02em;
	}

	.lede {
		max-width: 48rem;
		margin-bottom: 0;
		color: var(--nb-text-muted);
		line-height: 1.55;
	}

	.back-link {
		min-height: 2.65rem;
		display: inline-flex;
		align-items: center;
		padding: 0.6rem 0.85rem;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		background: white;
		color: var(--nb-text);
		font-weight: 800;
		text-decoration: none;
	}

	.project-switcher {
		display: grid;
		grid-template-columns: auto minmax(15rem, 28rem);
		align-items: center;
		gap: 0.65rem;
		margin-bottom: 1rem;
		padding: 0.8rem 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: white;
	}

	.project-switcher label,
	.share-card label {
		font-size: 0.78rem;
		font-weight: 750;
	}

	.project-context,
	.participants {
		margin-bottom: 1.3rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-surface);
		box-shadow: var(--nb-shadow-sm);
	}

	.project-context h2 {
		font-size: 1.35rem;
	}

	.status-pill,
	.count-badge,
	.participant-list span {
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 800;
	}

	.status-pill {
		padding: 0.35rem 0.55rem;
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
	}

	.section-heading {
		margin-bottom: 0.75rem;
	}

	.count-badge {
		display: grid;
		place-items: center;
		min-width: 2rem;
		height: 2rem;
		background: color-mix(in srgb, var(--nb-blue) 12%, white);
		color: var(--nb-blue);
	}

	.participant-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.participant-list span {
		padding: 0.4rem 0.6rem;
		background: var(--nb-surface-muted);
		color: var(--nb-text);
	}

	.sharing-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.share-card {
		min-width: 0;
		padding: 1.1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-surface);
		box-shadow: var(--nb-shadow-sm);
	}

	.share-card.emphasis {
		border-color: color-mix(in srgb, var(--nb-blue) 35%, var(--nb-border));
	}

	.share-card > p {
		min-height: 3rem;
		color: var(--nb-text-muted);
		font-size: 0.87rem;
		line-height: 1.5;
	}

	.card-heading {
		justify-content: flex-start;
		margin-bottom: 0.65rem;
	}

	.step {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 0.7rem;
		background: var(--nb-ink);
		color: white;
		font-size: 0.72rem;
		font-weight: 850;
	}

	.share-card form {
		display: grid;
		gap: 0.72rem;
		margin-top: 1rem;
	}

	.share-card label {
		display: grid;
		gap: 0.3rem;
	}

	.share-card small {
		color: var(--nb-text-muted);
		font-weight: 500;
	}

	input,
	select {
		width: 100%;
		min-height: 2.65rem;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		background: white;
		padding: 0.55rem 0.65rem;
		color: var(--nb-text);
	}

	.two-fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}

	button {
		min-height: 2.7rem;
		border: 0;
		border-radius: var(--nb-radius-sm);
		background: var(--nb-blue);
		color: white;
		font-weight: 800;
		cursor: pointer;
	}

	.empty-inline,
	.empty-state,
	.form-message {
		border-radius: var(--nb-radius-sm);
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
		font-size: 0.84rem;
		line-height: 1.45;
	}

	.empty-inline {
		padding: 0.75rem;
	}

	.empty-state {
		padding: 1.4rem;
		border: 1px solid var(--nb-border);
	}

	.empty-state p {
		margin-bottom: 0;
	}

	.form-message {
		margin-bottom: 1rem;
		padding: 0.7rem 0.8rem;
		background: #fff3f2;
		color: #9b1c1c;
	}

	@media (max-width: 820px) {
		.sharing-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 580px) {
		.hero,
		.project-context,
		.project-switcher,
		.two-fields {
			display: grid;
			grid-template-columns: 1fr;
			align-items: start;
		}

		.back-link {
			justify-self: start;
		}
	}
</style>
