<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let { data, form } = $props();
	let displayName = $state(data.invitation.contactName);
	let password = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let message = $state('');

	async function createAccount(event: SubmitEvent) {
		event.preventDefault();
		if (data.actor) return;
		submitting = true;
		message = '';
		const bootstrap = await fetch('/api/project-collaboration/bootstrap-intents', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ defaultTimezone: 'Europe/London', defaultCurrencyCode: 'GBP' })
		});
		if (!bootstrap.ok) {
			const body = await bootstrap.json().catch(() => null);
			message = body?.message ?? 'The invited organisation could not be prepared.';
			submitting = false;
			return;
		}
		const callbackURL = `${window.location.origin}/signin?verified=1&returnTo=${encodeURIComponent('/select-organisation')}`;
		const result = await authClient.signUp.email({
			email: data.invitation.email,
			name: displayName.trim(),
			password,
			callbackURL
		});
		submitting = false;
		if (result.error) {
			message = result.error.message ?? 'Your NuBlox account could not be created.';
			return;
		}
		submitted = true;
	}
</script>

<svelte:head>
	<title>Join {data.invitation.projectName} · NuBlox</title>
</svelte:head>

<main class="shell">
	<section class="card">
		<header>
			<p class="brand">NuBlox</p>
			<p class="eyebrow">Project collaboration</p>
			<h1>Join {data.invitation.projectName}</h1>
			<p class="lede">
				<strong>{data.invitation.invitingOrganisationName}</strong> invited
				<strong>{data.invitation.crmOrganisationName}</strong> to collaborate on
				{data.invitation.projectNumber}.
			</p>
		</header>

		<div class="invitation-summary">
			<div><span>Organisation</span><strong>{data.invitation.crmOrganisationName}</strong></div>
			<div><span>Invited contact</span><strong>{data.invitation.contactName}</strong></div>
			<div><span>Email</span><strong>{data.invitation.email}</strong></div>
			<div>
				<span>Project roles</span>
				<strong>{data.invitation.roleNames.join(', ')}</strong>
			</div>
		</div>

		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}

		{#if data.actor}
			<section class="choice-section">
				<p class="eyebrow">Signed in</p>
				<h2>Choose how to connect {data.invitation.crmOrganisationName}</h2>
				<p class="muted">Signed in as {data.actor.displayName} · {data.actor.email}</p>

				{#if !data.emailMatchesActor}
					<div class="notice warning">
						This invitation was sent to {data.invitation.email}. Sign in with that verified email
						address to accept it.
					</div>
				{:else}
					<div class="choices">
						{#if data.currentOrganisation}
							<article>
								<div>
									<p class="eyebrow">Existing NuBlox organisation</p>
									<h3>{data.currentOrganisation.name}</h3>
									<p>
										Connect this organisation to the CRM customer and join the project immediately.
									</p>
								</div>
								{#if data.currentOrganisation.canAccept}
									<form method="POST" action="?/acceptCurrent">
										<button class="primary" type="submit">Connect and join project</button>
									</form>
								{:else}
									<p class="muted">Organisation administrator authority is required.</p>
								{/if}
							</article>
						{/if}

						<article>
							<div>
								<p class="eyebrow">New NuBlox organisation</p>
								<h3>{data.invitation.crmOrganisationName}</h3>
								<p>
									Create the invited organisation from the CRM identity, connect it automatically
									and join the project as its initial owner.
								</p>
							</div>
							<form method="POST" action="?/createOrganisation">
								<button class="secondary" type="submit">Create organisation and join</button>
							</form>
						</article>
					</div>

					<p class="switch-copy">
						Need a different existing organisation?
						<a href={`/select-organisation?returnTo=${encodeURIComponent(data.returnTo)}`}
							>Switch organisation</a
						>
					</p>
				{/if}
			</section>
		{:else if submitted}
			<section class="notice success">
				<h2>Check your email</h2>
				<p>
					We sent a verification link to <strong>{data.invitation.email}</strong>. Verification
					creates {data.invitation.crmOrganisationName}, connects it to the inviter's CRM record and
					joins it to this project automatically.
				</p>
			</section>
		{:else}
			<section class="choice-section">
				<p class="eyebrow">New to NuBlox</p>
				<h2>Create your account</h2>
				<p class="muted">
					Your organisation details come from the invitation, so there is no organisation ID to
					find, copy or send back.
				</p>
				<form class="stack" onsubmit={createAccount}>
					<label>
						<span>Your name</span>
						<input bind:value={displayName} autocomplete="name" required maxlength="200" />
					</label>
					<label>
						<span>Email</span>
						<input value={data.invitation.email} readonly aria-readonly="true" />
					</label>
					<label>
						<span>Password</span>
						<input
							bind:value={password}
							type="password"
							autocomplete="new-password"
							minlength="12"
							maxlength="128"
							required
						/>
					</label>
					<div class="organisation-preview">
						<span>Organisation to create</span>
						<strong>{data.invitation.crmLegalName}</strong>
						{#if data.invitation.crmTradingName}<small
								>Trading as {data.invitation.crmTradingName}</small
							>{/if}
					</div>
					{#if message}<p class="error" role="alert">{message}</p>{/if}
					<button class="primary" type="submit" disabled={submitting}>
						{submitting ? 'Preparing account…' : 'Create account and join project'}
					</button>
				</form>
				<p class="switch-copy">
					Already use NuBlox?
					<a href={`/signin?returnTo=${encodeURIComponent(data.returnTo)}`}>Sign in to accept</a>
				</p>
			</section>
		{/if}

		<footer>
			Invitation expires {new Date(data.invitation.expiresAt).toLocaleString()}.
		</footer>
	</section>
</main>

<style>
	.shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 2rem;
		background: #f5f5f2;
	}
	.card {
		width: min(100%, 52rem);
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 1rem;
		padding: 2rem;
		box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.06);
	}
	.brand {
		margin: 0 0 1.8rem;
		font-weight: 850;
		letter-spacing: -0.02em;
	}
	.eyebrow {
		margin: 0 0 0.35rem;
		color: #62625c;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 6vw, 3rem);
		letter-spacing: -0.045em;
	}
	h2,
	h3 {
		margin: 0;
	}
	.lede,
	.muted,
	.switch-copy,
	footer {
		color: #5c5c56;
		line-height: 1.55;
	}
	.invitation-summary {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.7rem;
		margin: 1.5rem 0;
	}
	.invitation-summary > div,
	.organisation-preview {
		display: grid;
		gap: 0.2rem;
		padding: 0.85rem;
		border: 1px solid #deded7;
		border-radius: 0.6rem;
		background: #fafaf7;
	}
	.invitation-summary span,
	.organisation-preview span {
		color: #6b6b65;
		font-size: 0.75rem;
	}
	.choice-section {
		border-top: 1px solid #e1e1da;
		padding-top: 1.5rem;
	}
	.choices {
		display: grid;
		gap: 0.8rem;
		margin-top: 1rem;
	}
	.choices article {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem;
		padding: 1rem;
		border: 1px solid #d8d8d1;
		border-radius: 0.7rem;
	}
	.choices article p {
		margin: 0.35rem 0 0;
		color: #5c5c56;
		line-height: 1.45;
	}
	.stack {
		display: grid;
		gap: 1rem;
		margin-top: 1.2rem;
	}
	label {
		display: grid;
		gap: 0.4rem;
		font-weight: 650;
	}
	input {
		min-width: 0;
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.55rem;
		padding: 0.75rem 0.85rem;
	}
	input[readonly] {
		background: #f3f3ef;
		color: #555;
	}
	button {
		font: inherit;
		font-weight: 750;
		border-radius: 0.55rem;
		padding: 0.75rem 0.95rem;
		cursor: pointer;
	}
	.primary {
		border: 1px solid #111;
		background: #111;
		color: white;
	}
	.secondary {
		border: 1px solid #777;
		background: white;
		color: #111;
	}
	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	.notice {
		margin: 1.2rem 0;
		padding: 1rem;
		border-radius: 0.65rem;
		line-height: 1.5;
	}
	.notice.success {
		background: #e8f6eb;
	}
	.notice.warning {
		background: #fff5d9;
	}
	.error {
		color: #9b1c1c;
	}
	a {
		color: inherit;
		font-weight: 750;
	}
	footer {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid #e1e1da;
		font-size: 0.78rem;
	}
	@media (max-width: 680px) {
		.invitation-summary {
			grid-template-columns: 1fr;
		}
		.choices article {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
