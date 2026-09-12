<script lang="ts">
	import { page } from '$app/state';
	import { routes } from '$lib/routing/route-contract';

	let { data, children } = $props();

	const items = $derived([
		{ label: 'Dashboard', href: routes.dashboard(data.tenant.slug) },
		{ label: 'My work', href: routes.myWork(data.tenant.slug) },
		{ label: 'Functions', href: routes.functions(data.tenant.slug) }
	]);
</script>

<div class="tenant-shell">
	<header class="tenant-header">
		<div class="nb-page header-inner">
			<a class="brand" href={routes.dashboard(data.tenant.slug)} aria-label="NuBlox dashboard">
				<span class="brand-mark" aria-hidden="true">N</span>
				<span>NuBlox</span>
			</a>

			<div class="tenant-context" aria-label="Current tenant">
				<span>Tenant</span>
				<strong>{data.tenant.slug}</strong>
			</div>

			<nav aria-label="Primary navigation">
				{#each items as item}
					<a
					href={item.href}
					class:active={page.url.pathname === item.href}
					aria-current={page.url.pathname === item.href ? 'page' : undefined}
					>{item.label}</a
					>
				{/each}
			</nav>
		</div>
	</header>

	<main class="tenant-main">
		{@render children()}
	</main>
</div>

<style>
	.tenant-shell {
		min-height: 100vh;
	}

	.tenant-header {
		position: sticky;
		top: 0;
		z-index: 20;
		background: color-mix(in srgb, var(--nb-surface) 96%, transparent);
		border-bottom: 1px solid var(--nb-border);
		backdrop-filter: blur(12px);
	}

	.header-inner {
		min-height: 64px;
		display: grid;
		grid-template-columns: auto auto 1fr;
		align-items: center;
		gap: 24px;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-weight: 800;
		text-decoration: none;
		letter-spacing: -0.02em;
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
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding-left: 20px;
		border-left: 1px solid var(--nb-border);
	}

	.tenant-context span {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--nb-muted);
	}

	.tenant-context strong {
		font-size: 0.9rem;
	}

	nav {
		display: flex;
		justify-content: flex-end;
		gap: 4px;
	}

	nav a {
		padding: 9px 12px;
		border-radius: 8px;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 650;
		color: var(--nb-muted);
	}

	nav a:hover,
	nav a.active {
		background: var(--nb-surface-subtle);
		color: var(--nb-ink);
	}

	.tenant-main {
		padding: 52px 0 72px;
	}

	@media (max-width: 700px) {
		.header-inner {
			grid-template-columns: auto 1fr;
			gap: 14px;
			padding: 10px 0;
		}

		.tenant-context {
			justify-self: end;
		}

		nav {
			grid-column: 1 / -1;
			justify-content: flex-start;
			overflow-x: auto;
		}
	}
</style>
