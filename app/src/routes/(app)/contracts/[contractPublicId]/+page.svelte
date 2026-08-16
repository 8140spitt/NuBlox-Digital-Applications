<script lang="ts">
	let { data, form } = $props();
	let executionIso = $state('');

	function currency(value: string) {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: data.contract.currencyCode
		}).format(Number(value));
	}

	function captureExecutionTime(event: Event) {
		const local = (event.currentTarget as HTMLInputElement).value;
		executionIso = local ? new Date(local).toISOString() : '';
	}
</script>

<svelte:head><title>{data.contract.contractNumber} · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/contracts">Contracts</a><span aria-hidden="true">/</span><span>{data.contract.contractNumber}</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">{data.contract.contractTypeName}</p>
		<h1>{data.contract.title}</h1>
		<p>{data.contract.contractNumber} · version {data.version.versionNumber} · {data.contract.currencyCode}</p>
	</div>
	<span class="status">{data.version.versionStatus.replaceAll('_', ' ')}</span>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<div class="grid">
	<div class="stack">
		<section class="panel">
			<p class="eyebrow">Provenance</p><h2>Contract context</h2>
			<dl>
				<div><dt>Project</dt><dd>{#if data.contract.projectPublicId}<a href={`/projects/${data.contract.projectPublicId}`}>{data.contract.projectNumber} · {data.contract.projectName}</a>{:else}—{/if}</dd></div>
				<div><dt>Accepted quotation</dt><dd>{data.contract.sourceQuotationNumber ?? 'No quotation source'}</dd></div>
				<div><dt>Lifecycle</dt><dd>{data.contract.lifecycleStatus.replaceAll('_', ' ')}</dd></div>
				<div><dt>Customer reference</dt><dd>{data.version.customerReference ?? '—'}</dd></div>
			</dl>
		</section>

		<section class="panel">
			<p class="eyebrow">Parties</p><h2>Version parties</h2>
			{#each data.parties as party}
				<article class="line"><span><strong>{party.displayName}</strong><small>{party.roleName}</small></span></article>
			{/each}
		</section>

		<section class="panel">
			<p class="eyebrow">Commercial baseline</p><h2>Value components</h2>
			<div class="lines">
				{#each data.valueComponents as value}
					<article class="line">
						<span><strong>{value.typeName}</strong><small>{value.description ?? 'No description'}</small></span>
						<strong>{currency(value.amount)}</strong>
						{#if data.canManageDraft}
							<form method="POST" action="?/removeValue"><input type="hidden" name="versionNumber" value={data.version.versionNumber}/><input type="hidden" name="sortOrder" value={value.sortOrder}/><button class="quiet" type="submit">Remove</button></form>
						{/if}
					</article>
				{/each}
			</div>
			{#if data.canManageDraft}
				<form class="inline-form" method="POST" action="?/addValue">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber}/>
					<label>Type<select name="typeCode">{#each data.valueComponentTypes as type}<option value={type.code}>{type.name}</option>{/each}</select></label>
					<label>Description<input name="description" maxlength="500"/></label>
					<label>Amount<input name="amount" inputmode="decimal" value="0.0000" required/></label>
					<button type="submit">Add value</button>
				</form>
			{/if}
		</section>

		<section class="panel">
			<p class="eyebrow">Programme</p><h2>Key dates</h2>
			<div class="lines">
				{#each data.keyDates as date}
					<article class="line">
						<span><strong>{date.label ?? date.typeName}</strong><small>{date.typeName}</small></span>
						<strong>{new Date(date.dateValue).toLocaleDateString()}</strong>
						{#if data.canManageDraft}
							<form method="POST" action="?/removeKeyDate"><input type="hidden" name="versionNumber" value={data.version.versionNumber}/><input type="hidden" name="sortOrder" value={date.sortOrder}/><button class="quiet" type="submit">Remove</button></form>
						{/if}
					</article>
				{/each}
			</div>
			{#if data.canManageDraft}
				<form class="inline-form" method="POST" action="?/addKeyDate">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber}/>
					<label>Type<select name="typeCode">{#each data.keyDateTypes as type}<option value={type.code}>{type.name}</option>{/each}</select></label>
					<label>Label<input name="label" maxlength="200"/></label>
					<label>Date<input type="date" name="dateValue" required/></label>
					<button type="submit">Add date</button>
				</form>
			{/if}
		</section>
	</div>

	<aside class="stack">
		{#if data.canManageDraft}
			<section class="panel">
				<p class="eyebrow">Draft</p><h2>Version details</h2>
				<form method="POST" action="?/updateDraft">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber}/>
					<label>Title<input name="title" maxlength="255" value={data.version.title} required/></label>
					<label>Customer reference<input name="customerReference" maxlength="160" value={data.version.customerReference ?? ''}/></label>
					<button type="submit">Save draft</button>
				</form>
			</section>
		{/if}

		{#if data.canIssue}
			<section class="panel action-panel">
				<p class="eyebrow">Issue</p><h2>Lock and issue version {data.version.versionNumber}</h2>
				<p class="muted">Issue makes this version immutable through ordinary draft APIs.</p>
				<form method="POST" action="?/issue">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber}/>
					<label>Delivery channel<select name="deliveryChannel"><option value="manual">Manual</option><option value="email">Email evidence only</option><option value="portal">Portal evidence</option><option value="esign">E-sign evidence</option><option value="api">API evidence</option><option value="other">Other</option></select></label>
					<label>Recipient name<input name="recipientName" maxlength="255" value={data.parties[0]?.displayName ?? ''} required/></label>
					<label>Recipient email<input type="email" name="recipientEmail" maxlength="320"/></label>
					<label>Note<textarea name="note" rows="3" maxlength="1000"></textarea></label>
					<button type="submit">Issue contract</button>
				</form>
			</section>
		{/if}

		{#if data.issueEvents.length > 0}
			<section class="panel">
				<p class="eyebrow">Issue evidence</p><h2>Issued</h2>
				{#each data.issueEvents as issue}
					<dl><div><dt>When</dt><dd>{new Date(issue.issuedAt).toLocaleString()}</dd></div><div><dt>Channel</dt><dd>{issue.deliveryChannel}</dd></div><div><dt>Recipient</dt><dd>{issue.recipientName ?? issue.recipientEmail ?? 'Recorded recipient'}</dd></div></dl>
				{/each}
			</section>
		{/if}

		{#if data.canExecute}
			<section class="panel action-panel">
				<p class="eyebrow">Execution</p><h2>Record executed agreement</h2>
				<p class="muted">This records execution evidence only. It does not automatically activate the project or create invoices.</p>
				<form method="POST" action="?/execute">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber}/>
					<input type="hidden" name="executedAt" value={executionIso}/>
					<label>Method<select name="executionMethod"><option value="manual">Manual</option><option value="esign">E-sign</option><option value="portal">Portal</option><option value="api">API</option><option value="other">Other</option></select></label>
					<label>Executed at<input type="datetime-local" required oninput={captureExecutionTime}/></label>
					<label>Signatory name<input name="signatoryName" maxlength="255" required/></label>
					<label>Signatory email<input type="email" name="signatoryEmail" maxlength="320"/></label>
					<label>Signing role<input name="signingRole" maxlength="160"/></label>
					<label>External transaction reference<input name="externalTransactionReference" maxlength="255"/></label>
					<label>Note<textarea name="note" rows="3" maxlength="1000"></textarea></label>
					<button type="submit">Record execution</button>
				</form>
			</section>
		{/if}

		{#if data.execution}
			<section class="panel success">
				<p class="eyebrow">Executed</p><h2>{new Date(data.execution.executedAt).toLocaleString()}</h2>
				<p>{data.execution.executionMethod}</p>
				{#each data.execution.signatories as signatory}<p><strong>{signatory.signatoryName}</strong>{#if signatory.signingRole} · {signatory.signingRole}{/if}</p>{/each}
				<p class="muted">The contract is active. Project lifecycle remains independently controlled.</p>
			</section>
		{/if}
	</aside>
</div>

<style>
	.breadcrumbs{display:flex;gap:.55rem;align-items:center;margin-bottom:1rem;color:#666;font-size:.9rem}.breadcrumbs a{color:inherit;font-weight:650}.page-heading{display:flex;justify-content:space-between;gap:1rem;align-items:start;margin-bottom:1rem}.page-heading h1{margin:.15rem 0 .3rem;font-size:clamp(2rem,5vw,2.8rem);letter-spacing:-.04em}.page-heading p{margin:0;color:#666}.eyebrow{margin:0;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;font-weight:760;color:#666}.status{padding:.3rem .55rem;border-radius:999px;background:#e4f5e8;color:#285f35;font-size:.76rem;font-weight:760;text-transform:capitalize}.grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(20rem,.7fr);gap:1rem;align-items:start}.stack{display:grid;gap:1rem}.panel{background:white;border:1px solid #d9d9d2;border-radius:.8rem;padding:1.1rem}.panel h2{margin:.3rem 0 .8rem}.action-panel{border-color:#b9cbe6}.success{border-color:#b9d7bf}.muted{color:#666;line-height:1.5}dl{display:grid;gap:.55rem;margin:.7rem 0}dl div{display:grid;grid-template-columns:8rem 1fr;gap:.6rem}dt{color:#666;font-size:.82rem}dd{margin:0}.lines{display:grid;gap:.45rem}.line{display:flex;gap:.8rem;align-items:center;justify-content:space-between;padding:.65rem;border:1px solid #e3e3dd;border-radius:.5rem}.line span{display:grid;gap:.1rem;min-width:0}.line small{color:#666}.inline-form,form{display:grid;gap:.7rem}.inline-form{margin-top:1rem;padding-top:1rem;border-top:1px solid #ecece7;grid-template-columns:1fr 1.2fr .7fr auto;align-items:end}label{display:grid;gap:.3rem;font-weight:650}input,select,textarea{width:100%;box-sizing:border-box;padding:.58rem;border:1px solid #c9c9c2;border-radius:.45rem;background:white;font:inherit}button{width:max-content;padding:.6rem .78rem;border:0;border-radius:.46rem;background:#111;color:white;font:inherit;font-weight:750;cursor:pointer}.quiet{background:transparent;color:#7a3027;padding:.25rem;text-decoration:underline}.error{color:#8a3025}.banner{padding:.7rem .8rem;background:#fff0ed;border:1px solid #e1b1aa;border-radius:.5rem}@media(max-width:950px){.grid{grid-template-columns:1fr}.inline-form{grid-template-columns:1fr}.page-heading{display:grid}.line{align-items:start;flex-wrap:wrap}dl div{grid-template-columns:1fr;gap:.15rem}}
</style>
