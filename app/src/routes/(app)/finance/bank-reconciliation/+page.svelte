<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function date(value: Date | string | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
	}

	const activeMatches = $derived(data.matches.filter((match) => !match.reversalPublicId));
</script>

<svelte:head><title>Bank Reconciliation · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Finance · Cash assurance</p>
		<h1>Bank Reconciliation</h1>
		<p>
			Connect executed supplier payments to provider-neutral bank statement evidence. Active matches
			confirm settlement without rewriting Accounts Payable or accounting journals, and become part
			of period-close readiness.
		</p>
	</div>
	<div class="heading-actions">
		<a class="button secondary" href="/finance/supplier-payments">Supplier payments</a>
		<a class="button secondary" href="/finance/accounting">Accounting</a>
		<a class="button secondary" href="/finance/accounting/periods">Periods</a>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="metrics" aria-label="Bank reconciliation position">
	<div><span>Bank accounts</span><strong>{data.accounts.length}</strong></div>
	<div><span>Unmatched bank lines</span><strong>{data.unmatchedLines.length}</strong></div>
	<div>
		<span>Unsettled supplier payments</span><strong>{data.unsettledSupplierPayments.length}</strong>
	</div>
	<div><span>Active settlement matches</span><strong>{activeMatches.length}</strong></div>
</section>

<section class="grid two">
	<article class="panel">
		<p class="eyebrow">Cash master</p>
		<h2>Bank accounts</h2>
		{#if data.accounts.length === 0}
			<p class="muted">No governed bank account is configured.</p>
		{:else}
			<div class="list">
				{#each data.accounts as account}
					<div class="list-row">
						<div>
							<strong>{account.accountName}</strong>
							<span>{account.institutionName} · •••• {account.accountIdentifierLast4}</span>
						</div>
						<div class="right">
							<strong>{account.currencyCode}</strong>
							<span>{account.accountingAccountCode}</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if data.canManageAccounts}
			<form method="POST" action="?/createAccount" class="form-grid">
				<label class="wide">
					Cash accounting account
					<select name="accountingAccountPublicId" required>
						<option value="">Choose cash-disbursement account</option>
						{#each data.cashAccountingAccounts as account}
							<option value={account.publicId}>{account.accountCode} · {account.name}</option>
						{/each}
					</select>
				</label>
				<label>Account name <input name="accountName" maxlength="160" required /></label>
				<label>Institution <input name="institutionName" maxlength="160" required /></label>
				<label>Last four <input name="accountIdentifierLast4" maxlength="4" required /></label>
				<label>Currency <input name="currencyCode" maxlength="3" value="GBP" required /></label>
				<div class="wide"><button type="submit">Create bank account</button></div>
			</form>
		{/if}
	</article>

	<article class="panel">
		<p class="eyebrow">Statement evidence</p>
		<h2>Record bank statement transaction</h2>
		<p class="muted">
			This provider-neutral entry path records immutable statement evidence. Statement opening plus
			credits less debits must equal closing balance before the evidence is accepted.
		</p>
		{#if data.canRecordStatements && data.accounts.length > 0}
			<form method="POST" action="?/recordStatement" class="form-grid">
				<label class="wide">
					Bank account
					<select name="bankAccountPublicId" required>
						<option value="">Choose account</option>
						{#each data.accounts.filter((account) => account.status === 'active') as account}
							<option value={account.publicId}
								>{account.accountName} · {account.currencyCode}</option
							>
						{/each}
					</select>
				</label>
				<label
					>Statement reference <input name="statementReference" maxlength="160" required /></label
				>
				<label
					>External transaction ID <input
						name="externalTransactionId"
						maxlength="160"
						required
					/></label
				>
				<label
					>Period start <input type="date" name="periodStart" value={data.today} required /></label
				>
				<label>Period end <input type="date" name="periodEnd" value={data.today} required /></label>
				<label
					>Opening balance <input
						name="openingBalance"
						inputmode="decimal"
						value="0.0000"
						required
					/></label
				>
				<label>Closing balance <input name="closingBalance" inputmode="decimal" required /></label>
				<label>Booked date <input type="date" name="bookedOn" value={data.today} required /></label>
				<label>Value date <input type="date" name="valueOn" /></label>
				<label>
					Direction
					<select name="direction" required>
						<option value="debit">Debit / money out</option>
						<option value="credit">Credit / money in</option>
					</select>
				</label>
				<label>Amount <input name="amount" inputmode="decimal" required /></label>
				<label class="wide">Description <input name="description" maxlength="500" required /></label
				>
				<label class="wide">Bank reference <input name="bankReference" maxlength="160" /></label>
				<div class="wide"><button type="submit">Record statement evidence</button></div>
			</form>
		{:else if data.accounts.length === 0}
			<p class="muted">Create a governed bank account before recording statement evidence.</p>
		{/if}
	</article>
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Settlement matching</p>
			<h2>Unreconciled cash movements</h2>
		</div>
	</div>
	<div class="grid two">
		<div>
			<h3>Bank debits</h3>
			{#if data.unmatchedLines.length === 0}
				<p class="muted">No unmatched bank statement lines.</p>
			{:else}
				<div class="list">
					{#each data.unmatchedLines as line}
						<div class="list-row compact">
							<div>
								<strong>{money(line.amount, line.currencyCode)}</strong>
								<span>{line.accountName} · {line.statementReference}</span>
								<small
									>{line.direction} · {line.bookedOn} · {line.bankReference ??
										line.externalTransactionId}</small
								>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
		<div>
			<h3>Executed supplier payments</h3>
			{#if data.unsettledSupplierPayments.length === 0}
				<p class="muted">No posted executed supplier payments require bank settlement evidence.</p>
			{:else}
				<div class="list">
					{#each data.unsettledSupplierPayments as payment}
						<div class="list-row compact">
							<div>
								<strong>{payment.supplierName}</strong>
								<span>{money(payment.paymentAmount, payment.currencyCode)}</span>
								<small
									>{payment.paymentReference ?? payment.publicId} · executed {date(
										payment.executedAt
									)}</small
								>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if data.canReconcile && data.unmatchedLines.length > 0 && data.unsettledSupplierPayments.length > 0}
		<form method="POST" action="?/reconcile" class="form-grid reconcile-form">
			<label>
				Bank statement line
				<select name="statementLinePublicId" required>
					<option value="">Choose bank debit</option>
					{#each data.unmatchedLines.filter((line) => line.direction === 'debit') as line}
						<option value={line.publicId}
							>{line.bookedOn} · {money(line.amount, line.currencyCode)} · {line.bankReference ??
								line.externalTransactionId}</option
						>
					{/each}
				</select>
			</label>
			<label>
				Supplier payment
				<select name="supplierPaymentPublicId" required>
					<option value="">Choose executed payment</option>
					{#each data.unsettledSupplierPayments as payment}
						<option value={payment.publicId}
							>{payment.supplierName} · {money(payment.paymentAmount, payment.currencyCode)} · {payment.paymentReference ??
								payment.publicId}</option
						>
					{/each}
				</select>
			</label>
			<div class="wide"><button type="submit">Confirm settlement match</button></div>
		</form>
	{/if}
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Immutable evidence</p>
			<h2>Reconciliation history</h2>
		</div>
		<span>{data.matches.length}</span>
	</div>
	{#if data.matches.length === 0}
		<p class="muted">No reconciliation matches have been recorded.</p>
	{:else}
		<div class="list">
			{#each data.matches as match}
				<div class="match-card">
					<div class="list-row">
						<div>
							<strong
								>{match.supplierName} · {money(match.matchedAmount, match.currencyCode)}</strong
							>
							<span
								>{match.statementReference} · {match.bankReference ??
									match.statementLinePublicId}</span
							>
							<small>Matched {date(match.matchedAt)}</small>
						</div>
						<span class={`status ${match.reversalPublicId ? 'reversed' : 'active'}`}>
							{match.reversalPublicId ? 'reversed' : 'active'}
						</span>
					</div>
					{#if match.reversalReason}
						<p class="reversal-note"><strong>Reversal evidence:</strong> {match.reversalReason}</p>
					{:else if data.canReverseReconciliation}
						<form method="POST" action="?/reverseMatch" class="inline-form">
							<input type="hidden" name="matchPublicId" value={match.publicId} />
							<input
								name="reason"
								maxlength="1000"
								placeholder="Why is this match incorrect?"
								required
							/>
							<button type="submit" class="secondary">Reverse match</button>
						</form>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page-heading,
	.section-heading,
	.list-row,
	.heading-actions,
	.inline-form {
		display: flex;
		gap: 1rem;
		justify-content: space-between;
		align-items: flex-start;
	}
	.page-heading,
	.panel,
	.metrics {
		margin-bottom: 1rem;
	}
	.page-heading h1,
	.panel h2,
	.panel h3 {
		margin: 0.15rem 0 0.55rem;
	}
	.page-heading p,
	.muted,
	.list-row span,
	.list-row small {
		color: var(--color-text-muted, #64748b);
	}
	.page-heading p,
	.muted {
		max-width: 78ch;
	}
	.eyebrow {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.heading-actions,
	.inline-form {
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
	.banner,
	.panel,
	.metrics > div,
	.match-card {
		border: 1px solid var(--color-border, #d8dee8);
		border-radius: 0.8rem;
		background: var(--color-surface, white);
	}
	.banner,
	.panel,
	.match-card {
		padding: 1rem;
	}
	.error {
		color: #a11313;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.75rem;
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
	.grid {
		display: grid;
		gap: 1rem;
	}
	.grid.two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.list,
	.form-grid {
		display: grid;
		gap: 0.75rem;
	}
	.list {
		margin-bottom: 1rem;
	}
	.list-row {
		padding: 0.75rem 0;
		border-bottom: 1px solid var(--color-border, #e5e7eb);
	}
	.list-row > div {
		display: grid;
		gap: 0.2rem;
	}
	.list-row.compact {
		padding: 0.55rem 0;
	}
	.right {
		text-align: right;
	}
	.form-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.form-grid label {
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
	.reconcile-form,
	.inline-form {
		margin-top: 1rem;
	}
	.match-card + .match-card {
		margin-top: 0.75rem;
	}
	.status {
		border: 1px solid currentColor;
		border-radius: 999px;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: capitalize;
	}
	.reversal-note {
		margin-bottom: 0;
	}
	@media (max-width: 800px) {
		.grid.two,
		.form-grid {
			grid-template-columns: 1fr;
		}
		.page-heading,
		.section-heading,
		.list-row,
		.inline-form {
			flex-direction: column;
		}
		.wide {
			grid-column: auto;
		}
		.right {
			text-align: left;
		}
	}
</style>
