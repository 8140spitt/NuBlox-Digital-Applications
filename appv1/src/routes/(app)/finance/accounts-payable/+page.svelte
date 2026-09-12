<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function date(value: Date | string | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
	}

	const draftCount = $derived(
		data.documents.filter((document) => document.matchState === 'draft').length
	);
	const exceptionCount = $derived(
		data.documents.filter((document) => document.matchState === 'exception').length
	);
	const approvalCount = $derived(
		data.documents.filter((document) => document.matchState === 'awaiting_approval').length
	);
	const approvedCount = $derived(
		data.documents.filter((document) => document.matchState === 'approved').length
	);
</script>

<svelte:head><title>Accounts Payable · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Finance · Procure to pay</p>
		<h1>Accounts Payable</h1>
		<p>
			Capture supplier invoices against the CRM supplier, purchase-order and receipt facts. NuBlox
			keeps the match, exception and approval evidence together before accounting posting or
			payment.
		</p>
	</div>
	<div class="heading-actions">
		<a class="button secondary" href="/finance/supplier-payments">Supplier payments</a>
		<a class="button secondary" href="/purchasing">Procurement</a>
		<a class="button secondary" href="/finance">Finance</a>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="metrics" aria-label="Accounts payable queues">
	<div><span>Draft inbox</span><strong>{draftCount}</strong></div>
	<div><span>Exceptions</span><strong>{exceptionCount}</strong></div>
	<div><span>Awaiting approval</span><strong>{approvalCount}</strong></div>
	<div><span>Approved</span><strong>{approvedCount}</strong></div>
</section>

<section class="panel" id="capture">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Supplier document</p>
			<h2>Capture invoice or credit note</h2>
			<p class="muted">
				PO-backed lines are matched to issued order and accepted receipt quantities. Leave the PO
				line blank only for a deliberate non-PO invoice; NuBlox will raise a controlled exception.
			</p>
		</div>
	</div>
	{#if data.canCreate}
		<form method="POST" action="?/create" class="capture-form">
			<label
				>Document type
				<select name="documentType" required>
					<option value="invoice">Supplier invoice</option>
					<option value="credit_note">Supplier credit note</option>
				</select>
			</label>
			<label
				>Supplier
				<select name="supplierPublicId" required>
					<option value="">Choose CRM supplier</option>
					{#each data.suppliers as supplier}
						<option value={supplier.publicId}>{supplier.displayName}</option>
					{/each}
				</select>
			</label>
			<label
				>Supplier document number
				<input name="supplierDocumentNumber" maxlength="160" required />
			</label>
			<label
				>Purchase order / line
				<select name="purchaseOrderLine">
					<option value="">Non-PO invoice</option>
					{#each data.purchaseOrders as order}
						{#each order.items as item}
							<option value={`${order.publicId}|${item.lineNumber}`}>
								{order.purchaseOrderNumber} · line {item.lineNumber} · {order.supplierName} · {item.description}
							</option>
						{/each}
					{/each}
				</select>
			</label>
			<label>Invoice date<input type="date" name="invoiceDate" value={data.today} required /></label
			>
			<label>Tax date<input type="date" name="taxDate" /></label>
			<label>Due date<input type="date" name="dueDate" /></label>
			<label>Currency<input name="currencyCode" maxlength="3" placeholder="GBP" required /></label>
			<label class="wide">Description<input name="description" maxlength="10000" required /></label>
			<label>Quantity<input name="quantity" inputmode="decimal" value="1" required /></label>
			<label
				>Unit rate<input name="unitRate" inputmode="decimal" placeholder="0.00" required /></label
			>
			<label class="wide"
				>Input tax category
				<select name="taxCategoryPublicId">
					<option value="">No tax / select later</option>
					{#each data.taxCategories as category}
						<option value={category.publicId}>
							{category.code} · {category.name}{category.ratePercent
								? ` · ${category.ratePercent}%`
								: ''}
						</option>
					{/each}
				</select>
			</label>
			<div class="wide"><button type="submit">Capture draft</button></div>
		</form>
	{:else}
		<p class="muted">Supplier-invoice capture authority is required.</p>
	{/if}
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Operational control</p>
			<h2>Supplier documents</h2>
		</div>
		<span>{data.documents.length}</span>
	</div>
	{#if data.documents.length === 0}
		<p class="muted">No supplier documents have been captured.</p>
	{:else}
		<div class="document-list">
			{#each data.documents as document}
				<article class="document-card" id={`ap-${document.publicId}`}>
					<header>
						<div>
							<strong>{document.supplierName}</strong>
							<span>{document.supplierDocumentNumber} · {date(document.invoiceDate)}</span>
							<small>
								{document.purchaseOrderNumber
									? `PO ${document.purchaseOrderNumber}`
									: 'Non-PO'}{document.projectNumber ? ` · Project ${document.projectNumber}` : ''}
							</small>
						</div>
						<div class="amount">
							<strong>{money(document.grossAmount, document.currencyCode)}</strong>
							<small
								>{money(document.netAmount, document.currencyCode)} net · {money(
									document.taxAmount,
									document.currencyCode
								)} tax</small
							>
						</div>
						<span class={`status status-${document.matchState}`}
							>{document.matchState.replace('_', ' ')}</span
						>
					</header>

					<div class="line-list">
						{#each document.items as item}
							<div>
								<span>Line {item.lineNumber} · {item.description}</span>
								<small
									>{item.quantity} × {money(item.unitRate, document.currencyCode)} = {money(
										item.netAmount,
										document.currencyCode
									)}</small
								>
							</div>
						{/each}
					</div>

					{#if document.exceptions.length > 0}
						<div class="exceptions">
							{#each document.exceptions as exception}
								<div class:resolved={exception.status !== 'open'} class="exception-row">
									<div>
										<strong>{exception.code.replaceAll('_', ' ')}</strong>
										<span>{exception.message}</span>
										<small
											>{exception.status}{exception.resolutionNote
												? ` · ${exception.resolutionNote}`
												: ''}</small
										>
									</div>
									{#if exception.status === 'open' && data.canResolveExceptions}
										<form method="POST" action="?/resolve" class="exception-form">
											<input type="hidden" name="exceptionPublicId" value={exception.publicId} />
											<input
												name="note"
												maxlength="1000"
												placeholder="Decision evidence"
												required
											/>
											<button type="submit" name="waive" value="false" class="secondary"
												>Resolve</button
											>
											<button type="submit" name="waive" value="true">Waive with authority</button>
										</form>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					<div class="document-actions">
						{#if document.status === 'draft' && data.canSubmit}
							<form method="POST" action="?/submit">
								<input type="hidden" name="documentPublicId" value={document.publicId} />
								<button type="submit">Submit & match</button>
							</form>
						{/if}
						{#if (document.status === 'submitted' || document.status === 'exception') && data.canMatch}
							<form method="POST" action="?/match">
								<input type="hidden" name="documentPublicId" value={document.publicId} />
								<button type="submit" class="secondary">Re-evaluate match</button>
							</form>
						{/if}
						{#if document.status === 'submitted' && data.canApprove && document.createdByMemberId !== data.currentMemberId}
							<form method="POST" action="?/approve" class="approval-form">
								<input type="hidden" name="documentPublicId" value={document.publicId} />
								<input name="note" maxlength="1000" placeholder="Approval note (optional)" />
								<button type="submit">Approve</button>
							</form>
						{:else if document.status === 'submitted' && document.createdByMemberId === data.currentMemberId}
							<span class="maker-checker">A different authorised member must approve.</span>
						{/if}
						{#if ['draft', 'submitted', 'exception'].includes(document.status) && data.canVoid}
							<form method="POST" action="?/void">
								<input type="hidden" name="documentPublicId" value={document.publicId} />
								<button type="submit" class="danger">Void</button>
							</form>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page-heading,
	.section-heading,
	.document-card header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}
	.page-heading {
		margin-bottom: 1.2rem;
	}
	.page-heading h1,
	.panel h2 {
		margin: 0.15rem 0;
	}
	.page-heading > div:first-child {
		max-width: 58rem;
	}
	.page-heading p:last-child,
	.muted {
		color: var(--muted, #667085);
		line-height: 1.5;
	}
	.heading-actions,
	.document-actions {
		display: flex;
		gap: 0.55rem;
		flex-wrap: wrap;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--muted, #667085);
		margin: 0;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.7rem;
		margin-bottom: 1rem;
	}
	.metrics div,
	.panel,
	.document-card {
		border: 1px solid var(--border, #d0d5dd);
		border-radius: 14px;
		background: var(--surface, #fff);
	}
	.metrics div {
		display: grid;
		gap: 0.35rem;
		padding: 0.85rem;
	}
	.metrics span,
	.document-card span,
	.document-card small {
		color: var(--muted, #667085);
	}
	.metrics strong {
		font-size: 1.45rem;
	}
	.panel {
		padding: 1rem;
		margin-bottom: 1rem;
	}
	.capture-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 0.9rem;
	}
	.capture-form label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.84rem;
		font-weight: 650;
	}
	.capture-form input,
	.capture-form select,
	.exception-form input,
	.approval-form input {
		font: inherit;
		padding: 0.65rem;
		border: 1px solid var(--border, #d0d5dd);
		border-radius: 8px;
		background: white;
		min-width: 0;
	}
	.wide {
		grid-column: 1/-1;
	}
	.document-list {
		display: grid;
		gap: 0.85rem;
		margin-top: 0.9rem;
	}
	.document-card {
		padding: 0.9rem;
		scroll-margin-top: 5rem;
	}
	.document-card header > div:first-child,
	.line-list div,
	.exception-row > div {
		display: grid;
		gap: 0.2rem;
	}
	.amount {
		text-align: right;
	}
	.amount small,
	.document-card header small,
	.line-list small,
	.exception-row small {
		display: block;
		margin-top: 0.15rem;
	}
	.status {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-radius: 999px;
		padding: 0.3rem 0.55rem;
		white-space: nowrap;
		background: #f2f4f7;
	}
	.status-exception {
		background: #fffaeb;
		color: #b54708;
	}
	.status-approved {
		background: #ecfdf3;
		color: #027a48;
	}
	.line-list,
	.exceptions {
		display: grid;
		gap: 0.55rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border, #e4e7ec);
	}
	.exception-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.8fr);
		gap: 0.75rem;
		padding: 0.7rem;
		border-radius: 10px;
		background: #fffaeb;
	}
	.exception-row.resolved {
		background: #f8fafc;
		opacity: 0.75;
	}
	.exception-form,
	.approval-form {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.exception-form input,
	.approval-form input {
		flex: 1;
	}
	.document-actions {
		align-items: center;
		margin-top: 0.8rem;
	}
	.maker-checker {
		font-size: 0.8rem;
	}
	button,
	.button {
		font: inherit;
		font-weight: 700;
		padding: 0.65rem 0.85rem;
		border-radius: 9px;
		border: 0;
		background: #1d2939;
		color: white;
		text-decoration: none;
		cursor: pointer;
	}
	.secondary {
		background: transparent;
		color: inherit;
		border: 1px solid var(--border, #d0d5dd);
	}
	.danger {
		background: transparent;
		color: #b42318;
		border: 1px solid #fecdca;
	}
	.banner {
		padding: 0.75rem 1rem;
		border-radius: 9px;
	}
	.error {
		color: #b42318;
		background: #fef3f2;
	}
	@media (max-width: 800px) {
		.metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.page-heading,
		.document-card header,
		.exception-row {
			display: grid;
			grid-template-columns: 1fr;
		}
		.amount {
			text-align: left;
		}
	}
	@media (max-width: 600px) {
		.capture-form,
		.metrics {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
		.exception-form,
		.approval-form {
			display: grid;
			grid-template-columns: 1fr;
		}
	}
</style>
