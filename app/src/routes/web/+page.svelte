<script lang="ts">
	import { MarketingHeader, MarketingHero } from '$lib/components/brand';
</script>

<svelte:head>
	<title>NuBlox — The operating system for the built environment</title>
	<meta
		name="description"
		content="NuBlox connects people, projects, processes and business operations across the built environment."
	/>
</svelte:head>

<div class="marketing-page">
	<MarketingHeader />
	<main>
		<MarketingHero primaryHref="/start" />

		<section class="platform" id="platform" aria-labelledby="platform-title">
			<div class="section-inner">
				<div class="section-heading">
					<p>One connected platform</p>
					<h2 id="platform-title">
						Run the business and deliver the work from the same operating foundation.
					</h2>
				</div>
				<div class="platform-grid">
					<article>
						<span>01</span>
						<h3>Shared business core</h3>
						<p>
							Customers, suppliers, people, finance and commercial records stay connected instead of
							being recreated between tools.
						</p>
					</article>
					<article>
						<span>02</span>
						<h3>Project operating context</h3>
						<p>
							Project teams move between information, controls, commercial work and delivery while
							retaining the same project context.
						</p>
					</article>
					<article>
						<span>03</span>
						<h3>Governed workflows</h3>
						<p>
							Role-aware permissions, lifecycle controls and auditable events turn disconnected
							administration into controlled operations.
						</p>
					</article>
				</div>
			</div>
		</section>
	</main>
</div>

<style>
	.marketing-page {
		min-height: 100vh;
		background: var(--nb-cloud);
	}

	.platform {
		padding: clamp(4.5rem, 8vw, 8rem) 0;
		background: var(--nb-cloud);
	}

	.section-inner {
		width: min(88rem, calc(100% - 2rem));
		margin: 0 auto;
	}

	.section-heading {
		max-width: 58rem;
	}

	.section-heading > p {
		margin: 0 0 0.85rem;
		color: var(--nb-blue);
		font-size: 0.76rem;
		font-weight: 820;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h2 {
		margin: 0;
		color: var(--nb-ink);
		font-size: clamp(2rem, 4.5vw, 4rem);
		font-weight: 760;
		letter-spacing: -0.05em;
		line-height: 1.02;
		text-wrap: balance;
	}

	.platform-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		margin-top: clamp(2.5rem, 5vw, 4.5rem);
	}

	article {
		min-width: 0;
		padding: 1.5rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-white);
		box-shadow: var(--nb-shadow-sm);
	}

	article > span {
		display: block;
		margin-bottom: 2.5rem;
		color: var(--nb-cyan);
		font-size: 0.72rem;
		font-weight: 820;
		letter-spacing: 0.08em;
	}

	h3 {
		margin: 0;
		color: var(--nb-ink);
		font-size: 1.15rem;
		letter-spacing: -0.025em;
	}

	article p {
		margin: 0.7rem 0 0;
		color: var(--nb-text-muted);
		font-size: 0.9rem;
		line-height: 1.65;
	}

	@media (max-width: 760px) {
		.platform-grid {
			grid-template-columns: 1fr;
		}

		article > span {
			margin-bottom: 1.5rem;
		}
	}
</style>
