<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page login-surface">
	<div>
		<p class="nb-eyebrow">External access</p>
		<h1>Sign in to {data.party.slug}</h1>
		<p class="nb-lede">
			This V2 route establishes the external authentication boundary for {data.tenant.slug}. Identity,
			relationship and grant checks will be wired here without inheriting the V1 portal shell.
		</p>
	</div>
</section>

<style>
	.login-surface {
		display: grid;
		grid-template-columns: minmax(0, 640px);
	}

	h1 {
		margin: 0 0 16px;
		font-size: clamp(2rem, 5vw, 3.4rem);
		letter-spacing: -0.045em;
	}
</style>
