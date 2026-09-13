<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		LinkButton,
		PageHeader,
		Panel,
		Stat,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const approvedReviews = $derived(
		data.reviews.filter((review) => review.lifecycleStatus === 'approved')
	);
	const openDecisions = $derived(
		data.decisions.filter((decision) => ['open', 'in_progress'].includes(decision.lifecycleStatus))
	);
	const canCreate = $derived(
		data.permissions.canManage && data.framework.lifecycleStatus === 'approved'
	);

	function statusTone(status: string): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
		if (['approved', 'completed'].includes(status)) return 'success';
		if (['open', 'in_progress'].includes(status)) return 'warning';
		if (status === 'cancelled') return 'neutral';
		if (status === 'draft') return 'info';
		return 'neutral';
	}
</script>

<svelte:head>
	<title>Strategic review · {data.framework.title} · NuBlox</title>
	<meta
		name="description"
		content="F01.07 Strategic Review — freeze performance evidence, record decisions and maintain accountable corrective action."
	/>
</svelte:head>

{#snippet headerActions()}
	{#if canCreate}
		<LinkButton
			href={routes.strategyReviewNew(data.tenant.slug, data.framework.publicId, 'review')}
			variant="secondary">Start review</LinkButton
		>
		{#if data.reviews.some((review) => review.lifecycleStatus === 'draft')}
			<LinkButton
				href={routes.strategyReviewNew(data.tenant.slug, data.framework.publicId, 'decision')}
				>Record decision</LinkButton
			>
		{/if}
	{/if}
{/snippet}

<div class="nb-page-wide review-page">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: data.framework.title,
				href: routes.strategyFramework(data.tenant.slug, data.framework.publicId)
			},
			{ label: 'Strategic review' }
		]}
	/>

	<PageHeader
		eyebrow="F01.07 · Strategic review"
		title="Review the evidence, decide what changes, and preserve accountability"
		description="A strategic review freezes the latest approved KPI evidence available at its review date. Decisions are structured, attributable records linked to the objective, initiative or KPI they affect."
		actions={headerActions}
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Review action not completed">{form.formError}</Alert>
	{/if}

	<section class="stat-grid" aria-label="Strategic review summary">
		<Stat label="Reviews" value={String(data.reviews.length)} detail="Recorded review cycles" />
		<Stat
			label="Approved"
			value={String(approvedReviews.length)}
			detail="Frozen enterprise evidence"
			tone="success"
		/>
		<Stat
			label="Decisions"
			value={String(data.decisions.length)}
			detail="Structured review outcomes"
		/>
		<Stat
			label="Open actions"
			value={String(openDecisions.length)}
			detail="Decisions requiring follow-through"
			tone={openDecisions.length > 0 ? 'warning' : 'neutral'}
		/>
	</section>

	<section class="review-thread" aria-labelledby="review-thread-title">
		<div>
			<p class="section-kicker">Management loop</p>
			<h2 id="review-thread-title">
				Actual evidence → review snapshot → decision → corrective action
			</h2>
			<p>
				The review does not reinterpret history by editing KPI observations. It freezes the evidence
				considered and records the decision that management made from that evidence.
			</p>
		</div>
		<div class="thread-actions">
			<LinkButton
				href={routes.strategyPerformance(data.tenant.slug, data.framework.publicId)}
				variant="secondary">Review F01.06 performance</LinkButton
			>
			<LinkButton
				href={routes.strategyBusinessPlanning(data.tenant.slug, data.framework.publicId)}
				variant="quiet">Review execution plan</LinkButton
			>
		</div>
	</section>

	<section class="workspace-section" aria-labelledby="reviews-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">Strategic reviews</p>
				<h2 id="reviews-title">A dated evidence set, not a mutable meeting note</h2>
			</div>
			{#if canCreate}
				<LinkButton
					href={routes.strategyReviewNew(data.tenant.slug, data.framework.publicId, 'review')}
					variant="quiet">Start review</LinkButton
				>
			{/if}
		</div>

		{#if data.reviews.length > 0}
			<div class="review-grid">
				{#each data.reviews as review (review.publicId)}
					<article>
						<div class="record-heading">
							<div>
								<span class="record-code">{review.code} · {review.reviewDate}</span>
								<h3>{review.title}</h3>
							</div>
							<StatusBadge
								label={review.lifecycleStatus}
								tone={statusTone(review.lifecycleStatus)}
							/>
						</div>
						<p>{review.summary}</p>
						<div class="review-meta">
							<span><strong>{review.kpiSnapshotCount}</strong> KPI snapshots</span>
							<span><strong>{review.decisionCount}</strong> decisions</span>
							<span><strong>{review.openDecisionCount}</strong> open</span>
						</div>
						{#if review.lifecycleStatus === 'draft' && data.permissions.canApprove}
							<form method="POST" action="?/approveReview" use:enhance class="approval-row">
								<input type="hidden" name="reviewPublicId" value={review.publicId} />
								<div>
									<strong>Freeze this strategic review</strong>
									<p>
										Approval preserves the KPI snapshot and review record as immutable enterprise
										evidence.
									</p>
								</div>
								<Button type="submit" variant="secondary" size="sm">Approve review</Button>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{:else}
			<Panel
				title="No strategic reviews yet"
				description="A review requires at least one approved KPI with an actual observation on or before the review date."
			>
				{#if canCreate && data.kpis.some((kpi) => kpi.lifecycleStatus === 'approved' && kpi.latestActualValue !== null)}
					<LinkButton
						href={routes.strategyReviewNew(data.tenant.slug, data.framework.publicId, 'review')}
						>Start first review</LinkButton
					>
				{/if}
			</Panel>
		{/if}
	</section>

	<section class="workspace-section" aria-labelledby="decisions-title">
		<div class="section-heading">
			<div>
				<p class="section-kicker">Review decisions</p>
				<h2 id="decisions-title">Make management intervention explicit</h2>
			</div>
			{#if canCreate && data.reviews.some((review) => review.lifecycleStatus === 'draft')}
				<LinkButton
					href={routes.strategyReviewNew(data.tenant.slug, data.framework.publicId, 'decision')}
					variant="quiet">Record decision</LinkButton
				>
			{/if}
		</div>

		{#if data.decisions.length > 0}
			<div class="decision-list">
				{#each data.decisions as decision (decision.publicId)}
					<article>
						<div class="record-heading">
							<div>
								<span class="record-code">{decision.reviewCode} · {decision.decisionCode}</span>
								<h3>{decision.decisionText}</h3>
							</div>
							<StatusBadge
								label={decision.lifecycleStatus}
								tone={statusTone(decision.lifecycleStatus)}
							/>
						</div>
						<p>{decision.rationale}</p>
						<div class="decision-meta">
							<span>Type <strong>{decision.decisionType.replaceAll('_', ' ')}</strong></span>
							<span>Due <strong>{decision.dueDate ?? 'No due date'}</strong></span>
							{#if decision.objectiveCode}<span
									>Objective <strong>{decision.objectiveCode}</strong></span
								>{/if}
							{#if decision.initiativeCode}<span
									>Initiative <strong>{decision.initiativeCode}</strong></span
								>{/if}
							{#if decision.kpiCode}<span>KPI <strong>{decision.kpiCode}</strong></span>{/if}
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<Panel
				title="No structured review decisions yet"
				description="Decisions such as accelerate, rephase, pause, stop, revise plan or corrective action should be attributable records rather than prose inside the review summary."
			/>
		{/if}
	</section>

	<Alert tone="info" title="The review loop now has a durable control point">
		F01.07 preserves the evidence and decision. The next maturity step is downstream completion of
		those decisions—project change, budget revision, workforce action, risk response or controlled
		strategy revision—without breaking the original review lineage.
	</Alert>
</div>

<style>
	.review-page,
	.workspace-section,
	.review-grid,
	.decision-list {
		display: grid;
		gap: var(--nb-space-8);
	}
	.review-page {
		padding-bottom: var(--nb-space-16);
	}
	.review-grid,
	.decision-list {
		gap: var(--nb-space-4);
	}
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-5);
	}
	.review-thread {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.6fr);
		gap: var(--nb-space-8);
		align-items: center;
		padding: var(--nb-space-6);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
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
	.review-thread h2,
	.section-heading h2 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-xl);
	}
	.review-thread p:not(.section-kicker),
	.review-grid article > p,
	.decision-list article > p,
	.approval-row p {
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.thread-actions {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: var(--nb-space-3);
	}
	.section-heading,
	.record-heading,
	.approval-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-5);
	}
	.review-grid article,
	.decision-list article {
		padding: var(--nb-space-5);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.record-heading h3 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-lg);
	}
	.review-meta,
	.decision-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-3) var(--nb-space-5);
		margin-top: var(--nb-space-4);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
	}
	.approval-row {
		align-items: center;
		margin-top: var(--nb-space-5);
		padding-top: var(--nb-space-4);
		border-top: 1px solid var(--nb-color-border-default);
	}
	.approval-row p {
		margin: var(--nb-space-1) 0 0;
	}
	@media (max-width: 980px) {
		.stat-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.review-thread {
			grid-template-columns: 1fr;
		}
		.thread-actions {
			justify-content: flex-start;
		}
	}
	@media (max-width: 640px) {
		.stat-grid {
			grid-template-columns: 1fr;
		}
		.section-heading,
		.record-heading,
		.approval-row {
			flex-direction: column;
		}
	}
</style>
