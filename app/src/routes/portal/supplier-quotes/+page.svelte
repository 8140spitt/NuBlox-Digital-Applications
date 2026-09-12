<script lang="ts">
	let { data, form } = $props();

	function date(value: Date | string | null | undefined) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
	}

	function money(value: string | null, currency: string) {
		if (value === null) return '—';
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}
</script>

<svelte:head><title>Supplier quotations · NuBlox</title></svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">External portal</p>
		<h1>Supplier quotations</h1>
		<p>Review issued enquiries, price every requested line and submit the commercial return directly to the buyer.</p>
	</div>
	<a class="secondary" href="/portal">Portal home</a>
</section>

<p class="signed-in">Signed in as {data.actor.displayName} · {data.actor.email}</p>
{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}

{#if data.quotes.length === 0}
	<section class="empty">
		<h2>No supplier enquiries are waiting for this email</h2>
		<p>If you were sent an RFQ invitation, open the original invitation link and make sure you sign in with the invited email address.</p>
	</section>
{:else}
	<div class="quote-list">
		{#each data.quotes as quote}
			<article class="quote-card">
				<header>
					<div>
						<p class="reference">{quote.rfqNumber}</p>
						<h2>{quote.title}</h2>
						<p>{quote.issuerName} · {quote.supplierName}</p>
					</div>
					<span class:submitted={quote.status === 'submitted'} class="status">{quote.status}</span>
				</header>
				<div class="metadata">
					<span>Currency · {quote.currencyCode}</span>
					<span>Response due · {date(quote.responseDeadlineAt)}</span>
					{#if quote.submittedAt}<span>Submitted · {date(quote.submittedAt)}</span>{/if}
				</div>

				{#if quote.status === 'submitted'}
					<div class="submitted-summary">
						<p><strong>Supplier reference:</strong> {quote.supplierReference ?? '—'}</p>
						<p><strong>Valid until:</strong> {date(quote.validUntil)}</p>
					</div>
					<div class="line-table" role="table" aria-label={`${quote.rfqNumber} submitted prices`}>
						<div class="line-row head" role="row"><span>Line</span><span>Description</span><span>Qty</span><span>Unit rate</span><span>Lead</span></div>
						{#each quote.lines as line}
							<div class="line-row" role="row">
								<span>{line.lineNumber}</span><span>{line.description}</span><span>{line.offeredQuantity ?? '—'}</span><span>{money(line.unitRate, quote.currencyCode)}</span><span>{line.leadTimeDays === null ? '—' : `${line.leadTimeDays} days`}</span>
							</div>
						{/each}
					</div>
				{:else}
					<form method="POST" action="?/submit" class="quote-form">
						<input type="hidden" name="quoteRef" value={quote.quoteRef} />
						<div class="commercial-header">
							<label>Supplier reference<input name="supplierReference" maxlength="160" /></label>
							<label>Quotation valid until<input name="validUntil" type="date" /></label>
						</div>
						<div class="pricing-lines">
							{#each quote.lines as line}
								<fieldset>
									<legend>Line {line.lineNumber} · {line.description}</legend>
									<p class="request">Requested {line.requestedQuantity} · Required {date(line.requiredByDate)}</p>
									<div class="line-inputs">
										<label>Offered quantity<input name={`offeredQuantity:${line.itemId}`} inputmode="decimal" value={line.requestedQuantity} required /></label>
										<label>Unit rate ({quote.currencyCode})<input name={`unitRate:${line.itemId}`} inputmode="decimal" required /></label>
										<label>Lead time (days)<input name={`leadTimeDays:${line.itemId}`} type="number" min="0" step="1" /></label>
									</div>
									<label>Qualification / note<textarea name={`qualificationNote:${line.itemId}`} rows="2" maxlength="4000"></textarea></label>
								</fieldset>
							{/each}
						</div>
						<div class="submit-row">
							<p>Submitting locks this response as the supplier's returned quotation for this invitation.</p>
							<button type="submit">Submit quotation</button>
						</div>
					</form>
				{/if}
			</article>
		{/each}
	</div>
{/if}

<style>
	:global(body) { background: #f5f5f2; }
	.page-header { display: flex; justify-content: space-between; gap: 2rem; align-items: end; margin-bottom: 1rem; }
	.eyebrow { margin: 0 0 .35rem; text-transform: uppercase; letter-spacing: .1em; font-size: .72rem; font-weight: 800; color: #666; }
	h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.3rem); letter-spacing: -.045em; }
	.page-header p, .signed-in, .quote-card p, .empty p { color: #5d5d57; line-height: 1.5; }
	.secondary { border: 1px solid #aaa; border-radius: .55rem; padding: .65rem .85rem; color: inherit; text-decoration: none; font-weight: 700; }
	.error { padding: .85rem 1rem; border-radius: .55rem; background: #feecec; color: #9b1c1c; }
	.empty, .quote-card { background: white; border: 1px solid #deded7; border-radius: .8rem; padding: 1.25rem; }
	.quote-list { display: grid; gap: 1rem; }
	.quote-card header { display: flex; justify-content: space-between; gap: 1rem; }
	.quote-card h2 { margin: .15rem 0; }
	.reference { margin: 0; font-weight: 800; color: #333 !important; }
	.status { height: fit-content; border-radius: 999px; padding: .35rem .6rem; background: #fff1cc; font-size: .75rem; font-weight: 800; text-transform: capitalize; }
	.status.submitted { background: #e2f3e7; }
	.metadata { display: flex; flex-wrap: wrap; gap: .6rem 1.2rem; margin: 1rem 0; color: #666; font-size: .86rem; }
	.commercial-header, .line-inputs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; }
	.commercial-header { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 1rem; }
	label { display: grid; gap: .35rem; font-weight: 650; }
	input, textarea { width: 100%; box-sizing: border-box; font: inherit; border: 1px solid #b8b8b1; border-radius: .5rem; padding: .65rem .7rem; background: white; }
	.pricing-lines { display: grid; gap: .8rem; }
	fieldset { border: 1px solid #ddd; border-radius: .65rem; padding: 1rem; }
	legend { padding: 0 .35rem; font-weight: 800; }
	.request { margin-top: 0; font-size: .85rem; }
	fieldset > label { margin-top: .8rem; }
	.submit-row { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd; display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
	button { border: 1px solid #111; border-radius: .55rem; padding: .75rem 1rem; background: #111; color: white; font: inherit; font-weight: 800; cursor: pointer; }
	.submitted-summary { display: flex; gap: 2rem; }
	.line-table { display: grid; margin-top: .8rem; border: 1px solid #ddd; border-radius: .55rem; overflow: hidden; }
	.line-row { display: grid; grid-template-columns: 4rem minmax(12rem, 1fr) 7rem 9rem 8rem; gap: .6rem; padding: .65rem .75rem; border-top: 1px solid #eee; }
	.line-row:first-child { border-top: 0; }
	.line-row.head { background: #f4f4ef; font-weight: 800; }
	@media (max-width: 760px) {
		.page-header, .quote-card header, .submit-row { align-items: stretch; flex-direction: column; }
		.commercial-header, .line-inputs { grid-template-columns: 1fr; }
		.line-table { overflow-x: auto; }
		.line-row { min-width: 44rem; }
	}
</style>
