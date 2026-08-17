<script lang="ts">
	let { data, form } = $props();
	let quote = $derived(data.commercial.quotation);
	let version = $derived(data.commercial.version);
</script>

<svelte:head><title>Convert {quote.quotationNumber} · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/commercial/quotations">Quotations</a><span aria-hidden="true">/</span>
	<a href={`/commercial/quotations/${quote.publicId}`}>{quote.quotationNumber}</a><span aria-hidden="true">/</span>
	<span>Convert to project</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Accepted quotation → project</p>
		<h1>{version.title}</h1>
		<p>{quote.customerDisplayName} · {quote.quotationNumber} · version {version.versionNumber}</p>
	</div>
	<span class="status">{data.project ? 'Converted' : data.acceptedResponse ? 'Accepted' : 'Not accepted'}</span>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<div class="grid">
	<section class="panel">
		<p class="eyebrow">Conversion source</p>
		<h2>Accepted commercial evidence</h2>
		<dl>
			<div><dt>Quotation</dt><dd>{quote.quotationNumber}</dd></div>
			<div><dt>Version</dt><dd>{version.versionNumber} · {version.versionStatus}</dd></div>
			<div><dt>Customer</dt><dd>{quote.customerDisplayName}</dd></div>
			<div><dt>Opportunity</dt><dd>{quote.opportunityTitle ?? 'No linked opportunity'}</dd></div>
			<div><dt>Accepted response</dt><dd>{data.acceptedResponse ? new Date(data.acceptedResponse.respondedAt).toLocaleString() : 'None for this version'}</dd></div>
		</dl>

		<div class="source-estimates">
			<h3>Source estimates</h3>
			{#if data.sourceEstimates.length === 0}
				<p class="muted">No source estimate link is recorded for this quotation version.</p>
			{:else}
				{#each data.sourceEstimates as estimate}
					<article>
						<strong>{estimate.estimateNumber}</strong><span>{estimate.title}</span>
						{#if estimate.projectPublicId}<a href={`/projects/${estimate.projectPublicId}`}>Already linked to {estimate.projectNumber}</a>{/if}
					</article>
				{/each}
			{/if}
		</div>
	</section>

	<aside class="stack">
		{#if data.acceptedResponse && !data.project}
			<section class:warning={data.creditControl.blocked} class="panel">
				<p class="eyebrow">Credit control</p>
				<h2>{data.creditControl.blocked ? 'New commitment is blocked' : 'Credit control clear'}</h2>
				{#if data.creditControl.blocked}
					<p>This accepted quotation cannot create a new project unless the credit condition is cleared or an authorised override is recorded.</p>
					<ul>
						{#if data.creditControl.hasActiveHold}<li>Active customer credit hold</li>{/if}
						{#if data.creditControl.limitExhausted}<li>This quotation would exceed the customer credit limit</li>{/if}
					</ul>
				{:else}
					<p class="muted">No active credit hold or projected credit-limit breach currently blocks this commitment.</p>
				{/if}
				{#if data.creditControl.detailsVisible}
					<dl class="compact">
						<div><dt>Currency</dt><dd>{data.creditControl.currencyCode}</dd></div>
						<div><dt>Receivable</dt><dd>{data.creditControl.outstandingAmount ?? '—'}</dd></div>
						<div><dt>Quotation</dt><dd>{data.creditControl.commitmentAmount ?? '—'}</dd></div>
						<div><dt>Projected</dt><dd>{data.creditControl.projectedExposureAmount ?? '—'}</dd></div>
						<div><dt>Credit limit</dt><dd>{data.creditControl.creditLimitAmount ?? 'No enabled limit'}</dd></div>
					</dl>
				{/if}
				{#if data.creditControl.blocked && !data.creditControl.canOverride}
					<p class="error">Credit-control override authority is required to continue while this block remains active.</p>
				{/if}
			</section>
		{/if}

		{#if data.project}
			<section class="panel success">
				<p class="eyebrow">Conversion complete</p>
				<h2>{data.project.projectNumber}</h2>
				<p>{data.project.name}</p>
				<p class="muted">The conversion ledger already links this accepted response to one project. Repeating the transaction returns the same project.</p>
				<a class="button-link" href={`/projects/${data.project.publicId}`}>Open project</a>
			</section>
		{:else if !data.acceptedResponse}
			<section class="panel">
				<p class="eyebrow">Not ready</p>
				<h2>Acceptance required</h2>
				<p>This exact quotation version must have an accepted customer response before a project can be created.</p>
				<a href={`/commercial/quotations/${quote.publicId}?version=${version.versionNumber}`}>Return to quotation</a>
			</section>
		{:else if !data.canConvert}
			<section class="panel">
				<p class="eyebrow">Authority check</p>
				<h2>Conversion is not available</h2>
				<ul>
					<li class:ok={data.hasCommercialConvertPermission}>Commercial conversion authority: {data.hasCommercialConvertPermission ? 'granted' : 'required'}</li>
					<li class:ok={data.hasProjectCreatePermission}>Project creation authority: {data.hasProjectCreatePermission ? 'granted' : 'required'}</li>
					<li class:ok={!data.creditControl.blocked || data.creditControl.canOverride}>Credit control: {!data.creditControl.blocked ? 'clear' : data.creditControl.canOverride ? 'override available' : 'blocked'}</li>
				</ul>
				{#if data.sourceEstimates.some((estimate) => estimate.projectId !== null)}<p class="error">A source estimate is already linked to another project.</p>{/if}
			</section>
		{:else}
			<section class="panel action-panel">
				<p class="eyebrow">Create job</p>
				<h2>Create proposed project</h2>
				<p>The project will start in <strong>proposed</strong> state. Your organisation becomes the owning participant and you become the first scoped project member.</p>
				<p class="muted">NuBlox will not infer that the CRM customer is a platform participant organisation. Project participants remain an explicit invitation step.</p>
				<form method="POST" action="?/convert">
					<input type="hidden" name="versionNumber" value={version.versionNumber}/>
					{#if data.creditControl.blocked}
						<label>Credit-control override reason
							<textarea name="creditOverrideReason" rows="4" maxlength="1000" required placeholder="Record why new commitment is authorised despite the current credit block."></textarea>
						</label>
					{/if}
					<button type="submit">Create project from accepted quotation</button>
				</form>
			</section>
		{/if}

		<section class="panel">
			<p class="eyebrow">Boundary</p>
			<h2>What conversion does not do</h2>
			<p class="muted">It does not form a contract, invite the customer, create a project site, infer a delivery address, or activate the project automatically.</p>
		</section>
	</aside>
</div>

<style>
	.breadcrumbs{display:flex;gap:.55rem;align-items:center;margin-bottom:1rem;color:#666;font-size:.9rem}.breadcrumbs a{color:inherit;font-weight:650}.page-heading{display:flex;justify-content:space-between;gap:1rem;align-items:start;margin-bottom:1rem}.page-heading h1{margin:.15rem 0 .3rem;font-size:clamp(2rem,5vw,2.8rem);letter-spacing:-.04em}.page-heading p{margin:0;color:#666}.eyebrow{margin:0;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;font-weight:760;color:#666}.status{padding:.3rem .55rem;border-radius:999px;background:#e4f5e8;color:#285f35;font-size:.76rem;font-weight:760}.grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(19rem,.75fr);gap:1rem;align-items:start}.stack{display:grid;gap:1rem}.panel{background:white;border:1px solid #d9d9d2;border-radius:.8rem;padding:1.1rem}.panel.warning{border-color:#dfb36a;background:#fffaf0}.panel h2{margin:.3rem 0 .8rem}.panel h3{margin:1.2rem 0 .5rem}.panel p{line-height:1.5}.muted{color:#666}.success{border-color:#b9d7bf}.action-panel{border-color:#b9cbe6}dl{display:grid;gap:.6rem;margin:1rem 0}dl div{display:grid;grid-template-columns:9rem 1fr;gap:.7rem;padding-bottom:.55rem;border-bottom:1px solid #ecece7}dl.compact div{grid-template-columns:7rem 1fr}dt{color:#666;font-size:.82rem}dd{margin:0;font-weight:650}.source-estimates{margin-top:1rem}.source-estimates article{display:grid;gap:.2rem;padding:.7rem;border:1px solid #e0e0da;border-radius:.55rem;margin-top:.45rem}.source-estimates span{color:#666;font-size:.85rem}.button-link,button{display:inline-block;padding:.62rem .8rem;border:0;border-radius:.48rem;background:#111;color:white;text-decoration:none;font:inherit;font-weight:750;cursor:pointer}form,label{display:grid;gap:.5rem}textarea{width:100%;box-sizing:border-box;padding:.65rem;border:1px solid #c9c9c1;border-radius:.45rem;font:inherit;resize:vertical}ul{padding-left:1.2rem}li{margin:.4rem 0;color:#8a3b2e}li.ok{color:#285f35}.error{color:#8a3025}.banner{padding:.7rem .8rem;background:#fff0ed;border:1px solid #e1b1aa;border-radius:.5rem}@media(max-width:850px){.grid{grid-template-columns:1fr}.page-heading{display:grid}dl div{grid-template-columns:1fr;gap:.15rem}}
</style>
