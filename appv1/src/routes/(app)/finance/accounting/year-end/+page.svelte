<script lang="ts">
	let { data, form } = $props();

	function dateText(value: Date | null) {
		return value ? new Date(value).toLocaleDateString() : 'Not recorded';
	}
</script>

<svelte:head><title>Year-end close · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/finance/accounting">Accounting</a><span>/</span><span>Year-end close</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Controlled accounting evidence</p>
		<h1>Year-end close</h1>
		<p>
			Prepare a fingerprinted close from hard-closed periods, require separate authorisation, and
			transfer the derived result to retained earnings without rewriting journal history.
		</p>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="notice">
	<strong>Separation of duties</strong>
	<span
		>The member who prepares a close cannot authorise that same preparation. Every period in the
		financial year must be hard closed and retained earnings must be mapped to an active equity
		account.</span
	>
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Closing destination</p>
			<h2>Retained earnings mapping</h2>
		</div>
	</div>
	<p>
		{data.retainedEarningsMapping
			? `${data.retainedEarningsMapping.accountCode} · ${data.retainedEarningsMapping.name}`
			: 'No retained earnings account is mapped.'}
	</p>
	{#if data.canConfigureRetainedEarnings}
		<form method="POST" action="?/assignRetainedEarnings" class="form-grid card">
			<label
				>Active equity account
				<select name="accountPublicId" required>
					<option value="">Choose an equity account</option>
					{#each data.retainedEarningsAccounts as account}<option value={account.publicId}
							>{account.accountCode} · {account.name}</option
						>{/each}
				</select>
			</label>
			<label>Reason<input name="reason" maxlength="1000" required /></label>
			<button type="submit">Assign retained earnings</button>
		</form>
	{/if}
</section>

{#if data.canPrepare}
	<section class="panel">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Preparation</p>
				<h2>Prepare year-end close</h2>
			</div>
		</div>
		<form method="POST" action="?/prepare" class="form-grid card">
			<label
				>Financial year
				<select name="financialYearPublicId" required>
					<option value="">Choose a financial year</option>
					{#each data.financialYears as year}<option value={year.publicId}
							>{year.yearCode} · {year.name}</option
						>{/each}
				</select>
			</label>
			<label>Currency<input name="currencyCode" maxlength="3" value="GBP" required /></label>
			<label>Reason<input name="reason" maxlength="1000" required /></label>
			<button type="submit">Prepare close evidence</button>
		</form>
	</section>
{/if}

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Immutable preparation evidence</p>
			<h2>Preparations</h2>
		</div>
		<span>{data.preparations.length}</span>
	</div>
	{#if data.preparations.length === 0}
		<p class="muted">No year-end close preparations have been recorded.</p>
	{:else}
		<div class="records">
			{#each data.preparations as preparation}
				<article class="record">
					<div class="record-head">
						<div>
							<strong
								>Preparation #{preparation.preparationSequence} · {preparation.currencyCode}</strong
							><small
								>{dateText(preparation.preparedAt)} · fingerprint {preparation.sourceFingerprint.slice(
									0,
									12
								)}…</small
							>
						</div>
						<em>{preparation.currencyCode} {preparation.profitLossAmount}</em>
					</div>
					<p>Revenue {preparation.revenueTotal} · Expenses {preparation.expenseTotal}</p>
					<p class="memo">{preparation.reason}</p>
					{#if data.canAuthorise}
						<form method="POST" action="?/authorise" class="inline-action">
							<input type="hidden" name="preparationPublicId" value={preparation.publicId} />
							<label>Authorisation reason<input name="reason" maxlength="1000" required /></label>
							<button type="submit">Authorise and post close</button>
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
			<p class="eyebrow">Authorised accounting evidence</p>
			<h2>Year-end closes</h2>
		</div>
		<span>{data.closes.length}</span>
	</div>
	{#if data.closes.length === 0}
		<p class="muted">No year-end closes have been authorised.</p>
	{:else}
		<div class="records">
			{#each data.closes as close}
				<article class="record">
					<div class="record-head">
						<div>
							<strong>Close #{close.closeSequence} · {close.currencyCode}</strong><small
								>Authorised {dateText(close.authorisedAt)}</small
							>
						</div>
						<em class:reversed={close.reversedAt}
							>{close.reversedAt ? `Reversed ${dateText(close.reversedAt)}` : 'Active'}</em
						>
					</div>
					{#if data.canReverse && !close.reversedAt}
						<form method="POST" action="?/reverse" class="inline-action danger-action">
							<input type="hidden" name="closePublicId" value={close.publicId} />
							<label>Reversal reason<input name="reason" maxlength="1000" required /></label>
							<button type="submit">Reverse close journal</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>
