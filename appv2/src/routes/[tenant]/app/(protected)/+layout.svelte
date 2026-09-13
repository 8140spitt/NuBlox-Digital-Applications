<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth/auth-client';
	import { routes } from '$lib/routing/route-contract';

	let { data, children } = $props();
	let signingOut = $state(false);

	const items = $derived([
		{ label: 'Home', href: routes.dashboard(data.tenant.slug) },
		{ label: 'My work', href: routes.myWork(data.tenant.slug) },
		{ label: 'Projects', href: routes.projects(data.tenant.slug) },
		{ label: 'Functions', href: routes.functions(data.tenant.slug) }
	]);

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}

	async function signOut() {
		if (signingOut) return;
		signingOut = true;
		const signInHref = resolve(routes.appSignIn(data.tenant.slug));
		try {
			await authClient.signOut();
			await goto(signInHref, { invalidateAll: true });
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="tenant-shell">
	<header class="tenant-header">
		<div class="nb-page header-inner">
			<div class="identity-group">
				<a
					class="brand"
					href={resolve(routes.dashboard(data.tenant.slug))}
					aria-label="NuBlox home"
				>
					<span class="brand-mark" aria-hidden="true">N</span>
					<span>NuBlox</span>
				</a>
				<div class="tenant-context" aria-label="Current organisation context">
					<span class="context-label">Organisation</span>
					<strong>{data.tenant.displayName}</strong>
				</div>
			</div>

			<nav aria-label="Primary navigation">
				{#each items as item (item.href)}
					<a
						href={resolve(item.href)}
						class:active={isActive(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="account-control" aria-label="Signed-in account">
				<span>{data.user.name}</span>
				<button type="button" onclick={signOut} disabled={signingOut}>
					{signingOut ? 'Signing out…' : 'Sign out'}
				</button>
			</div>
		</div>
	</header>
	<main class="tenant-main">{@render children()}</main>
</div>

<style>
	.tenant-shell {
		min-height: 100vh;
	}
	.tenant-header {
		position: sticky;
		top: 0;
		z-index: 20;
		border-bottom: 1px solid var(--nb-border);
		background: color-mix(in srgb, var(--nb-surface) 96%, transparent);
		backdrop-filter: blur(12px);
	}
	.header-inner {
		min-height: 66px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 22px;
	}
	.identity-group,
	.brand,
	nav,
	.account-control {
		display: flex;
		align-items: center;
	}
	.identity-group {
		min-width: 0;
		gap: 20px;
	}
	.brand {
		gap: 10px;
		font-weight: 800;
		letter-spacing: -0.02em;
		text-decoration: none;
		white-space: nowrap;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 9px;
		background: var(--nb-accent);
		color: white;
		font-size: 0.9rem;
	}
	.tenant-context {
		min-width: 0;
		display: grid;
		gap: 1px;
		padding-left: 20px;
		border-left: 1px solid var(--nb-border);
	}
	.context-label {
		color: var(--nb-muted);
		font-size: 0.66rem;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.tenant-context strong {
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.88rem;
		white-space: nowrap;
	}
	nav {
		justify-content: center;
		gap: 3px;
	}
	nav a {
		border-radius: 8px;
		padding: 9px 11px;
		color: var(--nb-muted);
		font-size: 0.88rem;
		font-weight: 680;
		text-decoration: none;
	}
	nav a:hover,
	nav a.active {
		background: var(--nb-surface-subtle);
		color: var(--nb-ink);
	}
	.account-control {
		justify-content: flex-end;
		gap: 10px;
	}
	.account-control span {
		max-width: 170px;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--nb-muted);
		font-size: 0.78rem;
		white-space: nowrap;
	}
	.account-control button {
		border: 1px solid var(--nb-border);
		border-radius: 8px;
		padding: 8px 10px;
		background: transparent;
		color: var(--nb-ink);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
	}
	.tenant-main {
		padding: 48px 0 72px;
	}
	@media (max-width: 820px) {
		.header-inner {
			grid-template-columns: 1fr auto;
			gap: 12px;
			padding-block: 10px;
		}
		nav {
			grid-column: 1 / -1;
			grid-row: 2;
			justify-content: flex-start;
			overflow-x: auto;
		}
		.account-control {
			grid-column: 2;
			grid-row: 1;
		}
		.account-control span {
			display: none;
		}
	}
</style>
