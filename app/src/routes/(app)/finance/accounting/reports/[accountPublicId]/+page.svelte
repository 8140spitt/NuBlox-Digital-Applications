<script lang="ts">
	let { data } = $props();

	function dateText(value: Date) {
		return new Date(value).toLocaleDateString('en-GB');
	}

	function money(value: string) {
		return `${data.currencyCode} ${value}`;
	}

	function statusText(value: string) {
		return value.replaceAll('_', ' ');
	}

	function sourceTypeText(value: string) {
		return value.replaceAll('_', ' ');
	}

	function reportHref() {
		const query = new URLSearchParams({
			period: data.period.publicId,
			currency: data.currencyCode
		});
		return `/finance/accounting/reports?${query.toString()}`;
	}

	function runningBalance(entry: (typeof data.entries)[number]) {
		if (entry.runningDebit !== '0.0000') return `${money(entry.runningDebit)} Dr`;
		if (entry.runningCredit !== '0.0000') return `${money(entry.runningCredit)} Cr`;
		return money('0.0000');
	}
</script>

<svelte:head><title>{data.account.accountCode} drill-through · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/finance/invoices">Finance</a><span>/</span><a href="/finance/accounting">Accounting</a
	><span>/</span><a href={reportHref()}>Reports</a><span>/</span><span
		>{data.account.accountCode}</span
	>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Financial-report evidence</p>
		<h1>{data.account.accountCode} · {data.account.name}</h1>
		<p>
			Every amount below is derived from immutable journal lines for this account. Source references
			preserve the path back to the business event that created the accounting consequence.
		</p>
	</div>
	<a class="secondary" href={reportHref()}>Back to financial reports</a>
</section>

<section class="context-grid">
	<div>
		<span>Financial year</span><strong>{data.period.financialYearCode}</strong><small
			>{data.period.financialYearName}</small
		>
	</div>
	<div>
		<span>Period</span><strong>{data.period.periodNumber} · {data.period.name}</strong><small
			>{dateText(data.period.startsOn)}–{dateText(data.period.endsOn)}</small
		>
	</div>
	<div>
		<span>Status</span><strong class:open={data.period.status === 'open'}
			>{statusText(data.period.status)}</strong
		><small>{data.period.status === 'open' ? 'Provisional reporting' : 'Controlled period'}</small>
	</div>
	<div>
		<span>Currency</span><strong>{data.currencyCode}</strong><small
			>{data.account.accountType} · {data.account.normalBalance} normal balance</small
		>
	</div>
</section>

<section class="summary-grid" aria-label="Account reporting summary">
	<div>
		<span>Opening</span>
		<strong>{money(data.summary.openingDebit)} Dr</strong>
		<small>{money(data.summary.openingCredit)} Cr</small>
	</div>
	<div>
		<span>Period movement</span>
		<strong>{money(data.summary.periodDebit)} Dr</strong>
		<small>{money(data.summary.periodCredit)} Cr</small>
	</div>
	<div>
		<span>Closing</span>
		<strong>{money(data.summary.closingDebit)} Dr</strong>
		<small>{money(data.summary.closingCredit)} Cr</small>
	</div>
</section>

{#if data.period.status === 'open'}
	<section class="notice provisional">
		<strong>Live period</strong>
		<span>
			The current-period movement and closing balance are provisional. Later journals or additive
			reversals dated in this period will change the result.
		</span>
	</section>
{/if}

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Journal-to-source drill-through</p>
			<h2>Account ledger evidence</h2>
		</div>
		<span>{data.entries.length} journal {data.entries.length === 1 ? 'line' : 'lines'}</span>
	</div>

	{#if data.entries.length === 0}
		<div class="empty-state">
			<strong>No journal evidence in this reporting horizon.</strong>
			<span>This account has no movement up to the selected period end in {data.currencyCode}.</span
			>
		</div>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Date</th>
						<th>Phase</th>
						<th>Journal / evidence</th>
						<th>Source</th>
						<th>Debit</th>
						<th>Credit</th>
						<th>Running balance</th>
					</tr>
				</thead>
				<tbody>
					{#each data.entries as entry}
						<tr class:reversed={entry.reversedAt}>
							<td>{dateText(entry.accountingDate)}</td>
							<td
								><span class:period={entry.phase === 'period'} class="phase">{entry.phase}</span
								></td
							>
							<td>
								<strong>{entry.journalNumber}</strong>
								<small>{entry.description}</small>
								<small>{entry.memo}</small>
								{#if entry.reversedAt}<em>Reversed {dateText(entry.reversedAt)}</em>{/if}
							</td>
							<td>
								<strong>{sourceTypeText(entry.sourceType)}</strong>
								<small class="source-id">{entry.sourcePublicId}</small>
								{#if entry.sourceReference}
									<a href={entry.sourceReference.href}>{entry.sourceReference.label} evidence</a>
								{/if}
							</td>
							<td class="amount">{entry.debitAmount}</td>
							<td class="amount">{entry.creditAmount}</td>
							<td class="amount running">{runningBalance(entry)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<section class="notice">
	<strong>Audit interpretation</strong>
	<span>
		A reversed journal remains visible because NuBlox does not rewrite posted accounting history.
		Its separate reversal journal contributes from the reversal accounting date, preserving the
		report as it was known in earlier periods.
	</span>
</section>

<style>
	.breadcrumbs {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		color: #667085;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}
	.breadcrumbs a {
		color: inherit;
	}
	.page-heading,
	.section-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}
	.page-heading {
		margin-bottom: 1rem;
	}
	.page-heading h1,
	.panel h2 {
		margin: 0.15rem 0;
	}
	.page-heading p {
		margin: 0.2rem 0;
		color: #667085;
		max-width: 72rem;
		line-height: 1.45;
	}
	.secondary {
		font-weight: 700;
		color: #344054;
		white-space: nowrap;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.72rem;
		font-weight: 700;
		color: #667085;
		margin: 0;
	}
	.context-grid,
	.summary-grid {
		display: grid;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.context-grid {
		grid-template-columns: repeat(4, 1fr);
	}
	.summary-grid {
		grid-template-columns: repeat(3, 1fr);
	}
	.context-grid > div,
	.summary-grid > div {
		display: grid;
		gap: 0.2rem;
		padding: 0.8rem;
		border: 1px solid #e4e7ec;
		border-radius: 10px;
		background: white;
	}
	.context-grid span,
	.summary-grid span {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: #667085;
	}
	.context-grid small,
	.summary-grid small {
		color: #667085;
	}
	.context-grid strong.open {
		color: #b54708;
	}
	.panel {
		border: 1px solid #d0d5dd;
		border-radius: 14px;
		background: white;
		padding: 1rem;
		margin-bottom: 1rem;
	}
	.section-heading > span {
		padding: 0.25rem 0.5rem;
		border-radius: 999px;
		background: #f2f4f7;
		color: #475467;
		font-size: 0.75rem;
		font-weight: 700;
	}
	.notice,
	.empty-state {
		display: grid;
		gap: 0.25rem;
		padding: 0.85rem 1rem;
		margin-bottom: 1rem;
		border: 1px solid #b9cbe6;
		border-radius: 11px;
		background: #f5f8fc;
	}
	.notice span,
	.empty-state span {
		color: #667085;
		line-height: 1.45;
	}
	.provisional {
		border-color: #f4c790;
		background: #fffaeb;
	}
	.table-wrap {
		overflow: auto;
		margin-top: 0.75rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.84rem;
	}
	th,
	td {
		padding: 0.6rem;
		border-bottom: 1px solid #e4e7ec;
		vertical-align: top;
		text-align: left;
	}
	th {
		background: #f8fafc;
		color: #475467;
		white-space: nowrap;
	}
	td small,
	td em,
	td a {
		display: block;
		margin-top: 0.18rem;
	}
	td small {
		color: #667085;
	}
	td em {
		color: #b42318;
		font-style: normal;
		font-weight: 700;
	}
	td a {
		color: #175cd3;
		font-weight: 700;
	}
	.source-id {
		max-width: 18rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.amount {
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.running {
		font-weight: 700;
	}
	.phase {
		display: inline-flex;
		padding: 0.22rem 0.45rem;
		border-radius: 999px;
		background: #f2f4f7;
		color: #475467;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: capitalize;
	}
	.phase.period {
		background: #ecfdf3;
		color: #027a48;
	}
	tr.reversed {
		background: #fffbfa;
	}
	@media (max-width: 900px) {
		.page-heading,
		.section-heading {
			display: grid;
		}
		.context-grid,
		.summary-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
