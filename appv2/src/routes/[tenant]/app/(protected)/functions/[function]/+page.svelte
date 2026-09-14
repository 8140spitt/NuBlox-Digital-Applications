<script lang="ts">
	import { Breadcrumbs } from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';

	let { data } = $props();
	const blueprint = $derived(data.blueprint);

	const platformServices = [
		{
			name: 'Object registry',
			detail: 'Defines the governed business records used by this function.'
		},
		{
			name: 'Lifecycle',
			detail: 'Controls valid states, transitions and business rules.'
		},
		{
			name: 'Workflow',
			detail: 'Orchestrates reviews, approvals, hand-offs and work.'
		},
		{
			name: 'Roles & permissions',
			detail: 'Connects organisation positions, people and access authority.'
		},
		{
			name: 'Version control',
			detail: 'Preserves controlled revisions and published versions.'
		},
		{
			name: 'Audit & evidence',
			detail: 'Records decisions, changes, evidence and history.'
		}
	] as const;
</script>

<svelte:head>
	<title>{blueprint.id} {blueprint.name} · NuBlox</title>
	<meta name="description" content={blueprint.purpose} />
</svelte:head>

<div class="nb-page-wide function-blueprint-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(data.tenant.slug) },
			{ label: 'Functions', href: routes.functions(data.tenant.slug) },
			{ label: `${blueprint.id} ${blueprint.name}` }
		]}
	/>

	<section class="function-map" aria-labelledby="function-map-title">
		<header class="function-hero">
			<div class="function-mark" aria-hidden="true">{blueprint.id}</div>
			<div class="hero-copy">
				<p class="nb-eyebrow">Enterprise function</p>
				<h1 id="function-map-title">{blueprint.name}</h1>
				<p>{blueprint.purpose}</p>
			</div>
			<div class="hero-objects">
				<span>Canonical objects</span>
				<ul>
					{#each blueprint.objects.slice(0, 7) as object (object.objectType)}
						<li>{object.name}</li>
					{/each}
				</ul>
				{#if blueprint.objects.length > 7}
					<small>+ {blueprint.objects.length - 7} more in the object registry</small>
				{/if}
			</div>
		</header>

		<div class="status-line">
			<span class="status-dot"></span>
			<strong>Capability blueprint</strong>
			<span>
				This page shows the canonical NuBlox operating model. Native runtime capability is enabled
				function-by-function as it is delivered and proven.
			</span>
		</div>

		<section class="map-section subfunction-section" aria-labelledby="subfunctions-title">
			<div class="section-heading">
				<div>
					<p class="section-kicker">Business capability map</p>
					<h2 id="subfunctions-title">{blueprint.subfunctions.length} sub-functions</h2>
				</div>
				<p>Each card is anchored to the canonical enterprise taxonomy and its business activities.</p>
			</div>

			<div class="subfunction-grid">
				{#each blueprint.subfunctions as subfunction (subfunction.id)}
					<article class="subfunction-card">
						<div class="subfunction-code">{subfunction.id}</div>
						<h3>{subfunction.name}</h3>
						<ul>
							{#each subfunction.activities.slice(0, 5) as activity (activity)}
								<li>{activity}</li>
							{/each}
						</ul>
						{#if subfunction.activities.length > 5}
							<small>+ {subfunction.activities.length - 5} more activities</small>
						{/if}
					</article>
				{/each}
			</div>
		</section>

		<section class="map-section journey-section" aria-labelledby="journey-title">
			<div class="section-heading">
				<div>
					<p class="section-kicker">Business process</p>
					<h2 id="journey-title">Operating journey</h2>
				</div>
				<p>A concise view of how the function progresses from intent through governed outcomes.</p>
			</div>

			<div class="journey-flow">
				{#each blueprint.journey as step, index (step.id)}
					<article class="journey-step">
						<div class="step-number">{String(step.step).padStart(2, '0')}</div>
						<div>
							<strong>{step.name}</strong>
							<p>{step.detail}</p>
						</div>
					</article>
					{#if index < blueprint.journey.length - 1}
						<div class="journey-arrow" aria-hidden="true">→</div>
					{/if}
				{/each}
			</div>
		</section>

		<section class="map-section platform-section" aria-labelledby="platform-title">
			<div class="section-heading">
				<div>
					<p class="section-kicker">Platform services</p>
					<h2 id="platform-title">Underpinning controls</h2>
				</div>
				<p>These services remain underneath the business experience rather than becoming the UI.</p>
			</div>

			<div class="platform-grid">
				{#each platformServices as service (service.name)}
					<article>
						<h3>{service.name}</h3>
						<p>{service.detail}</p>
					</article>
				{/each}
			</div>
		</section>

		<section class="map-section data-section" aria-labelledby="data-title">
			<div>
				<p class="section-kicker">Integration & data</p>
				<h2 id="data-title">Connected enterprise information</h2>
			</div>
			<div class="data-grid">
				<article>
					<strong>Internal data</strong>
					<span>Projects · finance · assets · people · operations</span>
				</article>
				<article>
					<strong>External data</strong>
					<span>Market · economic · regulatory · supplier</span>
				</article>
				<article>
					<strong>Analytics</strong>
					<span>KPIs · dashboards · exceptions · trends</span>
				</article>
				<article>
					<strong>APIs & ecosystem</strong>
					<span>Governed integrations and event exchange</span>
				</article>
			</div>
		</section>
	</section>

	<a class="back-link" href={resolve(routes.functions(data.tenant.slug))}>← Back to all functions</a>
</div>

<style>
	.function-blueprint-page {
		display: grid;
		gap: var(--nb-space-5);
	}

	.function-map {
		display: grid;
		gap: var(--nb-space-4);
	}

	.function-hero {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) minmax(220px, 300px);
		gap: var(--nb-space-5);
		align-items: start;
		padding: clamp(24px, 4vw, 42px);
		border: 1px solid #a8d4f4;
		border-radius: var(--nb-radius-xl);
		background: linear-gradient(135deg, #eef8ff 0%, #f8fcff 58%, #ffffff 100%);
	}

	.function-mark {
		display: grid;
		place-items: center;
		min-width: 72px;
		height: 72px;
		padding-inline: 14px;
		border-radius: 14px;
		background: #063a5b;
		color: white;
		font-weight: 800;
		letter-spacing: 0.08em;
		box-shadow: 0 8px 22px rgba(6, 58, 91, 0.16);
	}

	.hero-copy h1 {
		margin: var(--nb-space-2) 0 var(--nb-space-3);
		font-size: clamp(2rem, 5vw, 3.2rem);
		line-height: 1;
		letter-spacing: -0.045em;
	}

	.hero-copy > p:last-child {
		max-width: 760px;
		margin: 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-md);
		line-height: var(--nb-line-relaxed);
	}

	.hero-objects {
		padding: var(--nb-space-4);
		border: 1px solid #8fc9ef;
		border-radius: var(--nb-radius-lg);
		background: rgba(255, 255, 255, 0.78);
	}

	.hero-objects > span {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #164f73;
	}

	.hero-objects ul {
		display: grid;
		gap: 3px;
		margin: var(--nb-space-2) 0 0;
		padding: 0;
		list-style: none;
		font-size: var(--nb-font-size-xs);
		color: #164f73;
	}

	.hero-objects small {
		display: block;
		margin-top: var(--nb-space-2);
		color: var(--nb-color-text-muted);
	}

	.status-line {
		display: flex;
		align-items: center;
		gap: var(--nb-space-2);
		padding: var(--nb-space-3) var(--nb-space-4);
		border-radius: var(--nb-radius-lg);
		background: #f6f8fa;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-xs);
	}

	.status-line strong {
		color: var(--nb-color-text-primary);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #0a5f8c;
		box-shadow: 0 0 0 4px rgba(10, 95, 140, 0.1);
	}

	.map-section {
		padding: var(--nb-space-5);
		border-radius: var(--nb-radius-xl);
	}

	.subfunction-section {
		border: 1px solid #9ed0ef;
		background: #eef8ff;
	}

	.journey-section {
		border: 1px solid #f0c27b;
		background: #fff8ec;
	}

	.platform-section {
		border: 1px solid #a9d7b3;
		background: #f1fbf3;
	}

	.data-section {
		border: 1px solid #c6b9ec;
		background: #f6f1ff;
	}

	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--nb-space-6);
		margin-bottom: var(--nb-space-5);
	}

	.section-heading > p {
		max-width: 520px;
		margin: 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		line-height: var(--nb-line-relaxed);
	}

	.section-kicker {
		margin: 0 0 var(--nb-space-1);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--nb-color-text-muted);
	}

	.section-heading h2,
	.data-section h2 {
		margin: 0;
		font-size: clamp(1.35rem, 3vw, 2rem);
		letter-spacing: -0.035em;
	}

	.subfunction-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: var(--nb-space-3);
	}

	.subfunction-card {
		display: grid;
		align-content: start;
		gap: var(--nb-space-2);
		min-height: 225px;
		padding: var(--nb-space-4);
		border: 1px solid #b7dff7;
		border-radius: var(--nb-radius-lg);
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 5px 16px rgba(8, 68, 103, 0.04);
	}

	.subfunction-code {
		width: fit-content;
		padding: 4px 8px;
		border-radius: 999px;
		background: #e1f3ff;
		color: #07557f;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	.subfunction-card h3 {
		margin: 0;
		font-size: var(--nb-font-size-md);
	}

	.subfunction-card ul {
		display: grid;
		gap: 6px;
		margin: var(--nb-space-2) 0 0;
		padding-left: 18px;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-xs);
		line-height: 1.45;
	}

	.subfunction-card small {
		margin-top: auto;
		color: var(--nb-color-text-muted);
	}

	.journey-flow {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(220px, 1fr);
		align-items: stretch;
		gap: var(--nb-space-2);
		overflow-x: auto;
		padding-bottom: var(--nb-space-2);
	}

	.journey-step {
		display: grid;
		grid-template-columns: auto minmax(140px, 1fr);
		gap: var(--nb-space-3);
		padding: var(--nb-space-4);
		border: 1px solid #efc987;
		border-radius: var(--nb-radius-lg);
		background: white;
	}

	.step-number {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		background: #fff1d7;
		color: #875109;
		font-size: 0.7rem;
		font-weight: 800;
	}

	.journey-step strong {
		display: block;
		font-size: var(--nb-font-size-sm);
	}

	.journey-step p {
		margin: var(--nb-space-1) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: 0.75rem;
		line-height: 1.45;
	}

	.journey-arrow {
		display: none;
	}

	.platform-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--nb-space-3);
	}

	.platform-grid article {
		padding: var(--nb-space-4);
		border: 1px solid #b9dfc1;
		border-radius: var(--nb-radius-lg);
		background: white;
	}

	.platform-grid h3 {
		margin: 0;
		font-size: var(--nb-font-size-sm);
	}

	.platform-grid p {
		margin: var(--nb-space-1) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-xs);
		line-height: 1.45;
	}

	.data-section {
		display: grid;
		gap: var(--nb-space-4);
	}

	.data-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-3);
	}

	.data-grid article {
		display: grid;
		gap: 4px;
		padding: var(--nb-space-4);
		border: 1px solid #d2c8ef;
		border-radius: var(--nb-radius-lg);
		background: white;
		font-size: var(--nb-font-size-xs);
	}

	.data-grid span {
		color: var(--nb-color-text-secondary);
		line-height: 1.45;
	}

	.back-link {
		width: fit-content;
		color: var(--nb-color-action-primary);
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-semibold);
		text-decoration: none;
	}

	@media (max-width: 980px) {
		.function-hero {
			grid-template-columns: auto minmax(0, 1fr);
		}

		.hero-objects {
			grid-column: 1 / -1;
		}

		.platform-grid,
		.data-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 700px) {
		.function-hero {
			grid-template-columns: 1fr;
		}

		.function-mark {
			width: fit-content;
		}

		.section-heading,
		.status-line {
			align-items: start;
			flex-direction: column;
		}

		.platform-grid,
		.data-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
