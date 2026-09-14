<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Alert, Breadcrumbs, Button, Field, PageHeader, Panel } from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';
	import { resolveInternalPath } from '$lib/routing/resolve-path';

	let { form } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
</script>

<svelte:head><title>Create workflow template · NuBlox</title></svelte:head>

<div class="nb-page workflow-create">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Workflow administration', href: appPath(tenant, 'workflow') },
			{ label: 'Create template' }
		]}
	/>
	<PageHeader
		eyebrow="Workflow administration"
		title="Create workflow template"
		description="Create the governed identity first. The designer then opens with a safe Start → End skeleton."
	/>
	{#if form?.formError}<Alert tone="danger" title="Template not created">{form.formError}</Alert
		>{/if}
	<Panel
		title="Template identity"
		description="Keep the key stable; business-event bindings follow the workflow lineage."
		padding="spacious"
	>
		<form method="POST" use:enhance class="form-stack">
			<Field
				id="templateKey"
				label="Template key"
				hint="For example f01.strategy-approval."
				required
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
				<input class="nb-control" id="name" name="name" value={form?.values?.name ?? ''} required />
			</Field>
			<Field id="description" label="Purpose">
				<textarea class="nb-control" id="description" name="description"
					>{form?.values?.description ?? ''}</textarea
				>
			</Field>
			<div class="actions">
				<a class="cancel" href={resolveInternalPath(appPath(tenant, 'workflow'))}>Cancel</a>
				<Button type="submit">Create and open designer</Button>
			</div>
		</form>
	</Panel>
</div>

<style>
	.workflow-create {
		max-width: 760px;
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.form-stack {
		display: grid;
		gap: var(--nb-space-4);
		margin-top: var(--nb-space-2);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: var(--nb-space-3);
		padding-top: var(--nb-space-2);
	}
	.cancel {
		color: var(--nb-color-text-secondary);
		text-decoration: none;
		font-weight: var(--nb-weight-semibold);
	}
</style>
