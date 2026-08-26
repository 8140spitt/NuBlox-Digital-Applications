<script lang="ts">
	import NuBloxLockup from './NuBloxLockup.svelte';

	type NavigationItem = {
		label: string;
		href: string;
	};

	type Props = {
		navigation?: NavigationItem[];
		ctaLabel?: string;
		ctaHref?: string;
		signInHref?: string;
	};

	let {
		navigation = [
			{ label: 'Platform', href: '#platform' },
			{ label: 'Solutions', href: '#solutions' },
			{ label: 'Industries', href: '#industries' },
			{ label: 'Resources', href: '#resources' },
			{ label: 'About', href: '#about' }
		],
		ctaLabel = 'Get started',
		ctaHref = '/start',
		signInHref = '/signin'
	}: Props = $props();
</script>

<header class="marketing-header">
	<div class="header-inner">
		<NuBloxLockup href="/web" theme="dark" size="md" ariaLabel="NuBlox home" />

		<nav class="desktop-nav" aria-label="Website navigation">
			{#each navigation as item (item.href)}
				<a href={item.href}>{item.label}</a>
			{/each}
		</nav>

		<div class="actions">
			<a class="sign-in" href={signInHref}>Sign in</a>
			<a class="primary-action" href={ctaHref}>{ctaLabel}</a>
		</div>

		<details class="mobile-menu">
			<summary aria-label="Open website navigation">Menu</summary>
			<nav aria-label="Mobile website navigation">
				{#each navigation as item (item.href)}
					<a href={item.href}>{item.label}</a>
				{/each}
				<a href={signInHref}>Sign in</a>
				<a class="mobile-cta" href={ctaHref}>{ctaLabel}</a>
			</nav>
		</details>
	</div>
</header>

<style>
	.marketing-header {
		position: relative;
		z-index: 20;
		border-bottom: 1px solid rgb(255 255 255 / 0.1);
		background: rgb(7 24 46 / 0.94);
		color: white;
		backdrop-filter: blur(14px);
	}

	.header-inner {
		width: min(88rem, calc(100% - 2rem));
		min-height: 5rem;
		margin: 0 auto;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: clamp(1.5rem, 4vw, 4rem);
	}

	.desktop-nav {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(1rem, 2.5vw, 2.2rem);
	}

	.desktop-nav a,
	.sign-in {
		color: rgb(255 255 255 / 0.78);
		font-size: 0.88rem;
		font-weight: 650;
		text-decoration: none;
		transition: color 120ms ease;
	}

	.desktop-nav a:hover,
	.desktop-nav a:focus-visible,
	.sign-in:hover,
	.sign-in:focus-visible {
		color: white;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.primary-action,
	.mobile-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.65rem;
		padding: 0 1rem;
		border-radius: var(--nb-radius-sm);
		background: var(--nb-blue);
		color: white;
		font-size: 0.85rem;
		font-weight: 760;
		text-decoration: none;
		box-shadow: 0 8px 24px rgb(20 110 245 / 0.22);
	}

	.primary-action:hover,
	.primary-action:focus-visible,
	.mobile-cta:hover,
	.mobile-cta:focus-visible {
		background: var(--nb-blue-strong);
	}

	.mobile-menu {
		display: none;
		position: relative;
	}

	.mobile-menu > summary {
		list-style: none;
		padding: 0.55rem 0.7rem;
		border: 1px solid rgb(255 255 255 / 0.18);
		border-radius: var(--nb-radius-sm);
		color: white;
		font-size: 0.8rem;
		font-weight: 720;
		cursor: pointer;
	}

	.mobile-menu > summary::-webkit-details-marker {
		display: none;
	}

	.mobile-menu nav {
		position: absolute;
		top: calc(100% + 0.6rem);
		right: 0;
		width: min(19rem, calc(100vw - 2rem));
		display: grid;
		gap: 0.25rem;
		padding: 0.55rem;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: var(--nb-radius-md);
		background: var(--nb-ink);
		box-shadow: var(--nb-shadow-lg);
	}

	.mobile-menu nav a {
		padding: 0.65rem 0.7rem;
		border-radius: var(--nb-radius-sm);
		color: rgb(255 255 255 / 0.86);
		font-size: 0.85rem;
		font-weight: 650;
		text-decoration: none;
	}

	.mobile-menu nav a:hover,
	.mobile-menu nav a:focus-visible {
		background: rgb(255 255 255 / 0.08);
		color: white;
	}

	@media (max-width: 880px) {
		.header-inner {
			grid-template-columns: 1fr auto;
		}

		.desktop-nav,
		.actions {
			display: none;
		}

		.mobile-menu {
			display: block;
		}
	}
</style>
