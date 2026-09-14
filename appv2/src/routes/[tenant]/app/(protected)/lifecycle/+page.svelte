<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
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
	import { routes } from '$lib/routing/route-contract';

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
	<title>Lifecycle administration · NuBlox</title>
	<meta
		name="description"
		content="Govern NuBlox lifecycle templates, phases, transitions, role access and active object bindings."
	/>
</svelte:head>

<div class="nb-page-wide lifecycle-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Lifecycle administration' }
		]}
	/>

	<PageHeader
		eyebrow="Platform governance"
		title="Lifecycle administration"
		description="Define reusable Basic and Advanced lifecycle templates, version them under control, and bind published templates to governed object types."
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Lifecycle template not created">{form.formError}</Alert>
	{/if}

	<div class="workspace-grid">
		<section class="template-stack" aria-label="Lifecycle templates">
			<Panel
				title="Governed lifecycle templates"
				description="Published major versions are immutable. Amendments are made through controlled minor revisions before the next major publication."
			>
				{#if data.templates.length === 0}
					<EmptyState
						title="No tenant lifecycle templates yet"
						description="F01 continues to use its code-backed reference lifecycles until an administrator publishes and binds a tenant lifecycle template."
					/>
				{:else}
					<div class="template-list">
						{#each data.templates as template (template.publicId)}
							<a
								class="template-card"
								href={resolve(routes.lifecycleTemplate(tenant, template.publicId))}
							>
								<div class="template-main">
									<div class="template-heading">
										<strong>{template.name}</strong>
										<StatusBadge label={template.status} tone={tone(template.status)} />
										{#if template.isActiveBinding}
											<StatusBadge label="Active binding" tone="success" />
										{/if}
									</div>
									<p>{template.description ?? 'No description has been supplied.'}</p>
								</div>
								<div class="template-meta">
									<span>{template.templateKey}</span>
									<span>v{template.versionLabel}</span>
									<span>{template.mode}</span>
									<span>{template.objectType}</span>
									<span>{template.phaseCount} phases</span>
									<span>{template.transitionCount} transitions</span>
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</Panel>
		</section>

		<aside>
			<Panel
				title="Create lifecycle template"
				description="Start with the lightest lifecycle that can safely govern the business object."
				padding="spacious"
			>
				<form method="POST" action="?/create" use:enhance class="form-stack">
					<Field
						id="templateKey"
						label="Template key"
						required
						hint="Stable key, for example f01.framework."
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
					<Field
						id="objectType"
						label="Object type"
						required
						hint="Stable object type, for example F01.framework."
					>
						<input
							class="nb-control"
							id="objectType"
							name="objectType"
							value={form?.values?.objectType ?? ''}
							required
						/>
					</Field>
					<Field id="mode" label="Lifecycle mode" required>
						<select class="nb-control" id="mode" name="mode">
							<option value="basic" selected={(form?.values?.mode ?? 'basic') === 'basic'}
								>Basic</option
							>
							<option value="advanced" selected={form?.values?.mode === 'advanced'}>Advanced</option
							>
						</select>
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
	.lifecycle-page {
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
	.template-main p {
		margin: var(--nb-space-2) 0 0;
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
