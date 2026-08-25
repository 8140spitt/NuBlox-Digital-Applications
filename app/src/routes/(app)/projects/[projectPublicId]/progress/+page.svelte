<script lang="ts">
	let { data, form } = $props();

	function date(value: Date | null): string {
		return value ? value.toISOString().slice(0, 10) : '—';
	}

	function money(value: string | null, currency = data.earnedValue.currencyCode): string {
		if (value === null) return 'Restricted';
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return value;
		return new Intl.NumberFormat('en-GB', {
			style: currency ? 'currency' : 'decimal',
			currency: currency ?? undefined,
			maximumFractionDigits: 0
		}).format(numeric);
	}

	function index(value: number | null): string {
		return value === null ? '—' : value.toFixed(2);
	}

	function pct(value: number | null): string {
		return value === null ? '—' : `${value.toFixed(1)}%`;
	}

	function measurementFor(activityId: string) {
		return data.selectedMeasurements.find((measurement) => measurement.activityId === activityId);
	}

	function allocationFor(activityPublicId: string) {
		return data.selectedEarnedValueAllocations.find(
			(allocation) => allocation.activityPublicId === activityPublicId
		);
	}
</script>

<svelte:head>
	<title>Progress & earned value · {data.project.name} · NuBlox</title>
</svelte:head>

<div class="progress-page">
	<header class="page-header">
		<div>
			<p class="eyebrow">Project controls · Performance measurement</p>
			<h1>Progress & earned value</h1>
			<p class="lede">
				Record governed activity progress against a data date, approve official progress periods and
				compare the active performance baseline with canonical project actual cost.
			</p>
		</div>
		<nav class="context-links" aria-label="Project controls navigation">
			<a href={`/projects/${data.project.publicId}`}>Overview</a>
			<a href={`/projects/${data.project.publicId}/plan`}>Plan</a>
			<a href={`/projects/${data.project.publicId}/resources`}>Resources</a>
			<a href={`/projects/${data.project.publicId}/financials`}>Financials</a>
			<a class="active" href={`/projects/${data.project.publicId}/progress`}>Progress</a>
		</nav>
	</header>

	{#if form?.progressError}
		<p class="alert" role="alert">{form.progressError}</p>
	{/if}

	<section class="panel" aria-labelledby="ev-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Official performance</p>
				<h2 id="ev-heading">Earned-value position</h2>
			</div>
			<span>Data date {data.earnedValue.dataDate}</span>
		</div>
		{#if data.earnedValue.available}
			<div class="metric-grid" data-testid="earned-value-summary">
				<article>
					<span>BAC</span><strong>{money(data.earnedValue.budgetAtCompletion)}</strong>
				</article>
				<article>
					<span>Planned value · PV</span><strong>{money(data.earnedValue.plannedValue)}</strong
					><small>{pct(data.earnedValue.plannedPercent)} planned</small>
				</article>
				<article>
					<span>Earned value · EV</span><strong>{money(data.earnedValue.earnedValue)}</strong><small
						>{pct(data.earnedValue.earnedPercent)} earned</small
					>
				</article>
				<article>
					<span>Actual cost · AC</span><strong>{money(data.earnedValue.actualCost)}</strong>
				</article>
				<article
					class:warning={data.earnedValue.scheduleVariance !== null &&
						Number(data.earnedValue.scheduleVariance) < 0}
				>
					<span>Schedule variance</span><strong>{money(data.earnedValue.scheduleVariance)}</strong
					><small>SPI {index(data.earnedValue.schedulePerformanceIndex)}</small>
				</article>
				<article
					class:warning={data.earnedValue.costVariance !== null &&
						Number(data.earnedValue.costVariance) < 0}
				>
					<span>Cost variance</span><strong>{money(data.earnedValue.costVariance)}</strong><small
						>CPI {index(data.earnedValue.costPerformanceIndex)}</small
					>
				</article>
			</div>
			{#if data.earnedValue.reason}<p class="notice">{data.earnedValue.reason}</p>{/if}
			{#if data.earnedValue.activities.length}
				<div class="table-wrap">
					<table>
						<thead
							><tr
								><th>Activity</th><th>WBS</th><th>BAC</th><th>Planned</th><th>Actual</th><th>PV</th
								><th>EV</th></tr
							></thead
						>
						<tbody>
							{#each data.earnedValue.activities as activity}
								<tr>
									<td
										><strong>{activity.activityCode}</strong><span>{activity.activityName}</span
										></td
									>
									<td>{activity.wbsCode}</td>
									<td>{money(activity.budgetAtCompletion)}</td>
									<td>{activity.plannedPercent.toFixed(1)}%</td>
									<td>{activity.actualPercent.toFixed(1)}%</td>
									<td>{money(activity.plannedValue)}</td>
									<td>{money(activity.earnedValue)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{:else}
			<p class="empty-state">{data.earnedValue.reason}</p>
		{/if}
	</section>

	<section class="panel" aria-labelledby="period-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Controlled progress</p>
				<h2 id="period-heading">Progress periods</h2>
			</div>
			<span>{data.progressPeriods.length} periods</span>
		</div>

		{#if data.canManageProgress}
			<form class="inline-form" method="POST" action="?/createPeriod">
				<label>Label <input name="label" placeholder="August progress" required /></label>
				<label>Data date <input type="date" name="dataDate" required /></label>
				<button type="submit">Create progress period</button>
			</form>
		{/if}

		{#if data.progressPeriods.length}
			<div class="chip-list" aria-label="Progress periods">
				{#each data.progressPeriods as period}
					<a
						class:active={data.selectedPeriod?.publicId === period.publicId}
						href={`?period=${period.publicId}`}
					>
						#{period.periodNumber} · {period.label} · {date(period.dataDate)} · {period.status}
					</a>
				{/each}
			</div>
		{:else}
			<p class="empty-state">No progress periods have been created yet.</p>
		{/if}

		{#if data.selectedPeriod}
			<div class="subheading">
				<div>
					<strong>{data.selectedPeriod.label}</strong><span
						>Data date {date(data.selectedPeriod.dataDate)}</span
					>
				</div>
				<div class="actions">
					{#if data.canManageProgress && data.selectedPeriod.status === 'open'}
						<form method="POST" action="?/submitPeriod">
							<input
								type="hidden"
								name="periodPublicId"
								value={data.selectedPeriod.publicId}
							/><button class="secondary" type="submit">Submit period</button>
						</form>
					{/if}
					{#if data.canApproveProgress && data.selectedPeriod.status === 'submitted'}
						<form method="POST" action="?/approvePeriod">
							<input
								type="hidden"
								name="periodPublicId"
								value={data.selectedPeriod.publicId}
							/><button type="submit">Approve & lock</button>
						</form>
					{/if}
				</div>
			</div>

			<div class="activity-list">
				{#each data.activities as activity}
					{@const measurement = measurementFor(activity.id)}
					<article class="activity-card">
						<div class="activity-title">
							<div>
								<strong>{activity.activityCode} · {activity.name}</strong><span
									>{activity.wbsCode} · {activity.activityKind}</span
								>
							</div>
							<b
								>{measurement
									? `${Number(measurement.percentComplete).toFixed(1)}%`
									: 'Not measured'}</b
							>
						</div>
						{#if data.canManageProgress && data.selectedPeriod.status === 'open'}
							<form class="progress-form" method="POST" action="?/recordProgress">
								<input type="hidden" name="periodPublicId" value={data.selectedPeriod.publicId} />
								<input type="hidden" name="activityPublicId" value={activity.publicId} />
								<label
									>Method
									<select name="measurementMethod">
										<option
											value="manual_percent"
											selected={measurement?.measurementMethod === 'manual_percent'}
											>Physical %</option
										>
										<option
											value="milestone_0_100"
											selected={measurement?.measurementMethod === 'milestone_0_100'}
											>0 / 100</option
										>
										<option
											value="milestone_50_50"
											selected={measurement?.measurementMethod === 'milestone_50_50'}
											>50 / 50</option
										>
										<option
											value="quantity"
											selected={measurement?.measurementMethod === 'quantity'}>Quantity</option
										>
									</select>
								</label>
								<label
									>% complete <input
										name="percentComplete"
										inputmode="decimal"
										value={measurement?.percentComplete ?? '0'}
									/></label
								>
								<label
									>Actual start <input
										type="date"
										name="actualStartOn"
										value={measurement?.actualStartOn ? date(measurement.actualStartOn) : ''}
									/></label
								>
								<label
									>Actual finish <input
										type="date"
										name="actualFinishOn"
										value={measurement?.actualFinishOn ? date(measurement.actualFinishOn) : ''}
									/></label
								>
								<label
									>Remaining days <input
										name="remainingDurationDays"
										inputmode="decimal"
										value={measurement?.remainingDurationDays ?? ''}
									/></label
								>
								<label
									>Qty complete <input
										name="quantityComplete"
										inputmode="decimal"
										value={measurement?.quantityComplete ?? ''}
									/></label
								>
								<label
									>Qty total <input
										name="quantityTotal"
										inputmode="decimal"
										value={measurement?.quantityTotal ?? ''}
									/></label
								>
								<label
									>Unit <input name="quantityUnit" value={measurement?.quantityUnit ?? ''} /></label
								>
								<label class="wide"
									>Commentary <input
										name="commentary"
										value={measurement?.commentary ?? ''}
										placeholder="Evidence, reason or correction note"
									/></label
								>
								<div class="wide"><button type="submit">Save progress</button></div>
							</form>
						{:else if measurement}
							<div class="measurement-readout">
								<span>Method {measurement.measurementMethod}</span><span
									>Actual start {date(measurement.actualStartOn)}</span
								><span>Actual finish {date(measurement.actualFinishOn)}</span><span
									>{measurement.commentary ?? 'No commentary'}</span
								>
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="panel" aria-labelledby="baseline-heading">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Performance measurement baseline</p>
				<h2 id="baseline-heading">Earned-value baselines</h2>
			</div>
			<span>Schedule baseline + frozen control budget</span>
		</div>
		{#if data.canManageBaseline && data.planBaselines.length}
			<form class="inline-form baseline-create" method="POST" action="?/createBaseline">
				<label>Name <input name="name" placeholder="PMB 1" required /></label>
				<label
					>Schedule baseline
					<select name="planBaselinePublicId" required>
						<option value="">Select baseline</option>
						{#each data.planBaselines as baseline}<option value={baseline.publicId}
								>#{baseline.baselineNumber} · {baseline.name}</option
							>{/each}
					</select>
				</label>
				<button type="submit">Create performance baseline</button>
			</form>
		{/if}

		{#if data.earnedValueBaselines.length}
			<div class="chip-list">
				{#each data.earnedValueBaselines as baseline}
					<a
						class:active={data.selectedEarnedValueBaseline?.publicId === baseline.publicId}
						href={`?baseline=${baseline.publicId}`}
					>
						PMB #{baseline.baselineNumber} · {baseline.name} · {baseline.status}
					</a>
				{/each}
			</div>
		{/if}

		{#if data.selectedEarnedValueBaseline}
			<div class="baseline-summary">
				<div>
					<span>Frozen control budget</span><strong
						>{money(
							data.selectedEarnedValueBaseline.controlBudgetSnapshot,
							data.selectedEarnedValueBaseline.currencyCode
						)}</strong
					>
				</div>
				<div>
					<span>Allocated BAC</span><strong
						>{money(
							data.selectedEarnedValueBaseline.allocatedBudget,
							data.selectedEarnedValueBaseline.currencyCode
						)}</strong
					>
				</div>
				<div>
					<span>Schedule source</span><strong
						>#{data.selectedEarnedValueBaseline.sourcePlanBaselineNumber} · {data
							.selectedEarnedValueBaseline.sourcePlanBaselineName}</strong
					>
				</div>
			</div>
			{#if data.canManageBaseline && data.selectedEarnedValueBaseline.status === 'draft'}
				<div class="allocation-list">
					{#each data.selectedPlanBaselineActivities as activity}
						{@const allocation = allocationFor(activity.activityPublicId)}
						<form class="allocation-row" method="POST" action="?/setAllocation">
							<input
								type="hidden"
								name="baselinePublicId"
								value={data.selectedEarnedValueBaseline.publicId}
							/>
							<input type="hidden" name="activityPublicId" value={activity.activityPublicId} />
							<div>
								<strong>{activity.activityCode} · {activity.activityName}</strong><span
									>{activity.wbsCode} · {date(activity.plannedStartOn)} → {date(
										activity.plannedFinishOn
									)}</span
								>
							</div>
							<label
								>BAC <input
									name="budgetAtCompletionAmount"
									inputmode="decimal"
									value={allocation?.budgetAtCompletionAmount ?? '0.0000'}
								/></label
							>
							<button class="secondary" type="submit">Set</button>
						</form>
					{/each}
				</div>
				<form method="POST" action="?/approveBaseline" class="approve-baseline">
					<input
						type="hidden"
						name="baselinePublicId"
						value={data.selectedEarnedValueBaseline.publicId}
					/>
					<button type="submit">Approve performance baseline</button>
					<span>Approval requires allocated BAC to equal the frozen control budget exactly.</span>
				</form>
			{/if}
		{:else}
			<p class="empty-state">No performance-measurement baseline exists yet.</p>
		{/if}
	</section>
</div>

<style>
	.progress-page {
		display: grid;
		gap: 1rem;
		max-width: 1500px;
		margin: 0 auto;
	}
	.page-header,
	.panel,
	.metric-grid article {
		border: 1px solid var(--border-color, #d9dee7);
		background: var(--surface-color, #fff);
		border-radius: 1rem;
	}
	.page-header {
		padding: 1.35rem;
		display: flex;
		justify-content: space-between;
		gap: 1rem;
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
		max-width: 78ch;
		margin-bottom: 0;
		color: #586579;
	}
	.context-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}
	.context-links a,
	.chip-list a {
		color: inherit;
		text-decoration: none;
		border: 1px solid #d9dee7;
		border-radius: 999px;
		padding: 0.45rem 0.7rem;
		font-size: 0.86rem;
	}
	.context-links a.active,
	.chip-list a.active {
		border-color: #172033;
		background: #172033;
		color: white;
	}
	.panel {
		padding: 1.2rem;
	}
	.panel-heading,
	.subheading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		margin-bottom: 1rem;
	}
	.panel-heading h2 {
		margin-bottom: 0;
	}
	.panel-heading > span,
	.subheading span {
		color: #68758a;
		font-size: 0.86rem;
	}
	.metric-grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.metric-grid article {
		padding: 1rem;
		display: grid;
		gap: 0.3rem;
	}
	.metric-grid span,
	.metric-grid small {
		color: #68758a;
	}
	.metric-grid strong {
		font-size: 1.3rem;
	}
	.metric-grid article.warning {
		border-color: #d29029;
	}
	.notice,
	.empty-state,
	.alert {
		border-radius: 0.75rem;
		padding: 0.8rem 1rem;
		background: #f4f6f9;
		color: #586579;
	}
	.alert {
		background: #fff1f0;
		color: #9f2d24;
	}
	.table-wrap {
		overflow: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		padding: 0.7rem;
		border-bottom: 1px solid #e4e8ef;
		text-align: left;
		white-space: nowrap;
	}
	td span {
		display: block;
		color: #68758a;
		font-size: 0.8rem;
	}
	.inline-form,
	.progress-form {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.baseline-create {
		grid-template-columns: 1fr 1.4fr auto;
		align-items: end;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.82rem;
		font-weight: 650;
		color: #4f5b6d;
	}
	input,
	select {
		min-height: 2.45rem;
		border: 1px solid #cfd6e2;
		border-radius: 0.55rem;
		padding: 0.45rem 0.6rem;
		background: white;
		color: inherit;
	}
	button {
		min-height: 2.45rem;
		border: 0;
		border-radius: 0.55rem;
		padding: 0.5rem 0.85rem;
		background: #172033;
		color: white;
		font-weight: 700;
		cursor: pointer;
	}
	button.secondary {
		background: #eef1f5;
		color: #172033;
		border: 1px solid #d9dee7;
	}
	.chip-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-bottom: 1rem;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
	.activity-list,
	.allocation-list {
		display: grid;
		gap: 0.65rem;
	}
	.activity-card,
	.allocation-row {
		border: 1px solid #e0e5ed;
		border-radius: 0.8rem;
		padding: 0.9rem;
	}
	.activity-title {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.7rem;
	}
	.activity-title span,
	.allocation-row span,
	.measurement-readout span {
		display: block;
		color: #68758a;
		font-size: 0.82rem;
	}
	.progress-form {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin-bottom: 0;
	}
	.wide {
		grid-column: 1/-1;
	}
	.measurement-readout {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.baseline-summary {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.baseline-summary div {
		padding: 0.85rem;
		border: 1px solid #e0e5ed;
		border-radius: 0.75rem;
		display: grid;
		gap: 0.25rem;
	}
	.baseline-summary span {
		color: #68758a;
		font-size: 0.82rem;
	}
	.allocation-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 220px auto;
		gap: 0.75rem;
		align-items: end;
	}
	.approve-baseline {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.approve-baseline span {
		color: #68758a;
		font-size: 0.82rem;
	}
	@media (max-width: 1100px) {
		.metric-grid {
			grid-template-columns: repeat(3, 1fr);
		}
		.progress-form,
		.inline-form {
			grid-template-columns: repeat(2, 1fr);
		}
		.baseline-create {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 700px) {
		.page-header,
		.panel-heading,
		.subheading {
			align-items: flex-start;
			flex-direction: column;
		}
		.metric-grid,
		.baseline-summary,
		.progress-form,
		.inline-form {
			grid-template-columns: 1fr;
		}
		.allocation-row {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
	}
</style>
