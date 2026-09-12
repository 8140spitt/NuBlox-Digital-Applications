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

	let openNetworkWork = $derived(data.externalWork.filter((item) => item.state === 'open'));
	let completedNetworkWork = $derived(
		data.externalWork.filter((item) => item.state === 'completed')
	);
	let openRfis = $derived(data.rfis.filter((row) => ['open', 'reopened'].includes(row.status)));
	let pendingSubmittals = $derived(
		data.submittals.filter((row) => ['submitted', 'under_review'].includes(row.status))
	);
	let pendingInstructions = $derived(data.instructions.filter((row) => !row.acknowledgedAt));
	let memberActionCount = $derived(
		openRfis.length +
			pendingSubmittals.length +
			pendingInstructions.length +
			data.invitations.length
	);
</script>

<section class="hero">
	<div>
		<p class="eyebrow">NuBlox Network</p>
		<h1>{data.mode === 'external' ? 'Your shared work' : 'Network & collaboration'}</h1>
		<p class="lede">
			{#if data.mode === 'external'}
				Only records and actions explicitly shared with your verified identity appear here.
			{:else}
				External work shared with you and controlled collaboration assigned to your organisation, in
				one place.
			{/if}
		</p>
	</div>
	{#if data.mode === 'member' && data.canManage}
		<a class="manage-link" href="/portal/manage">Manage legacy sharing</a>
	{/if}
</section>

<section class="metrics" aria-label="Network summary">
	<article>
		<strong>{openNetworkWork.length}</strong>
		<span>External actions</span>
	</article>
	<article>
		<strong>{data.externalProjects.length}</strong>
		<span>External projects</span>
	</article>
	{#if data.mode === 'member'}
		<article>
			<strong>{memberActionCount}</strong>
			<span>Team actions</span>
		</article>
	{:else}
		<article>
			<strong>{completedNetworkWork.length}</strong>
			<span>Completed</span>
		</article>
	{/if}
</section>

{#if form?.message}
	<p class="form-message" role="alert">{form.message}</p>
{/if}

<section class="section-block" aria-labelledby="network-actions-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">My actions</p>
			<h2 id="network-actions-heading">External work assigned to you</h2>
		</div>
		<span class="count-badge">{openNetworkWork.length}</span>
	</div>

	{#if openNetworkWork.length === 0}
		<div class="empty-state compact">
			<strong>No external action is waiting for you.</strong>
			<p>
				New customer, supplier, project or service actions will appear here when explicitly shared.
			</p>
		</div>
	{:else}
		<div class="network-list">
			{#each openNetworkWork as item (item.publicId)}
				<article class="network-card">
					<div class="network-icon" aria-hidden="true">
						{item.domainKey.slice(0, 1).toUpperCase()}
					</div>
					<div class="network-copy">
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

{#if completedNetworkWork.length}
	<details class="completed-block">
		<summary>Completed external work ({completedNetworkWork.length})</summary>
		<div class="network-list">
			{#each completedNetworkWork as item (item.publicId)}
				<article class="network-card subdued">
					<div class="network-icon" aria-hidden="true">✓</div>
					<div class="network-copy">
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

{#if data.mode === 'external'}
	<section class="boundary-panel">
		<strong>External access is deny-by-default.</strong>
		<p>
			Your sign-in does not make you a member of the organisations that share work with you. NuBlox
			Network evaluates each grant, context, record and permitted action independently.
		</p>
	</section>
{:else}
	{#if data.invitations.length}
		<section class="section-block" aria-labelledby="invitations-heading">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Organisation invitations</p>
					<h2 id="invitations-heading">Join shared projects</h2>
				</div>
				<span class="count-badge">{data.invitations.length}</span>
			</div>
			<div class="card-list">
				{#each data.invitations as invitation (invitation.projectPublicId)}
					<article class="work-card horizontal-card">
						<div>
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

	<section class="section-block" aria-labelledby="team-actions-heading">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Organisation collaboration</p>
				<h2 id="team-actions-heading">Actions assigned to your team</h2>
			</div>
			<span class="count-badge"
				>{openRfis.length + pendingSubmittals.length + pendingInstructions.length}</span
			>
		</div>

		{#if !openRfis.length && !pendingSubmittals.length && !pendingInstructions.length}
			<div class="empty-state compact">
				<strong>Your team is clear.</strong>
				<p>No shared project action currently needs a response.</p>
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
						{#if rfi.latestResponse}<p class="previous-response">
								<strong>Latest response:</strong>
								{rfi.latestResponse}
							</p>{/if}
						{#if data.canRespond}
							<form class="stack-form" method="POST" action="?/respondRfi">
								<input type="hidden" name="rfiPublicId" value={rfi.publicId} />
								<label
									><span>Response</span><textarea
										name="responseText"
										rows="4"
										required
										maxlength="5000"></textarea></label
								>
								<label class="checkbox"
									><input type="checkbox" name="final" /><span>Mark as final response</span></label
								>
								{#if form?.action === 'rfi' && form?.subjectPublicId === rfi.publicId}<p
										class="inline-error"
										role="alert"
									>
										{form.message}
									</p>{/if}
								<button class="primary" type="submit">Send response</button>
							</form>
						{/if}
					</article>
				{/each}

				{#each pendingSubmittals as submittal (submittal.publicId)}
					<article class="work-card">
						<div class="card-type">Submittal · {submittal.number}</div>
						<h3>{submittal.title}</h3>
						<div class="meta-grid">
							<span
								><strong>Project</strong>{submittal.projectNumber} · {submittal.projectName}</span
							>
							<span><strong>From</strong>{submittal.owningOrganisationName}</span>
							<span><strong>Type</strong>{submittal.typeName}</span>
							<span><strong>Due</strong>{dateTime(submittal.reviewerDueAt ?? submittal.dueAt)}</span
							>
						</div>
						{#if data.canRespond}
							<form class="stack-form" method="POST" action="?/reviewSubmittal">
								<input type="hidden" name="submittalPublicId" value={submittal.publicId} />
								<label
									><span>Outcome</span><select name="outcome" required
										>{#each reviewOutcomes as outcome}<option value={outcome[0]}
												>{outcome[1]}</option
											>{/each}</select
									></label
								>
								<label
									><span>Comments</span><textarea name="comments" rows="3" maxlength="5000"
									></textarea></label
								>
								{#if form?.action === 'submittal' && form?.subjectPublicId === submittal.publicId}<p
										class="inline-error"
										role="alert"
									>
										{form.message}
									</p>{/if}
								<button class="primary" type="submit">Submit review</button>
							</form>
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
						{#if data.canRespond}
							<form method="POST" action="?/acknowledgeInstruction">
								<input type="hidden" name="instructionPublicId" value={instruction.publicId} />
								{#if form?.action === 'instruction' && form?.subjectPublicId === instruction.publicId}<p
										class="inline-error"
										role="alert"
									>
										{form.message}
									</p>{/if}
								<button class="primary" type="submit">Acknowledge instruction</button>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	{#if data.transmittals.length}
		<section class="section-block" aria-labelledby="transmittals-heading">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Information</p>
					<h2 id="transmittals-heading">Recent transmittals</h2>
				</div>
				<span class="count-badge">{data.transmittals.length}</span>
			</div>
			<div class="card-list">
				{#each data.transmittals as transmittal (transmittal.publicId)}
					<article class="work-card horizontal-card">
						<div>
							<div class="meta-line">
								<span>{transmittal.transmittalNumber}</span><span
									>{transmittal.projectNumber} · {transmittal.projectName}</span
								>
							</div>
							<h3>{transmittal.subject}</h3>
							<p class="muted">
								From {transmittal.issuingOrganisationName} · {dateTime(transmittal.issuedAt)} · {transmittal
									.items.length} item(s)
							</p>
						</div>
						<span class="status-pill">{titleCase(transmittal.deliveryStatus)}</span>
					</article>
				{/each}
			</div>
		</section>
	{/if}
{/if}

<style>
	.hero {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.2rem;
	}
	.eyebrow,
	.card-type {
		margin: 0 0 0.3rem;
		color: var(--nb-text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.045em;
	}
	h2,
	h3 {
		margin: 0;
	}
	.lede {
		max-width: 50rem;
		margin: 0.5rem 0 0;
		color: var(--nb-text-muted);
		line-height: 1.55;
	}
	.manage-link,
	.primary-link,
	.secondary-link {
		flex: none;
		border-radius: 0.55rem;
		padding: 0.65rem 0.85rem;
		text-decoration: none;
		font-weight: 800;
	}
	.manage-link,
	.secondary-link {
		border: 1px solid #cbd2dc;
		color: var(--nb-text);
		background: white;
	}
	.primary-link {
		background: var(--nb-ink);
		color: white;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.7rem;
		margin-bottom: 1.4rem;
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
	.network-list,
	.card-list,
	.action-grid {
		display: grid;
		gap: 0.7rem;
	}
	.network-card {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		border: 1px solid #dce2ea;
		border-radius: 0.75rem;
		background: white;
	}
	.network-card.subdued {
		opacity: 0.78;
	}
	.network-icon {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.55rem;
		background: #edf4ff;
		font-weight: 850;
	}
	.network-copy {
		min-width: 0;
	}
	.network-copy h3 {
		margin-top: 0.2rem;
		font-size: 1rem;
	}
	.network-copy p {
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
	.completed-block {
		margin-top: 1rem;
		border: 1px solid #dce2ea;
		border-radius: 0.7rem;
		background: white;
	}
	.completed-block summary {
		padding: 0.8rem 1rem;
		cursor: pointer;
		font-weight: 800;
	}
	.completed-block .network-list {
		padding: 0 0.8rem 0.8rem;
	}
	.project-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.7rem;
	}
	.project-card,
	.work-card {
		border: 1px solid #dce2ea;
		border-radius: 0.75rem;
		background: white;
		padding: 1rem;
	}
	.project-card h3 {
		margin-top: 0.45rem;
	}
	.project-card p {
		margin: 0.35rem 0 0;
	}
	.boundary-panel,
	.empty-state {
		margin-top: 1.4rem;
		padding: 1rem;
		border: 1px solid #ced9e8;
		border-radius: 0.75rem;
		background: #f6f9fd;
	}
	.boundary-panel p,
	.empty-state p {
		margin: 0.35rem 0 0;
		color: var(--nb-text-muted);
		line-height: 1.5;
	}
	.empty-state.compact {
		margin-top: 0;
	}
	.action-grid {
		grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
	}
	.work-card {
		display: grid;
		gap: 0.75rem;
		align-content: start;
	}
	.horizontal-card {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
	}
	.question,
	.previous-response {
		margin: 0;
		color: #4d5869;
		line-height: 1.5;
	}
	.previous-response {
		padding: 0.7rem;
		border-radius: 0.55rem;
		background: #f5f7fa;
	}
	.meta-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
		font-size: 0.78rem;
		color: var(--nb-text-muted);
	}
	.meta-grid span {
		display: grid;
		gap: 0.1rem;
	}
	.meta-grid strong {
		color: var(--nb-text);
	}
	.stack-form {
		display: grid;
		gap: 0.65rem;
		padding-top: 0.7rem;
		border-top: 1px solid #e2e6ec;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.78rem;
		font-weight: 700;
	}
	textarea,
	select {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		border: 1px solid #c8d0da;
		border-radius: 0.5rem;
		padding: 0.6rem 0.7rem;
		background: white;
	}
	.checkbox {
		display: flex;
		grid-auto-flow: column;
		grid-template-columns: auto 1fr;
		align-items: center;
		justify-content: start;
	}
	.inline-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	button {
		font: inherit;
		font-weight: 800;
		border-radius: 0.5rem;
		padding: 0.6rem 0.8rem;
		cursor: pointer;
	}
	button.primary {
		border: 1px solid var(--nb-ink);
		background: var(--nb-ink);
		color: white;
	}
	button.secondary {
		border: 1px solid #c5ccd6;
		background: white;
		color: var(--nb-text);
	}
	.form-message,
	.inline-error {
		color: #9b1c1c;
	}
	.form-message {
		padding: 0.75rem;
		border-radius: 0.55rem;
		background: #fff1f1;
	}
	.inline-error {
		margin: 0;
		font-size: 0.8rem;
	}
	@media (max-width: 720px) {
		.hero,
		.horizontal-card {
			grid-template-columns: 1fr;
			flex-direction: column;
		}
		.metrics {
			grid-template-columns: 1fr;
		}
		.network-card {
			grid-template-columns: auto minmax(0, 1fr);
		}
		.network-card > :last-child {
			grid-column: 2;
			justify-self: start;
		}
		.meta-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
