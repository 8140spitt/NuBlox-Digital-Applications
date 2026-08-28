<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function date(value: Date | string | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
	}

	const pendingCount = $derived(
		data.payments.filter((payment) => payment.status === 'pending_approval').length
	);
	const approvedCount = $derived(data.payments.filter((payment) => payment.status === 'approved').length);
	const executedCount = $derived(data.payments.filter((payment) => payment.status === 'executed').length);
	const reversedCount = $derived(data.payments.filter((payment) => payment.reversalPublicId).length);
</script>

<svelte:head><title>Supplier Payments · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Finance · Procure to pay</p>
		<h1>Supplier Payments</h1>
		<p>
			Settle posted Accounts Payable liabilities through a governed maker-checker payment process.
			NuBlox reserves invoice open balance before approval, records execution evidence, and carries the
			result into accounting without duplicating supplier-invoice facts.
		</p>
	</div>
	<div class="heading-actions">
		<a class="button secondary" href="/finance/accounts-payable">Accounts Payable</a>
		<a class="button secondary" href="/finance/accounting">Accounting</a>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="metrics" aria-label="Supplier payment queues">
	<div><span>Pending approval</span><strong>{pendingCount}</strong></div>
	<div><span>Approved</span><strong>{approvedCount}</strong></div>
	<div><span>Executed</span><strong>{executedCount}</strong></div>
	<div><span>Reversed</span><strong>{reversedCount}</strong></div>
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Open AP liability</p>
			<h2>Request supplier payment</h2>
			<p class="muted">
				Only approved supplier invoices with an active AP accounting journal are eligible. A payment
				request reserves the selected open balance immediately, preventing a second request from
				overpaying the same invoice.
			</p>
		</div>
	</div>
	{#if data.canCreate && data.eligibleInvoices.length > 0 && data.paymentMethods.length > 0}
		<form method="POST" action="?/create" class="payment-form">
			<label class="wide">
				Supplier invoice
				<select name="documentPublicId" required>
					<option value="">Choose posted AP liability</option>
					{#each data.eligibleInvoices as invoice}
						<option value={invoice.publicId}>
							{invoice.supplierName} · {invoice.supplierDocumentNumber} · {money(invoice.openAmount, invoice.currencyCode)} open
						</option>
					{/each}
				</select>
			</label>
			<label>
				Payment method
				<select name="paymentMethodCode" required>
					<option value="">Choose method</option>
					{#each data.paymentMethods as method}
						<option value={method.code}>{method.name}</option>
					{/each}
				</select>
			</label>
			<label>
				Requested date
				<input type="date" name="requestedPaymentDate" value={data.today} required />
			</label>
			<label>
				Amount
				<input name="amount" inputmode="decimal" placeholder="0.00" required />
			</label>
			<label>
				Provisional reference
				<input name="paymentReference" maxlength="160" placeholder="Optional until execution" />
			</label>
			<div class="wide"><button type="submit">Create payment request</button></div>
		</form>
	{:else if !data.canCreate}
		<p class="muted">Supplier-payment creation authority is required.</p>
	{:else if data.eligibleInvoices.length === 0}
		<p class="muted">No posted supplier liabilities currently have an open payable balance.</p>
	{:else}
		<p class="muted">No active payment method is configured.</p>
	{/if}
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Controlled settlement</p>
			<h2>Payment authority and execution</h2>
		</div>
		<span>{data.payments.length}</span>
	</div>
	{#if data.payments.length === 0}
		<p class="muted">No supplier payments have been requested.</p>
	{:else}
		<div class="payment-list">
			{#each data.payments as payment}
				<article class="payment-card" id={`payment-${payment.publicId}`}>
					<header>
						<div>
							<strong>{payment.allocations[0]?.supplierName ?? 'Supplier payment'}</strong>
							<span>{payment.paymentMethodName} · requested {date(payment.requestedPaymentDate)}</span>
							<small>{payment.paymentReference ?? 'Execution reference not yet recorded'}</small>
						</div>
						<div class="amount">
							<strong>{money(payment.paymentAmount, payment.currencyCode)}</strong>
							<small>{payment.allocations.length} allocation{payment.allocations.length === 1 ? '' : 's'}</small>
						</div>
						<span class={`status status-${payment.reversalPublicId ? 'reversed' : payment.status}`}>
							{payment.reversalPublicId ? 'reversed' : payment.status.replace('_', ' ')}
						</span>
					</header>

					<div class="allocations">
						{#each payment.allocations as allocation}
							<div>
								<span>{allocation.supplierDocumentNumber}</span>
								<strong>{money(allocation.allocatedAmount, payment.currencyCode)}</strong>
							</div>
						{/each}
					</div>

					<div class="evidence">
						<span>Created by member {payment.createdByMemberId}</span>
						{#if payment.approvedAt}<span>Approved {date(payment.approvedAt)}</span>{/if}
						{#if payment.executedAt}<span>Executed {date(payment.executedAt)}</span>{/if}
						{#if payment.reversedAt}<span>Reversed {date(payment.reversedAt)}</span>{/if}
					</div>

					<div class="actions">
						{#if payment.status === 'pending_approval' && data.canApprove && payment.createdByMemberId !== data.currentMemberId}
							<form method="POST" action="?/approve">
								<input type="hidden" name="paymentPublicId" value={payment.publicId} />
								<button type="submit">Approve payment</button>
							</form>
						{/if}
						{#if payment.status === 'approved' && data.canExecute}
							<form method="POST" action="?/execute" class="inline-form">
								<input type="hidden" name="paymentPublicId" value={payment.publicId} />
								<input
									name="paymentReference"
									maxlength="160"
									value={payment.paymentReference ?? ''}
									placeholder="Bank / execution reference"
									required
								/>
								<button type="submit">Record execution</button>
							</form>
						{/if}
						{#if (payment.status === 'pending_approval' || payment.status === 'approved') && data.canCancel}
							<form method="POST" action="?/cancel" class="inline-form">
								<input type="hidden" name="paymentPublicId" value={payment.publicId} />
								<input name="reason" maxlength="1000" placeholder="Cancellation reason" required />
								<button type="submit" class="secondary">Cancel request</button>
							</form>
						{/if}
						{#if payment.status === 'executed' && !payment.reversalPublicId && data.canReverse}
							<form method="POST" action="?/reverse" class="inline-form">
								<input type="hidden" name="paymentPublicId" value={payment.publicId} />
								<input name="reason" maxlength="1000" placeholder="Reversal evidence" required />
								<button type="submit" class="secondary">Record reversal</button>
							</form>
						{/if}
					</div>

					{#if payment.reversalReason}
						<p class="reversal-note"><strong>Reversal evidence:</strong> {payment.reversalReason}</p>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page-heading,
	.section-heading,
	.payment-card header,
	.allocations > div,
	.evidence,
	.actions {
		display: flex;
		gap: 1rem;
		justify-content: space-between;
		align-items: flex-start;
	}
	.page-heading {
		margin-bottom: 1.25rem;
	}
	.page-heading h1,
	.section-heading h2 {
		margin: 0.15rem 0 0.45rem;
	}
	.page-heading p,
	.muted {
		max-width: 76ch;
		color: var(--color-text-muted, #64748b);
	}
	.eyebrow {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.heading-actions,
	.actions {
		display: flex;
		gap: 0.65rem;
		flex-wrap: wrap;
	}
	.button,
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid currentColor;
		border-radius: 0.55rem;
		padding: 0.55rem 0.8rem;
		font: inherit;
		font-weight: 650;
		text-decoration: none;
		cursor: pointer;
	}
	.secondary {
		background: transparent;
	}
	.banner {
		padding: 0.8rem 1rem;
		border: 1px solid currentColor;
		border-radius: 0.65rem;
	}
	.error {
		color: #a11313;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.metrics > div,
	.panel,
	.payment-card {
		border: 1px solid var(--color-border, #d8dee8);
		border-radius: 0.8rem;
		background: var(--color-surface, white);
	}
	.metrics > div {
		padding: 0.85rem 1rem;
	}
	.metrics span,
	.metrics strong {
		display: block;
	}
	.metrics span {
		font-size: 0.8rem;
		color: var(--color-text-muted, #64748b);
	}
	.metrics strong {
		margin-top: 0.2rem;
		font-size: 1.35rem;
	}
	.panel {
		padding: 1rem;
		margin-bottom: 1rem;
	}
	.section-heading {
		margin-bottom: 1rem;
	}
	.payment-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}
	.payment-form label,
	.inline-form {
		display: grid;
		gap: 0.35rem;
	}
	.wide {
		grid-column: 1 / -1;
	}
	input,
	select {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--color-border, #cbd5e1);
		border-radius: 0.5rem;
		padding: 0.55rem 0.65rem;
		font: inherit;
		background: inherit;
		color: inherit;
	}
	.payment-list {
		display: grid;
		gap: 0.8rem;
	}
	.payment-card {
		padding: 0.9rem;
	}
	.payment-card header > div:first-child,
	.amount {
		display: grid;
		gap: 0.15rem;
	}
	.payment-card header span,
	.payment-card header small,
	.evidence {
		color: var(--color-text-muted, #64748b);
	}
	.amount {
		text-align: right;
	}
	.status {
		border: 1px solid currentColor;
		border-radius: 999px;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: capitalize;
	}
	.allocations {
		margin: 0.8rem 0;
		border-top: 1px solid var(--color-border, #e2e8f0);
		border-bottom: 1px solid var(--color-border, #e2e8f0);
	}
	.allocations > div {
		padding: 0.5rem 0;
	}
	.evidence {
		justify-content: flex-start;
		flex-wrap: wrap;
		font-size: 0.78rem;
	}
	.actions {
		margin-top: 0.8rem;
		justify-content: flex-start;
		align-items: end;
	}
	.inline-form {
		grid-template-columns: minmax(180px, 1fr) auto;
		align-items: end;
	}
	.reversal-note {
		margin: 0.8rem 0 0;
		padding-top: 0.8rem;
		border-top: 1px solid var(--color-border, #e2e8f0);
	}
	@media (max-width: 760px) {
		.page-heading,
		.payment-card header {
			flex-direction: column;
		}
		.payment-form {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
		.amount {
			text-align: left;
		}
		.inline-form {
			grid-template-columns: 1fr;
		}
	}
</style>
