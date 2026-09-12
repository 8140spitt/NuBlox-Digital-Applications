<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<section class="nb-page reset-entry">
	<p class="nb-eyebrow">NuBlox V2</p>
	<h1>One platform. Two connected application surfaces.</h1>
	<p class="nb-lede">
		The internal NuBlox operating system lives under /app. CRM Parties participate in authorised
		projects and business actions through the connected /portal surface over the same canonical
		data. Every identity enters through the single /auth boundary, and its authorised context is
		resolved after authentication.
	</p>

	<div class="entry-actions">
		<a class="nb-action" href={resolve('/auth/start')}>Access NuBlox</a>
		<a href={resolve('/auth')}>Sign in</a>
	</div>
</section>

<style>
	.reset-entry {
		padding-top: clamp(72px, 12vw, 150px);
	}

	h1 {
		max-width: 900px;
		margin: 0 0 22px;
		font-size: clamp(3rem, 8vw, 6.8rem);
		line-height: 0.94;
		letter-spacing: -0.065em;
	}

	.entry-actions {
		display: flex;
		align-items: center;
		gap: 18px;
		margin-top: 40px;
	}

	.entry-actions > a:not(.nb-action) {
		font-weight: 700;
		text-decoration: none;
	}

	@media (max-width: 600px) {
		.entry-actions {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
