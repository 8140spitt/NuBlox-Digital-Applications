<script lang="ts">
	let { data, form } = $props();

	function money(value: string | null, currencyCode: string) {
		if (value === null) return '—';
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode }).format(
			Number(value)
		);
	}
</script>

<svelte:head><title>Credit Control · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/finance/receivables">Receivables</a><span aria-hidden="true">/</span><span
		>Credit Control</span
	>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Package 004I</p>
		<h1>Credit Control</h1>
		<p>Customer credit limits, stop-trading holds and reasoned override evidence.</p>
	</div>
	<a class="secondary" href="/finance/collections">Collections</a>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="boundary">
	<strong>Credit utilisation is derived, not stored.</strong>
	<span
		>Current receivable is issued invoice gross − issued credit notes − active payment allocations.
		Commitment gates add the accepted quotation or contract value to that live position before
		comparing it with the currency-specific limit. Holds are customer-wide.</span
	>
</section>

<div class="layout">
	<div class="stack">
		<section class="panel">
			<p class="eyebrow">Live policy</p>
			<h2>Credit limits</h2>
			{#if data.policies.length === 0}
				<p class="muted">No customer credit limits have been configured.</p>
			{:else}
				<div class="cards">
					{#each data.policies as policy}
						<article class:blocked={policy.limitExhausted} class="record">
							<div class="record-head">
								<span
									><strong>{policy.customerDisplayName}</strong><small
										>{policy.currencyCode} · revision {policy.versionNumber}</small
									></span
								>
								<em
									>{policy.isEnabled
										? policy.limitExhausted
											? 'Exhausted'
											: 'Enabled'
										: 'Disabled'}</em
								>
							</div>
							<dl>
								<div>
									<dt>Limit</dt>
									<dd>
										{policy.isEnabled
											? money(policy.creditLimitAmount, policy.currencyCode)
											: 'Disabled'}
									</dd>
								</div>
								<div>
									<dt>Outstanding</dt>
									<dd>{money(policy.outstandingAmount, policy.currencyCode)}</dd>
								</div>
								<div>
									<dt>Available</dt>
									<dd>
										{policy.isEnabled ? money(policy.availableAmount, policy.currencyCode) : '—'}
									</dd>
								</div>
								<div>
									<dt>Reason</dt>
									<dd>{policy.reason}</dd>
								</div>
							</dl>
							{#if data.canManagePolicies && policy.isEnabled}
								<form method="POST" action="?/disableLimit" class="inline-action">
									<input
										type="hidden"
										name="customerPartyPublicId"
										value={policy.customerPartyPublicId}
									/>
									<input type="hidden" name="currencyCode" value={policy.currencyCode} />
									<label>Disable reason<input name="reason" maxlength="1000" required /></label>
									<button class="quiet" type="submit">Disable limit</button>
								</form>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</section>

		<section class="panel">
			<p class="eyebrow">Stop trading</p>
			<h2>Credit holds</h2>
			{#if data.holds.length === 0}
				<p class="muted">No credit holds have been recorded.</p>
			{:else}
				<div class="cards">
					{#each data.holds as hold}
						<article class:blocked={hold.status === 'active'} class="record">
							<div class="record-head">
								<span
									><strong>{hold.customerDisplayName}</strong><small
										>Placed {new Date(hold.placedAt).toLocaleString()}</small
									></span
								><em>{hold.status}</em>
							</div>
							<p>{hold.placedReason}</p>
							{#if hold.status === 'released'}
								<p class="muted">
									Released {hold.releasedAt ? new Date(hold.releasedAt).toLocaleString() : ''}: {hold.releasedReason}
								</p>
							{:else if data.canManageHolds}
								<form method="POST" action="?/releaseHold" class="inline-action">
									<input type="hidden" name="holdPublicId" value={hold.publicId} />
									<label>Release reason<input name="reason" maxlength="1000" required /></label>
									<button type="submit">Release hold</button>
								</form>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</section>

		<section class="panel">
			<p class="eyebrow">Exceptional authority</p>
			<h2>Override history</h2>
			{#if data.overrides.length === 0}
				<p class="muted">No credit-control overrides have been used.</p>
			{:else}
				<div class="cards">
					{#each data.overrides as override}
						<article class="record">
							<div class="record-head">
								<span
									><strong>{override.customerDisplayName}</strong><small
										>{override.workflowType.replaceAll('_', ' ')} · {new Date(
											override.authorisedAt
										).toLocaleString()}</small
									></span
								><em>Override</em>
							</div>
							<dl>
								<div>
									<dt>Receivable</dt>
									<dd>{money(override.outstandingAmount, override.currencyCode)}</dd>
								</div>
								<div>
									<dt>Commitment</dt>
									<dd>{money(override.commitmentAmount, override.currencyCode)}</dd>
								</div>
								<div>
									<dt>Projected</dt>
									<dd>{money(override.projectedExposureAmount, override.currencyCode)}</dd>
								</div>
								<div>
									<dt>Limit</dt>
									<dd>{money(override.creditLimitAmount, override.currencyCode)}</dd>
								</div>
								<div>
									<dt>Subject</dt>
									<dd>{override.subjectPublicId}</dd>
								</div>
								<div>
									<dt>Reason</dt>
									<dd>{override.reason}</dd>
								</div>
							</dl>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<aside class="stack">
		{#if data.canManagePolicies}
			<section class="panel action-panel">
				<p class="eyebrow">Limit policy</p>
				<h2>Set or revise a limit</h2>
				<p class="muted">
					Each change creates a new immutable revision. Existing history is never overwritten.
				</p>
				<form method="POST" action="?/setLimit">
					<label
						>Customer<select name="customerPartyPublicId" required
							><option value="">Select customer</option>{#each data.customers as customer}<option
									value={customer.publicId}>{customer.displayName}</option
								>{/each}</select
						></label
					>
					<label>Currency<input name="currencyCode" maxlength="3" value="GBP" required /></label>
					<label>Credit limit<input name="limitAmount" inputmode="decimal" required /></label>
					<label>Reason<textarea name="reason" rows="4" maxlength="1000" required></textarea></label
					>
					<button type="submit">Save credit limit revision</button>
				</form>
			</section>
		{/if}

		{#if data.canManageHolds}
			<section class="panel hold-panel">
				<p class="eyebrow">Stop trading</p>
				<h2>Place a credit hold</h2>
				<p class="muted">
					A hold blocks new accepted-quotation conversion and contract execution regardless of
					currency.
				</p>
				<form method="POST" action="?/placeHold">
					<label
						>Customer<select name="customerPartyPublicId" required
							><option value="">Select customer</option>{#each data.customers as customer}<option
									value={customer.publicId}>{customer.displayName}</option
								>{/each}</select
						></label
					>
					<label>Reason<textarea name="reason" rows="4" maxlength="1000" required></textarea></label
					>
					<button type="submit">Place credit hold</button>
				</form>
			</section>
		{/if}

		<section class="panel">
			<p class="eyebrow">Enforcement</p>
			<h2>Named commitment boundaries</h2>
			<ul>
				<li>
					<strong>Accepted quotation → proposed project:</strong> current receivable + accepted non-optional
					quotation gross is checked.
				</li>
				<li>
					<strong>Contract execution:</strong> current receivable + contract version value is checked.
				</li>
				<li>Quotation issue and contract issue remain pre-commitment.</li>
				<li>Invoice issue remains available so completed work can still be billed.</li>
				<li>Credits, payments and collections remain available to reduce/manage exposure.</li>
			</ul>
			<p class="muted">
				Override authority: {data.canOverride ? 'granted to you' : 'not granted to you'}.
			</p>
		</section>
	</aside>
</div>

<style>
	.breadcrumbs {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		margin-bottom: 1rem;
		color: #666;
		font-size: 0.9rem;
	}
	.breadcrumbs a {
		color: inherit;
		font-weight: 650;
	}
	.page-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
		margin-bottom: 1rem;
	}
	.page-heading h1 {
		margin: 0.15rem 0 0.3rem;
		font-size: clamp(2rem, 5vw, 2.8rem);
		letter-spacing: -0.04em;
	}
	.page-heading p {
		margin: 0;
		color: #666;
	}
	.eyebrow {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.72rem;
		font-weight: 760;
		color: #666;
	}
	.secondary {
		padding: 0.55rem 0.72rem;
		border: 1px solid #cfcfc8;
		border-radius: 0.46rem;
		color: #222;
		text-decoration: none;
		font-weight: 700;
	}
	.boundary {
		display: grid;
		gap: 0.2rem;
		padding: 0.85rem 1rem;
		margin-bottom: 1rem;
		border: 1px solid #c8d4e6;
		border-radius: 0.65rem;
		background: #f5f8fc;
	}
	.boundary span,
	.muted {
		color: #666;
		line-height: 1.5;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.65fr);
		gap: 1rem;
		align-items: start;
	}
	.stack,
	.cards,
	form {
		display: grid;
		gap: 0.8rem;
	}
	.panel {
		background: #fff;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.1rem;
	}
	.panel h2 {
		margin: 0.3rem 0 0.8rem;
	}
	.action-panel {
		border-color: #b9cbe6;
	}
	.hold-panel {
		border-color: #dfb36a;
	}
	.record {
		padding: 0.85rem;
		border: 1px solid #e1e1db;
		border-radius: 0.6rem;
	}
	.record.blocked {
		border-color: #dfb36a;
		background: #fffaf0;
	}
	.record-head {
		display: flex;
		justify-content: space-between;
		gap: 0.8rem;
		align-items: start;
	}
	.record-head span {
		display: grid;
		gap: 0.15rem;
	}
	.record-head small {
		color: #666;
	}
	.record-head em {
		font-style: normal;
		text-transform: capitalize;
		font-size: 0.76rem;
		font-weight: 760;
	}
	.record p {
		line-height: 1.45;
	}
	dl {
		display: grid;
		gap: 0.45rem;
		margin: 0.7rem 0;
	}
	dl div {
		display: grid;
		grid-template-columns: 7.5rem 1fr;
		gap: 0.6rem;
	}
	dt {
		font-size: 0.82rem;
		color: #666;
	}
	dd {
		margin: 0;
	}
	.inline-action {
		margin-top: 0.7rem;
		padding-top: 0.7rem;
		border-top: 1px solid #ecece7;
		grid-template-columns: 1fr auto;
		align-items: end;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-weight: 650;
	}
	input,
	select,
	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.58rem;
		border: 1px solid #c9c9c2;
		border-radius: 0.45rem;
		background: #fff;
		font: inherit;
	}
	button {
		width: max-content;
		padding: 0.62rem 0.8rem;
		border: 0;
		border-radius: 0.46rem;
		background: #111;
		color: white;
		font: inherit;
		font-weight: 750;
		cursor: pointer;
	}
	.quiet {
		background: #6f342d;
	}
	.error {
		color: #8a3025;
	}
	.banner {
		padding: 0.7rem 0.8rem;
		background: #fff0ed;
		border: 1px solid #e1b1aa;
		border-radius: 0.5rem;
	}
	ul {
		padding-left: 1.2rem;
		line-height: 1.5;
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
		.page-heading {
			display: grid;
		}
		.inline-action {
			grid-template-columns: 1fr;
		}
		dl div {
			grid-template-columns: 1fr;
			gap: 0.1rem;
		}
	}
</style>
