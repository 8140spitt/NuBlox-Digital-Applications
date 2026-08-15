<script lang="ts">
	let { data } = $props();
	const labels: Record<string,string> = { draft:'Draft', issued:'Issued', accepted:'Accepted', rejected:'Rejected', revision_requested:'Revision requested', expired:'Expired', superseded:'Superseded', withdrawn:'Withdrawn' };
	function money(value:string,currency:string|null){ const amount=Number(value); return currency&&Number.isFinite(amount)?new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(amount):`${currency??''} ${value}`.trim(); }
</script>

<svelte:head><title>Quotations · Commercial · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/commercial/estimates">Commercial</a><span aria-hidden="true">/</span><span>Quotations</span><a class="sibling" href="/commercial/estimates">Estimates</a></nav>
<section class="page-heading"><div><p class="eyebrow">Commercial sales</p><h1>Quotations</h1><p>Customer-facing commercial documents generated independently from internal estimate revisions.</p></div><span class="count">{data.quotations.length}</span></section>

{#if !data.canView}
	<section class="panel"><p>You do not have <code>commercial.view</code> permission for this organisation.</p></section>
{:else if data.quotations.length===0}
	<section class="panel empty"><h2>No quotations yet</h2><p>Finalise an estimate, then create a quotation from that immutable pricing revision.</p><a class="button-link" href="/commercial/estimates">Open estimates</a></section>
{:else}
	<section class="panel"><div class="list">
		{#each data.quotations as quote}
			<a class="card" href={`/commercial/quotations/${quote.publicId}`}>
				<div class="card-title"><div><strong>{quote.quotationNumber}</strong><span>{quote.customerDisplayName}</span></div><span class={`status status-${quote.effectiveStatus}`}>{labels[quote.effectiveStatus]??quote.effectiveStatus}</span></div>
				<div class="meta"><span>{quote.opportunityTitle??'No opportunity'}</span><span>Net {money(quote.netTotal,quote.currencyCode)}</span><span>Tax {money(quote.taxTotal,quote.currencyCode)}</span><span>Gross {money(quote.grossTotal,quote.currencyCode)}</span>{#if quote.latestVersionNumber}<span>Version {quote.latestVersionNumber}</span>{/if}</div>
			</a>
		{/each}
	</div></section>
{/if}

<style>
	.breadcrumbs{display:flex;gap:.55rem;align-items:center;margin-bottom:1rem;color:#666;font-size:.9rem}.breadcrumbs a{color:inherit;font-weight:650}.sibling{margin-left:auto}.page-heading{display:flex;justify-content:space-between;gap:1rem;align-items:end;margin-bottom:1.25rem}.page-heading h1{margin:.15rem 0 .35rem;font-size:clamp(2rem,5vw,3rem);letter-spacing:-.045em}.page-heading p{margin:0;max-width:50rem;color:#666;line-height:1.5}.eyebrow{margin:0;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;font-weight:760;color:#666}.count{min-width:2.3rem;height:2.3rem;display:grid;place-items:center;border-radius:999px;background:#eee;font-weight:750}.panel{background:white;border:1px solid #d9d9d2;border-radius:.8rem;padding:1.1rem}.list{display:grid;gap:.65rem}.card{display:grid;gap:.7rem;padding:.9rem;border:1px solid #e0e0da;border-radius:.62rem;color:inherit;text-decoration:none}.card:hover{border-color:#999}.card-title{display:flex;justify-content:space-between;gap:1rem}.card-title>div{display:grid;gap:.18rem}.card-title span,.meta{color:#666;font-size:.82rem}.meta{display:flex;flex-wrap:wrap;gap:.45rem 1rem}.status{align-self:start;padding:.26rem .5rem;border-radius:999px;background:#ecece7;font-size:.74rem!important;font-weight:750}.status-draft{background:#e7efff;color:#234b85!important}.status-issued{background:#eee8ff;color:#54428b!important}.status-accepted{background:#e4f5e8;color:#285f35!important}.status-rejected,.status-withdrawn,.status-expired{background:#f1ece9;color:#76544a!important}.status-revision_requested{background:#fff3d8;color:#725317!important}.empty{text-align:center;padding:2rem;color:#666}.button-link{display:inline-block;margin-top:.6rem;padding:.58rem .75rem;background:#111;color:white;text-decoration:none;border-radius:.45rem;font-weight:750}
</style>
