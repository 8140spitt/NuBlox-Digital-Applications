<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import brandHeader from '$lib/assets/nublox-app-header.webp';
	import type { AppNavigationItem, AppNavigationSection } from '$lib/navigation/app-navigation';

	let { data, children } = $props();
	let searchQuery = $state('');
	let pathname = $derived(page.url.pathname);

	function isActive(href: string): boolean {
		if (href === '/dashboard') return pathname === href;
		return pathname === href || pathname.startsWith(`${href}/`);
	}

	function workspaceItems(sections: AppNavigationSection[]): AppNavigationItem[] {
		const items: AppNavigationItem[] = [];
		const seenHrefs = new Set<string>();
		for (const section of sections) {
			for (const item of section.items) {
				for (const candidate of [item, ...(item.children ?? [])]) {
					if (seenHrefs.has(candidate.href)) continue;
					seenHrefs.add(candidate.href);
					items.push(candidate);
				}
			}
		}
		return items;
	}

	function searchResults(): AppNavigationItem[] {
		const query = searchQuery.trim().toLocaleLowerCase();
		const items = workspaceItems(data.navigation);
		if (!query) return items.slice(0, 8);
		return items.filter((item) => item.label.toLocaleLowerCase().includes(query)).slice(0, 8);
	}

	async function signOut() {
		await fetch('/api/tenant/select', { method: 'DELETE' });
		await authClient.signOut();
		await goto('/signin', { invalidateAll: true });
	}
</script>

<div class="app-shell">
	<aside class="sidebar">
		<a class="brand" href="/dashboard" aria-label="NuBlox dashboard">
			<img src={brandHeader} alt="NuBlox" />
		</a>

		<details class="navigation" open>
			<summary>Workspace menu</summary>
			<nav aria-label="Primary navigation">
				{#each data.navigation as section (section.id)}
					<section class="nav-section" aria-labelledby={`nav-${section.id}`}>
						<p class="nav-heading" id={`nav-${section.id}`}>{section.label}</p>
						<div class="nav-items">
							{#each section.items as item (item.id)}
								<a
									class="nav-link"
									class:active={isActive(item.href)}
									href={item.href}
									aria-current={isActive(item.href) ? 'page' : undefined}
								>
									{item.label}
								</a>
								{#if item.children?.length}
									<div class="nav-children">
										{#each item.children as child (child.id)}
											<a
												class="nav-child"
												class:active={isActive(child.href)}
												href={child.href}
												aria-current={isActive(child.href) ? 'page' : undefined}
											>
												{child.label}
											</a>
										{/each}
									</div>
								{/if}
							{/each}
						</div>
					</section>
				{/each}
			</nav>
		</details>

		<div class="sidebar-footer" aria-hidden="true">
			<span>Built Environment OS</span>
			<small>V1 platform foundation</small>
		</div>
	</aside>

	<header class="topbar">
		<div class="organisation-context">
			<span class="context-label">Organisation</span>
			<strong>{data.organisation.name}</strong>
			<a href="/select-organisation">Switch</a>
		</div>

		<div class="shell-tools" aria-label="Workspace tools">
			<details class="tool-menu search-menu">
				<summary>Search</summary>
				<div class="tool-popover search-popover">
					<label for="workspace-search">Find a workspace</label>
					<input
						id="workspace-search"
						type="search"
						placeholder="CRM, invoices, projects…"
						bind:value={searchQuery}
					/>
					<div class="search-results" aria-live="polite">
						{#each searchResults() as item (item.id)}
							<a href={item.href}>
								<strong>{item.label}</strong>
								<small>{item.href}</small>
							</a>
						{:else}
							<p>No matching workspaces.</p>
						{/each}
					</div>
				</div>
			</details>

			{#if data.quickActions.length}
				<details class="tool-menu create-menu">
					<summary class="primary-tool">Create</summary>
					<div class="tool-popover create-popover">
						<p class="popover-title">Create new</p>
						{#each data.quickActions as action (action.id)}
							<a href={action.href}>
								<strong>{action.label}</strong>
								<small>{action.description}</small>
							</a>
						{/each}
					</div>
				</details>
			{/if}

			<button
				class="tool-button reserved-tool"
				type="button"
				disabled
				title="The notification centre will activate with the shared notification slice."
			>
				Notifications
			</button>
		</div>

		<details class="account-menu">
			<summary>
				<span class="avatar" aria-hidden="true"
					>{data.actor.displayName.slice(0, 1).toUpperCase()}</span
				>
				<span class="account-summary">
					<strong>{data.actor.displayName}</strong>
					<small>{data.actor.email}</small>
				</span>
			</summary>
			<div class="account-popover">
				<a href="/organisation">Organisation settings</a>
				<button type="button" onclick={signOut}>Sign out</button>
			</div>
		</details>
	</header>

	<main class="content">
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		min-height: 100vh;
		display: grid;
		grid-template-columns: 17rem minmax(0, 1fr);
		grid-template-rows: 4.5rem minmax(0, 1fr);
		background: var(--nb-cloud);
		color: var(--nb-text);
	}

	.sidebar {
		grid-row: 1 / -1;
		min-width: 0;
		height: 100vh;
		position: sticky;
		top: 0;
		display: flex;
		flex-direction: column;
		background: var(--nb-ink);
		color: var(--nb-white);
		border-right: 1px solid rgb(255 255 255 / 0.08);
		overflow-y: auto;
	}

	.brand {
		display: flex;
		align-items: center;
		min-height: 4.5rem;
		padding: 0.9rem 1.25rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.1);
	}

	.brand img {
		display: block;
		width: min(10rem, 100%);
		height: 2.1rem;
		object-fit: contain;
		object-position: left center;
	}

	.navigation {
		flex: 1;
		padding: 1rem 0.75rem 1.5rem;
	}

	.navigation > summary {
		display: none;
	}

	.navigation nav {
		display: grid;
		gap: 1.15rem;
	}

	.nav-section {
		min-width: 0;
	}

	.nav-heading {
		margin: 0 0 0.35rem;
		padding: 0 0.7rem;
		color: rgb(255 255 255 / 0.5);
		font-size: 0.69rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.nav-items,
	.nav-children {
		display: grid;
		gap: 0.2rem;
	}

	.nav-link,
	.nav-child {
		min-width: 0;
		border-radius: var(--nb-radius-sm);
		text-decoration: none;
		transition:
			background 120ms ease,
			color 120ms ease;
	}

	.nav-link {
		padding: 0.62rem 0.7rem;
		color: rgb(255 255 255 / 0.88);
		font-size: 0.91rem;
		font-weight: 720;
	}

	.nav-child {
		margin-left: 0.8rem;
		padding: 0.45rem 0.7rem;
		color: rgb(255 255 255 / 0.6);
		font-size: 0.82rem;
		font-weight: 600;
	}

	.nav-link:hover,
	.nav-link:focus-visible,
	.nav-child:hover,
	.nav-child:focus-visible {
		background: rgb(255 255 255 / 0.08);
		color: white;
	}

	.nav-link.active,
	.nav-child.active {
		background: rgb(20 110 245 / 0.19);
		color: white;
		box-shadow: inset 3px 0 0 var(--nb-cyan);
	}

	.nav-children {
		margin-top: 0.15rem;
	}

	.sidebar-footer {
		display: grid;
		gap: 0.2rem;
		padding: 1rem 1.25rem 1.2rem;
		border-top: 1px solid rgb(255 255 255 / 0.1);
		color: rgb(255 255 255 / 0.72);
		font-size: 0.76rem;
		font-weight: 700;
	}

	.sidebar-footer small {
		color: rgb(255 255 255 / 0.42);
		font-size: 0.7rem;
		font-weight: 550;
	}

	.topbar {
		grid-column: 2;
		min-width: 0;
		display: grid;
		grid-template-columns: minmax(12rem, 1fr) auto auto;
		align-items: center;
		gap: 1rem;
		padding: 0.65rem 1.5rem;
		border-bottom: 1px solid var(--nb-border);
		background: rgb(255 255 255 / 0.96);
		box-shadow: 0 1px 0 rgb(7 24 46 / 0.02);
		z-index: 20;
	}

	.organisation-context {
		min-width: 0;
		display: grid;
		grid-template-columns: auto minmax(0, max-content) auto;
		align-items: center;
		gap: 0.45rem 0.65rem;
	}

	.context-label {
		grid-column: 1 / -1;
		color: var(--nb-text-muted);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.09em;
		line-height: 1;
		text-transform: uppercase;
	}

	.organisation-context strong {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.92rem;
	}

	.organisation-context a {
		color: var(--nb-blue);
		font-size: 0.79rem;
		font-weight: 700;
		text-decoration: none;
	}

	.organisation-context a:hover,
	.organisation-context a:focus-visible {
		text-decoration: underline;
	}

	.shell-tools {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.tool-menu,
	.account-menu {
		position: relative;
	}

	.tool-menu > summary,
	.tool-button,
	.account-menu > summary {
		list-style: none;
		cursor: pointer;
	}

	.tool-menu > summary::-webkit-details-marker,
	.account-menu > summary::-webkit-details-marker {
		display: none;
	}

	.tool-menu > summary,
	.tool-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.35rem;
		padding: 0.48rem 0.75rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
		color: var(--nb-text);
		font-size: 0.8rem;
		font-weight: 720;
	}

	.tool-menu > summary:hover,
	.tool-menu > summary:focus-visible {
		border-color: var(--nb-border-strong);
		background: var(--nb-surface-muted);
	}

	.tool-menu > summary.primary-tool {
		border-color: var(--nb-blue);
		background: var(--nb-blue);
		color: white;
	}

	.tool-menu > summary.primary-tool:hover,
	.tool-menu > summary.primary-tool:focus-visible {
		border-color: #0b5cda;
		background: #0b5cda;
	}

	.reserved-tool {
		color: var(--nb-text-muted);
		opacity: 0.7;
		cursor: not-allowed;
	}

	.tool-popover,
	.account-popover {
		position: absolute;
		top: calc(100% + 0.55rem);
		right: 0;
		z-index: 50;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-white);
		box-shadow: 0 18px 48px rgb(7 24 46 / 0.16);
	}

	.search-popover {
		width: min(24rem, calc(100vw - 2rem));
		padding: 0.9rem;
	}

	.search-popover label,
	.popover-title {
		display: block;
		margin: 0 0 0.5rem;
		color: var(--nb-text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.search-popover input {
		width: 100%;
		padding: 0.7rem 0.75rem;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
		color: var(--nb-text);
	}

	.search-results {
		display: grid;
		gap: 0.2rem;
		margin-top: 0.55rem;
	}

	.search-results a,
	.create-popover a {
		display: grid;
		gap: 0.15rem;
		padding: 0.6rem 0.65rem;
		border-radius: var(--nb-radius-sm);
		color: var(--nb-text);
		text-decoration: none;
	}

	.search-results a:hover,
	.search-results a:focus-visible,
	.create-popover a:hover,
	.create-popover a:focus-visible {
		background: var(--nb-surface-muted);
	}

	.search-results small,
	.create-popover small {
		color: var(--nb-text-muted);
		font-size: 0.72rem;
	}

	.search-results p {
		margin: 0;
		padding: 0.65rem;
		color: var(--nb-text-muted);
		font-size: 0.82rem;
	}

	.create-popover {
		width: min(19rem, calc(100vw - 2rem));
		padding: 0.65rem;
	}

	.popover-title {
		padding: 0.35rem 0.65rem 0;
	}

	.account-menu > summary {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		padding: 0.25rem;
		border-radius: var(--nb-radius-sm);
	}

	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.35rem;
		height: 2.35rem;
		flex: 0 0 auto;
		border-radius: 999px;
		background: var(--nb-ink);
		color: white;
		font-size: 0.82rem;
		font-weight: 850;
	}

	.account-summary {
		min-width: 0;
		display: grid;
		gap: 0.08rem;
		max-width: 12rem;
	}

	.account-summary strong,
	.account-summary small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.account-summary strong {
		font-size: 0.82rem;
	}

	.account-summary small {
		color: var(--nb-text-muted);
		font-size: 0.7rem;
	}

	.account-popover {
		width: 14rem;
		padding: 0.45rem;
	}

	.account-popover a,
	.account-popover button {
		display: block;
		width: 100%;
		padding: 0.65rem 0.7rem;
		border: 0;
		border-radius: var(--nb-radius-sm);
		background: transparent;
		color: var(--nb-text);
		font: inherit;
		font-size: 0.8rem;
		font-weight: 650;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.account-popover a:hover,
	.account-popover a:focus-visible,
	.account-popover button:hover,
	.account-popover button:focus-visible {
		background: var(--nb-surface-muted);
	}

	.content {
		grid-column: 2;
		min-width: 0;
		width: 100%;
		padding: clamp(1rem, 2.2vw, 2rem);
	}

	@media (max-width: 1040px) {
		.topbar {
			grid-template-columns: minmax(10rem, 1fr) auto;
			gap: 0.7rem;
		}

		.shell-tools {
			grid-column: 1 / -1;
			grid-row: 2;
		}

		.app-shell {
			grid-template-rows: auto minmax(0, 1fr);
		}

		.topbar {
			padding-block: 0.55rem;
		}
	}

	@media (max-width: 820px) {
		.app-shell {
			display: block;
		}

		.sidebar {
			height: auto;
			position: relative;
			overflow: visible;
		}

		.brand {
			min-height: 3.8rem;
			padding: 0.7rem 1rem;
		}

		.brand img {
			width: 8.6rem;
			height: 1.9rem;
		}

		.navigation {
			padding: 0;
			border-top: 1px solid rgb(255 255 255 / 0.08);
		}

		.navigation > summary {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0.75rem 1rem;
			color: rgb(255 255 255 / 0.82);
			font-size: 0.82rem;
			font-weight: 750;
			cursor: pointer;
		}

		.navigation > summary::after {
			content: '▾';
			color: rgb(255 255 255 / 0.55);
		}

		.navigation:not([open]) > summary::after {
			content: '▸';
		}

		.navigation nav {
			max-height: min(65vh, 34rem);
			overflow-y: auto;
			padding: 0.85rem 0.75rem 1.2rem;
		}

		.sidebar-footer {
			display: none;
		}

		.topbar {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.65rem;
			padding: 0.7rem 1rem;
			position: sticky;
			top: 0;
		}

		.organisation-context {
			flex: 1 1 14rem;
		}

		.shell-tools {
			order: 3;
			width: 100%;
			overflow-x: auto;
			padding-bottom: 0.1rem;
		}

		.account-menu {
			margin-left: auto;
		}

		.account-summary {
			display: none;
		}

		.content {
			padding: 1rem;
		}
	}

	@media (max-width: 480px) {
		.context-label,
		.organisation-context a {
			display: none;
		}

		.organisation-context {
			display: block;
		}

		.tool-menu > summary,
		.tool-button {
			min-height: 2.2rem;
			padding-inline: 0.65rem;
			font-size: 0.76rem;
		}
	}
</style>
