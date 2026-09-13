<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { authClient } from '$lib/auth/auth-client';

	let { data } = $props();
	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			await invalidateAll();
			await goto(resolve(data.signInHref as Pathname));
		} finally {
			signingOut = false;
		}
	}
</script>

<svelte:head>
	<title>No access · NuBlox</title>
	<meta
		name="description"
		content="This identity has no active access to the requested NuBlox tenant."
	/>
</svelte:head>

<main class="access-shell">
	<section class="access-card">
		<a class="brand" href={resolve(data.startHref as Pathname)}>NuBlox</a>
		<p class="nb-eyebrow">Tenant access</p>
		<h1>No access to {data.tenant}</h1>
		<p class="lede">
			{data.user.name}, your identity is authenticated but it does not have an active membership in
			this organisation. Use a tenant-specific invitation if one was sent to you, or contact the
			organisation's NuBlox administrator.
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
		cursor: pointer;
	}
	button:disabled {
		cursor: progress;
		opacity: 0.62;
	}
</style>
