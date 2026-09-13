<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';
	import { authClient } from '$lib/auth/auth-client';
	import { routes } from '$lib/routing/route-contract';

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
			const intentResponse = await fetch('/register/intent', {
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

			const verificationUrl = new URL(routes.verifyEmail, window.location.origin);
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

			await goto(resolve(`${routes.verifyEmail}?email=${encodeURIComponent(email.trim())}`), {
				replaceState: true,
				invalidateAll: true
			});
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Register an organisation · NuBlox</title>
	<meta
		name="description"
		content="Create a new NuBlox organisation and its first Owner account."
	/>
</svelte:head>

<main class="registration-shell">
	<section class="registration-story">
		<a class="brand" href={resolve(routes.start)}>
			<span class="brand-mark" aria-hidden="true">N</span>
			<span>NuBlox</span>
		</a>

		<div>
			<p class="nb-eyebrow">New tenancy</p>
			<h1>Create your organisation.</h1>
			<p>
				Registration creates one new NuBlox organisation and its first Owner. Everyone else joins
				that organisation later through governed invitations.
			</p>
		</div>

		<p class="boundary-note">Organisation → Owner → verification → activation</p>
	</section>

	<section class="registration-panel">
		<div class="form-wrap">
			<header>
				<p class="nb-eyebrow">Organisation registration</p>
				<h2>Start your NuBlox tenancy</h2>
				<p>Use the legal organisation name and the first Owner's work email.</p>
			</header>

			<form onsubmit={registerTenant}>
				<fieldset>
					<legend>Organisation</legend>
					<label>
						<span>Legal organisation name</span>
						<input bind:value={legalName} autocomplete="organization" maxlength="255" required />
					</label>
					<label>
						<span>Trading name <small>Optional</small></span>
						<input bind:value={tradingName} maxlength="255" />
					</label>
				</fieldset>

				<fieldset>
					<legend>First Owner</legend>
					<label>
						<span>Full name</span>
						<input bind:value={ownerName} autocomplete="name" maxlength="255" required />
					</label>
					<label>
						<span>Email address</span>
						<input bind:value={email} type="email" autocomplete="email" maxlength="320" required />
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
				</fieldset>

				{#if errorMessage}
					<p class="form-error" role="alert">{errorMessage}</p>
				{/if}

				<button type="submit" disabled={submitting}>
					{submitting ? 'Creating organisation…' : 'Create organisation'}
				</button>
			</form>
		</div>
	</section>
</main>

<style>
	.registration-shell {
		min-height: 100vh;
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(460px, 1.1fr);
		background: var(--nb-ink);
	}
	.registration-story {
		display: flex;
		min-height: 100vh;
		flex-direction: column;
		justify-content: space-between;
		padding: clamp(32px, 6vw, 72px);
		color: white;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: 10px;
		color: white;
		font-weight: 850;
		text-decoration: none;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 9px;
		background: var(--nb-accent);
	}
	.registration-story h1 {
		margin: 10px 0 20px;
		font-size: clamp(3rem, 7vw, 6.2rem);
		line-height: 0.9;
		letter-spacing: -0.065em;
	}
	.registration-story div > p:last-child {
		max-width: 560px;
		color: #d0d5dd;
		line-height: 1.7;
	}
	.boundary-note {
		margin: 0;
		color: #98a2b3;
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}
	.registration-panel {
		display: grid;
		place-items: center;
		padding: clamp(28px, 6vw, 72px);
		background: var(--nb-surface);
	}
	.form-wrap {
		width: min(100%, 560px);
	}
	header h2 {
		margin: 8px 0;
		font-size: clamp(2.2rem, 4.5vw, 3.6rem);
		letter-spacing: -0.05em;
	}
	header > p:last-child {
		color: var(--nb-muted);
	}
	form {
		display: grid;
		gap: 22px;
		margin-top: 32px;
	}
	fieldset {
		display: grid;
		gap: 15px;
		margin: 0;
		border: 0;
		padding: 0;
	}
	legend {
		margin-bottom: 10px;
		font-weight: 800;
	}
	label {
		display: grid;
		gap: 7px;
		font-size: 0.82rem;
		font-weight: 700;
	}
	label small {
		color: var(--nb-muted);
		font-weight: 500;
	}
	input {
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 12px 13px;
		background: white;
		font: inherit;
	}
	button {
		border: 0;
		border-radius: 10px;
		padding: 13px 16px;
		background: var(--nb-ink);
		color: white;
		font: inherit;
		font-weight: 760;
		cursor: pointer;
	}
	.form-error {
		margin: 0;
		border-radius: 9px;
		padding: 11px 12px;
		background: #fff1f0;
		color: #b42318;
		font-size: 0.8rem;
	}
	@media (max-width: 860px) {
		.registration-shell {
			grid-template-columns: 1fr;
		}
		.registration-story {
			min-height: auto;
			gap: 70px;
		}
	}
</style>
