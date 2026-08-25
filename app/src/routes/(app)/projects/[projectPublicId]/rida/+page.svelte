<script lang="ts">
	let { data, form } = $props();

	function dateText(value: Date | null): string {
		return value ? value.toISOString().slice(0, 10) : 'Not set';
	}

	function riskRating(probability: number | null, impact: number | null): string {
		if (probability === null || impact === null) return 'Not scored';
		return `${probability * impact} (${probability} × ${impact})`;
	}

	function reference(item: (typeof data.items)[number]): string {
		const prefix = item.itemType === 'risk' ? 'R' : item.itemType === 'issue' ? 'I' : 'D';
		return `${prefix}-${String(item.itemNumber).padStart(3, '0')}`;
	}

	function actionsFor(publicId: string) {
		return data.actions.filter((action) => action.sourceItemPublicId === publicId);
	}

	function transitionOptions(item: (typeof data.items)[number]): string[] {
		if (item.itemType === 'risk') {
			if (item.status === 'open') return ['monitoring', 'realised'];
			if (item.status === 'monitoring') return ['open', 'realised'];
			if (item.status === 'realised') return ['monitoring'];
		}
		if (item.itemType === 'issue') {
			if (item.status === 'open') return ['investigating', 'resolved'];
			if (item.status === 'investigating') return ['open', 'resolved'];
			if (item.status === 'resolved') return ['investigating'];
		}
		if (item.itemType === 'decision') {
			if (item.status === 'proposed') return ['pending'];
			if (item.status === 'pending') return ['proposed'];
			if (item.status === 'decided') return ['superseded'];
		}
		return [];
	}
</script>

<svelte:head>
	<title>Risks, issues, decisions & actions · {data.project.name} · NuBlox</title>
</svelte:head>

<div class="rida-page">
	<header class="page-header">
		<div>
			<p class="eyebrow">Project controls · Governance</p>
			<h1>Risks, issues, decisions & actions</h1>
			<p class="lede">
				Control uncertainty, active problems and project decisions in one governed register. Follow-up
				actions remain canonical NuBlox work items with assignment, due-date and completion evidence.
			</p>
		</div>
		<nav class="context-links" aria-label="Project controls navigation">
			<a href={`/projects/${data.project.publicId}`}>Overview</a>
			<a href={`/projects/${data.project.publicId}/plan`}>Plan</a>
			<a href={`/projects/${data.project.publicId}/resources`}>Resources</a>
			<a href={`/projects/${data.project.publicId}/progress`}>Progress</a>
			<a class="active" href={`/projects/${data.project.publicId}/rida`}>RIDA</a>
		</nav>
	</header>

	<section class="summary-grid" aria-label="Project governance summary">
		<article>
			<span>Open risks</span>
			<strong>{data.openRiskCount}</strong>
		</article>
		<article>
			<span>Open issues</span>
			<strong>{data.openIssueCount}</strong>
		</article>
		<article>
			<span>Decisions pending</span>
			<strong>{data.pendingDecisionCount}</strong>
		</article>
		<article>
			<span>Open actions</span>
			<strong>{data.openActionCount}</strong>
		</article>
	</section>

	{#if form?.ridaError}
		<p class="alert" role="alert">{form.ridaError}</p>
	{/if}

	{#if data.canManage}
		<section class="panel create-panel" aria-labelledby="create-heading">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">Raise control item</p>
					<h2 id="create-heading">Add to the project register</h2>
				</div>
				<span>Risk · Issue · Decision</span>
			</div>

			<div class="create-grid">
				<form method="POST" action="?/createItem" class="control-form">
					<input type="hidden" name="itemType" value="risk" />
					<h3>Risk</h3>
					<p>Capture a threat or opportunity before it becomes an issue.</p>
					<label>Title <input name="title" maxlength="255" required /></label>
					<label>
						Direction
						<select name="riskDirection" required>
							<option value="threat">Threat</option>
							<option value="opportunity">Opportunity</option>
						</select>
					</label>
					<div class="two-columns">
						<label>Probability (1–5) <input type="number" name="probabilityScore" min="1" max="5" required /></label>
						<label>Impact (1–5) <input type="number" name="impactScore" min="1" max="5" required /></label>
					</div>
					<label>
						Response strategy
						<select name="responseStrategy">
							<option value="">Not selected</option>
							<option value="avoid">Avoid</option>
							<option value="reduce">Reduce</option>
							<option value="transfer">Transfer</option>
							<option value="accept">Accept</option>
							<option value="exploit">Exploit</option>
							<option value="enhance">Enhance</option>
							<option value="share">Share</option>
						</select>
					</label>
					<label>Response plan <textarea name="responsePlan" rows="3"></textarea></label>
					<label>Description <textarea name="description" rows="3"></textarea></label>
					<div class="two-columns">
						<label>
							Priority
							<select name="priority">
								<option value="normal">Normal</option>
								<option value="low">Low</option>
								<option value="high">High</option>
								<option value="critical">Critical</option>
							</select>
						</label>
						<label>Due date <input type="date" name="dueOn" /></label>
					</div>
					<button type="submit">Raise risk</button>
				</form>

				<form method="POST" action="?/createItem" class="control-form">
					<input type="hidden" name="itemType" value="issue" />
					<h3>Issue</h3>
					<p>Record a current problem requiring investigation and resolution.</p>
					<label>Title <input name="title" maxlength="255" required /></label>
					<label>
						Severity
						<select name="severity" required>
							<option value="medium">Medium</option>
							<option value="low">Low</option>
							<option value="high">High</option>
							<option value="critical">Critical</option>
						</select>
					</label>
					<label>Impact <textarea name="impactSummary" rows="3"></textarea></label>
					<label>Resolution plan <textarea name="resolutionPlan" rows="3"></textarea></label>
					<label>Description <textarea name="description" rows="3"></textarea></label>
					<div class="two-columns">
						<label>
							Priority
							<select name="priority">
								<option value="normal">Normal</option>
								<option value="low">Low</option>
								<option value="high">High</option>
								<option value="critical">Critical</option>
							</select>
						</label>
						<label>Due date <input type="date" name="dueOn" /></label>
					</div>
					<button type="submit">Raise issue</button>
				</form>

				<form method="POST" action="?/createItem" class="control-form">
					<input type="hidden" name="itemType" value="decision" />
					<h3>Decision</h3>
					<p>Capture a decision requirement before recording the authoritative outcome.</p>
					<label>Decision required <input name="title" maxlength="255" required /></label>
					<label>Context <textarea name="description" rows="5"></textarea></label>
					<label>Decision required by <input type="date" name="decisionRequiredOn" /></label>
					<label>
						Priority
						<select name="priority">
							<option value="normal">Normal</option>
							<option value="low">Low</option>
							<option value="high">High</option>
							<option value="critical">Critical</option>
						</select>
					</label>
					<button type="submit">Propose decision</button>
				</form>
			</div>
		</section>
	{/if}

	{#each ['risk', 'issue', 'decision'] as registerType}
		{@const registerItems = data.items.filter((item) => item.itemType === registerType)}
		<section class="panel register-panel" aria-labelledby={`${registerType}-heading`}>
			<div class="panel-heading">
				<div>
					<p class="eyebrow">{registerType === 'risk' ? 'Uncertainty' : registerType === 'issue' ? 'Active problems' : 'Governance record'}</p>
					<h2 id={`${registerType}-heading`}>
						{registerType === 'risk' ? 'Risk register' : registerType === 'issue' ? 'Issue register' : 'Decision register'}
					</h2>
				</div>
				<span>{registerItems.length} records</span>
			</div>

			{#if registerItems.length}
				<div class="register-list">
					{#each registerItems as item}
						<article class="register-card" class:critical={item.priority === 'critical'}>
							<header>
								<div>
									<span class="reference">{reference(item)}</span>
									<h3>{item.title}</h3>
								</div>
								<div class="badges">
									<span>{item.priority}</span>
									<span>{item.status}</span>
								</div>
							</header>

							{#if item.description}<p>{item.description}</p>{/if}

							<div class="facts">
								<span><strong>Due</strong> {dateText(item.dueOn)}</span>
								{#if item.itemType === 'risk'}
									<span><strong>Direction</strong> {item.riskDirection}</span>
									<span><strong>Rating</strong> {riskRating(item.probabilityScore, item.impactScore)}</span>
									<span><strong>Response</strong> {item.responseStrategy ?? 'Not selected'}</span>
									{#if item.responsePlan}<span class="wide"><strong>Response plan</strong> {item.responsePlan}</span>{/if}
								{:else if item.itemType === 'issue'}
									<span><strong>Severity</strong> {item.severity}</span>
									{#if item.impactSummary}<span class="wide"><strong>Impact</strong> {item.impactSummary}</span>{/if}
									{#if item.resolutionPlan}<span class="wide"><strong>Resolution</strong> {item.resolutionPlan}</span>{/if}
								{:else}
									<span><strong>Required by</strong> {dateText(item.decisionRequiredOn)}</span>
									{#if item.decisionOutcome}<span class="wide"><strong>Outcome</strong> {item.decisionOutcome}</span>{/if}
									{#if item.decisionRationale}<span class="wide"><strong>Rationale</strong> {item.decisionRationale}</span>{/if}
								{/if}
							</div>

							{#if data.canManage && transitionOptions(item).length}
								<form method="POST" action="?/transitionItem" class="inline-form">
									<input type="hidden" name="itemPublicId" value={item.publicId} />
									<label>
										Move to
										<select name="toStatus">
											{#each transitionOptions(item) as status}
												<option value={status}>{status}</option>
											{/each}
										</select>
									</label>
									<button type="submit" class="secondary">Update status</button>
								</form>
							{/if}

							{#if item.itemType === 'decision' && data.canDecide && ['proposed', 'pending'].includes(item.status)}
								<form method="POST" action="?/decideItem" class="decision-form">
									<input type="hidden" name="itemPublicId" value={item.publicId} />
									<label>Outcome <textarea name="outcome" rows="2" required></textarea></label>
									<label>Rationale <textarea name="rationale" rows="2"></textarea></label>
									<button type="submit">Record authoritative decision</button>
								</form>
							{/if}

							{#if item.itemType !== 'decision' && item.status !== 'closed' && data.canClose}
								<form method="POST" action="?/closeItem" class="close-form">
									<input type="hidden" name="itemPublicId" value={item.publicId} />
									<button type="submit" class="secondary">Close {item.itemType}</button>
								</form>
							{/if}

							<section class="actions" aria-label={`Actions linked to ${reference(item)}`}>
								<div class="action-heading">
									<strong>Actions</strong>
									<span>{actionsFor(item.publicId).length}</span>
								</div>
								{#if actionsFor(item.publicId).length}
									<ul>
										{#each actionsFor(item.publicId) as action}
											<li>
												<div>
													<strong>{action.title}</strong>
													<span>{action.status} · {action.priority} · due {dateText(action.dueAt)}</span>
												</div>
												<a href="/my-work">Open in My work</a>
											</li>
										{/each}
									</ul>
								{:else}
									<p class="empty-inline">No follow-up actions recorded.</p>
								{/if}

								{#if data.canCreateAction}
									<details>
										<summary>Add follow-up action</summary>
										<form method="POST" action="?/createAction" class="action-form">
											<input type="hidden" name="itemPublicId" value={item.publicId} />
											<label>Action <input name="title" maxlength="255" required /></label>
											<label>Description <textarea name="description" rows="2"></textarea></label>
											<div class="two-columns">
												<label>
													Priority
													<select name="priority">
														<option value="normal">Normal</option>
														<option value="low">Low</option>
														<option value="high">High</option>
														<option value="critical">Critical</option>
													</select>
												</label>
												<label>Due date <input type="date" name="dueOn" /></label>
											</div>
											<button type="submit">Create action</button>
										</form>
									</details>
								{/if}
							</section>
						</article>
					{/each}
				</div>
			{:else}
				<p class="empty-state">No {registerType} records have been raised for this project.</p>
			{/if}
		</section>
	{/each}

	<section class="panel action-register" aria-labelledby="actions-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Work Kernel</p>
				<h2 id="actions-heading">Action register</h2>
			</div>
			<span>{data.actions.length} linked actions</span>
		</div>
		<p class="boundary-note">
			Actions are not duplicated project-control records. They are canonical NuBlox work items and
			therefore participate in My work, assignment, escalation and completion evidence.
		</p>
		{#if data.actions.length}
			<div class="action-table-wrap">
				<table>
					<thead><tr><th>Source</th><th>Action</th><th>Priority</th><th>Status</th><th>Due</th></tr></thead>
					<tbody>
						{#each data.actions as action}
							{@const source = data.items.find((item) => item.publicId === action.sourceItemPublicId)}
							<tr>
								<td>{source ? reference(source) : 'Register item'}</td>
								<td>{action.title}</td>
								<td>{action.priority}</td>
								<td>{action.status}</td>
								<td>{dateText(action.dueAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="empty-state">No RIDA-linked actions have been created.</p>
		{/if}
	</section>
</div>

<style>
	.rida-page {
		display: grid;
		gap: 1rem;
		padding: 1rem;
		max-width: 1500px;
		margin: 0 auto;
	}

	.page-header,
	.panel {
		background: var(--surface-1, #fff);
		border: 1px solid var(--border-subtle, #d9dee7);
		border-radius: 0.8rem;
		padding: 1rem;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		gap: 1.5rem;
		align-items: flex-start;
	}

	h1,
	h2,
	h3,
	p {
		margin-top: 0;
	}

	.eyebrow {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted, #5c6678);
		margin-bottom: 0.35rem;
	}

	.lede,
	.boundary-note {
		max-width: 72ch;
		color: var(--text-muted, #5c6678);
		margin-bottom: 0;
	}

	.context-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.context-links a {
		padding: 0.45rem 0.65rem;
		border-radius: 0.45rem;
		text-decoration: none;
		white-space: nowrap;
	}

	.context-links a.active {
		font-weight: 700;
		background: var(--surface-2, #eef2f7);
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.summary-grid article {
		background: var(--surface-1, #fff);
		border: 1px solid var(--border-subtle, #d9dee7);
		border-radius: 0.7rem;
		padding: 0.9rem;
		display: grid;
		gap: 0.3rem;
	}

	.summary-grid span,
	.panel-heading span,
	.facts span,
	.action-heading span,
	.actions li span {
		color: var(--text-muted, #5c6678);
		font-size: 0.85rem;
	}

	.summary-grid strong {
		font-size: 1.65rem;
	}

	.alert {
		border: 1px solid #b42318;
		border-radius: 0.5rem;
		padding: 0.75rem;
		background: #fef3f2;
		color: #8a1c13;
	}

	.panel-heading,
	.register-card > header,
	.action-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}

	.create-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.control-form,
	.action-form,
	.decision-form {
		display: grid;
		gap: 0.65rem;
	}

	.control-form {
		border: 1px solid var(--border-subtle, #d9dee7);
		border-radius: 0.65rem;
		padding: 0.9rem;
		align-content: start;
	}

	.control-form > p {
		font-size: 0.9rem;
		color: var(--text-muted, #5c6678);
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	input,
	select,
	textarea,
	button {
		font: inherit;
	}

	input,
	select,
	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.5rem;
		border: 1px solid var(--border-subtle, #cbd3df);
		border-radius: 0.4rem;
		background: var(--surface-1, #fff);
		color: inherit;
	}

	button {
		border: 0;
		border-radius: 0.45rem;
		padding: 0.55rem 0.75rem;
		font-weight: 700;
		cursor: pointer;
		background: var(--accent, #1f5eff);
		color: #fff;
	}

	button.secondary {
		background: var(--surface-2, #eef2f7);
		color: inherit;
		border: 1px solid var(--border-subtle, #cbd3df);
	}

	.two-columns {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.6rem;
	}

	.register-list {
		display: grid;
		gap: 0.75rem;
	}

	.register-card {
		border: 1px solid var(--border-subtle, #d9dee7);
		border-radius: 0.65rem;
		padding: 0.9rem;
		display: grid;
		gap: 0.8rem;
	}

	.register-card.critical {
		border-inline-start-width: 0.3rem;
	}

	.reference {
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--text-muted, #5c6678);
	}

	.badges {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.badges span {
		border: 1px solid var(--border-subtle, #d9dee7);
		border-radius: 99px;
		padding: 0.2rem 0.45rem;
		font-size: 0.75rem;
		text-transform: capitalize;
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.55rem;
	}

	.facts span {
		display: grid;
		gap: 0.15rem;
	}

	.facts .wide {
		grid-column: 1 / -1;
	}

	.inline-form {
		display: flex;
		gap: 0.5rem;
		align-items: end;
		flex-wrap: wrap;
	}

	.decision-form {
		padding: 0.75rem;
		background: var(--surface-2, #f4f6f9);
		border-radius: 0.5rem;
	}

	.close-form {
		justify-self: start;
	}

	.actions {
		border-top: 1px solid var(--border-subtle, #d9dee7);
		padding-top: 0.75rem;
	}

	.actions ul {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0;
		display: grid;
		gap: 0.4rem;
	}

	.actions li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		padding: 0.5rem;
		background: var(--surface-2, #f4f6f9);
		border-radius: 0.45rem;
	}

	.actions li div {
		display: grid;
		gap: 0.15rem;
	}

	.actions details {
		margin-top: 0.65rem;
	}

	.actions summary {
		cursor: pointer;
		font-weight: 700;
	}

	.action-form {
		margin-top: 0.65rem;
		max-width: 720px;
	}

	.empty-state,
	.empty-inline {
		color: var(--text-muted, #5c6678);
		margin-bottom: 0;
	}

	.action-table-wrap {
		overflow-x: auto;
		margin-top: 0.75rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		text-align: left;
		padding: 0.6rem;
		border-bottom: 1px solid var(--border-subtle, #d9dee7);
		white-space: nowrap;
	}

	@media (max-width: 1050px) {
		.create-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 760px) {
		.rida-page {
			padding: 0.65rem;
		}

		.page-header {
			display: grid;
		}

		.summary-grid,
		.facts {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.actions li {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (max-width: 480px) {
		.summary-grid,
		.facts,
		.two-columns {
			grid-template-columns: 1fr;
		}
	}
</style>
