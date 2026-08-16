<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Billing settings · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/finance/invoices">Finance</a><span>/</span><span>Billing settings</span></nav>

<section class="page-heading">
	<div><p class="eyebrow">Accounts receivable</p><h1>Billing settings</h1><p>Payment terms and customer-specific defaults used when preparing invoices.</p></div>
	<a class="button secondary" href="/finance/invoices">Invoices</a>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<div class="layout">
	<section class="panel">
		<div class="section-heading"><div><p class="eyebrow">Terms</p><h2>Payment terms</h2></div><span>{data.paymentTerms.length}</span></div>
		{#if data.paymentTerms.length === 0}<p class="muted">No payment terms have been configured yet.</p>{:else}
			<div class="rows">{#each data.paymentTerms as term}<article class="row"><div><strong>{term.name}</strong><small>{term.calculationBasis.replaceAll('_', ' ')} · {term.daysOffset} day offset</small></div><span>{term.isDefault ? 'Default' : term.isActive ? 'Active' : 'Inactive'}</span></article>{/each}</div>
		{/if}
		{#if data.canManage}
			<form method="POST" action="?/createTerm" class="form-grid term-form">
				<label>Name<input name="name" maxlength="160" placeholder="Net 30" required/></label>
				<label>Calculation<select name="calculationBasis" required><option value="invoice_date">Invoice date + days</option><option value="end_of_month">End of month + days</option><option value="manual">Manual due date</option></select></label>
				<label>Days offset<input name="daysOffset" type="number" min="0" max="65535" value="30" required/></label>
				<label class="checkbox"><input name="isDefault" type="checkbox"/> Make default</label>
				<button type="submit">Add payment term</button>
			</form>
		{/if}
	</section>

	<section class="panel wide-panel">
		<div class="section-heading"><div><p class="eyebrow">Customers</p><h2>Customer billing defaults</h2></div><span>{data.parties.length}</span></div>
		<p class="muted">Defaults help prepare a draft. The issued invoice snapshots the actual values and customer evidence.</p>
		<div class="customer-grid">
			{#each data.parties as party}
				<article class="customer-card">
					<div class="card-heading"><div><strong>{party.displayName}</strong><small>{party.partyKind}</small></div>{#if party.purchaseOrderRequired}<span>PO required</span>{/if}</div>
					{#if data.canManage}
						<form method="POST" action="?/updateParty" class="form-grid compact">
							<input type="hidden" name="partyPublicId" value={party.partyPublicId}/>
							<label>Default term<select name="defaultPaymentTermPublicId"><option value="">None</option>{#each data.paymentTerms.filter((term) => term.isActive) as term}<option value={term.publicId} selected={term.publicId === party.defaultPaymentTermPublicId}>{term.name}</option>{/each}</select></label>
							<label>Currency<input name="defaultCurrencyCode" maxlength="3" value={party.defaultCurrencyCode ?? ''} placeholder="GBP"/></label>
							<label>Account reference<input name="customerAccountReference" maxlength="120" value={party.customerAccountReference ?? ''}/></label>
							<label class="checkbox"><input name="purchaseOrderRequired" type="checkbox" checked={party.purchaseOrderRequired}/> Require customer PO/reference</label>
							<button type="submit">Save defaults</button>
						</form>
					{:else}
						<dl><div><dt>Payment term</dt><dd>{party.defaultPaymentTermName ?? 'None'}</dd></div><div><dt>Currency</dt><dd>{party.defaultCurrencyCode ?? 'Not set'}</dd></div><div><dt>Account reference</dt><dd>{party.customerAccountReference ?? 'Not set'}</dd></div></dl>
					{/if}
				</article>
			{/each}
		</div>
	</section>
</div>

<style>
	.breadcrumbs{display:flex;gap:.55rem;align-items:center;color:var(--muted,#667085);font-size:.9rem;margin-bottom:1rem}.breadcrumbs a{color:inherit}.page-heading,.section-heading,.card-heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1.25rem}.page-heading h1,.panel h2{margin:.15rem 0}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--muted,#667085);margin:0}.layout{display:grid;gap:1rem}.panel,.customer-card{border:1px solid var(--border,#d0d5dd);border-radius:14px;background:var(--surface,#fff);padding:1rem}.rows{display:grid;gap:.55rem;margin:.8rem 0}.row{display:flex;justify-content:space-between;gap:1rem;padding:.7rem;border-radius:10px;background:var(--surface-subtle,#f8fafc)}.row small,.card-heading small{display:block;color:var(--muted,#667085);margin-top:.2rem}.customer-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:.8rem;margin-top:1rem}.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.7rem;align-items:end;margin-top:1rem}.form-grid label{display:grid;gap:.3rem;font-size:.86rem;font-weight:600}.form-grid input,.form-grid select{font:inherit;padding:.62rem;border:1px solid var(--border,#d0d5dd);border-radius:8px;background:transparent}.checkbox{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center!important}.checkbox input{width:auto}.compact{grid-template-columns:1fr 90px}.compact label:nth-of-type(3),.compact .checkbox,.compact button{grid-column:1/-1}button,.button{font:inherit;font-weight:700;padding:.65rem .85rem;border-radius:9px;border:0;background:#1d2939;color:white;text-decoration:none;cursor:pointer}.secondary{background:transparent;color:inherit;border:1px solid var(--border,#d0d5dd)}.muted{color:var(--muted,#667085)}.banner{padding:.75rem 1rem;border-radius:9px}.error{color:#b42318;background:#fef3f2}dl{margin:.7rem 0 0}dl div{display:flex;justify-content:space-between;gap:1rem;padding:.35rem 0}dt{color:var(--muted,#667085)}dd{margin:0;text-align:right}@media(min-width:1000px){.layout{grid-template-columns:minmax(280px,.7fr) minmax(0,1.5fr)}.wide-panel{min-width:0}}
</style>
