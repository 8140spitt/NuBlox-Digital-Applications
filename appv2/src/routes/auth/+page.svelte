<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth/auth-client';

	let { data } = $props();
	let email = $state('');
	let password = $state('');
	let rememberMe = $state(true);
	let submitting = $state(false);
	let errorMessage = $state('');

	const destination = $derived(data.returnTo ?? '/');

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
			await goto(destination);
		} finally {
			submitting = false;
		}
	}

	async function signOut() {
		await authClient.signOut();
		await invalidateAll();
		await goto(resolve('/auth'));
	}
</script>

<svelte:head>
	<title>Sign in · NuBlox</title>
	<meta
		name="description"
		content="Secure sign in to the NuBlox construction and built-environment operating system."
	/>
</svelte:head>

<section class="auth-shell">
	<div class="auth-story">
		<a class="brand" href={resolve('/')} aria-label="NuBlox home">
			<span class="brand-mark" aria-hidden="true">N</span>
			<span>NuBlox</span>
		</a>

		<div class="story-copy">
			<p class="nb-eyebrow">One identity boundary</p>
			<h1>Access the work you are authorised to see.</h1>
			<p>
				NuBlox uses one account boundary for internal operating-system access and CRM Party project
				participation. Your identity is authenticated here; tenant, project and record permissions
				are enforced after sign-in.
			</p>
		</div>

		<div class="boundary-note">
			<span>Identity</span>
			<span aria-hidden="true">→</span>
			<span>Relationship</span>
			<span aria-hidden="true">→</span>
			<span>Permission</span>
		</div>
	</div>

	<div class="auth-panel">
		<div class="panel-inner">
			{#if data.user}
				<div class="signed-in-state">
					<p class="nb-eyebrow">Signed in</p>
					<h2>{data.user.name}</h2>
					<p>{data.user.email}</p>
					<div class="signed-in-actions">
						<a class="primary-action" href={destination}>Continue to NuBlox</a>
						<button type="button" onclick={signOut}>Sign out</button>
					</div>
				</div>
			{:else}
				<header>
					<p class="nb-eyebrow">Secure access</p>
					<h2>Sign in to NuBlox</h2>
					<p>Use your existing NuBlox account.</p>
				</header>

				<form onsubmit={signIn}>
					<label>
						<span>Email address</span>
						<input bind:value={email} type="email" name="email" autocomplete="email" required />
					</label>

					<label>
						<span>Password</span>
						<input
							bind:value={password}
							type="password"
							name="password"
							autocomplete="current-password"
							minlength="12"
							required
						/>
					</label>

					<label class="remember-row">
						<input bind:checked={rememberMe} type="checkbox" />
						<span>Keep me signed in on this device</span>
					</label>

					{#if errorMessage}
						<p class="form-error" role="alert">{errorMessage}</p>
					{/if}

					<button class="submit-button" type="submit" disabled={submitting}>
						{submitting ? 'Signing in…' : 'Sign in'}
					</button>
				</form>

				<p class="account-note">
					Accounts are provisioned through NuBlox invitations and approved organisation access.
					Public self-registration is not available.
				</p>
			{/if}
		</div>
	</div>
</section>

<style>
	.auth-shell {
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(420px, 0.95fr);
		background: var(--nb-surface);
	}

	.auth-story {
		display: flex;
		min-height: 100vh;
		flex-direction: column;
		justify-content: space-between;
		padding: clamp(32px, 5vw, 72px);
		background: var(--nb-ink);
		color: var(--nb-surface);
	}

	.brand {
		display: inline-flex;
		width: fit-content;
		align-items: center;
		gap: 10px;
		color: inherit;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-decoration: none;
	}

	.brand-mark {
		display: grid;
		width: 34px;
		height: 34px;
		place-items: center;
		border-radius: 9px;
		background: var(--nb-accent);
		color: white;
		font-size: 0.9rem;
	}

	.story-copy {
		max-width: 720px;
	}

	.story-copy .nb-eyebrow {
		color: color-mix(in srgb, var(--nb-surface) 62%, transparent);
	}

	.story-copy h1 {
		margin: 8px 0 20px;
		font-size: clamp(2.7rem, 6vw, 5.8rem);
		line-height: 0.96;
		letter-spacing: -0.06em;
	}

	.story-copy p:last-child {
		max-width: 650px;
		margin: 0;
		color: color-mix(in srgb, var(--nb-surface) 72%, transparent);
		font-size: 1rem;
		line-height: 1.7;
	}

	.boundary-note {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		font-size: 0.78rem;
		font-weight: 750;
		color: color-mix(in srgb, var(--nb-surface) 65%, transparent);
	}

	.auth-panel {
		display: grid;
		place-items: center;
		padding: 40px;
	}

	.panel-inner {
		width: min(100%, 440px);
	}

	header h2,
	.signed-in-state h2 {
		margin: 5px 0 8px;
		font-size: clamp(1.9rem, 4vw, 2.5rem);
		letter-spacing: -0.045em;
	}

	header > p:last-child,
	.signed-in-state > p:last-of-type,
	.account-note {
		color: var(--nb-muted);
	}

	form {
		display: grid;
		gap: 18px;
		margin-top: 30px;
	}

	form > label:not(.remember-row) {
		display: grid;
		gap: 7px;
	}

	form label > span {
		font-size: 0.8rem;
		font-weight: 750;
	}

	input[type='email'],
	input[type='password'] {
		width: 100%;
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 12px 13px;
		background: var(--nb-surface);
		color: var(--nb-ink);
		font: inherit;
	}

	input:focus-visible,
	button:focus-visible,
	a:focus-visible {
		outline: 3px solid color-mix(in srgb, var(--nb-accent) 30%, transparent);
		outline-offset: 2px;
	}

	.remember-row {
		display: flex;
		align-items: center;
		gap: 9px;
		color: var(--nb-muted);
	}

	.submit-button,
	.primary-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 10px;
		padding: 12px 14px;
		background: var(--nb-ink);
		color: var(--nb-surface);
		font: inherit;
		font-weight: 780;
		text-decoration: none;
	}

	.submit-button:disabled {
		cursor: progress;
		opacity: 0.62;
	}

	.form-error {
		margin: 0;
		border-left: 3px solid var(--nb-accent);
		padding: 9px 12px;
		background: var(--nb-surface-subtle);
		font-size: 0.86rem;
		line-height: 1.5;
	}

	.account-note {
		margin: 22px 0 0;
		font-size: 0.78rem;
		line-height: 1.55;
	}

	.signed-in-actions {
		display: flex;
		gap: 12px;
		margin-top: 28px;
	}

	.signed-in-actions button {
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 11px 14px;
		background: transparent;
		color: var(--nb-ink);
		font: inherit;
		font-weight: 700;
	}

	@media (max-width: 880px) {
		.auth-shell {
			grid-template-columns: 1fr;
		}

		.auth-story {
			min-height: auto;
			gap: 72px;
		}

		.auth-panel {
			min-height: 58vh;
			padding: 48px 24px;
		}
	}
</style>
