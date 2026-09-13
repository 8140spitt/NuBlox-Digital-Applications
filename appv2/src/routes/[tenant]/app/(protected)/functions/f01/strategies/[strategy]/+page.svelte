<script lang="ts">
	import {
		Breadcrumbs,
		LifecycleStrip,
		LinkButton,
		Panel,
		RecordHeader,
		Stat,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data } = $props();
	const framework = $derived(data.framework);

	function statusLabel(status: 'draft' | 'approved' | 'superseded'): string {
		if (status === 'approved') return 'Approved';
		if (status === 'superseded') return 'Superseded';
		return 'Draft';
	}

	function statusTone(
		status: 'draft' | 'approved' | 'superseded'
	): 'warning' | 'success' | 'neutral' {
		if (status === 'approved') return 'success';
		if (status === 'superseded') return 'neutral';
		return 'warning';
	}

	const lifecycle = $derived(
		framework.lifecycleStatus === 'draft'
			? [
					{ label: 'Draft', state: 'current' as const },
					{ label: 'Approval', state: 'upcoming' as const }
				]
			: framework.lifecycleStatus === 'approved'
				? [
						{ label: 'Draft', state: 'complete' as const },
						{ label: 'Approved · current', state: 'current' as const }
					]
				: [
						{ label: 'Draft', state: 'complete' as const },
						{ label: 'Approved', state: 'complete' as const },
						{ label: 'Historical', state: 'current' as const }
					]
	);

	const areas = $derived([
		{ id: 'F01.01', name: 'Direction', detail: 'Purpose, vision and mission', value: 'Defined' },
		{
			id: 'F01.02',
			name: 'Environment',
			detail: 'Internal and external evidence',
			value: `${framework.environmentFactorCount} factors`
		},
		{
			id: 'F01.03',
			name: 'Objectives',
			detail: 'Strategic choices and outcomes',
			value: `${framework.objectiveCount} objectives`
		},
		{
			id: 'F01.04',
			name: 'Business plan',
			detail: 'Plans, initiatives and resources',
			value: `${framework.businessPlanCount} plans · ${framework.initiativeCount} initiatives`
		},
		{
			id: 'F01.05',
			name: 'Operating model',
			detail: 'Current-to-target enterprise design',
			value: `${framework.operatingModelComponentCount} components`
		},
		{
			id: 'F01.06',
			name: 'Performance',
			detail: 'Goals, KPIs, targets and actuals',
			value: `${framework.kpiCount} KPIs`
		},
		{
			id: 'F01.07',
			name: 'Review',
			detail: 'Evidence, decisions and corrective action',
			value: `${framework.reviewCount} reviews`
		},
		{
			id: 'F01.08',
			name: 'Foresight',
			detail: 'Scenarios and alternative futures',
			value: `${framework.scenarioCount} scenarios`
		}
	]);
</script>

<svelte:head>
	<title>{framework.title} · Strategy · NuBlox</title>
	<meta name="description" content="Governed F01 strategy record workspace." />
</svelte:head>

{#snippet recordStatus()}
	<StatusBadge
		label={statusLabel(framework.lifecycleStatus)}
		tone={statusTone(framework.lifecycleStatus)}
	/>
{/snippet}

{#snippet recordMeta()}
	<div class="record-meta">
		<span>{framework.code} · v{framework.versionLabel}</span>
		<span aria-hidden="true">•</span>
		<span>{framework.horizonStart} → {framework.horizonEnd}</span>
		{#if framework.isOwnedByCurrentMember}
			<span aria-hidden="true">•</span>
			<span>Owned by you</span>
		{/if}
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

	<section class="lifecycle-panel" aria-labelledby="version-lifecycle-title">
		<div>
			<p class="section-kicker">Governed version · v{framework.versionLabel}</p>
			<h2 id="version-lifecycle-title">
				Version history and business lifecycle are separate controls.
			</h2>
		</div>
		<div class="lifecycle-controls">
			<LifecycleStrip steps={lifecycle} label="Strategy version lifecycle" />
			<LinkButton
				href={routes.strategyManage(
					data.tenant.slug,
					framework.publicId,
					'framework',
					framework.publicId
				)}
				variant="secondary">Manage / lifecycle</LinkButton
			>
		</div>
	</section>

	<section class="direction-grid" aria-label="Strategic direction">
		<Panel
			title="Purpose"
			description="Why the organisation exists and the enduring value it creates."
		>
			<p class="direction-copy">{framework.purpose}</p>
		</Panel>
		<Panel title="Vision" description="The future state this strategy is intended to achieve.">
			<p class="direction-copy">{framework.vision}</p>
		</Panel>
		<Panel
			title="Mission"
			description="How the organisation expresses its enduring remit within this strategic frame."
		>
			<p class="direction-copy">
				{framework.mission ?? 'No separate mission statement has been defined.'}
			</p>
		</Panel>
	</section>

	<section class="stat-grid" aria-label="Strategy system summary">
		<Stat
			label="Environmental evidence"
			value={String(framework.environmentFactorCount)}
			detail="Active factors"
			tone="info"
		/>
		<Stat label="Objectives" value={String(framework.objectiveCount)} detail="Strategic outcomes" />
		<Stat
			label="Initiatives"
			value={String(framework.initiativeCount)}
			detail="Open delivery commitments"
		/>
		<Stat label="KPIs" value={String(framework.kpiCount)} detail="Outcome measures" />
	</section>

	<section class="active-workspaces" aria-labelledby="active-workspaces-title">
		<div>
			<p class="section-kicker">Active strategy workflow</p>
			<h2 id="active-workspaces-title">
				Move from evidence to strategic choice without losing the thread.
			</h2>
			<p>
				F01.02 now governs structured evidence, environmental factors, implications and assumptions.
				F01.03 consumes those records as drivers for options, decisions, themes and traceable
				objectives.
			</p>
		</div>
		<div class="workspace-actions">
			<LinkButton
				href={routes.strategyAnalysis(data.tenant.slug, framework.publicId)}
				variant="secondary">F01.02 Environmental analysis</LinkButton
			>
			<LinkButton href={routes.strategyPlanning(data.tenant.slug, framework.publicId)}
				>F01.03 Strategic planning</LinkButton
			>
		</div>
	</section>

	<section class="management-system" aria-labelledby="management-system-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">F01.01–F01.08</p>
				<h2 id="management-system-title">One strategy record, eight connected management areas</h2>
			</div>
			<p>
				This workspace remains the stable strategic context. F01.02 and F01.03 now have focused
				record workspaces and governed transactions; later sub-functions will attach to the same
				strategy cycle rather than creating parallel applications.
			</p>
		</div>

		<div class="area-grid">
			{#each areas as area (area.id)}
				<article>
					<span class="area-id">{area.id}</span>
					<h3>{area.name}</h3>
					<p>{area.detail}</p>
					<strong>{area.value}</strong>
				</article>
			{/each}
		</div>
	</section>

	<Panel
		title="Current control position"
		description="NuBlox separates record state from future workflow controls so authority is never implied by a button that is not yet implemented."
	>
		<div class="control-position">
			<div>
				<strong>{statusLabel(framework.lifecycleStatus)}</strong>
				<p>
					{#if framework.lifecycleStatus === 'draft'}
						This version can be developed by authorised strategy managers. Approval will remain
						gated by evidence, strategic choices and objectives rather than a generic status edit.
					{:else if framework.lifecycleStatus === 'approved'}
						This version is approved enterprise evidence. Material change must be introduced through
						a controlled revision rather than editing approved history.
					{:else}
						This version remains preserved as enterprise history and is no longer the current
						approved strategic direction.
					{/if}
				</p>
			</div>
			<div class="permission-summary">
				<span>View</span><strong>Yes</strong>
				<span>Manage</span><strong>{data.permissions.canManage ? 'Yes' : 'No'}</strong>
				<span>Approve</span><strong>{data.permissions.canApprove ? 'Yes' : 'No'}</strong>
			</div>
		</div>
	</Panel>
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

	.lifecycle-panel,
	.active-workspaces {
		display: grid;
		grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.1fr);
		gap: var(--nb-space-10);
		align-items: center;
		padding: var(--nb-space-6);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}

	.section-kicker {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.lifecycle-panel h2,
	.active-workspaces h2,
	.section-heading h2 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-xl);
		letter-spacing: -0.025em;
	}

	.active-workspaces p {
		margin: var(--nb-space-3) 0 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}

	.lifecycle-controls {
		display: grid;
		gap: var(--nb-space-4);
	}
	.lifecycle-controls :global(a) {
		justify-self: end;
	}

	.workspace-actions {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: var(--nb-space-3);
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
		white-space: pre-wrap;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-5);
		padding-block: var(--nb-space-3);
	}

	.management-system {
		display: grid;
		gap: var(--nb-space-5);
	}

	.section-heading {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 520px);
		gap: var(--nb-space-8);
		align-items: end;
	}

	.section-heading > p {
		margin: 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}

	.area-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		border-top: 1px solid var(--nb-color-border-default);
		border-left: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		overflow: hidden;
	}

	.area-grid article {
		display: flex;
		min-height: 190px;
		flex-direction: column;
		padding: var(--nb-space-5);
		border-right: 1px solid var(--nb-color-border-default);
		border-bottom: 1px solid var(--nb-color-border-default);
		background: var(--nb-color-bg-surface);
	}

	.area-id {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.07em;
	}

	.area-grid h3 {
		margin: var(--nb-space-5) 0 var(--nb-space-2);
		font-size: var(--nb-font-size-md);
	}

	.area-grid p {
		margin: 0 0 var(--nb-space-4);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		line-height: var(--nb-line-relaxed);
	}

	.area-grid strong {
		margin-top: auto;
		font-size: var(--nb-font-size-xs);
	}

	.control-position {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--nb-space-8);
		align-items: start;
	}

	.control-position > div:first-child > strong {
		font-size: var(--nb-font-size-md);
	}

	.control-position p {
		max-width: 780px;
		margin: var(--nb-space-2) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		line-height: var(--nb-line-relaxed);
	}

	.permission-summary {
		display: grid;
		grid-template-columns: auto auto;
		gap: var(--nb-space-2) var(--nb-space-5);
		min-width: 160px;
		font-size: var(--nb-font-size-xs);
	}

	.permission-summary span {
		color: var(--nb-color-text-muted);
	}

	.permission-summary strong {
		text-align: right;
	}

	@media (max-width: 1050px) {
		.area-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.direction-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 820px) {
		.lifecycle-panel,
		.active-workspaces,
		.section-heading,
		.control-position {
			grid-template-columns: 1fr;
		}
		.workspace-actions {
			justify-content: flex-start;
		}
		.stat-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 600px) {
		.area-grid,
		.stat-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
