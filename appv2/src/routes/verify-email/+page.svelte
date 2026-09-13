<script lang="ts">
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth/auth-client';
	import { routes } from '$lib/routing/route-contract';

	let { data } = $props();
	let sending = $state(false);
	let sent = $state(false);
	let errorMessage = $state('');

	const email = $derived(page.url.searchParams.get('email')?.trim() ?? '');
	const verified = $derived(page.url.searchParams.get('verified') === '1');
	const verificationError = $derived(page.url.searchParams.get('error') ?? '');

	async function resendVerification() {
		if (!email) return;
		errorMessage = '';
		sending = true;

		try {
			const callback = new URL(routes.verifyEmail, window.location.origin);
			callback.searchParams.set('verified', '1');
			const result = await authClient.sendVerificationEmail({
				email,
				callbackURL: callback.toString()
			});
			if (result.error) {
				errorMessage = 'A new verification email could not be sent. Try again.';
				return;
			}
			sent = true;
		} finally {
			sending = false;
		}
	}
</script>

<svelte:head>
	<title>Verify your email · NuBlox</title>
	<meta name="description" content="Verify the email address attached to your NuBlox identity." />
</svelte:head>

<main class="verification-shell">
	<section class="verification-card">
		<a class="brand" href={resolve(routes.start)}>NuBlox</a>
		<p class="nb-eyebrow">Identity verification</p>

		{#if verified}
			<h1>Email verified</h1>
			<p class="lede">
				Your identity is verified and the new organisation can now be activated for tenant-scoped
				access.
			</p>
			{#if data.continueHref}
				<a class="primary-action" href={resolve(data.continueHref)}>Continue to your organisation</a
				>
			{:else}
				<p class="guidance">
					Open your organisation-specific NuBlox address to sign in. Tenant access is never selected
					from a global sign-in page.
				</p>
			{/if}
		{:else if verificationError}
			<h1>Verification link expired</h1>
			<p class="lede">
				This verification link is invalid or has expired. Request another link using the email
				address you registered with.
			</p>
			{#if email}
				<button type="button" onclick={resendVerification} disabled={sending}>
					{sending ? 'Sending…' : 'Send a new verification link'}
				</button>
			{/if}
		{:else}
			<h1>Check your email</h1>
			<p class="lede">
				We sent a one-hour verification link{email ? ` to ${email}` : ''}. Open it to activate your
				NuBlox identity and organisation.
			</p>
			{#if email}
				<button type="button" onclick={resendVerification} disabled={sending}>
					{sending ? 'Sending…' : 'Resend verification email'}
				</button>
			{/if}
		{/if}

		{#if sent}
			<p class="status" role="status">A new verification email has been requested.</p>
		{/if}
		{#if errorMessage}
			<p class="form-error" role="alert">{errorMessage}</p>
		{/if}
	</section>
</main>

<style>
	.verification-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 28px;
		background: var(--nb-ink);
	}
	.verification-card {
		width: min(100%, 600px);
		border-radius: 16px;
		padding: clamp(30px, 6vw, 52px);
		background: var(--nb-surface);
	}
	.brand {
		display: inline-block;
		margin-bottom: 64px;
		font-weight: 850;
		letter-spacing: -0.03em;
		text-decoration: none;
	}
	h1 {
		margin: 0;
		font-size: clamp(2.5rem, 7vw, 4rem);
		letter-spacing: -0.055em;
	}
	.lede,
	.guidance {
		margin: 18px 0 0;
		color: var(--nb-muted);
		line-height: 1.7;
	}
	.primary-action,
	button {
		display: inline-flex;
		margin-top: 28px;
		border: 0;
		border-radius: 10px;
		padding: 12px 15px;
		background: var(--nb-ink);
		color: white;
		font: inherit;
		font-weight: 750;
		text-decoration: none;
		cursor: pointer;
	}
	.status,
	.form-error {
		margin: 22px 0 0;
		font-size: 0.82rem;
	}
	.form-error {
		color: #b42318;
	}
</style>
