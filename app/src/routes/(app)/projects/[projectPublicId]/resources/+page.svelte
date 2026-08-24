<script lang="ts">
	let { data, form } = $props();

	function hours(minutes: number | null): string {
		if (minutes === null) return 'Not configured';
		const value = minutes / 60;
		return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} h`;
	}

	function assignmentWindow(resource: (typeof data.resourcePool)[number]): string {
		const from = resource.startsOn ? resource.startsOn.toISOString().slice(0, 10) : 'open';
		const to = resource.endsOn ? resource.endsOn.toISOString().slice(0, 10) : 'open';
		return `${from} → ${to}`;
	}

	function allocationHours(minutes: number): string {
		return (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1);
	}
</script>

<svelte:head>
	<title>Resource loading & capacity · {data.project.name} · NuBlox</title>
</svelte:head>

<div class="resource-page">
	<header class="page-header">
		<div>
			<p class="eyebrow">Project controls · Resource loading</p>
			<h1>Resource loading & capacity</h1>
			<p class="lede">
				Load planned effort from the authorised project resource pool onto project-plan activities,
				then compare demand with calendar-derived capacity and project allocation limits.
			</p>
		</div>
		<nav class="context-links" aria-label="Project controls navigation">
			<a href={`/projects/${data.project.publicId}`}>Overview</a>
			<a href={`/projects/${data.project.publicId}/plan`}>Project plan</a>
			<a class="active" href={`/projects/${data.project.publicId}/resources`}>Resources</a>
		</nav>
	</header>

	<section class="summary-grid" aria-label="Resource capacity summary">
		<article>
			<span>Project resources</span>
			<strong>{data.totals.resourceCount}</strong>
		</article>
		<article>
			<span>Planned load</span>
			<strong>{hours(data.totals.plannedLoadMinutes)}</strong>
		</article>
		<article>
			<span>Project capacity</span>
			<strong>{hours(data.totals.projectCapacityMinutes)}</strong>
		</article>
		<article class:warning={data.totals.overloadedDays > 0}>
			<span>Overloaded resource-days</span>
			<strong>{data.totals.overloadedDays}</strong>
		</article>
		<article class:warning={data.totals.unconfiguredResources > 0}>
			<span>Capacity not configured</span>
			<strong>{data.totals.unconfiguredResources}</strong>
		</article>
	</section>

	<section class="panel range-panel" aria-labelledby="range-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Analysis window</p>
				<h2 id="range-heading">Capacity period</h2>
			</div>
			<span>{data.fromOn} → {data.toOn}</span>
		</div>
		<form method="GET" class="range-form">
			<label>
				From
				<input type="date" name="from" value={data.fromOn} />
			</label>
			<label>
				To
				<input type="date" name="to" value={data.toOn} />
			</label>
			<button type="submit">Update capacity view</button>
		</form>
	</section>

	{#if form?.resourceError}
		<p class="alert" role="alert">{form.resourceError}</p>
	{/if}

	{#if data.canManage}
		<section class="panel" aria-labelledby="load-heading">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">Planned demand</p>
					<h2 id="load-heading">Load a project resource</h2>
				</div>
				<span>One active load per worker/activity</span>
			</div>
			{#if data.resourcePool.length && data.activities.length}
				<form method="POST" action="?/createAllocation" class="load-form">
					<label>
						Activity
						<select name="activityPublicId" required>
							<option value="">Select activity</option>
							{#each data.activities as activity}
								<option value={activity.publicId}>
									{activity.activityCode} · {activity.name} ({activity.plannedStartOn
										.toISOString()
										.slice(0, 10)} → {activity.plannedFinishOn.toISOString().slice(0, 10)})
								</option>
							{/each}
						</select>
					</label>
					<label>
						Project resource
						<select name="resourceAssignmentPublicId" required>
							<option value="">Select resource</option>
							{#each data.resourcePool as resource}
								<option value={resource.assignmentPublicId}>
									{resource.workerName} · {resource.plannedAllocationPercent ?? '100'}% · {assignmentWindow(
										resource
									)}
								</option>
							{/each}
						</select>
					</label>
					<label>
						Planned effort (hours)
						<input name="plannedEffortHours" inputmode="decimal" placeholder="40" required />
					</label>
					<label>
						Load start
						<input type="date" name="loadStartOn" required />
					</label>
					<label>
						Load finish
						<input type="date" name="loadFinishOn" required />
					</label>
					<label class="wide">
						Planning note
						<textarea name="notes" rows="2" placeholder="Discipline, assumption or planning note"></textarea>
					</label>
					<div class="wide form-actions">
						<button type="submit">Add resource load</button>
					</div>
				</form>
			{:else if !data.resourcePool.length}
				<p class="empty-state">
					No project resources are assigned yet. Add workers to the canonical project resource pool in
					<a href="/people">People</a> before loading activity effort.
				</p>
			{:else}
				<p class="empty-state">
					Create at least one non-milestone activity in the <a
						href={`/projects/${data.project.publicId}/plan`}>Project plan</a
					> before loading resources.
				</p>
			{/if}
		</section>
	{/if}

	<section class="panel" aria-labelledby="allocations-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Current resource plan</p>
				<h2 id="allocations-heading">Activity resource loads</h2>
			</div>
			<span>{data.allocations.length} active</span>
		</div>
		{#if data.allocations.length}
			<div class="allocation-list">
				{#each data.allocations as allocation}
					<article class="allocation-card">
						<div>
							<strong>{allocation.activityCode} · {allocation.activityName}</strong>
							<span>{allocation.wbsCode}</span>
						</div>
						<div>
							<strong>{allocation.workerName}</strong>
							<span>{allocationHours(allocation.plannedEffortMinutes)} h planned effort</span>
						</div>
						<div>
							<strong>{allocation.loadStartOn.toISOString().slice(0, 10)}</strong>
							<span>to {allocation.loadFinishOn.toISOString().slice(0, 10)}</span>
						</div>
						{#if data.canManage}
							<form method="POST" action="?/removeAllocation">
								<input type="hidden" name="allocationPublicId" value={allocation.publicId} />
								<button class="secondary" type="submit">Remove load</button>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{:else}
			<p class="empty-state">No activity resource loads have been planned yet.</p>
		{/if}
	</section>

	<section class="panel" aria-labelledby="capacity-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Capacity control</p>
				<h2 id="capacity-heading">Resource capacity & utilisation</h2>
			</div>
			<span>Calendar → availability → project allocation → activity load</span>
		</div>
		{#if data.workers.length}
			<div class="worker-list">
				{#each data.workers as worker}
					<details class="worker-card" open={worker.overloadedDays > 0}>
						<summary>
							<div>
								<strong>{worker.workerName}</strong>
								<span class:warning-text={worker.overloadedDays > 0}>
									{worker.capacityConfigured
										? `${worker.utilisationPercent ?? 0}% utilisation · ${worker.overloadedDays} overloaded days`
										: 'Capacity calendar not configured'}
								</span>
							</div>
							<div class="worker-metrics">
								<span><b>{hours(worker.plannedLoadMinutes)}</b> load</span>
								<span><b>{hours(worker.projectCapacityMinutes)}</b> capacity</span>
								<span><b>{hours(worker.unavailableMinutes)}</b> unavailable</span>
							</div>
						</summary>
						<div class="day-table-wrap">
							<table>
								<thead>
									<tr>
										<th>Date</th>
										<th>Gross capacity</th>
										<th>Unavailable</th>
										<th>Project capacity</th>
										<th>Planned load</th>
										<th>Variance</th>
									</tr>
								</thead>
								<tbody>
									{#each worker.days as day}
										{#if day.plannedLoadMinutes > 0 || day.projectCapacityMinutes > 0 || day.unavailableMinutes > 0}
											<tr class:overloaded={day.overloaded === true}>
												<td>{day.date}</td>
												<td>{day.capacityConfigured ? hours(day.grossCapacityMinutes) : 'Not configured'}</td>
												<td>{day.capacityConfigured ? hours(day.unavailableMinutes) : '—'}</td>
												<td>{day.capacityConfigured ? hours(day.projectCapacityMinutes) : '—'}</td>
												<td>{hours(day.plannedLoadMinutes)}</td>
												<td>{day.varianceMinutes === null ? '—' : hours(day.varianceMinutes)}</td>
											</tr>
										{/if}
									{/each}
								</tbody>
							</table>
						</div>
					</details>
				{/each}
			</div>
		{:else}
			<p class="empty-state">No project resources are available for capacity analysis.</p>
		{/if}
	</section>
</div>

<style>
	.resource-page {
		display: grid;
		gap: 1rem;
		max-width: 1480px;
		margin: 0 auto;
	}

	.page-header,
	.panel,
	.summary-grid article {
		border: 1px solid var(--border-color, #d9dee7);
		background: var(--surface-color, #fff);
		border-radius: 1rem;
	}

	.page-header {
		padding: 1.35rem;
		display: flex;
		justify-content: space-between;
		gap: 1.25rem;
		align-items: flex-end;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #586579;
	}

	h1,
	h2,
	p {
		margin-top: 0;
	}

	h1 {
		margin-bottom: 0.55rem;
	}

	.lede {
		max-width: 76ch;
		margin-bottom: 0;
		color: #586579;
	}

	.context-links {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.context-links a {
		padding: 0.55rem 0.75rem;
		border-radius: 0.65rem;
		text-decoration: none;
		border: 1px solid #d9dee7;
		white-space: nowrap;
	}

	.context-links a.active {
		font-weight: 700;
		border-color: currentColor;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.summary-grid article {
		padding: 1rem;
		display: grid;
		gap: 0.35rem;
	}

	.summary-grid span,
	.panel-heading span,
	.allocation-card span,
	.worker-card summary span {
		font-size: 0.82rem;
		color: #667085;
	}

	.summary-grid strong {
		font-size: 1.45rem;
	}

	.warning {
		box-shadow: inset 0 0 0 1px #a43f26;
	}

	.panel {
		padding: 1.1rem;
	}

	.panel-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.panel-heading h2 {
		margin-bottom: 0;
		font-size: 1.15rem;
	}

	.range-form,
	.load-form {
		display: grid;
		gap: 0.8rem;
	}

	.range-form {
		grid-template-columns: minmax(10rem, 1fr) minmax(10rem, 1fr) auto;
		align-items: end;
	}

	.load-form {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.83rem;
		font-weight: 650;
	}

	input,
	select,
	textarea,
	button {
		font: inherit;
	}

	input,
	select,
	textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #cbd2dc;
		border-radius: 0.6rem;
		padding: 0.65rem 0.7rem;
		background: #fff;
	}

	button {
		border: 0;
		border-radius: 0.6rem;
		padding: 0.67rem 0.85rem;
		font-weight: 700;
		cursor: pointer;
		background: #12253f;
		color: #fff;
	}

	button.secondary {
		background: transparent;
		color: #8c2f1b;
		border: 1px solid #d7b2aa;
	}

	.wide {
		grid-column: 1 / -1;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
	}

	.alert {
		padding: 0.8rem 1rem;
		border-radius: 0.7rem;
		background: #fff1ed;
		border: 1px solid #f0c1b5;
		color: #7a271a;
		margin: 0;
	}

	.empty-state {
		margin: 0;
		padding: 0.9rem;
		background: #f7f8fa;
		border-radius: 0.7rem;
		color: #586579;
	}

	.allocation-list,
	.worker-list {
		display: grid;
		gap: 0.65rem;
	}

	.allocation-card {
		display: grid;
		grid-template-columns: minmax(14rem, 2fr) minmax(12rem, 1.3fr) minmax(10rem, 1fr) auto;
		gap: 0.8rem;
		align-items: center;
		padding: 0.85rem;
		border: 1px solid #e1e5eb;
		border-radius: 0.75rem;
	}

	.allocation-card > div {
		display: grid;
		gap: 0.2rem;
	}

	.worker-card {
		border: 1px solid #e1e5eb;
		border-radius: 0.75rem;
		overflow: hidden;
	}

	.worker-card summary {
		cursor: pointer;
		list-style-position: inside;
		padding: 0.9rem;
		display: grid;
		grid-template-columns: minmax(14rem, 1fr) auto;
		gap: 1rem;
		align-items: center;
	}

	.worker-card summary > div:first-child {
		display: grid;
		gap: 0.2rem;
	}

	.worker-metrics {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.warning-text {
		color: #9a3412 !important;
		font-weight: 700;
	}

	.day-table-wrap {
		overflow-x: auto;
		border-top: 1px solid #e1e5eb;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.84rem;
	}

	th,
	td {
		padding: 0.65rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid #eef0f3;
		white-space: nowrap;
	}

	th {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #667085;
	}

	tr.overloaded td {
		background: #fff4ef;
	}

	@media (max-width: 1100px) {
		.summary-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.allocation-card {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 760px) {
		.page-header,
		.panel-heading {
			flex-direction: column;
			align-items: stretch;
		}

		.summary-grid,
		.range-form,
		.load-form,
		.allocation-card,
		.worker-card summary {
			grid-template-columns: 1fr;
		}

		.worker-metrics {
			justify-content: flex-start;
		}
	}
</style>
