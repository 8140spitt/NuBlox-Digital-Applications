<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth/auth-client';

	let { data } = $props();
	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			await invalidateAll();
			await goto(data.signInHref);
		} finally {
			signingOut = false;
		}
	}
</script>

<svelte:head><title>No portal access · NuBlox</title></svelte:head>
<main class="access-shell">
	<section class="access-card">
		<a class="brand" href={data.startHref}>NuBlox Portal</a>
		<p class="nb-eyebrow">Portal access</p>
		<h1>No access to {data.contextName}</h1>
		<p class="lede">
			{data.user.name}, your identity is authenticated but this portal relationship is not
			authorised.
		</p>
		<p class="identity-note">Signed in as {data.user.email}</p>
		<button type="button" onclick={signOut} disabled={signingOut}
			>{signingOut ? 'Signing out…' : 'Sign out'}</button
		>
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
		padding: 46px;
		background: var(--nb-surface);
	}
	.brand {
		display: inline-block;
		margin-bottom: 58px;
		font-weight: 850;
		text-decoration: none;
	}
	h1 {
		font-size: clamp(2.5rem, 7vw, 4.4rem);
		letter-spacing: -0.06em;
	}
	.lede {
		color: var(--nb-muted);
		line-height: 1.7;
	}
	.identity-note {
		color: var(--nb-muted);
		font-size: 0.78rem;
	}
	button {
		margin-top: 28px;
		border: 1px solid var(--nb-border);
		border-radius: 10px;
		padding: 11px 15px;
		background: transparent;
		font: inherit;
		font-weight: 740;
		cursor: pointer;
	}
</style>
