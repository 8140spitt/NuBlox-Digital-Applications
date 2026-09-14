<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		Alert,
		Breadcrumbs,
		Button,
		EmptyState,
		Field,
		PageHeader,
		Panel,
		StatusBadge
	} from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';

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
	<meta
		name="description"
		content="Create, version, publish and bind governed NuBlox workflow templates."
	/>
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
		description="Define reusable, typed workflow templates for approvals and operational orchestration without embedding executable administrator code."
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Workflow template not created">{form.formError}</Alert>
	{/if}

	<div class="workspace-grid">
		<section aria-label="Workflow templates">
			<Panel
				title="Governed workflow templates"
				description="Published major versions are immutable. Revisions are copied into a controlled working version and validated before publication."
			>
				{#if data.templates.length === 0}
					<EmptyState
						title="No workflow templates yet"
						description="Create the first reusable workflow. A safe Start → End skeleton is created automatically, then you can add typed activities, participants and routing."
					/>
				{:else}
					<div class="template-list">
						{#each data.templates as template (template.publicId)}
							<a class="template-card" href={`${appPath(tenant, 'workflow')}/${template.publicId}`}>
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
								<p>{template.description ?? 'No description has been supplied.'}</p>
								<div class="template-meta">
									<span>{template.templateKey}</span>
									<span>v{template.versionLabel}</span>
									<span>{template.nodeCount} nodes</span>
									<span>{template.linkCount} routes</span>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</Panel>
		</section>

		<aside>
			<Panel
				title="Create workflow template"
				description="Use a stable key because lifecycle gates and business events bind to the published workflow lineage."
				padding="spacious"
			>
				<form method="POST" action="?/create" use:enhance class="form-stack">
					<Field
						id="templateKey"
						label="Template key"
						required
						hint="For example f01.strategy-approval."
					>
						<input
							class="nb-control"
							id="templateKey"
							name="templateKey"
							value={form?.values?.templateKey ?? ''}
							required
						/>
					</Field>
					<Field id="name" label="Name" required>
						<input
							class="nb-control"
							id="name"
							name="name"
							value={form?.values?.name ?? ''}
							required
						/>
					</Field>
					<Field id="description" label="Description">
						<textarea class="nb-control" id="description" name="description"
							>{form?.values?.description ?? ''}</textarea
						>
					</Field>
					<Button type="submit">Create working template</Button>
				</form>
			</Panel>
		</aside>
	</div>
</div>

<style>
	.workflow-page {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.workspace-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 390px);
		gap: var(--nb-space-6);
		align-items: start;
		margin-top: var(--nb-space-6);
	}
	.template-list,
	.form-stack {
		display: grid;
		gap: var(--nb-space-4);
	}
	.template-card {
		display: grid;
		gap: var(--nb-space-3);
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
		align-items: center;
		gap: var(--nb-space-2);
	}
	.template-heading strong {
		font-size: var(--nb-font-size-lg);
	}
	.template-card p {
		margin: 0;
		color: var(--nb-color-text-secondary);
	}
	.template-meta {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}
	.template-meta span + span::before {
		content: '•';
		margin-right: var(--nb-space-2);
	}
	@media (max-width: 980px) {
		.workspace-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
