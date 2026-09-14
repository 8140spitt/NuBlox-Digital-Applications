<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		Alert,
		Breadcrumbs,
		Button,
		Field,
		PageHeader,
		Panel,
		StatusBadge
	} from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';
	let { data, form } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	const operation = $derived(data.operation);
	const pending = $derived(operation.requestStatus === 'pending');
	function healthTone(health: string): 'success' | 'warning' | 'danger' | 'neutral' {
		if (health === 'green') return 'success';
		if (health === 'amber') return 'warning';
		if (health === 'red') return 'danger';
		return 'neutral';
	}
</script>

<svelte:head><title>{operation.transitionLabel} · Workflow operations · NuBlox</title></svelte:head>

<div class="nb-page-wide operation-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Workflow administration', href: appPath(tenant, 'workflow') },
			{ label: 'Operations', href: appPath(tenant, 'workflow/operations') },
			{ label: operation.transitionLabel }
		]}
	/>
	<PageHeader
		eyebrow={`${operation.sourceDomain} · ${operation.sourceType}`}
		title={operation.transitionLabel}
		description={`${operation.fromState} → ${operation.toState}`}
	>
		{#snippet actions()}<StatusBadge
				label={operation.requestStatus}
				tone={pending ? 'info' : 'neutral'}
			/><StatusBadge label={operation.health} tone={healthTone(operation.health)} />{/snippet}
	</PageHeader>
	{#if form?.formError}<Alert tone="danger" title="Operational change not applied"
			>{form.formError}</Alert
		>{:else if form?.success}<Alert tone="success" title="Workflow updated">{form.success}</Alert
		>{/if}

	<div class="fact-strip">
		<div><span>Work status</span><strong>{operation.workStatus.replaceAll('_', ' ')}</strong></div>
		<div><span>Priority</span><strong>{operation.priority}</strong></div>
		<div>
			<span>Submitted</span><strong>{new Date(operation.submittedAt).toLocaleString()}</strong>
		</div>
		<div>
			<span>Due</span><strong
				>{operation.dueAt ? new Date(operation.dueAt).toLocaleString() : 'No deadline'}</strong
			>
		</div>
	</div>

	<div class="workspace-grid">
		<div class="main-stack">
			<Panel
				title="Process context"
				description="The workflow remains separate from the business lifecycle while preserving the exact source record and target state."
			>
				<div class="context-grid">
					<span>Workflow</span><strong>{operation.workflowKey}</strong><span>Source record</span
					><code>{operation.sourcePublicId}</code><span>Context</span><code
						>{operation.contextPublicId}</code
					>{#if operation.submissionNote}<span>Submission note</span>
						<p>{operation.submissionNote}</p>{/if}{#if operation.decisionNote}<span
							>Decision note</span
						>
						<p>{operation.decisionNote}</p>{/if}
				</div>
			</Panel>
			<Panel
				title="Activity and evidence"
				description="Append-only work events show what happened, who intervened and when."
			>
				<div class="timeline">
					{#each operation.events as event (event.id)}<article>
							<div>
								<strong>{event.eventType.replaceAll('_', ' ')}</strong><span
									>{new Date(event.occurredAt).toLocaleString()}</span
								>
							</div>
							<p>
								{event.actorName ?? 'System'}{#if event.fromStatus || event.toStatus}
									· {event.fromStatus ?? '—'} → {event.toStatus ?? '—'}{/if}
							</p>
							{#if event.reason}<blockquote>{event.reason}</blockquote>{/if}
						</article>{/each}
				</div>
			</Panel>
			<Panel
				title="Assignment history"
				description="Reassignment never overwrites history; previous assignments are closed and retained."
			>
				<div class="timeline">
					{#each operation.assignments as assignment (assignment.id)}<article>
							<div>
								<strong>{assignment.memberName ?? assignment.assignmentScope}</strong><span
									>{assignment.endedAt ? 'Ended' : 'Current'}</span
								>
							</div>
							<p>
								Assigned {new Date(assignment.assignedAt).toLocaleString()}{#if assignment.endedAt}
									· ended {new Date(assignment.endedAt).toLocaleString()}{/if}
							</p>
							{#if assignment.assignmentNote}<p>{assignment.assignmentNote}</p>{/if}
						</article>{/each}
				</div>
			</Panel>
		</div>

		<aside class="side-stack">
			<Panel
				title="Operational controls"
				description="Interventions affect the work item, not the underlying business lifecycle. Every change is evidenced."
				padding="spacious"
			>
				{#if pending}
					<form method="POST" action="?/status" use:enhance class="form-stack">
						<Field id="status" label="Work status"
							><select class="nb-control" id="status" name="status" value={operation.workStatus}
								><option value="open">Open</option><option value="in_progress">In progress</option
								><option value="blocked">Blocked</option></select
							></Field
						>
						<Field id="statusReason" label="Reason"
							><textarea class="nb-control" id="statusReason" name="reason"></textarea></Field
						>
						<Button type="submit" variant="secondary">Update status</Button>
					</form>
					<form method="POST" action="?/priority" use:enhance class="form-stack section-rule">
						<Field id="priority" label="Priority"
							><select class="nb-control" id="priority" name="priority" value={operation.priority}
								><option value="low">Low</option><option value="normal">Normal</option><option
									value="high">High</option
								><option value="urgent">Urgent</option><option value="critical">Critical</option
								></select
							></Field
						>
						<input type="hidden" name="reason" value="Operational priority change" />
						<Button type="submit" variant="secondary">Update priority</Button>
					</form>
				{:else}<p class="muted">
						This workflow is closed. Operational controls are locked; evidence remains available.
					</p>{/if}
			</Panel>
			{#if pending}
				<Panel
					title="Reassign work"
					description="Choose an active organisation member. The prior assignment remains in history."
					padding="spacious"
				>
					<form method="POST" action="?/reassign" use:enhance class="form-stack">
						<Field id="memberId" label="New assignee" required
							><select class="nb-control" id="memberId" name="memberId" required
								><option value="">Select member</option
								>{#each operation.members as member (member.memberId)}<option
										value={member.memberId}>{member.displayName}</option
									>{/each}</select
							></Field
						>
						<Field id="reassignReason" label="Reason"
							><textarea class="nb-control" id="reassignReason" name="reason"></textarea></Field
						>
						<Button type="submit" variant="secondary">Reassign</Button>
					</form>
				</Panel>
				<Panel
					title="Cancel workflow"
					description="Use only when the workflow should no longer continue. This closes the work item and records a withdrawn workflow request."
					padding="spacious"
				>
					<form method="POST" action="?/cancel" use:enhance class="form-stack">
						<Field id="cancelReason" label="Cancellation reason" required
							><textarea class="nb-control" id="cancelReason" name="reason" required
							></textarea></Field
						><Button type="submit" variant="danger">Cancel workflow</Button>
					</form>
				</Panel>
			{/if}
		</aside>
	</div>
</div>

<style>
	.operation-page {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.fact-strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-2);
		margin: var(--nb-space-5) 0;
	}
	.fact-strip > div {
		display: grid;
		gap: 2px;
		padding: var(--nb-space-3);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.fact-strip span,
	.muted,
	.timeline p,
	.context-grid > span {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
	}
	.workspace-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
		gap: var(--nb-space-5);
		align-items: start;
	}
	.main-stack,
	.side-stack,
	.form-stack,
	.timeline {
		display: grid;
		gap: var(--nb-space-4);
	}
	.context-grid {
		display: grid;
		grid-template-columns: 140px minmax(0, 1fr);
		gap: var(--nb-space-3);
		align-items: start;
	}
	.context-grid p {
		margin: 0;
	}
	.timeline article {
		padding-bottom: var(--nb-space-3);
		border-bottom: 1px solid var(--nb-color-border-subtle);
	}
	.timeline article:last-child {
		border-bottom: 0;
	}
	.timeline article > div {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-3);
	}
	.timeline blockquote {
		margin: var(--nb-space-2) 0 0;
		padding-left: var(--nb-space-3);
		border-left: 3px solid var(--nb-color-border-strong);
		color: var(--nb-color-text-secondary);
	}
	.section-rule {
		border-top: 1px solid var(--nb-color-border-subtle);
		padding-top: var(--nb-space-4);
	}
	code {
		overflow-wrap: anywhere;
	}
	@media (max-width: 980px) {
		.workspace-grid {
			grid-template-columns: 1fr;
		}
		.fact-strip {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 620px) {
		.fact-strip {
			grid-template-columns: 1fr;
		}
		.context-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
