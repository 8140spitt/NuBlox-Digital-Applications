<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}
</script>

<svelte:head><title>Credit notes · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Accounts receivable</p>
		<h1>Credit notes & corrections</h1>
		<p>Correct issued receivables without editing their legal history.</p>
	</div>
	<div class="heading-actions">
		<a class="button secondary" href="/finance/invoices">Invoices</a>
		<a class="button secondary" href="/finance/billing">Billing settings</a>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="panel">
	<div class="section-heading">
		<div><p class="eyebrow">Source invoices</p><h2>Issued invoices</h2><p class="muted">Credit notes reduce an issued receivable. Invoice void is reserved for invalid documents with no correction or active allocation history.</p></div>
		<span>{data.invoices.length}</span>
	</div>
	{#if data.invoices.length === 0}
		<p class="muted">No issued invoices are available.</p>
	{:else}
		<div class="source-list">
			{#each data.invoices as invoice}
				<article class="source-card">
					<div class="source-summary">
						<div><strong>{invoice.invoiceNumber}</strong><small>{invoice.customerDisplayName}</small></div>
						<div class="amount"><strong>{money(invoice.remainingGross, invoice.currencyCode)} remaining</strong><small>{money(invoice.invoiceGross, invoice.currencyCode)} issued · {money(invoice.issuedCreditGross, invoice.currencyCode)} credited</small></div>
					</div>
					<div class="actions-grid">
						{#if data.canCreate && invoice.canCredit}
							<form method="POST" action="?/create" class="action-form">
								<input type="hidden" name="invoicePublicId" value={invoice.invoicePublicId} />
								<label>Credit-note reason<textarea name="reason" rows="2" required placeholder="Why is this receivable being corrected?"></textarea></label>
								<button type="submit">Create draft credit note</button>
							</form>
						{/if}
						{#if data.canVoidInvoices}
							<form method="POST" action="?/voidInvoice" class="action-form danger-form">
								<input type="hidden" name="invoicePublicId" value={invoice.invoicePublicId} />
								<label>Void reason<input name="reason" required placeholder="Duplicate, invalid issue, etc." /></label>
								<button class="danger" type="submit">Void issued invoice</button>
							</form>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<section class="panel">
	<div class="section-heading"><div><p class="eyebrow">Correction history</p><h2>Credit notes</h2></div><span>{data.creditNotes.length}</span></div>
	{#if data.creditNotes.length === 0}
		<p class="muted">No credit notes have been created.</p>
	{:else}
		<div class="credit-list">
			{#each data.creditNotes as credit}
				<a class="credit-row" href={`/finance/credit-notes/${credit.publicId}`}>
					<div><strong>{credit.documentNumber ?? 'Draft credit note'}</strong><small>{credit.originalInvoiceNumber} · {credit.customerDisplayName}</small></div>
					<div class="amount"><strong>{money(credit.grossTotal, credit.currencyCode)}</strong><small>{credit.reason}</small></div>
					<span class={`status status-${credit.lifecycleStatus}`}>{credit.lifecycleStatus}</span>
				</a>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page-heading,.section-heading,.source-summary{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1.2rem}.page-heading h1,.panel h2{margin:.15rem 0}.heading-actions{display:flex;gap:.55rem;flex-wrap:wrap}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--muted,#667085);margin:0}.panel{border:1px solid var(--border,#d0d5dd);border-radius:14px;background:var(--surface,#fff);padding:1rem;margin-bottom:1rem}.source-list,.credit-list{display:grid;gap:.7rem;margin-top:.9rem}.source-card{border:1px solid var(--border,#e4e7ec);border-radius:11px;padding:.9rem}.source-summary small,.credit-row small{display:block;color:var(--muted,#667085);margin-top:.2rem}.actions-grid{display:grid;gap:.7rem;margin-top:.8rem}.action-form{display:grid;gap:.55rem;padding:.7rem;border-radius:9px;background:var(--surface-subtle,#f8fafc)}.action-form label{display:grid;gap:.3rem;font-size:.84rem;font-weight:650}.action-form input,.action-form textarea{font:inherit;padding:.6rem;border:1px solid var(--border,#d0d5dd);border-radius:8px;background:white}.danger-form{border:1px solid #fecdca}.credit-row{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.9fr) auto;gap:1rem;align-items:center;padding:.85rem;border:1px solid var(--border,#e4e7ec);border-radius:11px;color:inherit;text-decoration:none}.credit-row:hover{background:var(--surface-subtle,#f8fafc)}.amount{text-align:right}.status{font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;border:1px solid var(--border,#d0d5dd);border-radius:999px;padding:.3rem .55rem}.status-issued{background:#ecfdf3;color:#027a48;border-color:#abefc6}.status-draft{background:#f2f4f7;color:#344054}.muted{color:var(--muted,#667085)}button,.button{font:inherit;font-weight:700;padding:.65rem .85rem;border-radius:9px;border:0;background:#1d2939;color:white;text-decoration:none;cursor:pointer}.secondary{background:transparent;color:inherit;border:1px solid var(--border,#d0d5dd)}.danger{background:#b42318}.banner{padding:.75rem 1rem;border-radius:9px}.error{color:#b42318;background:#fef3f2}@media(min-width:900px){.actions-grid{grid-template-columns:1fr 1fr}}@media(max-width:650px){.page-heading,.source-summary{display:grid}.credit-row{grid-template-columns:1fr}.amount{text-align:left}}
</style>
