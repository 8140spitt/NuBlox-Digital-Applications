<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth/auth-client';

	let legalName = $state('');
	let tradingName = $state('');
	let ownerName = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');

	async function registerTenant(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';

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
			const intentResponse = await fetch(resolve('/auth/register/intent'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					email: email.trim(),
					legalName: legalName.trim(),
					tradingName: tradingName.trim() || null,
					defaultTimezone: 'Europe/London',
					defaultCurrencyCode: 'GBP'
				})
			});

			if (!intentResponse.ok) {
				const payload = (await intentResponse.json().catch(() => null)) as {
					message?: string;
				} | null;
				errorMessage = payload?.message || 'Tenant registration could not be started.';
				return;
			}

			const verificationUrl = new URL(resolve('/auth/verify-email'), window.location.origin);
			verificationUrl.searchParams.set('verified', '1');

			const result = await authClient.signUp.email({
				name: ownerName.trim(),
				email: email.trim(),
				password,
				callbackURL: verificationUrl.toString()
			});

			if (result.error) {
				errorMessage = result.error.message || 'Your NuBlox owner account could not be created.';
				return;
			}

			const next = new URL(resolve('/auth/verify-email'), window.location.origin);
			next.searchParams.set('email', email.trim());
			await goto(next, { replaceState: true, invalidateAll: true });
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Register a new tenant · NuBlox</title>
	<meta
		name="description"
		content="Register a new NuBlox tenant and create its first organisation owner account."
	/>
</svelte:head>

<main class="registration-shell">
	<section class="registration-story">
		<a class="brand" href={resolve('/auth/start')}>
			<span class="brand-mark" aria-hidden="true">N</span>
			<span>NuBlox</span>
		</a>

		<div>
			<p class="nb-eyebrow">New tenant</p>
			<h1>Create your organisation.</h1>
			<p class="story-copy">
				This creates a new NuBlox tenant and the first Owner identity. Other people join later by
				invitation; they do not register another copy of your organisation.
			</p>
		</div>

		<p class="boundary-note">Organisation → Owner → Email verification → Tenant activation</p>
	</section>

	<section class="registration-panel">
		<div class="form-wrap">
			<header>
				<p class="nb-eyebrow">Organisation registration</p>
				<h2>Tell us who is starting NuBlox</h2>
				<p>Use the legal organisation name and the email of its first NuBlox owner.</p>
			</header>

			<form onsubmit={registerTenant}>
				<fieldset>
					<legend>Organisation</legend>
					<label>
						<span>Legal organisation name</span>
						<input
							bind:value={legalName}
							name="legalName"
							autocomplete="organization"
							maxlength="255"
							required
						/>
					</label>
					<label>
						<span>Trading name <small>Optional</small></span>
						<input bind:value={tradingName} name="tradingName" maxlength="255" />
					</label>
				</fieldset>

				<fieldset>
					<legend>First owner</legend>
					<label>
						<span>Full name</span>
						<input
							bind:value={ownerName}
							name="ownerName"
							autocomplete="name"
							maxlength="255"
							required
						/>
					</label>
					<label>
						<span>Email address</span>
						<input
							bind:value={email}
							type="email"
							name="email"
							autocomplete="email"
							maxlength="320"
							required
						/>
					</label>
					<label>
						<span>Password</span>
						<input
							bind:value={password}
							type="password"
							name="password"
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
							name="confirmPassword"
							autocomplete="new-password"
							minlength="12"
							maxlength="128"
							required
						/>
					</label>
				</fieldset>

				{#if errorMessage}
					<p class="form-error" role="alert">{errorMessage}</p>
				{/if}

				<button type="submit" disabled={submitting}>
					{submitting ? 'Creating tenant…' : 'Create NuBlox tenant'}
				</button>
			</form>

			<p class="footer-copy">
				Already have an account? <a href={resolve('/auth')}>Sign in</a>
			</p>
		</div>
	</section>
</main>

<style>
	.registration-shell {
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(520px, 1.1fr);
		background: var(--nb-surface);
	}

	.registration-story {
		display: flex;
		min-height: 100vh;
		flex-direction: column;
		justify-content: space-between;
		padding: clamp(32px, 5vw, 70px);
		background: var(--nb-ink);
		color: white;
	}

	.brand {
		display: inline-flex;
		width: fit-content;
		align-items: center;
		gap: 10px;
		color: inherit;
		font-weight: 800;
		text-decoration: none;
	}

	.brand-mark {
		display: grid;
		width: 34px;
		height: 34px;
		place-items: center;
		border-radius: 9px;
		background: var(--nb-accent);
		font-size: 0.9rem;
	}

	.registration-story .nb-eyebrow {
		color: color-mix(in srgb, white 58%, transparent);
	}

	h1 {
		max-width: 680px;
		margin: 0;
		font-size: clamp(3rem, 6vw, 5.8rem);
		line-height: 0.95;
		letter-spacing: -0.06em;
	}

	.story-copy {
		max-width: 640px;
		margin: 24px 0 0;
		color: color-mix(in srgb, white 70%, transparent);
		line-height: 1.7;
	}

	.boundary-note {
		margin: 0;
		color: color-mix(in srgb, white 58%, transparent);
		font-size: 0.78rem;
		font-weight: 700;
	}

	.registration-panel {
		display: grid;
		place-items: center;
		padding: 48px;
		overflow: auto;
	}

	.form-wrap {
		width: min(100%, 560px);
	}

	header h2 {
		margin: 4px 0 8px;
		font-size: clamp(2rem, 4vw, 2.7rem);
		letter-spacing: -0.045em;
	}

	header > p:last-child,
	.footer-copy {
		color: var(--nb-muted);
		line-height: 1.55;
	}

	form {
		display: grid;
		gap: 24px;
		margin-top: 30px;
	}

	fieldset {
		display: grid;
		gap: 16px;
		margin: 0;
		border: 0;
		padding: 0;
	}

	legend {
		margin-bottom: 12px;
		font-size: 0.76rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--nb-muted);
	}

	label {
		display: grid;
		gap: 7px;
	}

	label > span {
		font-size: 0.8rem;
		font-weight: 750;
	}

	small {
		margin-left: 5px;
		font-weight: 500;
		color: var(--nb-muted);
	}

	input {
		width: 100%;
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 12px 13px;
		background: var(--nb-surface);
		color: var(--nb-ink);
	}

	button {
		min-height: 46px;
		border: 0;
		border-radius: 10px;
		padding: 12px 16px;
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
		padding: 10px 12px;
		background: var(--nb-surface-subtle);
		font-size: 0.86rem;
		line-height: 1.5;
	}

	.footer-copy {
		margin: 24px 0 0;
		font-size: 0.84rem;
	}

	.footer-copy a {
		font-weight: 750;
	}

	@media (max-width: 960px) {
		.registration-shell {
			grid-template-columns: 1fr;
		}

		.registration-story {
			min-height: auto;
			gap: 70px;
		}

		.registration-panel {
			padding: 48px 24px;
		}
	}
</style>
