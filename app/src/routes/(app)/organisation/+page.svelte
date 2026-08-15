<script lang="ts">
	let { data, form } = $props();

	function formatDate(value: Date | string | null): string {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	function statusLabel(value: string): string {
		return value.charAt(0).toUpperCase() + value.slice(1);
	}
</script>

<svelte:head>
	<title>Organisation administration · NuBlox</title>
</svelte:head>

<section class="page-header">
	<p class="eyebrow">Organisation administration</p>
	<h1>{data.organisation.name}</h1>
	<p>Manage members, invitations, organisation roles and role permission grants.</p>
</section>

{#if form?.adminError}
	<p class="notice error" role="alert">{form.adminError}</p>
{/if}
{#if form?.adminSuccess}
	<p class="notice success" role="status">{form.adminSuccess}</p>
{/if}

<nav class="section-nav" aria-label="Organisation administration sections">
	{#if data.canManageMembers}<a href="#members">Members</a>{/if}
	{#if data.canInvite}<a href="#invitations">Invitations</a>{/if}
	{#if data.canManageOrganisation}<a href="#roles">Roles & permissions</a>{/if}
</nav>

<div class="metrics">
	{#if data.canManageMembers}
		<div><strong>{data.members.length}</strong><span>members</span></div>
	{/if}
	{#if data.canInvite}
		<div>
			<strong>{data.invitations.filter((invitation) => invitation.status === 'pending').length}</strong>
			<span>pending invitations</span>
		</div>
	{/if}
	{#if data.canManageOrganisation}
		<div><strong>{data.roles.filter((role) => role.isActive).length}</strong><span>active roles</span></div>
	{/if}
</div>

{#if data.canInvite}
	<section class="panel" aria-labelledby="invite-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Access</p>
				<h2 id="invite-heading">Invite a member</h2>
			</div>
			<p>Invitations expire after seven days and activate only after verified-email completion.</p>
		</div>

		<form method="POST" action="?/invite" class="form-grid">
			<label class="wide">
				<span>Email</span>
				<input type="email" name="email" maxlength="320" required placeholder="name@example.com" />
			</label>

			{#if data.canManageMembers && data.roles.some((role) => role.isActive)}
				<fieldset class="wide">
					<legend>Roles to assign after acceptance</legend>
					<div class="choice-grid">
						{#each data.roles.filter((role) => role.isActive) as role}
							<label class="choice">
								<input type="checkbox" name="rolePublicId" value={role.publicId} />
								<span><strong>{role.name}</strong>{#if role.description}<small>{role.description}</small>{/if}</span>
							</label>
						{/each}
					</div>
				</fieldset>
			{:else if !data.canManageMembers}
				<p class="muted wide">You can invite members, but role assignment requires <code>member.manage</code>.</p>
			{/if}

			<button type="submit">Send invitation</button>
		</form>
	</section>
{/if}

{#if data.canManageMembers}
	<section class="panel" id="members" aria-labelledby="members-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Membership</p>
				<h2 id="members-heading">Members</h2>
			</div>
			<p>Membership state and organisation roles are independent controls. Self-demotion is blocked.</p>
		</div>

		<div class="records">
			{#each data.members as member}
				<article class="record">
					<div class="record-main">
						<div>
							<h3>{member.displayName}{#if member.isCurrent} <span class="you">You</span>{/if}</h3>
							<p>{member.email ?? 'No primary email recorded'}</p>
						</div>
						<span class:inactive={member.status !== 'active'} class="status">{statusLabel(member.status)}</span>
					</div>

					<div class="record-meta">
						<span>Joined {formatDate(member.joinedAt)}</span>
						<span>
							{member.roles.length > 0
								? member.roles.map((role) => role.name).join(', ')
								: 'No organisation role'}
						</span>
					</div>

					<div class="record-actions">
						<form method="POST" action="?/setMemberStatus" class="inline-form">
							<input type="hidden" name="memberPublicId" value={member.publicId} />
							<label>
								<span>Status</span>
								<select name="status" disabled={member.isCurrent}>
									{#each ['active', 'suspended', 'disabled', 'left'] as status}
										<option value={status} selected={member.status === status}>{statusLabel(status)}</option>
									{/each}
								</select>
							</label>
							<button type="submit" class="secondary" disabled={member.isCurrent}>Update status</button>
						</form>

						<details>
							<summary>Manage roles</summary>
							<form method="POST" action="?/setMemberRoles" class="stack">
								<input type="hidden" name="memberPublicId" value={member.publicId} />
								<div class="choice-grid compact">
									{#each data.roles.filter((role) => role.isActive) as role}
										<label class="choice">
											<input
												type="checkbox"
												name="rolePublicId"
												value={role.publicId}
												checked={member.roles.some((assigned) => assigned.publicId === role.publicId)}
												disabled={member.isCurrent}
											/>
											<span>{role.name}</span>
										</label>
									{/each}
								</div>
								<button type="submit" class="secondary" disabled={member.isCurrent}>Save roles</button>
							</form>
						</details>
					</div>
				</article>
			{/each}
		</div>
	</section>
{/if}

{#if data.canInvite}
	<section class="panel" id="invitations" aria-labelledby="invitations-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Provisioning</p>
				<h2 id="invitations-heading">Invitations</h2>
			</div>
			<p>The most recent 100 invitation records are retained here as operational history.</p>
		</div>

		<div class="records">
			{#if data.invitations.length === 0}
				<p class="muted">No invitations have been issued for this organisation.</p>
			{/if}
			{#each data.invitations as invitation}
				<article class="record">
					<div class="record-main">
						<div>
							<h3>{invitation.email}</h3>
							<p>Invited by {invitation.invitedByName} · {formatDate(invitation.createdAt)}</p>
						</div>
						<span class:inactive={invitation.status !== 'pending'} class="status">{statusLabel(invitation.status)}</span>
					</div>
					<div class="record-meta">
						<span>Expires {formatDate(invitation.expiresAt)}</span>
						<span>{invitation.roles.length > 0 ? invitation.roles.map((role) => role.name).join(', ') : 'No role assignment'}</span>
					</div>

					{#if invitation.status === 'pending' || invitation.status === 'expired'}
						<div class="button-row">
							{#if data.canManageMembers}
								<form method="POST" action="?/resendInvitation">
									<input type="hidden" name="invitationPublicId" value={invitation.publicId} />
									<button type="submit" class="secondary">Resend</button>
								</form>
							{/if}
							<form method="POST" action="?/revokeInvitation">
								<input type="hidden" name="invitationPublicId" value={invitation.publicId} />
								<button type="submit" class="danger">Revoke</button>
							</form>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	</section>
{/if}

{#if data.canManageOrganisation}
	<section class="panel" id="roles" aria-labelledby="roles-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Authorisation</p>
				<h2 id="roles-heading">Roles & permissions</h2>
			</div>
			<p>Permission definitions are platform-controlled. Organisations decide which permissions each organisation role grants.</p>
		</div>

		<details class="create-role">
			<summary>Create organisation role</summary>
			<form method="POST" action="?/createRole" class="stack role-form">
				<label>
					<span>Name</span>
					<input type="text" name="name" maxlength="160" required />
				</label>
				<label>
					<span>Description</span>
					<textarea name="description" rows="2" maxlength="4000"></textarea>
				</label>
				<fieldset>
					<legend>Permission grants</legend>
					<div class="permission-list">
						{#each data.permissions as permission}
							<label class="choice">
								<input type="checkbox" name="permissionKey" value={permission.key} />
								<span><strong>{permission.key}</strong><small>{permission.name}</small></span>
							</label>
						{/each}
					</div>
				</fieldset>
				<button type="submit">Create role</button>
			</form>
		</details>

		<div class="records role-records">
			{#each data.roles as role}
				<article class="record">
					<div class="record-main">
						<div>
							<h3>{role.name}</h3>
							<p>{role.description ?? 'No role description'}</p>
						</div>
						<span class:inactive={!role.isActive} class="status">{role.isActive ? 'Active' : 'Inactive'}</span>
					</div>
					<div class="record-meta">
						<span>{role.memberCount} member{role.memberCount === 1 ? '' : 's'}</span>
						<span>{role.permissionKeys.length} permission grant{role.permissionKeys.length === 1 ? '' : 's'}</span>
					</div>

					<details>
						<summary>Edit role and grants</summary>
						<form method="POST" action="?/updateRole" class="stack role-form">
							<input type="hidden" name="rolePublicId" value={role.publicId} />
							<label>
								<span>Name</span>
								<input type="text" name="name" maxlength="160" required value={role.name} />
							</label>
							<label>
								<span>Description</span>
								<textarea name="description" rows="2" maxlength="4000">{role.description ?? ''}</textarea>
							</label>
							<label class="choice standalone">
								<input type="checkbox" name="isActive" checked={role.isActive} />
								<span><strong>Role is active</strong><small>Inactive roles do not grant permissions.</small></span>
							</label>
							<fieldset>
								<legend>Permission grants</legend>
								<div class="permission-list">
									{#each data.permissions as permission}
										<label class="choice">
											<input
												type="checkbox"
												name="permissionKey"
												value={permission.key}
												checked={role.permissionKeys.includes(permission.key)}
											/>
											<span><strong>{permission.key}</strong><small>{permission.name}</small></span>
										</label>
									{/each}
								</div>
							</fieldset>
							<button type="submit">Save role</button>
						</form>
					</details>
				</article>
			{/each}
		</div>
	</section>
{/if}

<style>
	.page-header { margin-bottom: 1.25rem; }
	.eyebrow { margin: 0 0 0.35rem; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.72rem; font-weight: 800; color: #66665f; }
	h1 { margin: 0; font-size: clamp(2rem, 5vw, 3rem); letter-spacing: -0.04em; }
	.page-header > p:last-child, .muted, .panel-heading > p { color: #60605a; line-height: 1.55; }
	.notice { padding: 0.8rem 1rem; border-radius: 0.55rem; margin: 0 0 1rem; border: 1px solid; }
	.notice.error { border-color: #e1aaaa; background: #fff2f2; color: #8d1717; }
	.notice.success { border-color: #a8d3b0; background: #f0faf2; color: #185c29; }
	.section-nav { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
	.section-nav a { color: inherit; text-decoration: none; font-weight: 700; border: 1px solid #d5d5ce; border-radius: 999px; padding: 0.45rem 0.8rem; background: white; }
	.metrics { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
	.metrics div { min-width: 9rem; display: grid; gap: 0.1rem; padding: 0.85rem 1rem; background: white; border: 1px solid #d9d9d2; border-radius: 0.7rem; }
	.metrics strong { font-size: 1.5rem; }
	.metrics span { color: #676760; font-size: 0.85rem; }
	.panel { scroll-margin-top: 1rem; margin-bottom: 1rem; background: white; border: 1px solid #d9d9d2; border-radius: 0.8rem; padding: 1.25rem; }
	.panel-heading { display: flex; align-items: start; justify-content: space-between; gap: 2rem; margin-bottom: 1rem; }
	.panel-heading h2 { margin: 0; font-size: 1.45rem; }
	.panel-heading > p { margin: 0; max-width: 38rem; }
	.form-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1rem; align-items: end; }
	.wide { grid-column: 1 / -1; }
	.stack { display: grid; gap: 0.85rem; }
	label:not(.choice) { display: grid; gap: 0.35rem; font-weight: 650; }
	input[type='email'], input[type='text'], select, textarea { width: 100%; box-sizing: border-box; font: inherit; border: 1px solid #bcbcb4; border-radius: 0.48rem; padding: 0.68rem; background: white; color: inherit; }
	textarea { resize: vertical; }
	fieldset { min-width: 0; border: 0; padding: 0; margin: 0; }
	legend { font-weight: 750; margin-bottom: 0.55rem; }
	.choice-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.5rem; }
	.choice-grid.compact { grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); }
	.choice { display: flex; align-items: flex-start; gap: 0.55rem; border: 1px solid #deded8; border-radius: 0.48rem; padding: 0.6rem; font-weight: 500; }
	.choice.standalone { max-width: 28rem; }
	.choice span { display: grid; gap: 0.12rem; min-width: 0; }
	.choice strong { overflow-wrap: anywhere; }
	.choice small { color: #696963; line-height: 1.35; }
	.records { display: grid; gap: 0.7rem; }
	.record { border: 1px solid #deded8; border-radius: 0.65rem; padding: 0.9rem; }
	.record-main { display: flex; align-items: start; justify-content: space-between; gap: 1rem; }
	.record h3 { margin: 0; font-size: 1.05rem; }
	.record-main p { margin: 0.25rem 0 0; color: #66665f; }
	.you { display: inline-block; margin-left: 0.35rem; border-radius: 999px; background: #ecece7; padding: 0.12rem 0.45rem; font-size: 0.72rem; vertical-align: middle; }
	.status { flex: 0 0 auto; border-radius: 999px; background: #e8f4ea; color: #215b2d; padding: 0.28rem 0.55rem; font-size: 0.78rem; font-weight: 750; }
	.status.inactive { background: #efefeb; color: #64645d; }
	.record-meta { display: flex; flex-wrap: wrap; gap: 0.45rem 1rem; margin-top: 0.7rem; color: #5f5f59; font-size: 0.85rem; }
	.record-actions { display: grid; gap: 0.65rem; margin-top: 0.85rem; }
	.inline-form { display: flex; flex-wrap: wrap; align-items: end; gap: 0.6rem; }
	.inline-form label { min-width: 11rem; }
	details { border-top: 1px solid #e4e4de; padding-top: 0.7rem; }
	details summary { cursor: pointer; font-weight: 700; }
	details > form { margin-top: 0.8rem; }
	.create-role { border: 1px solid #deded8; border-radius: 0.6rem; padding: 0.8rem; margin-bottom: 0.8rem; }
	.create-role summary { font-size: 1rem; }
	.role-form { max-width: 58rem; }
	.permission-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: 0.45rem; max-height: 24rem; overflow: auto; padding: 0.1rem; }
	.button-row { display: flex; gap: 0.55rem; margin-top: 0.8rem; }
	button { font: inherit; font-weight: 750; border: 1px solid #111; border-radius: 0.48rem; padding: 0.62rem 0.9rem; background: #111; color: white; cursor: pointer; }
	button.secondary { background: white; color: #181818; border-color: #b8b8b0; }
	button.danger { background: white; color: #941f1f; border-color: #d8aaaa; }
	button:disabled { opacity: 0.45; cursor: not-allowed; }
	code { font-size: 0.9em; }
	@media (max-width: 760px) {
		.panel-heading { display: block; }
		.panel-heading > p { margin-top: 0.5rem; }
		.form-grid { grid-template-columns: 1fr; }
		.wide { grid-column: auto; }
		.record-main { align-items: flex-start; }
		.inline-form { display: grid; }
		.permission-list, .choice-grid { grid-template-columns: 1fr; }
	}
</style>
