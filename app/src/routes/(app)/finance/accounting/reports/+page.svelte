<script lang="ts">
	let { data } = $props();

	function dateText(value: Date) {
		return new Date(value).toLocaleDateString('en-GB');
	}

	function money(value: string) {
		return `${data.selectedCurrency} ${value}`;
	}

	function statusText(value: string) {
		return value.replaceAll('_', ' ');
	}
</script>

<svelte:head><title>Financial reports · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/finance/invoices">Finance</a><span>/</span><a href="/finance/accounting">Accounting</a><span>/</span><span>Reports</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Derived accounting reporting</p>
		<h1>Trial balance and financial reports</h1>
		<p>Opening, period and closing balances are derived from immutable accounting journal lines. Reports are currency-specific and never create an editable reporting ledger.</p>
	</div>
	<a class="secondary" href="/finance/accounting/periods">Accounting periods</a>
</section>

<section class="panel filters">
	<form method="GET">
		<label>Accounting period
			<select name="period">
				{#each data.periods as period}
					<option value={period.publicId} selected={data.selectedPeriod?.publicId === period.publicId}>
						{period.financialYearCode} · {period.periodNumber} · {period.name} · {statusText(period.status)}
					</option>
				{/each}
			</select>
		</label>
		<label>Currency
			<select name="currency">
				{#each data.currencies as currency}<option value={currency} selected={data.selectedCurrency === currency}>{currency}</option>{/each}
			</select>
		</label>
		<button type="submit">View report</button>
	</form>
</section>

{#if !data.selectedPeriod}
	<section class="notice">
		<strong>No accounting period is configured.</strong>
		<span>Create a financial year and period before running governed accounting reports.</span>
		<a href="/finance/accounting/periods">Configure accounting periods</a>
	</section>
{:else}
	<section class="report-context">
		<div><span>Period</span><strong>{data.selectedPeriod.financialYearCode} · {data.selectedPeriod.periodNumber} · {data.selectedPeriod.name}</strong></div>
		<div><span>Dates</span><strong>{dateText(data.selectedPeriod.startsOn)}–{dateText(data.selectedPeriod.endsOn)}</strong></div>
		<div><span>Status</span><strong class:open={data.selectedPeriod.status === 'open'}>{statusText(data.selectedPeriod.status)}</strong></div>
		<div><span>Currency</span><strong>{data.selectedCurrency}</strong></div>
	</section>

	{#if data.selectedPeriod.status === 'open'}
		<section class="notice provisional"><strong>Live period</strong><span>This report is provisional because the selected accounting period is still open. Later journals or reversals dated in this period will change the result.</span></section>
	{/if}

	<section class="panel">
		<div class="section-heading">
			<div><p class="eyebrow">Double-entry control</p><h2>Trial balance</h2></div>
			<div class="balance-badges">
				<span class:bad={!data.trialBalance.openingBalanced}>Opening {data.trialBalance.openingBalanced ? 'balanced' : 'out of balance'}</span>
				<span class:bad={!data.trialBalance.periodBalanced}>Period {data.trialBalance.periodBalanced ? 'balanced' : 'out of balance'}</span>
				<span class:bad={!data.trialBalance.closingBalanced}>Closing {data.trialBalance.closingBalanced ? 'balanced' : 'out of balance'}</span>
			</div>
		</div>
		<div class="table-wrap">
			<table>
				<thead><tr><th rowspan="2">Account</th><th colspan="2">Opening</th><th colspan="2">Period movement</th><th colspan="2">Closing</th></tr><tr><th>Debit</th><th>Credit</th><th>Debit</th><th>Credit</th><th>Debit</th><th>Credit</th></tr></thead>
				<tbody>
					{#each data.trialBalance.rows as row}
						<tr><td><strong>{row.accountCode}</strong><small>{row.name} · {row.accountType}</small></td><td>{row.openingDebit}</td><td>{row.openingCredit}</td><td>{row.periodDebit}</td><td>{row.periodCredit}</td><td>{row.closingDebit}</td><td>{row.closingCredit}</td></tr>
					{/each}
				</tbody>
				<tfoot><tr><th>Totals</th><th>{data.trialBalance.openingDebit}</th><th>{data.trialBalance.openingCredit}</th><th>{data.trialBalance.periodDebit}</th><th>{data.trialBalance.periodCredit}</th><th>{data.trialBalance.closingDebit}</th><th>{data.trialBalance.closingCredit}</th></tr></tfoot>
			</table>
		</div>
	</section>

	<div class="report-grid">
		<section class="panel">
			<div class="section-heading"><div><p class="eyebrow">Account-type presentation</p><h2>Profit and loss</h2></div></div>
			<h3>Revenue</h3>
			<div class="statement-lines">{#each data.profitAndLoss.revenue as row}<div><span>{row.accountCode} · {row.name}</span><strong>{money(row.amount)}</strong></div>{/each}</div>
			<div class="statement-total"><span>Period revenue</span><strong>{money(data.profitAndLoss.periodRevenue)}</strong></div>
			<h3>Expenses</h3>
			<div class="statement-lines">{#each data.profitAndLoss.expenses as row}<div><span>{row.accountCode} · {row.name}</span><strong>{money(row.amount)}</strong></div>{/each}</div>
			<div class="statement-total"><span>Period expenses</span><strong>{money(data.profitAndLoss.periodExpenses)}</strong></div>
			<div class="statement-result"><span>Period profit / (loss)</span><strong>{money(data.profitAndLoss.periodProfit)}</strong></div>
			<div class="ytd"><span>Financial-year-to-date profit / (loss)</span><strong>{money(data.profitAndLoss.yearToDateProfit)}</strong><small>Revenue {money(data.profitAndLoss.yearToDateRevenue)} · expenses {money(data.profitAndLoss.yearToDateExpenses)}</small></div>
		</section>

		<section class="panel">
			<div class="section-heading"><div><p class="eyebrow">Closing position</p><h2>Balance sheet view</h2></div><span class:bad={!data.balanceSheet.balanced}>{data.balanceSheet.balanced ? 'Balanced' : 'Out of balance'}</span></div>
			<h3>Assets</h3>
			<div class="statement-lines">{#each data.balanceSheet.assets as row}<div><span>{row.accountCode} · {row.name}</span><strong>{money(row.amount)}</strong></div>{/each}</div>
			<div class="statement-total"><span>Total assets</span><strong>{money(data.balanceSheet.assetsTotal)}</strong></div>
			<h3>Liabilities</h3>
			<div class="statement-lines">{#each data.balanceSheet.liabilities as row}<div><span>{row.accountCode} · {row.name}</span><strong>{money(row.amount)}</strong></div>{/each}</div>
			<div class="statement-total"><span>Total liabilities</span><strong>{money(data.balanceSheet.liabilitiesTotal)}</strong></div>
			<h3>Equity</h3>
			<div class="statement-lines">{#each data.balanceSheet.equity as row}<div><span>{row.accountCode} · {row.name}</span><strong>{money(row.amount)}</strong></div>{/each}</div>
			<div class="statement-total"><span>Configured equity accounts</span><strong>{money(data.balanceSheet.equityTotal)}</strong></div>
			<div class="statement-total"><span>Unclosed earnings from journal history</span><strong>{money(data.balanceSheet.unclosedEarnings)}</strong></div>
			<div class="statement-result"><span>Liabilities + equity + unclosed earnings</span><strong>{money(data.balanceSheet.liabilitiesEquityAndEarningsTotal)}</strong></div>
			<p class="explain">Until a later year-end closing-journal boundary exists, cumulative revenue less expenses is shown separately as unclosed earnings rather than being silently moved into retained earnings.</p>
		</section>
	</div>
{/if}

<style>
	.breadcrumbs{display:flex;gap:.55rem;align-items:center;color:#667085;font-size:.9rem;margin-bottom:1rem}.breadcrumbs a{color:inherit}.page-heading,.section-heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1rem}.page-heading h1,.panel h2{margin:.15rem 0}.page-heading p{margin:.2rem 0;color:#667085;max-width:72rem}.secondary{font-weight:700;color:#344054;white-space:nowrap}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:#667085;margin:0}.panel{border:1px solid #d0d5dd;border-radius:14px;background:white;padding:1rem;margin-bottom:1rem}.filters form{display:grid;grid-template-columns:minmax(16rem,2fr) minmax(8rem,1fr) auto;gap:.75rem;align-items:end}.notice{display:grid;gap:.25rem;padding:.85rem 1rem;margin-bottom:1rem;border:1px solid #b9cbe6;border-radius:11px;background:#f5f8fc}.notice span,.explain{color:#667085;line-height:1.45}.notice a{font-weight:700;color:#344054}.provisional{border-color:#f4c790;background:#fffaeb}.report-context{display:grid;grid-template-columns:2fr 2fr 1fr 1fr;gap:.7rem;margin-bottom:1rem}.report-context div{display:grid;gap:.2rem;padding:.7rem;border:1px solid #e4e7ec;border-radius:10px;background:white}.report-context span{font-size:.75rem;text-transform:uppercase;color:#667085}.report-context strong{text-transform:capitalize}.report-context strong.open{color:#b54708}.balance-badges{display:flex;flex-wrap:wrap;gap:.35rem}.balance-badges span,.section-heading>span{padding:.25rem .5rem;border-radius:999px;background:#ecfdf3;color:#027a48;font-size:.75rem;font-weight:700}.balance-badges span.bad,.section-heading>span.bad{background:#fef3f2;color:#b42318}.table-wrap{overflow:auto;margin-top:.75rem}table{width:100%;border-collapse:collapse;font-size:.86rem}th,td{text-align:right;padding:.55rem;border-bottom:1px solid #e4e7ec;white-space:nowrap}th:first-child,td:first-child{text-align:left}thead tr:first-child th{text-align:center;background:#f8fafc}thead tr:first-child th:first-child{text-align:left}td small{display:block;color:#667085;margin-top:.12rem}tfoot th{border-top:2px solid #98a2b3}.report-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.panel h3{font-size:.9rem;margin:1rem 0 .35rem;color:#475467}.statement-lines{display:grid;gap:.25rem}.statement-lines div,.statement-total,.statement-result,.ytd{display:flex;justify-content:space-between;gap:1rem;padding:.45rem .55rem}.statement-lines div{background:#f8fafc;border-radius:7px;font-size:.86rem}.statement-total{border-top:1px solid #e4e7ec;font-weight:650}.statement-result{margin-top:.5rem;border-top:2px solid #667085;border-bottom:2px solid #667085;font-weight:800}.ytd{display:grid;grid-template-columns:1fr auto;margin-top:.65rem;background:#f5f8fc;border-radius:8px;font-weight:700}.ytd small{grid-column:1/-1;color:#667085;font-weight:400}.explain{font-size:.82rem}label{display:grid;gap:.3rem;font-size:.85rem;font-weight:650}select{font:inherit;padding:.58rem;border:1px solid #cfd4dc;border-radius:8px;background:white}button{font:inherit;font-weight:700;padding:.6rem .8rem;border:0;border-radius:8px;background:#1d2939;color:white;cursor:pointer}@media(max-width:900px){.page-heading,.section-heading{display:grid}.filters form,.report-context,.report-grid{grid-template-columns:1fr}.ytd{grid-template-columns:1fr}}
</style>
