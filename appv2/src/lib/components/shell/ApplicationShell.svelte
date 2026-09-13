<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import NuBloxLogo from '$lib/components/brand/NuBloxLogo.svelte';
	import { authClient } from '$lib/auth/auth-client';
	import { routes } from '$lib/routing/route-contract';
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';

	type NavIcon = 'home' | 'work' | 'functions' | 'system';
	type NavigationItem = { label: string; href: string; icon: NavIcon };
	type NavigationGroup = { label: string; items: NavigationItem[] };

	let {
		tenant,
		user,
		children
	}: {
		tenant: { slug: string; displayName: string };
		user: { name: string; email: string };
		children: Snippet;
	} = $props();

	let signingOut = $state(false);

	const groups = $derived<NavigationGroup[]>([
		{
			label: 'Work',
			items: [
				{ label: 'Home', href: routes.dashboard(tenant.slug), icon: 'home' },
				{ label: 'My work', href: routes.myWork(tenant.slug), icon: 'work' }
			]
		},
		{
			label: 'Functions',
			items: [{ label: 'Function directory', href: routes.functions(tenant.slug), icon: 'functions' }]
		},
		{
			label: 'Tools',
			items: [{ label: 'Design system', href: routes.designSystem(tenant.slug), icon: 'system' }]
		}
	]);

	const initials = $derived(
		user.name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toLocaleUpperCase())
			.join('') || 'NB'
	);

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}

	async function signOut() {
		if (signingOut) return;
		signingOut = true;
		const signInHref = resolve(routes.appSignIn(tenant.slug));
		try {
			await authClient.signOut();
			await goto(signInHref, { invalidateAll: true });
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="application-shell">
	<aside class="desktop-rail" aria-label="NuBlox application navigation">
		<div class="brand-row">
			<a href={resolve(routes.dashboard(tenant.slug))} aria-label="NuBlox home">
				<NuBloxLogo class="rail-logo" />
			</a>
		</div>

		<div class="organisation-context" aria-label="Current organisation">
			<span>Organisation</span>
			<strong>{tenant.displayName}</strong>
		</div>

		<nav class="rail-navigation" aria-label="Primary navigation">
			{#each groups as group (group.label)}
				<section class="navigation-group" aria-labelledby={`nav-${group.label.toLocaleLowerCase()}`}>
					<h2 id={`nav-${group.label.toLocaleLowerCase()}`}>{group.label}</h2>
					<div class="navigation-items">
						{#each group.items as item (item.href)}
							<a
								href={resolve(item.href)}
								class:active={isActive(item.href)}
								aria-current={isActive(item.href) ? 'page' : undefined}
							>
								<span class="nav-icon" aria-hidden="true">
									{#if item.icon === 'home'}
										<svg viewBox="0 0 24 24"><path d="M3.5 10.4 12 3.5l8.5 6.9v9a1.1 1.1 0 0 1-1.1 1.1H4.6a1.1 1.1 0 0 1-1.1-1.1zM9 20.5v-6h6v6" /></svg>
									{:else if item.icon === 'work'}
										<svg viewBox="0 0 24 24"><path d="M8 6.5V5.2A2.2 2.2 0 0 1 10.2 3h3.6A2.2 2.2 0 0 1 16 5.2v1.3M4 7h16a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 7Zm-1.5 5.3c3.2 1.3 6.4 2 9.5 2s6.3-.7 9.5-2" /></svg>
									{:else if item.icon === 'functions'}
										<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
									{:else}
										<svg viewBox="0 0 24 24"><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3 0v16M4 9h4m0 5H4m8-6h5m-5 4h5m-5 4h3" /></svg>
									{/if}
								</span>
								<span>{item.label}</span>
							</a>
						{/each}
					</div>
				</section>
			{/each}
		</nav>

		<div class="rail-account">
			<div class="avatar" aria-hidden="true">{initials}</div>
			<div class="account-copy">
				<strong>{user.name}</strong>
				<span>{user.email}</span>
			</div>
			<button type="button" onclick={signOut} disabled={signingOut}>
				{signingOut ? 'Signing out…' : 'Sign out'}
			</button>
		</div>
	</aside>

	<div class="application-area">
		<header class="desktop-context-bar">
			<div class="context-path" aria-label="Current context">
				<span>Organisation</span>
				<span aria-hidden="true">/</span>
				<strong>{tenant.displayName}</strong>
			</div>
			<div class="signed-in-context">
				<span>Signed in as</span>
				<strong>{user.name}</strong>
			</div>
		</header>

		<header class="mobile-header">
			<a class="mobile-brand" href={resolve(routes.dashboard(tenant.slug))} aria-label="NuBlox home">
				<NuBloxLogo class="mobile-logo" />
			</a>
			<div class="mobile-organisation">
				<span>Organisation</span>
				<strong>{tenant.displayName}</strong>
			</div>
			<details class="mobile-navigation">
				<summary aria-label="Open navigation">Menu</summary>
				<div class="mobile-menu-panel">
					{#each groups as group (group.label)}
						<section>
							<h2>{group.label}</h2>
							{#each group.items as item (item.href)}
								<a
									href={resolve(item.href)}
									class:active={isActive(item.href)}
									aria-current={isActive(item.href) ? 'page' : undefined}
								>{item.label}</a
								>
							{/each}
						</section>
					{/each}
					<div class="mobile-account">
						<strong>{user.name}</strong>
						<span>{user.email}</span>
						<button type="button" onclick={signOut} disabled={signingOut}>
							{signingOut ? 'Signing out…' : 'Sign out'}
						</button>
					</div>
				</div>
			</details>
		</header>

		<main class="application-main">{@render children()}</main>
	</div>
</div>

<style>
	.application-shell {
		min-height: 100vh;
		display: grid;
		grid-template-columns: 268px minmax(0, 1fr);
		background: var(--nb-color-bg-canvas);
	}

	.desktop-rail {
		position: sticky;
		top: 0;
		display: flex;
		height: 100vh;
		min-width: 0;
		flex-direction: column;
		border-right: 1px solid var(--nb-color-border-subtle);
		background: var(--nb-color-bg-surface);
	}

	.brand-row {
		display: flex;
		min-height: 78px;
		align-items: center;
		padding: 0 24px;
		border-bottom: 1px solid var(--nb-color-border-subtle);
	}

	.brand-row a {
		display: inline-flex;
		width: 142px;
		text-decoration: none;
	}

	:global(.rail-logo) {
		width: 142px;
	}

	.organisation-context {
		display: grid;
		gap: 3px;
		margin: 20px 16px 6px;
		padding: 13px 14px;
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}

	.organisation-context span,
	.navigation-group h2,
	.mobile-organisation span,
	.signed-in-context span {
		color: var(--nb-color-text-muted);
		font-size: 0.68rem;
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.075em;
		text-transform: uppercase;
	}

	.organisation-context strong {
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: var(--nb-font-size-sm);
		white-space: nowrap;
	}

	.rail-navigation {
		display: grid;
		gap: 23px;
		padding: 20px 14px;
		overflow-y: auto;
	}

	.navigation-group {
		display: grid;
		gap: 7px;
	}

	.navigation-group h2 {
		margin: 0;
		padding: 0 10px;
	}

	.navigation-items {
		display: grid;
		gap: 3px;
	}

	.navigation-items a {
		display: grid;
		grid-template-columns: 21px minmax(0, 1fr);
		align-items: center;
		gap: 10px;
		min-height: 40px;
		padding: 8px 10px;
		border-radius: var(--nb-radius-md);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-medium);
		text-decoration: none;
	}

	.navigation-items a:hover {
		background: var(--nb-color-bg-subtle);
		color: var(--nb-color-text-primary);
	}

	.navigation-items a.active {
		background: var(--nb-color-bg-selected);
		color: var(--nb-color-action-primary);
	}

	.nav-icon {
		display: inline-grid;
		width: 19px;
		height: 19px;
		place-items: center;
	}

	.nav-icon svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.7;
	}

	.rail-account {
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr);
		gap: 9px 10px;
		align-items: center;
		margin-top: auto;
		padding: 16px;
		border-top: 1px solid var(--nb-color-border-subtle);
	}

	.avatar {
		display: grid;
		width: 34px;
		height: 34px;
		place-items: center;
		border-radius: 50%;
		background: var(--nb-blue-95);
		color: var(--nb-blue-20);
		font-size: 0.72rem;
		font-weight: var(--nb-weight-semibold);
	}

	.account-copy {
		display: grid;
		min-width: 0;
		gap: 1px;
	}

	.account-copy strong,
	.account-copy span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.account-copy strong {
		font-size: 0.79rem;
	}

	.account-copy span {
		color: var(--nb-color-text-muted);
		font-size: 0.68rem;
	}

	.rail-account button,
	.mobile-account button {
		grid-column: 1 / -1;
		justify-self: start;
		border: 0;
		padding: 4px 0;
		background: transparent;
		color: var(--nb-color-text-secondary);
		font: inherit;
		font-size: 0.74rem;
		font-weight: var(--nb-weight-medium);
		cursor: pointer;
	}

	.rail-account button:hover,
	.mobile-account button:hover {
		color: var(--nb-color-text-primary);
	}

	.application-area {
		min-width: 0;
	}

	.desktop-context-bar {
		position: sticky;
		top: 0;
		z-index: 15;
		display: flex;
		min-height: 54px;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 0 28px;
		border-bottom: 1px solid var(--nb-color-border-subtle);
		background: color-mix(in srgb, var(--nb-color-bg-surface) 94%, transparent);
		backdrop-filter: blur(14px);
	}

	.context-path,
	.signed-in-context {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.context-path {
		min-width: 0;
		color: var(--nb-color-text-muted);
		font-size: 0.78rem;
	}

	.context-path strong {
		overflow: hidden;
		color: var(--nb-color-text-primary);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.signed-in-context strong {
		font-size: 0.78rem;
		font-weight: var(--nb-weight-medium);
	}

	.application-main {
		padding: 34px 0 72px;
	}

	.mobile-header {
		display: none;
	}

	@media (max-width: 900px) {
		.application-shell {
			display: block;
		}

		.desktop-rail,
		.desktop-context-bar {
			display: none;
		}

		.mobile-header {
			position: sticky;
			top: 0;
			z-index: 30;
			display: grid;
			grid-template-columns: 112px minmax(0, 1fr) auto;
			align-items: center;
			gap: 12px;
			min-height: 64px;
			padding: 9px 16px;
			border-bottom: 1px solid var(--nb-color-border-subtle);
			background: color-mix(in srgb, var(--nb-color-bg-surface) 96%, transparent);
			backdrop-filter: blur(14px);
		}

		.mobile-brand {
			display: inline-flex;
			width: 108px;
		}

		:global(.mobile-logo) {
			width: 108px;
		}

		.mobile-organisation {
			display: grid;
			min-width: 0;
			gap: 1px;
		}

		.mobile-organisation strong {
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 0.78rem;
			white-space: nowrap;
		}

		.mobile-navigation {
			position: relative;
		}

		.mobile-navigation summary {
			list-style: none;
			border: 1px solid var(--nb-color-border-default);
			border-radius: var(--nb-radius-md);
			padding: 7px 10px;
			background: var(--nb-color-bg-surface);
			font-size: 0.76rem;
			font-weight: var(--nb-weight-semibold);
			cursor: pointer;
		}

		.mobile-navigation summary::-webkit-details-marker {
			display: none;
		}

		.mobile-menu-panel {
			position: absolute;
			top: calc(100% + 10px);
			right: 0;
			width: min(320px, calc(100vw - 32px));
			display: grid;
			gap: 18px;
			padding: 18px;
			border: 1px solid var(--nb-color-border-default);
			border-radius: var(--nb-radius-lg);
			background: var(--nb-color-bg-surface);
			box-shadow: var(--nb-shadow-md);
		}

		.mobile-menu-panel section {
			display: grid;
			gap: 3px;
		}

		.mobile-menu-panel h2 {
			margin: 0 0 5px;
			color: var(--nb-color-text-muted);
			font-size: 0.68rem;
			letter-spacing: 0.075em;
			text-transform: uppercase;
		}

		.mobile-menu-panel a {
			border-radius: var(--nb-radius-sm);
			padding: 8px 9px;
			color: var(--nb-color-text-secondary);
			font-size: var(--nb-font-size-sm);
			font-weight: var(--nb-weight-medium);
			text-decoration: none;
		}

		.mobile-menu-panel a.active {
			background: var(--nb-color-bg-selected);
			color: var(--nb-color-action-primary);
		}

		.mobile-account {
			display: grid;
			gap: 2px;
			padding-top: 14px;
			border-top: 1px solid var(--nb-color-border-subtle);
		}

		.mobile-account strong {
			font-size: 0.8rem;
		}

		.mobile-account span {
			color: var(--nb-color-text-muted);
			font-size: 0.72rem;
		}

		.mobile-account button {
			margin-top: 6px;
		}

		.application-main {
			padding-top: 28px;
		}
	}

	@media (max-width: 560px) {
		.mobile-header {
			grid-template-columns: 92px minmax(0, 1fr) auto;
			padding-inline: 12px;
		}

		.mobile-brand,
		:global(.mobile-logo) {
			width: 88px;
		}
	}
</style>
