<script lang="ts">
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth/auth-client';

	let email = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let errorMessage = $state('');

	async function requestReset(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		submitting = true;

		try {
			const resetUrl = new URL(resolve('/auth/reset-password'), window.location.origin);
			const result = await authClient.requestPasswordReset({
				email: email.trim(),
				redirectTo: resetUrl.toString()
			});

			if (result.error) {
				errorMessage = 'Password recovery could not be started. Try again.';
				return;
			}

			submitted = true;
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Forgot password · NuBlox</title>
	<meta name="description" content="Request a secure NuBlox password-reset link." />
</svelte:head>

<main class="recovery-shell">
	<section class="recovery-card">
		<a class="brand" href={resolve('/auth/start')}>NuBlox</a>
		<p class="nb-eyebrow">Account recovery</p>
		<h1>Reset your password</h1>

		{#if submitted}
			<div class="notice" role="status">
				<h2>Check your email</h2>
				<p>
					If a NuBlox account exists for <strong>{email}</strong>, we have sent a time-limited
					password-reset link.
				</p>
			</div>
		{:else}
			<p class="lede">
				Enter the email address you use for NuBlox. The recovery link expires after one hour.
			</p>

			<form onsubmit={requestReset}>
				<label>
					<span>Email address</span>
					<input bind:value={email} type="email" autocomplete="email" maxlength="320" required />
				</label>

				{#if errorMessage}
					<p class="form-error" role="alert">{errorMessage}</p>
				{/if}

				<button type="submit" disabled={submitting}>
					{submitting ? 'Sending reset link…' : 'Send reset link'}
				</button>
			</form>
		{/if}

		<p class="footer-copy"><a href={resolve('/auth')}>Back to sign in</a></p>
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
		line-height: 1;
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
		background: var(--nb-surface);
		color: var(--nb-ink);
	}

	button {
		min-height: 45px;
		border: 0;
		border-radius: 10px;
		background: var(--nb-ink);
		color: white;
		font-weight: 780;
	}

	button:disabled {
		cursor: progress;
		opacity: 0.6;
	}

	.form-error {
		margin: 0;
		border-left: 3px solid var(--nb-accent);
		padding: 9px 12px;
		background: var(--nb-surface-subtle);
		font-size: 0.84rem;
	}

	.notice {
		margin-top: 26px;
		border: 1px solid var(--nb-border);
		border-radius: 12px;
		padding: 20px;
		background: var(--nb-surface-subtle);
	}

	.notice h2 {
		margin: 0 0 8px;
		font-size: 1.2rem;
	}

	.notice p,
	.footer-copy {
		margin-bottom: 0;
	}

	.footer-copy {
		margin-top: 24px;
		font-size: 0.84rem;
	}

	.footer-copy a {
		font-weight: 750;
	}
</style>
