<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Teams · NuBlox</title>
</svelte:head>

<section class="page-header">
	<p class="eyebrow">Organisation administration</p>
	<h1>Teams</h1>
	<p>Maintain organisation-owned teams and units without conflating structure with permissions.</p>
</section>

<section class="principle" aria-label="Team governance principle">
	<strong>Team membership does not grant permissions.</strong>
	<span>Access remains governed by roles and explicit permission exceptions.</span>
</section>

{#if form?.teamError}
	<p class="notice error" role="alert">{form.teamError}</p>
{/if}

<section class="panel" aria-labelledby="create-team-heading">
	<div class="panel-heading">
		<div>
			<p class="eyebrow">Organisation structure</p>
			<h2 id="create-team-heading">Create team</h2>
		</div>
		<p>Create a named team or operating unit and optionally assign active or suspended members.</p>
	</div>

	<form method="POST" action="?/createTeam" class="team-form" novalidate>
		<div class="form-grid">
			<label>
				<span>Name</span>
				<input type="text" name="name" maxlength="160" required placeholder="Delivery" />
			</label>
			<label>
				<span>Description</span>
				<textarea name="description" maxlength="4000" rows="3"></textarea>
			</label>
		</div>

		<fieldset>
			<legend>Members</legend>
			<div class="member-grid">
				{#each data.members as member}
					<label class="member-option">
						<input type="checkbox" name="memberPublicId" value={member.publicId} />
						<span>
							<strong>{member.displayName}</strong>
							<small>{member.email ?? 'No primary email'} · {member.status}</small>
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<button type="submit">Create team</button>
	</form>
</section>

<section class="panel" aria-labelledby="teams-heading">
	<div class="panel-heading compact">
		<div>
			<p class="eyebrow">Current structure</p>
			<h2 id="teams-heading">Organisation teams</h2>
		</div>
		<p>Deactivate teams rather than deleting them so structural history remains attributable.</p>
	</div>

	{#if data.teams.length === 0}
		<p class="empty-state">No organisation teams have been created.</p>
	{:else}
		<div class="team-list">
			{#each data.teams as team}
				<details class="team-card">
					<summary>
						<span>
							<strong>{team.name}</strong>
							<small>{team.members.length} member{team.members.length === 1 ? '' : 's'}</small>
						</span>
						<span class:inactive={!team.isActive} class="status-pill">
							{team.isActive ? 'Active' : 'Inactive'}
						</span>
					</summary>

					<form method="POST" action="?/updateTeam" class="team-form edit-form" novalidate>
						<input type="hidden" name="teamPublicId" value={team.publicId} />
						<div class="form-grid">
							<label>
								<span>Name</span>
								<input type="text" name="name" maxlength="160" required value={team.name} />
							</label>
							<label>
								<span>Description</span>
								<textarea name="description" maxlength="4000" rows="3"
									>{team.description ?? ''}</textarea
								>
							</label>
						</div>

						<label class="active-toggle">
							<input type="checkbox" name="isActive" checked={team.isActive} />
							<span>Team is active</span>
						</label>

						<fieldset>
							<legend>Members</legend>
							<div class="member-grid">
								{#each data.members as member}
									<label class="member-option">
										<input
											type="checkbox"
											name="memberPublicId"
											value={member.publicId}
											checked={team.members.some(
												(assigned) => assigned.publicId === member.publicId
											)}
										/>
										<span>
											<strong>{member.displayName}</strong>
											<small>{member.email ?? 'No primary email'} · {member.status}</small>
										</span>
									</label>
								{/each}
							</div>
						</fieldset>

						<button type="submit">Save team</button>
					</form>
				</details>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page-header {
		margin-bottom: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		color: var(--nb-text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h1,
	h2 {
		color: var(--nb-ink);
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.04em;
	}

	.page-header > p:last-child,
	.panel-heading > p,
	.empty-state,
	.member-option small,
	summary small {
		color: var(--nb-text-muted);
		line-height: 1.5;
	}

	.principle {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
		margin-bottom: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-surface-muted);
		padding: 0.75rem 1rem;
	}

	.principle span {
		color: var(--nb-text-muted);
	}

	.notice {
		margin: 0 0 1rem;
		border: 1px solid;
		border-radius: var(--nb-radius-sm);
		padding: 0.8rem 1rem;
	}

	.notice.error {
		border-color: #e1aaaa;
		background: #fff2f2;
		color: #8d1717;
	}

	.panel {
		margin-bottom: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-surface);
		padding: 1.25rem;
		box-shadow: var(--nb-shadow-sm);
	}

	.panel-heading {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1.2rem;
	}

	.panel-heading.compact {
		margin-bottom: 0.8rem;
	}

	.panel-heading h2 {
		margin: 0;
		font-size: 1.45rem;
	}

	.panel-heading > p {
		margin: 0;
		max-width: 38rem;
	}

	.team-form {
		display: grid;
		gap: 1rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: 1rem;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-weight: 700;
	}

	input[type='text'],
	textarea {
		width: 100%;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
		color: var(--nb-text);
		padding: 0.68rem;
		font: inherit;
	}

	textarea {
		resize: vertical;
	}

	fieldset {
		margin: 0;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		padding: 0.85rem;
	}

	legend {
		padding: 0 0.35rem;
		font-weight: 800;
	}

	.member-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.5rem;
	}

	.member-option {
		display: flex;
		align-items: start;
		gap: 0.55rem;
		border-radius: var(--nb-radius-sm);
		padding: 0.55rem;
		font-weight: 600;
	}

	.member-option:hover {
		background: var(--nb-surface-muted);
	}

	.member-option input {
		margin-top: 0.2rem;
	}

	.member-option span,
	summary > span:first-child {
		display: grid;
	}

	button {
		justify-self: start;
		border: 1px solid var(--nb-ink);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-ink);
		color: var(--nb-white);
		font-weight: 750;
		padding: 0.65rem 0.95rem;
		cursor: pointer;
	}

	.team-list {
		display: grid;
		gap: 0.75rem;
	}

	.team-card {
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
	}

	.team-card summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 1rem;
		cursor: pointer;
	}

	.status-pill {
		border-radius: 999px;
		background: #edf7ef;
		color: #185c29;
		padding: 0.25rem 0.55rem;
		font-size: 0.78rem;
		font-weight: 800;
	}

	.status-pill.inactive {
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
	}

	.edit-form {
		border-top: 1px solid var(--nb-border);
		padding: 1rem;
	}

	.active-toggle {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	@media (max-width: 760px) {
		.panel-heading {
			display: block;
		}

		.panel-heading > p {
			margin-top: 0.5rem;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
