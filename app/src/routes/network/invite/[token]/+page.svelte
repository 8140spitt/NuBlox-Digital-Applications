<script lang="ts">
	import { untrack } from 'svelte';
	import { authClient } from '$lib/auth-client';

	let { data, form } = $props();
	let displayName = $state(untrack(() => ''));
	let password = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let message = $state('');

	function dateTime(value: string | null): string {
		if (!value) return 'No deadline';
		return new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	async function createAccount(event: SubmitEvent) {
		event.preventDefault();
		if (data.actor) return;
		submitting = true;
		message = '';
		const callbackURL = `${window.location.origin}/signin?verified=1&returnTo=${encodeURIComponent('/portal')}`;
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
	<title>{data.invitation.title} · NuBlox Network</title>
</svelte:head>

<main class="shell">
	<section class="card">
		<header>
			<p class="brand">NuBlox Network</p>
			<p class="eyebrow">External work invitation</p>
			<h1>{data.invitation.title}</h1>
			<p class="lede">
				<strong>{data.invitation.owningOrganisationName}</strong> has shared a controlled action
				with you through NuBlox.
			</p>
		</header>

		<div class="invitation-summary">
			<div><span>Invited email</span><strong>{data.invitation.email}</strong></div>
			<div><span>Area</span><strong>{data.invitation.domainKey}</strong></div>
			<div><span>Action</span><strong>{data.invitation.actionType.replaceAll('_', ' ')}</strong></div>
			<div><span>Due</span><strong>{dateTime(data.invitation.dueAt)}</strong></div>
		</div>

		{#if data.invitation.summary}
			<p class="summary">{data.invitation.summary}</p>
		{/if}

		<div class="boundary-note">
			<strong>Only this explicitly shared work is available.</strong>
			<span>
				Accepting does not make you a member of {data.invitation.owningOrganisationName} and does
				not expose unrelated NuBlox records. Access is attached to your verified identity and can be
				revoked independently.
			</span>
		</div>

		{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}

		{#if data.actor}
			<section class="choice-section">
				<p class="eyebrow">Signed in</p>
				<h2>Accept this shared work</h2>
				<p class="muted">Signed in as {data.actor.displayName} · {data.actor.email}</p>
				{#if !data.emailMatchesActor}
					<div class="notice warning">
						This invitation was sent to {data.invitation.email}. Sign in with that verified email
						address to accept it.
					</div>
				{:else}
					<form method="POST" action="?/accept">
						<button class="primary" type="submit">Accept and open NuBlox Network</button>
					</form>
				{/if}
			</section>
		{:else if submitted}
			<section class="notice success">
				<h2>Check your email</h2>
				<p>
					A verification link has been sent to <strong>{data.invitation.email}</strong>. After
					verification, sign in and NuBlox will activate only the external access granted by this
					invitation.
				</p>
			</section>
		{:else}
			<section class="choice-section">
				<p class="eyebrow">New to NuBlox</p>
				<h2>Create your personal sign-in</h2>
				<p class="muted">No organisation setup is required for this invitation.</p>
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
					{#if message}<p class="error" role="alert">{message}</p>{/if}
					<button class="primary" type="submit" disabled={submitting}>
						{submitting ? 'Creating account…' : 'Create account and continue'}
					</button>
				</form>
				<p class="switch-copy">
					Already use NuBlox?
					<a href={`/signin?returnTo=${encodeURIComponent(data.returnTo)}`}>Sign in to accept</a>
				</p>
			</section>
		{/if}

		<footer>Invitation expires {dateTime(data.invitation.expiresAt)}.</footer>
	</section>
</main>

<style>
	.shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: clamp(1rem, 4vw, 2rem);
		background: var(--nb-cloud, #f5f7fa);
	}
	.card {
		width: min(100%, 48rem);
		background: white;
		border: 1px solid #d9dde5;
		border-radius: 1rem;
		padding: clamp(1.25rem, 4vw, 2rem);
		box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.06);
	}
	.brand {
		margin: 0 0 1.8rem;
		font-weight: 850;
		letter-spacing: -0.02em;
	}
	.eyebrow {
		margin: 0 0 0.35rem;
		color: #667085;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-size: clamp(1.8rem, 6vw, 2.8rem);
		letter-spacing: -0.04em;
	}
	h2 { margin: 0; }
	.lede, .muted, .switch-copy, footer, .summary { color: #5c6678; line-height: 1.55; }
	.invitation-summary {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.7rem;
		margin: 1.5rem 0;
	}
	.invitation-summary > div {
		display: grid;
		gap: 0.2rem;
		padding: 0.85rem;
		border: 1px solid #dfe3ea;
		border-radius: 0.65rem;
		background: #fafbfc;
	}
	.invitation-summary span { color: #667085; font-size: 0.75rem; }
	.invitation-summary strong { text-transform: capitalize; }
	.boundary-note {
		display: grid;
		gap: 0.35rem;
		padding: 1rem;
		border: 1px solid #cad9ef;
		border-radius: 0.65rem;
		background: #f3f7fd;
		line-height: 1.5;
	}
	.choice-section {
		border-top: 1px solid #e1e5eb;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
	}
	.stack { display: grid; gap: 1rem; margin-top: 1.2rem; }
	label { display: grid; gap: 0.4rem; font-weight: 650; }
	input {
		min-width: 0;
		font: inherit;
		border: 1px solid #b9c0cc;
		border-radius: 0.55rem;
		padding: 0.75rem 0.85rem;
	}
	input[readonly] { background: #f3f5f8; color: #555; }
	button {
		font: inherit;
		font-weight: 750;
		border-radius: 0.55rem;
		padding: 0.75rem 0.95rem;
		cursor: pointer;
	}
	.primary { border: 1px solid #172033; background: #172033; color: white; }
	button:disabled { opacity: 0.55; cursor: wait; }
	.notice { margin: 1.2rem 0; padding: 1rem; border-radius: 0.65rem; line-height: 1.5; }
	.notice.success { background: #e8f6eb; }
	.notice.warning { background: #fff5d9; }
	.error { color: #9b1c1c; }
	a { color: inherit; font-weight: 750; }
	footer { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e1e5eb; font-size: 0.78rem; }
	@media (max-width: 680px) { .invitation-summary { grid-template-columns: 1fr; } }
</style>
