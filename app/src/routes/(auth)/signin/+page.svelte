<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let { data } = $props();
	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let message = $state('');

	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;

		submitting = true;
		message = '';

		try {
			const result = await authClient.signIn.email({
				email: email.trim(),
				password,
				rememberMe: true
			});

			if (result.error) {
				message =
					result.error.status === 403
						? 'Verify your email address before signing in.'
						: result.error.message ?? 'Sign-in failed.';
				return;
			}

			// Confirm that the Set-Cookie from Better Auth is usable before entering
			// the authenticated SvelteKit route tree. This turns cookie/origin issues
			// into a visible error instead of an apparent no-op/redirect loop.
			const sessionResult = await authClient.getSession();
			if (sessionResult.error || !sessionResult.data) {
				message =
					'Sign-in was accepted, but the browser session could not be established. Make sure you are using the same origin configured by BETTER_AUTH_URL, then try again.';
				return;
			}

			// Use a full navigation so the next server request definitely carries the
			// newly issued authentication cookie when SvelteKit resolves locals.actor.
			window.location.assign(data.returnTo ?? '/select-organisation');
		} catch (cause) {
			console.error('[NuBlox auth] Sign-in failed.', cause);
			message = cause instanceof Error ? cause.message : 'Sign-in failed. Please try again.';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in · NuBlox</title>
</svelte:head>

<main class="auth-shell">
	<section class="auth-card">
		<p class="brand">NuBlox</p>
		<h1>Sign in</h1>
		<p class="lede">Access your organisation and built-environment workspace.</p>

		{#if data.verified}
			<p class="notice success">Email verified. You can now sign in.</p>
		{/if}
		{#if data.passwordReset}
			<p class="notice success">Password updated. Sign in with your new password.</p>
		{/if}

		<form class="stack" onsubmit={signIn}>
			<label>
				<span>Email</span>
				<input bind:value={email} type="email" autocomplete="email" required maxlength="320" />
			</label>
			<label>
				<span>Password</span>
				<input
					bind:value={password}
					type="password"
					autocomplete="current-password"
					required
					maxlength="128"
				/>
			</label>
			<p class="recovery-link"><a href="/forgot-password">Forgot your password?</a></p>
			{#if message}<p class="error" role="alert">{message}</p>{/if}
			<button type="submit" disabled={submitting}>
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>

		<p class="support-copy">
			New to NuBlox? <a href="/start">Create your account and organisation</a>. Invited users can
			also create an account from their organisation invitation.
		</p>
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
	.recovery-link { margin: -0.25rem 0 0; text-align: right; font-size: 0.92rem; }
	.error { color: #9b1c1c; margin: 0; }
	.notice { padding: 0.8rem; border-radius: 0.55rem; }
	.notice.success { background: #e8f6eb; }
	a { color: inherit; font-weight: 700; }
</style>
