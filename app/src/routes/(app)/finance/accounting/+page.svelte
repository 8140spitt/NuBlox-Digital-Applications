<script lang="ts">
	let { data, form } = $props();

	const mappingLabels: Record<string, string> = {
		accounts_receivable: 'Accounts receivable',
		sales_revenue: 'Sales revenue',
		vat_control: 'VAT control',
		cash_receipts: 'Cash receipts',
		customer_unapplied_cash: 'Customer unapplied cash',
		bad_debt_expense: 'Bad-debt expense',
		bad_debt_recovery_income: 'Bad-debt recovery income'
	};

	function dateText(value: Date | null) {
		return value ? new Date(value).toLocaleDateString() : 'Not recorded';
	}
</script>

<svelte:head><title>Accounting · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/finance/invoices">Finance</a><span>/</span><span>Accounting</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Controlled accounting evidence</p>
		<h1>Accounting</h1>
		<p>
			Map your chart of accounts, post balanced journals from immutable NuBlox finance events, and
			produce checksum-backed generic CSV export evidence under governed accounting periods.
		</p>
	</div>
	<a class="period-link" href="/finance/accounting/periods">Accounting periods</a>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="notice">
	<strong>Source-derived journals under period governance</strong>
	<span
		>Journal debit/credit roles and amounts are derived from operational finance events. Posting and
		reversal require an open accounting period; exports require an exact closed period. Freehand
		journals, bank reconciliation and accounting-provider sync remain outside this boundary.</span
	>
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Chart of accounts</p>
			<h2>Accounts and semantic mappings</h2>
		</div>
		<span>{data.accounts.length} accounts</span>
	</div>

	{#if data.canConfigure}
		<div class="configure-grid">
			<form method="POST" action="?/createAccount" class="form-grid card">
				<strong>Create account</strong>
				<label>Account code<input name="accountCode" maxlength="32" required /></label>
				<label>Name<input name="name" maxlength="160" required /></label>
				<label
					>Type
					<select name="accountType" required>
						<option value="asset">Asset</option>
						<option value="liability">Liability</option>
						<option value="equity">Equity</option>
						<option value="revenue">Revenue</option>
						<option value="expense">Expense</option>
					</select>
				</label>
				<button type="submit">Create account</button>
			</form>

			<form method="POST" action="?/assignMapping" class="form-grid card">
				<strong>Assign semantic mapping</strong>
				<label
					>Accounting role
					<select name="mappingKey" required>
						{#each Object.entries(mappingLabels) as [key, label]}
							<option value={key}>{label}</option>
						{/each}
					</select>
				</label>
				<label
					>Account
					<select name="accountPublicId" required>
						<option value="">Choose an account</option>
						{#each data.accounts.filter((account) => account.isActive) as account}
							<option value={account.publicId}
								>{account.accountCode} · {account.name} · {account.accountType}</option
							>
						{/each}
					</select>
				</label>
				<label>Reason<input name="reason" maxlength="1000" required /></label>
				<button type="submit">Assign mapping</button>
			</form>
		</div>
	{/if}

	<div class="mapping-list">
		{#each Object.entries(mappingLabels) as [key, label]}
			{@const mapping = data.mappings.find((row) => row.mappingKey === key)}
			<div class:missing={!mapping}>
				<span>{label}</span>
				<strong>{mapping ? `${mapping.accountCode} · ${mapping.accountName}` : 'Not mapped'}</strong
				>
			</div>
		{/each}
	</div>

	{#if data.accounts.length > 0}
		<div class="table-wrap">
			<table>
				<thead
					><tr><th>Code</th><th>Name</th><th>Type</th><th>Normal balance</th><th>Status</th></tr
					></thead
				>
				<tbody>
					{#each data.accounts as account}
						<tr
							><td>{account.accountCode}</td><td>{account.name}</td><td>{account.accountType}</td
							><td>{account.normalBalance}</td><td>{account.isActive ? 'Active' : 'Inactive'}</td
							></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Unposted source events</p>
			<h2>Journal candidates</h2>
		</div>
		<span>{data.candidates.length}</span>
	</div>
	{#if data.candidates.length === 0}
		<p class="muted">No eligible unposted finance events are available.</p>
	{:else}
		<div class="records">
			{#each data.candidates as candidate}
				<article class="record">
					<div class="record-head">
						<div>
							<strong>{candidate.sourceLabel}</strong><small
								>{candidate.sourceType} · {candidate.currencyCode}
								{candidate.sourceAmount} · {dateText(candidate.sourceEventAt)}</small
							>
						</div>
						{#if candidate.missingMappings.length > 0}<em class="warning"
								>Missing {candidate.missingMappings.length} mapping(s)</em
							>{:else}<em>Ready</em>{/if}
					</div>
					<div class="line-preview">
						{#each candidate.lines as line}
							<div>
								<span>{mappingLabels[line.mappingKey] ?? line.mappingKey} · {line.description}</span
								><strong
									>{line.debitAmount !== '0.0000'
										? `Dr ${line.debitAmount}`
										: `Cr ${line.creditAmount}`}</strong
								>
							</div>
						{/each}
					</div>
					{#if data.canPost && candidate.missingMappings.length === 0}
						<form method="POST" action="?/postSource" class="inline-action">
							<input type="hidden" name="sourceType" value={candidate.sourceType} />
							<input type="hidden" name="sourcePublicId" value={candidate.sourcePublicId} />
							<label>Accounting date <input type="date" name="accountingDate" /></label>
							<label>Memo <input name="memo" maxlength="1000" placeholder={candidate.memo} /></label
							>
							<button type="submit">Post journal</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Journal evidence</p>
			<h2>Posted journals</h2>
		</div>
		<span>{data.journals.length}</span>
	</div>
	{#if data.journals.length === 0}
		<p class="muted">No accounting journals have been posted.</p>
	{:else}
		<div class="records">
			{#each data.journals as journal}
				<article class="record">
					<div class="record-head">
						<div>
							<strong>{journal.journalNumber} · {journal.sourceType}</strong><small
								>{journal.currencyCode}
								{journal.sourceAmount} · accounting {dateText(journal.accountingDate)} · posted {dateText(
									journal.postedAt
								)}</small
							>
						</div>
						<em class:reversed={journal.reversedAt}
							>{journal.reversedAt ? `Reversed ${dateText(journal.reversedAt)}` : 'Active'}</em
						>
					</div>
					<p class="memo">{journal.memo}</p>
					<div class="line-preview">
						{#each journal.lines as line}
							<div>
								<span>{line.accountCode} · {line.accountName} · {line.description}</span><strong
									>{line.debitAmount !== '0.0000'
										? `Dr ${line.debitAmount}`
										: `Cr ${line.creditAmount}`}</strong
								>
							</div>
						{/each}
					</div>
					{#if data.canReverse && !journal.reversedAt && journal.sourceType !== 'journal_reversal'}
						<form method="POST" action="?/reverseJournal" class="inline-action danger-action">
							<input type="hidden" name="journalPublicId" value={journal.publicId} />
							<label>Reversal date <input type="date" name="accountingDate" /></label>
							<label>Reason <input name="reason" maxlength="1000" required /></label>
							<button type="submit">Post reversal journal</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Provider-neutral output</p>
			<h2>Accounting exports</h2>
		</div>
		<span>{data.exports.length}</span>
	</div>
	{#if data.canExport}
		<form method="POST" action="?/createExport" class="export-form">
			<label>Period start<input type="date" name="periodStart" required /></label>
			<label>Period end<input type="date" name="periodEnd" required /></label>
			<label>Reason<input name="reason" maxlength="1000" required /></label>
			<button type="submit">Create generic CSV export</button>
		</form>
	{/if}
	{#if data.exports.length > 0}
		<div class="records exports">
			{#each data.exports as batch}
				<article class="export-row">
					<div>
						<strong>{batch.exportNumber}</strong><small
							>{dateText(batch.periodStart)}–{dateText(batch.periodEnd)} · {batch.rowCount} rows · SHA-256
							{batch.contentSha256.slice(0, 12)}…</small
						>
					</div>
					<div class="export-actions">
						<a href={`/finance/accounting/exports/${batch.publicId}`}>Download CSV</a>
						{#if batch.reversedAt}<em>Reversed {dateText(batch.reversedAt)}</em
							>{:else if data.canReverseExport}
							<form method="POST" action="?/reverseExport" class="mini-form">
								<input type="hidden" name="exportPublicId" value={batch.publicId} /><input
									name="reason"
									maxlength="1000"
									placeholder="Reversal reason"
									required
								/><button type="submit">Reverse export</button>
							</form>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.breadcrumbs {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		color: #667085;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}
	.breadcrumbs a {
		color: inherit;
	}
	.page-heading,
	.section-heading,
	.record-head,
	.export-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}
	.page-heading {
		margin-bottom: 1rem;
	}
	.page-heading h1,
	.panel h2 {
		margin: 0.15rem 0;
	}
	.page-heading p {
		margin: 0.2rem 0;
		color: #667085;
		max-width: 72rem;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.72rem;
		font-weight: 700;
		color: #667085;
		margin: 0;
	}
	.period-link {
		font-weight: 700;
		color: #344054;
		white-space: nowrap;
	}
	.notice {
		display: grid;
		gap: 0.25rem;
		padding: 0.85rem 1rem;
		margin-bottom: 1rem;
		border: 1px solid #b9cbe6;
		border-radius: 11px;
		background: #f5f8fc;
	}
	.notice span,
	.muted {
		color: #667085;
		line-height: 1.45;
	}
	.panel {
		border: 1px solid #d0d5dd;
		border-radius: 14px;
		background: white;
		padding: 1rem;
		margin-bottom: 1rem;
	}
	.configure-grid,
	.export-form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.8rem;
		margin-top: 0.8rem;
	}
	.export-form {
		grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
		align-items: end;
	}
	.form-grid,
	.records,
	.line-preview,
	.mapping-list {
		display: grid;
		gap: 0.7rem;
	}
	.card {
		border: 1px solid #e4e7ec;
		border-radius: 10px;
		padding: 0.8rem;
	}
	.mapping-list {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin-top: 1rem;
	}
	.mapping-list div {
		display: flex;
		justify-content: space-between;
		gap: 0.7rem;
		padding: 0.6rem;
		background: #f8fafc;
		border-radius: 8px;
	}
	.mapping-list .missing strong {
		color: #b42318;
	}
	.table-wrap {
		overflow: auto;
		margin-top: 1rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.55rem;
		border-bottom: 1px solid #e4e7ec;
	}
	.records {
		margin-top: 0.8rem;
	}
	.record {
		border: 1px solid #e4e7ec;
		border-radius: 10px;
		padding: 0.85rem;
	}
	.record-head div,
	.export-row > div {
		display: grid;
		gap: 0.15rem;
	}
	.record-head small,
	.export-row small {
		color: #667085;
	}
	.record-head em,
	.export-row em {
		font-style: normal;
		font-size: 0.75rem;
		text-transform: uppercase;
	}
	.record-head em.warning {
		color: #b54708;
	}
	.record-head em.reversed {
		color: #b42318;
	}
	.line-preview {
		margin-top: 0.65rem;
	}
	.line-preview div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.45rem 0.55rem;
		background: #f8fafc;
		border-radius: 7px;
		font-size: 0.86rem;
	}
	.memo {
		color: #667085;
	}
	.inline-action {
		display: grid;
		grid-template-columns: auto minmax(12rem, 1fr) auto;
		gap: 0.65rem;
		align-items: end;
		margin-top: 0.8rem;
		padding-top: 0.8rem;
		border-top: 1px solid #e4e7ec;
	}
	.danger-action button,
	.mini-form button {
		background: #912018;
	}
	.exports {
		gap: 0.4rem;
	}
	.export-row {
		padding: 0.65rem;
		background: #f8fafc;
		border-radius: 8px;
	}
	.export-actions {
		display: flex !important;
		align-items: center;
		gap: 0.7rem;
	}
	.export-actions a {
		font-weight: 700;
	}
	.mini-form {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.85rem;
		font-weight: 650;
	}
	input,
	select {
		font: inherit;
		padding: 0.58rem;
		border: 1px solid #cfd4dc;
		border-radius: 8px;
		background: white;
	}
	button {
		font: inherit;
		font-weight: 700;
		padding: 0.6rem 0.8rem;
		border: 0;
		border-radius: 8px;
		background: #1d2939;
		color: white;
		cursor: pointer;
		width: max-content;
	}
	.banner {
		padding: 0.75rem 1rem;
		border-radius: 9px;
	}
	.error {
		color: #b42318;
		background: #fef3f2;
	}
	@media (max-width: 900px) {
		.page-heading,
		.record-head,
		.export-row {
			display: grid;
		}
		.configure-grid,
		.mapping-list,
		.export-form,
		.inline-action {
			grid-template-columns: 1fr;
		}
		.line-preview div,
		.mapping-list div {
			display: grid;
		}
		.export-actions,
		.mini-form {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
