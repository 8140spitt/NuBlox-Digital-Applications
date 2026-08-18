<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';

	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let message = $state('');

	let token = $derived(page.url.searchParams.get('token') ?? '');
	let invalidToken = $derived(page.url.searchParams.get('error') === 'INVALID_TOKEN' || !token);

	async function resetPassword(event: SubmitEvent) {
		event.preventDefault();
		message = '';

		if (password !== confirmPassword) {
			message = 'The passwords do not match.';
			return;
		}
		if (password.length < 12) {
			message = 'Your new password must be at least 12 characters.';
			return;
		}

		submitting = true;
		const result = await authClient.resetPassword({
			newPassword: password,
			token
		});
		submitting = false;

		if (result.error) {
			message = 'This password-reset link is invalid or has expired. Request a new reset link.';
			return;
		}

		await goto('/signin?reset=1', { replaceState: true, invalidateAll: true });
	}
</script>

<svelte:head>
	<title>Choose a new password · NuBlox</title>
</svelte:head>

<main class="auth-shell">
	<section class="auth-card">
		<p class="brand">NuBlox</p>
		<p class="eyebrow">Account recovery</p>
		<h1>Choose a new password</h1>

		{#if invalidToken}
			<div class="notice error-notice" role="alert">
				This password-reset link is invalid or has expired.
			</div>
			<p class="support-copy">
				<a href="/forgot-password">Request a new reset link</a>
			</p>
		{:else}
			<p class="lede">
				Enter a new password of at least 12 characters. Completing the reset signs out existing
				NuBlox sessions for this account.
			</p>

			<form class="stack" onsubmit={resetPassword}>
				<label>
					<span>New password</span>
					<input
						bind:value={password}
						type="password"
						autocomplete="new-password"
						minlength="12"
						maxlength="128"
						required
					/>
				</label>
				<label>
					<span>Confirm new password</span>
					<input
						bind:value={confirmPassword}
						type="password"
						autocomplete="new-password"
						minlength="12"
						maxlength="128"
						required
					/>
				</label>
				{#if message}<p class="error" role="alert">{message}</p>{/if}
				<button type="submit" disabled={submitting}>
					{submitting ? 'Updating password…' : 'Update password'}
				</button>
			</form>
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
	.brand {
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 0 0 2rem;
	}
	.eyebrow {
		margin: 0 0 0.45rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.75rem;
		font-weight: 750;
		color: #62625c;
	}
	h1 {
		margin: 0;
		font-size: 2rem;
	}
	.lede,
	.support-copy {
		color: #5c5c56;
		line-height: 1.6;
	}
	.stack {
		display: grid;
		gap: 1rem;
		margin-top: 1.5rem;
	}
	label {
		display: grid;
		gap: 0.4rem;
		font-weight: 600;
	}
	input {
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.55rem;
		padding: 0.75rem 0.85rem;
	}
	input:focus {
		outline: 2px solid #222;
		outline-offset: 2px;
	}
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
	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	.error {
		color: #9b1c1c;
		margin: 0;
	}
	.notice {
		margin: 1.25rem 0;
		padding: 1rem;
		border-radius: 0.6rem;
		line-height: 1.55;
	}
	.error-notice {
		background: #fdecec;
		color: #7f1d1d;
	}
	a {
		color: inherit;
		font-weight: 700;
	}
</style>
