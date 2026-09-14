<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		Alert,
		Breadcrumbs,
		Button,
		LinkButton,
		PageHeader,
		Panel,
		StatusBadge
	} from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	const featured = $derived(data.groups.flatMap((group) => group.objects).filter((object) => object.featuredStarter));
</script>

<svelte:head>
	<title>Business object registry · NuBlox</title>
	<meta
		name="description"
		content="Browse canonical NuBlox business objects across F01-F29 and install governed lifecycle and workflow starter packs."
	/>
</svelte:head>

<div class="nb-page-wide registry-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Lifecycle administration', href: routes.lifecycle(tenant) },
			{ label: 'Business object registry' }
		]}
	/>

	<PageHeader
		eyebrow="Lifecycle & workflow studio"
		title="Business object registry"
		description="Start from a real NuBlox business object. Each object carries an initial lifecycle and reusable workflow pack that becomes a tenant-owned draft when installed."
	>
		{#snippet actions()}
			<LinkButton href={routes.lifecycle(tenant)} variant="secondary">Lifecycle templates</LinkButton>
			<LinkButton href={appPath(tenant, 'workflow')} variant="secondary">Workflow templates</LinkButton>
		{/snippet}
	</PageHeader>

	{#if form?.formError}
		<Alert tone="danger" title="Starter pack not installed">{form.formError}</Alert>
	{/if}

	<div class="concept-grid" aria-label="How lifecycle and workflow fit together">
		<div>
			<strong>Business object</strong>
			<p>The thing the enterprise governs: purchase order, project, contract, risk, asset or document.</p>
		</div>
		<div>
			<strong>Lifecycle</strong>
			<p>The legal states that object may occupy and the controlled transitions between those states.</p>
		</div>
		<div>
			<strong>Workflow</strong>
			<p>The human and system work used to review, approve, execute, resolve or close those transitions.</p>
		</div>
	</div>

	<Panel
		title="Recommended starter objects"
		description="These cross-enterprise objects are the best starting point for proving NuBlox's end-to-end digital thread. Installing a pack creates drafts only; nothing is activated until you review and publish it."
	>
		<div class="object-grid">
			{#each featured as object (object.objectType)}
				<article class="object-card featured-card">
					<div class="object-heading">
						<div>
							<span class="function-ref">{object.functionId}</span>
							<h2>{object.name}</h2>
						</div>
						{#if object.fullyInstalled}
							<StatusBadge label="Installed" tone="success" />
						{:else}
							<StatusBadge label="Starter available" tone="info" />
						{/if}
					</div>
					<p class="object-description">{object.description}</p>
					<div class="metadata">
						<span>{object.objectType}</span>
						<span>{object.ownerDomain}</span>
						<span>{object.pattern}</span>
					</div>
					<div class="definition-block">
						<strong>Initial lifecycle</strong>
						<p>{object.lifecycle.states.map((state) => state.label).join(' → ')}</p>
					</div>
					<div class="definition-block">
						<strong>Starter workflows</strong>
						<ul>
							{#each object.workflows as workflow}
								<li>{workflow.name}</li>
							{/each}
						</ul>
					</div>
					<div class="install-row">
						<span>{object.lifecycleInstalled ? 'Lifecycle installed' : 'Lifecycle not installed'} · {object.installedWorkflowCount}/{object.workflowCount} workflows</span>
						<form method="POST" action="?/install" use:enhance>
							<input type="hidden" name="objectType" value={object.objectType} />
							<Button type="submit" disabled={object.fullyInstalled}>
								{object.fullyInstalled ? 'Installed' : 'Install starter pack'}
							</Button>
						</form>
					</div>
				</article>
			{/each}
		</div>
	</Panel>

	<Panel
		title="Complete F01-F29 object catalogue"
		description="The catalogue is organised by enterprise function, but every installed object still resolves to one canonical NuBlox object type and the existing native lifecycle/workflow engines."
	>
		<div class="function-list">
			{#each data.groups as group (group.functionId)}
				<details class="function-group">
					<summary>
						<span><strong>{group.functionId}</strong> · {group.functionName}</span>
						<span>{group.objects.length} objects</span>
					</summary>
					<div class="function-objects">
						{#each group.objects as object (object.objectType)}
							<article class="object-card compact-card">
								<div class="object-heading">
									<div>
										<h3>{object.name}</h3>
										<code>{object.objectType}</code>
									</div>
									{#if object.fullyInstalled}
										<StatusBadge label="Installed" tone="success" />
									{:else if object.lifecycleInstalled || object.installedWorkflowCount > 0}
										<StatusBadge label="Part installed" tone="warning" />
									{:else}
										<StatusBadge label={object.pattern} tone="neutral" />
									{/if}
								</div>
								<p class="lifecycle-line">{object.lifecycle.states.map((state) => state.label).join(' → ')}</p>
								<p class="workflow-line"><strong>Workflows:</strong> {object.workflows.map((workflow) => workflow.name).join(' · ')}</p>
								<div class="install-row compact-install">
									<span>{object.ownerDomain} · {object.installedWorkflowCount}/{object.workflowCount} workflows installed</span>
									<form method="POST" action="?/install" use:enhance>
										<input type="hidden" name="objectType" value={object.objectType} />
										<Button type="submit" variant="secondary" disabled={object.fullyInstalled}>
											{object.fullyInstalled ? 'Installed' : 'Use template'}
										</Button>
									</form>
								</div>
							</article>
						{/each}
					</div>
				</details>
			{/each}
		</div>
	</Panel>
</div>

<style>
	.registry-page {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.concept-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--nb-space-3);
		margin: var(--nb-space-5) 0;
	}
	.concept-grid > div,
	.object-card,
	.function-group {
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.concept-grid > div {
		padding: var(--nb-space-4);
	}
	.concept-grid p,
	.object-description,
	.lifecycle-line,
	.workflow-line,
	.install-row,
	.metadata {
		color: var(--nb-color-text-muted);
	}
	.concept-grid p {
		margin: var(--nb-space-2) 0 0;
	}
	.object-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}
	.object-card {
		padding: var(--nb-space-4);
	}
	.object-heading,
	.install-row,
	.metadata,
	.function-group summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-3);
	}
	.object-heading {
		align-items: flex-start;
	}
	.object-heading h2,
	.object-heading h3 {
		margin: 0;
	}
	.function-ref {
		display: block;
		margin-bottom: var(--nb-space-1);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		color: var(--nb-color-text-muted);
	}
	.object-description {
		margin: var(--nb-space-3) 0;
	}
	.metadata {
		justify-content: flex-start;
		flex-wrap: wrap;
		font-size: var(--nb-font-size-xs);
	}
	.metadata span + span::before {
		content: '•';
		margin-right: var(--nb-space-2);
	}
	.definition-block {
		margin-top: var(--nb-space-4);
		padding-top: var(--nb-space-3);
		border-top: 1px solid var(--nb-color-border-subtle);
	}
	.definition-block p,
	.definition-block ul {
		margin: var(--nb-space-2) 0 0;
	}
	.definition-block ul {
		padding-left: var(--nb-space-5);
	}
	.install-row {
		margin-top: var(--nb-space-4);
		padding-top: var(--nb-space-3);
		border-top: 1px solid var(--nb-color-border-subtle);
		font-size: var(--nb-font-size-sm);
	}
	.function-list,
	.function-objects {
		display: grid;
		gap: var(--nb-space-3);
	}
	.function-group summary {
		padding: var(--nb-space-4);
		cursor: pointer;
	}
	.function-group[open] summary {
		border-bottom: 1px solid var(--nb-color-border-subtle);
	}
	.function-objects {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding: var(--nb-space-4);
	}
	.compact-card {
		background: var(--nb-color-bg-subtle);
	}
	.compact-card code {
		font-size: var(--nb-font-size-xs);
		color: var(--nb-color-text-muted);
	}
	.lifecycle-line,
	.workflow-line {
		margin: var(--nb-space-3) 0 0;
		font-size: var(--nb-font-size-sm);
	}
	.compact-install {
		margin-top: var(--nb-space-3);
	}
	@media (max-width: 980px) {
		.object-grid,
		.function-objects {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 760px) {
		.concept-grid {
			grid-template-columns: 1fr;
		}
		.install-row,
		.object-heading,
		.function-group summary {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
