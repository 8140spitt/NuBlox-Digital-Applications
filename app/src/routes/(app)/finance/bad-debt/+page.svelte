<script lang="ts">
	let { data, form } = $props();
	function money(value: string, currency: string) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value)); }
	function date(value: Date | string | null) { return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value)) : 'Not set'; }
</script>

<svelte:head><title>Bad debt · NuBlox</title></svelte:head>

<section class="page-heading">
	<div><p class="eyebrow">Finance</p><h1>Bad debt</h1><p>Assess doubtful receivables, recommend write-off, authorise loss recognition and record later cash recovery without rewriting the original invoice.</p></div>
	<a class="button secondary" href="/finance/receivables">Receivables</a>
</section>

{#if form?.actionError}<div class="alert">{form.actionError}</div>{/if}

<section class="panel">
	<div class="section-heading"><div><p class="eyebrow">Assessment queue</p><h2>Invoices with receivable remaining</h2></div></div>
	{#if data.invoiceCandidates.length === 0}
		<p class="muted">No issued invoice is currently available for a new bad-debt assessment.</p>
	{:else}
		<div class="cards">
			{#each data.invoiceCandidates as invoice}
				<article class="card">
					<div><strong>{invoice.invoiceNumber}</strong><small>{invoice.customerDisplayName} · due {date(invoice.dueDate)}</small></div>
					<strong>{money(invoice.outstandingAmount, invoice.currencyCode)}</strong>
					{#if data.canStartCase}
						<form method="POST" action="?/start" class="action-form">
							<input type="hidden" name="invoicePublicId" value={invoice.invoicePublicId} />
							<label>Assessment reason<textarea name="reason" maxlength="1000" required placeholder="Why is this receivable being assessed as doubtful?"></textarea></label>
							<button type="submit">Open bad-debt case</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<section class="panel">
	<div class="section-heading"><div><p class="eyebrow">Evidence</p><h2>Bad-debt cases</h2></div></div>
	{#if data.cases.length === 0}
		<p class="muted">No bad-debt cases have been recorded.</p>
	{:else}
		<div class="case-list">
			{#each data.cases as item}
				<a class="case-row" href={`/finance/bad-debt/${item.publicId}`}>
					<div><strong>{item.invoiceNumber}</strong><small>{item.customerDisplayName} · opened {date(item.openedAt)} · {item.status}</small><span>{item.openingReason}</span></div>
					<strong>{money(item.outstandingAmount, item.currencyCode)}</strong>
				</a>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page-heading,.section-heading,.case-row,.card>div:first-child{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1rem}.page-heading h1,.panel h2{margin:.15rem 0}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:#667085;margin:0}.panel{border:1px solid #d0d5dd;border-radius:14px;background:white;padding:1rem;margin-bottom:1rem}.cards,.case-list{display:grid;gap:.8rem;margin-top:.8rem}.card,.case-row{border:1px solid #e4e7ec;border-radius:11px;padding:.85rem;background:#fafafa}.card small,.case-row small,.case-row span{display:block;color:#667085;margin-top:.2rem}.case-row{color:inherit;text-decoration:none;align-items:center}.case-row:hover{background:#f2f4f7}.action-form{display:grid;gap:.6rem;margin-top:.8rem}.action-form label{display:grid;gap:.3rem;font-size:.84rem;font-weight:650}textarea{font:inherit;min-height:4.5rem;padding:.6rem;border:1px solid #d0d5dd;border-radius:8px}.muted{color:#667085}.alert{padding:.75rem 1rem;border:1px solid #fda29b;background:#fff1f0;border-radius:10px;margin-bottom:1rem}.button,button{font:inherit;font-weight:700;padding:.65rem .85rem;border-radius:9px;border:0;background:#1d2939;color:white;text-decoration:none;cursor:pointer}.secondary{background:transparent;color:inherit;border:1px solid #d0d5dd}@media(max-width:700px){.page-heading,.case-row{display:grid}.case-row>strong{text-align:left}}
</style>
