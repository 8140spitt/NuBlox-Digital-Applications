<script lang="ts">
	import { page } from '$app/state';
	import {
		Breadcrumbs,
		EmptyState,
		LinkButton,
		PageHeader,
		Panel,
		StatusBadge
	} from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';
	import { resolveInternalPath } from '$lib/routing/resolve-path';
	let { data } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	function healthTone(health: string): 'success' | 'warning' | 'danger' | 'neutral' {
		if (health === 'green') return 'success';
		if (health === 'amber') return 'warning';
		if (health === 'red') return 'danger';
		return 'neutral';
	}
	function statusTone(status: string): 'success' | 'info' | 'warning' | 'neutral' {
		if (status === 'approved') return 'success';
		if (status === 'pending') return 'info';
		if (status === 'returned' || status === 'rejected' || status === 'withdrawn') return 'warning';
		return 'neutral';
	}
</script>

<svelte:head><title>Workflow operations · NuBlox</title></svelte:head>

<div class="nb-page-wide operations-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Workflow administration', href: appPath(tenant, 'workflow') },
			{ label: 'Operations' }
		]}
	/>
	<PageHeader
		eyebrow="Workflow administration"
		title="Workflow operations"
		description="Monitor live workflow work, surface exceptions and intervene with attributable operational evidence."
	>
		{#snippet actions()}<LinkButton href={appPath(tenant, 'workflow')} variant="secondary"
				>Template library</LinkButton
			>{/snippet}
	</PageHeader>

	<div class="metric-grid" aria-label="Workflow health summary">
		<div><strong>{data.summary.active}</strong><span>Active</span></div>
		<div><strong>{data.summary.attention}</strong><span>Needs attention</span></div>
		<div><strong>{data.summary.closed}</strong><span>Recent closed</span></div>
	</div>

	<Panel
		title="Process monitor"
		description="Active work is first, then recent completed or withdrawn requests. Amber means blocked or overdue; red means stale execution evidence."
	>
		{#if data.operations.length === 0}
			<EmptyState
				title="No workflow activity yet"
				description="Published workflows will appear here when business events create governed work."
			/>
		{:else}
			<div class="operation-list">
				{#each data.operations as operation (operation.requestPublicId)}
					<a
						class="operation-row"
						href={resolveInternalPath(
							`${appPath(tenant, 'workflow/operations')}/${operation.requestPublicId}`
						)}
					>
						<div class="operation-main">
							<div class="heading">
								<strong>{operation.transitionLabel}</strong><StatusBadge
									label={operation.requestStatus}
									tone={statusTone(operation.requestStatus)}
								/><StatusBadge label={operation.health} tone={healthTone(operation.health)} />
							</div>
							<p>
								{operation.sourceDomain} · {operation.sourceType} · {operation.fromState} → {operation.toState}
							</p>
						</div>
						<div class="operation-meta">
							<span>{operation.priority}</span><span
								>{operation.workStatus.replaceAll('_', ' ')}</span
							>{#if operation.dueAt}<span>Due {new Date(operation.dueAt).toLocaleString()}</span
								>{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</Panel>
</div>

<style>
	.operations-page {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.metric-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--nb-space-3);
		margin: var(--nb-space-5) 0;
	}
	.metric-grid > div {
		display: grid;
		gap: 2px;
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.metric-grid strong {
		font-size: var(--nb-font-size-2xl);
	}
	.metric-grid span,
	.operation-meta,
	.operation-main p {
		color: var(--nb-color-text-muted);
	}
	.operation-list {
		display: grid;
		gap: var(--nb-space-2);
	}
	.operation-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--nb-space-4);
		align-items: center;
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		color: inherit;
		text-decoration: none;
	}
	.operation-row:hover {
		border-color: var(--nb-color-border-strong);
		background: var(--nb-color-bg-subtle);
	}
	.heading,
	.operation-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nb-space-2);
	}
	.operation-main p {
		margin: var(--nb-space-1) 0 0;
	}
	.operation-meta {
		justify-content: flex-end;
		font-size: var(--nb-font-size-sm);
	}
	@media (max-width: 760px) {
		.metric-grid {
			grid-template-columns: 1fr;
		}
		.operation-row {
			grid-template-columns: 1fr;
		}
		.operation-meta {
			justify-content: flex-start;
		}
	}
</style>
