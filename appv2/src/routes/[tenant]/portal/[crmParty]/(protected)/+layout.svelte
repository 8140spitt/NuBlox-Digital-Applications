<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
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
			await goto(resolve('/auth'));
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="portal-shell">
	<header class="portal-header">
		<div class="nb-page portal-header-inner">
			<div class="portal-brand">
				<a href={resolve(dashboardHref)}>NuBlox Portal</a>
				<span aria-hidden="true">/</span>
				<strong>{data.crmParty.slug}</strong>
			</div>
			<div class="relationship-context" aria-label="CRM Party portal context">
				<span>{data.tenant.displayName}</span>
				<span aria-hidden="true">→</span>
				<strong>{data.crmParty.slug}</strong>
			</div>
			<nav aria-label="Portal navigation">
				<a
					href={resolve(dashboardHref)}
					class:active={isActive(dashboardHref)}
					aria-current={isActive(dashboardHref) ? 'page' : undefined}>Home</a
				>
				<a
					href={resolve(projectsHref)}
					class:active={isActive(projectsHref)}
					aria-current={isActive(projectsHref) ? 'page' : undefined}>Projects</a
				>
				<a
					href={resolve(actionsHref)}
					class:active={isActive(actionsHref)}
					aria-current={isActive(actionsHref) ? 'page' : undefined}>Actions</a
				>
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
		font-weight: 800;
		text-decoration: none;
	}
	.portal-brand span,
	.relationship-context span,
	.account-control span {
		color: #98a2b3;
	}
	.relationship-context {
		font-size: 0.82rem;
	}
	nav {
		gap: 4px;
	}
	nav a {
		padding: 9px 11px;
		border-radius: 8px;
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
	.account-control {
		padding-left: 18px;
		border-left: 1px solid #344054;
		font-size: 0.78rem;
	}
	.account-control span {
		max-width: 130px;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 700;
		white-space: nowrap;
	}
	.account-control button {
		min-height: 34px;
		border: 1px solid #475467;
		border-radius: 8px;
		padding: 7px 10px;
		background: transparent;
		color: white;
		font: inherit;
		font-weight: 750;
		cursor: pointer;
	}
	.account-control button:hover:not(:disabled),
	.account-control button:focus-visible {
		border-color: white;
	}
	.account-control button:disabled {
		cursor: progress;
		opacity: 0.6;
	}
	.portal-main {
		padding: 52px 0 72px;
	}
	@media (max-width: 700px) {
		.portal-header-inner {
			grid-template-columns: 1fr auto;
			gap: 12px;
			padding: 12px 0;
		}
		.relationship-context {
			grid-column: 1 / -1;
			grid-row: 2;
			justify-self: start;
		}
		nav {
			grid-column: 1 / -1;
			grid-row: 3;
			overflow-x: auto;
		}
		.account-control {
			grid-column: 2;
			grid-row: 1;
			padding-left: 0;
			border-left: 0;
		}
		.account-control span {
			display: none;
		}
	}
</style>
