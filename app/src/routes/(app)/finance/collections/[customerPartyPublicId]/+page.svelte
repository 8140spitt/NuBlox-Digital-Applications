<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function date(value: Date | string) {
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: data.receivable.period.timezone }).format(new Date(value));
	}

	function label(value: string) {
		return value.replaceAll('_', ' ');
	}

	const overdueInvoices = $derived(data.receivable.aging.flatMap((position) => position.invoices.filter((invoice) => invoice.daysOverdue > 0)));
	const currencies = $derived([...new Set(overdueInvoices.map((invoice) => invoice.currencyCode))]);
</script>

<svelte:head><title>{data.receivable.customer.displayName} collections · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/finance/collections">Collections</a><span>/</span><span>{data.receivable.customer.displayName}</span></nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Customer collections</p>
		<h1>{data.receivable.customer.displayName}</h1>
		<p>{data.receivable.customer.customerAccountReference ?? 'No account reference'} · receivable position as at {data.receivable.period.to}</p>
	</div>
	<a class="button secondary" href={`/finance/receivables/${data.receivable.customer.publicId}`}>Customer statement</a>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="panel">
	<div class="section-heading"><div><p class="eyebrow">Live ledger position</p><h2>Overdue invoices</h2><p class="muted">Collections evidence never changes these balances. Credits and payment allocations remain authoritative.</p></div><span>{overdueInvoices.length}</span></div>
	{#if overdueInvoices.length === 0}
		<p class="muted">This customer currently has no overdue receivable.</p>
	{:else}
		<div class="table-wrap"><table><thead><tr><th>Invoice</th><th>Due</th><th>Age</th><th>Outstanding</th></tr></thead><tbody>
			{#each overdueInvoices as invoice}
				<tr><td><a href={`/finance/invoices/${invoice.invoicePublicId}`}>{invoice.invoiceNumber}</a></td><td>{invoice.dueDate ? date(invoice.dueDate) : '—'}</td><td>{invoice.daysOverdue} days</td><td>{money(invoice.outstandingAmount, invoice.currencyCode)}</td></tr>
			{/each}
		</tbody></table></div>
	{/if}
</section>

<section class="panel case-panel">
	<div>
		<p class="eyebrow">Controlled case</p>
		<h2>{data.case ? `Case ${data.case.status}` : 'No collections case'}</h2>
		{#if data.case}<p class="muted">Opened {date(data.case.openedAt)}{data.case.closedAt ? ` · closed ${date(data.case.closedAt)}` : ''}</p>{/if}
	</div>
	<div class="case-actions">
		{#if data.canStartCase}
			<form method="POST" action="?/startCase"><button type="submit">Start collections case</button></form>
		{/if}
		{#if data.canManageCase && data.case}
			{#if data.case.status === 'open'}
				<form method="POST" action="?/caseStatus"><input type="hidden" name="casePublicId" value={data.case.publicId}/><input type="hidden" name="status" value="paused"/><button class="secondary" type="submit">Pause</button></form>
			{:else if data.case.status === 'paused'}
				<form method="POST" action="?/caseStatus"><input type="hidden" name="casePublicId" value={data.case.publicId}/><input type="hidden" name="status" value="open"/><button type="submit">Resume</button></form>
			{/if}
		{/if}
	</div>
</section>

{#if data.case && data.case.status !== 'closed'}
	<div class="grid-two">
		<section class="panel">
			<p class="eyebrow">Evidence</p><h2>Record collection action</h2>
			{#if data.canRecordAction}
				<form method="POST" action="?/recordAction" class="form-grid">
					<input type="hidden" name="casePublicId" value={data.case.publicId}/>
					<label>Action<select name="actionType" required><option value="reminder">Reminder</option><option value="phone_call">Phone call</option><option value="note">Internal note</option></select></label>
					<label>Channel<select name="deliveryChannel"><option value="manual">Manual</option><option value="email">Email</option><option value="portal">Portal</option><option value="phone">Phone</option><option value="letter">Letter</option><option value="other">Other</option></select></label>
					<label class="wide">Subject<input name="subject" maxlength="255"/></label>
					<label class="wide">Message / note<textarea name="messageBody" rows="4" required></textarea></label>
					<label class="wide">Outcome<input name="outcome" maxlength="1000"/></label>
					<div class="wide"><button type="submit">Record evidence</button></div>
				</form>
			{:else}<p class="muted">Collection-action authority is required.</p>{/if}
		</section>

		<section class="panel">
			<p class="eyebrow">Commitment</p><h2>Record promise to pay</h2>
			{#if data.canManagePromises}
				<form method="POST" action="?/recordPromise" class="form-grid">
					<input type="hidden" name="casePublicId" value={data.case.publicId}/>
					<label class="wide">Invoice<select name="invoicePublicId"><option value="">Account-level promise</option>{#each overdueInvoices as invoice}<option value={invoice.invoicePublicId}>{invoice.invoiceNumber} · {invoice.currencyCode}</option>{/each}</select></label>
					<label>Amount<input name="amount" inputmode="decimal" required/></label>
					<label>Currency<select name="currencyCode" required>{#each currencies as currency}<option value={currency}>{currency}</option>{/each}</select></label>
					<label class="wide">Due date<input type="date" name="dueOn" required/></label>
					<div class="wide"><button type="submit">Record promise</button></div>
				</form>
			{:else}<p class="muted">Promise-to-pay authority is required.</p>{/if}
		</section>

		<section class="panel">
			<p class="eyebrow">Customer challenge</p><h2>Open dispute</h2>
			{#if data.canManageDisputes}
				<form method="POST" action="?/openDispute" class="form-grid">
					<input type="hidden" name="casePublicId" value={data.case.publicId}/>
					<label class="wide">Invoice<select name="invoicePublicId"><option value="">Account-level dispute</option>{#each overdueInvoices as invoice}<option value={invoice.invoicePublicId}>{invoice.invoiceNumber} · {invoice.currencyCode}</option>{/each}</select></label>
					<label>Disputed amount<input name="disputedAmount" inputmode="decimal"/></label>
					<label>Currency<select name="currencyCode"><option value="">No amount specified</option>{#each currencies as currency}<option value={currency}>{currency}</option>{/each}</select></label>
					<label class="wide">Reason<textarea name="reason" rows="4" required></textarea></label>
					<div class="wide"><button type="submit">Open dispute</button></div>
				</form>
			{:else}<p class="muted">Dispute-management authority is required.</p>{/if}
		</section>

		<section class="panel">
			<p class="eyebrow">Lifecycle</p><h2>Close collections case</h2>
			<p class="muted">All open promises and disputes must be resolved before closure.</p>
			{#if data.canManageCase}
				<form method="POST" action="?/caseStatus" class="form-grid"><input type="hidden" name="casePublicId" value={data.case.publicId}/><input type="hidden" name="status" value="closed"/><label class="wide">Close reason<textarea name="reason" rows="3" required></textarea></label><div class="wide"><button class="danger" type="submit">Close case</button></div></form>
			{/if}
		</section>
	</div>
{/if}

<div class="grid-two">
	<section class="panel">
		<div class="section-heading"><div><p class="eyebrow">Promises</p><h2>Promises to pay</h2></div><span>{data.promises.length}</span></div>
		{#if data.promises.length === 0}<p class="muted">No promises recorded.</p>{:else}<div class="stack">{#each data.promises as promise}<article class="record"><div><strong>{money(promise.promisedAmount, promise.currencyCode)}</strong><small>Due {date(promise.dueOn)}{promise.invoicePublicId ? ' · invoice-linked' : ' · account-level'}</small></div><span class="status">{promise.status}</span>{#if promise.status === 'open' && data.canManagePromises && data.case}<form method="POST" action="?/resolvePromise" class="resolution"><input type="hidden" name="casePublicId" value={data.case.publicId}/><input type="hidden" name="promisePublicId" value={promise.publicId}/><select name="status"><option value="kept">Kept</option><option value="broken">Broken</option><option value="cancelled">Cancelled</option></select><input name="note" placeholder="Resolution evidence" required/><button type="submit">Resolve</button></form>{:else if promise.resolutionNote}<small>{promise.resolutionNote}</small>{/if}</article>{/each}</div>{/if}
	</section>

	<section class="panel">
		<div class="section-heading"><div><p class="eyebrow">Disputes</p><h2>Receivable disputes</h2></div><span>{data.disputes.length}</span></div>
		{#if data.disputes.length === 0}<p class="muted">No disputes recorded.</p>{:else}<div class="stack">{#each data.disputes as dispute}<article class="record"><div><strong>{dispute.disputedAmount && dispute.currencyCode ? money(dispute.disputedAmount, dispute.currencyCode) : 'Amount not specified'}</strong><small>{dispute.reason}</small></div><span class="status">{dispute.status}</span>{#if dispute.status === 'open' && data.canManageDisputes && data.case}<form method="POST" action="?/resolveDispute" class="resolution"><input type="hidden" name="casePublicId" value={data.case.publicId}/><input type="hidden" name="disputePublicId" value={dispute.publicId}/><select name="status"><option value="resolved">Resolved</option><option value="withdrawn">Withdrawn</option></select><input name="note" placeholder="Resolution evidence" required/><button type="submit">Resolve</button></form>{:else if dispute.resolutionNote}<small>{dispute.resolutionNote}</small>{/if}</article>{/each}</div>{/if}
	</section>
</div>

<section class="panel">
	<div class="section-heading"><div><p class="eyebrow">Audit trail</p><h2>Collection actions</h2></div><span>{data.actions.length}</span></div>
	{#if data.actions.length === 0}<p class="muted">No collection actions recorded.</p>{:else}<div class="timeline">{#each data.actions as action}<article><div class="timeline-head"><strong>{label(action.actionType)}</strong><time>{date(action.occurredAt)}</time></div>{#if action.subject}<p>{action.subject}</p>{/if}{#if action.messageBody}<p class="muted">{action.messageBody}</p>{/if}{#if action.outcome}<small>Outcome: {action.outcome}</small>{/if}</article>{/each}</div>{/if}
</section>

<style>
	.breadcrumbs{display:flex;gap:.45rem;margin-bottom:1rem;font-size:.85rem}.page-heading,.section-heading,.case-panel{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1.2rem}.page-heading h1,.panel h2{margin:.15rem 0}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--muted,#667085);margin:0}.panel{border:1px solid var(--border,#d0d5dd);border-radius:14px;background:var(--surface,#fff);padding:1rem;margin-bottom:1rem}.grid-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.case-actions{display:flex;gap:.55rem;flex-wrap:wrap}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin-top:.8rem}.form-grid label{display:grid;gap:.3rem;font-size:.84rem;font-weight:650}.form-grid input,.form-grid select,.form-grid textarea,.resolution input,.resolution select{font:inherit;padding:.6rem;border:1px solid var(--border,#d0d5dd);border-radius:8px;background:white}.wide{grid-column:1/-1}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;margin-top:.8rem}th,td{text-align:left;padding:.7rem;border-bottom:1px solid var(--border,#e4e7ec)}th{font-size:.75rem;text-transform:uppercase;color:var(--muted,#667085)}.stack,.timeline{display:grid;gap:.7rem;margin-top:.8rem}.record,.timeline article{border:1px solid var(--border,#e4e7ec);border-radius:10px;padding:.75rem}.record{display:grid;gap:.55rem}.resolution{display:grid;grid-template-columns:auto 1fr auto;gap:.5rem}.timeline-head{display:flex;justify-content:space-between;gap:1rem}.timeline p{margin:.35rem 0}.status{justify-self:start;text-transform:uppercase;font-size:.72rem;border:1px solid var(--border,#d0d5dd);border-radius:999px;padding:.25rem .5rem}.muted,small,time{color:var(--muted,#667085)}small{display:block}button,.button{font:inherit;font-weight:700;padding:.62rem .82rem;border-radius:9px;border:0;background:#1d2939;color:white;text-decoration:none;cursor:pointer}.secondary{background:transparent;color:inherit;border:1px solid var(--border,#d0d5dd)}.danger{background:#b42318}.banner{padding:.75rem 1rem;border-radius:9px}.error{color:#b42318;background:#fef3f2}@media(max-width:760px){.page-heading,.case-panel{display:grid}.grid-two,.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.resolution{grid-template-columns:1fr}}
</style>
