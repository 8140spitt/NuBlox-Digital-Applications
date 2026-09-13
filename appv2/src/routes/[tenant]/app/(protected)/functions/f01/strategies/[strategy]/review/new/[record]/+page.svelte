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
	const draftReviews = $derived(
		data.reviews.filter((review) => review.lifecycleStatus === 'draft')
	);
	const recordTitle = $derived(
		data.recordKind === 'review' ? 'Start strategic review' : 'Record review decision'
	);

	function fieldValue(key: string, fallback = ''): string {
		return values[key] ?? fallback;
	}

	let selectedReviewPublicId = $state(fieldValue('reviewPublicId'));
	const selectedReview = $derived(
		draftReviews.find((review) => review.publicId === selectedReviewPublicId) ?? null
	);

	$effect(() => {
		if (!selectedReviewPublicId && draftReviews.length === 1) {
			selectedReviewPublicId = draftReviews[0]?.publicId ?? '';
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
				label: 'Strategic review',
				href: routes.strategyReview(data.tenant.slug, data.framework.publicId)
			},
			{ label: recordTitle }
		]}
	/>

	<PageHeader
		eyebrow="F01.07 · Strategic review transaction"
		title={recordTitle}
		description={data.recordKind === 'review'
			? 'Create a dated review and freeze the latest approved KPI observations available at that date.'
			: 'Capture a management intervention as an accountable record linked to the evidence or execution record it affects.'}
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Review record not created">{form.formError}</Alert>
	{/if}

	<form method="POST" action="?/create" use:enhance class="transaction-form">
		{#if data.recordKind === 'review'}
			<Panel
				title="Review evidence cut"
				description="NuBlox uses the latest observation on or before the review date for every approved KPI that has evidence."
			>
				<div class="form-grid two">
					<Field
						id="reviewDate"
						label="Review date"
						hint={`Must fall within the strategy horizon ${data.framework.horizonStart} to ${data.framework.horizonEnd}.`}
						required
					>
						<input
							class="nb-control"
							id="reviewDate"
							name="reviewDate"
							type="date"
							value={fieldValue('reviewDate')}
							min={data.framework.horizonStart}
							max={data.framework.horizonEnd}
							required
						/>
					</Field>
					<Field id="title" label="Review title" required>
						<input
							class="nb-control"
							id="title"
							name="title"
							value={fieldValue('title')}
							maxlength="255"
							required
						/>
					</Field>
				</div>
				<Field
					id="summary"
					label="Management assessment"
					hint="Summarise what the evidence says before individual decisions are recorded."
					required
				>
					<textarea class="nb-control" id="summary" name="summary" rows="8" required
						>{fieldValue('summary')}</textarea
					>
				</Field>
			</Panel>

			<Panel
				title="Evidence available to reviews"
				description="Only approved KPI definitions with actual observations can enter a frozen review snapshot."
			>
				<div class="evidence-list">
					{#each data.kpis.filter((kpi) => kpi.lifecycleStatus === 'approved') as kpi (kpi.publicId)}
						<div>
							<strong>{kpi.code} · {kpi.title}</strong>
							<span
								>{kpi.latestActualValue === null
									? 'No actual observation yet'
									: `Latest ${kpi.latestActualValue} ${kpi.unitLabel} on ${kpi.latestObservedOn}`}</span
							>
						</div>
					{:else}
						<p>No approved KPIs are currently available. Return to F01.06 first.</p>
					{/each}
				</div>
			</Panel>
		{:else}
			<Panel
				title="Decision context"
				description="Decisions can point directly to an objective, initiative or KPI. At least the review itself remains the governing context."
			>
				<div class="form-grid two">
					<Field id="reviewPublicId" label="Draft strategic review" required>
						<select
							class="nb-control"
							id="reviewPublicId"
							name="reviewPublicId"
							bind:value={selectedReviewPublicId}
							required
						>
							<option value="">Choose review</option>
							{#each draftReviews as review (review.publicId)}
								<option value={review.publicId}>{review.code} · {review.title}</option>
							{/each}
						</select>
					</Field>
					<Field id="decisionType" label="Decision type" required>
						<select class="nb-control" id="decisionType" name="decisionType" required>
							<option value="continue">Continue</option>
							<option value="accelerate">Accelerate</option>
							<option value="rephase">Rephase</option>
							<option value="pause">Pause</option>
							<option value="stop">Stop</option>
							<option value="revise_strategy">Revise strategy</option>
							<option value="revise_plan">Revise business plan</option>
							<option value="corrective_action">Corrective action</option>
						</select>
					</Field>
				</div>
				<Field id="decisionText" label="Decision" required>
					<textarea class="nb-control" id="decisionText" name="decisionText" rows="5" required
						>{fieldValue('decisionText')}</textarea
					>
				</Field>
				<Field id="rationale" label="Decision rationale" required>
					<textarea class="nb-control" id="rationale" name="rationale" rows="5" required
						>{fieldValue('rationale')}</textarea
					>
				</Field>
				<Field
					id="dueDate"
					label="Due date"
					hint={selectedReview
						? `Cannot be before the selected review date ${selectedReview.reviewDate}.`
						: 'Select the draft review to establish the earliest valid due date.'}
				>
					<input
						class="nb-control"
						id="dueDate"
						name="dueDate"
						type="date"
						value={fieldValue('dueDate')}
						min={selectedReview?.reviewDate}
					/>
				</Field>
			</Panel>

			<Panel
				title="Affected strategic record"
				description="Use the most specific links that explain what this decision changes. All links are validated inside the same strategy cycle."
			>
				<div class="form-grid three">
					<Field id="objectivePublicId" label="Objective">
						<select class="nb-control" id="objectivePublicId" name="objectivePublicId">
							<option value="">No objective link</option>
							{#each data.objectives as objective (objective.publicId)}
								<option value={objective.publicId}>{objective.code} · {objective.title}</option>
							{/each}
						</select>
					</Field>
					<Field id="initiativePublicId" label="Initiative">
						<select class="nb-control" id="initiativePublicId" name="initiativePublicId">
							<option value="">No initiative link</option>
							{#each data.initiatives as initiative (initiative.publicId)}
								<option value={initiative.publicId}>{initiative.code} · {initiative.title}</option>
							{/each}
						</select>
					</Field>
					<Field id="kpiPublicId" label="KPI">
						<select class="nb-control" id="kpiPublicId" name="kpiPublicId">
							<option value="">No KPI link</option>
							{#each data.kpis as kpi (kpi.publicId)}
								<option value={kpi.publicId}>{kpi.code} · {kpi.title}</option>
							{/each}
						</select>
					</Field>
				</div>
			</Panel>
		{/if}

		<div class="form-actions">
			<LinkButton
				href={routes.strategyReview(data.tenant.slug, data.framework.publicId)}
				variant="quiet">Cancel</LinkButton
			>
			<Button type="submit">{recordTitle}</Button>
		</div>
	</form>
</div>

<style>
	.transaction-page,
	.transaction-form,
	.evidence-list {
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
	.evidence-list {
		gap: var(--nb-space-3);
	}
	.evidence-list div {
		display: grid;
		gap: var(--nb-space-1);
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-md);
	}
	.evidence-list span {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
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
