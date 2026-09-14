<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		LinkButton,
		PageHeader,
		Panel,
		ReadinessChecklist,
		Stat,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const strategyApproved = $derived(data.framework.lifecycleStatus === 'approved');
	const editable = $derived(data.permissions.canManage && strategyApproved);
	const openHandoffs = $derived(
		data.handoffs.filter((handoff) => handoff.lifecycleStatus === 'requested')
	);
	const openRequirements = $derived(
		data.resourceRequirements.filter((requirement) =>
			['identified', 'requested', 'committed'].includes(requirement.lifecycleStatus)
		)
	);
	const activeInitiatives = $derived(
		data.initiatives.filter((initiative) =>
			['proposed', 'approved', 'in_progress'].includes(initiative.lifecycleStatus)
		)
	);
	const approvalReadinessItems = $derived([
		{
			key: 'selected-option',
			label: 'Strategic option selected',
			ready: data.approvalReadiness.selectedOptionCount > 0,
			detail:
				data.approvalReadiness.selectedOptionCount > 0
					? `${data.approvalReadiness.selectedOptionCount} strategic option${data.approvalReadiness.selectedOptionCount === 1 ? '' : 's'} selected as an enterprise choice.`
					: data.approvalReadiness.totalOptionCount > 0
						? 'Strategic options exist, but none has been selected. Record the decision and rationale before approval.'
						: 'No strategic option exists yet. Create and evaluate an option before the strategy can become an approved direction.',
			actionLabel: data.approvalReadiness.totalOptionCount > 0 ? 'Review options' : 'Create option',
			actionHref:
				data.approvalReadiness.totalOptionCount > 0
					? routes.strategyPlanning(data.tenant.slug, data.framework.publicId)
					: routes.strategyPlanningNew(data.tenant.slug, data.framework.publicId, 'option')
		},
		{
			key: 'primary-theme',
			label: 'Primary strategic theme defined',
			ready: data.approvalReadiness.activeThemeCount > 0,
			detail:
				data.approvalReadiness.activeThemeCount > 0
					? `${data.approvalReadiness.activeThemeCount} active strategic theme${data.approvalReadiness.activeThemeCount === 1 ? '' : 's'} available for objective alignment.`
					: 'No active strategic theme exists. Define the outcome themes that organise and communicate the strategic direction.',
			actionLabel: 'Create theme',
			actionHref: routes.strategyPlanningNew(data.tenant.slug, data.framework.publicId, 'theme')
		},
		{
			key: 'traceable-objective',
			label: 'Traceable objective ready for approval',
			ready: data.approvalReadiness.traceableCandidateObjectiveCount > 0,
			detail:
				data.approvalReadiness.traceableCandidateObjectiveCount > 0
					? `${data.approvalReadiness.traceableCandidateObjectiveCount} objective${data.approvalReadiness.traceableCandidateObjectiveCount === 1 ? '' : 's'} are approval-ready with selected-option lineage and an active primary theme. Draft objectives become active in the approval transaction.`
					: data.approvalReadiness.approvalCandidateObjectiveCount === 0
						? 'No draft or active objective exists. Create an objective derived from a selected option and assign its primary strategic theme.'
						: data.approvalReadiness.optionLinkedCandidateObjectiveCount === 0 &&
							  data.approvalReadiness.primaryThemeCandidateObjectiveCount === 0
							? 'Objectives exist, but none carries selected-option lineage or a primary strategic theme.'
							: data.approvalReadiness.optionLinkedCandidateObjectiveCount === 0
								? 'Objectives exist, but none is linked to a selected strategic option.'
								: data.approvalReadiness.primaryThemeCandidateObjectiveCount === 0
									? 'Objectives exist, but none has an active primary strategic theme.'
									: 'Objective links exist, but no single draft or active objective currently carries both the selected-option lineage and primary theme required for approval.',
			actionLabel:
				data.approvalReadiness.approvalCandidateObjectiveCount > 0
					? 'Review objectives'
					: 'Create objective',
			actionHref:
				data.approvalReadiness.approvalCandidateObjectiveCount > 0
					? routes.strategyPlanning(data.tenant.slug, data.framework.publicId)
					: routes.strategyPlanningNew(data.tenant.slug, data.framework.publicId, 'objective')
		},
		{
			key: 'approval-authority',
			label: 'Approval authority available',
			ready: data.approvalReadiness.canApprove,
			detail: data.approvalReadiness.canApprove
				? 'Your effective permissions include strategy approval authority.'
				: 'Your effective permissions do not include strategy approval. An authorised approver must complete the governed transition.'
		},
		{
			key: 'current-strategy-slot',
			label: 'Current strategy slot available',
			ready: data.approvalReadiness.conflictingApprovedStrategy === null,
			detail: data.approvalReadiness.conflictingApprovedStrategy
				? `Approved strategy ${data.approvalReadiness.conflictingApprovedStrategy.code} already occupies the current enterprise-strategy slot. Use controlled revision rather than creating parallel approved directions.`
				: 'There is no competing approved strategy version blocking this transition.',
			actionLabel: data.approvalReadiness.conflictingApprovedStrategy
				? 'Review strategy cycles'
				: undefined,
			actionHref: data.approvalReadiness.conflictingApprovedStrategy
				? routes.strategy(data.tenant.slug)
				: undefined
		}
	]);

	function money(value: string, currency: string): string {
		const number = Number(value);
		if (!Number.isFinite(number)) return `${currency} ${value}`;
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency,
			maximumFractionDigits: 0
		}).format(number);
	}

	function statusTone(status: string): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
		if (['approved', 'fulfilled', 'satisfied', 'completed'].includes(status)) return 'success';
		if (['requested', 'committed', 'in_progress'].includes(status)) return 'info';
		if (['cancelled', 'rejected'].includes(status)) return 'danger';
		if (['draft', 'identified', 'proposed'].includes(status)) return 'warning';
		return 'neutral';
	}
</script>

<svelte:head>
	<title>Business planning · {data.framework.title} · NuBlox</title>
	<meta
		name="description"
		content="F01.04 Business Planning — translate approved strategic objectives into plans, initiatives, resource requirements and governed downstream handoffs."
	/>
</svelte:head>

{#snippet headerActions()}
	{#if editable}
		<LinkButton
			href={routes.strategyBusinessPlanningNew(data.tenant.slug, data.framework.publicId, 'plan')}
			variant="secondary">Add business plan</LinkButton
		>
		{#if data.plans.some((plan) => plan.lifecycleStatus === 'draft')}
			<LinkButton
				href={routes.strategyBusinessPlanningNew(
					data.tenant.slug,
					data.framework.publicId,
					'initiative'
				)}>Add initiative</LinkButton
			>
		{/if}
	{/if}
{/snippet}

<div class="nb-page-wide business-planning-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(data.tenant.slug) },
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: data.framework.title,
				href: routes.strategyFramework(data.tenant.slug, data.framework.publicId)
			},
			{ label: 'Business planning' }
		]}
	/>

	<PageHeader
		eyebrow="F01.04 · Business planning"
		title="Turn strategic intent into funded, resourced execution"
		description="Business plans scope strategic objectives. Initiatives carry outcomes, investment and capacity assumptions. Quantified needs are handed to the authoritative Finance, HCM, Portfolio and other downstream functions rather than duplicated inside Strategy."
		actions={headerActions}
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Governed action could not be completed">{form.formError}</Alert>
	{/if}

	{#if !strategyApproved}
		<Alert tone="info" title="Business planning is locked until strategy approval">
			This strategy is still {data.framework.lifecycleStatus}. Complete the governed prerequisites
			below. NuBlox will only unlock F01.04 when the strategic choice, theme and objective lineage
			are explicit and an authorised approver can complete the transition.
		</Alert>

		<ReadinessChecklist
			title="Strategy approval readiness"
			description="Approval is a controlled enterprise transition. The checklist explains each prerequisite and takes you directly to the upstream record that needs attention."
			items={approvalReadinessItems}
		/>

		{#if data.approvalReadiness.canApprove && data.framework.lifecycleStatus === 'draft'}
			<Panel
				title="Approve the strategic direction"
				description={data.approvalReadiness.ready
					? 'All approval prerequisites are satisfied. NuBlox will re-check them inside the approval transaction before committing the strategy.'
					: 'Complete every approval prerequisite above before committing this strategy as the current enterprise direction.'}
			>
				<form method="POST" action="?/approveStrategy" use:enhance>
					<Button type="submit" disabled={!data.approvalReadiness.ready}>
						Approve strategy for business planning
					</Button>
				</form>
			</Panel>
		{/if}
	{/if}

	<section class="stat-grid" aria-label="Business planning summary">
		<Stat
			label="Business plans"
			value={String(data.plans.length)}
			detail="Controlled planning versions"
		/>
		<Stat
			label="Active initiatives"
			value={String(activeInitiatives.length)}
			detail="Execution commitments"
			tone="info"
		/>
		<Stat
			label="Resource needs"
			value={String(openRequirements.length)}
			detail="Quantified requirements"
		/>
		<Stat
			label="Open handoffs"
			value={String(openHandoffs.length)}
			detail="Awaiting downstream ownership"
			tone={openHandoffs.length > 0 ? 'warning' : 'neutral'}
		/>
	</section>

	<section class="thread-panel" aria-labelledby="thread-title">
		<div>
			<p class="section-kicker">Execution digital thread</p>
			<h2 id="thread-title">Objective → plan → initiative → requirement → handoff</h2>
			<p>
				F01 owns the strategic intent and planning request. The receiving business function owns its
				canonical budget, workforce, project, procurement, risk or technology record.
			</p>
		</div>
		<div class="thread-actions">
			<LinkButton
				href={routes.strategyPlanning(data.tenant.slug, data.framework.publicId)}
				variant="secondary">Review strategic objectives</LinkButton
			>
			<LinkButton href={routes.strategyPerformance(data.tenant.slug, data.framework.publicId)}
				>Continue to F01.06 performance</LinkButton
			>
		</div>
	</section>

	<section class="workspace-section" aria-labelledby="plans-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">Business plans</p>
				<h2 id="plans-title">Define the planning envelope before creating initiatives</h2>
			</div>
			{#if editable}
				<LinkButton
					href={routes.strategyBusinessPlanningNew(
						data.tenant.slug,
						data.framework.publicId,
						'plan'
					)}
					variant="quiet">Add plan</LinkButton
				>
			{/if}
		</div>

		{#if data.plans.length > 0}
			<div class="plan-grid">
				{#each data.plans as plan (plan.publicId)}
					<article>
						<div class="record-heading">
							<div>
								<span class="record-code">{plan.code} · v{plan.versionNumber}</span>
								<h3>{plan.title}</h3>
							</div>
							<StatusBadge label={plan.lifecycleStatus} tone={statusTone(plan.lifecycleStatus)} />
						</div>
						<p>{plan.narrative}</p>
						<div class="plan-meta">
							<span>{plan.periodStart} → {plan.periodEnd}</span>
							<span>{plan.objectiveCount} objectives</span>
							<span>{plan.initiativeCount} active initiatives</span>
						</div>
						<div class="financial-envelope">
							<div>
								<span>Revenue</span><strong
									>{money(plan.plannedRevenueAmount, plan.currencyCode)}</strong
								>
							</div>
							<div>
								<span>Opex</span><strong>{money(plan.plannedOpexAmount, plan.currencyCode)}</strong>
							</div>
							<div>
								<span>Capex</span><strong
									>{money(plan.plannedCapexAmount, plan.currencyCode)}</strong
								>
							</div>
						</div>
						{#if plan.lifecycleStatus === 'draft' && data.permissions.canApprove}
							<form method="POST" action="?/approvePlan" use:enhance class="approval-row">
								<input type="hidden" name="planPublicId" value={plan.publicId} />
								<div>
									<strong>Govern execution baseline</strong>
									<p>
										Approval requires objective scope, at least one initiative, and no resource
										requirement left without a downstream handoff.
									</p>
								</div>
								<Button type="submit" variant="secondary" size="sm">Approve business plan</Button>
							</form>
						{/if}

						<LinkButton
							href={routes.strategyManage(
								data.tenant.slug,
								data.framework.publicId,
								'plan',
								plan.publicId
							)}
							variant="quiet">Manage / lifecycle</LinkButton
						>
					</article>
				{/each}
			</div>
		{:else}
			<Panel
				title="No business plan yet"
				description="Once the strategy is approved, create a controlled planning period and select the strategic objectives it will fund and resource."
			>
				{#if editable}
					<LinkButton
						href={routes.strategyBusinessPlanningNew(
							data.tenant.slug,
							data.framework.publicId,
							'plan'
						)}>Create first business plan</LinkButton
					>
				{/if}
			</Panel>
		{/if}
	</section>

	<section class="workspace-section" aria-labelledby="initiatives-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">Strategic initiatives</p>
				<h2 id="initiatives-title">
					Every initiative must contribute to a planned strategic objective
				</h2>
			</div>
			{#if editable && data.plans.some((plan) => plan.lifecycleStatus === 'draft')}
				<LinkButton
					href={routes.strategyBusinessPlanningNew(
						data.tenant.slug,
						data.framework.publicId,
						'initiative'
					)}
					variant="quiet">Add initiative</LinkButton
				>
			{/if}
		</div>

		{#if data.initiatives.length > 0}
			<div class="initiative-list">
				{#each data.initiatives as initiative (initiative.publicId)}
					<article>
						<div class="record-heading">
							<div>
								<span class="record-code">{initiative.code} · {initiative.planCode}</span>
								<h3>{initiative.title}</h3>
							</div>
							<StatusBadge
								label={initiative.lifecycleStatus}
								tone={statusTone(initiative.lifecycleStatus)}
							/>
						</div>
						<p>{initiative.outcomeText}</p>
						<div class="initiative-meta">
							<span>Objective <strong>{initiative.objectiveCode}</strong></span>
							<span>Priority <strong>{initiative.priorityRank}</strong></span>
							<span>Dates <strong>{initiative.startDate} → {initiative.endDate}</strong></span>
							<span
								>Investment <strong
									>{money(initiative.plannedInvestmentAmount, initiative.currencyCode)}</strong
								></span
							>
							<span>Capacity <strong>{initiative.plannedFte} FTE</strong></span>
							<span
								>Thread <strong
									>{initiative.resourceRequirementCount} needs · {initiative.handoffCount} handoffs ·
									{initiative.kpiCount} KPIs</strong
								></span
							>
						</div>

						<LinkButton
							href={routes.strategyManage(
								data.tenant.slug,
								data.framework.publicId,
								'initiative',
								initiative.publicId
							)}
							variant="quiet">Manage / lifecycle</LinkButton
						>
					</article>
				{/each}
			</div>
		{:else}
			<Panel
				title="No initiatives yet"
				description="Initiatives are execution commitments, not generic tasks. They require a draft business plan and a strategic objective within that plan."
			/>
		{/if}
	</section>

	<section class="workspace-section split-section" aria-label="Resource and handoff control">
		<div>
			<div class="section-heading compact">
				<div>
					<p class="section-kicker">Resource requirements</p>
					<h2>Quantify what execution needs</h2>
				</div>
				{#if editable && data.initiatives.length > 0}
					<LinkButton
						href={routes.strategyBusinessPlanningNew(
							data.tenant.slug,
							data.framework.publicId,
							'requirement'
						)}
						variant="quiet">Add requirement</LinkButton
					>
				{/if}
			</div>
			<div class="compact-list">
				{#each data.resourceRequirements as requirement (requirement.publicId)}
					<article>
						<div>
							<strong>{requirement.title}</strong>
							<span>{requirement.initiativeCode} → {requirement.targetFunctionCode}</span>
						</div>
						<p>{requirement.description}</p>
						<div class="record-footer">
							<span
								>{requirement.amount
									? money(requirement.amount, requirement.currencyCode ?? 'GBP')
									: `${requirement.quantity} ${requirement.unitLabel}`}</span
							>
							<StatusBadge
								label={requirement.lifecycleStatus}
								tone={statusTone(requirement.lifecycleStatus)}
							/>
						</div>

						<LinkButton
							href={routes.strategyManage(
								data.tenant.slug,
								data.framework.publicId,
								'requirement',
								requirement.publicId
							)}
							variant="quiet">Manage</LinkButton
						>
					</article>
				{:else}
					<p class="muted-copy">No quantified resource requirements have been recorded.</p>
				{/each}
			</div>
		</div>

		<div>
			<div class="section-heading compact">
				<div>
					<p class="section-kicker">Cross-functional handoffs</p>
					<h2>Transfer ownership without copying the downstream record</h2>
				</div>
				{#if editable && data.initiatives.length > 0}
					<LinkButton
						href={routes.strategyBusinessPlanningNew(
							data.tenant.slug,
							data.framework.publicId,
							'handoff'
						)}
						variant="quiet">Request handoff</LinkButton
					>
				{/if}
			</div>
			<div class="compact-list">
				{#each data.handoffs as handoff (handoff.publicId)}
					<article>
						<div>
							<strong>{handoff.handoffType} → {handoff.targetFunctionCode}</strong>
							<span>{handoff.initiativeCode}</span>
						</div>
						<p>{handoff.requestSummary}</p>
						<div class="record-footer">
							<span
								>{handoff.targetRecordType && handoff.targetPublicId
									? `${handoff.targetRecordType} · ${handoff.targetPublicId}`
									: 'Awaiting canonical downstream record'}</span
							>
							<StatusBadge
								label={handoff.lifecycleStatus}
								tone={statusTone(handoff.lifecycleStatus)}
							/>
						</div>

						<LinkButton
							href={routes.strategyManage(
								data.tenant.slug,
								data.framework.publicId,
								'handoff',
								handoff.publicId
							)}
							variant="quiet">Manage / lifecycle</LinkButton
						>
					</article>
				{:else}
					<p class="muted-copy">No downstream execution handoffs have been requested.</p>
				{/each}
			</div>
		</div>
	</section>

	<Panel
		title="Cross-domain ownership boundary"
		description="F01 records the strategic request and preserves traceability. The receiving function becomes authoritative for the operational transaction."
	>
		<div class="ownership-grid">
			<div>
				<strong>F14 Finance</strong><span>Funding, budget, forecast and financial actuals</span>
			</div>
			<div>
				<strong>F15 Human Capital</strong><span
					>Workforce, roles, capacity and people commitments</span
				>
			</div>
			<div>
				<strong>F27 PPM</strong><span>Portfolio, programme and project delivery records</span>
			</div>
			<div>
				<strong>F20 / F28 / F29</strong><span
					>Risk, transformation and improvement consequences</span
				>
			</div>
		</div>
	</Panel>
</div>

<style>
	.business-planning-page {
		display: grid;
		gap: var(--nb-space-8);
		padding-bottom: var(--nb-space-16);
	}
	.stat-grid,
	.plan-grid,
	.ownership-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-5);
	}
	.thread-panel {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.6fr);
		gap: var(--nb-space-8);
		align-items: center;
		padding: var(--nb-space-6);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.thread-panel h2,
	.section-heading h2 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-xl);
		letter-spacing: -0.025em;
	}
	.thread-panel p:not(.section-kicker) {
		margin: var(--nb-space-3) 0 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.thread-actions {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: var(--nb-space-3);
	}
	.section-kicker,
	.record-code {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.workspace-section {
		display: grid;
		gap: var(--nb-space-5);
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--nb-space-6);
	}
	.section-heading.compact h2 {
		font-size: var(--nb-font-size-lg);
	}
	.plan-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.plan-grid article,
	.initiative-list article,
	.compact-list article {
		padding: var(--nb-space-5);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.record-heading,
	.record-footer {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-4);
	}
	.record-heading h3 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-lg);
	}
	.plan-grid article > p,
	.initiative-list article > p,
	.compact-list article > p {
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.plan-meta,
	.initiative-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-3) var(--nb-space-5);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
	}
	.financial-envelope {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--nb-space-3);
		margin-top: var(--nb-space-5);
		padding-top: var(--nb-space-4);
		border-top: 1px solid var(--nb-color-border-default);
	}
	.financial-envelope div,
	.ownership-grid div {
		display: grid;
		gap: var(--nb-space-1);
	}
	.financial-envelope span,
	.ownership-grid span,
	.compact-list span,
	.muted-copy {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
	}
	.initiative-list,
	.compact-list {
		display: grid;
		gap: var(--nb-space-4);
	}
	.split-section {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-8);
	}
	.compact-list article > div:first-child {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-4);
	}
	.ownership-grid div {
		padding: var(--nb-space-4);
		border-left: 2px solid var(--nb-color-border-strong);
	}
	@media (max-width: 980px) {
		.stat-grid,
		.ownership-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.plan-grid,
		.thread-panel,
		.split-section {
			grid-template-columns: 1fr;
		}
		.thread-actions {
			justify-content: flex-start;
		}
	}
	@media (max-width: 640px) {
		.stat-grid,
		.ownership-grid,
		.financial-envelope {
			grid-template-columns: 1fr;
		}
		.section-heading,
		.record-heading,
		.record-footer {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
