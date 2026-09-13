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
	const values = $derived((form?.values ?? {}) as Record<string, string>);
	const draftPlans = $derived(data.plans.filter((plan) => plan.lifecycleStatus === 'draft'));
	const openInitiatives = $derived(
		data.initiatives.filter((initiative) =>
			['proposed', 'approved', 'in_progress'].includes(initiative.lifecycleStatus)
		)
	);
	const recordTitle = $derived(
		data.recordKind === 'plan'
			? 'Create business plan'
			: data.recordKind === 'initiative'
				? 'Create strategic initiative'
				: data.recordKind === 'requirement'
					? 'Quantify resource requirement'
					: 'Request cross-functional handoff'
	);
	const recordDescription = $derived(
		data.recordKind === 'plan'
			? 'Define a controlled planning period, financial envelope and the strategic objectives this plan will serve.'
			: data.recordKind === 'initiative'
				? 'Create an execution commitment under a draft business plan and one of its strategic objectives.'
				: data.recordKind === 'requirement'
					? 'Make funding, workforce, capacity or other execution demand explicit and quantified before handing it to the authoritative function.'
					: 'Transfer a planning request to the function that will own the canonical operational record.'
	);

	function fieldValue(key: string, fallback = ''): string {
		return values[key] ?? fallback;
	}

	let selectedPlanPublicId = $state(fieldValue('planPublicId'));
	let selectedObjectivePublicId = $state(fieldValue('objectivePublicId'));
	let selectedInitiativePublicId = $state(fieldValue('initiativePublicId'));
	const selectedPlan = $derived(
		draftPlans.find((plan) => plan.publicId === selectedPlanPublicId) ?? null
	);
	const planObjectives = $derived(
		selectedPlan
			? data.objectives.filter((objective) =>
					selectedPlan.objectivePublicIds.includes(objective.publicId)
				)
			: []
	);
	const selectedInitiative = $derived(
		openInitiatives.find((initiative) => initiative.publicId === selectedInitiativePublicId) ?? null
	);

	$effect(() => {
		if (!selectedPlanPublicId && draftPlans.length === 1) {
			selectedPlanPublicId = draftPlans[0]?.publicId ?? '';
		}
		if (!selectedInitiativePublicId && openInitiatives.length === 1) {
			selectedInitiativePublicId = openInitiatives[0]?.publicId ?? '';
		}
		if (!selectedPlan) {
			selectedObjectivePublicId = '';
			return;
		}
		if (!planObjectives.some((objective) => objective.publicId === selectedObjectivePublicId)) {
			selectedObjectivePublicId =
				planObjectives.length === 1 ? (planObjectives[0]?.publicId ?? '') : '';
		}
	});
</script>

<svelte:head>
	<title>{recordTitle} · {data.framework.title} · NuBlox</title>
</svelte:head>

<div class="nb-page-form transaction-page">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: data.framework.title,
				href: routes.strategyFramework(data.tenant.slug, data.framework.publicId)
			},
			{
				label: 'Business planning',
				href: routes.strategyBusinessPlanning(data.tenant.slug, data.framework.publicId)
			},
			{ label: recordTitle }
		]}
	/>

	<PageHeader
		eyebrow="F01.04 · Business planning transaction"
		title={recordTitle}
		description={recordDescription}
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Record not created">{form.formError}</Alert>
	{/if}

	<form method="POST" action="?/create" use:enhance class="transaction-form">
		{#if data.recordKind === 'plan'}
			<Panel
				title="Planning period"
				description="The business plan must sit inside the approved strategy horizon."
			>
				<div class="form-grid two">
					<Field id="title" label="Business plan title" required>
						<input
							class="nb-control"
							id="title"
							name="title"
							value={fieldValue('title')}
							required
							maxlength="255"
						/>
					</Field>
					<Field
						id="currencyCode"
						label="Planning currency"
						hint="Three-letter currency code, for example GBP."
						required
					>
						<input
							class="nb-control"
							id="currencyCode"
							name="currencyCode"
							value={fieldValue('currencyCode', 'GBP')}
							required
							maxlength="3"
						/>
					</Field>
					<Field id="periodStart" label="Period start" required>
						<input
							class="nb-control"
							id="periodStart"
							name="periodStart"
							type="date"
							value={fieldValue('periodStart', data.framework.horizonStart)}
							min={data.framework.horizonStart}
							max={data.framework.horizonEnd}
							required
						/>
					</Field>
					<Field id="periodEnd" label="Period end" required>
						<input
							class="nb-control"
							id="periodEnd"
							name="periodEnd"
							type="date"
							value={fieldValue('periodEnd', data.framework.horizonEnd)}
							min={data.framework.horizonStart}
							max={data.framework.horizonEnd}
							required
						/>
					</Field>
				</div>
				<Field
					id="narrative"
					label="Planning narrative"
					hint="Explain the planning basis, priorities and resource envelope."
					required
				>
					<textarea class="nb-control" id="narrative" name="narrative" rows="6" required
						>{fieldValue('narrative')}</textarea
					>
				</Field>
			</Panel>

			<Panel
				title="Financial planning envelope"
				description="These are F01 planning assumptions. Authoritative budgets and forecasts remain owned by F14 Finance."
			>
				<div class="form-grid three">
					<Field id="plannedRevenueAmount" label="Planned revenue">
						<input
							class="nb-control"
							id="plannedRevenueAmount"
							name="plannedRevenueAmount"
							inputmode="decimal"
							value={fieldValue('plannedRevenueAmount', '0')}
						/>
					</Field>
					<Field id="plannedOpexAmount" label="Planned opex">
						<input
							class="nb-control"
							id="plannedOpexAmount"
							name="plannedOpexAmount"
							inputmode="decimal"
							value={fieldValue('plannedOpexAmount', '0')}
						/>
					</Field>
					<Field id="plannedCapexAmount" label="Planned capex">
						<input
							class="nb-control"
							id="plannedCapexAmount"
							name="plannedCapexAmount"
							inputmode="decimal"
							value={fieldValue('plannedCapexAmount', '0')}
						/>
					</Field>
				</div>
			</Panel>

			<Panel
				title="Strategic objective scope"
				description="Select at least one traceable active objective. The first selected objective becomes the primary plan contribution."
			>
				<div class="selection-list">
					{#each data.objectives as objective (objective.publicId)}
						<label class="selection-row">
							<input type="checkbox" name="objectivePublicIds" value={objective.publicId} />
							<span
								><strong>{objective.code} · {objective.title}</strong><small
									>Priority {objective.priorityRank} · target {objective.targetDate ??
										'not set'}</small
								></span
							>
						</label>
					{:else}
						<p>
							No active strategic objectives are available. Return to F01.03 before creating a plan.
						</p>
					{/each}
				</div>
			</Panel>
		{:else if data.recordKind === 'initiative'}
			<Panel
				title="Execution context"
				description="Choose a draft business plan and an objective within the approved strategy."
			>
				<div class="form-grid two">
					<Field
						id="planPublicId"
						label="Business plan"
						hint="The selected plan governs the initiative period, currency and objective scope."
						required
					>
						<select
							class="nb-control"
							id="planPublicId"
							name="planPublicId"
							bind:value={selectedPlanPublicId}
							required
						>
							<option value="">Choose plan</option>
							{#each draftPlans as plan (plan.publicId)}
								<option value={plan.publicId}
									>{plan.code} · {plan.title} · {plan.periodStart} → {plan.periodEnd}</option
								>
							{/each}
						</select>
					</Field>
					<Field
						id="objectivePublicId"
						label="Strategic objective"
						hint="Only objectives already scoped into the selected business plan are available."
						required
					>
						<select
							class="nb-control"
							id="objectivePublicId"
							name="objectivePublicId"
							bind:value={selectedObjectivePublicId}
							disabled={!selectedPlan}
							required
						>
							<option value=""
								>{selectedPlan ? 'Choose objective' : 'Choose a business plan first'}</option
							>
							{#each planObjectives as objective (objective.publicId)}
								<option value={objective.publicId}>{objective.code} · {objective.title}</option>
							{/each}
						</select>
					</Field>
				</div>
				<div class="form-grid two">
					<Field id="title" label="Initiative title" required>
						<input
							class="nb-control"
							id="title"
							name="title"
							value={fieldValue('title')}
							required
							maxlength="255"
						/>
					</Field>
					<Field id="priorityRank" label="Priority rank" required>
						<input
							class="nb-control"
							id="priorityRank"
							name="priorityRank"
							type="number"
							min="1"
							value={fieldValue('priorityRank', '1')}
							required
						/>
					</Field>
				</div>
				<Field id="outcomeText" label="Intended outcome" required>
					<textarea class="nb-control" id="outcomeText" name="outcomeText" rows="5" required
						>{fieldValue('outcomeText')}</textarea
					>
				</Field>
				<Field id="benefitStatement" label="Benefit statement">
					<textarea class="nb-control" id="benefitStatement" name="benefitStatement" rows="4"
						>{fieldValue('benefitStatement')}</textarea
					>
				</Field>
			</Panel>
			<Panel
				title="Timing and planning demand"
				description={selectedPlan
					? `${selectedPlan.code} supplies the default initiative window and planning currency. You can narrow the dates, but not move outside the plan period.`
					: 'Select a business plan to inherit its planning window and currency.'}
			>
				<div class="form-grid two">
					<Field
						id="startDate"
						label="Start date"
						hint={selectedPlan
							? `Defaults to ${selectedPlan.periodStart} from ${selectedPlan.code}.`
							: undefined}
						required
					>
						<input
							class="nb-control"
							id="startDate"
							name="startDate"
							type="date"
							value={fieldValue('startDate', selectedPlan?.periodStart ?? '')}
							min={selectedPlan?.periodStart}
							max={selectedPlan?.periodEnd}
							required
						/>
					</Field>
					<Field
						id="endDate"
						label="End date"
						hint={selectedPlan
							? `Defaults to ${selectedPlan.periodEnd} from ${selectedPlan.code}.`
							: undefined}
						required
					>
						<input
							class="nb-control"
							id="endDate"
							name="endDate"
							type="date"
							value={fieldValue('endDate', selectedPlan?.periodEnd ?? '')}
							min={selectedPlan?.periodStart}
							max={selectedPlan?.periodEnd}
							required
						/>
					</Field>
					<Field id="plannedInvestmentAmount" label="Planned investment"
						><input
							class="nb-control"
							id="plannedInvestmentAmount"
							name="plannedInvestmentAmount"
							inputmode="decimal"
							value={fieldValue('plannedInvestmentAmount', '0')}
						/></Field
					>
					<Field id="plannedFte" label="Planned FTE"
						><input
							class="nb-control"
							id="plannedFte"
							name="plannedFte"
							inputmode="decimal"
							value={fieldValue('plannedFte', '0')}
						/></Field
					>
					<Field
						id="currencyCode"
						label="Currency"
						hint={selectedPlan ? `Inherited from ${selectedPlan.code}.` : undefined}
						required
					>
						<input
							class="nb-control"
							id="currencyCode"
							name="currencyCode"
							value={fieldValue('currencyCode', selectedPlan?.currencyCode ?? 'GBP')}
							maxlength="3"
							required
						/>
					</Field>
				</div>
			</Panel>
		{:else if data.recordKind === 'requirement'}
			<Panel
				title="Execution requirement"
				description="A resource need must be quantified and routed to the function that will own the canonical commitment."
			>
				<div class="form-grid two">
					<Field
						id="initiativePublicId"
						label="Initiative"
						hint="The initiative supplies the valid need-by window and planning currency."
						required
					>
						<select
							class="nb-control"
							id="initiativePublicId"
							name="initiativePublicId"
							bind:value={selectedInitiativePublicId}
							required
						>
							<option value="">Choose initiative</option>
							{#each openInitiatives as initiative (initiative.publicId)}
								<option value={initiative.publicId}
									>{initiative.code} · {initiative.title} · {initiative.startDate} → {initiative.endDate}</option
								>
							{/each}
						</select>
					</Field>
					<Field id="requirementType" label="Requirement type" required>
						<select class="nb-control" id="requirementType" name="requirementType" required>
							<option value="funding">Funding</option><option value="workforce">Workforce</option
							><option value="capacity">Capacity</option><option value="technology"
								>Technology</option
							><option value="asset">Asset</option><option value="supplier">Supplier</option><option
								value="other">Other</option
							>
						</select>
					</Field>
					<Field id="title" label="Requirement title" required
						><input
							class="nb-control"
							id="title"
							name="title"
							value={fieldValue('title')}
							required
							maxlength="255"
						/></Field
					>
					<Field
						id="targetFunctionCode"
						label="Target function"
						hint="Examples: F14 Finance, F15 HCM, F27 PPM."
						required
						><input
							class="nb-control"
							id="targetFunctionCode"
							name="targetFunctionCode"
							value={fieldValue('targetFunctionCode', 'F14')}
							required
							maxlength="3"
						/></Field
					>
				</div>
				<Field id="description" label="Requirement description" required
					><textarea class="nb-control" id="description" name="description" rows="5" required
						>{fieldValue('description')}</textarea
					></Field
				>
				<div class="form-grid three">
					<Field id="amount" label="Amount"
						><input
							class="nb-control"
							id="amount"
							name="amount"
							inputmode="decimal"
							value={fieldValue('amount')}
						/></Field
					>
					<Field
						id="currencyCode"
						label="Currency"
						hint={selectedInitiative ? `Inherited from ${selectedInitiative.code}.` : undefined}
					>
						<input
							class="nb-control"
							id="currencyCode"
							name="currencyCode"
							value={fieldValue('currencyCode', selectedInitiative?.currencyCode ?? 'GBP')}
							maxlength="3"
						/>
					</Field>
					<Field
						id="needBy"
						label="Need by"
						hint={selectedInitiative
							? `Must fall within ${selectedInitiative.startDate} to ${selectedInitiative.endDate}; defaults to initiative start.`
							: 'Select an initiative to inherit its valid delivery window.'}
					>
						<input
							class="nb-control"
							id="needBy"
							name="needBy"
							type="date"
							value={fieldValue('needBy', selectedInitiative?.startDate ?? '')}
							min={selectedInitiative?.startDate}
							max={selectedInitiative?.endDate}
						/>
					</Field>
					<Field id="quantity" label="Quantity"
						><input
							class="nb-control"
							id="quantity"
							name="quantity"
							inputmode="decimal"
							value={fieldValue('quantity')}
						/></Field
					>
					<Field id="unitLabel" label="Unit"
						><input
							class="nb-control"
							id="unitLabel"
							name="unitLabel"
							value={fieldValue('unitLabel')}
							maxlength="64"
							placeholder="FTE, hours, units, seats…"
						/></Field
					>
				</div>
			</Panel>
		{:else}
			<Panel
				title="Handoff request"
				description="The request remains F01 evidence until the receiving function accepts it and returns its canonical record reference."
			>
				<div class="form-grid two">
					<Field id="initiativePublicId" label="Initiative" required>
						<select class="nb-control" id="initiativePublicId" name="initiativePublicId" required>
							<option value="">Choose initiative</option>
							{#each openInitiatives as initiative (initiative.publicId)}
								<option value={initiative.publicId}>{initiative.code} · {initiative.title}</option>
							{/each}
						</select>
					</Field>
					<Field
						id="resourceRequirementPublicId"
						label="Linked resource requirement"
						hint="Optional. If selected, the target function must match the requirement."
					>
						<select
							class="nb-control"
							id="resourceRequirementPublicId"
							name="resourceRequirementPublicId"
						>
							<option value="">No linked requirement</option>
							{#each data.resourceRequirements as requirement (requirement.publicId)}
								<option value={requirement.publicId}
									>{requirement.initiativeCode} · {requirement.title} → {requirement.targetFunctionCode}</option
								>
							{/each}
						</select>
					</Field>
					<Field id="handoffType" label="Handoff type" required>
						<select class="nb-control" id="handoffType" name="handoffType" required>
							<option value="funding">Funding</option><option value="workforce">Workforce</option
							><option value="delivery">Delivery</option><option value="change">Change</option
							><option value="risk">Risk</option><option value="procurement">Procurement</option
							><option value="technology">Technology</option><option value="other">Other</option>
						</select>
					</Field>
					<Field id="targetFunctionCode" label="Target function" required
						><input
							class="nb-control"
							id="targetFunctionCode"
							name="targetFunctionCode"
							value={fieldValue('targetFunctionCode', 'F14')}
							maxlength="3"
							required
						/></Field
					>
				</div>
				<Field id="requestSummary" label="Request summary" required
					><textarea class="nb-control" id="requestSummary" name="requestSummary" rows="6" required
						>{fieldValue('requestSummary')}</textarea
					></Field
				>
			</Panel>
		{/if}

		<div class="form-actions">
			<LinkButton
				href={routes.strategyBusinessPlanning(data.tenant.slug, data.framework.publicId)}
				variant="quiet">Cancel</LinkButton
			>
			<Button type="submit">{recordTitle}</Button>
		</div>
	</form>
</div>

<style>
	.transaction-page,
	.transaction-form,
	.selection-list {
		display: grid;
		gap: var(--nb-space-6);
	}
	.transaction-page {
		padding-bottom: var(--nb-space-16);
	}
	.form-grid {
		display: grid;
		gap: var(--nb-space-5);
		margin-bottom: var(--nb-space-5);
	}
	.form-grid.two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.form-grid.three {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.selection-list {
		gap: var(--nb-space-3);
	}
	.selection-row {
		display: flex;
		align-items: flex-start;
		gap: var(--nb-space-3);
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-md);
		cursor: pointer;
	}
	.selection-row span {
		display: grid;
		gap: var(--nb-space-1);
	}
	.selection-row small {
		color: var(--nb-color-text-muted);
	}
	.form-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--nb-space-4);
	}
	@media (max-width: 720px) {
		.form-grid.two,
		.form-grid.three {
			grid-template-columns: 1fr;
		}
	}
</style>
