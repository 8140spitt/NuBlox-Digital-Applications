<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';
	import { authClient } from '$lib/auth/auth-client';
	import NuBloxLogo from '$lib/components/brand/NuBloxLogo.svelte';

	let {
		contextLabel,
		contextName,
		destination,
		forgotPasswordHref,
		startHref
	}: {
		contextLabel: string;
		contextName: string;
		destination: string;
		forgotPasswordHref: string;
		startHref: string;
	} = $props();

	let email = $state('');
	let password = $state('');
	let rememberMe = $state(true);
	let submitting = $state(false);
	let errorMessage = $state('');

	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		submitting = true;

		try {
			const result = await authClient.signIn.email({
				email: email.trim(),
				password,
				rememberMe
			});

			if (result.error) {
				errorMessage = result.error.message || 'Unable to sign in with those credentials.';
				return;
			}

			await invalidateAll();
			await goto(resolve(destination));
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in · NuBlox</title>
	<meta name="description" content="Secure sign in to your NuBlox workspace." />
</svelte:head>

<main class="auth-shell">
	<section class="auth-context">
		<a class="brand" href={resolve(startHref)} aria-label="NuBlox start">
			<span class="brand-lockup"><NuBloxLogo alt="NuBlox — Construction & Built Environment" /></span>
		</a>

		<div class="context-copy">
			<p class="nb-eyebrow">{contextLabel}</p>
			<h1>{contextName}</h1>
			<p>
				Sign in with your NuBlox identity. Access is granted only after your relationship to this
				workspace has been verified.
			</p>
		</div>

		<p class="boundary-note">Identity → relationship → permission</p>
	</section>

	<section class="auth-panel">
		<div class="panel-inner">
			<header>
				<p class="nb-eyebrow">Secure access</p>
				<h2>Sign in</h2>
				<p>Use your existing NuBlox account.</p>
			</header>

			<form onsubmit={signIn}>
				<label>
					<span>Email address</span>
					<input bind:value={email} type="email" name="email" autocomplete="email" required />
				</label>

				<label>
					<span class="password-label">
						Password
						<a href={resolve(forgotPasswordHref)}>Forgot password?</a>
					</span>
					<input
						bind:value={password}
						type="password"
						name="password"
						autocomplete="current-password"
						required
					/>
				</label>

				<label class="remember-row">
					<input bind:checked={rememberMe} type="checkbox" />
					<span>Keep me signed in</span>
				</label>

				{#if errorMessage}
					<p class="form-error" role="alert">{errorMessage}</p>
				{/if}

				<button class="primary-action" type="submit" disabled={submitting}>
					{submitting ? 'Signing in…' : 'Sign in'}
				</button>
			</form>
		</div>
	</section>
</main>

<style>
	.auth-shell {
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(420px, 1.1fr);
		background: var(--nb-ink);
	}
	.auth-context {
		display: flex;
		min-height: 100vh;
		flex-direction: column;
		justify-content: space-between;
		padding: clamp(32px, 6vw, 72px);
		color: white;
	}
	.brand {
		display: inline-block;
		align-self: flex-start;
		text-decoration: none;
	}
	.brand-lockup {
		display: block;
		width: clamp(172px, 18vw, 220px);
	}
	.context-copy {
		max-width: 620px;
	}
	.context-copy h1 {
		margin: 10px 0 20px;
		font-size: clamp(3rem, 7vw, 6.5rem);
		line-height: 0.9;
		letter-spacing: -0.065em;
	}
	.context-copy p:last-child {
		max-width: 540px;
		color: #d0d5dd;
		line-height: 1.7;
	}
	.boundary-note {
		margin: 0;
		color: #98a2b3;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.auth-panel {
		display: grid;
		place-items: center;
		padding: clamp(28px, 6vw, 72px);
		background: var(--nb-surface);
	}
	.panel-inner {
		width: min(100%, 480px);
	}
	header h2 {
		margin: 8px 0 8px;
		font-size: clamp(2.4rem, 5vw, 4rem);
		letter-spacing: -0.055em;
	}
	header > p:last-child {
		margin: 0;
		color: var(--nb-muted);
	}
	form {
		display: grid;
		gap: 18px;
		margin-top: 34px;
	}
	label:not(.remember-row) {
		display: grid;
		gap: 8px;
		font-size: 0.82rem;
		font-weight: 720;
	}
	input[type='email'],
	input[type='password'] {
		width: 100%;
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 13px 14px;
		background: var(--nb-surface);
		color: var(--nb-ink);
		font: inherit;
	}
	.password-label,
	.remember-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.password-label a {
		font-size: 0.76rem;
		font-weight: 650;
	}
	.remember-row {
		justify-content: flex-start;
		color: var(--nb-muted);
		font-size: 0.8rem;
	}
	.primary-action {
		border: 0;
		border-radius: 10px;
		padding: 13px 16px;
		background: var(--nb-ink);
		color: white;
		font: inherit;
		font-weight: 760;
		cursor: pointer;
	}
	.primary-action:disabled {
		cursor: wait;
		opacity: 0.65;
	}
	.form-error {
		margin: 0;
		border-radius: 9px;
		padding: 11px 12px;
		background: #fff1f0;
		color: #b42318;
		font-size: 0.8rem;
	}
	@media (max-width: 820px) {
		.auth-shell {
			grid-template-columns: 1fr;
		}
		.auth-context {
			min-height: auto;
			gap: 70px;
		}
		.auth-panel {
			min-height: 56vh;
		}
	}
</style>
