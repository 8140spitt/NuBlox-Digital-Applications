<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const categories = [
		['revenue', 'Revenue'],
		['labour', 'Labour'],
		['material', 'Material'],
		['plant', 'Plant'],
		['subcontract', 'Subcontract'],
		['professional_fee', 'Professional fee'],
		['overhead', 'Overhead'],
		['preliminaries', 'Preliminaries'],
		['retention', 'Retention'],
		['tax', 'Tax'],
		['contingency', 'Contingency'],
		['other', 'Other']
	] as const;

	function money(value: string | null | undefined): string {
		const parsed = Number(value ?? 0);
		if (!Number.isFinite(parsed)) return value ?? '—';
		if (!data.currencyCode) {
			return parsed.toLocaleString('en-GB', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			});
		}
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: data.currencyCode,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(parsed);
	}

	function date(value: Date | string): string {
		const parsed = value instanceof Date ? value : new Date(value);
		return new Intl.DateTimeFormat('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		}).format(parsed);
	}

	function statusLabel(value: string): string {
		return value.replaceAll('_', ' ');
	}

	function absoluteMoney(value: string): string {
		return money(String(Math.abs(Number(value))));
	}
</script>

<svelte:head>
	<title>Project financials · NuBlox</title>
</svelte:head>

<div class="page-shell">
	<header class="page-header">
		<div>
			<p class="eyebrow">{data.project.projectNumber} · Project controls</p>
			<h1>Project financial control</h1>
			<p class="lede">
				Live budget, commitment and actual cost from canonical source records, with governed
				forecast-at-completion and forward cash-flow snapshots.
			</p>
		</div>
		<a class="context-link" href={`/projects/${data.project.publicId}`}>Project overview</a>
	</header>

	{#if form?.financialError}
		<div class="alert alert-error" role="alert">
			<strong>Financial control action not completed.</strong>
			<span>{form.financialError}</span>
		</div>
	{/if}

	{#if data.currencyMismatch}
		<div class="alert alert-warning">
			<strong>One reporting currency is required for forecasting.</strong>
			<span>
				This project currently contains values in {data.currencyCodes.join(', ')}. Live source facts
				remain visible, but a governed forecast cannot be created until an explicit FX policy exists
				or the project facts use one currency.
			</span>
		</div>
	{/if}

	<section class="panel live-position" aria-labelledby="live-position-heading">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Live position</p>
				<h2 id="live-position-heading">Project cost position</h2>
			</div>
			<form method="GET" class="as-of-form">
				<label>
					<span>As of</span>
					<input type="date" name="asOf" value={data.asOf} />
				</label>
				<button type="submit" class="secondary">Refresh cut-off</button>
			</form>
		</div>

		<div class="metrics">
			<article>
				<span>Control budget</span>
				<strong>{money(data.totals.controlBudget)}</strong>
				<small>Approved baseline + approved adjustments</small>
			</article>
			<article>
				<span>Commitment</span>
				<strong>{money(data.totals.commitment)}</strong>
				<small>Issued purchase-order value</small>
			</article>
			<article>
				<span>Actual cost</span>
				<strong>{money(data.totals.actualCost)}</strong>
				<small>Receipts + labour + direct costs</small>
			</article>
			<article>
				<span>Remaining commitment</span>
				<strong>{money(data.totals.remainingCommitment)}</strong>
				<small>Committed value not yet incurred</small>
			</article>
			<article>
				<span>Approved change</span>
				<strong>{money(data.totals.approvedChange)}</strong>
				<small>Accepted commercial change</small>
			</article>
			<article>
				<span>Pending exposure</span>
				<strong>{money(data.totals.pendingChangeExposure)}</strong>
				<small>Issued change awaiting decision</small>
			</article>
		</div>

		{#if Number(data.totals.unclassifiedCommitment) !== 0 || Number(data.totals.unclassifiedActual) !== 0 || Number(data.totals.unclassifiedChangeExposure) !== 0}
			<div class="data-quality">
				<strong>Classification gate</strong>
				<p>
					A forecast snapshot cannot be created while project financial facts remain outside the
					cost-code structure.
				</p>
				<div>
					<span>Commitment {money(data.totals.unclassifiedCommitment)}</span>
					<span>Actual {money(data.totals.unclassifiedActual)}</span>
					<span>Change {money(data.totals.unclassifiedChangeExposure)}</span>
				</div>
			</div>
		{/if}

		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Cost code</th>
						<th>Control budget</th>
						<th>Commitment</th>
						<th>Actual</th>
						<th>Remaining</th>
						<th>FTC</th>
						<th>EAC</th>
						<th>Variance</th>
					</tr>
				</thead>
				<tbody>
					{#each data.costCodes as row}
						<tr>
							<td>
								<strong>{row.code}</strong>
								<span>{row.name}</span>
								<small>{row.categoryName}</small>
							</td>
							<td>{money(row.controlBudget)}</td>
							<td>{money(row.commitment)}</td>
							<td>{money(row.actualCost)}</td>
							<td>{money(row.remainingCommitment)}</td>
							<td>{row.forecastToComplete === null ? '—' : money(row.forecastToComplete)}</td>
							<td>{row.forecastAtCompletion === null ? '—' : money(row.forecastAtCompletion)}</td>
							<td class:negative={row.costVariance !== null && Number(row.costVariance) < 0}>
								{row.costVariance === null ? '—' : money(row.costVariance)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="two-column">
		<div class="panel" aria-labelledby="period-heading">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Reporting governance</p>
					<h2 id="period-heading">Commercial periods</h2>
				</div>
			</div>

			{#if data.canManageForecasts}
				<form method="POST" action="?/createPeriod" id="create-financial-period" class="stack-form">
					<label>
						<span>Period label</span>
						<input name="periodLabel" placeholder="August 2026" maxlength="120" required />
					</label>
					<div class="form-grid">
						<label>
							<span>Start</span>
							<input type="date" name="periodStart" required />
						</label>
						<label>
							<span>End</span>
							<input type="date" name="periodEnd" required />
						</label>
					</div>
					<button type="submit">Create reporting period</button>
				</form>
			{/if}

			<div class="record-list period-list">
				{#each data.periods as period}
					<article class="record-card">
						<div>
							<strong>{period.periodLabel}</strong>
							<span>{date(period.periodStart)} – {date(period.periodEnd)}</span>
						</div>
						<span class="status">{statusLabel(period.status)}</span>
						{#if data.canApproveForecasts && period.status !== 'closed'}
							<form method="POST" action="?/closePeriod">
								<input type="hidden" name="periodPublicId" value={period.publicId} />
								<button type="submit" class="secondary compact">Close period</button>
							</form>
						{:else if data.canApproveForecasts && period.status === 'closed'}
							<form method="POST" action="?/reopenPeriod">
								<input type="hidden" name="periodPublicId" value={period.publicId} />
								<button type="submit" class="secondary compact">Reopen period</button>
							</form>
						{/if}
					</article>
				{/each}
				{#if data.periods.length === 0}
					<p class="empty">No commercial reporting periods yet.</p>
				{/if}
			</div>
		</div>

		<div class="panel" aria-labelledby="forecast-register-heading">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Management judgement</p>
					<h2 id="forecast-register-heading">Forecast versions</h2>
				</div>
			</div>

			{#if data.canManageForecasts}
				<form
					method="POST"
					action="?/createForecast"
					id="create-financial-forecast"
					class="stack-form"
				>
					<label>
						<span>Open reporting period</span>
						<select name="periodPublicId" required>
							<option value="">Select period</option>
							{#each data.periods.filter((period) => period.status === 'open' || period.status === 'reopened') as period}
								<option value={period.publicId}>{period.periodLabel}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>Forecast project revenue</span>
						<input name="forecastRevenueAmount" inputmode="decimal" value="0.00" required />
					</label>
					<button type="submit">Create forecast snapshot</button>
				</form>
			{/if}

			<div class="record-list forecast-register">
				{#each data.forecasts as forecast}
					<a
						class="record-card selectable"
						href={`?forecast=${encodeURIComponent(forecast.publicId)}`}
					>
						<div>
							<strong>{forecast.periodLabel} · V{forecast.versionNumber}</strong>
							<span>Revenue {money(forecast.forecastRevenueAmount)}</span>
						</div>
						<span class="status">{statusLabel(forecast.status)}</span>
					</a>
				{/each}
				{#if data.forecasts.length === 0}
					<p class="empty">No forecast versions yet.</p>
				{/if}
			</div>
		</div>
	</section>

	{#if data.activeForecast}
		{@const active = data.activeForecast}
		<section class="panel forecast-panel" aria-labelledby="active-forecast-heading">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Governed snapshot · {active.forecast.periodLabel}</p>
					<h2 id="active-forecast-heading">Forecast V{active.forecast.versionNumber}</h2>
					<p>
						Snapshot cut-off {date(active.forecast.periodEnd)} ·
						<span class="status inline">{statusLabel(active.forecast.status)}</span>
					</p>
				</div>
				{#if active.forecast.status === 'draft' && data.canApproveForecasts}
					<form method="POST" action="?/approveForecast">
						<input type="hidden" name="forecastPublicId" value={active.forecast.publicId} />
						<button type="submit">Approve & lock forecast</button>
					</form>
				{/if}
			</div>

			<div class="metrics forecast-metrics">
				<article>
					<span>Forecast to complete</span>
					<strong>{money(active.forecastToComplete)}</strong>
					<small>Management judgement after cut-off</small>
				</article>
				<article>
					<span>Forecast final cost / EAC</span>
					<strong>{money(active.forecastAtCompletion)}</strong>
					<small>Actual at cut-off + FTC</small>
				</article>
				<article>
					<span>Cost variance</span>
					<strong class:negative={Number(active.costVariance) < 0}
						>{money(active.costVariance)}</strong
					>
					<small>Control budget − EAC</small>
				</article>
				<article>
					<span>Forecast margin</span>
					<strong class:negative={Number(active.forecastMargin) < 0}
						>{money(active.forecastMargin)}</strong
					>
					<small
						>{active.marginPercent === null
							? 'No revenue baseline'
							: `${active.marginPercent.toFixed(2)}% margin`}</small
					>
				</article>
			</div>

			<div class="snapshot-note">
				<strong>Snapshot semantics</strong>
				<span>
					Budget, actual, remaining commitment and change values below are the facts captured at
					this forecast cut-off. Editing FTC never changes those source records.
				</span>
			</div>

			<div class="forecast-lines">
				{#each active.lines as line}
					<article class="forecast-line">
						<div class="forecast-line-head">
							<div>
								<strong>{line.costCode} · {line.costCodeName}</strong>
								<span>
									Budget {money(line.controlBudgetSnapshot)} · Actual {money(
										line.actualCostSnapshot
									)} · Remaining commitment {money(line.remainingCommitmentSnapshot)}
								</span>
							</div>
							<strong>
								EAC {money(
									String(Number(line.actualCostSnapshot) + Number(line.forecastToCompleteAmount))
								)}
							</strong>
						</div>
						{#if active.forecast.status === 'draft' && data.canManageForecasts}
							<form method="POST" action="?/updateForecastLine" class="forecast-line-form">
								<input type="hidden" name="forecastPublicId" value={active.forecast.publicId} />
								<input type="hidden" name="costCodePublicId" value={line.costCodePublicId} />
								<label>
									<span>Forecast to complete</span>
									<input
										name="forecastToCompleteAmount"
										inputmode="decimal"
										value={line.forecastToCompleteAmount}
										required
									/>
								</label>
								<label class="grow">
									<span>Forecast commentary</span>
									<input name="commentary" maxlength="2000" value={line.commentary ?? ''} />
								</label>
								<button type="submit" class="secondary">Update FTC</button>
							</form>
						{:else if line.commentary}
							<p class="commentary">{line.commentary}</p>
						{/if}
					</article>
				{/each}
			</div>
		</section>

		<section class="panel" aria-labelledby="cash-flow-heading" id="cash-flow-plan">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Forward liquidity profile</p>
					<h2 id="cash-flow-heading">Forecast cash flow</h2>
				</div>
			</div>

			<div class="metrics cash-metrics">
				<article>
					<span>Planned inflow</span>
					<strong>{money(active.cashInflow)}</strong>
				</article>
				<article>
					<span>Planned outflow</span>
					<strong>{money(active.cashOutflow)}</strong>
				</article>
				<article>
					<span>Net forecast cash</span>
					<strong class:negative={Number(active.cashNet) < 0}>{money(active.cashNet)}</strong>
				</article>
				<article>
					<span>Outflow vs FTC</span>
					<strong class:negative={Number(active.cashOutflowVarianceToFtc) !== 0}>
						{Number(active.cashOutflowVarianceToFtc) === 0
							? 'Reconciled'
							: absoluteMoney(active.cashOutflowVarianceToFtc)}
					</strong>
					<small>Approval requires exact reconciliation</small>
				</article>
			</div>

			{#if active.forecast.status === 'draft' && data.canManageCashFlow}
				<form method="POST" action="?/addCashFlow" class="stack-form cash-form">
					<input type="hidden" name="forecastPublicId" value={active.forecast.publicId} />
					<div class="form-grid three">
						<label>
							<span>Date</span>
							<input type="date" name="flowDate" required />
						</label>
						<label>
							<span>Direction</span>
							<select name="direction" required>
								<option value="outflow">Outflow</option>
								<option value="inflow">Inflow</option>
							</select>
						</label>
						<label>
							<span>Category</span>
							<select name="category" required>
								{#each categories as category}
									<option value={category[0]}>{category[1]}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="form-grid">
						<label>
							<span>Cost code (optional)</span>
							<select name="costCodePublicId">
								<option value="">Project level</option>
								{#each data.costCodes as row}
									<option value={row.publicId}>{row.code} · {row.name}</option>
								{/each}
							</select>
						</label>
						<label>
							<span>Amount</span>
							<input name="amount" inputmode="decimal" required />
						</label>
					</div>
					<label>
						<span>Cash-flow commentary</span>
						<input name="commentary" maxlength="2000" />
					</label>
					<button type="submit">Add cash-flow line</button>
				</form>
			{/if}

			<div class="table-wrap">
				<table class="cash-table">
					<thead>
						<tr>
							<th>Date</th>
							<th>Direction</th>
							<th>Category</th>
							<th>Cost code</th>
							<th>Amount</th>
							<th>Commentary</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each active.cashFlowLines as line}
							<tr>
								<td>{date(line.flowDate)}</td>
								<td><span class="status">{line.direction}</span></td>
								<td>{statusLabel(line.category)}</td>
								<td>{line.costCode ?? 'Project'}</td>
								<td>{money(line.amount)}</td>
								<td>{line.commentary ?? '—'}</td>
								<td>
									{#if active.forecast.status === 'draft' && data.canManageCashFlow}
										<form method="POST" action="?/removeCashFlow">
											<input
												type="hidden"
												name="forecastPublicId"
												value={active.forecast.publicId}
											/>
											<input type="hidden" name="lineNumber" value={line.lineNumber} />
											<button type="submit" class="text-button">Remove</button>
										</form>
									{/if}
								</td>
							</tr>
						{/each}
						{#if active.cashFlowLines.length === 0}
							<tr><td colspan="7" class="empty">No forecast cash-flow lines yet.</td></tr>
						{/if}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>

<style>
	.page-shell {
		display: grid;
		gap: 1.25rem;
		padding: 1.5rem;
	}

	.page-header,
	.section-heading,
	.forecast-line-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}

	.page-header h1,
	.section-heading h2 {
		margin: 0.15rem 0 0;
	}

	.lede {
		max-width: 65rem;
		margin: 0.55rem 0 0;
		color: var(--text-secondary, #5c6470);
	}

	.eyebrow {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-secondary, #5c6470);
	}

	.context-link,
	.record-card.selectable {
		color: inherit;
		text-decoration: none;
	}

	.panel {
		border: 1px solid var(--border-color, #d9dde3);
		border-radius: 0.9rem;
		background: var(--surface, #fff);
		padding: 1.15rem;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 0.75rem;
		margin: 1rem 0;
	}

	.metrics article {
		display: grid;
		gap: 0.25rem;
		padding: 0.9rem;
		border: 1px solid var(--border-color, #e0e3e8);
		border-radius: 0.75rem;
		min-width: 0;
	}

	.metrics span,
	.metrics small,
	.record-card span,
	.forecast-line-head span,
	.snapshot-note span {
		color: var(--text-secondary, #626a75);
	}

	.metrics strong {
		font-size: 1.15rem;
		font-variant-numeric: tabular-nums;
	}

	.two-column {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
	}

	.stack-form,
	.forecast-line-form {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
		padding: 0.9rem;
		border-radius: 0.75rem;
		background: var(--surface-subtle, #f7f8fa);
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.form-grid.three {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.85rem;
		font-weight: 600;
	}

	input,
	select,
	button {
		font: inherit;
	}

	input,
	select {
		width: 100%;
		box-sizing: border-box;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--border-color, #cfd4dc);
		border-radius: 0.5rem;
		background: var(--surface, #fff);
		color: inherit;
	}

	button {
		width: fit-content;
		padding: 0.55rem 0.8rem;
		border: 1px solid currentColor;
		border-radius: 0.5rem;
		cursor: pointer;
	}

	button.secondary,
	.text-button {
		background: transparent;
	}

	button.compact {
		padding: 0.35rem 0.55rem;
		font-size: 0.8rem;
	}

	.text-button {
		border: 0;
		padding: 0;
		text-decoration: underline;
	}

	.as-of-form {
		display: flex;
		gap: 0.6rem;
		align-items: end;
	}

	.alert,
	.data-quality,
	.snapshot-note {
		display: grid;
		gap: 0.35rem;
		padding: 0.85rem 1rem;
		border-radius: 0.75rem;
	}

	.alert-error {
		border: 1px solid #b42318;
	}

	.alert-warning,
	.data-quality {
		border: 1px solid #b78600;
	}

	.data-quality div {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.86rem;
	}

	th,
	td {
		padding: 0.65rem 0.7rem;
		border-bottom: 1px solid var(--border-color, #e1e4e8);
		text-align: right;
		vertical-align: top;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	th:first-child,
	td:first-child,
	.cash-table th:nth-child(2),
	.cash-table td:nth-child(2),
	.cash-table th:nth-child(3),
	.cash-table td:nth-child(3),
	.cash-table th:nth-child(4),
	.cash-table td:nth-child(4),
	.cash-table th:nth-child(6),
	.cash-table td:nth-child(6) {
		text-align: left;
	}

	td:first-child {
		display: grid;
		gap: 0.12rem;
		white-space: normal;
		min-width: 12rem;
	}

	td:first-child span,
	td:first-child small {
		color: var(--text-secondary, #626a75);
	}

	.record-list,
	.forecast-lines {
		display: grid;
		gap: 0.65rem;
		margin-top: 0.9rem;
	}

	.record-card {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid var(--border-color, #dfe3e8);
		border-radius: 0.65rem;
	}

	.record-card div {
		display: grid;
		gap: 0.15rem;
	}

	.status {
		display: inline-flex;
		width: fit-content;
		padding: 0.18rem 0.45rem;
		border: 1px solid var(--border-color, #ced3da);
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: capitalize;
	}

	.status.inline {
		vertical-align: middle;
	}

	.forecast-metrics,
	.cash-metrics {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.snapshot-note {
		background: var(--surface-subtle, #f7f8fa);
	}

	.forecast-line {
		padding: 0.85rem;
		border: 1px solid var(--border-color, #dfe3e8);
		border-radius: 0.7rem;
	}

	.forecast-line-head div {
		display: grid;
		gap: 0.2rem;
	}

	.forecast-line-form {
		grid-template-columns: minmax(9rem, 0.5fr) minmax(15rem, 1fr) auto;
		align-items: end;
	}

	.commentary {
		margin-bottom: 0;
		color: var(--text-secondary, #626a75);
	}

	.negative {
		color: #b42318;
	}

	.empty {
		color: var(--text-secondary, #626a75);
	}

	@media (max-width: 1180px) {
		.metrics {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.forecast-metrics,
		.cash-metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 840px) {
		.page-shell {
			padding: 1rem;
		}

		.page-header,
		.section-heading,
		.forecast-line-head,
		.two-column {
			display: grid;
			grid-template-columns: 1fr;
		}

		.metrics,
		.forecast-metrics,
		.cash-metrics,
		.form-grid,
		.form-grid.three,
		.forecast-line-form {
			grid-template-columns: 1fr;
		}

		.as-of-form {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
