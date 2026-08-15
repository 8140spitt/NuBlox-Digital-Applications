<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let { data } = $props();
	let name = $state('');
	let password = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let message = $state('');

	async function createAccount(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		message = '';
		const callbackURL = `${window.location.origin}/signin?verified=1`;
		const result = await authClient.signUp.email({
			email: data.invitation.email,
			name: name.trim(),
			password,
			callbackURL
		});
		submitting = false;
		if (result.error) {
			message = result.error.message ?? 'The account could not be created.';
			return;
		}
		submitted = true;
	}

	async function signOut() {
		await authClient.signOut();
		window.location.reload();
	}
</script>

<svelte:head>
	<title>Accept invitation · NuBlox</title>
</svelte:head>

<main class="auth-shell">
	<section class="auth-card">
		<p class="eyebrow">NuBlox invitation</p>
		<h1>Join {data.invitation.organisationName}</h1>
		<p class="lede">
			This invitation is for <strong>{data.invitation.email}</strong> and expires
			{new Date(data.invitation.expiresAt).toLocaleString()}.
		</p>

		{#if data.actor && data.canAcceptExisting}
			<div class="notice">Signed in as {data.actor.email}.</div>
			<form method="POST" action="?/accept">
				<button class="primary" type="submit">Accept invitation</button>
			</form>
		{:else if data.actor}
			<div class="notice warning">
				You are signed in as {data.actor.email}, but this invitation belongs to
				{data.invitation.email}.
			</div>
			<button class="secondary" type="button" onclick={signOut}>Sign out and continue</button>
		{:else if submitted}
			<div class="notice success">
				Account created. Check {data.invitation.email} for the NuBlox verification link. Your
				organisation membership becomes active only after the email is verified.
			</div>
			<p><a href="/signin">Go to sign in</a></p>
		{:else}
			<form class="stack" onsubmit={createAccount}>
				<label>
					<span>Name</span>
					<input bind:value={name} name="name" autocomplete="name" required maxlength="200" />
				</label>
				<label>
					<span>Email</span>
					<input value={data.invitation.email} type="email" disabled />
				</label>
				<label>
					<span>Password</span>
					<input
						bind:value={password}
						name="password"
						type="password"
						autocomplete="new-password"
						minlength="12"
						maxlength="128"
						required
					/>
				</label>
				{#if message}<p class="error" role="alert">{message}</p>{/if}
				<button class="primary" type="submit" disabled={submitting}>
					{submitting ? 'Creating account…' : 'Create NuBlox account'}
				</button>
			</form>
			<p class="secondary-copy">
				Already have a NuBlox account?
				<a href={`/signin?returnTo=${encodeURIComponent(data.returnTo)}`}>Sign in</a>
			</p>
		{/if}
	</section>
</main>

<style>
	.auth-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 2rem;
		background: #f5f5f2;
	}
	.auth-card {
		width: min(100%, 34rem);
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 1rem;
		padding: 2rem;
		box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.06);
	}
	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	h1 { margin: 0 0 0.75rem; font-size: 2rem; }
	.lede, .secondary-copy { color: #52524d; line-height: 1.6; }
	.stack { display: grid; gap: 1rem; margin-top: 1.5rem; }
	label { display: grid; gap: 0.4rem; font-weight: 600; }
	input {
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.55rem;
		padding: 0.75rem 0.85rem;
	}
	input:focus { outline: 2px solid #222; outline-offset: 2px; }
	button {
		font: inherit;
		font-weight: 700;
		border-radius: 0.55rem;
		padding: 0.8rem 1rem;
		cursor: pointer;
	}
	.primary { border: 1px solid #111; background: #111; color: white; }
	.secondary { border: 1px solid #aaa; background: white; color: #111; }
	button:disabled { opacity: 0.55; cursor: wait; }
	.notice { margin: 1.25rem 0; padding: 0.9rem; border-radius: 0.55rem; background: #f0f0ec; }
	.notice.warning { background: #fff4d6; }
	.notice.success { background: #e8f6eb; }
	.error { color: #9b1c1c; margin: 0; }
	a { color: inherit; font-weight: 700; }
</style>
