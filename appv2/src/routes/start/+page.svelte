<script lang="ts">
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';
	import { routes } from '$lib/routing/route-contract';
</script>

<svelte:head>
	<title>Start NuBlox</title>
	<meta
		name="description"
		content="Start a new NuBlox tenancy or follow an invitation into an existing organisation."
	/>
</svelte:head>

<main class="start-shell">
	<a class="brand" href={resolve('/')} aria-label="NuBlox home">
		<span class="brand-mark" aria-hidden="true">N</span>
		<span>NuBlox</span>
	</a>

	<section class="intro">
		<p class="nb-eyebrow">Start NuBlox</p>
		<h1>Create a new organisation.</h1>
		<p>
			This public journey is for the first Owner of a new NuBlox tenancy. Existing users sign in
			from their organisation-specific NuBlox address.
		</p>
	</section>

	<section class="journeys" aria-label="NuBlox start journeys">
		<a class="journey primary" href={resolve(routes.register)}>
			<span class="journey-number">01</span>
			<strong>Register a new organisation</strong>
			<span>Create the tenancy and its first Owner account.</span>
		</a>

		<div class="journey informational">
			<span class="journey-number">02</span>
			<strong>Already use NuBlox?</strong>
			<span>Open your organisation URL, for example /your-tenant/app, to sign in.</span>
		</div>

		<div class="journey informational">
			<span class="journey-number">03</span>
			<strong>Joining by invitation?</strong>
			<span
				>Use the secure tenant-specific invitation link sent by the organisation that invited you.</span
			>
		</div>
	</section>

	<p class="security-note">
		Registration always creates a new organisation. Joining an existing organisation or project is
		invitation-based and never creates a duplicate tenancy.
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
		letter-spacing: -0.02em;
		text-decoration: none;
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
	.journey.primary:hover {
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
</style>
