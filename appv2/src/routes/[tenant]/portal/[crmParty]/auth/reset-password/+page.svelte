<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth/auth-client';
	import { routes } from '$lib/routing/route-contract';

	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');
	const tenant = $derived(page.params.tenant ?? '');
	const crmParty = $derived(page.params.crmParty ?? '');
	const token = $derived(page.url.searchParams.get('token') ?? '');
	const invalidToken = $derived(page.url.searchParams.get('error') === 'INVALID_TOKEN' || !token);
	const forgotHref = $derived(routes.portalForgotPassword(tenant, crmParty));

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
				errorMessage = 'This reset link is invalid or has expired.';
				return;
			}
			await goto(resolve(routes.portalSignIn(tenant, crmParty)), {
				replaceState: true,
				invalidateAll: true
			});
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head><title>Choose a new password · NuBlox Portal</title></svelte:head>
<main class="recovery-shell">
	<section class="recovery-card">
		<a class="brand" href={resolve(routes.start)}>NuBlox Portal</a>
		<p class="nb-eyebrow">Account recovery</p>
		<h1>Choose a new password</h1>
		{#if invalidToken}<div class="notice" role="alert"><p>This reset link cannot be used.</p></div>
			<p><a href={resolve(forgotHref)}>Request a new reset link</a></p>
		{:else}<form onsubmit={resetPassword}>
				<label
					><span>New password</span><input
						bind:value={password}
						type="password"
						minlength="12"
						maxlength="128"
						required
					/></label
				><label
					><span>Confirm new password</span><input
						bind:value={confirmPassword}
						type="password"
						minlength="12"
						maxlength="128"
						required
					/></label
				>{#if errorMessage}<p class="form-error" role="alert">{errorMessage}</p>{/if}<button
					type="submit"
					disabled={submitting}>{submitting ? 'Updating…' : 'Update password'}</button
				>
			</form>{/if}
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
		padding: 46px;
		background: var(--nb-surface);
	}
	.brand {
		display: inline-block;
		margin-bottom: 56px;
		font-weight: 850;
		text-decoration: none;
	}
	h1 {
		font-size: clamp(2.25rem, 6vw, 3.5rem);
		letter-spacing: -0.055em;
	}
	form,
	label {
		display: grid;
		gap: 14px;
	}
	form {
		margin-top: 28px;
	}
	input {
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 12px;
		font: inherit;
	}
	button {
		border: 0;
		border-radius: 10px;
		padding: 12px;
		background: var(--nb-ink);
		color: white;
		font: inherit;
		font-weight: 780;
	}
	.form-error {
		color: #b42318;
	}
</style>
