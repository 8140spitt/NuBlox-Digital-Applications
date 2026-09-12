<script lang="ts">
	let { data } = $props();
	let email = $state('');
	let selectedRoles = $state<string[]>([]);
	let submitting = $state(false);
	let invitationMessage = $state('');
	let invitationError = $state('');

	const operatingFlow = [
		{ label: 'Win work', itemId: 'opportunities', description: 'Lead, qualify and pursue.' },
		{ label: 'Price', itemId: 'estimates', description: 'Estimate risk, resource and margin.' },
		{ label: 'Contract', itemId: 'contracts', description: 'Form and control commitments.' },
		{ label: 'Deliver', itemId: 'documents', description: 'Coordinate project information.' },
		{ label: 'Procure', itemId: 'purchasing', description: 'Source and commit supply.' },
		{ label: 'Control', itemId: 'project-cost-control', description: 'Control cost and change.' },
		{ label: 'Invoice', itemId: 'invoices', description: 'Bill and collect value.' },
		{ label: 'Account', itemId: 'accounting', description: 'Post, close and report.' }
	] as const;

	function workspaceItem(itemId: string) {
		for (const section of data.workspaceDirectory) {
			const item = section.items.find((candidate) => candidate.id === itemId);
			if (item) return item;
		}
		return null;
	}

	function primaryHref(section: (typeof data.workspaceDirectory)[number]): string {
		return section.items[0]?.href ?? '/more';
	}

	function capabilityCount(): number {
		return data.workspaceDirectory.reduce((total, section) => total + section.items.length, 0);
	}

	async function inviteMember(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		invitationMessage = '';
		invitationError = '';
		const response = await fetch('/api/organisations/invitations', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: email.trim(), rolePublicIds: selectedRoles })
		});
		submitting = false;
		if (!response.ok) {
			const body = await response.json().catch(() => null);
			invitationError = body?.message ?? 'The invitation could not be created.';
			return;
		}
		const invitation = await response.json();
		invitationMessage = `Invitation created for ${invitation.email}.`;
		email = '';
		selectedRoles = [];
	}
</script>

<svelte:head>
	<title>Home · NuBlox</title>
</svelte:head>

<section class="command-hero">
	<div>
		<p class="eyebrow">{data.organisation.name}</p>
		<h1>Construction operating system</h1>
		<p class="hero-copy">
			Run the business and the built environment from one controlled workspace — from opportunity
			through delivery, commercial control, accounting and asset operations.
		</p>
	</div>
	<div class="hero-actions">
		<a class="primary-action" href="/my-work">Open my work</a>
		<a class="secondary-action" href="/projects">View projects</a>
	</div>
</section>

<section class="pulse-grid" aria-label="Workspace overview">
	<article class="pulse-card">
		<span>Available workspaces</span>
		<strong>{data.workspaceDirectory.length}</strong>
		<small>Permission-filtered operating areas</small>
	</article>
	<article class="pulse-card">
		<span>Available capabilities</span>
		<strong>{capabilityCount()}</strong>
		<small>Workspaces you can use now</small>
	</article>
	<article class="pulse-card">
		<span>Fast actions</span>
		<strong>{data.quickActions.length}</strong>
		<small>Controlled creation paths</small>
	</article>
	<article class="pulse-card identity-card">
		<span>Working as</span>
		<strong>{data.actor.displayName}</strong>
		<small>{data.actor.email}</small>
	</article>
</section>

<section class="section-block">
	<div class="section-heading">
		<div>
			<p class="eyebrow">End-to-end</p>
			<h2>Operating flow</h2>
		</div>
		<p>Move through the commercial and delivery lifecycle without losing organisational context.</p>
	</div>

	<div class="flow-grid">
		{#each operatingFlow as stage, index (stage.itemId)}
			{@const item = workspaceItem(stage.itemId)}
			{#if item}
				<a class="flow-stage" href={item.href}>
					<span class="flow-number">{String(index + 1).padStart(2, '0')}</span>
					<strong>{stage.label}</strong>
					<small>{stage.description}</small>
				</a>
			{:else}
				<div class="flow-stage unavailable" aria-disabled="true">
					<span class="flow-number">{String(index + 1).padStart(2, '0')}</span>
					<strong>{stage.label}</strong>
					<small>Not available for your current permissions.</small>
				</div>
			{/if}
		{/each}
	</div>
</section>

<div class="command-grid">
	<section class="section-block workspace-panel">
		<div class="section-heading compact">
			<div>
				<p class="eyebrow">Operate</p>
				<h2>Workspace directory</h2>
			</div>
			<a class="text-link" href="/more">Explore all</a>
		</div>

		<div class="workspace-grid">
			{#each data.workspaceDirectory as section (section.id)}
				<a class="workspace-card" href={primaryHref(section)}>
					<div>
						<strong>{section.label}</strong>
						<span>{section.items.length} available</span>
					</div>
					<ul>
						{#each section.items.slice(0, 4) as item (item.id)}
							<li>{item.label}</li>
						{/each}
					</ul>
				</a>
			{/each}
		</div>
	</section>

	<aside class="right-rail">
		<section class="section-block action-panel">
			<div class="section-heading compact">
				<div>
					<p class="eyebrow">Start work</p>
					<h2>Create</h2>
				</div>
			</div>

			<div class="action-list">
				{#each data.quickActions.slice(0, 7) as action (action.id)}
					<a href={action.href}>
						<strong>{action.label}</strong>
						<small>{action.description}</small>
					</a>
				{:else}
					<p class="muted">No creation actions are available for your current permissions.</p>
				{/each}
			</div>
		</section>

		{#if data.canInviteMembers}
			<details class="admin-card">
				<summary>
					<span>
						<small>Organisation administration</small>
						<strong>Invite a team member</strong>
					</span>
					<span aria-hidden="true">+</span>
				</summary>
				<div class="admin-body">
					<p class="muted">
						Create a seven-day invitation. The recipient must verify the invited email before the
						membership becomes active.
					</p>
					<form class="stack" onsubmit={inviteMember}>
						<label>
							<span>Email</span>
							<input
								bind:value={email}
								type="email"
								required
								maxlength="320"
								placeholder="name@example.com"
							/>
						</label>

						{#if data.roles.length > 0}
							<fieldset>
								<legend>Organisation roles</legend>
								{#each data.roles as role}
									<label class="check">
										<input type="checkbox" value={role.publicId} bind:group={selectedRoles} />
										<span>
											<strong>{role.name}</strong>
											{#if role.description}<small>{role.description}</small>{/if}
										</span>
									</label>
								{/each}
							</fieldset>
						{/if}

						{#if invitationError}<p class="error" role="alert">{invitationError}</p>{/if}
						{#if invitationMessage}<p class="success" role="status">{invitationMessage}</p>{/if}
						<button type="submit" disabled={submitting}
							>{submitting ? 'Sending…' : 'Send invitation'}</button
						>
					</form>
				</div>
			</details>
		{/if}
	</aside>
</div>

<style>
	.command-hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2rem;
		align-items: end;
		padding: clamp(1.25rem, 3vw, 2.25rem);
		border-radius: var(--nb-radius-lg);
		background: linear-gradient(120deg, rgb(20 110 245 / 0.16), transparent 48%), var(--nb-ink);
		color: var(--nb-white);
		box-shadow: var(--nb-shadow-sm);
	}

	.eyebrow {
		margin: 0 0 0.45rem;
		color: var(--nb-text-muted);
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.command-hero .eyebrow {
		color: rgb(255 255 255 / 0.56);
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		max-width: 13ch;
		margin-bottom: 0.8rem;
		font-size: clamp(2rem, 5vw, 4rem);
		line-height: 0.98;
		letter-spacing: -0.055em;
	}

	h2 {
		margin-bottom: 0;
		font-size: 1.25rem;
		letter-spacing: -0.02em;
	}

	.hero-copy {
		max-width: 55rem;
		margin-bottom: 0;
		color: rgb(255 255 255 / 0.7);
		font-size: 1rem;
		line-height: 1.65;
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		justify-content: flex-end;
	}

	.primary-action,
	.secondary-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.8rem;
		padding: 0.7rem 1rem;
		border-radius: var(--nb-radius-sm);
		font-weight: 800;
		text-decoration: none;
	}

	.primary-action {
		background: var(--nb-blue);
		color: white;
	}

	.secondary-action {
		border: 1px solid rgb(255 255 255 / 0.22);
		background: rgb(255 255 255 / 0.06);
		color: white;
	}

	.pulse-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 0.9rem;
	}

	.pulse-card {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
		padding: 1rem 1.1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-surface);
		box-shadow: var(--nb-shadow-sm);
	}

	.pulse-card span,
	.pulse-card small {
		color: var(--nb-text-muted);
	}

	.pulse-card span {
		font-size: 0.76rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.pulse-card strong {
		min-width: 0;
		font-size: 1.8rem;
		letter-spacing: -0.04em;
		overflow-wrap: anywhere;
	}

	.identity-card strong {
		font-size: 1.15rem;
		letter-spacing: -0.02em;
	}

	.section-block {
		margin-top: 1rem;
		padding: 1.2rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-surface);
		box-shadow: var(--nb-shadow-sm);
	}

	.section-heading {
		display: flex;
		gap: 1.5rem;
		align-items: end;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.section-heading > p {
		max-width: 35rem;
		margin-bottom: 0;
		color: var(--nb-text-muted);
		font-size: 0.88rem;
		line-height: 1.5;
		text-align: right;
	}

	.section-heading.compact {
		align-items: center;
	}

	.flow-grid {
		display: grid;
		grid-template-columns: repeat(8, minmax(8rem, 1fr));
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.15rem;
	}

	.flow-stage {
		display: grid;
		gap: 0.35rem;
		min-height: 8rem;
		padding: 0.85rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-surface-muted);
		color: var(--nb-text);
		text-decoration: none;
		transition:
			border-color 120ms ease,
			transform 120ms ease;
	}

	a.flow-stage:hover {
		border-color: var(--nb-blue);
		transform: translateY(-1px);
	}

	.flow-stage.unavailable {
		opacity: 0.52;
	}

	.flow-number {
		color: var(--nb-blue);
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.08em;
	}

	.flow-stage strong {
		font-size: 0.95rem;
	}

	.flow-stage small {
		align-self: end;
		color: var(--nb-text-muted);
		line-height: 1.35;
	}

	.command-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(17rem, 23rem);
		gap: 1rem;
		align-items: start;
	}

	.workspace-panel,
	.action-panel {
		min-width: 0;
	}

	.workspace-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.7rem;
	}

	.workspace-card {
		display: grid;
		gap: 0.8rem;
		min-width: 0;
		padding: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		color: var(--nb-text);
		text-decoration: none;
	}

	.workspace-card:hover {
		border-color: var(--nb-blue);
		background: var(--nb-surface-muted);
	}

	.workspace-card > div {
		display: flex;
		gap: 0.7rem;
		justify-content: space-between;
	}

	.workspace-card > div span {
		flex: 0 0 auto;
		color: var(--nb-text-muted);
		font-size: 0.72rem;
	}

	.workspace-card ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.workspace-card li {
		padding: 0.25rem 0.45rem;
		border-radius: 999px;
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
		font-size: 0.7rem;
	}

	.text-link {
		color: var(--nb-blue);
		font-size: 0.82rem;
		font-weight: 800;
		text-decoration: none;
	}

	.right-rail {
		min-width: 0;
	}

	.action-list {
		display: grid;
		gap: 0.4rem;
	}

	.action-list a {
		display: grid;
		gap: 0.2rem;
		padding: 0.72rem 0;
		border-bottom: 1px solid var(--nb-border);
		color: var(--nb-text);
		text-decoration: none;
	}

	.action-list a:last-child {
		border-bottom: 0;
	}

	.action-list a:hover strong {
		color: var(--nb-blue);
	}

	.action-list small,
	.muted {
		color: var(--nb-text-muted);
		line-height: 1.45;
	}

	.admin-card {
		margin-top: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-surface);
		box-shadow: var(--nb-shadow-sm);
		overflow: hidden;
	}

	.admin-card summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.1rem;
		cursor: pointer;
		list-style: none;
	}

	.admin-card summary::-webkit-details-marker {
		display: none;
	}

	.admin-card summary > span:first-child {
		display: grid;
		gap: 0.2rem;
	}

	.admin-card summary small {
		color: var(--nb-text-muted);
	}

	.admin-body {
		padding: 0 1.1rem 1.1rem;
		border-top: 1px solid var(--nb-border);
	}

	.admin-body > .muted {
		margin: 1rem 0;
		font-size: 0.82rem;
	}

	.stack {
		display: grid;
		gap: 0.9rem;
	}

	label:not(.check) {
		display: grid;
		gap: 0.4rem;
		font-size: 0.82rem;
		font-weight: 750;
	}

	input[type='email'] {
		width: 100%;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		padding: 0.72rem;
		background: white;
	}

	fieldset {
		display: grid;
		gap: 0.45rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		margin-bottom: 0.5rem;
		font-size: 0.82rem;
		font-weight: 800;
	}

	.check {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		padding: 0.55rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
	}

	.check span {
		display: grid;
		gap: 0.15rem;
	}

	.check small {
		color: var(--nb-text-muted);
	}

	button {
		justify-self: start;
		border: 0;
		border-radius: var(--nb-radius-sm);
		padding: 0.7rem 0.9rem;
		background: var(--nb-ink);
		color: white;
		font-weight: 800;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.error,
	.success {
		margin: 0;
		font-size: 0.82rem;
	}

	.error {
		color: #9b1c1c;
	}

	.success {
		color: #1f6a32;
	}

	@media (max-width: 1180px) {
		.pulse-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.command-grid {
			grid-template-columns: 1fr;
		}

		.right-rail {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 1rem;
		}

		.admin-card {
			margin-top: 1rem;
		}
	}

	@media (max-width: 760px) {
		.command-hero {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.hero-actions {
			justify-content: flex-start;
		}

		.pulse-grid,
		.workspace-grid,
		.right-rail {
			grid-template-columns: 1fr;
		}

		.section-heading {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.4rem;
		}

		.section-heading > p {
			text-align: left;
		}
	}
</style>
