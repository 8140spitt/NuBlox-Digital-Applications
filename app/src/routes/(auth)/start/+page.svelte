<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let { data, form } = $props();
	let displayName = $state('');
	let email = $state('');
	let password = $state('');
	let legalName = $state('');
	let tradingName = $state('');
	let defaultTimezone = $state('Europe/London');
	let defaultCurrencyCode = $state('GBP');
	let submitting = $state(false);
	let submitted = $state(false);
	let message = $state('');

	async function startOrganisation(event: SubmitEvent) {
		event.preventDefault();
		if (data.actor) return;
		submitting = true;
		message = '';

		const intentResponse = await fetch('/api/organisations/bootstrap-intents', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: email.trim(),
				legalName: legalName.trim(),
				tradingName: tradingName.trim() || null,
				defaultTimezone: defaultTimezone.trim(),
				defaultCurrencyCode: defaultCurrencyCode.trim()
			})
		});
		if (!intentResponse.ok) {
			const body = await intentResponse.json().catch(() => null);
			message = body?.message ?? 'Organisation setup could not be started.';
			submitting = false;
			return;
		}

		const callbackURL = `${window.location.origin}/signin?verified=1&returnTo=${encodeURIComponent('/select-organisation')}`;
		const result = await authClient.signUp.email({
			email: email.trim(),
			name: displayName.trim(),
			password,
			callbackURL
		});
		submitting = false;
		if (result.error) {
			message = result.error.message ?? 'The NuBlox account could not be created.';
			return;
		}
		submitted = true;
	}
</script>

<svelte:head>
	<title>{data.actor ? 'Create organisation' : 'Start with NuBlox'} · NuBlox</title>
</svelte:head>

<main class="shell">
	<section class="card">
		<p class="brand">NuBlox</p>
		{#if data.actor}
			<p class="eyebrow">Organisation setup</p>
			<h1>Create another organisation</h1>
			<p class="lede">Signed in as {data.actor.displayName} · {data.actor.email}</p>

			<form class="stack" method="POST" action="?/createOrganisation">
				<label>
					<span>Legal organisation name</span>
					<input name="legalName" required maxlength="255" autocomplete="organization" />
				</label>
				<label>
					<span>Trading name <small>optional</small></span>
					<input name="tradingName" maxlength="255" />
				</label>
				<div class="row">
					<label>
						<span>Timezone</span>
						<input name="defaultTimezone" value="Europe/London" required maxlength="64" />
					</label>
					<label>
						<span>Currency</span>
						<input name="defaultCurrencyCode" value="GBP" required minlength="3" maxlength="3" />
					</label>
				</div>
				{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
				<button class="primary" type="submit">Create organisation</button>
			</form>
			<p class="secondary-copy"><a href="/select-organisation">Back to organisation selection</a></p>
		{:else if submitted}
			<p class="eyebrow">Verify your account</p>
			<h1>Check your email</h1>
			<div class="notice success">
				We sent a verification link to <strong>{email}</strong>. Your NuBlox user, organisation,
				owner membership and standard roles are created only after that email is verified.
			</div>
			<p><a href="/signin">Go to sign in</a></p>
		{:else}
			<p class="eyebrow">New organisation</p>
			<h1>Start with NuBlox</h1>
			<p class="lede">
				Create your account and first organisation. Email verification completes the organisation
				bootstrap and makes you its initial owner.
			</p>

			<form class="stack" onsubmit={startOrganisation}>
				<h2>Your account</h2>
				<label>
					<span>Your name</span>
					<input bind:value={displayName} autocomplete="name" required maxlength="200" />
				</label>
				<label>
					<span>Email</span>
					<input bind:value={email} type="email" autocomplete="email" required maxlength="320" />
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

				<h2>Organisation</h2>
				<label>
					<span>Legal organisation name</span>
					<input bind:value={legalName} autocomplete="organization" required maxlength="255" />
				</label>
				<label>
					<span>Trading name <small>optional</small></span>
					<input bind:value={tradingName} maxlength="255" />
				</label>
				<div class="row">
					<label>
						<span>Timezone</span>
						<input bind:value={defaultTimezone} required maxlength="64" />
					</label>
					<label>
						<span>Currency</span>
						<input bind:value={defaultCurrencyCode} required minlength="3" maxlength="3" />
					</label>
				</div>
				{#if message}<p class="error" role="alert">{message}</p>{/if}
				<button class="primary" type="submit" disabled={submitting}>
					{submitting ? 'Creating account…' : 'Create account and organisation'}
				</button>
			</form>
			<p class="secondary-copy">Already have a NuBlox account? <a href="/signin">Sign in</a></p>
		{/if}
	</section>
</main>

<style>
	.shell { min-height: 100vh; display: grid; place-items: center; padding: 2rem; background: #f5f5f2; }
	.card { width: min(100%, 42rem); background: white; border: 1px solid #d9d9d2; border-radius: 1rem; padding: 2rem; box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.06); }
	.brand { margin: 0 0 2rem; font-weight: 850; letter-spacing: -0.02em; }
	.eyebrow { margin: 0 0 0.45rem; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.75rem; font-weight: 750; color: #62625c; }
	h1 { margin: 0; font-size: clamp(2rem, 6vw, 2.8rem); letter-spacing: -0.04em; }
	h2 { margin: 0.7rem 0 -0.2rem; font-size: 1rem; }
	.lede, .secondary-copy { color: #5c5c56; line-height: 1.6; }
	.stack { display: grid; gap: 1rem; margin-top: 1.5rem; }
	.row { display: grid; grid-template-columns: 1fr 9rem; gap: 1rem; }
	label { display: grid; gap: 0.4rem; font-weight: 650; }
	label small { font-weight: 400; color: #6b6b65; }
	input { font: inherit; border: 1px solid #b9b9b1; border-radius: 0.55rem; padding: 0.75rem 0.85rem; min-width: 0; }
	input:focus { outline: 2px solid #222; outline-offset: 2px; }
	button { font: inherit; font-weight: 700; border-radius: 0.55rem; padding: 0.8rem 1rem; cursor: pointer; }
	.primary { border: 1px solid #111; background: #111; color: white; }
	button:disabled { opacity: 0.55; cursor: wait; }
	.notice { margin: 1.25rem 0; padding: 1rem; border-radius: 0.6rem; line-height: 1.55; }
	.notice.success { background: #e8f6eb; }
	.error { color: #9b1c1c; margin: 0; }
	a { color: inherit; font-weight: 700; }
	@media (max-width: 620px) { .row { grid-template-columns: 1fr; } }
</style>
