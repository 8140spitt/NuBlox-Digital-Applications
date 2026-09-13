<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth/auth-client';
	import { routes } from '$lib/routing/route-contract';

	let { data, params } = $props();
	let displayName = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');

	const invitationPath = $derived(routes.appInvite(data.tenant, params.token));
	const invitationSignIn = $derived(routes.appSignIn(data.tenant, invitationPath));

	async function createAccount(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		if (!data.invitation) return;

		if (password !== confirmPassword) {
			errorMessage = 'The passwords do not match.';
			return;
		}
		if (password.length < 12) {
			errorMessage = 'Your password must be at least 12 characters.';
			return;
		}

		submitting = true;
		try {
			const callback = new URL(invitationPath, window.location.origin);
			callback.searchParams.set('verified', '1');
			const result = await authClient.signUp.email({
				name: displayName.trim(),
				email: data.invitation.email,
				password,
				callbackURL: callback.toString()
			});

			if (result.error) {
				errorMessage =
					result.error.message ||
					'An account could not be created. If you already use NuBlox, sign in instead.';
				return;
			}

			await goto(`${data.verifyEmailHref}?email=${encodeURIComponent(data.invitation.email)}`, {
				replaceState: true,
				invalidateAll: true
			});
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Organisation invitation · NuBlox</title>
	<meta name="description" content="Accept a tenant-specific invitation to NuBlox." />
</svelte:head>

<main class="invite-shell">
	<section class="invite-card">
		<a class="brand" href={routes.start}>NuBlox</a>

		{#if data.verified}
			<p class="nb-eyebrow">Invitation verified</p>
			<h1>Your email is verified.</h1>
			<p class="lede">Continue through the tenant-specific sign-in boundary to complete access.</p>
			<a class="primary-action" href={data.signInHref}>Continue to sign in</a>
		{:else if data.invitation}
			<p class="nb-eyebrow">Organisation invitation</p>
			<h1>Join {data.invitation.organisationName}</h1>
			<p class="lede">
				This invitation is for <strong>{data.invitation.email}</strong>. Roles and permissions are
				controlled by the inviting tenant.
			</p>

			{#if data.user}
				{#if data.canAccept}
					<div class="identity-card">
						<span>Signed in as</span>
						<strong>{data.user.name}</strong>
						<small>{data.user.email}</small>
					</div>
					<form method="POST" action="?/accept">
						<button class="primary-action" type="submit">Accept invitation</button>
					</form>
				{:else}
					<div class="notice" role="alert">
						This invitation belongs to {data.invitation.email}, but you are signed in as
						{data.user.email}.
					</div>
					<a class="secondary-link" href={data.signInHref}>Use the invited account</a>
				{/if}
			{:else}
				<div class="existing-account">
					<strong>Already use NuBlox?</strong>
					<a href={invitationSignIn}>Sign in to accept</a>
				</div>

				<div class="divider"><span>or create your NuBlox identity</span></div>

				<form class="signup-form" onsubmit={createAccount}>
					<label>
						<span>Full name</span>
						<input bind:value={displayName} autocomplete="name" maxlength="255" required />
					</label>
					<label>
						<span>Email address</span>
						<input value={data.invitation.email} type="email" disabled />
					</label>
					<label>
						<span>Password</span>
						<input bind:value={password} type="password" autocomplete="new-password" minlength="12" maxlength="128" required />
					</label>
					<label>
						<span>Confirm password</span>
						<input bind:value={confirmPassword} type="password" autocomplete="new-password" minlength="12" maxlength="128" required />
					</label>

					{#if errorMessage}
						<p class="form-error" role="alert">{errorMessage}</p>
					{/if}

					<button class="primary-action" type="submit" disabled={submitting}>
						{submitting ? 'Creating account…' : 'Create account and continue'}
					</button>
				</form>
			{/if}
		{/if}
	</section>
</main>

<style>
	.invite-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 28px;
		background: var(--nb-surface-subtle);
	}
	.invite-card {
		width: min(100%, 590px);
		border: 1px solid var(--nb-border);
		border-radius: 16px;
		padding: clamp(30px, 6vw, 52px);
		background: var(--nb-surface);
		box-shadow: 0 20px 60px rgb(24 33 47 / 0.08);
	}
	.brand {
		display: inline-block;
		margin-bottom: 60px;
		font-weight: 850;
		letter-spacing: -0.03em;
		text-decoration: none;
	}
	h1 {
		margin: 0;
		font-size: clamp(2.5rem, 7vw, 4rem);
		line-height: 0.98;
		letter-spacing: -0.06em;
	}
	.lede {
		margin: 22px 0 0;
		color: var(--nb-muted);
		line-height: 1.7;
	}
	.identity-card,
	.notice,
	.existing-account {
		margin-top: 28px;
		border: 1px solid var(--nb-border);
		border-radius: 12px;
		padding: 18px;
		background: var(--nb-surface-subtle);
	}
	.identity-card {
		display: grid;
		gap: 4px;
	}
	.identity-card span,
	.identity-card small,
	.notice {
		color: var(--nb-muted);
	}
	.existing-account {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 30px 0;
		color: var(--nb-muted);
		font-size: 0.75rem;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--nb-border);
	}
	.signup-form {
		display: grid;
		gap: 15px;
	}
	label {
		display: grid;
		gap: 7px;
		font-size: 0.82rem;
		font-weight: 700;
	}
	input {
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 12px 13px;
		font: inherit;
	}
	.primary-action,
	.secondary-link {
		display: inline-flex;
		margin-top: 24px;
		border-radius: 10px;
		padding: 11px 14px;
		font-weight: 740;
		text-decoration: none;
	}
	.primary-action {
		border: 0;
		background: var(--nb-ink);
		color: white;
		font: inherit;
		cursor: pointer;
	}
	.form-error {
		margin: 0;
		color: #b42318;
		font-size: 0.8rem;
	}
</style>
