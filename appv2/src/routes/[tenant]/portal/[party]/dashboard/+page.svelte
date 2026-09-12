<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page">
	<p class="nb-eyebrow">External relationship workspace</p>
	<h1>{data.party.slug}</h1>
	<p class="nb-lede">
		You are in {data.tenant.slug}'s portal for the {data.party.slug} relationship. V2 will expose only
		granted records and actions here; the URL identifies context but never grants authority.
	</p>
</section>

<style>
	h1 {
		margin: 0 0 16px;
		font-size: clamp(2.2rem, 5vw, 4.2rem);
		line-height: 1;
		letter-spacing: -0.055em;
	}
</style>
