<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		Field,
		LinkButton,
		PageHeader,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const workspace = $derived(data.workspace);
	const draftPlans = $derived(workspace.plans.filter((plan) => plan.status === 'draft'));

	function label(value: string): string {
		return value
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function accountabilities(componentPublicId: string) {
		return workspace.accountabilities.filter(
			(item) => item.componentPublicId === componentPublicId
		);
	}

	function initiativeLinks(componentPublicId: string) {
		return workspace.links.filter((item) => item.componentPublicId === componentPublicId);
	}

	function eligibleInitiatives(planPublicId: string) {
		return workspace.initiatives.filter((item) => item.planPublicId === planPublicId);
	}
</script>

<svelte:head>
	<title>Operating model · {workspace.framework.title} · NuBlox</title>
</svelte:head>

<div class="nb-page-wide operating-page">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: workspace.framework.title,
				href: routes.strategyFramework(data.tenant.slug, workspace.framework.publicId)
			},
			{ label: 'Operating model' }
		]}
	/>

	<PageHeader
		eyebrow="F01.05 · Operating model"
		title="Design the organisation needed to deliver the strategy"
		description="Describe the current and target state of capabilities, organisation, processes, governance, information, technology and partners. Make accountability and the initiatives that deliver each change explicit."
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Action not completed">{form.formError}</Alert>
	{/if}

	<section class="operating-summary" aria-label="Operating model summary">
		<div><span>Target-state components</span><strong>{workspace.components.length}</strong></div>
		<div>
			<span>Accountabilities</span><strong>{workspace.accountabilities.length}</strong>
		</div>
		<div><span>Initiative links</span><strong>{workspace.links.length}</strong></div>
		<div><span>Draft plans</span><strong>{draftPlans.length}</strong></div>
	</section>

	<section class="intro-card">
		<div>
			<p class="section-kicker">Design rule</p>
			<h2>Target operating model is part of the business plan—not a disconnected diagram.</h2>
			<p>
				Components are designed while their business plan is a working draft. When the business plan
				is approved, its proposed target-state components become approved with it. Material change
				then happens through a controlled plan revision.
			</p>
		</div>
		{#if workspace.permissions.canManage && draftPlans.length > 0}
			<LinkButton
				href={routes.strategyOperatingModelNew(data.tenant.slug, workspace.framework.publicId)}
				>Add target-state component</LinkButton
			>
		{:else if workspace.permissions.canManage}
			<LinkButton
				href={routes.strategyBusinessPlanning(data.tenant.slug, workspace.framework.publicId)}
				variant="secondary">Open business planning</LinkButton
			>
		{/if}
	</section>

	{#if workspace.components.length > 0}
		<div class="component-list">
			{#each workspace.components as component (component.publicId)}
				<article class="component-card">
					<header>
						<div>
							<p class="component-code">{component.code} · {component.planCode}</p>
							<h2>{component.title}</h2>
							<p>{label(component.componentType)}</p>
						</div>
						<StatusBadge
							label={component.status === 'proposed' ? 'Working target' : label(component.status)}
							tone={component.status === 'approved'
								? 'success'
								: component.status === 'retired'
									? 'neutral'
									: 'warning'}
						/>
					</header>

					<div class="state-grid">
						<div>
							<span>Current state</span>
							<p>{component.currentState ?? 'No current-state description recorded.'}</p>
						</div>
						<div>
							<span>Target state</span>
							<p>{component.targetState}</p>
						</div>
					</div>

					{#if component.parentTitle}
						<p class="parent-line">Part of: <strong>{component.parentTitle}</strong></p>
					{/if}

					<div class="trace-grid">
						<div>
							<h3>Accountability</h3>
							{#if accountabilities(component.publicId).length > 0}
								<ul>
									{#each accountabilities(component.publicId) as accountability (accountability.publicId)}
										<li>
											<strong>{label(accountability.accountabilityType)}</strong>
											<span
												>{accountability.positionLabel}{accountability.memberName
													? ` · ${accountability.memberName}`
													: ''}</span
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="empty-copy">No accountability assigned yet.</p>
							{/if}
						</div>
						<div>
							<h3>Delivery initiatives</h3>
							{#if initiativeLinks(component.publicId).length > 0}
								<ul>
									{#each initiativeLinks(component.publicId) as link (`${link.componentPublicId}-${link.initiativePublicId}`)}
										<li>
											<strong>{label(link.changeRole)}</strong><span
												>{link.initiativeCode} · {link.initiativeTitle}</span
											>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="empty-copy">No delivery initiative linked yet.</p>
							{/if}
						</div>
					</div>

					{#if workspace.permissions.canManage && component.status === 'proposed'}
						<div class="edit-tools">
							<details>
								<summary>Assign accountability</summary>
								<form method="POST" action="?/addAccountability" use:enhance>
									<input type="hidden" name="componentPublicId" value={component.publicId} />
									<Field id={`accountability-${component.publicId}`} label="Accountability">
										<select
											class="nb-control"
											id={`accountability-${component.publicId}`}
											name="accountabilityType"
											required
										>
											<option value="accountable">Accountable</option>
											<option value="responsible">Responsible</option>
											<option value="assured">Assured</option>
											<option value="consulted">Consulted</option>
											<option value="informed">Informed</option>
										</select>
									</Field>
									<Field id={`position-${component.publicId}`} label="Position / role" required>
										<input
											class="nb-control"
											id={`position-${component.publicId}`}
											name="positionLabel"
											required
										/>
									</Field>
									<Field id={`member-${component.publicId}`} label="Named member" hint="Optional">
										<select
											class="nb-control"
											id={`member-${component.publicId}`}
											name="memberPublicId"
										>
											<option value="">Role only</option>
											{#each workspace.members as member (member.publicId)}
												<option value={member.publicId}>{member.name}</option>
											{/each}
										</select>
									</Field>
									<Field id={`notes-${component.publicId}`} label="Notes" hint="Optional">
										<textarea
											class="nb-control"
											id={`notes-${component.publicId}`}
											name="notes"
											rows="3"></textarea>
									</Field>
									<Button type="submit">Add accountability</Button>
								</form>
							</details>

							<details>
								<summary>Link delivery initiative</summary>
								<form method="POST" action="?/linkInitiative" use:enhance>
									<input type="hidden" name="componentPublicId" value={component.publicId} />
									<Field id={`initiative-${component.publicId}`} label="Initiative" required>
										<select
											class="nb-control"
											id={`initiative-${component.publicId}`}
											name="initiativePublicId"
											required
										>
											<option value="">Select initiative</option>
											{#each eligibleInitiatives(component.planPublicId) as initiative (initiative.publicId)}
												<option value={initiative.publicId}
													>{initiative.code} · {initiative.title}</option
												>
											{/each}
										</select>
									</Field>
									<Field id={`role-${component.publicId}`} label="Change role" required>
										<select
											class="nb-control"
											id={`role-${component.publicId}`}
											name="changeRole"
											required
										>
											<option value="transform">Transform</option>
											<option value="create">Create</option>
											<option value="enable">Enable</option>
											<option value="consume">Consume</option>
											<option value="retire">Retire</option>
										</select>
									</Field>
									<Button type="submit">Link initiative</Button>
								</form>
							</details>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{:else}
		<section class="empty-state">
			<h2>No target operating model has been designed yet.</h2>
			<p>
				Start from a draft business plan, then describe which capabilities, processes, organisation,
				information, technology or partner arrangements must change to deliver it.
			</p>
			{#if workspace.permissions.canManage && draftPlans.length > 0}
				<LinkButton
					href={routes.strategyOperatingModelNew(data.tenant.slug, workspace.framework.publicId)}
					>Design first component</LinkButton
				>
			{/if}
		</section>
	{/if}
</div>

<style>
	.operating-page,
	.component-list {
		display: grid;
		gap: var(--nb-space-6);
	}
	.operating-summary {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}
	.operating-summary div,
	.intro-card,
	.component-card,
	.empty-state {
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.operating-summary div {
		padding: var(--nb-space-5);
	}
	.operating-summary span {
		display: block;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
	}
	.operating-summary strong {
		display: block;
		margin-top: var(--nb-space-2);
		font-size: var(--nb-font-size-2xl);
	}
	.intro-card {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--nb-space-8);
		padding: var(--nb-space-6);
	}
	.intro-card h2,
	.component-card h2,
	.component-card h3,
	.empty-state h2 {
		margin: 0;
	}
	.intro-card p:last-child,
	.component-card header p,
	.empty-copy,
	.empty-state p {
		color: var(--nb-color-text-secondary);
	}
	.section-kicker,
	.component-code {
		margin: 0 0 var(--nb-space-2);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.component-card {
		padding: var(--nb-space-6);
	}
	.component-card header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-5);
	}
	.state-grid,
	.trace-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-5);
		margin-top: var(--nb-space-5);
	}
	.state-grid > div,
	.trace-grid > div {
		padding: var(--nb-space-4);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}
	.state-grid span {
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		color: var(--nb-color-text-muted);
	}
	.state-grid p {
		margin-bottom: 0;
		line-height: var(--nb-line-relaxed);
	}
	.parent-line {
		margin: var(--nb-space-4) 0 0;
	}
	.trace-grid ul {
		list-style: none;
		padding: 0;
		margin: var(--nb-space-3) 0 0;
		display: grid;
		gap: var(--nb-space-2);
	}
	.trace-grid li {
		display: grid;
		gap: 2px;
	}
	.trace-grid li strong {
		font-size: var(--nb-font-size-xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.edit-tools {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-4);
		margin-top: var(--nb-space-5);
	}
	details {
		border-top: 1px solid var(--nb-color-border-default);
		padding-top: var(--nb-space-4);
	}
	summary {
		cursor: pointer;
		font-weight: var(--nb-weight-semibold);
	}
	details form {
		display: grid;
		gap: var(--nb-space-4);
		margin-top: var(--nb-space-4);
	}
	.empty-state {
		padding: var(--nb-space-8);
	}
	@media (max-width: 850px) {
		.operating-summary,
		.state-grid,
		.trace-grid,
		.edit-tools {
			grid-template-columns: 1fr;
		}
		.intro-card,
		.component-card header {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
