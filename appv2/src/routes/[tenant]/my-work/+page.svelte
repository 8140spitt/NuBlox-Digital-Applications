<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page">
	<p class="nb-eyebrow">{data.tenant.slug} · Work</p>
	<h1>My work</h1>
	<p class="nb-lede">
		This will be the cross-functional inbox for governed work, approvals, decisions and exceptions.
		V2 will add work types only when their source record, state, next action and downstream consequence
		are explicit.
	</p>
</section>

<style>
	h1 {
		margin: 0 0 16px;
		font-size: clamp(2rem, 5vw, 3.4rem);
		letter-spacing: -0.045em;
	}
</style>
