<script lang="ts">
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth/auth-client';
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();
	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			await invalidateAll();
			await goto(resolve('/auth'));
		} finally {
			signingOut = false;
		}
	}
</script>

<svelte:head>
	<title>No authorised context · NuBlox</title>
	<meta
		name="description"
		content="Your NuBlox identity is valid but currently has no active organisation context."
	/>
</svelte:head>

<main class="access-shell">
	<section class="access-card">
		<a class="brand" href={resolve('/auth/start')}>NuBlox</a>
		<p class="nb-eyebrow">Identity verified</p>
		<h1>No active organisation access</h1>
		<p class="lede">
			{data.user.name}, your account is authenticated, but it does not currently have an active
			NuBlox organisation membership. If you were invited to an existing organisation, use the
			invitation link supplied by that organisation.
		</p>
		<p class="identity-note">Signed in as {data.user.email}</p>
		<button type="button" onclick={signOut} disabled={signingOut}>
			{signingOut ? 'Signing out…' : 'Sign out'}
		</button>
	</section>
</main>

<style>
	.access-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 28px;
		background: var(--nb-ink);
	}

	.access-card {
		width: min(100%, 620px);
		border-radius: 16px;
		padding: clamp(30px, 6vw, 52px);
		background: var(--nb-surface);
	}

	.brand {
		display: inline-block;
		margin-bottom: 58px;
		font-weight: 850;
		letter-spacing: -0.03em;
		text-decoration: none;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.5rem, 7vw, 4.4rem);
		line-height: 0.98;
		letter-spacing: -0.06em;
	}

	.lede {
		margin: 22px 0 0;
		color: var(--nb-muted);
		line-height: 1.7;
	}

	.identity-note {
		margin: 24px 0 0;
		color: var(--nb-muted);
		font-size: 0.78rem;
	}

	button {
		margin-top: 28px;
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 11px 15px;
		background: transparent;
		color: var(--nb-ink);
		font: inherit;
		font-weight: 740;
	}

	button:disabled {
		cursor: progress;
		opacity: 0.62;
	}
</style>
