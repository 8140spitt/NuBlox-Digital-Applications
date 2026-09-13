<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth/auth-client';
	import NuBloxLogo from '$lib/components/brand/NuBloxLogo.svelte';
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
		const signInHref = resolve(routes.portalSignIn(data.tenant.slug, data.crmParty.slug));
		try {
			await authClient.signOut();
			await goto(signInHref, { invalidateAll: true });
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="portal-shell">
	<header class="portal-header">
		<div class="nb-page portal-header-inner">
			<div class="portal-brand">
				<a href={resolve(dashboardHref)} aria-label="NuBlox Portal home">
					<span class="brand-mark"><NuBloxLogo variant="mark" alt="" /></span>
					<span class="brand-wordmark">NuBlox</span>
				</a>
				<span class="portal-label">Portal</span>
			</div>

			<div class="relationship-context" aria-label="CRM Party portal context">
				<span>{data.tenant.displayName}</span>
				<span aria-hidden="true">→</span>
				<strong>{data.crmParty.slug}</strong>
			</div>

			<nav aria-label="Portal navigation">
				<a href={resolve(dashboardHref)} class:active={isActive(dashboardHref)}>Home</a>
				<a href={resolve(projectsHref)} class:active={isActive(projectsHref)}>Projects</a>
				<a href={resolve(actionsHref)} class:active={isActive(actionsHref)}>Actions</a>
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
		background: var(--nb-color-bg-canvas);
	}
	.portal-header {
		background: var(--nb-blue-10);
		color: var(--nb-blue-100);
	}
	.portal-header-inner {
		min-height: 68px;
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		align-items: center;
		gap: 24px;
	}
	.portal-brand,
	.portal-brand a,
	.relationship-context,
	nav,
	.account-control {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.portal-brand a {
		color: var(--nb-blue-100);
		text-decoration: none;
	}
	.brand-mark {
		display: block;
		width: 34px;
	}
	.brand-wordmark {
		font-size: 0.98rem;
		font-weight: 800;
		letter-spacing: -0.035em;
	}
	.portal-label {
		border-left: 1px solid var(--nb-blue-30);
		padding-left: 10px;
		color: var(--nb-blue-80);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.relationship-context span,
	.account-control span {
		color: var(--nb-blue-70);
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
		color: var(--nb-blue-80);
		font-size: 0.88rem;
		font-weight: 650;
		text-decoration: none;
	}
	nav a:hover,
	nav a.active {
		background: var(--nb-blue-20);
		color: var(--nb-blue-100);
	}
	.account-control button {
		border: 1px solid var(--nb-blue-40);
		border-radius: 8px;
		padding: 8px 10px;
		background: transparent;
		color: var(--nb-blue-100);
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
