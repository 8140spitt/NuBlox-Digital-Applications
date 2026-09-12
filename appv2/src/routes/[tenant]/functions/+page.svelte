<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page">
	<p class="nb-eyebrow">{data.tenant.slug} · Enterprise functions</p>
	<h1>Function directory</h1>
	<p class="nb-lede">
		F01–F29 will be the stable business information architecture for NuBlox V2. Functions will be
		introduced here only after their user journey, primary records, lifecycle, cross-functional
		handoffs and focused action surfaces have been defined.
	</p>
</section>

<style>
	h1 {
		margin: 0 0 16px;
		font-size: clamp(2rem, 5vw, 3.4rem);
		letter-spacing: -0.045em;
	}
</style>
