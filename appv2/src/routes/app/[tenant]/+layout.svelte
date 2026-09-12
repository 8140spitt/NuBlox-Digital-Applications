<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { routes } from '$lib/routing/route-contract';

	let { data, children } = $props();

	const items = $derived([
		{ label: 'Home', href: routes.dashboard(data.tenant.slug) },
		{ label: 'My work', href: routes.myWork(data.tenant.slug) },
		{ label: 'Projects', href: routes.projects(data.tenant.slug) },
		{ label: 'Functions', href: routes.functions(data.tenant.slug) }
	]);

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<div class="tenant-shell">
	<header class="tenant-header">
		<div class="nb-page header-inner">
			<div class="identity-group">
				<a class="brand" href={resolve(routes.dashboard(data.tenant.slug))} aria-label="NuBlox home">
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
					<a href={resolve(item.href)} class:active={isActive(item.href)} aria-current={isActive(item.href) ? 'page' : undefined}>{item.label}</a>
				{/each}
			</nav>

			<div class="shell-status" aria-label="Application surface"><span>APP</span></div>
		</div>
	</header>
	<main class="tenant-main">{@render children()}</main>
</div>

<style>
	.tenant-shell { min-height: 100vh; }
	.tenant-header { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--nb-surface) 96%, transparent); border-bottom: 1px solid var(--nb-border); backdrop-filter: blur(12px); }
	.header-inner { min-height: 66px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 22px; }
	.identity-group { min-width: 0; display: flex; align-items: center; gap: 20px; }
	.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 800; text-decoration: none; letter-spacing: -0.02em; white-space: nowrap; }
	.brand-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--nb-accent); color: white; font-size: 0.9rem; }
	.tenant-context { min-width: 0; display: grid; gap: 1px; padding-left: 20px; border-left: 1px solid var(--nb-border); }
	.context-label { font-size: 0.66rem; font-weight: 750; text-transform: uppercase; letter-spacing: 0.08em; color: var(--nb-muted); }
	.tenant-context strong { overflow: hidden; text-overflow: ellipsis; font-size: 0.88rem; white-space: nowrap; }
	nav { display: flex; justify-content: center; gap: 3px; }
	nav a { padding: 9px 11px; border-radius: 8px; text-decoration: none; font-size: 0.88rem; font-weight: 680; color: var(--nb-muted); }
	nav a:hover, nav a.active { background: var(--nb-surface-subtle); color: var(--nb-ink); }
	.shell-status span { display: inline-flex; align-items: center; justify-content: center; min-width: 42px; padding: 5px 7px; border: 1px solid var(--nb-border); border-radius: 999px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.06em; color: var(--nb-muted); }
	.tenant-main { padding: 48px 0 72px; }
	@media (max-width: 760px) {
		.header-inner { grid-template-columns: 1fr auto; gap: 12px; padding-block: 10px; }
		.identity-group { gap: 12px; }
		.tenant-context { padding-left: 12px; }
		nav { grid-column: 1 / -1; grid-row: 2; justify-content: flex-start; overflow-x: auto; }
		.shell-status { grid-column: 2; grid-row: 1; }
	}
</style>
