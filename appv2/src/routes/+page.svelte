<script lang="ts">
	import { resolve } from '$app/paths';
	import { routes } from '$lib/routing/route-contract';
</script>

<section class="nb-page reset-entry">
	<p class="nb-eyebrow">NuBlox</p>
	<h1>One platform. Tenant-first access.</h1>
	<p class="nb-lede">
		New organisations begin at /start. Existing users enter through their organisation-specific
		NuBlox address, where the tenant slug establishes context before authentication and permission
		checks are applied.
	</p>

	<div class="entry-actions">
		<a class="nb-action" href={resolve(routes.start)}>Start NuBlox</a>
		<span>Existing user? Open /your-tenant/app.</span>
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
	.entry-actions span {
		color: var(--nb-muted);
		font-size: 0.88rem;
		font-weight: 650;
	}
	@media (max-width: 600px) {
		.entry-actions {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
