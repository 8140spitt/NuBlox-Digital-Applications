<script lang="ts">
	import {
		Breadcrumbs,
		LinkButton,
		PageHeader,
		Panel,
		Stat,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';

	let { data } = $props();

	const workspace = $derived(data.workspace);
	const focusFramework = $derived(
		workspace.activeFramework ?? workspace.draftFrameworks[0] ?? null
	);

	function horizon(start: string, end: string): string {
		return `${start.slice(0, 4)}–${end.slice(0, 4)}`;
	}

	function lifecycleLabel(status: 'draft' | 'approved' | 'superseded'): string {
		if (status === 'approved') return 'Approved';
		if (status === 'superseded') return 'Superseded';
		return 'Draft';
	}

	function lifecycleTone(
		status: 'draft' | 'approved' | 'superseded'
	): 'warning' | 'success' | 'neutral' {
		if (status === 'approved') return 'success';
		if (status === 'superseded') return 'neutral';
		return 'warning';
	}

	const workstreams = $derived(
		focusFramework
			? [
					{
						id: 'F01.01',
						name: 'Vision & purpose',
						detail: 'Purpose, vision and mission define the strategic direction.',
						metric: 'Direction defined',
						state: 'ready'
					},
					{
						id: 'F01.02',
						name: 'Environmental analysis',
						detail: 'Evidence-led internal and external factors, assumptions and implications.',
						metric: `${focusFramework.environmentFactorCount} factors`,
						state: focusFramework.environmentFactorCount > 0 ? 'active' : 'ready'
					},
					{
						id: 'F01.03',
						name: 'Strategic planning',
						detail:
							'Options, choices and accountable objectives translate direction into outcomes.',
						metric: `${focusFramework.objectiveCount} objectives`,
						state: focusFramework.objectiveCount > 0 ? 'active' : 'ready'
					},
					{
						id: 'F01.04',
						name: 'Business planning',
						detail:
							'Plans, initiatives, investment and resource envelopes connect strategy to delivery.',
						metric: `${focusFramework.businessPlanCount} plans · ${focusFramework.initiativeCount} initiatives`,
						state: focusFramework.businessPlanCount > 0 ? 'active' : 'ready'
					},
					{
						id: 'F01.05',
						name: 'Operating model',
						detail:
							'Capabilities, organisation, process, information and technology move to target state.',
						metric: `${focusFramework.operatingModelComponentCount} components`,
						state: focusFramework.operatingModelComponentCount > 0 ? 'active' : 'ready'
					},
					{
						id: 'F01.06',
						name: 'Goal & KPI management',
						detail:
							'Targets and authoritative actuals show whether strategic outcomes are being realised.',
						metric: `${focusFramework.kpiCount} KPIs`,
						state: focusFramework.kpiCount > 0 ? 'active' : 'ready'
					},
					{
						id: 'F01.07',
						name: 'Strategic review',
						detail:
							'Evidence, variance, decisions and corrective action close the management loop.',
						metric: `${focusFramework.reviewCount} reviews`,
						state: focusFramework.reviewCount > 0 ? 'active' : 'ready'
					},
					{
						id: 'F01.08',
						name: 'Scenario & foresight',
						detail: 'Alternative futures test assumptions, resilience and strategic choices.',
						metric: `${focusFramework.scenarioCount} scenarios`,
						state: focusFramework.scenarioCount > 0 ? 'active' : 'ready'
					}
				]
			: []
	);
</script>

<svelte:head>
	<title>Strategy & Enterprise Planning · NuBlox</title>
	<meta
		name="description"
		content="F01 Strategy & Enterprise Planning — direction, planning, operating model, performance, review and foresight in one governed enterprise thread."
	/>
</svelte:head>

{#snippet headerActions()}
	{#if workspace.permissions.canManage}
		<LinkButton href={routes.strategyNew(data.tenant.slug)}>Create strategy</LinkButton>
	{/if}
{/snippet}

{#snippet headerMeta()}
	<div class="header-meta">
		<span>{data.tenant.displayName}</span>
		<span aria-hidden="true">·</span>
		<span>F01.01–F01.08</span>
		{#if workspace.permissions.canApprove}
			<span aria-hidden="true">·</span>
			<span>Approval authority</span>
		{/if}
	</div>
{/snippet}

<div class="nb-page-wide strategy-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(data.tenant.slug) },
			{ label: 'Functions', href: routes.functions(data.tenant.slug) },
			{ label: 'F01 Strategy & Enterprise Planning' }
		]}
	/>

	<PageHeader
		eyebrow="F01 · Strategy & Enterprise Planning"
		title="Turn direction into governed enterprise outcomes"
		description="Set strategic direction, understand the environment, make choices, fund the plan, shape the operating model and close the loop through evidence, performance and foresight."
		actions={headerActions}
		meta={headerMeta}
	/>

	{#if focusFramework}
		<section class="strategy-focus" aria-labelledby="strategy-focus-title">
			<div class="focus-copy">
				<div class="focus-kicker">
					<StatusBadge
						label={lifecycleLabel(focusFramework.lifecycleStatus)}
						tone={lifecycleTone(focusFramework.lifecycleStatus)}
					/>
					<span>{focusFramework.code} · v{focusFramework.versionNumber}</span>
				</div>
				<h2 id="strategy-focus-title">{focusFramework.title}</h2>
				<p class="vision">{focusFramework.vision}</p>
				<div class="focus-meta">
					<span>Horizon {horizon(focusFramework.horizonStart, focusFramework.horizonEnd)}</span>
					{#if focusFramework.isOwnedByCurrentMember}<span>Owned by you</span>{/if}
				</div>
			</div>
			<LinkButton
				href={routes.strategyFramework(data.tenant.slug, focusFramework.publicId)}
				variant="secondary">Open strategy workspace</LinkButton
			>
		</section>

		<section class="stat-grid" aria-label="Strategy progress">
			<Stat
				label="Objectives"
				value={String(focusFramework.objectiveCount)}
				detail="Strategic outcomes"
				tone="info"
			/>
			<Stat
				label="Initiatives"
				value={String(focusFramework.initiativeCount)}
				detail="Open delivery commitments"
			/>
			<Stat label="KPIs" value={String(focusFramework.kpiCount)} detail="Outcome measures" />
			<Stat
				label="Scenarios"
				value={String(focusFramework.scenarioCount)}
				detail="Alternative futures"
			/>
		</section>

		<section class="workstream-section" aria-labelledby="workstreams-title">
			<div class="section-heading">
				<div>
					<p class="section-kicker">Continuous strategic thread</p>
					<h2 id="workstreams-title">Eight sub-functions, one management system</h2>
				</div>
				<p>
					Each area contributes to the same strategy record. NuBlox does not split direction, plans,
					performance and foresight into disconnected applications.
				</p>
			</div>

			<div class="workstream-grid">
				{#each workstreams as workstream (workstream.id)}
					<article class:active={workstream.state === 'active'}>
						<div class="workstream-heading">
							<span>{workstream.id}</span>
							<span class="workstream-state">
								{workstream.state === 'active' ? 'In use' : 'Ready'}
							</span>
						</div>
						<h3>{workstream.name}</h3>
						<p>{workstream.detail}</p>
						<strong>{workstream.metric}</strong>
					</article>
				{/each}
			</div>
		</section>

		<Panel
			title="Strategy cycles and controlled versions"
			description="Approved strategy remains immutable evidence. New direction is introduced through a controlled strategy cycle or revision rather than editing history in place."
		>
			<div class="cycle-list">
				{#each workspace.frameworks as framework (framework.publicId)}
					<a href={resolve(routes.strategyFramework(data.tenant.slug, framework.publicId))}>
						<div class="cycle-primary">
							<span class="cycle-code">{framework.code} · v{framework.versionNumber}</span>
							<strong>{framework.title}</strong>
							<span>{horizon(framework.horizonStart, framework.horizonEnd)}</span>
						</div>
						<div class="cycle-status">
							<StatusBadge
								label={lifecycleLabel(framework.lifecycleStatus)}
								tone={lifecycleTone(framework.lifecycleStatus)}
							/>
							<span>{framework.objectiveCount} objectives · {framework.kpiCount} KPIs</span>
						</div>
					</a>
				{/each}
			</div>
		</Panel>
	{:else}
		<section class="start-strategy" aria-labelledby="start-strategy-title">
			<div class="start-copy">
				<p class="section-kicker">No strategy cycle yet</p>
				<h2 id="start-strategy-title">Build the strategic thread from a clear direction.</h2>
				<p>
					Start with purpose, vision and planning horizon. NuBlox will use that strategy cycle as
					the governed context for environmental evidence, strategic choices, objectives, plans,
					operating model changes, KPIs, reviews and scenarios.
				</p>
				{#if workspace.permissions.canManage}
					<LinkButton href={routes.strategyNew(data.tenant.slug)}>Create first strategy</LinkButton>
				{:else}
					<p class="read-only-note">
						You have view access. A strategy manager must create the first cycle.
					</p>
				{/if}
			</div>
			<ol class="strategic-thread" aria-label="Strategy operating thread">
				<li><span>01</span><strong>Direction</strong><small>Purpose · vision · horizon</small></li>
				<li>
					<span>02</span><strong>Choice</strong><small>Evidence · options · objectives</small>
				</li>
				<li>
					<span>03</span><strong>Execution</strong><small>Plan · investment · operating model</small
					>
				</li>
				<li><span>04</span><strong>Learning</strong><small>KPI · review · scenario</small></li>
			</ol>
		</section>
	{/if}
</div>

<style>
	.strategy-page {
		display: grid;
		gap: var(--nb-space-8);
	}

	.header-meta,
	.focus-kicker,
	.focus-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}

	.strategy-focus {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--nb-space-8);
		padding: clamp(24px, 4vw, 42px);
		border: 1px solid var(--nb-blue-80);
		border-radius: var(--nb-radius-xl);
		background:
			linear-gradient(135deg, color-mix(in srgb, var(--nb-blue-95) 72%, white), transparent 70%),
			var(--nb-color-bg-surface);
	}

	.focus-copy {
		max-width: 850px;
	}

	.strategy-focus h2,
	.start-copy h2 {
		margin: var(--nb-space-4) 0 0;
		font-size: clamp(1.8rem, 4vw, 3.1rem);
		line-height: 1.04;
		letter-spacing: -0.045em;
	}

	.vision {
		max-width: 780px;
		margin: var(--nb-space-4) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: clamp(1rem, 2vw, 1.2rem);
		line-height: var(--nb-line-relaxed);
	}

	.focus-meta {
		margin-top: var(--nb-space-5);
		gap: var(--nb-space-5);
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-5);
		padding-block: var(--nb-space-3);
	}

	.workstream-section {
		display: grid;
		gap: var(--nb-space-5);
	}

	.section-heading {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(280px, 520px);
		gap: var(--nb-space-8);
		align-items: end;
	}

	.section-heading h2 {
		margin: var(--nb-space-1) 0 0;
		font-size: var(--nb-font-size-2xl);
		letter-spacing: -0.03em;
	}

	.section-heading > p,
	.start-copy > p:not(.section-kicker):not(.read-only-note) {
		margin: 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}

	.section-kicker {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.workstream-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border-top: 1px solid var(--nb-color-border-default);
		border-left: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		overflow: hidden;
	}

	.workstream-grid article {
		display: flex;
		min-height: 210px;
		flex-direction: column;
		padding: var(--nb-space-5);
		border-right: 1px solid var(--nb-color-border-default);
		border-bottom: 1px solid var(--nb-color-border-default);
		background: var(--nb-color-bg-surface);
	}

	.workstream-grid article.active {
		background: color-mix(in srgb, var(--nb-blue-95) 45%, var(--nb-color-bg-surface));
	}

	.workstream-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-3);
		color: var(--nb-color-text-muted);
		font-size: 0.68rem;
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.workstream-state {
		letter-spacing: 0;
		text-transform: none;
	}

	.workstream-grid h3 {
		margin: var(--nb-space-6) 0 var(--nb-space-2);
		font-size: var(--nb-font-size-md);
		letter-spacing: -0.015em;
	}

	.workstream-grid p {
		margin: 0 0 var(--nb-space-5);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		line-height: var(--nb-line-relaxed);
	}

	.workstream-grid strong {
		margin-top: auto;
		font-size: var(--nb-font-size-xs);
	}

	.cycle-list {
		display: grid;
		margin-inline: calc(var(--nb-space-5) * -1);
		border-top: 1px solid var(--nb-color-border-subtle);
	}

	.cycle-list a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-5);
		padding: var(--nb-space-4) var(--nb-space-5);
		border-bottom: 1px solid var(--nb-color-border-subtle);
		color: inherit;
		text-decoration: none;
	}

	.cycle-list a:hover {
		background: var(--nb-color-bg-subtle);
	}

	.cycle-primary,
	.cycle-status {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--nb-space-3);
	}

	.cycle-primary > span,
	.cycle-status > span {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}

	.cycle-code {
		font-variant-numeric: tabular-nums;
	}

	.start-strategy {
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
		gap: clamp(32px, 7vw, 90px);
		align-items: center;
		min-height: 520px;
		padding: clamp(28px, 5vw, 64px);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-xl);
		background: var(--nb-color-bg-surface);
	}

	.start-copy > p:not(.section-kicker):not(.read-only-note) {
		max-width: 720px;
		margin-top: var(--nb-space-5);
	}

	.start-copy :global(.nb-link-button) {
		margin-top: var(--nb-space-6);
	}

	.read-only-note {
		margin: var(--nb-space-6) 0 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
	}

	.strategic-thread {
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--nb-color-border-default);
		list-style: none;
	}

	.strategic-thread li {
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr);
		gap: 2px var(--nb-space-3);
		padding: var(--nb-space-4) 0;
		border-bottom: 1px solid var(--nb-color-border-default);
	}

	.strategic-thread li > span {
		grid-row: 1 / 3;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
	}

	.strategic-thread strong {
		font-size: var(--nb-font-size-sm);
	}

	.strategic-thread small {
		color: var(--nb-color-text-muted);
	}

	@media (max-width: 1050px) {
		.workstream-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 820px) {
		.strategy-focus,
		.cycle-list a {
			align-items: flex-start;
			flex-direction: column;
		}

		.stat-grid,
		.section-heading,
		.start-strategy {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 600px) {
		.workstream-grid,
		.stat-grid {
			grid-template-columns: 1fr;
		}

		.start-strategy {
			min-height: 0;
			padding: var(--nb-space-6);
		}
	}
</style>
