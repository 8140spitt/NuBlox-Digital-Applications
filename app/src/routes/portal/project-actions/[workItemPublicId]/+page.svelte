<script lang="ts">
	let { data, form } = $props();

	const reviewOutcomes = [
		['approved', 'Approved'],
		['approved_with_comments', 'Approved with comments'],
		['revise_resubmit', 'Revise and resubmit'],
		['rejected', 'Rejected'],
		['no_objection', 'No objection'],
		['for_information', 'For information']
	] as const;

	function dateTime(value: Date | string | null): string {
		if (!value) return 'No due date';
		return new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	function titleCase(value: string): string {
		return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	}
</script>

<svelte:head>
	<title>{data.task.projectNumber} · NuBlox Network</title>
</svelte:head>

<div class="task-shell">
	<nav class="breadcrumbs" aria-label="Breadcrumb">
		<a href="/portal">NuBlox Network</a><span>/</span><span>{data.task.projectNumber}</span>
	</nav>

	<header class="task-header">
		<div>
			<p class="eyebrow">External project action</p>
			<h1>
				{#if data.task.kind === 'rfi'}Respond to RFI{:else if data.task.kind === 'submittal'}Review
					submittal{:else}Acknowledge instruction{/if}
			</h1>
			<p class="lede">
				{data.task.projectNumber} · {data.task.projectName} · Shared by {data.task.ownerName}
			</p>
		</div>
		<span class:done={data.task.state === 'completed'} class="state-pill">
			{data.task.state === 'completed' ? 'Completed' : 'Action required'}
		</span>
	</header>

	{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}

	<section class="task-card">
		{#if data.task.kind === 'rfi'}
			<div class="record-heading">
				<p class="eyebrow">RFI · {data.task.number}</p>
				<h2>{data.task.subject}</h2>
			</div>
			<div class="record-body">
				<strong>Question</strong>
				<p>{data.task.question}</p>
			</div>
			<div class="meta-grid">
				<div><span>Status</span><strong>{titleCase(data.task.status)}</strong></div>
				<div><span>Priority</span><strong>{titleCase(data.task.priority)}</strong></div>
				<div><span>Due</span><strong>{dateTime(data.task.dueAt)}</strong></div>
			</div>

			{#if data.task.previousResponses.length}
				<section class="history">
					<h3>Your responses</h3>
					{#each data.task.previousResponses as response}
						<article>
							<div>
								<strong>Response {response.sequence}</strong><span
									>{dateTime(response.respondedAt)}</span
								>
							</div>
							<p>{response.responseText}</p>
							{#if response.final}<span class="tag">Final response</span>{/if}
						</article>
					{/each}
				</section>
			{/if}

			{#if data.task.state === 'open' && ['open', 'reopened'].includes(data.task.status)}
				<form class="action-form" method="POST" action="?/respondRfi">
					<label>
						<span>Response</span>
						<textarea name="responseText" rows="7" maxlength="20000" required></textarea>
					</label>
					<label class="check-row">
						<input type="checkbox" name="final" checked />
						<span>Mark this as my final response</span>
					</label>
					<button type="submit">Submit controlled response</button>
				</form>
			{:else}
				<p class="complete-note">No further response is required for this shared RFI.</p>
			{/if}
		{:else if data.task.kind === 'submittal'}
			<div class="record-heading">
				<p class="eyebrow">Submittal · {data.task.number}</p>
				<h2>{data.task.title}</h2>
			</div>
			<div class="meta-grid">
				<div><span>Status</span><strong>{titleCase(data.task.status)}</strong></div>
				<div><span>Submitted</span><strong>{dateTime(data.task.submittedAt)}</strong></div>
				<div><span>Due</span><strong>{dateTime(data.task.dueAt)}</strong></div>
			</div>

			{#if data.task.previousReviews.length}
				<section class="history">
					<h3>Your reviews</h3>
					{#each data.task.previousReviews as review}
						<article>
							<div>
								<strong>{titleCase(review.outcome)}</strong><span
									>{dateTime(review.reviewedAt)}</span
								>
							</div>
							{#if review.comments}<p>{review.comments}</p>{/if}
						</article>
					{/each}
				</section>
			{/if}

			{#if data.task.state === 'open' && ['submitted', 'under_review'].includes(data.task.status)}
				<form class="action-form" method="POST" action="?/reviewSubmittal">
					<label>
						<span>Review outcome</span>
						<select name="outcome" required>
							<option value="">Select outcome</option>
							{#each reviewOutcomes as outcome}<option value={outcome[0]}>{outcome[1]}</option
								>{/each}
						</select>
					</label>
					<label>
						<span>Comments <small>optional</small></span>
						<textarea name="comments" rows="6" maxlength="20000"></textarea>
					</label>
					<button type="submit">Submit controlled review</button>
				</form>
			{:else}
				<p class="complete-note">This controlled review is complete.</p>
			{/if}
		{:else}
			<div class="record-heading">
				<p class="eyebrow">Instruction · {data.task.number}</p>
				<h2>{data.task.subject}</h2>
			</div>
			<div class="record-body">
				<strong>Instruction</strong>
				<p>{data.task.instructionText}</p>
			</div>
			<div class="meta-grid">
				<div><span>Status</span><strong>{titleCase(data.task.status)}</strong></div>
				<div><span>Issued</span><strong>{dateTime(data.task.issuedAt)}</strong></div>
				<div><span>Acknowledged</span><strong>{dateTime(data.task.acknowledgedAt)}</strong></div>
			</div>
			{#if data.task.state === 'open' && data.task.status === 'issued'}
				<form class="action-form compact" method="POST" action="?/acknowledgeInstruction">
					<p>Confirm that you have received and read this controlled project instruction.</p>
					<button type="submit">Acknowledge instruction</button>
				</form>
			{:else}
				<p class="complete-note">Your acknowledgement has been recorded.</p>
			{/if}
		{/if}
	</section>

	<aside class="boundary-note">
		<strong>Personal, scoped access</strong>
		<p>
			This action was shared with your verified identity. It does not create membership of
			{data.task.ownerName} or expose unrelated NuBlox records.
		</p>
	</aside>
</div>

<style>
	.task-shell {
		max-width: 58rem;
		margin: 0 auto;
		padding: 1.25rem;
	}
	.breadcrumbs {
		display: flex;
		gap: 0.5rem;
		color: #686862;
		font-size: 0.9rem;
		margin-bottom: 1.5rem;
	}
	.breadcrumbs a {
		color: inherit;
		font-weight: 700;
	}
	.task-header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}
	.eyebrow {
		margin: 0 0 0.3rem;
		color: #666;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 6vw, 3rem);
		letter-spacing: -0.045em;
	}
	.lede {
		color: #60605a;
		line-height: 1.5;
	}
	.state-pill,
	.tag {
		display: inline-flex;
		border-radius: 999px;
		background: #fff1cd;
		padding: 0.35rem 0.55rem;
		font-size: 0.75rem;
		font-weight: 800;
	}
	.state-pill.done,
	.tag {
		background: #e4f5e8;
	}
	.task-card {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.9rem;
		padding: 1.4rem;
	}
	.record-heading h2 {
		margin: 0 0 1rem;
		font-size: 1.55rem;
	}
	.record-body {
		padding: 1rem;
		border-radius: 0.65rem;
		background: #f7f7f3;
		line-height: 1.6;
	}
	.record-body p {
		margin-bottom: 0;
	}
	.meta-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.7rem;
		margin: 1rem 0;
	}
	.meta-grid div {
		display: grid;
		gap: 0.25rem;
		border: 1px solid #e1e1da;
		border-radius: 0.55rem;
		padding: 0.75rem;
	}
	.meta-grid span {
		color: #6a6a64;
		font-size: 0.75rem;
	}
	.history {
		margin-top: 1.25rem;
		border-top: 1px solid #e1e1da;
		padding-top: 1rem;
	}
	.history article {
		padding: 0.85rem 0;
		border-bottom: 1px solid #ecece6;
	}
	.history article > div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.history article span {
		color: #686862;
		font-size: 0.8rem;
	}
	.action-form {
		display: grid;
		gap: 1rem;
		margin-top: 1.4rem;
		padding-top: 1.25rem;
		border-top: 1px solid #d9d9d2;
	}
	.action-form.compact {
		max-width: 34rem;
	}
	label {
		display: grid;
		gap: 0.4rem;
		font-weight: 700;
	}
	textarea,
	select {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.55rem;
		padding: 0.75rem;
		background: white;
	}
	.check-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-weight: 600;
	}
	button {
		justify-self: start;
		font: inherit;
		font-weight: 800;
		border: 1px solid #111;
		border-radius: 0.55rem;
		background: #111;
		color: white;
		padding: 0.72rem 1rem;
		cursor: pointer;
	}
	.error {
		border-radius: 0.55rem;
		background: #fdeaea;
		color: #8f1717;
		padding: 0.8rem;
	}
	.complete-note {
		margin-top: 1.2rem;
		padding: 0.9rem;
		border-radius: 0.55rem;
		background: #eef7ef;
		font-weight: 650;
	}
	.boundary-note {
		margin-top: 1rem;
		border: 1px solid #d9d9d2;
		border-radius: 0.7rem;
		padding: 1rem;
		color: #555;
	}
	.boundary-note p {
		margin-bottom: 0;
		line-height: 1.55;
	}
	@media (max-width: 680px) {
		.task-header {
			display: grid;
		}
		.meta-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
