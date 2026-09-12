<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth/auth-client';

	let { data, params } = $props();
	let displayName = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');

	const invitationPath = $derived(`/auth/invite/${encodeURIComponent(params.token)}` as const);

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
			const callback = new URL(resolve(invitationPath), window.location.origin);
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

			const next = new URL(resolve('/auth/verify-email'), window.location.origin);
			next.searchParams.set('email', data.invitation.email);
			await goto(next, { replaceState: true, invalidateAll: true });
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Organisation invitation · NuBlox</title>
	<meta name="description" content="Accept a secure invitation to join a NuBlox organisation." />
</svelte:head>

<main class="invite-shell">
	<section class="invite-card">
		<a class="brand" href={resolve('/auth/start')}>NuBlox</a>

		{#if data.verified}
			<p class="nb-eyebrow">Invitation accepted</p>
			<h1>Your email is verified.</h1>
			<p class="lede">
				Your organisation invitation has been activated. Sign in to continue into the NuBlox
				access available to you.
			</p>
			<a class="primary-action" href={resolve('/auth')}>Continue to sign in</a>
		{:else if data.invitation}
			<p class="nb-eyebrow">Organisation invitation</p>
			<h1>Join {data.invitation.organisationName}</h1>
			<p class="lede">
				This invitation is for <strong>{data.invitation.email}</strong>. Your organisation roles and
				permissions are assigned by the inviting NuBlox tenant.
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
						{data.user.email}. Sign out and use the invited identity.
					</div>
					<a class="secondary-link" href={resolve('/auth')}>Manage signed-in account</a>
				{/if}
			{:else}
				<div class="existing-account">
					<strong>Already use NuBlox?</strong>
					<a
						href={resolve(
							(`/auth?returnTo=${encodeURIComponent(invitationPath)}` as `/auth?${string}`)
						)}>Sign in to accept</a
					>
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
						<span>Confirm password</span>
						<input
							bind:value={confirmPassword}
							type="password"
							autocomplete="new-password"
							minlength="12"
							maxlength="128"
							required
						/>
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

	.existing-account a,
	.secondary-link {
		font-weight: 750;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 30px 0;
		color: var(--nb-muted);
		font-size: 0.76rem;
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
		gap: 17px;
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

	input:disabled {
		background: var(--nb-surface-subtle);
		color: var(--nb-muted);
	}

	.primary-action {
		display: inline-flex;
		min-height: 45px;
		align-items: center;
		justify-content: center;
		margin-top: 24px;
		border: 0;
		border-radius: 10px;
		padding: 11px 15px;
		background: var(--nb-ink);
		color: white;
		font: inherit;
		font-weight: 780;
		text-decoration: none;
	}

	.signup-form .primary-action {
		margin-top: 3px;
	}

	.primary-action:disabled {
		cursor: progress;
		opacity: 0.6;
	}

	.form-error {
		margin: 0;
		border-left: 3px solid var(--nb-accent);
		padding: 9px 12px;
		background: var(--nb-surface-subtle);
		font-size: 0.84rem;
		line-height: 1.5;
	}

	.secondary-link {
		display: inline-block;
		margin-top: 20px;
	}
</style>
