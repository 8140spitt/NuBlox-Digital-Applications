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

	const participantStatusLabels: Record<string, string> = {
		invited: 'Invited',
		active: 'Active',
		suspended: 'Suspended',
		left: 'Left',
		removed: 'Removed',
		declined: 'Declined'
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

<nav class="project-actions" aria-label="Project controls">
	<a href={`/projects/${data.project.publicId}/plan`}>Open project plan</a>
</nav>

<div class="workspace-grid">
	<section class="panel overview">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Overview</p>
				<h2>Project record</h2>
			</div>
		</div>
		<dl>
			<div>
				<dt>Project number</dt>
				<dd>{data.project.projectNumber}</dd>
			</div>
			<div>
				<dt>Status</dt>
				<dd>{statusLabels[data.project.status] ?? data.project.status}</dd>
			</div>
			<div>
				<dt>Ownership</dt>
				<dd>
					{data.isOwningOrganisation ? 'Owned by this organisation' : 'Participating organisation'}
				</dd>
			</div>
			<div>
				<dt>Started</dt>
				<dd>
					{data.project.startedOn
						? new Date(data.project.startedOn).toLocaleDateString()
						: 'Not started'}
				</dd>
			</div>
			<div>
				<dt>Completed</dt>
				<dd>
					{data.project.completedOn
						? new Date(data.project.completedOn).toLocaleDateString()
						: 'Not completed'}
				</dd>
			</div>
		</dl>
	</section>

	<section class="panel participants">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Participants</p>
				<h2>Project organisations</h2>
			</div>
			<span class="count">{data.team.participants.length}</span>
		</div>

		{#if form?.teamError && form.teamAction.startsWith('participant-')}
			<p class="error" role="alert">{form.teamError}</p>
		{/if}

		<div class="participant-list">
			{#each data.team.participants as participant}
				<article class="participant-card">
					<div class="participant-summary">
						<div>
							<strong>{participant.organisationName}</strong>
							<small
								>{participant.organisationId === data.project.owningOrganisationId
									? 'Project owner'
									: 'Participant'}</small
							>
							<code>{participant.organisationPublicId}</code>
						</div>
						<span class={`participant-status participant-${participant.status}`}>
							{participantStatusLabels[participant.status] ?? participant.status}
						</span>
					</div>
					<div class="role-list">
						{#if participant.roles.length === 0}<span class="empty-role">No contextual role</span
							>{/if}
						{#each participant.roles as role}<span>{role.name}</span>{/each}
					</div>

					{#if data.team.canManageParticipants && !['removed', 'declined', 'left'].includes(participant.status)}
						<div class="participant-controls">
							<form method="POST" action="?/updateParticipantRoles" class="role-form">
								<input
									type="hidden"
									name="organisationPublicId"
									value={participant.organisationPublicId}
								/>
								<label>
									<span>Organisation project roles</span>
									<select name="roleKeys" multiple size="4">
										{#each data.team.roleTypes as role}
											<option
												value={role.roleKey}
												selected={participant.roles.some(
													(assigned) => assigned.roleKey === role.roleKey
												)}>{role.name}</option
											>
										{/each}
									</select>
								</label>
								<button class="secondary" type="submit">Save roles</button>
							</form>
							{#if participant.organisationId !== data.project.owningOrganisationId}
								<form method="POST" action="?/removeParticipant">
									<input
										type="hidden"
										name="organisationPublicId"
										value={participant.organisationPublicId}
									/>
									<button class="danger" type="submit">
										{participant.status === 'invited' ? 'Revoke invitation' : 'Remove participant'}
									</button>
								</form>
							{/if}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	<section id="external-collaborators" class="panel participants">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">External collaboration</p>
				<h2>Customer and contact collaborators</h2>
			</div>
			<span class="count">{data.externalCollaboration.collaborators.length}</span>
		</div>
		<p class="hint">
			Access is granted to authenticated people for this project. CRM organisations remain private
			relationship records and are never linked to NuBlox organisations.
		</p>

		{#if form?.teamError && form.teamAction.startsWith('external')}
			<p class="error" role="alert">{form.teamError}</p>
		{/if}

		<div class="participant-list">
			{#each data.externalCollaboration.collaborators as collaborator}
				<article class="participant-card">
					<div class="participant-summary">
						<div>
							<strong>{collaborator.personName}</strong>
							<small>{collaborator.email}</small>
							{#if collaborator.organisationName}<small
									>CRM affiliation · {collaborator.organisationName}</small
								>{/if}
						</div>
						<span class="participant-status participant-active">Active</span>
					</div>
					<div class="role-list">
						{#each collaborator.roles as role}<span>{role.name}</span>{/each}
					</div>
					{#if data.externalCollaboration.canManage}
						<form method="POST" action="?/removeExternalCollaborator">
							<input type="hidden" name="collaboratorPublicId" value={collaborator.publicId} />
							<button class="danger" type="submit">Remove external access</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>

		{#if data.externalCollaboration.pendingInvitations.length}
			<h3>Pending invitations</h3>
			<div class="participant-list">
				{#each data.externalCollaboration.pendingInvitations as invitation}
					<article class="participant-card">
						<div class="participant-summary">
							<div>
								<strong>{invitation.personName}</strong>
								<small>{invitation.email}</small>
								{#if invitation.organisationName}<small
										>CRM affiliation · {invitation.organisationName}</small
									>{/if}
							</div>
							<span class="participant-status participant-invited">Invited</span>
						</div>
						<div class="role-list">
							{#each invitation.roles as role}<span>{role.name}</span>{/each}
						</div>
						{#if data.externalCollaboration.canManage}
							<form method="POST" action="?/revokeExternalInvitation">
								<input type="hidden" name="invitationPublicId" value={invitation.publicId} />
								<button class="danger" type="submit">Revoke invitation</button>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{/if}

		{#if data.externalCollaboration.canManage}
			<form method="POST" action="?/inviteExternal" class="invite-form">
				<h3>Invite external person</h3>
				<p class="hint">
					Choose a direct person customer or a contact at a CRM organisation. The invitation belongs
					to that person.
				</p>
				{#if data.externalCollaboration.candidates.length === 0}
					<p class="hint">
						No active CRM people with primary email addresses are available.
						<a href="/crm?kind=person&status=active">Open Customers</a>.
					</p>
				{:else}
					<label>
						<span>Person</span>
						<select name="candidate" required>
							<option value="">Select person</option>
							{#each data.externalCollaboration.candidates as candidate}
								<option
									value={`${candidate.personPartyPublicId}|${candidate.organisationPartyPublicId ?? ''}`}
								>
									{candidate.personName} · {candidate.email}{candidate.organisationName
										? ` · ${candidate.organisationName}`
										: ' · direct person customer/contact'}
								</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Project roles</span>
						<select name="roleKeys" multiple size="6" required>
							{#each data.externalCollaboration.roleTypes as role}<option value={role.roleKey}
									>{role.name}</option
								>{/each}
						</select>
					</label>
					<button type="submit">Send personal project invitation</button>
				{/if}
			</form>
		{/if}
	</section>

	<section id="team" class="panel team">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Team</p>
				<h2>Your organisation's project members</h2>
			</div>
			<span class="count">{data.team.teamMembers.length}</span>
		</div>
		{#if data.team.ownOrganisationPublicId}
			<p class="organisation-id">
				Your NuBlox organisation ID: <code>{data.team.ownOrganisationPublicId}</code>
			</p>
		{/if}
		<p class="hint">
			Project membership controls scope. Project-role labels describe context and do not grant
			permissions by themselves.
		</p>

		{#if form?.teamError && (form.teamAction === 'add-member' || form.teamAction.startsWith('member-') || form.teamAction === 'leave-project')}
			<p class="error" role="alert">{form.teamError}</p>
		{/if}

		<div class="member-list">
			{#each data.team.teamMembers as member}
				<article class="member-card">
					<div>
						<strong>{member.displayName}</strong>
						{#if member.email}<small>{member.email}</small>{/if}
					</div>
					<div class="role-list">
						{#if member.roles.length === 0}<span class="empty-role">No contextual role</span>{/if}
						{#each member.roles as role}<span>{role.name}</span>{/each}
					</div>
					{#if data.team.canManageTeam}
						<div class="member-controls">
							<form method="POST" action="?/updateMemberRoles" class="role-form">
								<input type="hidden" name="memberPublicId" value={member.publicId} />
								<label>
									<span>Member project roles</span>
									<select name="roleKeys" multiple size="4">
										{#each data.team.roleTypes as role}
											<option
												value={role.roleKey}
												selected={member.roles.some(
													(assigned) => assigned.roleKey === role.roleKey
												)}>{role.name}</option
											>
										{/each}
									</select>
								</label>
								<button class="secondary" type="submit">Save roles</button>
							</form>
							<form method="POST" action="?/removeMember">
								<input type="hidden" name="memberPublicId" value={member.publicId} />
								<button class="danger ghost-danger" type="submit">Remove from project</button>
							</form>
						</div>
					{/if}
				</article>
			{/each}
		</div>

		{#if data.team.canManageTeam && data.team.availableMembers.length > 0}
			<form method="POST" action="?/addMember" class="add-member-form">
				<h3>Add organisation member</h3>
				<label>
					<span>Member</span>
					<select name="memberPublicId" required>
						<option value="">Select member</option>
						{#each data.team.availableMembers as member}
							<option value={member.publicId}
								>{member.displayName}{member.email ? ` · ${member.email}` : ''}</option
							>
						{/each}
					</select>
				</label>
				<label>
					<span>Project roles <small>optional</small></span>
					<select name="roleKeys" multiple size="5">
						{#each data.team.roleTypes as role}<option value={role.roleKey}>{role.name}</option
							>{/each}
					</select>
				</label>
				<button type="submit">Add to project team</button>
			</form>
		{/if}

		{#if data.team.canLeaveParticipation}
			<div class="leave-zone">
				<div>
					<strong>Leave project</strong>
					<p>
						Leaving removes this organisation's active project-member scope. The owning organisation
						can invite it again later.
					</p>
				</div>
				<form method="POST" action="?/leaveProject">
					<button class="danger" type="submit">Leave project</button>
				</form>
			</div>
		{/if}
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
			<p class="muted">
				Choose a valid transition from the current <strong
					>{statusLabels[data.project.status]}</strong
				> state.
			</p>
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
			<p class="muted">
				You do not have the <code>project.manage</code> permission for this project.
			</p>
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
			<div>
				<strong>Information</strong><span
					>Controlled documents, RFIs, submittals and instructions</span
				>
			</div>
			<div>
				<strong>Commercial</strong><span>Cost control, change, valuations and forecasting</span>
			</div>
			<div><strong>Site</strong><span>Diaries, quality, safety and field evidence</span></div>
			<div>
				<strong>Assets</strong><span>Asset handover, maintenance and operational records</span>
			</div>
		</div>
		<p class="hint">
			These domain modules are represented in the relational baseline and will be activated through
			subsequent application slices.
		</p>
	</section>
</div>

<style>
	.project-actions {
		display: flex;
		gap: 0.75rem;
		margin: -0.6rem 0 1.25rem;
	}
	.project-actions a {
		display: inline-flex;
		align-items: center;
		padding: 0.62rem 0.88rem;
		border-radius: 0.55rem;
		background: #1f1f1c;
		color: white;
		font-weight: 700;
		text-decoration: none;
	}
	.project-actions a:hover {
		background: #373732;
	}
	.breadcrumbs {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		margin-bottom: 1.1rem;
		color: #686862;
		font-size: 0.9rem;
	}
	.breadcrumbs a {
		color: inherit;
		font-weight: 650;
	}
	.project-header {
		margin-bottom: 1.5rem;
	}
	.header-meta {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-bottom: 0.5rem;
	}
	.project-number {
		font-weight: 750;
		color: #62625c;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.2rem);
		letter-spacing: -0.045em;
	}
	.project-header p {
		max-width: 60rem;
		color: #5d5d57;
		line-height: 1.6;
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
	.workspace-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		align-items: start;
	}
	.panel {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.25rem;
	}
	.panel-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
		margin-bottom: 1rem;
	}
	.eyebrow {
		margin: 0 0 0.28rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.72rem;
		font-weight: 750;
		color: #666;
	}
	.panel h2,
	.panel h3 {
		margin-top: 0;
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
	dl {
		display: grid;
		gap: 0.75rem;
		margin: 0;
	}
	dl div {
		display: grid;
		grid-template-columns: 8rem 1fr;
		gap: 1rem;
	}
	dt {
		color: #6a6a64;
	}
	dd {
		margin: 0;
		font-weight: 650;
	}
	.participant-list,
	.member-list {
		display: grid;
		gap: 0.75rem;
	}
	.participant-card,
	.member-card {
		display: grid;
		gap: 0.75rem;
		padding: 0.9rem;
		border: 1px solid #e1e1db;
		border-radius: 0.6rem;
	}
	.participant-summary {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
	}
	.participant-summary > div,
	.member-card > div:first-child {
		display: grid;
		gap: 0.2rem;
	}
	.participant-card small,
	.member-card small {
		color: #6b6b65;
		font-size: 0.78rem;
	}
	code {
		overflow-wrap: anywhere;
		font-size: 0.78rem;
	}
	.participant-status {
		font-size: 0.72rem;
		font-weight: 750;
		border-radius: 999px;
		background: #ecece6;
		padding: 0.28rem 0.48rem;
	}
	.participant-active {
		background: #e4f5e8;
	}
	.participant-invited {
		background: #fff1cd;
	}
	.participant-declined,
	.participant-left,
	.participant-removed {
		color: #666;
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
	.role-list .empty-role {
		background: transparent;
		border: 1px dashed #c8c8c0;
		color: #777;
	}
	.participant-controls,
	.member-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		align-items: end;
	}
	.role-form {
		display: flex;
		flex: 1 1 18rem;
		gap: 0.65rem;
		align-items: end;
	}
	.role-form label {
		flex: 1;
	}
	.invite-form,
	.add-member-form {
		display: grid;
		gap: 0.8rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e1e1db;
	}
	.invite-form label,
	.add-member-form label,
	.role-form label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.82rem;
		font-weight: 650;
	}
	input,
	select {
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.45rem;
		padding: 0.58rem;
		background: white;
		min-width: 0;
	}
	select[multiple] {
		padding: 0.35rem;
	}
	.organisation-id,
	.hint,
	.muted {
		color: #65655f;
		line-height: 1.55;
		font-size: 0.9rem;
	}
	.hint {
		margin-bottom: 0;
	}
	.leave-zone {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		margin-top: 1.2rem;
		padding-top: 1rem;
		border-top: 1px solid #e1e1db;
	}
	.leave-zone p {
		margin: 0.25rem 0 0;
		color: #666;
		font-size: 0.85rem;
	}
	.transition-list {
		display: grid;
		gap: 0.75rem;
	}
	.transition-form {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid #e0e0da;
		border-radius: 0.55rem;
	}
	.transition-form label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.82rem;
		font-weight: 650;
	}
	.transition-form input[type='date'] {
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.45rem;
		padding: 0.55rem;
	}
	button {
		font: inherit;
		font-weight: 750;
		border: 1px solid #111;
		border-radius: 0.5rem;
		padding: 0.65rem 0.9rem;
		background: #111;
		color: white;
		cursor: pointer;
	}
	button.secondary {
		background: white;
		color: #222;
		border-color: #aaa;
	}
	button.danger {
		background: #8f2222;
		border-color: #8f2222;
	}
	button.ghost-danger {
		background: white;
		color: #8f2222;
	}
	.error {
		color: #9b1c1c;
	}
	.modules {
		grid-column: 1 / -1;
	}
	.module-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.7rem;
	}
	.module-grid div {
		display: grid;
		gap: 0.35rem;
		padding: 0.85rem;
		border: 1px solid #e0e0da;
		border-radius: 0.55rem;
		background: #fafaf7;
	}
	.module-grid span {
		color: #666;
		font-size: 0.85rem;
		line-height: 1.45;
	}
	@media (max-width: 920px) {
		.workspace-grid {
			grid-template-columns: 1fr;
		}
		.modules {
			grid-column: auto;
		}
		.module-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 620px) {
		dl div {
			grid-template-columns: 1fr;
			gap: 0.15rem;
		}
		.module-grid {
			grid-template-columns: 1fr;
		}
		.participant-summary,
		.leave-zone {
			display: grid;
		}
		.role-form {
			display: grid;
			width: 100%;
		}
	}
</style>
