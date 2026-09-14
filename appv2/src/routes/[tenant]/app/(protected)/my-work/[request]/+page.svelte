<script lang="ts">
	import { Button, Panel, StatusBadge } from '$lib/components/ui';

	let { data, form } = $props();
</script>

<section class="nb-page task-page">
	<header class="task-heading">
		<div>
			<p class="nb-eyebrow">My work · Governed approval</p>
			<h1>{data.task.title}</h1>
			<p class="nb-lede">
				Review the governed source record before deciding. The business lifecycle will only advance
				after an approval decision successfully passes the source-domain invariants.
			</p>
		</div>
		<StatusBadge label="Pending" tone="info" />
	</header>

	{#if form?.formError}
		<div class="form-error" role="alert">{form.formError}</div>
	{/if}

	<div class="task-grid">
		<Panel title="Workflow gate" description="Workflow execution is separate from the business lifecycle state.">
			<dl class="facts">
				<div><dt>Workflow</dt><dd>{data.task.workflowKey}</dd></div>
				<div><dt>Source</dt><dd>{data.task.sourceDomain} · {data.task.sourceType}</dd></div>
				<div><dt>Lifecycle</dt><dd>{data.task.fromState} → {data.task.toState}</dd></div>
				<div><dt>Required authority</dt><dd>{data.task.requiredPermissionKey}</dd></div>
				<div><dt>Submitted</dt><dd>{new Date(data.task.submittedAt).toLocaleString()}</dd></div>
				{#if data.task.dueAt}
					<div><dt>Due</dt><dd>{new Date(data.task.dueAt).toLocaleString()}</dd></div>
				{/if}
			</dl>
			{#if data.task.submissionNote}
				<div class="submission-note">
					<strong>Submission note</strong>
					<p>{data.task.submissionNote}</p>
				</div>
			{/if}
			<a class="source-link" href={data.sourceHref}>Open governed source record</a>
		</Panel>

		<Panel title="Decision" description="Return and reject require a reason. Approval remains subject to the F01 domain approval rules.">
			<form method="POST" action="?/decide" class="decision-form">
				<label for="decision-note">Decision note</label>
				<textarea
					id="decision-note"
					name="note"
					class="nb-control"
					rows="6"
					placeholder="Record the decision rationale, especially when returning or rejecting."
				>{form?.note ?? ''}</textarea>
				<div class="decision-actions">
					<Button type="submit" name="decision" value="approved">Approve</Button>
					<Button type="submit" name="decision" value="returned" variant="secondary">Return</Button>
					<Button type="submit" name="decision" value="rejected" variant="danger">Reject</Button>
				</div>
			</form>
		</Panel>
	</div>
</section>

<style>
	.task-page {
		display: grid;
		gap: var(--nb-space-6);
	}
	.task-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-6);
	}
	.task-heading h1 {
		margin: 0 0 var(--nb-space-3);
		font-size: clamp(2rem, 4vw, 3rem);
		letter-spacing: -0.04em;
	}
	.task-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
		gap: var(--nb-space-5);
		align-items: start;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-4);
		margin: 0;
	}
	.facts div {
		padding-bottom: var(--nb-space-3);
		border-bottom: 1px solid var(--nb-color-border-subtle, var(--nb-border));
	}
	.facts dt {
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		color: var(--nb-color-text-secondary);
	}
	.facts dd {
		margin: var(--nb-space-1) 0 0;
		font-weight: var(--nb-weight-semibold);
		word-break: break-word;
	}
	.submission-note {
		margin-top: var(--nb-space-5);
		padding: var(--nb-space-4);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}
	.submission-note p {
		margin: var(--nb-space-2) 0 0;
	}
	.source-link {
		display: inline-block;
		margin-top: var(--nb-space-5);
		font-weight: var(--nb-weight-semibold);
	}
	.decision-form {
		display: grid;
		gap: var(--nb-space-3);
	}
	.decision-form label {
		font-weight: var(--nb-weight-semibold);
	}
	.decision-form textarea {
		resize: vertical;
	}
	.decision-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
		margin-top: var(--nb-space-2);
	}
	.form-error {
		padding: var(--nb-space-3) var(--nb-space-4);
		border: 1px solid var(--nb-color-danger);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-danger-subtle, #fff1f1);
		color: var(--nb-color-danger);
	}
	@media (max-width: 900px) {
		.task-heading {
			flex-direction: column;
		}
		.task-grid {
			grid-template-columns: 1fr;
		}
		.facts {
			grid-template-columns: 1fr;
		}
	}
</style>
