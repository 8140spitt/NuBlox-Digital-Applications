<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page login-surface">
	<div>
		<p class="nb-eyebrow">CRM Party access</p>
		<h1>Sign in to {data.tenant.displayName}'s portal</h1>
		<p class="nb-lede">
			Authentication establishes the external identity. Portal access must then resolve that
			identity to an authorised contact of {data.crmParty.slug}, validate the tenant relationship,
			and derive project visibility and actions from that CRM Party association.
		</p>
	</div>
</section>

<style>
	.login-surface {
		display: grid;
		grid-template-columns: minmax(0, 720px);
	}
	h1 {
		margin: 0 0 16px;
		font-size: clamp(2rem, 5vw, 3.4rem);
		letter-spacing: -0.045em;
	}
</style>
