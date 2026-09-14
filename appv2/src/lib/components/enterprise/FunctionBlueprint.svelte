<script lang="ts">
	import type { FunctionJourneyStep } from '$lib/enterprise/function-business-journeys';

	type FunctionSummary = {
		id: string;
		name: string;
		purpose: string;
	};

	type SubfunctionSummary = {
		id: string;
		name: string;
		purpose?: string;
		metric?: string;
		state?: string;
	};

	type ObjectSummary = {
		name: string;
		pattern?: string;
	};

	let {
		functionSummary,
		subfunctions,
		objects,
		journey,
		statusLabel = 'Capability blueprint'
	}: {
		functionSummary: FunctionSummary;
		subfunctions: readonly SubfunctionSummary[];
		objects: readonly ObjectSummary[];
		journey: readonly FunctionJourneyStep[];
		statusLabel?: string;
	} = $props();

	const visibleObjects = $derived(objects.slice(0, 8));
	const remainingObjects = $derived(Math.max(0, objects.length - visibleObjects.length));
</script>

<section class="function-blueprint" aria-labelledby="function-blueprint-title">
	<div class="function-board">
		<header class="function-banner">
			<div class="function-mark" aria-hidden="true">{functionSummary.id}</div>
			<div class="function-title-copy">
				<div class="function-kicker">
					<span>{functionSummary.id}</span>
					<span class="status-pill">{statusLabel}</span>
				</div>
				<h2 id="function-blueprint-title">{functionSummary.name}</h2>
				<p>{functionSummary.purpose}</p>
			</div>
			<aside class="object-summary" aria-label={`${functionSummary.id} canonical objects`}>
				<span class="section-label">Objects</span>
				<div class="object-list">
					{#each visibleObjects as object (object.name)}
						<span>{object.name}</span>
					{/each}
					{#if remainingObjects > 0}<strong>+{remainingObjects} more</strong>{/if}
				</div>
			</aside>
		</header>

		<div class="subfunction-grid" aria-label={`${functionSummary.id} sub-functions`}>
			{#each subfunctions as subfunction (subfunction.id)}
				<article class="subfunction-card">
					<div class="subfunction-id">{subfunction.id}</div>
					<h3>{subfunction.name}</h3>
					{#if subfunction.purpose}<p>{subfunction.purpose}</p>{/if}
					{#if subfunction.metric}<strong>{subfunction.metric}</strong>{/if}
					{#if subfunction.state}<span class="subfunction-state">{subfunction.state}</span>{/if}
				</article>
			{/each}
		</div>
	</div>

	<section class="journey-band" aria-labelledby={`${functionSummary.id}-journey`}>
		<div class="band-heading">
			<div>
				<span class="section-label">Business process</span>
				<h3 id={`${functionSummary.id}-journey`}>User journey</h3>
			</div>
			<p>The business journey is primary. Lifecycle and workflow services operate underneath it.</p>
		</div>
		<ol class="journey-grid">
			{#each journey as step, index (`${step.label}-${index}`)}
				<li>
					<div class="journey-step-number">{index + 1}</div>
					<div>
						<strong>{step.label}</strong>
						<p>{step.detail}</p>
					</div>
				</li>
			{/each}
		</ol>
	</section>

	<section class="platform-band" aria-labelledby={`${functionSummary.id}-platform`}>
		<div class="band-heading">
			<div>
				<span class="section-label">Platform services</span>
				<h3 id={`${functionSummary.id}-platform`}>Underpinning controls</h3>
			</div>
			<p>These services stay consistent across all 29 enterprise functions.</p>
		</div>
		<div class="service-grid">
			<article><strong>Object registry</strong><span>Canonical business records and ownership.</span></article>
			<article><strong>Lifecycle</strong><span>States, transitions and business rules.</span></article>
			<article><strong>Workflow</strong><span>Reviews, approvals and accountable hand-offs.</span></article>
			<article><strong>Permissions</strong><span>Role, position, team and separation-of-duty control.</span></article>
			<article><strong>Version control</strong><span>Controlled revisions and immutable published evidence.</span></article>
			<article><strong>Audit & evidence</strong><span>Decisions, changes, provenance and history.</span></article>
		</div>
	</section>

	<section class="data-band" aria-labelledby={`${functionSummary.id}-data`}>
		<div class="band-heading">
			<div>
				<span class="section-label">Integration & data</span>
				<h3 id={`${functionSummary.id}-data`}>Connected enterprise context</h3>
			</div>
		</div>
		<div class="data-grid">
			<article><strong>Internal data</strong><span>Trusted records from connected NuBlox domains.</span></article>
			<article><strong>External data</strong><span>Market, regulatory, partner and specialist sources.</span></article>
			<article><strong>Analytics & reporting</strong><span>Measures, dashboards, insight and decision support.</span></article>
			<article><strong>APIs & ecosystem</strong><span>Controlled exchange with external enterprise systems.</span></article>
		</div>
	</section>
</section>

<style>
	.function-blueprint {
		display: grid;
		gap: var(--nb-space-4);
	}

	.function-board,
	.journey-band,
	.platform-band,
	.data-band {
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-xl);
		overflow: hidden;
	}

	.function-board {
		background: linear-gradient(180deg, color-mix(in srgb, var(--nb-blue-95) 72%, white), white);
		border-color: var(--nb-blue-80);
	}

	.function-banner {
		display: grid;
		grid-template-columns: 72px minmax(0, 1fr) minmax(210px, 300px);
		gap: var(--nb-space-5);
		align-items: start;
		padding: var(--nb-space-6);
	}

	.function-mark {
		display: grid;
		place-items: center;
		min-height: 64px;
		border-radius: var(--nb-radius-lg);
		background: var(--nb-blue-10);
		color: white;
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-bold);
		letter-spacing: 0.08em;
	}

	.function-kicker {
		display: flex;
		align-items: center;
		gap: var(--nb-space-3);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.status-pill {
		padding: 4px 8px;
		border: 1px solid var(--nb-blue-70);
		border-radius: 999px;
		background: color-mix(in srgb, var(--nb-blue-95) 65%, white);
		color: var(--nb-blue-20);
		letter-spacing: 0;
		text-transform: none;
	}

	.function-title-copy h2 {
		margin: var(--nb-space-2) 0 var(--nb-space-2);
		font-size: clamp(1.6rem, 3vw, 2.35rem);
		letter-spacing: -0.035em;
	}

	.function-title-copy p,
	.band-heading p,
	.subfunction-card p,
	.journey-grid p,
	.service-grid span,
	.data-grid span {
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}

	.function-title-copy p {
		max-width: 760px;
		margin: 0;
	}

	.object-summary {
		display: grid;
		gap: var(--nb-space-3);
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-blue-80);
		border-radius: var(--nb-radius-lg);
		background: color-mix(in srgb, white 88%, var(--nb-blue-95));
	}

	.section-label {
		color: var(--nb-color-text-muted);
		font-size: 0.68rem;
		font-weight: var(--nb-weight-bold);
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

	.object-list {
		display: grid;
		gap: 4px;
		font-size: var(--nb-font-size-xs);
	}

	.object-list strong {
		margin-top: var(--nb-space-1);
		color: var(--nb-blue-20);
	}

	.subfunction-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
		gap: var(--nb-space-3);
		padding: 0 var(--nb-space-5) var(--nb-space-5);
	}

	.subfunction-card {
		position: relative;
		display: grid;
		align-content: start;
		gap: var(--nb-space-2);
		min-height: 148px;
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-blue-80);
		border-radius: var(--nb-radius-lg);
		background: rgba(255, 255, 255, 0.88);
		box-shadow: 0 1px 0 rgba(12, 52, 82, 0.04);
	}

	.subfunction-card::before {
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
		border-radius: var(--nb-radius-lg) 0 0 var(--nb-radius-lg);
		background: var(--nb-blue-30);
		content: '';
	}

	.subfunction-id {
		color: var(--nb-blue-20);
		font-size: 0.68rem;
		font-weight: var(--nb-weight-bold);
		letter-spacing: 0.05em;
	}

	.subfunction-card h3,
	.band-heading h3 {
		margin: 0;
	}

	.subfunction-card h3 {
		font-size: var(--nb-font-size-sm);
		line-height: 1.35;
	}

	.subfunction-card p {
		margin: 0;
		font-size: var(--nb-font-size-xs);
	}

	.subfunction-card strong,
	.subfunction-state {
		margin-top: auto;
		color: var(--nb-color-text-muted);
		font-size: 0.7rem;
	}

	.journey-band {
		padding: var(--nb-space-5);
		border-color: #f0c78c;
		background: linear-gradient(180deg, #fff7ea, #fffaf3);
	}

	.platform-band {
		padding: var(--nb-space-5);
		border-color: #a7d8b3;
		background: linear-gradient(180deg, #edf9ef, #f7fcf8);
	}

	.data-band {
		padding: var(--nb-space-5);
		border-color: #c8b8ef;
		background: linear-gradient(180deg, #f5f0ff, #fbf9ff);
	}

	.band-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--nb-space-6);
		margin-bottom: var(--nb-space-4);
	}

	.band-heading h3 {
		margin-top: var(--nb-space-1);
		font-size: var(--nb-font-size-lg);
	}

	.band-heading p {
		max-width: 560px;
		margin: 0;
		font-size: var(--nb-font-size-xs);
	}

	.journey-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: var(--nb-space-3);
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: step;
	}

	.journey-grid li {
		position: relative;
		display: grid;
		grid-template-columns: 30px minmax(0, 1fr);
		gap: var(--nb-space-3);
		padding: var(--nb-space-4);
		border: 1px solid #ecc17f;
		border-radius: var(--nb-radius-lg);
		background: rgba(255, 255, 255, 0.82);
	}

	.journey-step-number {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #f3a83c;
		color: #412600;
		font-size: 0.72rem;
		font-weight: var(--nb-weight-bold);
	}

	.journey-grid p {
		margin: var(--nb-space-1) 0 0;
		font-size: var(--nb-font-size-xs);
	}

	.service-grid,
	.data-grid {
		display: grid;
		gap: var(--nb-space-3);
	}

	.service-grid {
		grid-template-columns: repeat(6, minmax(0, 1fr));
	}

	.data-grid {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.service-grid article,
	.data-grid article {
		display: grid;
		gap: var(--nb-space-2);
		min-width: 0;
		padding: var(--nb-space-4);
		border-radius: var(--nb-radius-lg);
		background: rgba(255, 255, 255, 0.78);
	}

	.service-grid article {
		border: 1px solid #b7ddc0;
	}

	.data-grid article {
		border: 1px solid #d4c8ef;
	}

	.service-grid strong,
	.data-grid strong {
		font-size: var(--nb-font-size-sm);
	}

	.service-grid span,
	.data-grid span {
		font-size: var(--nb-font-size-xs);
	}

	@media (max-width: 1100px) {
		.function-banner {
			grid-template-columns: 64px minmax(0, 1fr);
		}

		.object-summary {
			grid-column: 1 / -1;
		}

		.object-list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.service-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 760px) {
		.function-banner {
			grid-template-columns: 1fr;
		}

		.function-mark {
			width: 64px;
		}

		.object-list,
		.service-grid,
		.data-grid {
			grid-template-columns: 1fr;
		}

		.band-heading {
			align-items: start;
			flex-direction: column;
			gap: var(--nb-space-2);
		}
	}
</style>
