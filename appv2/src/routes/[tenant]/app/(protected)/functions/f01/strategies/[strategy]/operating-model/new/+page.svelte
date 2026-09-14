<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		Field,
		LinkButton,
		PageHeader,
		Panel
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const submitted = $derived((form?.values ?? {}) as Record<string, string>);
	function value(name: string): string {
		return submitted[name] ?? '';
	}
</script>

<svelte:head><title>Add target-state component · NuBlox</title></svelte:head>

<div class="nb-page-form">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: data.workspace.framework.title,
				href: routes.strategyFramework(data.tenant.slug, data.workspace.framework.publicId)
			},
			{
				label: 'Operating model',
				href: routes.strategyOperatingModel(data.tenant.slug, data.workspace.framework.publicId)
			},
			{ label: 'Add component' }
		]}
	/>
	<PageHeader
		eyebrow="F01.05 · Target operating model"
		title="Add a target-state component"
		description="Describe one controlled part of the future operating model and the gap from today. Accountability and delivery initiatives are linked after the component is created."
	/>

	{#if form?.formError}<Alert tone="danger" title="Component not created">{form.formError}</Alert
		>{/if}

	{#if data.draftPlans.length === 0}
		<Alert tone="warning" title="A draft business plan is required">
			Target operating-model design is governed by the working business plan. Create a plan or a
			controlled plan revision before changing the target state.
		</Alert>
		<LinkButton
			href={routes.strategyBusinessPlanning(data.tenant.slug, data.workspace.framework.publicId)}
			>Open business planning</LinkButton
		>
	{:else}
		<Panel
			title="Target-state definition"
			description="Keep the component outcome-oriented. Describe what must be different, not the project tasks used to get there."
		>
			<form method="POST" use:enhance class="component-form">
				<Field id="planPublicId" label="Business plan" required>
					<select
						class="nb-control"
						id="planPublicId"
						name="planPublicId"
						required
						value={value('planPublicId')}
					>
						<option value="">Select working plan</option>
						{#each data.draftPlans as plan (plan.publicId)}<option value={plan.publicId}
								>{plan.code} · {plan.title}</option
							>{/each}
					</select>
				</Field>
				<div class="two-column">
					<Field id="componentCode" label="Component code" hint="For example TOM-CAP-01" required>
						<input
							class="nb-control"
							id="componentCode"
							name="componentCode"
							value={value('componentCode')}
							required
						/>
					</Field>
					<Field id="componentType" label="Component type" required>
						<select
							class="nb-control"
							id="componentType"
							name="componentType"
							required
							value={value('componentType') || 'business_capability'}
						>
							<option value="business_capability">Business capability</option>
							<option value="value_stream">Value stream</option>
							<option value="organisation_design">Organisation design</option>
							<option value="process">Process</option>
							<option value="governance">Governance</option>
							<option value="information">Information</option>
							<option value="technology">Technology</option>
							<option value="partner_ecosystem">Partner ecosystem</option>
							<option value="location">Location</option>
						</select>
					</Field>
				</div>
				<Field id="title" label="Component title" required>
					<input class="nb-control" id="title" name="title" value={value('title')} required />
				</Field>
				<Field
					id="parentComponentPublicId"
					label="Parent component"
					hint="Optional. Choose a component from the same plan after creating the parent first."
				>
					<select
						class="nb-control"
						id="parentComponentPublicId"
						name="parentComponentPublicId"
						value={value('parentComponentPublicId')}
					>
						<option value="">No parent</option>
						{#each data.workspace.components.filter((component) => component.status === 'proposed') as component (component.publicId)}
							<option value={component.publicId}>{component.code} · {component.title}</option>
						{/each}
					</select>
				</Field>
				<Field id="currentState" label="Current state" hint="What exists today?">
					<textarea class="nb-control" id="currentState" name="currentState" rows="5"
						>{value('currentState')}</textarea
					>
				</Field>
				<Field
					id="targetState"
					label="Target state"
					hint="What must be true in the future operating model?"
					required
				>
					<textarea class="nb-control" id="targetState" name="targetState" rows="6" required
						>{value('targetState')}</textarea
					>
				</Field>
				<div class="form-actions">
					<Button type="submit">Create component</Button>
					<LinkButton
						href={routes.strategyOperatingModel(
							data.tenant.slug,
							data.workspace.framework.publicId
						)}
						variant="secondary">Cancel</LinkButton
					>
				</div>
			</form>
		</Panel>
	{/if}
</div>

<style>
	.component-form {
		display: grid;
		gap: var(--nb-space-5);
	}
	.two-column {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}
	.form-actions {
		display: flex;
		gap: var(--nb-space-3);
		justify-content: flex-end;
	}
	@media (max-width: 700px) {
		.two-column {
			grid-template-columns: 1fr;
		}
	}
</style>
