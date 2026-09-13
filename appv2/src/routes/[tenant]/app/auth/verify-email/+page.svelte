<script lang="ts">
	import { page } from '$app/state';
	import { authClient } from '$lib/auth/auth-client';
	import { routes } from '$lib/routing/route-contract';

	let sending = $state(false);
	let sent = $state(false);
	let errorMessage = $state('');

	const tenant = $derived(page.params.tenant);
	const email = $derived(page.url.searchParams.get('email')?.trim() ?? '');
	const verified = $derived(page.url.searchParams.get('verified') === '1');
	const verificationError = $derived(page.url.searchParams.get('error') ?? '');
	const signInHref = $derived(routes.appSignIn(tenant));

	async function resendVerification() {
		if (!email) return;
		errorMessage = '';
		sending = true;
		try {
			const callback = new URL(routes.appVerifyEmail(tenant), window.location.origin);
			callback.searchParams.set('verified', '1');
			const result = await authClient.sendVerificationEmail({ email, callbackURL: callback.toString() });
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

<svelte:head><title>Verify your email · NuBlox</title></svelte:head>

<main class="verification-shell">
	<section class="verification-card">
		<a class="brand" href={routes.start}>NuBlox</a>
		<p class="nb-eyebrow">Identity verification</p>
		{#if verified}
			<h1>Email verified</h1>
			<p class="lede">Your NuBlox identity is verified for this tenant journey.</p>
			<a class="primary-action" href={signInHref}>Continue to sign in</a>
		{:else if verificationError}
			<h1>Verification link expired</h1>
			<p class="lede">This link is invalid or has expired. Request another verification link.</p>
			{#if email}<button type="button" onclick={resendVerification} disabled={sending}>{sending ? 'Sending…' : 'Send a new verification link'}</button>{/if}
		{:else}
			<h1>Check your email</h1>
			<p class="lede">We sent a one-hour verification link{email ? ` to ${email}` : ''}.</p>
			{#if email}<button type="button" onclick={resendVerification} disabled={sending}>{sending ? 'Sending…' : 'Resend verification email'}</button>{/if}
		{/if}
		{#if sent}<p class="status" role="status">A new verification email has been requested.</p>{/if}
		{#if errorMessage}<p class="form-error" role="alert">{errorMessage}</p>{/if}
	</section>
</main>

<style>
	.verification-shell{min-height:100vh;display:grid;place-items:center;padding:28px;background:var(--nb-ink)}
	.verification-card{width:min(100%,560px);border-radius:16px;padding:clamp(30px,6vw,52px);background:var(--nb-surface)}
	.brand{display:inline-block;margin-bottom:64px;font-weight:850;letter-spacing:-.03em;text-decoration:none} h1{margin:0;font-size:clamp(2.5rem,7vw,4rem);letter-spacing:-.06em}.lede{margin:22px 0 0;color:var(--nb-muted);line-height:1.7}
	.primary-action,button{display:inline-flex;align-items:center;justify-content:center;margin-top:30px;border:0;border-radius:10px;padding:11px 15px;background:var(--nb-ink);color:white;font:inherit;font-weight:780;text-decoration:none;cursor:pointer}.status,.form-error{margin:20px 0 0;font-size:.84rem}.form-error{color:#b42318}
</style>
