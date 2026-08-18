<script lang="ts">
	let { data } = $props();
	let email = $state('');
	let selectedRoles = $state<string[]>([]);
	let submitting = $state(false);
	let invitationMessage = $state('');
	let invitationError = $state('');

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
	<title>Dashboard · NuBlox</title>
</svelte:head>

<section class="page-header">
	<p class="eyebrow">{data.organisation.name}</p>
	<h1>Dashboard</h1>
	<p>Your authenticated NuBlox workspace is active and tenant-scoped.</p>
</section>

<div class="grid">
	<section class="panel">
		<h2>Workspace status</h2>
		<dl>
			<div>
				<dt>Organisation</dt>
				<dd>{data.organisation.name}</dd>
			</div>
			<div>
				<dt>Signed in as</dt>
				<dd>{data.actor.displayName}</dd>
			</div>
			<div>
				<dt>Account</dt>
				<dd>{data.actor.email}</dd>
			</div>
		</dl>
	</section>

	<section class="panel">
		<h2>Invite a member</h2>
		{#if data.canInviteMembers}
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
		{:else}
			<p class="muted">
				You do not have the <code>member.invite</code> permission in this organisation.
			</p>
		{/if}
	</section>
</div>

<style>
	.page-header {
		margin-bottom: 1.5rem;
	}
	.eyebrow {
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.75rem;
		font-weight: 750;
		color: #61615b;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.04em;
	}
	.page-header > p:last-child,
	.muted {
		color: #5d5d57;
		line-height: 1.6;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(20rem, 1fr);
		gap: 1rem;
		align-items: start;
	}
	.panel {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.25rem;
	}
	.panel h2 {
		margin-top: 0;
	}
	dl {
		margin: 0;
		display: grid;
		gap: 0.8rem;
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
		overflow-wrap: anywhere;
	}
	.stack {
		display: grid;
		gap: 1rem;
	}
	label:not(.check) {
		display: grid;
		gap: 0.4rem;
		font-weight: 650;
	}
	input[type='email'] {
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.5rem;
		padding: 0.72rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.55rem;
	}
	legend {
		font-weight: 700;
		margin-bottom: 0.55rem;
	}
	.check {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		padding: 0.65rem;
		border: 1px solid #deded8;
		border-radius: 0.5rem;
	}
	.check span {
		display: grid;
		gap: 0.2rem;
	}
	.check small {
		color: #666;
	}
	button {
		justify-self: start;
		font: inherit;
		font-weight: 700;
		border: 1px solid #111;
		border-radius: 0.5rem;
		padding: 0.7rem 1rem;
		background: #111;
		color: white;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	.error {
		color: #9b1c1c;
		margin: 0;
	}
	.success {
		color: #1f6a32;
		margin: 0;
	}
	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
