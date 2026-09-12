<section class="nb-page reset-entry">
	<p class="nb-eyebrow">NuBlox V2</p>
	<h1>A clean operating-system reset.</h1>
	<p class="nb-lede">
		V2 is being rebuilt around stable tenant context, the F01–F29 enterprise-function model and
		focused end-to-end workflows. V1 remains available as reference, not as the interface blueprint.
	</p>

	<div class="entry-actions">
		<a class="nb-action" href="/nublox/dashboard">Open tenant shell</a>
		<a href="/nublox/portal/perspectivebc/login">Open portal route example</a>
	</div>
</section>

<style>
	.reset-entry {
		padding-top: clamp(72px, 12vw, 150px);
	}

	h1 {
		max-width: 820px;
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
