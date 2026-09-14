<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		LinkButton,
		Panel,
		RecordHeader,
		Stat,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const framework = $derived(data.framework);
	const readiness = $derived(data.readiness);
	const approval = $derived(data.approvalStatus);

	function statusLabel(): string {
		if (approval) return 'Under review';
		if (framework.lifecycleStatus === 'approved') return 'Active strategy';
		if (framework.lifecycleStatus === 'superseded') return 'Historical';
		return 'Working draft';
	}

	function statusTone(): 'warning' | 'success' | 'neutral' | 'info' {
		if (approval) return 'info';
		if (framework.lifecycleStatus === 'approved') return 'success';
		if (framework.lifecycleStatus === 'superseded') return 'neutral';
		return 'warning';
	}

	const readinessItems = $derived([
		{
			label: 'Strategic choice selected',
			ready: readiness.selectedOptionCount > 0,
			detail: `${readiness.selectedOptionCount} selected option${readiness.selectedOptionCount === 1 ? '' : 's'}`
		},
		{
			label: 'Strategic themes established',
			ready: readiness.activeThemeCount > 0,
			detail: `${readiness.activeThemeCount} active theme${readiness.activeThemeCount === 1 ? '' : 's'}`
		},
		{
			label: 'Objectives trace to choice and theme',
			ready:
				readiness.traceableCandidateObjectiveCount > 0 &&
				readiness.traceableCandidateObjectiveCount === readiness.approvalCandidateObjectiveCount,
			detail: `${readiness.traceableCandidateObjectiveCount}/${readiness.approvalCandidateObjectiveCount} traceable objectives`
		},
		{
			label: 'No competing approved strategy',
			ready: readiness.conflictingApprovedStrategy === null,
			detail: readiness.conflictingApprovedStrategy
				? `${readiness.conflictingApprovedStrategy.code} is currently approved`
				: 'Clear to proceed'
		}
	]);

	const areas = $derived([
		{
			id: 'F01.01',
			name: 'Direction',
			detail: 'Purpose, vision and mission',
			value: 'Defined',
			href: routes.strategyManage(
				data.tenant.slug,
				framework.publicId,
				'framework',
				framework.publicId
			)
		},
		{
			id: 'F01.02',
			name: 'Environment',
			detail: 'Evidence, factors and assumptions',
			value: `${framework.environmentFactorCount} factors`,
			href: routes.strategyAnalysis(data.tenant.slug, framework.publicId)
		},
		{
			id: 'F01.03',
			name: 'Strategic choices',
			detail: 'Options, themes and objectives',
			value: `${framework.objectiveCount} objectives`,
			href: routes.strategyPlanning(data.tenant.slug, framework.publicId)
		},
		{
			id: 'F01.04',
			name: 'Business plan',
			detail: 'Plans, initiatives and resources',
			value: `${framework.businessPlanCount} plans · ${framework.initiativeCount} initiatives`,
			href: routes.strategyBusinessPlanning(data.tenant.slug, framework.publicId)
		},
		{
			id: 'F01.05',
			name: 'Operating model',
			detail: 'Current-to-target enterprise design',
			value: `${framework.operatingModelComponentCount} components`,
			href: routes.strategyOperatingModel(data.tenant.slug, framework.publicId)
		},
		{
			id: 'F01.06',
			name: 'Performance',
			detail: 'KPIs, targets and actuals',
			value: `${framework.kpiCount} KPIs`,
			href: routes.strategyPerformance(data.tenant.slug, framework.publicId)
		},
		{
			id: 'F01.07',
			name: 'Strategic review',
			detail: 'Evidence, decisions and corrective action',
			value: `${framework.reviewCount} reviews`,
			href: routes.strategyReview(data.tenant.slug, framework.publicId)
		},
		{
			id: 'F01.08',
			name: 'Scenario & foresight',
			detail: 'Alternative futures and stress testing',
			value: `${framework.scenarioCount} scenarios`,
			href: routes.strategyForesight(data.tenant.slug, framework.publicId)
		}
	]);
</script>

<svelte:head>
	<title>{framework.title} · Strategy · NuBlox</title>
	<meta name="description" content="F01 strategy management workspace." />
</svelte:head>

{#snippet recordStatus()}
	<StatusBadge label={statusLabel()} tone={statusTone()} />
{/snippet}

{#snippet recordMeta()}
	<div class="record-meta">
		<span>{framework.code} · v{framework.versionLabel}</span>
		<span aria-hidden="true">•</span>
		<span>{framework.horizonStart} → {framework.horizonEnd}</span>
		{#if framework.isOwnedByCurrentMember}<span aria-hidden="true">•</span><span>Owned by you</span
			>{/if}
	</div>
{/snippet}

<div class="nb-page-wide strategy-workspace">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(data.tenant.slug) },
			{ label: 'Functions', href: routes.functions(data.tenant.slug) },
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{ label: framework.title }
		]}
	/>

	<RecordHeader
		eyebrow="F01 · Strategy cycle"
		title={framework.title}
		subtitle={framework.vision}
		status={recordStatus}
		meta={recordMeta}
	/>

	{#if form?.formError}<Alert tone="danger" title="Action not completed">{form.formError}</Alert
		>{/if}

	{#if approval}
		<section class="approval-card" aria-labelledby="approval-title">
			<div>
				<p class="section-kicker">Strategy review in progress</p>
				<h2 id="approval-title">{approval.activityTitle}</h2>
				<p>
					Submitted {new Date(approval.submittedAt).toLocaleString()}. The strategy remains a
					working draft until the review reaches an approved outcome.
				</p>
				<p class="assignment">Currently with: <strong>{approval.assigneeLabel}</strong></p>
			</div>
			{#if approval.actionableByMember}
				<LinkButton href={routes.myWork(data.tenant.slug)}>Open my review task</LinkButton>
			{:else}
				<StatusBadge label="Awaiting review" tone="info" />
			{/if}
		</section>
	{/if}

	{#if framework.lifecycleStatus === 'draft' && !approval}
		<section class="readiness-card" aria-labelledby="readiness-title">
			<div class="readiness-heading">
				<div>
					<p class="section-kicker">Approval readiness</p>
					<h2 id="readiness-title">Is the strategy ready for review?</h2>
				</div>
				<StatusBadge
					label={readiness.ready ? 'Ready for review' : 'Development required'}
					tone={readiness.ready ? 'success' : 'warning'}
				/>
			</div>
			<div class="readiness-grid">
				{#each readinessItems as item (item.label)}
					<div class:ready={item.ready}>
						<span aria-hidden="true">{item.ready ? '✓' : '○'}</span>
						<div><strong>{item.label}</strong><small>{item.detail}</small></div>
					</div>
				{/each}
			</div>
			<div class="readiness-actions">
				{#if data.permissions.canManage}
					<LinkButton
						href={routes.strategyManage(
							data.tenant.slug,
							framework.publicId,
							'framework',
							framework.publicId
						)}
						variant="secondary">Edit direction</LinkButton
					>
				{/if}
				{#if readiness.ready}
					<form method="POST" action="?/submitForReview" use:enhance>
						<Button type="submit">Submit strategy for review</Button>
					</form>
				{/if}
			</div>
		</section>
	{:else if framework.lifecycleStatus === 'approved'}
		<section class="active-card">
			<div>
				<p class="section-kicker">Approved strategic direction</p>
				<h2>This strategy is the current governing context for planning and execution.</h2>
				<p>
					Business plans, target operating model, KPIs, strategic reviews and foresight all
					reference this approved strategy version.
				</p>
			</div>
			{#if data.permissions.canManage}
				<LinkButton
					href={routes.strategyManage(
						data.tenant.slug,
						framework.publicId,
						'framework',
						framework.publicId
					)}
					variant="secondary">Create controlled revision</LinkButton
				>
			{/if}
		</section>
	{/if}

	<section class="direction-grid" aria-label="Strategic direction">
		<Panel
			title="Purpose"
			description="Why the organisation exists and the enduring value it creates."
			><p class="direction-copy">{framework.purpose}</p></Panel
		>
		<Panel title="Vision" description="The future state this strategy is intended to achieve."
			><p class="direction-copy">{framework.vision}</p></Panel
		>
		<Panel
			title="Mission"
			description="How the organisation expresses its enduring remit within this strategic frame."
			><p class="direction-copy">
				{framework.mission ?? 'No separate mission statement has been defined.'}
			</p></Panel
		>
	</section>

	<section class="stat-grid" aria-label="Strategy system summary">
		<Stat
			label="Environmental factors"
			value={String(framework.environmentFactorCount)}
			detail="Evidence-led context"
			tone="info"
		/>
		<Stat label="Objectives" value={String(framework.objectiveCount)} detail="Strategic outcomes" />
		<Stat
			label="Initiatives"
			value={String(framework.initiativeCount)}
			detail="Delivery commitments"
		/>
		<Stat label="KPIs" value={String(framework.kpiCount)} detail="Outcome measures" />
	</section>

	<section class="management-system" aria-labelledby="management-system-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">F01.01–F01.08</p>
				<h2 id="management-system-title">One strategy, eight connected management areas</h2>
			</div>
			<p>
				Work through the strategy as a connected management cycle. Each area contributes to the same
				controlled strategy context and evidence trail.
			</p>
		</div>
		<div class="area-grid">
			{#each areas as area (area.id)}
				<a href={area.href} class="area-card">
					<span class="area-id">{area.id}</span>
					<h3>{area.name}</h3>
					<p>{area.detail}</p>
					<strong>{area.value}</strong>
				</a>
			{/each}
		</div>
	</section>
</div>

<style>
	.strategy-workspace {
		display: grid;
		gap: var(--nb-space-8);
		padding-bottom: var(--nb-space-16);
	}
	.record-meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
	}
	.section-kicker {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.approval-card,
	.readiness-card,
	.active-card {
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
		padding: var(--nb-space-6);
	}
	.approval-card,
	.active-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-8);
	}
	.approval-card h2,
	.readiness-card h2,
	.active-card h2,
	.section-heading h2 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-xl);
		letter-spacing: -0.025em;
	}
	.approval-card p,
	.active-card p,
	.section-heading p {
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.assignment {
		margin-bottom: 0;
	}
	.readiness-heading,
	.section-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-6);
	}
	.readiness-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-3);
		margin-top: var(--nb-space-5);
	}
	.readiness-grid > div {
		display: flex;
		gap: var(--nb-space-3);
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}
	.readiness-grid > div.ready > span {
		color: var(--nb-color-success-text);
	}
	.readiness-grid small {
		display: block;
		margin-top: 3px;
		color: var(--nb-color-text-muted);
	}
	.readiness-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--nb-space-3);
		margin-top: var(--nb-space-5);
	}
	.direction-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--nb-space-5);
	}
	.direction-copy {
		margin: 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-5);
	}
	.management-system {
		display: grid;
		gap: var(--nb-space-5);
	}
	.section-heading > p {
		max-width: 660px;
		margin: 0;
	}
	.area-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}
	.area-card {
		display: grid;
		gap: var(--nb-space-2);
		min-height: 180px;
		padding: var(--nb-space-5);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
		color: inherit;
		text-decoration: none;
	}
	.area-card:hover {
		border-color: var(--nb-blue-60);
	}
	.area-id {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.08em;
	}
	.area-card h3 {
		margin: 0;
	}
	.area-card p {
		margin: 0;
		color: var(--nb-color-text-secondary);
	}
	.area-card strong {
		align-self: end;
	}
	@media (max-width: 900px) {
		.area-grid,
		.stat-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.direction-grid,
		.readiness-grid {
			grid-template-columns: 1fr;
		}
		.approval-card,
		.active-card,
		.readiness-heading,
		.section-heading {
			align-items: flex-start;
			flex-direction: column;
		}
	}
	@media (max-width: 560px) {
		.area-grid,
		.stat-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
