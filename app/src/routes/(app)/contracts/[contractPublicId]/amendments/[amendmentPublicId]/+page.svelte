<script lang="ts">
	let { data, form } = $props();

	function currency(value: string) {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: data.contract.currencyCode
		}).format(Number(value));
	}

	function dateInput(value: Date | null) {
		return value ? new Date(value).toISOString().slice(0, 10) : '';
	}
</script>

<svelte:head><title>{data.amendment.amendmentNumber} · {data.contract.contractNumber} · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/contracts">Contracts</a><span aria-hidden="true">/</span>
	<a href={`/contracts/${data.contract.publicId}`}>{data.contract.contractNumber}</a><span aria-hidden="true">/</span>
	<span>{data.amendment.amendmentNumber}</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">{data.amendment.typeName}</p>
		<h1>{data.amendment.title}</h1>
		<p>{data.amendment.amendmentNumber} · {data.contract.contractNumber}</p>
	</div>
	<span class={`status status-${data.amendment.lifecycleStatus}`}>{data.amendment.lifecycleStatus}</span>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="metrics">
	<div><span>Executed baseline</span><strong>{currency(data.baselineValue)}</strong></div>
	<div><span>Agreed adjustments</span><strong>{currency(data.agreedAdjustmentTotal)}</strong></div>
	<div><span>Current contract value</span><strong>{currency(data.currentContractValue)}</strong></div>
</section>

<div class="grid">
	<div class="stack">
		<section class="panel">
			<p class="eyebrow">Amendment</p><h2>Change details</h2>
			{#if data.canManageDraft}
				<form method="POST" action="?/updateDraft" class="form-grid">
					<label>Type<select name="typeCode" required>{#each data.amendmentTypes as type}<option value={type.code} selected={type.code === data.amendment.typeCode}>{type.name}</option>{/each}</select></label>
					<label class="wide">Title<input name="title" maxlength="255" value={data.amendment.title} required/></label>
					<label>Effective date<input name="effectiveOn" type="date" value={dateInput(data.amendment.effectiveOn)} required/></label>
					<label class="wide">Description<textarea name="description" rows="6" maxlength="16000">{data.amendment.description ?? ''}</textarea></label>
					<button type="submit">Save amendment draft</button>
				</form>
			{:else}
				<dl>
					<div><dt>Type</dt><dd>{data.amendment.typeName}</dd></div>
					<div><dt>Effective date</dt><dd>{data.amendment.effectiveOn ? new Date(data.amendment.effectiveOn).toLocaleDateString() : 'Not set'}</dd></div>
				</dl>
				<p>{data.amendment.description ?? 'No descriptive change narrative recorded.'}</p>
			{/if}
		</section>

		<section class="panel">
			<div class="section-heading"><div><p class="eyebrow">Commercial change</p><h2>Value adjustments</h2></div><span>{data.valueAdjustments.length}</span></div>
			{#if data.valueAdjustments.length === 0}<p class="muted">No value adjustment.</p>{:else}
				<div class="lines">{#each data.valueAdjustments as adjustment}
					<article class="line">
						<span><strong>{adjustment.typeName}</strong><small>{adjustment.description ?? 'No description'}</small></span>
						<strong>{currency(adjustment.adjustmentAmount)}</strong>
						{#if data.canManageDraft}<form method="POST" action="?/removeValue"><input type="hidden" name="sortOrder" value={adjustment.sortOrder}/><button class="quiet" type="submit">Remove</button></form>{/if}
					</article>
				{/each}</div>
			{/if}
			{#if data.canManageDraft}
				<form method="POST" action="?/addValue" class="inline-form">
					<label>Type<select name="typeCode" required>{#each data.valueComponentTypes as type}<option value={type.code}>{type.name}</option>{/each}</select></label>
					<label>Description<input name="description" maxlength="500"/></label>
					<label>Signed adjustment<input name="adjustmentAmount" inputmode="decimal" placeholder="250.0000 or -250.0000" required/></label>
					<button type="submit">Add adjustment</button>
				</form>
			{/if}
		</section>

		<section class="panel">
			<div class="section-heading"><div><p class="eyebrow">Programme change</p><h2>Key-date changes</h2></div><span>{data.keyDateChanges.length}</span></div>
			{#if data.keyDateChanges.length === 0}<p class="muted">No key-date change.</p>{:else}
				<div class="lines">{#each data.keyDateChanges as change}
					<article class="line">
						<span><strong>{change.label ?? change.typeName}</strong><small>{change.typeName}</small></span>
						<strong>{new Date(change.newDate).toLocaleDateString()}</strong>
						{#if data.canManageDraft}<form method="POST" action="?/removeKeyDate"><input type="hidden" name="sortOrder" value={change.sortOrder}/><button class="quiet" type="submit">Remove</button></form>{/if}
					</article>
				{/each}</div>
			{/if}
			{#if data.canManageDraft}
				<form method="POST" action="?/addKeyDate" class="inline-form">
					<label>Type<select name="typeCode" required>{#each data.keyDateTypes as type}<option value={type.code}>{type.name}</option>{/each}</select></label>
					<label>Label<input name="label" maxlength="200"/></label>
					<label>New date<input name="newDate" type="date" required/></label>
					<button type="submit">Add date change</button>
				</form>
			{/if}
		</section>
	</div>

	<aside class="stack">
		<section class="panel">
			<p class="eyebrow">Lifecycle evidence</p><h2>Status</h2>
			<dl>
				<div><dt>Status</dt><dd>{data.amendment.lifecycleStatus}</dd></div>
				<div><dt>Effective</dt><dd>{data.amendment.effectiveOn ? new Date(data.amendment.effectiveOn).toLocaleDateString() : 'Not set'}</dd></div>
				<div><dt>Issued</dt><dd>{data.amendment.issuedAt ? new Date(data.amendment.issuedAt).toLocaleString() : 'Not issued'}</dd></div>
				<div><dt>Decision</dt><dd>{data.amendment.decidedAt ? new Date(data.amendment.decidedAt).toLocaleString() : 'No decision'}</dd></div>
			</dl>
		</section>

		{#if data.canIssue}
			<section class="panel action-panel">
				<p class="eyebrow">Issue</p><h2>Freeze amendment</h2>
				<p class="muted">Issue makes the amendment immutable. Set the effective date and confirm the change narrative/value/date content first.</p>
				<form method="POST" action="?/issue"><button type="submit">Issue amendment</button></form>
			</section>
		{/if}

		{#if data.canDecide}
			<section class="panel action-panel">
				<p class="eyebrow">Decision</p><h2>Record customer/contract decision</h2>
				<p class="muted">Agreement makes the amendment part of the current contractual position. Rejection preserves the issued amendment as rejected evidence.</p>
				<div class="decision-actions">
					<form method="POST" action="?/agree"><button type="submit">Agree amendment</button></form>
					<form method="POST" action="?/reject"><button class="secondary" type="submit">Reject amendment</button></form>
				</div>
			</section>
		{/if}

		{#if data.canWithdraw}
			<section class="panel danger-panel">
				<p class="eyebrow">Withdraw</p><h2>Stop this amendment</h2>
				<p class="muted">Withdrawal does not delete the amendment or its evidence.</p>
				<form method="POST" action="?/withdraw"><button class="danger" type="submit">Withdraw amendment</button></form>
			</section>
		{/if}

		{#if data.amendment.lifecycleStatus === 'agreed'}
			<section class="panel success"><p class="eyebrow">Agreed</p><h2>Current contractual position updated</h2><p class="muted">Only agreed value adjustments are included in the current contract value shown above.</p></section>
		{:else if data.amendment.lifecycleStatus === 'rejected' || data.amendment.lifecycleStatus === 'withdrawn'}
			<section class="panel"><p class="eyebrow">Closed</p><h2>{data.amendment.lifecycleStatus === 'rejected' ? 'Rejected amendment' : 'Withdrawn amendment'}</h2><p class="muted">This record remains preserved as contract history and does not alter current contract value.</p></section>
		{/if}
	</aside>
</div>

<style>
	.breadcrumbs{display:flex;gap:.55rem;align-items:center;margin-bottom:1rem;color:#666;font-size:.9rem}.breadcrumbs a{color:inherit;font-weight:650}.page-heading{display:flex;justify-content:space-between;gap:1rem;align-items:start;margin-bottom:1rem}.page-heading h1{margin:.15rem 0 .3rem;font-size:clamp(2rem,5vw,2.8rem);letter-spacing:-.04em}.page-heading p{margin:0;color:#666}.eyebrow{margin:0;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;font-weight:760;color:#666}.status{padding:.3rem .55rem;border-radius:999px;background:#ecece7;font-size:.76rem;font-weight:760;text-transform:capitalize}.status-draft{background:#e7efff;color:#234b85}.status-issued{background:#eee8ff;color:#54428b}.status-agreed{background:#e4f5e8;color:#285f35}.status-rejected,.status-withdrawn{background:#f1ece9;color:#76544a}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem;margin-bottom:1rem}.metrics div{display:grid;gap:.2rem;padding:.8rem;background:white;border:1px solid #d9d9d2;border-radius:.65rem}.metrics span{font-size:.75rem;color:#666;text-transform:uppercase;letter-spacing:.06em}.grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(20rem,.7fr);gap:1rem;align-items:start}.stack{display:grid;gap:1rem}.panel{background:white;border:1px solid #d9d9d2;border-radius:.8rem;padding:1.1rem}.panel h2{margin:.3rem 0 .8rem}.action-panel{border-color:#b9cbe6}.danger-panel{border-color:#dfc1bb}.success{border-color:#b9d7bf}.muted{color:#666;line-height:1.5}.section-heading{display:flex;justify-content:space-between;gap:1rem;align-items:end}.section-heading>span{color:#666}.form-grid,form{display:grid;gap:.7rem}.form-grid{grid-template-columns:1fr 1fr}.wide{grid-column:1/-1}.lines{display:grid;gap:.45rem;margin-top:.7rem}.line{display:flex;gap:.8rem;align-items:center;justify-content:space-between;padding:.65rem;border:1px solid #e3e3dd;border-radius:.5rem}.line span{display:grid;gap:.1rem}.line small{color:#666}.inline-form{margin-top:1rem;padding-top:1rem;border-top:1px solid #ecece7;grid-template-columns:1fr 1.2fr 1fr auto;align-items:end}dl{display:grid;gap:.55rem;margin:.7rem 0}dl div{display:grid;grid-template-columns:7rem 1fr;gap:.6rem}dt{color:#666;font-size:.82rem}dd{margin:0}label{display:grid;gap:.3rem;font-weight:650}input,select,textarea{width:100%;box-sizing:border-box;padding:.58rem;border:1px solid #c9c9c2;border-radius:.45rem;background:white;font:inherit}button{width:max-content;padding:.6rem .78rem;border:0;border-radius:.46rem;background:#111;color:white;font:inherit;font-weight:750;cursor:pointer}.secondary{background:#555}.danger{background:#7a3027}.quiet{background:transparent;color:#7a3027;padding:.25rem;text-decoration:underline}.decision-actions{display:flex;gap:.6rem;flex-wrap:wrap}.error{color:#8a3025}.banner{padding:.7rem .8rem;background:#fff0ed;border:1px solid #e1b1aa;border-radius:.5rem}@media(max-width:950px){.grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr}.inline-form,.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.page-heading{display:grid}.line{align-items:start;flex-wrap:wrap}dl div{grid-template-columns:1fr;gap:.15rem}}
</style>
