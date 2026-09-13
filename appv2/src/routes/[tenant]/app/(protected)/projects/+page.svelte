<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page projects-page">
	<p class="nb-eyebrow">{data.tenant.slug} · Projects</p>
	<h1>Projects</h1>
	<p class="nb-lede">
		The tenant project portfolio belongs here. Projects are canonical NuBlox contexts that connect
		internal teams, CRM Parties, records, workflows and governed actions.
	</p>
	<div class="empty-state">
		<strong>Project source not connected yet</strong>
		<p>V2 will connect the canonical project model here as the project workspace is rebuilt.</p>
	</div>
</section>

<style>
	.projects-page {
		display: grid;
		gap: 22px;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.4rem);
		letter-spacing: -0.045em;
	}
	.empty-state {
		margin-top: 16px;
		padding: 28px;
		border: 1px solid var(--nb-border);
		border-radius: 14px;
		background: var(--nb-surface);
	}
	.empty-state p {
		margin: 8px 0 0;
		color: var(--nb-muted);
	}
</style>
