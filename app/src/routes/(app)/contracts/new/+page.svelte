<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Form contract · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/contracts">Contracts</a><span aria-hidden="true">/</span><span>Form contract</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Accepted quotation → contract</p>
		<h1>{data.quotation.quotationNumber}</h1>
		<p>{data.quotation.customerDisplayName} · {data.quotation.title}</p>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<div class="grid">
	<section class="panel">
		<p class="eyebrow">Inherited commercial position</p>
		<h2>{data.quotation.title}</h2>
		<dl>
			<div>
				<dt>Customer</dt>
				<dd>{data.quotation.customerDisplayName}</dd>
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
				<dt>Currency</dt>
				<dd>{data.quotation.currencyCode}</dd>
			</div>
			<div>
				<dt>Accepted net scope</dt>
				<dd>{data.quotation.netAmount}</dd>
			</div>
			{#if data.legacyProject}
				<div>
					<dt>Existing project</dt>
					<dd>{data.legacyProject.projectNumber} · {data.legacyProject.name}</dd>
				</div>
			{/if}
		</dl>
		<p class="muted">
			Customer identity, accepted scope, currency and quotation evidence flow forward automatically.
			The contract owns its own versioned legal and commercial position from this point onward.
		</p>
		{#if data.mode === 'legacy-project'}
			<p class="compatibility-note">
				Compatibility path: this source was converted to a proposed project before contract formation.
				New wins now form the contract first and mobilise the project only after execution.
			</p>
		{/if}
	</section>

	<aside class="panel">
		{#if data.existingContract}
			<p class="eyebrow">Already progressed</p>
			<h2>{data.existingContract.contractNumber}</h2>
			<p>This accepted quotation already has its contract record.</p>
			<a class="button-link" href={`/contracts/${data.existingContract.publicId}`}>Continue contract</a>
		{:else if !data.canCreate}
			<p class="eyebrow">Authority required</p>
			<h2>Contract formation is unavailable</h2>
			<p>Contract-creation authority is required. Project creation is not required at this stage.</p>
		{:else}
			<p class="eyebrow">Progression</p>
			<h2>Form contract version 1</h2>
			<form method="POST" action="?/create">
				{#if data.mode === 'accepted-quotation'}
					<input type="hidden" name="quotationPublicId" value={data.quotation.publicId} />
					<input type="hidden" name="versionNumber" value={data.quotation.versionNumber} />
				{:else if data.legacyProject}
					<input type="hidden" name="projectPublicId" value={data.legacyProject.publicId} />
				{/if}
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
				<button type="submit">Form draft contract</button>
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
	.compatibility-note {
		padding: 0.7rem;
		border-radius: 0.5rem;
		background: #f5f3ec;
		color: #5f5847;
		line-height: 1.45;
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
