<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currency: string | null): string {
		if (!currency) return value;
		const amount = Number(value);
		return Number.isFinite(amount)
			? new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
			: `${currency} ${value}`;
	}
</script>

<svelte:head><title>Estimates · Commercial · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/commercial/estimates">Commercial</a><span aria-hidden="true">/</span><span
		>Estimates</span
	>
	<a class="sibling" href="/commercial/quotations">Quotations</a>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Commercial sales</p>
		<h1>Estimates</h1>
		<p>
			Build internal cost and sell-rate detail against CRM opportunities before producing a
			customer-facing quotation.
		</p>
	</div>
	<span class="count">{data.estimates.length}</span>
</section>

{#if !data.canView}
	<section class="panel">
		<p>You do not have <code>commercial.view</code> permission for this organisation.</p>
	</section>
{:else}
	<div class="page-grid">
		<section class="panel">
			{#if data.estimates.length === 0}
				<div class="empty">
					<h2>No estimates yet</h2>
					<p>Create an estimate from an active or won CRM opportunity.</p>
				</div>
			{:else}
				<div class="list">
					{#each data.estimates as estimate}
						<a class="card" href={`/commercial/estimates/${estimate.publicId}`}>
							<div class="card-title">
								<div><strong>{estimate.estimateNumber}</strong><span>{estimate.title}</span></div>
								<span class={`status status-${estimate.latestVersionStatus ?? 'none'}`}
									>{estimate.latestVersionStatus ?? estimate.lifecycleStatus}</span
								>
							</div>
							<div class="meta">
								<span>{estimate.opportunityTitle ?? 'No opportunity'}</span>
								<span>Sell {money(estimate.sellTotal, estimate.currencyCode)}</span>
								<span>Cost {money(estimate.costTotal, estimate.currencyCode)}</span>
								{#if estimate.latestVersionNumber}<span>Version {estimate.latestVersionNumber}</span
									>{/if}
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		{#if data.canManageEstimates}
			<section class="panel create-panel">
				<p class="eyebrow">New estimate</p>
				<h2>Price an opportunity</h2>
				{#if data.opportunities.length === 0}
					<p class="hint">There are no active or won CRM opportunities available for estimating.</p>
				{:else}
					<form method="POST" action="?/create" class="form-grid">
						<label class="wide"
							><span>CRM opportunity</span>
							<select name="opportunityPublicId" required>
								<option value="">Choose opportunity</option>
								{#each data.opportunities as opportunity}
									<option value={opportunity.publicId}
										>{opportunity.title} · {opportunity.primaryPartyDisplayName ??
											'No customer'}</option
									>
								{/each}
							</select>
						</label>
						<label class="wide"
							><span>Estimate title</span><input name="title" maxlength="255" required /></label
						>
						<label
							><span>Currency</span><input
								name="currencyCode"
								maxlength="3"
								value="GBP"
								required
							/></label
						>
						<label class="wide"
							><span>Notes</span><textarea name="notes" rows="4" maxlength="10000"
							></textarea></label
						>
						{#if form?.createError}<p class="error wide" role="alert">{form.createError}</p>{/if}
						<button type="submit">Create estimate</button>
					</form>
				{/if}
			</section>
		{/if}
	</div>
{/if}

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
	.sibling {
		margin-left: auto;
	}
	.page-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
		margin-bottom: 1.25rem;
	}
	.page-heading h1 {
		margin: 0.15rem 0 0.35rem;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.045em;
	}
	.page-heading p {
		margin: 0;
		max-width: 50rem;
		color: #666;
		line-height: 1.5;
	}
	.eyebrow {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.72rem;
		font-weight: 760;
		color: #666;
	}
	.count {
		min-width: 2.3rem;
		height: 2.3rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		background: #eee;
		font-weight: 750;
	}
	.page-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(20rem, 0.8fr);
		gap: 1rem;
		align-items: start;
	}
	.panel {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.1rem;
	}
	.list {
		display: grid;
		gap: 0.65rem;
	}
	.card {
		display: grid;
		gap: 0.7rem;
		padding: 0.9rem;
		border: 1px solid #e0e0da;
		border-radius: 0.62rem;
		color: inherit;
		text-decoration: none;
	}
	.card:hover {
		border-color: #999;
	}
	.card-title {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.card-title > div {
		display: grid;
		gap: 0.18rem;
	}
	.card-title span,
	.meta {
		color: #666;
		font-size: 0.82rem;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 1rem;
	}
	.status {
		align-self: start;
		padding: 0.26rem 0.5rem;
		border-radius: 999px;
		background: #ecece7;
		font-size: 0.74rem !important;
		font-weight: 750;
	}
	.status-draft {
		background: #e7efff;
		color: #234b85 !important;
	}
	.status-final {
		background: #e4f5e8;
		color: #285f35 !important;
	}
	.status-superseded {
		background: #f1ece9;
		color: #76544a !important;
	}
	.create-panel h2,
	.empty h2 {
		margin: 0.35rem 0;
	}
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.wide {
		grid-column: 1/-1;
	}
	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.84rem;
		font-weight: 650;
	}
	input,
	select,
	textarea {
		min-width: 0;
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.45rem;
		padding: 0.62rem;
		background: white;
	}
	textarea {
		resize: vertical;
	}
	button {
		font: inherit;
		font-weight: 750;
		border: 1px solid #111;
		border-radius: 0.48rem;
		padding: 0.62rem 0.82rem;
		background: #111;
		color: white;
		cursor: pointer;
		justify-self: start;
	}
	.error {
		color: #941c1c;
	}
	.hint,
	.empty {
		color: #666;
	}
	.empty {
		padding: 2rem 0.5rem;
		text-align: center;
	}
	@media (max-width: 900px) {
		.page-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 620px) {
		.form-grid {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
	}
</style>
