<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth/auth-client';
	import { routes } from '$lib/routing/route-contract';

	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');

	const tenant = $derived(page.params.tenant);
	const token = $derived(page.url.searchParams.get('token') ?? '');
	const invalidToken = $derived(page.url.searchParams.get('error') === 'INVALID_TOKEN' || !token);
	const forgotPasswordHref = $derived(routes.appForgotPassword(tenant));

	async function resetPassword(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		if (password !== confirmPassword) {
			errorMessage = 'The passwords do not match.';
			return;
		}
		if (password.length < 12) {
			errorMessage = 'Your new password must be at least 12 characters.';
			return;
		}

		submitting = true;
		try {
			const result = await authClient.resetPassword({ newPassword: password, token });
			if (result.error) {
				errorMessage = 'This reset link is invalid or has expired. Request a new one.';
				return;
			}
			await goto(resolve(routes.appSignIn(tenant)), { replaceState: true, invalidateAll: true });
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head><title>Choose a new password · NuBlox</title></svelte:head>

<main class="recovery-shell">
	<section class="recovery-card">
		<a class="brand" href={resolve(routes.start)}>NuBlox</a>
		<p class="nb-eyebrow">Account recovery</p>
		<h1>Choose a new password</h1>
		{#if invalidToken}
			<div class="notice" role="alert">
				<h2>This link cannot be used</h2>
				<p>Password-reset links expire after one hour and can only be used once.</p>
			</div>
			<p class="footer-copy"><a href={resolve(forgotPasswordHref)}>Request a new reset link</a></p>
		{:else}
			<p class="lede">
				Use at least 12 characters. Completing this reset revokes existing sessions.
			</p>
			<form onsubmit={resetPassword}>
				<label
					><span>New password</span><input
						bind:value={password}
						type="password"
						autocomplete="new-password"
						minlength="12"
						maxlength="128"
						required
					/></label
				>
				<label
					><span>Confirm new password</span><input
						bind:value={confirmPassword}
						type="password"
						autocomplete="new-password"
						minlength="12"
						maxlength="128"
						required
					/></label
				>
				{#if errorMessage}<p class="form-error" role="alert">{errorMessage}</p>{/if}
				<button type="submit" disabled={submitting}
					>{submitting ? 'Updating…' : 'Update password'}</button
				>
			</form>
		{/if}
	</section>
</main>

<style>
	.recovery-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 28px;
		background: var(--nb-surface-subtle);
	}
	.recovery-card {
		width: min(100%, 500px);
		border: 1px solid var(--nb-border);
		border-radius: 16px;
		padding: clamp(28px, 5vw, 46px);
		background: var(--nb-surface);
		box-shadow: 0 20px 60px rgb(24 33 47 / 0.08);
	}
	.brand {
		display: inline-block;
		margin-bottom: 56px;
		font-weight: 850;
		letter-spacing: -0.03em;
		text-decoration: none;
	}
	h1 {
		margin: 0;
		font-size: clamp(2.25rem, 6vw, 3.5rem);
		letter-spacing: -0.055em;
	}
	.lede,
	.footer-copy,
	.notice p {
		color: var(--nb-muted);
		line-height: 1.65;
	}
	form {
		display: grid;
		gap: 18px;
		margin-top: 28px;
	}
	label {
		display: grid;
		gap: 7px;
	}
	label span {
		font-size: 0.8rem;
		font-weight: 750;
	}
	input {
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 12px 13px;
		font: inherit;
	}
	button {
		min-height: 45px;
		border: 0;
		border-radius: 10px;
		background: var(--nb-ink);
		color: white;
		font: inherit;
		font-weight: 780;
		cursor: pointer;
	}
	.form-error {
		margin: 0;
		color: #b42318;
	}
</style>
