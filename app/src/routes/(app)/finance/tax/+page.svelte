<script lang="ts">
	let { data, form } = $props();
	const today = new Date().toISOString().slice(0, 10);

	function dateText(value: Date | null) {
		return value ? new Date(value).toLocaleDateString() : 'Open ended';
	}
</script>

<svelte:head><title>Tax settings · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/finance/invoices">Finance</a><span>/</span><span>Tax settings</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Finance configuration</p>
		<h1>Tax settings</h1>
		<p>
			Organisation tax categories and effective-dated percentage rates used by quotations and
			invoices.
		</p>
	</div>
	<a class="secondary" href="/finance/invoices">Back to invoices</a>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="notice">
	<strong>Starter catalogue</strong>
	<span
		>NuBlox provides standard, reduced, zero-rated, exempt and outside-scope UK categories. Your own
		categories and rate history are preserved. Tax-rate changes are added as new effective periods
		rather than rewriting issued-document tax snapshots.</span
	>
</section>

<div class="layout">
	<section class="panel">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Available taxes</p>
				<h2>Tax categories</h2>
			</div>
			<span>{data.categories.length}</span>
		</div>
		<div class="cards">
			{#each data.categories as category}
				<article class="record">
					<div class="record-head">
						<div>
							<strong>{category.name}</strong><small
								>{category.code} · {category.treatment.replace('_', ' ')}</small
							>
						</div>
						<em>{category.isActive ? 'Active' : 'Inactive'}</em>
					</div>
					{#if category.rates.length === 0}
						<p class="muted">No percentage rate is required for this treatment.</p>
					{:else}
						<div class="rates">
							{#each category.rates as rate}
								<div>
									<strong>{rate.ratePercent}%</strong><span
										>{dateText(rate.validFrom)} → {dateText(rate.validTo)}</span
									>
								</div>
							{/each}
						</div>
					{/if}
					{#if data.canManage && category.isActive && category.treatment !== 'exempt' && category.treatment !== 'outside_scope'}
						<form method="POST" action="?/addRate" class="inline-form">
							<input type="hidden" name="categoryPublicId" value={category.publicId} />
							<label
								>New rate %<input
									name="ratePercent"
									inputmode="decimal"
									value={category.treatment === 'zero' ? '0' : ''}
									required
								/></label
							>
							<label>Starts<input name="validFrom" type="date" value={today} required /></label>
							<button type="submit">Add rate</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	</section>

	{#if data.canManage}
		<aside class="panel">
			<p class="eyebrow">Custom tax</p>
			<h2>Add tax category</h2>
			<p class="muted">
				Use a stable code. Taxable and zero-rated categories require an initial percentage rate;
				exempt and outside-scope categories do not.
			</p>
			<form method="POST" action="?/createCategory" class="form-grid">
				<label>Code<input name="code" maxlength="48" placeholder="VAT_CUSTOM" required /></label>
				<label>Name<input name="name" maxlength="160" required /></label>
				<label
					>Treatment<select name="treatment" required
						><option value="taxable">Taxable</option><option value="zero">Zero-rated</option><option
							value="exempt">Exempt</option
						><option value="outside_scope">Outside scope</option></select
					></label
				>
				<label
					>Rate %<input
						name="ratePercent"
						inputmode="decimal"
						placeholder="Required for taxable / zero"
					/></label
				>
				<label>Rate starts<input name="validFrom" type="date" value={today} /></label>
				<button type="submit">Add tax category</button>
			</form>
		</aside>
	{/if}
</div>

<style>
	.breadcrumbs {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		color: #667085;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}
	.breadcrumbs a {
		color: inherit;
	}
	.page-heading,
	.section-heading,
	.record-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}
	.page-heading {
		margin-bottom: 1rem;
	}
	.page-heading h1,
	.panel h2 {
		margin: 0.15rem 0;
	}
	.page-heading p {
		margin: 0.2rem 0;
		color: #667085;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.72rem;
		font-weight: 700;
		color: #667085;
		margin: 0;
	}
	.secondary {
		padding: 0.55rem 0.75rem;
		border: 1px solid #d0d5dd;
		border-radius: 9px;
		color: inherit;
		text-decoration: none;
		font-weight: 700;
	}
	.notice {
		display: grid;
		gap: 0.25rem;
		padding: 0.85rem 1rem;
		margin-bottom: 1rem;
		border: 1px solid #b9cbe6;
		border-radius: 11px;
		background: #f5f8fc;
	}
	.notice span,
	.muted {
		color: #667085;
		line-height: 1.45;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.55fr);
		gap: 1rem;
		align-items: start;
	}
	.panel {
		border: 1px solid #d0d5dd;
		border-radius: 14px;
		background: white;
		padding: 1rem;
	}
	.cards,
	.form-grid,
	.rates {
		display: grid;
		gap: 0.75rem;
	}
	.cards {
		margin-top: 0.8rem;
	}
	.record {
		border: 1px solid #e4e7ec;
		border-radius: 10px;
		padding: 0.8rem;
	}
	.record-head div {
		display: grid;
		gap: 0.15rem;
	}
	.record-head small {
		color: #667085;
	}
	.record-head em {
		font-style: normal;
		font-size: 0.75rem;
		text-transform: uppercase;
	}
	.rates {
		margin-top: 0.65rem;
	}
	.rates div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0.6rem;
		background: #f8fafc;
		border-radius: 8px;
	}
	.rates span {
		color: #667085;
		font-size: 0.86rem;
	}
	.inline-form {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.6rem;
		align-items: end;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #e4e7ec;
	}
	.form-grid {
		margin-top: 0.8rem;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.86rem;
		font-weight: 650;
	}
	input,
	select {
		font: inherit;
		padding: 0.6rem;
		border: 1px solid #cfd4dc;
		border-radius: 8px;
		background: white;
	}
	button {
		font: inherit;
		font-weight: 700;
		padding: 0.62rem 0.8rem;
		border: 0;
		border-radius: 8px;
		background: #1d2939;
		color: white;
		cursor: pointer;
		width: max-content;
	}
	.banner {
		padding: 0.75rem 1rem;
		border-radius: 9px;
	}
	.error {
		color: #b42318;
		background: #fef3f2;
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
		.inline-form {
			grid-template-columns: 1fr;
		}
		.page-heading {
			display: grid;
		}
	}
</style>
