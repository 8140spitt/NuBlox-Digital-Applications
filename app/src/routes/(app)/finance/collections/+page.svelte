<script lang="ts">
	let { data } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}

	function overdueAmount(position: (typeof data.accounts)[number]['overduePositions'][number]) {
		return position.invoices.reduce((total, invoice) => total + Number(invoice.outstandingAmount), 0).toFixed(4);
	}
</script>

<svelte:head><title>Collections · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Accounts receivable</p>
		<h1>Collections</h1>
		<p>Work overdue customer accounts without changing the invoice, credit-note or payment ledger.</p>
	</div>
	<div class="heading-actions">
		<a class="button secondary" href="/finance/receivables">Aged receivables</a>
		<a class="button secondary" href="/finance/payments">Payments</a>
	</div>
</section>

<section class="panel">
	<div class="section-heading">
		<div><p class="eyebrow">As at {data.asOf}</p><h2>Overdue customer accounts</h2><p class="muted">Only invoices with positive outstanding value past their due date enter this queue.</p></div>
		<span>{data.accounts.length}</span>
	</div>

	{#if data.accounts.length === 0}
		<p class="muted">No overdue customer accounts require collection review.</p>
	{:else}
		<div class="account-list">
			{#each data.accounts as account}
				<a class="account-row" href={`/finance/collections/${account.customerPartyPublicId}`}>
					<div>
						<strong>{account.customerDisplayName}</strong>
						<small>{account.customerAccountReference ?? 'No account reference'}</small>
					</div>
					<div class="currency-list">
						{#each account.overduePositions as position}
							<span><strong>{money(overdueAmount(position), position.currencyCode)}</strong><small>{position.invoices.length} overdue invoice{position.invoices.length === 1 ? '' : 's'}</small></span>
						{/each}
					</div>
					<span class={`status ${account.activeCase ? `status-${account.activeCase.status}` : 'status-new'}`}>{account.activeCase?.status ?? 'not started'}</span>
				</a>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page-heading,.section-heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1.2rem}.page-heading h1,.panel h2{margin:.15rem 0}.heading-actions{display:flex;gap:.55rem;flex-wrap:wrap}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--muted,#667085);margin:0}.panel{border:1px solid var(--border,#d0d5dd);border-radius:14px;background:var(--surface,#fff);padding:1rem;margin-bottom:1rem}.account-list{display:grid;gap:.7rem;margin-top:.9rem}.account-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto;gap:1rem;align-items:center;padding:.9rem;border:1px solid var(--border,#e4e7ec);border-radius:11px;text-decoration:none;color:inherit}.account-row:hover{background:var(--surface-subtle,#f8fafc)}small{display:block;color:var(--muted,#667085);margin-top:.2rem}.currency-list{display:flex;gap:.8rem;flex-wrap:wrap;text-align:right;justify-content:flex-end}.status{font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;border:1px solid var(--border,#d0d5dd);border-radius:999px;padding:.3rem .55rem;white-space:nowrap}.status-open{background:#ecfdf3;color:#027a48;border-color:#abefc6}.status-paused{background:#fffaeb;color:#b54708;border-color:#fedf89}.status-new{background:#f2f4f7;color:#344054}.muted{color:var(--muted,#667085)}.button{font:inherit;font-weight:700;padding:.65rem .85rem;border-radius:9px;text-decoration:none}.secondary{background:transparent;color:inherit;border:1px solid var(--border,#d0d5dd)}@media(max-width:700px){.page-heading{display:grid}.account-row{grid-template-columns:1fr}.currency-list{text-align:left;justify-content:flex-start}}
</style>
