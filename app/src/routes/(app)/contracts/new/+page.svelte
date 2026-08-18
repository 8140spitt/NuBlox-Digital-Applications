<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Form contract · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/contracts">Contracts</a><span aria-hidden="true">/</span><span>New</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Accepted quotation → contract</p>
		<h1>{data.project.projectNumber}</h1>
		<p>{data.quotation.customerDisplayName} · {data.quotation.quotationNumber}</p>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<div class="grid">
	<section class="panel">
		<p class="eyebrow">Source evidence</p>
		<h2>{data.quotation.title}</h2>
		<dl>
			<div>
				<dt>Project</dt>
				<dd>{data.project.projectNumber} · {data.project.name}</dd>
			</div>
			<div>
				<dt>Quotation</dt>
				<dd>{data.quotation.quotationNumber} · version {data.quotation.versionNumber}</dd>
			</div>
			<div>
				<dt>Accepted</dt>
				<dd>{new Date(data.quotation.acceptedAt).toLocaleString()}</dd>
			</div>
			<div>
				<dt>Customer</dt>
				<dd>{data.quotation.customerDisplayName}</dd>
			</div>
			<div>
				<dt>Currency</dt>
				<dd>{data.quotation.currencyCode}</dd>
			</div>
			<div>
				<dt>Accepted net scope</dt>
				<dd>{data.quotation.netAmount}</dd>
			</div>
		</dl>
		<p class="muted">
			The initial base-scope value is derived from the accepted quotation's included lines. The
			exact accepted response remains contract provenance.
		</p>
	</section>

	<aside class="panel">
		{#if data.existingContract}
			<p class="eyebrow">Already formed</p>
			<h2>{data.existingContract.contractNumber}</h2>
			<p>This source project and accepted response already have a contract.</p>
			<a class="button-link" href={`/contracts/${data.existingContract.publicId}`}>Open contract</a>
		{:else if !data.canCreate}
			<p class="eyebrow">Authority required</p>
			<h2>Contract creation is unavailable</h2>
			<p>Contract formation authority, project access and a proposed project are required.</p>
		{:else}
			<p class="eyebrow">Draft contract</p>
			<h2>Form contract version 1</h2>
			<form method="POST" action="?/create">
				<input type="hidden" name="projectPublicId" value={data.project.publicId} />
				<label
					>Contract type<select name="contractTypeCode" required
						>{#each data.contractTypes as type}<option value={type.code}>{type.name}</option
							>{/each}</select
					></label
				>
				<label
					>Title<input name="title" maxlength="255" value={data.quotation.title} required /></label
				>
				<label
					>Customer reference<input
						name="customerReference"
						maxlength="160"
						placeholder="Optional PO / agreement reference"
					/></label
				>
				<button type="submit">Create draft contract</button>
			</form>
		{/if}
	</aside>
</div>

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
	.page-heading p {
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
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(20rem, 0.75fr);
		gap: 1rem;
		align-items: start;
	}
	.panel {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.1rem;
	}
	.panel h2 {
		margin: 0.3rem 0 0.8rem;
	}
	.muted {
		color: #666;
		line-height: 1.5;
	}
	dl {
		display: grid;
		gap: 0.55rem;
		margin: 1rem 0;
	}
	dl div {
		display: grid;
		grid-template-columns: 10rem 1fr;
		gap: 0.7rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #ecece7;
	}
	dt {
		color: #666;
		font-size: 0.82rem;
	}
	dd {
		margin: 0;
		font-weight: 650;
	}
	form {
		display: grid;
		gap: 0.8rem;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-weight: 650;
	}
	input,
	select {
		width: 100%;
		box-sizing: border-box;
		padding: 0.6rem;
		border: 1px solid #c9c9c2;
		border-radius: 0.45rem;
		background: white;
		font: inherit;
	}
	button,
	.button-link {
		display: inline-block;
		width: max-content;
		padding: 0.62rem 0.8rem;
		border: 0;
		border-radius: 0.48rem;
		background: #111;
		color: white;
		text-decoration: none;
		font: inherit;
		font-weight: 750;
		cursor: pointer;
	}
	.error {
		color: #8a3025;
	}
	.banner {
		padding: 0.7rem 0.8rem;
		background: #fff0ed;
		border: 1px solid #e1b1aa;
		border-radius: 0.5rem;
	}
	@media (max-width: 850px) {
		.grid {
			grid-template-columns: 1fr;
		}
		dl div {
			grid-template-columns: 1fr;
			gap: 0.15rem;
		}
	}
</style>
