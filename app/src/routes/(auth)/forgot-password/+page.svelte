<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let email = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let message = $state('');

	async function requestReset(event: SubmitEvent) {
		event.preventDefault();
		submitting = true;
		message = '';

		const result = await authClient.requestPasswordReset({
			email: email.trim(),
			redirectTo: `${window.location.origin}/reset-password`
		});

		submitting = false;
		if (result.error) {
			message = 'Password reset could not be requested. Try again.';
			return;
		}

		submitted = true;
	}
</script>

<svelte:head>
	<title>Forgot password · NuBlox</title>
</svelte:head>

<main class="auth-shell">
	<section class="auth-card">
		<p class="brand">NuBlox</p>
		<p class="eyebrow">Account recovery</p>
		<h1>Reset your password</h1>

		{#if submitted}
			<div class="notice success" role="status">
				If a NuBlox account exists for <strong>{email}</strong>, a password-reset link has been sent.
				For local development, check the terminal running NuBlox.
			</div>
			<p class="support-copy">
				<a href="/signin">Back to sign in</a>
			</p>
		{:else}
			<p class="lede">
				Enter your account email. We will send a time-limited link that lets you choose a new password.
			</p>

			<form class="stack" onsubmit={requestReset}>
				<label>
					<span>Email</span>
					<input
						bind:value={email}
						type="email"
						autocomplete="email"
						required
						maxlength="320"
					/>
				</label>
				{#if message}<p class="error" role="alert">{message}</p>{/if}
				<button type="submit" disabled={submitting}>
					{submitting ? 'Sending reset link…' : 'Send reset link'}
				</button>
			</form>

			<p class="support-copy"><a href="/signin">Back to sign in</a></p>
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
		width: min(100%, 30rem);
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 1rem;
		padding: 2rem;
		box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.06);
	}
	.brand { font-weight: 800; letter-spacing: -0.02em; margin: 0 0 2rem; }
	.eyebrow {
		margin: 0 0 0.45rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.75rem;
		font-weight: 750;
		color: #62625c;
	}
	h1 { margin: 0; font-size: 2rem; }
	.lede, .support-copy { color: #5c5c56; line-height: 1.6; }
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
		border: 1px solid #111;
		border-radius: 0.55rem;
		padding: 0.8rem 1rem;
		background: #111;
		color: white;
		cursor: pointer;
	}
	button:disabled { opacity: 0.55; cursor: wait; }
	.error { color: #9b1c1c; margin: 0; }
	.notice { margin: 1.25rem 0; padding: 1rem; border-radius: 0.6rem; line-height: 1.55; }
	.notice.success { background: #e8f6eb; }
	a { color: inherit; font-weight: 700; }
</style>
