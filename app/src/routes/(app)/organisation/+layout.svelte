<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();
	let pathname = $derived(page.url.pathname);
</script>

<nav class="organisation-nav" aria-label="Organisation settings">
	<a href="/organisation" class:active={pathname === '/organisation'}>Access & roles</a>
	<a href="/organisation/profile" class:active={pathname === '/organisation/profile'}>
		Organisation profile
	</a>
	<a href="/organisation/identity" class:active={pathname === '/organisation/identity'}>
		Legal identity
	</a>
	<a href="/organisation/permissions" class:active={pathname === '/organisation/permissions'}>
		Permission exceptions
	</a>
</nav>

{@render children()}

<style>
	.organisation-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding-bottom: 0.85rem;
		border-bottom: 1px solid var(--nb-border);
	}

	.organisation-nav a {
		border-radius: 999px;
		padding: 0.48rem 0.78rem;
		color: var(--nb-text);
		font-size: 0.86rem;
		font-weight: 750;
		text-decoration: none;
	}

	.organisation-nav a:hover,
	.organisation-nav a:focus-visible {
		background: var(--nb-surface-muted);
	}

	.organisation-nav a.active {
		background: var(--nb-ink);
		color: var(--nb-white);
	}
</style>
