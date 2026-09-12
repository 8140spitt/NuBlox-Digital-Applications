<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page dashboard">
	<p class="nb-eyebrow">Tenant workspace</p>
	<h1>{data.tenant.slug}</h1>
	<p class="nb-lede">
		NuBlox V2 starts with a stable place and context model. This dashboard will become orientation and
		prioritisation only; record management and governed actions will live in focused workspaces.
	</p>

	<div class="foundation-grid" aria-label="V2 foundation">
		<article class="nb-card">
			<span>01</span>
			<h2>My work</h2>
			<p>One governed queue for work requiring attention, decisions or follow-up.</p>
			<a href={`/${data.tenant.slug}/my-work`}>Open My work</a>
		</article>
		<article class="nb-card">
			<span>02</span>
			<h2>Functions</h2>
			<p>The canonical F01–F29 business-function directory, independent of backend module boundaries.</p>
			<a href={`/${data.tenant.slug}/functions`}>Open function directory</a>
		</article>
	</div>
</section>

<style>
	.dashboard h1 {
		margin: 0 0 16px;
		font-size: clamp(2.2rem, 5vw, 4.2rem);
		line-height: 1;
		letter-spacing: -0.055em;
	}

	.foundation-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px;
		margin-top: 48px;
	}

	article {
		padding: 24px;
	}

	article > span {
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--nb-muted);
	}

	article h2 {
		margin: 24px 0 8px;
		font-size: 1.25rem;
	}

	article p {
		margin: 0 0 24px;
		line-height: 1.6;
		color: var(--nb-muted);
	}

	article a {
		font-weight: 750;
		text-decoration: none;
	}

	@media (max-width: 700px) {
		.foundation-grid {
			grid-template-columns: 1fr;
			margin-top: 36px;
		}
	}
</style>
