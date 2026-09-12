<script lang="ts">
	let { data, form } = $props();

	function dateText(value: Date | null) {
		return value ? new Date(value).toLocaleDateString() : 'Not recorded';
	}

	function dateValue(value: Date | null) {
		return value ? new Date(value).toISOString().slice(0, 10) : '';
	}

	function activePosting(posting: { reversedAt: Date | null }) {
		return !posting.reversedAt;
	}
</script>

<svelte:head><title>VAT bad-debt relief · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/finance/invoices">Finance</a><span>/</span><span>VAT bad-debt relief</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Tax accounting evidence</p>
		<h1>VAT bad-debt relief</h1>
		<p>
			Prepare source-linked relief, authorise it separately, and record VAT-return inclusion or
			later recovery repayment without changing the invoice, write-off or payment history.
		</p>
	</div>
	<a class="secondary" href="/finance/tax">Tax settings</a>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="notice">
	<strong>Controlled evidence boundary</strong>
	<span
		>This workspace records eligibility attestations, source invoice VAT snapshots, authorisation
		and VAT-return posting evidence. It does not submit a VAT return or create general-ledger
		entries.</span
	>
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Relief candidates</p>
			<h2>Written-off receivables requiring tax treatment</h2>
		</div>
		<span>{data.candidates.length}</span>
	</div>

	{#if data.candidates.length === 0}
		<p class="muted">No active write-offs are currently marked for separate tax adjustment.</p>
	{:else}
		<div class="cards">
			{#each data.candidates as candidate}
				<article class="record">
					<div class="record-head">
						<div>
							<strong>{candidate.invoiceNumber} · {candidate.customerName}</strong>
							<small
								>Write-off {candidate.writeOffAmount} · recovered {candidate.activeRecoveryAmount} · already
								claimed {candidate.activeClaimBasisAmount}</small
							>
						</div>
						<em>{candidate.availableClaimBasisAmount} available</em>
					</div>

					<div class="tax-lines">
						{#each candidate.taxLines as line}
							<div>
								<span>Line {line.lineNumber} · {line.description}</span>
								<small
									>{line.taxCategoryCode} · {line.appliedRatePercent}% · net {line.taxableAmount} · VAT
									{line.taxAmount} · gross {line.grossAmount} · source capacity {line.availableBasisAmount}</small
								>
							</div>
						{/each}
					</div>

					{#if data.canPrepare && candidate.availableClaimBasisAmount !== '0.0000' && candidate.taxLines.length > 0}
						<form method="POST" action="?/prepare" class="form-grid prep-form">
							<input type="hidden" name="writeOffPublicId" value={candidate.writeOffPublicId} />
							<div class="two-col">
								<label
									>Supply / tax-point date<input type="date" name="supplyDate" required /></label
								>
								<label
									>Payment due date<input
										type="date"
										name="paymentDueDate"
										value={dateValue(candidate.invoiceDueDate)}
										required
									/></label
								>
							</div>
							<label
								>Original VAT period reference<input
									name="originalVatPeriodReference"
									maxlength="80"
									placeholder="e.g. 2026-Q1"
									required
								/></label
							>
							<fieldset>
								<legend>Consideration basis by source VAT line</legend>
								{#each candidate.taxLines as line}
									<label
										>Line {line.lineNumber} · {line.taxCategoryCode}<input
											name={`basis:${line.sourceInvoiceItemId}:${line.taxCategoryId}`}
											inputmode="decimal"
											placeholder={`Up to ${line.availableBasisAmount}`}
										/></label
									>
								{/each}
							</fieldset>
							<fieldset class="checks">
								<legend>Eligibility attestations</legend>
								<label
									><input type="checkbox" name="vatAccountedAndPaid" required /> VAT was accounted for
									and paid to HMRC.</label
								>
								<label
									><input type="checkbox" name="debtNotSoldOrFactored" required /> The debt has not been
									sold or factored.</label
								>
								<label
									><input type="checkbox" name="sellingPriceConditionMet" required /> The selling-price
									condition is met.</label
								>
								<label
									><input type="checkbox" name="reliefSchemeApplicable" required /> The organisation has
									confirmed this relief scheme is applicable.</label
								>
							</fieldset>
							<label
								>Preparation reason<textarea name="reason" maxlength="1000" rows="2" required
								></textarea></label
							>
							<button type="submit">Prepare relief claim</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<section class="panel claims-panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Evidence history</p>
			<h2>Prepared claims</h2>
		</div>
		<span>{data.claims.length}</span>
	</div>

	{#if data.claims.length === 0}
		<p class="muted">No VAT bad-debt relief claims have been prepared.</p>
	{:else}
		<div class="cards">
			{#each data.claims as claim}
				<article class="record claim-card">
					<div class="record-head">
						<div>
							<strong>{claim.invoiceNumber} · VAT relief {claim.vatReliefAmount}</strong>
							<small
								>Consideration {claim.considerationBasisAmount} · prepared {dateText(
									claim.preparedAt
								)} · source period {claim.originalVatPeriodReference}</small
							>
						</div>
						<em class:reversed={claim.status === 'reversed'}>{claim.status}</em>
					</div>

					<dl class="facts">
						<div>
							<dt>Supply date</dt>
							<dd>{dateText(claim.supplyDate)}</dd>
						</div>
						<div>
							<dt>Due date</dt>
							<dd>{dateText(claim.paymentDueDate)}</dd>
						</div>
						<div>
							<dt>Eligible from</dt>
							<dd>{dateText(claim.eligibleFrom)}</dd>
						</div>
						<div>
							<dt>Claim deadline</dt>
							<dd>{dateText(claim.claimDeadline)}</dd>
						</div>
					</dl>

					{#if claim.status === 'prepared' && data.canAuthorise}
						<form method="POST" action="?/authorise" class="inline-action">
							<input type="hidden" name="claimPublicId" value={claim.publicId} />
							<label>Authorisation reason<input name="reason" maxlength="1000" required /></label>
							<button type="submit">Authorise relief</button>
						</form>
					{/if}

					{#if claim.status === 'authorised'}
						<div class="action-grid">
							{#if data.canPost}
								<form method="POST" action="?/post" class="form-grid compact">
									<input type="hidden" name="sourceKind" value="relief_claim" />
									<input type="hidden" name="sourcePublicId" value={claim.publicId} />
									<strong>Record claim in VAT return</strong>
									<label
										>VAT period reference<input
											name="vatReturnPeriodReference"
											maxlength="80"
											required
										/></label
									>
									<div class="two-col">
										<label
											>Period start<input type="date" name="vatReturnPeriodStart" required /></label
										><label
											>Period end<input type="date" name="vatReturnPeriodEnd" required /></label
										>
									</div>
									<label>External reference<input name="externalReference" maxlength="160" /></label
									>
									<label>Reason<input name="reason" maxlength="1000" required /></label>
									<button type="submit">Record Box 4 posting</button>
								</form>
							{/if}
							{#if data.canRecordRepayment}
								<form method="POST" action="?/recordRepayment" class="form-grid compact">
									<input type="hidden" name="claimPublicId" value={claim.publicId} />
									<strong>Record VAT repayment after recovery</strong>
									<label
										>Bad-debt recovery ID<input
											name="recoveryPublicId"
											maxlength="64"
											required
										/></label
									>
									<label
										>Recovered consideration<input
											name="considerationPaymentAmount"
											inputmode="decimal"
											required
										/></label
									>
									<label>Reason<input name="reason" maxlength="1000" required /></label>
									<button type="submit">Record proportional VAT repayment</button>
								</form>
							{/if}
						</div>
					{/if}

					{#if claim.repayments.length > 0}
						<div class="history">
							<h3>Recovery repayments</h3>
							{#each claim.repayments as repayment}
								<div class="history-row">
									<div>
										<strong>VAT {repayment.vatRepaymentAmount}</strong><small
											>Recovered consideration {repayment.considerationPaymentAmount} · {dateText(
												repayment.recordedAt
											)} · recovery {repayment.recoveryPublicId}</small
										>
									</div>
									{#if repayment.reversedAt}<em>Reversed {dateText(repayment.reversedAt)}</em>{/if}
								</div>
								{#if !repayment.reversedAt}
									<div class="action-grid">
										{#if data.canPost}
											<form method="POST" action="?/post" class="form-grid compact">
												<input type="hidden" name="sourceKind" value="relief_repayment" />
												<input type="hidden" name="sourcePublicId" value={repayment.publicId} />
												<strong>Record repayment in VAT return</strong>
												<label
													>VAT period reference<input
														name="vatReturnPeriodReference"
														maxlength="80"
														required
													/></label
												>
												<div class="two-col">
													<label
														>Period start<input
															type="date"
															name="vatReturnPeriodStart"
															required
														/></label
													><label
														>Period end<input
															type="date"
															name="vatReturnPeriodEnd"
															required
														/></label
													>
												</div>
												<label
													>External reference<input
														name="externalReference"
														maxlength="160"
													/></label
												>
												<label>Reason<input name="reason" maxlength="1000" required /></label>
												<button type="submit">Record Box 1 posting</button>
											</form>
										{/if}
										{#if data.canReverseRepayment}
											<form
												method="POST"
												action="?/reverseRepayment"
												class="inline-action danger-action"
											>
												<input type="hidden" name="repaymentPublicId" value={repayment.publicId} />
												<label
													>Reversal reason<input name="reason" maxlength="1000" required /></label
												>
												<button type="submit">Reverse repayment</button>
											</form>
										{/if}
									</div>
								{/if}
							{/each}
						</div>
					{/if}

					{#if claim.postings.length > 0}
						<div class="history">
							<h3>VAT-return posting evidence</h3>
							{#each claim.postings as posting}
								<div class="history-row">
									<div>
										<strong>Box {posting.vatReturnBox} · {posting.amount}</strong><small
											>{posting.vatReturnPeriodReference} · {dateText(
												posting.vatReturnPeriodStart
											)}–{dateText(posting.vatReturnPeriodEnd)} · {posting.externalReference ??
												'No external reference'}</small
										>
									</div>
									<em
										>{posting.reversedAt
											? `Reversed ${dateText(posting.reversedAt)}`
											: 'Active'}</em
									>
								</div>
								{#if activePosting(posting) && data.canReversePosting}
									<form method="POST" action="?/reversePost" class="inline-action danger-action">
										<input type="hidden" name="postingPublicId" value={posting.publicId} />
										<label
											>Posting reversal reason<input
												name="reason"
												maxlength="1000"
												required
											/></label
										>
										<button type="submit">Reverse posting evidence</button>
									</form>
								{/if}
							{/each}
						</div>
					{/if}

					{#if claim.status === 'authorised' && data.canReverse}
						<form method="POST" action="?/reverseClaim" class="inline-action danger-action">
							<input type="hidden" name="claimPublicId" value={claim.publicId} />
							<label>Claim reversal reason<input name="reason" maxlength="1000" required /></label>
							<button type="submit">Reverse relief claim</button>
						</form>
					{/if}
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
	.history-row {
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
	.secondary {
		padding: 0.55rem 0.75rem;
		border: 1px solid #d0d5dd;
		border-radius: 9px;
		color: inherit;
		text-decoration: none;
		font-weight: 700;
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
	.cards,
	.form-grid,
	.tax-lines,
	.history {
		display: grid;
		gap: 0.75rem;
	}
	.cards {
		margin-top: 0.8rem;
	}
	.record {
		border: 1px solid #e4e7ec;
		border-radius: 10px;
		padding: 0.9rem;
	}
	.record-head div,
	.history-row div {
		display: grid;
		gap: 0.15rem;
	}
	.record-head small,
	.history-row small {
		color: #667085;
	}
	.record-head em,
	.history-row em {
		font-style: normal;
		font-size: 0.75rem;
		text-transform: uppercase;
	}
	.record-head em.reversed {
		color: #b42318;
	}
	.tax-lines {
		margin-top: 0.75rem;
	}
	.tax-lines div {
		display: grid;
		gap: 0.2rem;
		padding: 0.55rem 0.65rem;
		background: #f8fafc;
		border-radius: 8px;
	}
	.tax-lines small {
		color: #667085;
	}
	.prep-form,
	.history,
	.inline-action,
	.action-grid {
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid #e4e7ec;
	}
	.two-col,
	.action-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}
	.form-grid {
		gap: 0.65rem;
	}
	fieldset {
		border: 1px solid #e4e7ec;
		border-radius: 9px;
		padding: 0.7rem;
		display: grid;
		gap: 0.55rem;
	}
	legend {
		font-weight: 700;
		padding: 0 0.25rem;
	}
	.checks label {
		display: flex;
		grid-template-columns: auto 1fr;
		align-items: flex-start;
		gap: 0.5rem;
		font-weight: 500;
	}
	.checks input {
		margin-top: 0.2rem;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.5rem;
		margin: 0.75rem 0;
	}
	.facts div {
		padding: 0.55rem;
		background: #f8fafc;
		border-radius: 8px;
	}
	.facts dt {
		font-size: 0.72rem;
		text-transform: uppercase;
		color: #667085;
	}
	.facts dd {
		margin: 0.2rem 0 0;
		font-weight: 700;
	}
	.compact {
		border: 1px solid #e4e7ec;
		border-radius: 9px;
		padding: 0.75rem;
	}
	.inline-action {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.7rem;
		align-items: end;
	}
	.history h3 {
		margin: 0;
		font-size: 1rem;
	}
	.history-row {
		padding: 0.55rem 0.65rem;
		background: #f8fafc;
		border-radius: 8px;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.86rem;
		font-weight: 650;
	}
	input,
	textarea {
		font: inherit;
		padding: 0.6rem;
		border: 1px solid #cfd4dc;
		border-radius: 8px;
		background: white;
	}
	textarea {
		resize: vertical;
	}
	button {
		font: inherit;
		font-weight: 700;
		padding: 0.62rem 0.8rem;
		border: 0;
		border-radius: 8px;
		background: #1d2939;
		color: white;
		cursor: pointer;
		width: max-content;
	}
	.danger-action button {
		background: #912018;
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
		.history-row {
			display: grid;
		}
		.two-col,
		.action-grid,
		.facts,
		.inline-action {
			grid-template-columns: 1fr;
		}
	}
</style>
