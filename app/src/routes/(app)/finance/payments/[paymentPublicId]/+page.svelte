<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function date(value: Date | string | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
	}
</script>

<svelte:head><title>Payment · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Accounts receivable</p>
		<h1>{money(data.payment.amount, data.payment.currencyCode)}</h1>
		<p>
			{data.payment.payerDisplayName ?? 'Unspecified payer'} · {date(data.payment.receivedAt)} · {data
				.payment.paymentMethodName}
		</p>
	</div>
	<div class="heading-actions">
		<a class="button secondary" href="/finance/payments">Payments</a>
		<a class="button secondary" href="/finance/invoices">Invoices</a>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="metrics">
	<article>
		<span>Receipt</span><strong>{money(data.payment.amount, data.payment.currencyCode)}</strong>
	</article>
	<article>
		<span>Active allocation</span><strong
			>{money(data.payment.allocatedAmount, data.payment.currencyCode)}</strong
		>
	</article>
	<article>
		<span>Usable balance</span><strong
			>{money(data.payment.unallocatedAmount, data.payment.currencyCode)}</strong
		>
	</article>
	<article>
		<span>Status</span><strong>{data.payment.isReversed ? 'Reversed' : 'Active'}</strong>
	</article>
</section>

<section class="panel details">
	<div><span>Reference</span><strong>{data.payment.paymentReference ?? '—'}</strong></div>
	<div><span>Currency</span><strong>{data.payment.currencyCode}</strong></div>
	<div><span>Payer</span><strong>{data.payment.payerDisplayName ?? 'Unspecified'}</strong></div>
	<div><span>Method</span><strong>{data.payment.paymentMethodName}</strong></div>
</section>

{#if data.payment.isReversed}
	<section class="panel reversal-panel">
		<p class="eyebrow">Correction evidence</p>
		<h2>Payment reversed</h2>
		<p><strong>{date(data.payment.reversedAt)}</strong></p>
		<p>{data.payment.reversalReason}</p>
	</section>
{/if}

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Cash application</p>
			<h2>Allocations</h2>
			<p class="muted">
				Allocation records are immutable. Corrections create reversal evidence and restore the
				corresponding payment and invoice balances.
			</p>
		</div>
		<span>{data.allocations.length}</span>
	</div>
	{#if data.allocations.length === 0}
		<p class="muted">This payment has not been allocated.</p>
	{:else}
		<div class="allocation-list">
			{#each data.allocations as allocation}
				<article class="allocation-row">
					<div>
						<strong>{allocation.invoiceNumber}</strong><small
							>{allocation.customerDisplayName} · allocated {date(allocation.allocatedAt)}</small
						>
					</div>
					<div class="amount">
						<strong>{money(allocation.allocatedAmount, data.payment.currencyCode)}</strong><small
							>{allocation.isReversed
								? `Reversed ${date(allocation.reversedAt)}`
								: 'Active allocation'}</small
						>
					</div>
					{#if allocation.isReversed}
						<div class="reason">
							<span>Reversal reason</span>
							<p>{allocation.reversalReason}</p>
						</div>
					{:else if data.canReverseAllocation}
						<form method="POST" action="?/reverseAllocation" class="inline-form danger-form">
							<input type="hidden" name="allocationId" value={allocation.id} />
							<label
								>Reversal reason<input
									name="reason"
									required
									placeholder="Why is this allocation incorrect?"
								/></label
							>
							<button class="danger" type="submit">Reverse allocation</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

{#if data.canAllocate}
	<section class="panel">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Apply cash</p>
				<h2>Allocate payment</h2>
				<p class="muted">
					Only same-currency issued invoices with a positive outstanding balance are eligible.
				</p>
			</div>
		</div>
		{#if data.invoiceCandidates.length === 0}
			<p class="muted">No same-currency issued invoices have an outstanding balance.</p>
		{:else}
			<form method="POST" action="?/allocate" class="allocation-form">
				<label
					>Invoice
					<select name="invoicePublicId" required>
						<option value="">Choose invoice</option>
						{#each data.invoiceCandidates as invoice}
							<option value={invoice.invoicePublicId}
								>{invoice.invoiceNumber} · {invoice.customerDisplayName} · {money(
									invoice.outstandingAmount,
									invoice.currencyCode
								)} outstanding{invoice.payerMatches === false ? ' · payer differs' : ''}</option
							>
						{/each}
					</select>
				</label>
				<label>Amount<input name="amount" inputmode="decimal" required placeholder="0.00" /></label>
				<button type="submit">Allocate payment</button>
			</form>
			<div class="candidate-list">
				{#each data.invoiceCandidates as invoice}
					<article>
						<div>
							<strong>{invoice.invoiceNumber}</strong><small
								>{invoice.customerDisplayName}{invoice.payerMatches === false
									? ' · payer differs from receipt'
									: ''}</small
							>
						</div>
						<div class="amount">
							<strong>{money(invoice.outstandingAmount, invoice.currencyCode)} outstanding</strong
							><small
								>{money(invoice.invoiceGross, invoice.currencyCode)} invoice · {money(
									invoice.issuedCreditGross,
									invoice.currencyCode
								)} credits · {money(invoice.activeAllocatedAmount, invoice.currencyCode)} active cash</small
							>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
{/if}

{#if data.canReversePayment}
	<section class="panel danger-panel">
		<p class="eyebrow">Receipt correction</p>
		<h2>Reverse payment</h2>
		<p class="muted">
			This creates immutable payment-reversal evidence and automatically reverses every active
			allocation first. The original receipt remains preserved.
		</p>
		<form method="POST" action="?/reversePayment" class="inline-form danger-form">
			<label
				>Reversal reason<input
					name="reason"
					required
					placeholder="Duplicate receipt, returned funds, bank correction…"
				/></label
			>
			<button class="danger" type="submit">Reverse payment</button>
		</form>
	</section>
{/if}

<style>
	.page-heading,
	.section-heading {
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
	.heading-actions {
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
	.metrics article,
	.panel {
		border: 1px solid var(--border, #d0d5dd);
		border-radius: 14px;
		background: var(--surface, #fff);
		padding: 1rem;
	}
	.metrics span,
	.details span,
	.reason span {
		display: block;
		color: var(--muted, #667085);
		font-size: 0.78rem;
	}
	.metrics strong {
		display: block;
		margin-top: 0.35rem;
		font-size: 1.15rem;
	}
	.panel {
		margin-bottom: 1rem;
	}
	.details {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
	}
	.details strong {
		display: block;
		margin-top: 0.25rem;
	}
	.allocation-list,
	.candidate-list {
		display: grid;
		gap: 0.7rem;
		margin-top: 0.9rem;
	}
	.allocation-row,
	.candidate-list article {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 0.85fr);
		gap: 0.8rem;
		align-items: start;
		padding: 0.85rem;
		border: 1px solid var(--border, #e4e7ec);
		border-radius: 11px;
	}
	.allocation-row small,
	.candidate-list small {
		display: block;
		color: var(--muted, #667085);
		margin-top: 0.2rem;
	}
	.amount {
		text-align: right;
	}
	.reason,
	.inline-form {
		grid-column: 1/-1;
	}
	.reason p {
		margin: 0.2rem 0 0;
	}
	.allocation-form {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 12rem auto;
		gap: 0.7rem;
		align-items: end;
		margin-top: 0.9rem;
	}
	.allocation-form label,
	.inline-form label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.84rem;
		font-weight: 650;
	}
	.allocation-form input,
	.allocation-form select,
	.inline-form input {
		font: inherit;
		padding: 0.65rem;
		border: 1px solid var(--border, #d0d5dd);
		border-radius: 8px;
		background: white;
	}
	.inline-form {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.7rem;
		align-items: end;
		margin-top: 0.7rem;
	}
	.danger-form {
		padding: 0.7rem;
		border: 1px solid #fecdca;
		border-radius: 9px;
		background: #fef3f2;
	}
	.danger-panel,
	.reversal-panel {
		border-color: #fecdca;
	}
	.muted {
		color: var(--muted, #667085);
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
		background: #b42318;
	}
	.banner {
		padding: 0.75rem 1rem;
		border-radius: 9px;
	}
	.error {
		color: #b42318;
		background: #fef3f2;
	}
	@media (max-width: 850px) {
		.metrics,
		.details {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.allocation-form {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 650px) {
		.page-heading {
			display: grid;
		}
		.metrics,
		.details {
			grid-template-columns: 1fr;
		}
		.allocation-row,
		.candidate-list article {
			grid-template-columns: 1fr;
		}
		.amount {
			text-align: left;
		}
		.inline-form {
			grid-template-columns: 1fr;
		}
	}
</style>
