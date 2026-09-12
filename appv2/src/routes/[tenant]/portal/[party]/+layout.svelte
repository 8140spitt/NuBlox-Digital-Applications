<script lang="ts">
	import { page } from '$app/state';
	import { routes } from '$lib/routing/route-contract';

	let { data, children } = $props();

	const dashboardHref = $derived(routes.portalDashboard(data.tenant.slug, data.party.slug));
	const actionsHref = $derived(routes.portalActions(data.tenant.slug, data.party.slug));
</script>

<div class="portal-shell">
	<header class="portal-header">
		<div class="nb-page portal-header-inner">
			<div class="portal-brand">
				<a href={dashboardHref}>NuBlox Portal</a>
				<span aria-hidden="true">/</span>
				<strong>{data.party.slug}</strong>
			</div>

			<div class="relationship-context" aria-label="Portal context">
				<span>{data.tenant.slug}</span>
				<span aria-hidden="true">→</span>
				<strong>{data.party.slug}</strong>
			</div>

			<nav aria-label="Portal navigation">
				<a
					href={dashboardHref}
					class:active={page.url.pathname === dashboardHref}
					aria-current={page.url.pathname === dashboardHref ? 'page' : undefined}>Dashboard</a
				>
				<a
					href={actionsHref}
					class:active={page.url.pathname === actionsHref}
					aria-current={page.url.pathname === actionsHref ? 'page' : undefined}>Actions</a
				>
			</nav>
		</div>
	</header>

	<main class="portal-main">
		{@render children()}
	</main>
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
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: 24px;
	}

	.portal-brand,
	.relationship-context,
	nav {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.portal-brand a {
		font-weight: 800;
		text-decoration: none;
	}

	.portal-brand span,
	.relationship-context span {
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
			justify-self: end;
		}

		nav {
			grid-column: 1 / -1;
		}
	}
</style>
