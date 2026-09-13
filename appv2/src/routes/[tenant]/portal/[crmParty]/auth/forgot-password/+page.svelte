<script lang="ts">
	import { page } from '$app/state';
	import { authClient } from '$lib/auth/auth-client';
	import { routes } from '$lib/routing/route-contract';

	let email = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let errorMessage = $state('');
	const tenant = $derived(page.params.tenant);
	const crmParty = $derived(page.params.crmParty);
	const signInHref = $derived(routes.portalSignIn(tenant, crmParty));

	async function requestReset(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		submitting = true;
		try {
			const resetUrl = new URL(routes.portalResetPassword(tenant, crmParty), window.location.origin);
			const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: resetUrl.toString() });
			if (result.error) { errorMessage = 'Password recovery could not be started. Try again.'; return; }
			submitted = true;
		} finally { submitting = false; }
	}
</script>

<svelte:head><title>Forgot password · NuBlox Portal</title></svelte:head>
<main class="recovery-shell"><section class="recovery-card">
	<a class="brand" href={routes.start}>NuBlox Portal</a><p class="nb-eyebrow">Account recovery</p><h1>Reset your password</h1>
	{#if submitted}<div class="notice" role="status"><h2>Check your email</h2><p>If an account exists for <strong>{email}</strong>, a time-limited reset link has been sent.</p></div>
	{:else}<p class="lede">Enter the email address you use for this connected portal.</p><form onsubmit={requestReset}><label><span>Email address</span><input bind:value={email} type="email" autocomplete="email" required /></label>{#if errorMessage}<p class="form-error" role="alert">{errorMessage}</p>{/if}<button type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</button></form>{/if}
	<p class="footer-copy"><a href={signInHref}>Back to sign in</a></p>
</section></main>
<style>.recovery-shell{min-height:100vh;display:grid;place-items:center;padding:28px;background:var(--nb-surface-subtle)}.recovery-card{width:min(100%,500px);border:1px solid var(--nb-border);border-radius:16px;padding:46px;background:var(--nb-surface)}.brand{display:inline-block;margin-bottom:56px;font-weight:850;text-decoration:none}h1{font-size:clamp(2.25rem,6vw,3.5rem);letter-spacing:-.055em}.lede,.footer-copy,.notice p{color:var(--nb-muted);line-height:1.65}form,label{display:grid;gap:14px}form{margin-top:28px}input{border:1px solid var(--nb-border);border-radius:10px;padding:12px;font:inherit}button{border:0;border-radius:10px;padding:12px;background:var(--nb-ink);color:white;font:inherit;font-weight:780}.form-error{color:#b42318}</style>
