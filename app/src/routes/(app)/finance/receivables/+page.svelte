<script lang="ts">
	let { data } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function date(value: string) {
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00.000Z`));
	}
</script>

<svelte:head><title>Receivables · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Accounts receivable</p>
		<h1>Aged receivables</h1>
		<p>Derived customer account positions as at {date(data.asOf)}. Currency positions remain separate and are never aggregated across currencies.</p>
	</div>
	<div class="heading-actions">
		<a class="button secondary" href="/finance/invoices">Invoices</a>
		<a class="button secondary" href="/finance/payments">Payments</a>
	</div>
</section>

{#if data.totals.length === 0}
	<section class="panel"><p class="muted">No issued receivable history is available.</p></section>
{:else}
	<section class="summary-grid" aria-label="Receivables totals">
		{#each data.totals as total}
			<article class="summary-card">
				<div class="summary-heading"><div><p class="eyebrow">{total.currencyCode}</p><h2>{money(total.totalOutstanding, total.currencyCode)}</h2></div><span>{total.openInvoiceCount} open</span></div>
				<div class="bucket-grid">
					{#each total.buckets as bucket}
						<div><span>{bucket.label}</span><strong>{money(bucket.amount, total.currencyCode)}</strong><small>{bucket.invoiceCount} invoice{bucket.invoiceCount === 1 ? '' : 's'}</small></div>
					{/each}
				</div>
			</article>
		{/each}
	</section>
{/if}

<section class="panel">
	<div class="section-heading">
		<div><p class="eyebrow">Customer accounts</p><h2>Receivable positions</h2><p class="muted">Open balances include issued invoices less issued credit notes and active payment allocations.</p></div>
		<span>{data.accounts.length}</span>
	</div>
	{#if data.accounts.length === 0}
		<p class="muted">No customer receivable accounts are available.</p>
	{:else}
		<div class="account-list">
			{#each data.accounts as account}
				<article class="account-card">
					<div class="account-heading">
						<div><h3>{account.customerDisplayName}</h3><p>{account.customerAccountReference ?? 'No customer account reference'}</p></div>
						<a class="button secondary" href={`/finance/receivables/${account.customerPartyPublicId}`}>Open statement</a>
					</div>
					<div class="position-list">
						{#each account.positions as position}
							<div class="position-row">
								<div><strong>{position.currencyCode} · {money(position.totalOutstanding, position.currencyCode)}</strong><small>{position.openInvoiceCount} open of {position.issuedInvoiceCount} issued invoices</small></div>
								<div class="bucket-inline">
									{#each position.buckets as bucket}<span><small>{bucket.label}</small><strong>{money(bucket.amount, position.currencyCode)}</strong></span>{/each}
								</div>
							</div>
						{/each}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page-heading,.section-heading,.summary-heading,.account-heading,.position-row{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1.2rem}.page-heading h1,.panel h2,.summary-card h2{margin:.15rem 0}.heading-actions{display:flex;gap:.55rem;flex-wrap:wrap}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--muted,#667085);margin:0}.summary-grid{display:grid;gap:1rem;margin-bottom:1rem}.summary-card,.panel{border:1px solid var(--border,#d0d5dd);border-radius:14px;background:var(--surface,#fff);padding:1rem}.summary-heading>span,.section-heading>span{font-size:.8rem;border:1px solid var(--border,#d0d5dd);border-radius:999px;padding:.3rem .55rem}.bucket-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.55rem;margin-top:.9rem}.bucket-grid div{padding:.65rem;border-radius:9px;background:var(--surface-subtle,#f8fafc)}.bucket-grid span,.bucket-grid small,.position-row small,.account-heading p{display:block;color:var(--muted,#667085);font-size:.76rem}.bucket-grid strong{display:block;margin:.18rem 0}.account-list,.position-list{display:grid;gap:.75rem;margin-top:.9rem}.account-card{border:1px solid var(--border,#e4e7ec);border-radius:11px;padding:.9rem}.account-heading h3{margin:0}.account-heading p{margin:.22rem 0 0}.position-row{padding:.7rem;border-radius:9px;background:var(--surface-subtle,#f8fafc);align-items:center}.bucket-inline{display:grid;grid-template-columns:repeat(5,minmax(85px,1fr));gap:.45rem;text-align:right}.bucket-inline span{display:block}.bucket-inline strong{display:block;font-size:.82rem}.muted{color:var(--muted,#667085)}.button{font:inherit;font-weight:700;padding:.65rem .85rem;border-radius:9px;border:0;background:#1d2939;color:white;text-decoration:none}.secondary{background:transparent;color:inherit;border:1px solid var(--border,#d0d5dd)}@media(min-width:1050px){.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:850px){.bucket-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.position-row{display:grid}.bucket-inline{grid-template-columns:repeat(2,minmax(0,1fr));text-align:left}}@media(max-width:650px){.page-heading,.account-heading{display:grid}.bucket-grid,.bucket-inline{grid-template-columns:1fr}}
</style>
