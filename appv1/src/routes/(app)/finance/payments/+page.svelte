<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function date(value: Date | string) {
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
	}
</script>

<svelte:head><title>Payments · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Accounts receivable</p>
		<h1>Payments</h1>
		<p>
			Record immutable receipt facts, then allocate them to issued invoices through controlled cash
			application.
		</p>
	</div>
	<div class="heading-actions">
		<a class="button secondary" href="/finance/invoices">Invoices</a>
		<a class="button secondary" href="/finance/credit-notes">Credit notes</a>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Receipt fact</p>
			<h2>Record payment</h2>
			<p class="muted">
				Recording a payment does not allocate it automatically. Payer is optional so unidentified
				receipts can be captured without inventing CRM identity.
			</p>
		</div>
	</div>
	{#if data.canCreate}
		<form method="POST" action="?/create" class="payment-form">
			<label>Received date<input type="date" name="receivedOn" value={data.today} required /></label
			>
			<label
				>Payment method
				<select name="paymentMethodCode" required>
					<option value="">Choose method</option>
					{#each data.paymentMethods as method}<option value={method.code}>{method.name}</option
						>{/each}
				</select>
			</label>
			<label>Amount<input name="amount" inputmode="decimal" placeholder="0.00" required /></label>
			<label
				>Currency<input
					name="currencyCode"
					value={data.defaultCurrencyCode}
					maxlength="3"
					required
				/></label
			>
			<label class="wide"
				>Payment reference<input
					name="paymentReference"
					maxlength="255"
					placeholder="Bank reference, remittance reference, cheque number…"
				/></label
			>
			{#if data.canSelectPayer}
				<label class="wide"
					>Payer
					<select name="payerPartyPublicId">
						<option value="">Unspecified payer</option>
						{#each data.payerCandidates as payer}<option value={payer.publicId}
								>{payer.displayName}</option
							>{/each}
					</select>
				</label>
			{/if}
			<div class="wide"><button type="submit">Record payment</button></div>
		</form>
	{:else}
		<p class="muted">Payment recording authority is required.</p>
	{/if}
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Receipt history</p>
			<h2>Recorded payments</h2>
		</div>
		<span>{data.payments.length}</span>
	</div>
	{#if data.payments.length === 0}
		<p class="muted">No payments have been recorded.</p>
	{:else}
		<div class="payment-list">
			{#each data.payments as payment}
				<a class="payment-row" href={`/finance/payments/${payment.publicId}`}>
					<div>
						<strong>{payment.payerDisplayName ?? 'Unspecified payer'}</strong><small
							>{date(payment.receivedAt)} · {payment.paymentMethodName}{payment.paymentReference
								? ` · ${payment.paymentReference}`
								: ''}</small
						>
					</div>
					<div class="amount">
						<strong>{money(payment.amount, payment.currencyCode)}</strong><small
							>{money(payment.allocatedAmount, payment.currencyCode)} allocated · {money(
								payment.unallocatedAmount,
								payment.currencyCode
							)} usable</small
						>
					</div>
					<span class={`status ${payment.isReversed ? 'status-reversed' : 'status-active'}`}
						>{payment.isReversed ? 'reversed' : 'active'}</span
					>
				</a>
			{/each}
		</div>
	{/if}
</section>

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
	.panel {
		border: 1px solid var(--border, #d0d5dd);
		border-radius: 14px;
		background: var(--surface, #fff);
		padding: 1rem;
		margin-bottom: 1rem;
	}
	.payment-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 0.9rem;
	}
	.payment-form label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.84rem;
		font-weight: 650;
	}
	.payment-form input,
	.payment-form select {
		font: inherit;
		padding: 0.65rem;
		border: 1px solid var(--border, #d0d5dd);
		border-radius: 8px;
		background: white;
	}
	.wide {
		grid-column: 1/-1;
	}
	.payment-list {
		display: grid;
		gap: 0.7rem;
		margin-top: 0.9rem;
	}
	.payment-row {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr) auto;
		gap: 1rem;
		align-items: center;
		padding: 0.85rem;
		border: 1px solid var(--border, #e4e7ec);
		border-radius: 11px;
		color: inherit;
		text-decoration: none;
	}
	.payment-row:hover {
		background: var(--surface-subtle, #f8fafc);
	}
	.payment-row small {
		display: block;
		color: var(--muted, #667085);
		margin-top: 0.2rem;
	}
	.amount {
		text-align: right;
	}
	.status {
		font-size: 0.76rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border: 1px solid var(--border, #d0d5dd);
		border-radius: 999px;
		padding: 0.3rem 0.55rem;
	}
	.status-active {
		background: #ecfdf3;
		color: #027a48;
		border-color: #abefc6;
	}
	.status-reversed {
		background: #fef3f2;
		color: #b42318;
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
	.banner {
		padding: 0.75rem 1rem;
		border-radius: 9px;
	}
	.error {
		color: #b42318;
		background: #fef3f2;
	}
	@media (max-width: 650px) {
		.page-heading {
			display: grid;
		}
		.payment-form {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
		.payment-row {
			grid-template-columns: 1fr;
		}
		.amount {
			text-align: left;
		}
	}
</style>
