<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}
</script>

<svelte:head><title>{data.creditNote.documentNumber ?? 'Draft credit note'} · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Accounts receivable correction</p>
		<h1>{data.creditNote.documentNumber ?? 'Draft credit note'}</h1>
		<p>Against <a href={`/finance/invoices/${data.creditNote.originalInvoicePublicId}`}>{data.creditNote.originalInvoiceNumber}</a> · {data.creditNote.customerDisplayName}</p>
	</div>
	<div class="heading-actions"><a class="button secondary" href="/finance/credit-notes">Credit notes</a><span class={`status status-${data.creditNote.lifecycleStatus}`}>{data.creditNote.lifecycleStatus}</span></div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="summary-grid">
	<div class="metric"><span>Net credit</span><strong>{money(data.creditNote.netTotal, data.creditNote.currencyCode)}</strong></div>
	<div class="metric"><span>Tax credit</span><strong>{money(data.creditNote.taxTotal, data.creditNote.currencyCode)}</strong></div>
	<div class="metric"><span>Gross credit</span><strong>{money(data.creditNote.grossTotal, data.creditNote.currencyCode)}</strong></div>
</section>

<section class="panel">
	<p class="eyebrow">Reason</p>
	{#if data.canManageDraft}
		<form method="POST" action="?/updateReason" class="stack">
			<label>Correction reason<textarea name="reason" rows="3" required>{data.creditNote.reason}</textarea></label>
			<button type="submit">Save reason</button>
		</form>
	{:else}
		<p>{data.creditNote.reason}</p>
	{/if}
</section>

<section class="panel">
	<div class="section-heading"><div><p class="eyebrow">Credit composition</p><h2>Credit lines</h2><p class="muted">Amounts remain positive; the credit effect comes from the credit-note document type. Tax follows the original invoice's applied rate.</p></div><span>{data.lines.length}</span></div>
	{#if data.lines.length === 0}<p class="muted">No credit lines have been added.</p>{:else}
		<div class="line-list">
			{#each data.lines as line}
				<div class="line-row">
					<div><strong>Invoice line {line.originalInvoiceLineNumber}</strong><small>{line.description}</small></div>
					<div class="amount"><strong>{money(line.grossAmount, data.creditNote.currencyCode)}</strong><small>{line.quantity} × {money(line.unitRate, data.creditNote.currencyCode)}</small></div>
					{#if data.canManageDraft}
						<form method="POST" action="?/removeLine"><input type="hidden" name="lineNumber" value={line.lineNumber} /><button class="secondary compact" type="submit">Remove</button></form>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if data.canManageDraft}
		<form method="POST" action="?/addLine" class="add-line">
			<label>Original invoice line<select name="originalInvoiceLineNumber" required><option value="">Select line</option>{#each data.originalInvoiceLines as line}{#if Number(line.remainingQuantity) > 0}<option value={line.lineNumber}>Line {line.lineNumber} · {line.description} · {line.remainingQuantity} remaining</option>{/if}{/each}</select></label>
			<label>Quantity to credit<input name="quantity" required inputmode="decimal" placeholder="1.000000" /></label>
			<button type="submit">Add credit line</button>
		</form>
	{/if}
</section>

<section class="panel">
	<div class="section-heading"><div><p class="eyebrow">Original invoice capacity</p><h2>Source lines</h2></div></div>
	<div class="source-table">
		{#each data.originalInvoiceLines as line}
			<div><span>Line {line.lineNumber} · {line.description}</span><strong>{line.remainingQuantity} / {line.quantity} remaining</strong></div>
		{/each}
	</div>
</section>

{#if data.canIssue}
	<section class="panel issue-panel">
		<div><p class="eyebrow">Controlled issue</p><h2>Issue credit note</h2><p class="muted">Issue revalidates remaining source quantities, refreshes credit tax from the original invoice evidence, copies the original customer/address snapshots and allocates the CN number.</p></div>
		<form method="POST" action="?/issue" class="issue-form">
			<label>Delivery channel<select name="deliveryChannel"><option value="manual">Manual</option><option value="email">Email</option><option value="portal">Portal</option><option value="api">API</option><option value="other">Other</option></select></label>
			<label>Recipient name<input name="recipientName" placeholder="Defaults from original invoice" /></label>
			<label>Recipient email<input name="recipientEmail" type="email" placeholder="Defaults from original invoice" /></label>
			<label>Issue note<input name="note" /></label>
			<button type="submit">Issue credit note</button>
		</form>
	</section>
{/if}

{#if data.partySnapshots.length > 0 || data.issueEvents.length > 0}
	<section class="panel evidence-grid">
		<div><p class="eyebrow">Immutable party evidence</p><h2>Snapshots</h2>{#each data.partySnapshots as snapshot}<p><strong>{snapshot.snapshotRole}</strong> · {snapshot.displayName}{snapshot.email ? ` · ${snapshot.email}` : ''}</p>{/each}</div>
		<div><p class="eyebrow">Issue evidence</p><h2>Dispatch</h2>{#each data.issueEvents as issue}<p><strong>{issue.deliveryChannel}</strong> · {new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(issue.issuedAt)}{issue.recipientName ? ` · ${issue.recipientName}` : ''}</p>{/each}</div>
	</section>
{/if}

<style>
	.page-heading,.section-heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1.2rem}.page-heading h1,.panel h2{margin:.15rem 0}.heading-actions{display:flex;gap:.6rem;align-items:center}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--muted,#667085);margin:0}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;margin-bottom:1rem}.metric,.panel{border:1px solid var(--border,#d0d5dd);border-radius:14px;background:var(--surface,#fff);padding:1rem}.metric{display:grid;gap:.25rem}.metric span,.muted,small{color:var(--muted,#667085)}.metric strong{font-size:1.15rem}.panel{margin-bottom:1rem}.stack,.add-line,.issue-form{display:grid;gap:.7rem;margin-top:.8rem}.stack label,.add-line label,.issue-form label{display:grid;gap:.3rem;font-size:.86rem;font-weight:650}textarea,input,select{font:inherit;padding:.65rem;border:1px solid var(--border,#d0d5dd);border-radius:8px;background:white}.line-list{display:grid;gap:.55rem;margin-top:.8rem}.line-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.7fr) auto;gap:.8rem;align-items:center;padding:.75rem;border:1px solid var(--border,#e4e7ec);border-radius:10px}.line-row small{display:block;margin-top:.2rem}.amount{text-align:right}.source-table{display:grid;gap:.45rem;margin-top:.7rem}.source-table>div{display:flex;justify-content:space-between;gap:1rem;padding:.55rem 0;border-bottom:1px solid var(--border,#eaecf0)}.issue-panel{display:grid;gap:1rem}.evidence-grid{display:grid;gap:1rem}.status{font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;border:1px solid var(--border,#d0d5dd);border-radius:999px;padding:.3rem .55rem}.status-issued{background:#ecfdf3;color:#027a48;border-color:#abefc6}.status-draft{background:#f2f4f7;color:#344054}button,.button{font:inherit;font-weight:700;padding:.65rem .85rem;border-radius:9px;border:0;background:#1d2939;color:white;text-decoration:none;cursor:pointer}.secondary{background:transparent;color:inherit;border:1px solid var(--border,#d0d5dd)}.compact{padding:.45rem .65rem}.banner{padding:.75rem 1rem;border-radius:9px}.error{color:#b42318;background:#fef3f2}@media(min-width:900px){.add-line{grid-template-columns:minmax(260px,1fr) 180px auto;align-items:end}.issue-panel{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr)}.evidence-grid{grid-template-columns:1fr 1fr}}@media(max-width:650px){.summary-grid{grid-template-columns:1fr}.page-heading,.line-row,.source-table>div{display:grid}.amount{text-align:left}}
</style>
