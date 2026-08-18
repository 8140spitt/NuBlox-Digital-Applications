<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}
</script>

<svelte:head><title>Invoices · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Accounts receivable</p>
		<h1>Invoices</h1>
		<p>Controlled customer invoices anchored to executed contracts.</p>
	</div>
	<a class="button secondary" href="/finance/billing">Billing settings</a>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

{#if data.canCreate}
	<section class="panel create-panel">
		<div>
			<p class="eyebrow">New invoice</p>
			<h2>Create from executed contract</h2>
			<p class="muted">
				The draft inherits customer, contract, project and currency context. No legal invoice number
				is allocated until issue.
			</p>
		</div>
		{#if data.eligibleContracts.length === 0}<p class="muted">
				No active executed contracts are currently eligible.
			</p>{:else}
			<form method="POST" action="?/create" class="create-form">
				<label
					>Contract<select name="contractPublicId" required
						>{#each data.eligibleContracts as contract}<option value={contract.contractPublicId}
								>{contract.contractNumber} · {contract.customerDisplayName} · {money(
									contract.currentContractValue,
									contract.currencyCode
								)}</option
							>{/each}</select
					></label
				>
				<label
					>Invoice type<select name="invoiceType"
						><option value="standard">Standard</option><option value="deposit">Deposit</option
						><option value="interim">Interim</option><option value="final">Final</option><option
							value="retention">Retention</option
						><option value="other">Other</option></select
					></label
				>
				<button type="submit">Create draft invoice</button>
			</form>
		{/if}
	</section>
{/if}

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Portfolio</p>
			<h2>Customer invoices</h2>
		</div>
		<span>{data.invoices.length}</span>
	</div>
	{#if data.invoices.length === 0}
		<p class="muted">No invoices have been created.</p>
	{:else}
		<div class="invoice-list">
			{#each data.invoices as invoice}
				<a class="invoice-row" href={`/finance/invoices/${invoice.publicId}`}>
					<div>
						<strong>{invoice.documentNumber ?? 'Draft invoice'}</strong><small
							>{invoice.customerDisplayName}{invoice.contractNumber
								? ` · ${invoice.contractNumber}`
								: ''}</small
						>
					</div>
					<div class="amount">
						<strong>{money(invoice.grossTotal, invoice.currencyCode)}</strong><small
							>{money(invoice.netTotal, invoice.currencyCode)} net · {money(
								invoice.taxTotal,
								invoice.currencyCode
							)} tax</small
						>
					</div>
					<span class={`status status-${invoice.lifecycleStatus}`}>{invoice.lifecycleStatus}</span>
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
	.create-panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
	}
	.create-form {
		display: grid;
		gap: 0.7rem;
		align-items: end;
	}
	.create-form label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.86rem;
		font-weight: 600;
	}
	.create-form select {
		font: inherit;
		padding: 0.65rem;
		border: 1px solid var(--border, #d0d5dd);
		border-radius: 8px;
		background: transparent;
	}
	.invoice-list {
		display: grid;
		gap: 0.6rem;
		margin-top: 0.9rem;
	}
	.invoice-row {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr) auto;
		gap: 1rem;
		align-items: center;
		padding: 0.85rem;
		border: 1px solid var(--border, #e4e7ec);
		border-radius: 11px;
		color: inherit;
		text-decoration: none;
	}
	.invoice-row:hover {
		background: var(--surface-subtle, #f8fafc);
	}
	.invoice-row small {
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
	.status-issued {
		background: #ecfdf3;
		color: #027a48;
		border-color: #abefc6;
	}
	.status-draft {
		background: #f2f4f7;
		color: #344054;
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
	@media (min-width: 900px) {
		.create-panel {
			grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
		}
		.create-form {
			grid-template-columns: minmax(240px, 1fr) 150px auto;
		}
	}
	@media (max-width: 650px) {
		.invoice-row {
			grid-template-columns: 1fr;
		}
		.amount {
			text-align: left;
		}
	}
</style>
