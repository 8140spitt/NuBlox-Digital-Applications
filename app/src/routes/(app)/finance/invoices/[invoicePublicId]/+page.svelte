<script lang="ts">
	let { data, form } = $props();

	function money(value: string | null, currency = data.invoice.currencyCode) {
		if (value === null) return '—';
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function dateInput(value: Date | null) {
		return value ? new Date(value).toISOString().slice(0, 10) : '';
	}
</script>

<svelte:head><title>{data.invoice.documentNumber ?? 'Draft invoice'} · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/finance/invoices">Invoices</a><span>/</span><span>{data.invoice.documentNumber ?? 'Draft invoice'}</span></nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">{data.invoice.invoiceType} invoice</p>
		<h1>{data.invoice.documentNumber ?? 'Draft invoice'}</h1>
		<p>{data.invoice.customerDisplayName}{data.invoice.contractNumber ? ` · ${data.invoice.contractNumber}` : ''}</p>
	</div>
	<div class="heading-actions">
		<a class="button secondary" href="/finance/tax">Tax settings</a>
		{#if data.invoice.lifecycleStatus === 'issued'}<a class="button secondary" href="/finance/payments">Payments</a>{/if}
		<span class={`status status-${data.invoice.lifecycleStatus}`}>{data.invoice.lifecycleStatus}</span>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="metrics">
	<div><span>Net</span><strong>{money(data.invoice.netTotal)}</strong></div>
	<div><span>Tax</span><strong>{money(data.invoice.taxTotal)}</strong></div>
	<div><span>Gross</span><strong>{money(data.invoice.grossTotal)}</strong></div>
	{#if data.receivablePosition.outstandingAmount !== null}
		<div><span>Issued credits</span><strong>{money(data.receivablePosition.issuedCreditGross)}</strong></div>
		<div><span>Active cash</span><strong>{money(data.receivablePosition.activeAllocatedAmount)}</strong></div>
		<div class="outstanding"><span>Outstanding</span><strong>{money(data.receivablePosition.outstandingAmount)}</strong><small>{data.receivablePosition.status.replace('_', ' ')}</small></div>
	{/if}
	<div><span>Current contract value</span><strong>{money(data.contractCurrentValue)}</strong></div>
	<div><span>Previously issued net</span><strong>{money(data.issuedContractNetBeforeThisInvoice)}</strong></div>
</section>

<div class="grid">
	<div class="stack">
		<section class="panel">
			<p class="eyebrow">Invoice</p><h2>Billing details</h2>
			{#if data.canManageDraft}
				<form method="POST" action="?/updateDraft" class="form-grid">
					<label>Type<select name="invoiceType" required>{#each ['standard','deposit','interim','final','retention','other'] as type}<option value={type} selected={type === data.invoice.invoiceType}>{type}</option>{/each}</select></label>
					<label>Payment term<select name="paymentTermPublicId"><option value="">Manual / none</option>{#each data.paymentTerms as term}<option value={term.publicId} selected={term.publicId === data.invoice.paymentTermPublicId}>{term.name}</option>{/each}</select></label>
					<label>Manual due date<input name="dueDate" type="date" value={dateInput(data.invoice.dueDate)}/></label>
					<label>Customer PO/reference<input name="customerPurchaseOrderReference" maxlength="160" value={data.invoice.customerPurchaseOrderReference ?? ''} required={data.invoice.purchaseOrderRequired}/></label>
					<button type="submit">Save draft</button>
				</form>
			{:else}
				<dl>
					<div><dt>Payment term</dt><dd>{data.invoice.paymentTermName ?? 'Manual / none'}</dd></div>
					<div><dt>Due date</dt><dd>{data.invoice.dueDate ? new Date(data.invoice.dueDate).toLocaleDateString() : 'Not set'}</dd></div>
					<div><dt>Customer PO/reference</dt><dd>{data.invoice.customerPurchaseOrderReference ?? 'Not provided'}</dd></div>
					<div><dt>Customer account reference</dt><dd>{data.invoice.customerAccountReference ?? 'Not set'}</dd></div>
				</dl>
			{/if}
			{#if data.invoice.purchaseOrderRequired}<p class="notice">This customer requires a PO/reference before invoice issue.</p>{/if}
		</section>

		<section class="panel">
			<div class="section-heading"><div><p class="eyebrow">Charge lines</p><h2>Invoice lines</h2></div><span>{data.lines.length}</span></div>
			{#if data.lines.length === 0}<p class="muted">Add at least one line before issue.</p>{:else}
				<div class="lines">{#each data.lines as line}<article class="line">
					<div class="line-main"><strong>{line.description}</strong><small>{line.quantity} × {money(line.unitRate)} · {line.salesItemTypeName}{line.unitSymbol ? ` · ${line.unitSymbol}` : ''}</small>{#each line.taxes as tax}<small>{tax.taxCategoryName} {tax.appliedRatePercent}% · {money(tax.taxAmount)}</small>{/each}</div>
					<div class="line-money"><strong>{money(line.grossAmount)}</strong><small>{money(line.netAmount)} net</small></div>
					{#if data.canManageDraft}<form method="POST" action="?/removeLine"><input type="hidden" name="lineNumber" value={line.lineNumber}/><button class="quiet" type="submit">Remove</button></form>{/if}
				</article>{/each}</div>
			{/if}
			{#if data.canManageDraft}
				{#if data.taxCategories.length === 0}
					<p class="notice">No active tax categories are available. <a href="/finance/tax">Configure tax settings</a> before adding an invoice line.</p>
				{:else}
					<form method="POST" action="?/addLine" class="line-form">
						<label>Item type<select name="salesItemTypeCode" required>{#each data.salesItemTypes as type}<option value={type.code}>{type.name}</option>{/each}</select></label>
						<label>Unit<select name="unitCode"><option value="">None</option>{#each data.units as unit}<option value={unit.code}>{unit.name}{unit.symbol ? ` (${unit.symbol})` : ''}</option>{/each}</select></label>
						<label class="wide">Description<input name="description" required/></label>
						<label>Quantity<input name="quantity" inputmode="decimal" value="1" required/></label>
						<label>Unit rate<input name="unitRate" inputmode="decimal" required/></label>
						<label>Tax<select name="taxCategoryPublicId" required><option value="" disabled selected>Select tax</option>{#each data.taxCategories as tax}<option value={tax.publicId}>{tax.name}{tax.ratePercent !== null ? ` (${tax.ratePercent}%)` : ''}</option>{/each}</select></label>
						<button type="submit">Add line</button>
					</form>
				{/if}
			{/if}
		</section>
	</div>

	<div class="stack">
		<section class="panel">
			<p class="eyebrow">Source</p><h2>Contract context</h2>
			<dl><div><dt>Contract</dt><dd>{data.invoice.contractNumber ?? 'None'}</dd></div><div><dt>Project</dt><dd>{data.invoice.projectNumber ?? 'None'}</dd></div><div><dt>Currency</dt><dd>{data.invoice.currencyCode}</dd></div></dl>
		</section>

		{#if data.canIssue}
			<section class="panel issue-panel">
				<p class="eyebrow">Issue</p><h2>Freeze and issue invoice</h2>
				<p class="muted">Issue allocates the legal invoice number, refreshes tax at the issue date and snapshots customer/billing evidence. The issued invoice then becomes immutable.</p>
				<form method="POST" action="?/issue" class="form-grid one-column">
					<label>Delivery channel<select name="deliveryChannel" required><option value="manual">Manual</option><option value="email">Email evidence</option><option value="portal">Portal evidence</option><option value="api">API evidence</option><option value="other">Other</option></select></label>
					<label>Recipient name<input name="recipientName" maxlength="255" placeholder="Defaults to billing contact"/></label>
					<label>Recipient email<input name="recipientEmail" type="email" maxlength="320" placeholder="Defaults to billing contact"/></label>
					<label>Issue note<textarea name="note" rows="3" maxlength="2000"></textarea></label>
					<button type="submit">Issue invoice</button>
				</form>
			</section>
		{/if}

		<section class="panel">
			<div class="section-heading"><div><p class="eyebrow">Evidence</p><h2>Issue history</h2></div><span>{data.issueEvents.length}</span></div>
			{#if data.issueEvents.length === 0}<p class="muted">No issue event recorded.</p>{:else}<div class="rows">{#each data.issueEvents as issue}<article class="evidence"><strong>Issue {issue.issueSequence} · {issue.deliveryChannel}</strong><small>{new Date(issue.issuedAt).toLocaleString()}</small><small>{issue.recipientName ?? 'No named recipient'}{issue.recipientEmail ? ` · ${issue.recipientEmail}` : ''} · {issue.deliveryStatus ?? 'unknown'}</small>{#if issue.note}<p>{issue.note}</p>{/if}</article>{/each}</div>{/if}
		</section>

		<section class="panel">
			<div class="section-heading"><div><p class="eyebrow">Snapshots</p><h2>Issued party evidence</h2></div><span>{data.partySnapshots.length}</span></div>
			{#if data.partySnapshots.length === 0}<p class="muted">Customer snapshots are created at issue.</p>{:else}<div class="rows">{#each data.partySnapshots as snapshot}<article class="evidence"><strong>{snapshot.snapshotRole} · {snapshot.displayName}</strong><small>{snapshot.email ?? 'No email'}{snapshot.referenceIdentifier ? ` · ${snapshot.referenceIdentifier}` : ''}</small></article>{/each}</div>{/if}
		</section>
	</div>
</div>

<style>
	.breadcrumbs{display:flex;gap:.55rem;align-items:center;color:var(--muted,#667085);font-size:.9rem;margin-bottom:1rem}.breadcrumbs a{color:inherit}.page-heading,.section-heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1rem}.page-heading h1,.panel h2{margin:.15rem 0}.heading-actions{display:flex;gap:.55rem;align-items:center;flex-wrap:wrap}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--muted,#667085);margin:0}.status{font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;border:1px solid var(--border,#d0d5dd);border-radius:999px;padding:.35rem .6rem}.status-issued{background:#ecfdf3;color:#027a48;border-color:#abefc6}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.65rem;margin-bottom:1rem}.metrics div{border:1px solid var(--border,#d0d5dd);border-radius:11px;padding:.75rem;background:var(--surface,#fff)}.metrics span{display:block;color:var(--muted,#667085);font-size:.76rem}.metrics strong{display:block;margin-top:.25rem}.metrics small{display:block;margin-top:.2rem;color:var(--muted,#667085);text-transform:capitalize}.outstanding{border-color:#98a2b3!important}.grid,.stack{display:grid;gap:1rem}.panel{border:1px solid var(--border,#d0d5dd);border-radius:14px;background:var(--surface,#fff);padding:1rem}.form-grid,.line-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;align-items:end;margin-top:1rem}.form-grid label,.line-form label{display:grid;gap:.3rem;font-size:.86rem;font-weight:600}.form-grid input,.form-grid select,.form-grid textarea,.line-form input,.line-form select{font:inherit;padding:.62rem;border:1px solid var(--border,#d0d5dd);border-radius:8px;background:transparent}.wide{grid-column:1/-1}.one-column{grid-template-columns:1fr}.lines,.rows{display:grid;gap:.6rem;margin-top:.8rem}.line{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:.8rem;align-items:center;border:1px solid var(--border,#e4e7ec);border-radius:10px;padding:.75rem}.line small,.evidence small{display:block;color:var(--muted,#667085);margin-top:.18rem}.line-money{text-align:right}.evidence{padding:.65rem;background:var(--surface-subtle,#f8fafc);border-radius:9px}.evidence p{margin:.4rem 0 0}.muted{color:var(--muted,#667085)}.notice{background:#fffaeb;color:#93370d;padding:.65rem;border-radius:9px}.notice a{color:inherit;font-weight:700}button,.button{font:inherit;font-weight:700;padding:.65rem .85rem;border-radius:9px;border:0;background:#1d2939;color:white;cursor:pointer;text-decoration:none}.secondary{background:transparent;color:inherit;border:1px solid var(--border,#d0d5dd)}.quiet{background:transparent;color:inherit;border:1px solid var(--border,#d0d5dd);padding:.4rem .55rem}.banner{padding:.75rem 1rem;border-radius:9px}.error{color:#b42318;background:#fef3f2}dl{margin:.7rem 0 0}dl div{display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0}dt{color:var(--muted,#667085)}dd{margin:0;text-align:right}@media(min-width:1050px){.grid{grid-template-columns:minmax(0,1.4fr) minmax(300px,.7fr)}}@media(max-width:650px){.form-grid,.line-form{grid-template-columns:1fr}.wide{grid-column:auto}.line{grid-template-columns:1fr}.line-money{text-align:left}.page-heading{display:grid}}
</style>