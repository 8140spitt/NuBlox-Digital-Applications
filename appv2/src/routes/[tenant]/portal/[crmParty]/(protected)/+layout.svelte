<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth/auth-client';
	import { routes } from '$lib/routing/route-contract';

	let { data, children } = $props();
	let signingOut = $state(false);

	const dashboardHref = $derived(routes.portalDashboard(data.tenant.slug, data.crmParty.slug));
	const projectsHref = $derived(routes.portalProjects(data.tenant.slug, data.crmParty.slug));
	const actionsHref = $derived(routes.portalActions(data.tenant.slug, data.crmParty.slug));

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}

	async function signOut() {
		if (signingOut) return;
		signingOut = true;
		try {
			await authClient.signOut();
			await invalidateAll();
			await goto(resolve(routes.portalSignIn(data.tenant.slug, data.crmParty.slug) as Pathname));
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="portal-shell">
	<header class="portal-header">
		<div class="nb-page portal-header-inner">
			<div class="portal-brand">
				<a href={resolve(dashboardHref as Pathname)}>NuBlox Portal</a>
				<span aria-hidden="true">/</span>
				<strong>{data.crmParty.slug}</strong>
			</div>

			<div class="relationship-context" aria-label="CRM Party portal context">
				<span>{data.tenant.displayName}</span>
				<span aria-hidden="true">→</span>
				<strong>{data.crmParty.slug}</strong>
			</div>

			<nav aria-label="Portal navigation">
				<a href={resolve(dashboardHref as Pathname)} class:active={isActive(dashboardHref)}>Home</a>
				<a href={resolve(projectsHref as Pathname)} class:active={isActive(projectsHref)}
					>Projects</a
				>
				<a href={resolve(actionsHref as Pathname)} class:active={isActive(actionsHref)}>Actions</a>
			</nav>

			<div class="account-control" aria-label="Signed-in account">
				<span>{data.user.name}</span>
				<button type="button" onclick={signOut} disabled={signingOut}>
					{signingOut ? 'Signing out…' : 'Sign out'}
				</button>
			</div>
		</div>
	</header>
	<main class="portal-main">{@render children()}</main>
</div>

<style>
	.portal-shell {
		min-height: 100vh;
		background: #f7f8fb;
	}
	.portal-header {
		background: #101828;
		color: white;
	}
	.portal-header-inner {
		min-height: 68px;
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		align-items: center;
		gap: 24px;
	}
	.portal-brand,
	.relationship-context,
	nav,
	.account-control {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.portal-brand a {
		color: white;
		font-weight: 800;
		text-decoration: none;
	}
	.portal-brand span,
	.relationship-context span,
	.account-control span {
		color: #98a2b3;
	}
	.relationship-context,
	.account-control {
		font-size: 0.82rem;
	}
	nav {
		gap: 4px;
	}
	nav a {
		border-radius: 8px;
		padding: 9px 11px;
		color: #d0d5dd;
		font-size: 0.88rem;
		font-weight: 650;
		text-decoration: none;
	}
	nav a:hover,
	nav a.active {
		background: #1d2939;
		color: white;
	}
	.account-control button {
		border: 1px solid #475467;
		border-radius: 8px;
		padding: 8px 10px;
		background: transparent;
		color: white;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
	}
	.portal-main {
		padding: 52px 0 72px;
	}
	@media (max-width: 900px) {
		.portal-header-inner {
			grid-template-columns: 1fr auto;
			gap: 12px;
			padding-block: 12px;
		}
		.relationship-context {
			justify-self: end;
		}
		nav {
			grid-column: 1 / -1;
			grid-row: 2;
		}
		.account-control {
			grid-column: 1 / -1;
			grid-row: 3;
			justify-content: flex-end;
		}
	}
</style>
