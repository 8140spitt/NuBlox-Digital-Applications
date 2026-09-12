<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page">
	<p class="nb-eyebrow">{data.party.slug} · External work</p>
	<h1>Actions</h1>
	<p class="nb-lede">
		This will be the bounded external inbox for work explicitly granted to this party relationship.
		Each item must resolve back to a canonical NuBlox record and an authorised action.
	</p>
</section>

<style>
	h1 {
		margin: 0 0 16px;
		font-size: clamp(2rem, 5vw, 3.4rem);
		letter-spacing: -0.045em;
	}
</style>
