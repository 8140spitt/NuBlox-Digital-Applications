<script lang="ts">
	import { untrack } from 'svelte';
	import { authClient } from '$lib/auth-client';

	let { data } = $props();
	let displayName = $state(untrack(() => data.invitation.supplierName));
	let password = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let message = $state('');

	async function createAccount(event: SubmitEvent) {
		event.preventDefault();
		if (data.actor) return;
		submitting = true;
		message = '';
		const callbackURL = `${window.location.origin}/signin?verified=1&returnTo=${encodeURIComponent('/portal/supplier-quotes')}`;
		const result = await authClient.signUp.email({
			email: data.invitation.email,
			name: displayName.trim(),
			password,
			callbackURL
		});
		submitting = false;
		if (result.error) {
			message = result.error.message ?? 'Your NuBlox account could not be created.';
			return;
		}
		submitted = true;
	}
</script>

<svelte:head><title>{data.invitation.rfqNumber} · Supplier quotation · NuBlox</title></svelte:head>

<main class="shell">
	<section class="card">
		<header>
			<p class="brand">NuBlox</p>
			<p class="eyebrow">Supplier quotation</p>
			<h1>{data.invitation.rfqNumber}</h1>
			<p class="lede">
				<strong>{data.invitation.issuerName}</strong> has invited you to price {data.invitation
					.title}.
			</p>
		</header>

		<div class="summary">
			<div><span>Supplier</span><strong>{data.invitation.supplierName}</strong></div>
			<div><span>Invited email</span><strong>{data.invitation.email}</strong></div>
			<div><span>RFQ lines</span><strong>{data.invitation.lineCount}</strong></div>
			<div><span>Currency</span><strong>{data.invitation.currencyCode}</strong></div>
			{#if data.invitation.responseDeadlineAt}<div>
					<span>Response due</span><strong
						>{new Date(data.invitation.responseDeadlineAt).toLocaleString()}</strong
					>
				</div>{/if}
		</div>

		<div class="boundary-note">
			<strong>Invitation-scoped supplier access.</strong>
			<span
				>This sign-in lets the invited email review and submit this quotation. It does not create a
				NuBlox organisation or grant access to the buyer's internal workspace.</span
			>
		</div>

		{#if data.actor}
			<section class="choice">
				<h2>Open the supplier portal</h2>
				<p>Signed in as {data.actor.displayName} · {data.actor.email}</p>
				{#if data.emailMatchesActor}
					<a class="primary" href="/portal/supplier-quotes">Review and submit quotation</a>
				{:else}
					<p class="warning">
						This invitation was sent to {data.invitation.email}. Sign in with that verified email
						address to respond.
					</p>
				{/if}
			</section>
		{:else if submitted}
			<section class="notice">
				<h2>Check your email</h2>
				<p>
					Verify {data.invitation.email}, then sign in to open the supplier portal and submit the
					quotation.
				</p>
			</section>
		{:else}
			<section class="choice">
				<h2>Create your supplier sign-in</h2>
				<form class="stack" onsubmit={createAccount}>
					<label
						><span>Your name</span><input
							bind:value={displayName}
							autocomplete="name"
							required
							maxlength="200"
						/></label
					>
					<label><span>Email</span><input value={data.invitation.email} readonly /></label>
					<label
						><span>Password</span><input
							bind:value={password}
							type="password"
							autocomplete="new-password"
							minlength="12"
							maxlength="128"
							required
						/></label
					>
					{#if message}<p class="error" role="alert">{message}</p>{/if}
					<button class="primary" type="submit" disabled={submitting}
						>{submitting ? 'Creating account…' : 'Create account and respond'}</button
					>
				</form>
				<p>
					Already use NuBlox? <a href={`/signin?returnTo=${encodeURIComponent(data.returnTo)}`}
						>Sign in to respond</a
					>
				</p>
			</section>
		{/if}
	</section>
</main>

<style>
	.shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 2rem;
		background: #f5f5f2;
	}
	.card {
		width: min(100%, 54rem);
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 1rem;
		padding: 2rem;
		box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.06);
	}
	.brand {
		margin: 0 0 1.8rem;
		font-weight: 850;
	}
	.eyebrow {
		margin: 0 0 0.35rem;
		color: #62625c;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 6vw, 3rem);
		letter-spacing: -0.045em;
	}
	.lede,
	p {
		color: #5c5c56;
		line-height: 1.55;
	}
	.summary {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.7rem;
		margin: 1.5rem 0;
	}
	.summary > div {
		display: grid;
		gap: 0.2rem;
		padding: 0.85rem;
		border: 1px solid #deded7;
		border-radius: 0.6rem;
		background: #fafaf7;
	}
	.summary span {
		color: #6b6b65;
		font-size: 0.75rem;
	}
	.boundary-note {
		display: grid;
		gap: 0.35rem;
		padding: 1rem;
		border: 1px solid #cfe1d5;
		border-radius: 0.65rem;
		background: #f3faf5;
		line-height: 1.5;
	}
	.choice {
		border-top: 1px solid #e1e1da;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
	}
	.stack {
		display: grid;
		gap: 1rem;
		margin-top: 1.2rem;
	}
	label {
		display: grid;
		gap: 0.4rem;
		font-weight: 650;
	}
	input {
		min-width: 0;
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.55rem;
		padding: 0.75rem 0.85rem;
	}
	input[readonly] {
		background: #f3f3ef;
		color: #555;
	}
	button,
	.primary {
		display: inline-block;
		font: inherit;
		font-weight: 750;
		border: 1px solid #111;
		border-radius: 0.55rem;
		padding: 0.75rem 0.95rem;
		background: #111;
		color: white;
		text-decoration: none;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	.warning {
		padding: 1rem;
		border-radius: 0.65rem;
		background: #fff5d9;
	}
	.notice {
		margin-top: 1.5rem;
		padding: 1rem;
		border-radius: 0.65rem;
		background: #e8f6eb;
	}
	.error {
		color: #9b1c1c;
	}
	a {
		color: inherit;
		font-weight: 750;
	}
	@media (max-width: 680px) {
		.summary {
			grid-template-columns: 1fr;
		}
	}
</style>
