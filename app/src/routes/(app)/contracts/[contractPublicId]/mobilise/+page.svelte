<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Mobilise project · {data.contract.contractNumber} · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/contracts">Contracts</a><span aria-hidden="true">/</span><a
		href={`/contracts/${data.contract.publicId}`}>{data.contract.contractNumber}</a
	><span aria-hidden="true">/</span><span>Mobilise project</span>
</nav>

<section class="page-heading">
	<p class="eyebrow">Contract → project</p>
	<h1>Mobilise project</h1>
	<p>{data.contract.contractNumber} · {data.contract.title}</p>
</section>

{#if form?.mobilisationError}<p class="error" role="alert">{form.mobilisationError}</p>{/if}

<section class="panel">
	<p class="eyebrow">Executed commercial baseline</p>
	<h2>{data.contract.title}</h2>
	<dl>
		<div>
			<dt>Contract</dt>
			<dd>{data.contract.contractNumber}</dd>
		</div>
		<div>
			<dt>Contract status</dt>
			<dd>{data.contract.lifecycleStatus.replaceAll('_', ' ')}</dd>
		</div>
		<div>
			<dt>Executed version</dt>
			<dd>{data.version.versionNumber}</dd>
		</div>
		<div>
			<dt>Accepted quotation</dt>
			<dd>{data.contract.sourceQuotationNumber ?? 'No quotation source'}</dd>
		</div>
	</dl>

	{#if !data.mobilisation.isExecuted}
		<p class="notice">
			The contract must be issued and executed before NuBlox can create the delivery project.
		</p>
		<a class="secondary" href={`/contracts/${data.contract.publicId}`}>Return to contract</a>
	{:else if !data.mobilisation.canMobilise}
		<p class="notice">
			The contract is executed, but your current authority does not permit project creation.
		</p>
		<a class="secondary" href={`/contracts/${data.contract.publicId}`}>Return to contract</a>
	{:else}
		<p class="explanation">
			NuBlox will create one active delivery project from this executed contract and carry forward
			the accepted quotation and source estimate lineage. The project will become the operational
			workspace while the quotation and contract remain immutable commercial evidence.
		</p>
		<form method="POST">
			<button type="submit">Mobilise project</button>
		</form>
	{/if}
</section>

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
		margin-bottom: 1rem;
	}
	.page-heading h1 {
		margin: 0.15rem 0 0.3rem;
		font-size: clamp(2rem, 5vw, 2.8rem);
		letter-spacing: -0.04em;
	}
	.page-heading p:not(.eyebrow) {
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
	.panel {
		max-width: 50rem;
		background: white;
		border: 1px solid #b9d0ba;
		border-radius: 0.8rem;
		padding: 1.15rem;
	}
	.panel h2 {
		margin: 0.3rem 0 0.9rem;
	}
	dl {
		display: grid;
		gap: 0.55rem;
		margin: 0 0 1rem;
	}
	dl div {
		display: grid;
		grid-template-columns: 10rem 1fr;
		gap: 0.7rem;
	}
	dt {
		color: #666;
	}
	dd {
		margin: 0;
		font-weight: 650;
	}
	.explanation,
	.notice {
		line-height: 1.55;
		color: #555;
	}
	.notice {
		padding: 0.75rem;
		background: #f5f3ec;
		border-radius: 0.5rem;
	}
	button,
	.secondary {
		display: inline-block;
		width: max-content;
		padding: 0.62rem 0.82rem;
		border: 0;
		border-radius: 0.48rem;
		font: inherit;
		font-weight: 750;
		text-decoration: none;
		cursor: pointer;
	}
	button {
		background: #111;
		color: white;
	}
	.secondary {
		background: #ecece7;
		color: #222;
	}
	.error {
		max-width: 50rem;
		color: #8a3025;
		padding: 0.7rem 0.8rem;
		background: #fff0ed;
		border: 1px solid #e1b1aa;
		border-radius: 0.5rem;
	}
	@media (max-width: 620px) {
		dl div {
			grid-template-columns: 1fr;
			gap: 0.1rem;
		}
	}
</style>
