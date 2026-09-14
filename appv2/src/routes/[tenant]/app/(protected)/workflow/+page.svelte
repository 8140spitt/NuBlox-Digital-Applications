<script lang="ts">
	import { page } from '$app/state';
	import {
		Alert,
		Breadcrumbs,
		EmptyState,
		LinkButton,
		PageHeader,
		Panel,
		StatusBadge
	} from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';
	import { resolveInternalPath } from '$lib/routing/resolve-path';
	let { data, form } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	function tone(status: string): 'success' | 'info' | 'warning' | 'neutral' {
		if (status === 'published') return 'success';
		if (status === 'draft') return 'info';
		if (status === 'superseded') return 'warning';
		return 'neutral';
	}
</script>

<svelte:head>
	<title>Workflow administration · NuBlox</title>
	<meta name="description" content="Design, publish and operate governed NuBlox workflows." />
</svelte:head>

<div class="nb-page-wide workflow-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Lifecycle administration', href: routes.lifecycle(tenant) },
			{ label: 'Workflow administration' }
		]}
	/>
	<PageHeader
		eyebrow="Platform governance"
		title="Workflow administration"
		description="A workflow governs the work people and systems perform against business objects. Start from the F01-F29 object registry for real approval, review, execution and exception flows, or design a bespoke workflow."
	>
		{#snippet actions()}
			<LinkButton href={appPath(tenant, 'workflow/operations')} variant="secondary"
				>Monitor live workflows</LinkButton
			>
			<LinkButton href={appPath(tenant, 'lifecycle/registry')} variant="secondary"
				>Business object registry</LinkButton
			>
			<LinkButton href={appPath(tenant, 'workflow/new')}>Create bespoke workflow</LinkButton>
		{/snippet}
	</PageHeader>
	{#if form?.formError}
		<Alert tone="danger" title="Workflow change not applied">{form.formError}</Alert>
	{/if}

	<div class="orientation-grid">
		<div>
			<strong>1</strong><span>Object</span>
			<p>Start with the business object whose work must be governed.</p>
		</div>
		<div>
			<strong>2</strong><span>Design</span>
			<p>Arrange activities, participants, roles, deadlines and routing.</p>
		</div>
		<div>
			<strong>3</strong><span>Publish & activate</span>
			<p>Freeze an immutable major version and bind it to controlled business events.</p>
		</div>
		<div>
			<strong>4</strong><span>Operate</span>
			<p>Monitor assignments, deadlines, intervention evidence and exceptions.</p>
		</div>
	</div>

	<Panel
		title="Tenant workflow templates"
		description="Installed object starter packs appear here as normal editable workflow drafts. Open one directly in the graphical designer, adapt it, then publish and bind it under control."
	>
		{#if data.templates.length === 0}
			<EmptyState
				title="No workflow templates yet"
				description="Open the business object registry to install a real workflow pack, or create a bespoke workflow from a Start → End skeleton."
			/>
		{:else}
			<div class="template-list">
				{#each data.templates as template (template.publicId)}
					<a
						class="template-card"
						href={resolveInternalPath(
							`${appPath(tenant, 'workflow')}/${template.publicId}/designer`
						)}
					>
						<div>
							<div class="template-heading">
								<strong>{template.name}</strong>
								<StatusBadge label={template.status} tone={tone(template.status)} />
								{#if template.bindingCount > 0}
									<StatusBadge
										label={`${template.bindingCount} active binding${template.bindingCount === 1 ? '' : 's'}`}
										tone="success"
									/>
								{/if}
							</div>
							<p>{template.description ?? 'No purpose has been supplied.'}</p>
						</div>
						<div class="template-meta">
							<span>v{template.versionLabel}</span>
							<span>{template.nodeCount} nodes</span>
							<span>{template.linkCount} routes</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</Panel>
</div>

<style>
	.workflow-page {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.orientation-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-3);
		margin: var(--nb-space-5) 0;
	}
	.orientation-grid > div {
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.orientation-grid strong {
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		margin-right: var(--nb-space-2);
		border-radius: 999px;
		background: var(--nb-color-bg-subtle);
	}
	.orientation-grid span {
		font-weight: var(--nb-weight-semibold);
	}
	.orientation-grid p,
	.template-card p,
	.template-meta {
		color: var(--nb-color-text-muted);
	}
	.orientation-grid p {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-sm);
	}
	.template-list {
		display: grid;
		gap: var(--nb-space-3);
	}
	.template-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--nb-space-4);
		align-items: center;
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
		color: inherit;
		text-decoration: none;
	}
	.template-card:hover {
		border-color: var(--nb-color-border-strong);
		background: var(--nb-color-bg-subtle);
	}
	.template-heading,
	.template-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
		align-items: center;
	}
	.template-card p {
		margin: var(--nb-space-1) 0 0;
	}
	.template-meta {
		justify-content: flex-end;
		font-size: var(--nb-font-size-sm);
	}
	@media (max-width: 900px) {
		.orientation-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 680px) {
		.orientation-grid {
			grid-template-columns: 1fr;
		}
		.template-card {
			grid-template-columns: 1fr;
		}
		.template-meta {
			justify-content: flex-start;
		}
	}
</style>
