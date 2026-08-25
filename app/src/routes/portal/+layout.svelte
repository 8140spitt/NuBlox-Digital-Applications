<script lang="ts">
	import { page } from '$app/state';
	import { NuBloxLockup } from '$lib/components/brand';

	let { data, children } = $props();
	let pathname = $derived(page.url.pathname);

	function active(href: string): boolean {
		return href === '/portal' ? pathname === href : pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>Shared work · NuBlox</title>
</svelte:head>

<div class="portal-shell">
	<header class="portal-header">
		<NuBloxLockup
			class="brand"
			href="/portal"
			theme="dark"
			size="sm"
			ariaLabel="NuBlox shared work"
		/>
		<nav aria-label="Portal navigation">
			<a class:active={active('/portal')} href="/portal">Shared work</a>
			{#if data.canManage}
				<a class:active={active('/portal/manage')} href="/portal/manage">Manage sharing</a>
			{/if}
		</nav>
		<div class="context">
			<div>
				<span>{data.mode === 'member' ? data.organisation?.name : 'External collaboration'}</span>
				<small>{data.actor.displayName}</small>
			</div>
			{#if data.mode === 'member'}
				<a href="/select-organisation">Switch</a>
				<a href="/dashboard">Back to NuBlox</a>
			{/if}
		</div>
	</header>

	<main class="portal-content">
		{@render children()}
	</main>
</div>

<style>
	.portal-shell {
		min-height: 100vh;
		background:
			radial-gradient(circle at top left, rgb(20 110 245 / 0.08), transparent 28rem),
			var(--nb-cloud);
	}

	.portal-header {
		position: sticky;
		top: 0;
		z-index: 10;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 1.25rem;
		min-height: 4.5rem;
		padding: 0.7rem clamp(1rem, 3vw, 2.5rem);
		background: var(--nb-ink);
		color: var(--nb-white);
		box-shadow: 0 1px 0 rgb(255 255 255 / 0.08);
	}

	nav {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	nav a,
	.context a {
		border-radius: var(--nb-radius-sm);
		color: rgb(255 255 255 / 0.78);
		text-decoration: none;
	}

	nav a {
		padding: 0.55rem 0.72rem;
		font-weight: 700;
	}

	nav a:hover,
	nav a.active {
		background: rgb(255 255 255 / 0.1);
		color: white;
	}

	.context {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.7rem;
		font-size: 0.82rem;
	}

	.context div {
		display: grid;
		text-align: right;
	}

	.context span {
		font-weight: 800;
	}

	.context small {
		color: rgb(255 255 255 / 0.55);
	}

	.context a {
		padding: 0.42rem 0.55rem;
		border: 1px solid rgb(255 255 255 / 0.16);
	}

	.portal-content {
		width: min(78rem, 100%);
		margin: 0 auto;
		padding: clamp(1.2rem, 3vw, 2.4rem);
	}

	@media (max-width: 760px) {
		.portal-header {
			position: static;
			grid-template-columns: 1fr auto;
			gap: 0.65rem;
		}

		nav {
			grid-column: 1 / -1;
			grid-row: 2;
			overflow-x: auto;
		}

		.context div,
		.context a:first-of-type {
			display: none;
		}
	}
</style>
