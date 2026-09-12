<script lang="ts">
	import { resolve } from '$app/paths';
	import { routes } from '$lib/routing/route-contract';
	let { data } = $props();
</script>

<section class="nb-page portal-dashboard">
	<p class="nb-eyebrow">CRM Party project participation</p>
	<h1>{data.crmParty.slug}</h1>
	<p class="nb-lede">
		This connected portal gives the CRM Party a controlled view of projects it is associated with
		inside {data.tenant.displayName}, together with the project actions it is authorised to perform.
	</p>
	<div class="portal-actions">
		<a class="nb-action" href={resolve(routes.portalProjects(data.tenant.slug, data.crmParty.slug))}>View associated projects</a>
		<a href={resolve(routes.portalActions(data.tenant.slug, data.crmParty.slug))}>View CRM Party actions</a>
	</div>
	<p class="authority-note">The URL establishes context only. Server-side identity, CRM Party membership, tenant relationship, project association and action authority must all succeed before data is exposed.</p>
</section>

<style>
	.portal-dashboard { display: grid; gap: 20px; }
	h1 { margin: 0; font-size: clamp(2.2rem, 5vw, 4.2rem); line-height: 1; letter-spacing: -0.055em; }
	.portal-actions { display: flex; align-items: center; gap: 18px; margin-top: 12px; }
	.portal-actions a:not(.nb-action) { font-weight: 700; text-decoration: none; }
	.authority-note { max-width: 850px; margin-top: 20px; color: var(--nb-muted); font-size: 0.86rem; line-height: 1.6; }
</style>
