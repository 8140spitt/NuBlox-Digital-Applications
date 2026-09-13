<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Get started · NuBlox</title>
	<meta
		name="description"
		content="Start with NuBlox: sign in, register a new tenant, or use an invitation you received."
	/>
</svelte:head>

<main class="start-shell">
	<a class="brand" href={resolve('/')} aria-label="NuBlox home">
		<span class="brand-mark" aria-hidden="true">N</span>
		<span>NuBlox</span>
	</a>

	<section class="intro">
		<p class="nb-eyebrow">Get started</p>
		<h1>How are you joining NuBlox?</h1>
		<p>
			Identity is shared across the NuBlox operating system and CRM Party portal. Choose the route
			that matches why you are here.
		</p>
	</section>

	<section class="journeys" aria-label="NuBlox access journeys">
		<a class="journey primary" href={resolve('/auth')}>
			<span class="journey-number">01</span>
			<strong>Sign in</strong>
			<span>Use an existing NuBlox account.</span>
		</a>

		<a class="journey" href={resolve('/auth/register')}>
			<span class="journey-number">02</span>
			<strong>Register a new tenant</strong>
			<span>Create a new NuBlox organisation and its first owner account.</span>
		</a>

		<div class="journey informational">
			<span class="journey-number">03</span>
			<strong>Accept an invitation</strong>
			<span>Open the secure invitation link sent by the NuBlox organisation that invited you.</span>
		</div>
	</section>

	<p class="security-note">
		Tenant registration creates a new organisation. Joining an existing organisation or project is
		always invitation-based.
	</p>
</main>

<style>
	.start-shell {
		width: min(calc(100% - 40px), 1120px);
		margin: 0 auto;
		padding: clamp(34px, 6vw, 72px) 0 60px;
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
		width: 34px;
		height: 34px;
		place-items: center;
		border-radius: 9px;
		background: var(--nb-accent);
		color: white;
		font-size: 0.9rem;
	}

	.intro {
		max-width: 800px;
		margin-top: clamp(70px, 11vw, 140px);
	}

	h1 {
		margin: 0;
		font-size: clamp(3rem, 7.6vw, 6.4rem);
		line-height: 0.96;
		letter-spacing: -0.06em;
	}

	.intro > p:last-child {
		max-width: 690px;
		margin: 24px 0 0;
		color: var(--nb-muted);
		line-height: 1.7;
	}

	.journeys {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
		margin-top: 54px;
	}

	.journey {
		display: grid;
		min-height: 250px;
		align-content: space-between;
		gap: 18px;
		border: 1px solid var(--nb-border);
		border-radius: 14px;
		padding: 26px;
		background: var(--nb-surface);
		text-decoration: none;
	}

	.journey.primary {
		background: var(--nb-ink);
		color: white;
	}

	.journey:not(.informational):hover {
		transform: translateY(-2px);
		box-shadow: 0 18px 44px rgb(24 33 47 / 0.08);
	}

	.journey-number {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		opacity: 0.56;
	}

	.journey strong {
		align-self: end;
		font-size: 1.3rem;
		letter-spacing: -0.025em;
	}

	.journey > span:last-child {
		color: var(--nb-muted);
		line-height: 1.55;
	}

	.journey.primary > span:last-child {
		color: color-mix(in srgb, white 68%, transparent);
	}

	.informational {
		background: var(--nb-surface-subtle);
	}

	.security-note {
		max-width: 720px;
		margin: 28px 0 0;
		color: var(--nb-muted);
		font-size: 0.82rem;
		line-height: 1.6;
	}

	@media (max-width: 820px) {
		.journeys {
			grid-template-columns: 1fr;
		}

		.journey {
			min-height: 190px;
		}
	}

	@media (max-width: 600px) {
		.start-shell {
			width: min(calc(100% - 24px), 1120px);
		}
	}
</style>
