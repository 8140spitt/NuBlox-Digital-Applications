<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page projects-page">
	<p class="nb-eyebrow">{data.crmParty.slug} · Project participation</p>
	<h1>Associated projects</h1>
	<p class="nb-lede">
		Only projects with an authorised CRM Party association belong in this view. Project visibility
		is derived from the CRM Party relationship; knowing a project URL must never grant access.
	</p>
	<div class="empty-state">
		<strong>No project associations are connected to V2 yet.</strong>
		<p>
			When the canonical CRM Party ↔ project relationship is connected, authorised projects will
			appear here.
		</p>
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
		background: white;
	}
	.empty-state p {
		margin: 8px 0 0;
		color: var(--nb-muted);
	}
</style>
