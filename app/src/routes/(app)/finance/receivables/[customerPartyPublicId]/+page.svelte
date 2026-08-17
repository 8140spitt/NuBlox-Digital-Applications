<script lang="ts">
	let { data } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function eventDate(value: Date | string) {
		return new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeZone: data.period.timezone
		}).format(new Date(value));
	}

	function dateOnly(value: Date | string) {
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
	}

	function movementLabel(kind: string) {
		return kind.replaceAll('_', ' ');
	}
</script>

<svelte:head><title>{data.customer.displayName} statement · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/finance/receivables">Receivables</a><span>/</span><span>{data.customer.displayName}</span></nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Customer account</p>
		<h1>{data.customer.displayName}</h1>
		<p>{data.customer.customerAccountReference ?? 'No customer account reference'} · reporting timezone {data.period.timezone}</p>
	</div>
	<a class="button secondary" href="/finance/receivables">Aged receivables</a>
</section>

<section class="panel period-panel">
	<div><p class="eyebrow">Statement period</p><h2>Derived account statement</h2><p class="muted">This is a live derived view of immutable finance events, not a separately issued statement document.</p></div>
	<form method="GET" class="period-form">
		<label>From<input type="date" name="from" value={data.period.from} required /></label>
		<label>To<input type="date" name="to" value={data.period.to} required /></label>
		<button type="submit">Apply period</button>
	</form>
</section>

{#if data.statements.length === 0}
	<section class="panel"><p class="muted">No receivable movements exist for this customer account.</p></section>
{:else}
	{#each data.statements as statement}
		<section class="panel statement-panel">
			<div class="section-heading">
				<div><p class="eyebrow">{statement.currencyCode}</p><h2>Account movements</h2></div>
				<div class="balance-summary"><span>Opening</span><strong>{money(statement.openingBalance, statement.currencyCode)}</strong><span>Closing</span><strong>{money(statement.closingBalance, statement.currencyCode)}</strong></div>
			</div>
			{#if statement.movements.length === 0}
				<p class="muted">No movements occurred inside this period. Opening and closing balances are unchanged.</p>
			{:else}
				<div class="table-wrap">
					<table>
						<thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th class="money">Debit</th><th class="money">Credit</th><th class="money">Balance</th></tr></thead>
						<tbody>
							{#each statement.movements as movement}
								<tr>
									<td>{eventDate(movement.occurredAt)}</td>
									<td><span class="movement-kind">{movementLabel(movement.kind)}</span></td>
									<td>{#if movement.invoicePublicId}<a href={`/finance/invoices/${movement.invoicePublicId}`}>{movement.reference}</a>{:else}{movement.reference}{/if}</td>
									<td>{movement.description}</td>
									<td class="money">{money(movement.debitAmount, statement.currencyCode)}</td>
									<td class="money">{money(movement.creditAmount, statement.currencyCode)}</td>
									<td class="money"><strong>{money(movement.runningBalance, statement.currencyCode)}</strong></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	{/each}
{/if}

<section class="panel">
	<div class="section-heading"><div><p class="eyebrow">As at {data.period.to}</p><h2>Aged outstanding invoices</h2></div></div>
	{#if data.aging.length === 0 || data.aging.every((position: { openInvoiceCount: number }) => position.openInvoiceCount === 0)}
		<p class="muted">No outstanding invoices remain at the statement end date.</p>
	{:else}
		<div class="aging-list">
			{#each data.aging as position}
				<article class="aging-card">
					<div class="aging-heading"><div><strong>{position.currencyCode} · {money(position.totalOutstanding, position.currencyCode)}</strong><small>{position.openInvoiceCount} open invoices</small></div></div>
					<div class="bucket-grid">{#each position.buckets as bucket}<div><span>{bucket.label}</span><strong>{money(bucket.amount, position.currencyCode)}</strong><small>{bucket.invoiceCount} invoice{bucket.invoiceCount === 1 ? '' : 's'}</small></div>{/each}</div>
					{#if position.invoices.length > 0}
						<div class="invoice-list">
							{#each position.invoices as invoice}
								<a class="invoice-row" href={`/finance/invoices/${invoice.invoicePublicId}`}>
									<div><strong>{invoice.invoiceNumber}</strong><small>Issued {eventDate(invoice.issuedAt)} · due {invoice.dueDate ? dateOnly(invoice.dueDate) : 'not set'} · {invoice.daysOverdue > 0 ? `${invoice.daysOverdue} days overdue` : 'current'}</small></div>
									<div class="money"><strong>{money(invoice.outstandingAmount, position.currencyCode)}</strong><small>{money(invoice.invoiceGross, position.currencyCode)} gross · {money(invoice.issuedCreditGross, position.currencyCode)} credits · {money(invoice.activeAllocatedAmount, position.currencyCode)} cash · {money(invoice.activeWriteOffAmount ?? '0.0000', position.currencyCode)} write-off</small></div>
								</a>
							{/each}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.breadcrumbs{display:flex;gap:.55rem;align-items:center;color:var(--muted,#667085);font-size:.9rem;margin-bottom:1rem}.breadcrumbs a{color:inherit}.page-heading,.period-panel,.section-heading,.aging-heading,.invoice-row{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1rem}.page-heading h1,.panel h2{margin:.15rem 0}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--muted,#667085);margin:0}.panel{border:1px solid var(--border,#d0d5dd);border-radius:14px;background:var(--surface,#fff);padding:1rem;margin-bottom:1rem}.period-form{display:flex;gap:.65rem;align-items:end;flex-wrap:wrap}.period-form label{display:grid;gap:.3rem;font-size:.84rem;font-weight:650}.period-form input{font:inherit;padding:.6rem;border:1px solid var(--border,#d0d5dd);border-radius:8px;background:white}.balance-summary{display:grid;grid-template-columns:auto auto;gap:.2rem .65rem;text-align:right}.balance-summary span{font-size:.76rem;color:var(--muted,#667085)}.table-wrap{overflow:auto;margin-top:.9rem}table{width:100%;border-collapse:collapse;min-width:850px}th,td{padding:.65rem;border-bottom:1px solid var(--border,#e4e7ec);text-align:left;font-size:.86rem;vertical-align:top}th{font-size:.75rem;color:var(--muted,#667085);text-transform:uppercase;letter-spacing:.04em}.money{text-align:right;white-space:nowrap}.movement-kind{text-transform:capitalize}.aging-list,.invoice-list{display:grid;gap:.75rem;margin-top:.85rem}.aging-card{border:1px solid var(--border,#e4e7ec);border-radius:11px;padding:.85rem}.aging-heading small,.invoice-row small{display:block;color:var(--muted,#667085);margin-top:.2rem}.bucket-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.55rem;margin-top:.75rem}.bucket-grid div{padding:.6rem;border-radius:9px;background:var(--surface-subtle,#f8fafc)}.bucket-grid span,.bucket-grid small{display:block;color:var(--muted,#667085);font-size:.75rem}.bucket-grid strong{display:block;margin:.18rem 0}.invoice-row{align-items:center;padding:.7rem;border-radius:9px;background:var(--surface-subtle,#f8fafc);color:inherit;text-decoration:none}.invoice-row:hover{background:#eef2f6}.muted{color:var(--muted,#667085)}button,.button{font:inherit;font-weight:700;padding:.65rem .85rem;border-radius:9px;border:0;background:#1d2939;color:white;text-decoration:none;cursor:pointer}.secondary{background:transparent;color:inherit;border:1px solid var(--border,#d0d5dd)}@media(max-width:800px){.period-panel,.page-heading{display:grid}.bucket-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:550px){.period-form{display:grid}.bucket-grid{grid-template-columns:1fr}.invoice-row{display:grid}.invoice-row .money{text-align:left}}
</style>
