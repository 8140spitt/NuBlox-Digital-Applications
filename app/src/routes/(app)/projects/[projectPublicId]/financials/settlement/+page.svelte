<script lang="ts">
	let { data } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function date(value: Date | string | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
	}

	function statusLabel(status: string) {
		return (
			{
				liability_unposted: 'Liability not posted',
				unpaid: 'Unpaid',
				partially_paid: 'Partially paid',
				payment_unposted: 'Payment not posted',
				paid_unreconciled: 'Paid · bank unreconciled',
				settled: 'Bank settled'
			}[status] ?? status
		);
	}
</script>

<svelte:head><title>Procurement Settlement · {data.project.name} · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Project financials · digital thread</p>
		<h1>Procurement settlement</h1>
		<p>
			Trace approved supplier invoices from the project into payment execution, accounting and bank
			settlement evidence. Project actual cost remains receipt-based; this workspace shows the
			separate gross cash and liability thread without creating another project ledger.
		</p>
	</div>
	<div class="heading-actions">
		<a class="button secondary" href="/finance/supplier-payments">Supplier payments</a>
		<a class="button secondary" href="/finance/bank-reconciliation">Bank reconciliation</a>
		<a class="button secondary" href="/finance/accounting">Accounting</a>
	</div>
</section>

{#if data.currencyMismatch}
	<p class="warning" role="status">
		This project contains supplier invoices in multiple currencies. NuBlox does not silently convert
		currencies, so project-level cash totals are intentionally not aggregated. Review each invoice
		in its transaction currency.
	</p>
{:else if data.currencyCodes.length === 1}
	{@const currency = data.currencyCodes[0]}
	<section class="metrics" aria-label="Project procurement settlement position">
		<div>
			<span>Approved supplier invoices</span>
			<strong>{money(data.totals.approvedInvoiceAmount, currency)}</strong>
		</div>
		<div>
			<span>Executed supplier payments</span>
			<strong>{money(data.totals.executedPaymentAmount, currency)}</strong>
		</div>
		<div>
			<span>Bank settled</span>
			<strong>{money(data.totals.bankSettledAmount, currency)}</strong>
		</div>
		<div>
			<span>Outstanding payable</span>
			<strong>{money(data.totals.outstandingPayableAmount, currency)}</strong>
		</div>
		<div>
			<span>Paid but unreconciled</span>
			<strong>{money(data.totals.unreconciledPaymentAmount, currency)}</strong>
		</div>
	</section>
{/if}

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Supplier liability → cash</p>
			<h2>Approved project supplier invoices</h2>
		</div>
		<span>{data.documents.length}</span>
	</div>

	{#if data.documents.length === 0}
		<p class="muted">
			No approved supplier invoices are currently linked to this project. Once Accounts Payable
			approves a project supplier invoice, its accounting, payment and bank-settlement thread will
			appear here.
		</p>
	{:else}
		<div class="document-list">
			{#each data.documents as document}
				<article class="document-card">
					<header>
						<div>
							<p class="eyebrow">{document.supplierName}</p>
							<h3>{document.supplierDocumentNumber}</h3>
							<p class="muted">
								Invoice {date(document.invoiceDate)} · due {date(document.dueDate)}
								{#if document.purchaseOrderPublicId}
									· PO linked{/if}
							</p>
						</div>
						<div class="right">
							<strong>{money(document.grossAmount, document.currencyCode)}</strong>
							<span class={`status ${document.status}`}>{statusLabel(document.status)}</span>
						</div>
					</header>

					<div
						class="thread"
						aria-label={`Settlement thread for ${document.supplierDocumentNumber}`}
					>
						<div>
							<span>AP liability</span>
							<strong>{document.liabilityPosted ? 'Posted' : 'Not posted'}</strong>
						</div>
						<div>
							<span>Executed payment</span>
							<strong>{money(document.executedPaymentAmount, document.currencyCode)}</strong>
						</div>
						<div>
							<span>Payment journalled</span>
							<strong>{money(document.accountedPaymentAmount, document.currencyCode)}</strong>
						</div>
						<div>
							<span>Bank settled</span>
							<strong>{money(document.bankSettledAmount, document.currencyCode)}</strong>
						</div>
						<div>
							<span>Outstanding payable</span>
							<strong>{money(document.outstandingPayableAmount, document.currencyCode)}</strong>
						</div>
					</div>

					{#if document.payments.length > 0}
						<div class="payments">
							<h4>Payment evidence</h4>
							{#each document.payments as payment}
								<div class="payment-row">
									<div>
										<strong>{payment.paymentReference ?? payment.publicId}</strong>
										<span>
											{money(payment.allocatedAmount, document.currencyCode)} · executed
											{date(payment.executedAt)}
										</span>
									</div>
									<div class="right evidence">
										<span>{payment.accountingPosted ? 'GL posted' : 'GL posting required'}</span>
										<span>{payment.bankSettled ? 'Bank settled' : 'Bank match required'}</span>
										{#if payment.bankSettled}
											<small>
												{payment.bankAccountName} · {payment.bankStatementReference} ·
												{payment.bankReference} · {date(payment.bankBookedOn)}
											</small>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page-heading,
	.section-heading,
	.document-card header,
	.payment-row,
	.heading-actions {
		display: flex;
		gap: 1rem;
		justify-content: space-between;
		align-items: flex-start;
	}

	.page-heading,
	.panel,
	.metrics,
	.warning {
		margin-bottom: 1rem;
	}

	.page-heading h1,
	.panel h2,
	.document-card h3,
	.payments h4 {
		margin: 0.15rem 0 0.5rem;
	}

	.page-heading p,
	.muted,
	.payment-row span,
	.evidence small {
		color: var(--color-text-muted, #64748b);
	}

	.page-heading p,
	.muted {
		max-width: 82ch;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.heading-actions {
		flex-wrap: wrap;
	}

	.button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid currentColor;
		border-radius: 0.55rem;
		padding: 0.55rem 0.8rem;
		font-weight: 650;
		text-decoration: none;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	.metrics > div,
	.panel,
	.document-card {
		border: 1px solid var(--color-border, #dbe2ea);
		border-radius: 0.75rem;
		background: var(--color-surface, #fff);
	}

	.metrics > div {
		padding: 0.9rem;
	}

	.metrics span,
	.metrics strong {
		display: block;
	}

	.metrics span {
		margin-bottom: 0.3rem;
		font-size: 0.8rem;
		color: var(--color-text-muted, #64748b);
	}

	.metrics strong {
		font-size: 1.15rem;
	}

	.panel {
		padding: 1rem;
	}

	.document-list {
		display: grid;
		gap: 0.85rem;
	}

	.document-card {
		padding: 1rem;
	}

	.right {
		text-align: right;
	}

	.status {
		display: inline-flex;
		margin-top: 0.35rem;
		border-radius: 999px;
		padding: 0.25rem 0.55rem;
		background: var(--color-surface-subtle, #f1f5f9);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.status.settled {
		background: #dcfce7;
	}

	.status.paid_unreconciled,
	.status.payment_unposted,
	.status.liability_unposted {
		background: #fef3c7;
	}

	.thread {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.65rem;
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--color-border, #e2e8f0);
	}

	.thread span,
	.thread strong {
		display: block;
	}

	.thread span {
		font-size: 0.75rem;
		color: var(--color-text-muted, #64748b);
	}

	.payments {
		margin-top: 1rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--color-border, #e2e8f0);
	}

	.payment-row {
		padding: 0.6rem 0;
	}

	.payment-row + .payment-row {
		border-top: 1px solid var(--color-border, #e2e8f0);
	}

	.payment-row span,
	.evidence small {
		display: block;
		margin-top: 0.2rem;
	}

	.warning {
		border: 1px solid #f59e0b;
		border-radius: 0.65rem;
		padding: 0.8rem 0.9rem;
		background: #fffbeb;
	}

	@media (max-width: 720px) {
		.page-heading,
		.document-card header,
		.payment-row {
			flex-direction: column;
		}

		.right {
			text-align: left;
		}
	}
</style>
