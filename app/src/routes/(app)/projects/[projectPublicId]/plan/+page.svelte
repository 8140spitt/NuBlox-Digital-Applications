<script lang="ts">
	let { data, form } = $props();

	function dateLabel(value: Date | string) {
		return new Date(value).toLocaleDateString('en-GB');
	}

	function wbsParentName(parentId: string | null) {
		if (!parentId) return 'Project root';
		const parent = data.wbsNodes.find((node) => node.id === parentId);
		return parent ? `${parent.wbsCode} · ${parent.name}` : 'Parent WBS';
	}
</script>

<svelte:head>
	<title>Project plan · {data.project.name} · NuBlox</title>
</svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/projects">Projects</a>
	<span aria-hidden="true">/</span>
	<a href={`/projects/${data.project.publicId}`}>{data.project.projectNumber}</a>
	<span aria-hidden="true">/</span>
	<span>Project plan</span>
</nav>

<section class="page-header">
	<div>
		<p class="eyebrow">Project controls</p>
		<h1>Project plan</h1>
		<p>
			{data.project.projectNumber} · {data.project.name}. Govern scope through WBS, activities,
			milestones, dependency logic and immutable schedule baselines.
		</p>
	</div>
</section>

<section class="metrics" aria-label="Project plan summary">
	<article><strong>{data.wbsNodes.length}</strong><span>WBS nodes</span></article>
	<article>
		<strong
			>{data.activities.filter((activity) => activity.activityKind === 'activity').length}</strong
		><span>Activities</span>
	</article>
	<article>
		<strong
			>{data.activities.filter((activity) => activity.activityKind === 'milestone').length}</strong
		><span>Milestones</span>
	</article>
	<article><strong>{data.baselines.length}</strong><span>Baselines</span></article>
</section>

{#if form?.planError}
	<p class="error-banner" role="alert">{form.planError}</p>
{/if}

<div class="workspace-grid">
	<section class="panel" aria-labelledby="wbs-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Scope structure</p>
				<h2 id="wbs-heading">Work breakdown structure</h2>
			</div>
		</div>
		{#if data.wbsNodes.length === 0}
			<div class="empty-state">
				<strong>No WBS yet</strong>
				<p>Create the first scope node before adding activities or milestones.</p>
			</div>
		{:else}
			<div class="record-list">
				{#each data.wbsNodes as node}
					<article class="record-card">
						<div class="record-topline">
							<code>{node.wbsCode}</code>
							<span>{wbsParentName(node.parentWbsNodeId)}</span>
						</div>
						<h3>{node.name}</h3>
						{#if node.description}<p>{node.description}</p>{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="panel" aria-labelledby="activities-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Current schedule</p>
				<h2 id="activities-heading">Activities & milestones</h2>
			</div>
			<span class="count">{data.activities.length}</span>
		</div>
		{#if data.activities.length === 0}
			<div class="empty-state">
				<strong>No planned activities</strong>
				<p>The current schedule is empty.</p>
			</div>
		{:else}
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>Code</th>
							<th>WBS</th>
							<th>Activity / milestone</th>
							<th>Start</th>
							<th>Finish</th>
							<th>Duration</th>
						</tr>
					</thead>
					<tbody>
						{#each data.activities as activity}
							<tr>
								<td><code>{activity.activityCode}</code></td>
								<td>{activity.wbsCode}</td>
								<td>
									<strong>{activity.name}</strong>
									<small>{activity.activityKind}</small>
								</td>
								<td>{dateLabel(activity.plannedStartOn)}</td>
								<td>{dateLabel(activity.plannedFinishOn)}</td>
								<td>{Number(activity.plannedDurationDays).toLocaleString()} d</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<section class="panel dependencies" aria-labelledby="dependencies-heading">
	<div class="panel-heading">
		<div>
			<p class="eyebrow">Network logic</p>
			<h2 id="dependencies-heading">Dependencies</h2>
		</div>
		<span class="count">{data.dependencies.length}</span>
	</div>
	{#if data.dependencies.length === 0}
		<div class="empty-state compact"><p>No dependency relationships have been recorded.</p></div>
	{:else}
		<div class="dependency-list">
			{#each data.dependencies as dependency}
				<article class="dependency-card">
					<div>
						<strong>{dependency.predecessorActivityCode}</strong>
						<span aria-hidden="true">→</span>
						<strong>{dependency.successorActivityCode}</strong>
					</div>
					<p>
						{dependency.dependencyType} · {Number(dependency.lagDays) === 0
							? 'no lag'
							: `${Number(dependency.lagDays)} d lag`}
					</p>
					{#if data.canManage}
						<form method="POST" action="?/removeDependency">
							<input type="hidden" name="dependencyPublicId" value={dependency.publicId} />
							<button class="text-button danger" type="submit">Remove dependency</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<section class="panel baselines" aria-labelledby="baselines-heading">
	<div class="panel-heading">
		<div>
			<p class="eyebrow">Controlled history</p>
			<h2 id="baselines-heading">Schedule baselines</h2>
			<p class="muted">
				Each baseline is an immutable snapshot of activity dates, duration and dependency logic.
			</p>
		</div>
	</div>
	{#if data.baselines.length === 0}
		<div class="empty-state compact"><p>No schedule baseline has been captured.</p></div>
	{:else}
		<div class="baseline-list">
			{#each data.baselines as baseline}
				<article class="baseline-card">
					<div class="record-topline">
						<strong>Baseline {baseline.baselineNumber}</strong>
						<span>{dateLabel(baseline.capturedAt)}</span>
					</div>
					<h3>{baseline.name}</h3>
					{#if baseline.description}<p>{baseline.description}</p>{/if}
					<small
						>{baseline.activityCount} activities/milestones · {baseline.dependencyCount} dependencies</small
					>
				</article>
			{/each}
		</div>
	{/if}
</section>

{#if data.canManage || data.canCaptureBaseline}
	<section class="management" aria-labelledby="manage-plan-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Plan authority</p>
				<h2 id="manage-plan-heading">Maintain current project plan</h2>
			</div>
		</div>

		<div class="form-grid">
			{#if data.canManage}
				<form method="POST" action="?/createWbs" class="action-form">
					<h3>Create WBS node</h3>
					<label
						><span>WBS code</span><input
							name="wbsCode"
							required
							maxlength="80"
							placeholder="1.2"
						/></label
					>
					<label
						><span>Name</span><input
							name="wbsName"
							required
							maxlength="255"
							placeholder="Substructure"
						/></label
					>
					<label>
						<span>Parent <small>optional</small></span>
						<select name="parentWbsNodePublicId">
							<option value="">Project root</option>
							{#each data.wbsNodes as node}<option value={node.publicId}
									>{node.wbsCode} · {node.name}</option
								>{/each}
						</select>
					</label>
					<label
						><span>Sort order</span><input
							name="sortOrder"
							type="number"
							min="0"
							value="0"
						/></label
					>
					<label class="full"
						><span>WBS description <small>optional</small></span><textarea
							name="wbsDescription"
							maxlength="10000"
							rows="3"></textarea></label
					>
					<button type="submit">Create WBS node</button>
				</form>

				<form method="POST" action="?/createActivity" class="action-form">
					<h3>Create activity or milestone</h3>
					<label>
						<span>WBS node</span>
						<select name="wbsNodePublicId" required>
							<option value="">Select WBS</option>
							{#each data.wbsNodes as node}<option value={node.publicId}
									>{node.wbsCode} · {node.name}</option
								>{/each}
						</select>
					</label>
					<label>
						<span>Type</span>
						<select name="activityKind"
							><option value="activity">Activity</option><option value="milestone">Milestone</option
							></select
						>
					</label>
					<label
						><span>Activity code</span><input
							name="activityCode"
							required
							maxlength="80"
							placeholder="A100"
						/></label
					>
					<label
						><span>Name</span><input
							name="activityName"
							required
							maxlength="255"
							placeholder="Excavate foundations"
						/></label
					>
					<label
						><span>Planned start</span><input name="plannedStartOn" type="date" required /></label
					>
					<label
						><span>Planned finish</span><input name="plannedFinishOn" type="date" required /></label
					>
					<label
						><span>Duration (days)</span><input
							name="plannedDurationDays"
							type="number"
							step="0.01"
							min="0"
							required
							value="1"
						/></label
					>
					<label class="full"
						><span>Activity description <small>optional</small></span><textarea
							name="activityDescription"
							maxlength="10000"
							rows="3"></textarea></label
					>
					<button type="submit" disabled={data.wbsNodes.length === 0}
						>Create activity / milestone</button
					>
				</form>

				<form method="POST" action="?/addDependency" class="action-form">
					<h3>Add dependency</h3>
					<label>
						<span>Predecessor</span>
						<select name="predecessorActivityPublicId" required>
							<option value="">Select activity</option>
							{#each data.activities as activity}<option value={activity.publicId}
									>{activity.activityCode} · {activity.name}</option
								>{/each}
						</select>
					</label>
					<label>
						<span>Successor</span>
						<select name="successorActivityPublicId" required>
							<option value="">Select activity</option>
							{#each data.activities as activity}<option value={activity.publicId}
									>{activity.activityCode} · {activity.name}</option
								>{/each}
						</select>
					</label>
					<label>
						<span>Relationship</span>
						<select name="dependencyType">
							<option value="FS">Finish → Start (FS)</option>
							<option value="SS">Start → Start (SS)</option>
							<option value="FF">Finish → Finish (FF)</option>
							<option value="SF">Start → Finish (SF)</option>
						</select>
					</label>
					<label
						><span>Lag (days)</span><input
							name="lagDays"
							type="number"
							step="0.01"
							value="0"
						/></label
					>
					<button type="submit" disabled={data.activities.length < 2}>Add dependency</button>
				</form>
			{/if}

			{#if data.canCaptureBaseline}
				<form method="POST" action="?/captureBaseline" class="action-form baseline-form">
					<h3>Capture schedule baseline</h3>
					<p class="hint">
						Creates an immutable snapshot. Later changes to the current plan do not alter this
						record.
					</p>
					<label
						><span>Baseline name</span><input
							name="baselineName"
							required
							maxlength="255"
							placeholder="Contract baseline"
						/></label
					>
					<label class="full"
						><span>Baseline description <small>optional</small></span><textarea
							name="baselineDescription"
							maxlength="10000"
							rows="3"></textarea></label
					>
					<button type="submit" disabled={data.activities.length === 0}>Capture baseline</button>
				</form>
			{/if}
		</div>
	</section>
{/if}

<style>
	.breadcrumbs {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 1rem;
		font-size: 0.85rem;
		color: #666;
	}
	.breadcrumbs a {
		color: inherit;
	}
	.page-header {
		margin-bottom: 1.25rem;
	}
	.page-header h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.04em;
	}
	.page-header p:last-child,
	.muted,
	.hint {
		color: #5d5d57;
		line-height: 1.55;
	}
	.eyebrow {
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.72rem;
		font-weight: 750;
		color: #61615b;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.metrics article {
		display: grid;
		gap: 0.25rem;
		padding: 1rem;
		border: 1px solid #d9d9d2;
		border-radius: 0.75rem;
		background: white;
	}
	.metrics strong {
		font-size: 1.65rem;
	}
	.metrics span {
		color: #666;
		font-size: 0.8rem;
	}
	.workspace-grid {
		display: grid;
		grid-template-columns: minmax(16rem, 0.8fr) minmax(28rem, 1.2fr);
		gap: 1rem;
	}
	.panel,
	.management {
		margin-bottom: 1rem;
		padding: 1.2rem;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		background: white;
	}
	.panel-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
		margin-bottom: 1rem;
	}
	.panel-heading h2 {
		margin: 0;
	}
	.count {
		min-width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		background: #f0f0eb;
		font-weight: 750;
	}
	.record-list,
	.dependency-list,
	.baseline-list {
		display: grid;
		gap: 0.65rem;
	}
	.record-card,
	.dependency-card,
	.baseline-card {
		padding: 0.85rem;
		border: 1px solid #e0e0da;
		border-radius: 0.6rem;
		background: #fafaf7;
	}
	.record-card h3,
	.baseline-card h3 {
		margin: 0.45rem 0;
	}
	.record-card p,
	.baseline-card p {
		margin-bottom: 0.25rem;
		color: #5d5d57;
	}
	.record-topline {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		color: #666;
		font-size: 0.78rem;
	}
	.empty-state {
		padding: 1rem;
		border: 1px dashed #cfcfc8;
		border-radius: 0.6rem;
		color: #666;
	}
	.empty-state p {
		margin-bottom: 0;
	}
	.empty-state.compact {
		padding: 0.7rem 1rem;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}
	th,
	td {
		padding: 0.65rem 0.55rem;
		border-bottom: 1px solid #ecece6;
		text-align: left;
		vertical-align: top;
		white-space: nowrap;
	}
	th {
		color: #666;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	td strong,
	td small {
		display: block;
	}
	td small {
		margin-top: 0.15rem;
		color: #777;
	}
	.dependency-card {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem 1rem;
		align-items: center;
	}
	.dependency-card > div {
		display: flex;
		gap: 0.55rem;
		align-items: center;
	}
	.dependency-card p {
		margin: 0;
		color: #666;
		font-size: 0.8rem;
	}
	.text-button {
		border: 0;
		padding: 0;
		background: transparent;
		font: inherit;
		font-size: 0.8rem;
		text-decoration: underline;
		cursor: pointer;
	}
	.danger {
		color: #9b1c1c;
	}
	.error-banner {
		margin: 0 0 1rem;
		padding: 0.8rem 1rem;
		border: 1px solid #dfb4b4;
		border-radius: 0.6rem;
		background: #fff7f7;
		color: #8d1717;
	}
	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}
	.action-form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.8rem;
		align-content: start;
		padding: 1rem;
		border: 1px solid #deded7;
		border-radius: 0.65rem;
		background: #fafaf7;
	}
	.action-form h3,
	.action-form > p,
	.action-form > button {
		grid-column: 1 / -1;
	}
	.action-form label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.82rem;
		font-weight: 650;
	}
	.action-form label.full {
		grid-column: 1 / -1;
	}
	.action-form input,
	.action-form select,
	.action-form textarea {
		min-width: 0;
		width: 100%;
		box-sizing: border-box;
		padding: 0.62rem;
		border: 1px solid #b9b9b1;
		border-radius: 0.45rem;
		background: white;
		font: inherit;
	}
	.action-form button {
		justify-self: start;
		padding: 0.68rem 0.9rem;
		border: 1px solid #111;
		border-radius: 0.5rem;
		background: #111;
		color: white;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.action-form button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.action-form small {
		color: #777;
		font-weight: 500;
	}
	.baseline-form {
		border-style: dashed;
	}
	@media (max-width: 900px) {
		.metrics {
			grid-template-columns: repeat(2, 1fr);
		}
		.workspace-grid,
		.form-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		.metrics {
			grid-template-columns: 1fr 1fr;
		}
		.action-form {
			grid-template-columns: 1fr;
		}
		.action-form label.full,
		.action-form h3,
		.action-form > p,
		.action-form > button {
			grid-column: auto;
		}
	}
</style>
