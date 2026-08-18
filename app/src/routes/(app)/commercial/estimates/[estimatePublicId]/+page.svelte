<script lang="ts">
	let { data, form } = $props();
	function money(value: string): string {
		const amount = Number(value);
		return Number.isFinite(amount)
			? new Intl.NumberFormat('en-GB', {
					style: 'currency',
					currency: data.version.currencyCode
				}).format(amount)
			: `${data.version.currencyCode} ${value}`;
	}
</script>

<svelte:head><title>{data.estimate.estimateNumber} · Estimate · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/commercial/estimates">Estimates</a><span aria-hidden="true">/</span><span
		>{data.estimate.estimateNumber}</span
	>
	<a class="sibling" href="/commercial/quotations">Quotations</a>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">{data.estimate.estimateNumber}</p>
		<h1>{data.estimate.title}</h1>
		<p>{data.estimate.opportunityTitle ?? 'No CRM opportunity context'}</p>
	</div>
	<span class={`status status-${data.version.versionStatus}`}>{data.version.versionStatus}</span>
</section>

<div class="version-bar" aria-label="Estimate versions">
	{#each data.versions as version}
		<a class:active={version.id === data.version.id} href={`?version=${version.versionNumber}`}
			>v{version.versionNumber} · {version.versionStatus}</a
		>
	{/each}
</div>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="metrics">
	<div><span>Sell</span><strong>{money(data.sellTotal)}</strong></div>
	<div><span>Cost</span><strong>{money(data.costTotal)}</strong></div>
	<div><span>Margin</span><strong>{money(data.marginAmount)}</strong></div>
	<div><span>Currency</span><strong>{data.version.currencyCode}</strong></div>
</section>

<div class="workspace-grid">
	<section class="panel lines-panel">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Version {data.version.versionNumber}</p>
				<h2>Estimate build-up</h2>
			</div>
			<span>{data.items.length} lines</span>
		</div>
		{#if data.items.length === 0}
			<div class="empty">No estimate lines have been added to this version.</div>
		{:else}
			<div class="lines">
				{#each data.items as item}
					<article class="line">
						<div class="line-header">
							<div>
								<span class="line-no">#{item.lineNumber}</span><strong>{item.description}</strong
								><small
									>{item.salesItemTypeName}{item.unitSymbol
										? ` · ${item.unitSymbol}`
										: ''}{item.isOptional ? ' · Optional' : ''}</small
								>
							</div>
							<div class="line-money">
								<strong>{money(item.sellAmount)}</strong><span
									>{item.quantity} × {money(item.sellUnitRate)}</span
								>
							</div>
						</div>
						<div class="cost-box">
							<div class="cost-heading">
								<strong>Internal cost build-up</strong><span>{money(item.costAmount)}</span>
							</div>
							{#if item.components.length === 0}<p>No cost components.</p>{:else}
								<ul>
									{#each item.components as component}<li>
											<span
												>{component.description} · {component.quantity} × {money(
													component.unitCost
												)}{component.wastePercent !== '0.0000'
													? ` + ${component.wastePercent}% waste`
													: ''}</span
											><strong>{money(component.wastedCost)}</strong>
										</li>{/each}
								</ul>
							{/if}
							{#if data.canManageEstimates && data.version.versionStatus === 'draft'}
								<form method="POST" action="?/addCostComponent" class="compact-form">
									<input
										type="hidden"
										name="versionNumber"
										value={data.version.versionNumber}
									/><input type="hidden" name="lineNumber" value={item.lineNumber} />
									<label
										><span>Type</span><select name="salesItemTypeId" required
											>{#each data.salesItemTypes as type}<option value={type.id}
													>{type.name}</option
												>{/each}</select
										></label
									>
									<label
										><span>Unit</span><select name="unitOfMeasureId"
											><option value="">None</option>{#each data.units as unit}<option
													value={unit.id}>{unit.name}</option
												>{/each}</select
										></label
									>
									<label class="wide"
										><span>Description</span><input
											name="description"
											maxlength="500"
											required
										/></label
									>
									<label
										><span>Quantity</span><input
											name="quantity"
											inputmode="decimal"
											required
											value="1"
										/></label
									>
									<label
										><span>Unit cost</span><input
											name="unitCost"
											inputmode="decimal"
											required
											value="0.00"
										/></label
									>
									<label
										><span>Waste %</span><input
											name="wastePercent"
											inputmode="decimal"
											value="0"
										/></label
									>
									<label
										><span>Markup %</span><input
											name="markupPercent"
											inputmode="decimal"
											value="0"
										/></label
									>
									<button type="submit" class="secondary">Add cost component</button>
								</form>
							{/if}
						</div>
						{#if data.canManageEstimates && data.version.versionStatus === 'draft'}
							<form method="POST" action="?/removeItem">
								<input
									type="hidden"
									name="versionNumber"
									value={data.version.versionNumber}
								/><input type="hidden" name="lineNumber" value={item.lineNumber} /><button
									class="danger secondary"
									type="submit">Remove line</button
								>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<aside class="sidebar-stack">
		{#if data.canManageEstimates && data.version.versionStatus === 'draft'}
			<section class="panel">
				<p class="eyebrow">Add line</p>
				<h2>Estimate output item</h2>
				<form method="POST" action="?/addItem" class="form-grid">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber} />
					<label
						><span>Type</span><select name="salesItemTypeId" required
							>{#each data.salesItemTypes as type}<option value={type.id}>{type.name}</option
								>{/each}</select
						></label
					>
					<label
						><span>Unit</span><select name="unitOfMeasureId"
							><option value="">None</option>{#each data.units as unit}<option value={unit.id}
									>{unit.name}{unit.symbol ? ` (${unit.symbol})` : ''}</option
								>{/each}</select
						></label
					>
					<label class="wide"
						><span>Description</span><textarea name="description" rows="3" required
						></textarea></label
					>
					<label
						><span>Quantity</span><input
							name="quantity"
							inputmode="decimal"
							value="1"
							required
						/></label
					>
					<label
						><span>Sell unit rate</span><input
							name="sellUnitRate"
							inputmode="decimal"
							value="0.00"
							required
						/></label
					>
					<label class="check wide"
						><input type="checkbox" name="isOptional" /><span>Optional line</span></label
					>
					<button type="submit">Add estimate line</button>
				</form>
			</section>
			<section class="panel action-panel">
				<p class="eyebrow">Version control</p>
				<h2>Finalise estimate</h2>
				<p>Finalisation freezes this pricing revision through normal application writes.</p>
				<form method="POST" action="?/finalise">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber} /><button
						type="submit">Finalise version {data.version.versionNumber}</button
					>
				</form>
			</section>
		{:else if data.canManageQuotations && data.version.versionStatus === 'final'}
			<section class="panel action-panel">
				<p class="eyebrow">Customer document</p>
				<h2>Create quotation</h2>
				<p>
					Copies the final estimate output lines into a separate customer-facing quotation version
					while retaining the estimate as internal pricing evidence.
				</p>
				<form method="POST" action="?/createQuotation" class="form-grid">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber} />
					<label class="wide"
						><span>Quotation title</span><input
							name="title"
							maxlength="255"
							value={data.estimate.title}
						/></label
					>
					<label class="wide"
						><span>Customer reference</span><input
							name="customerReference"
							maxlength="160"
						/></label
					>
					<label class="wide"><span>Valid until</span><input name="validUntil" type="date" /></label
					>
					<button type="submit">Create quotation</button>
				</form>
			</section>
		{/if}
		{#if data.version.notes}<section class="panel">
				<p class="eyebrow">Version notes</p>
				<p>{data.version.notes}</p>
			</section>{/if}
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
	.sibling {
		margin-left: auto;
	}
	.page-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
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
	.status {
		padding: 0.3rem 0.55rem;
		border-radius: 999px;
		background: #ecece7;
		font-size: 0.76rem;
		font-weight: 760;
		text-transform: capitalize;
	}
	.status-draft {
		background: #e7efff;
		color: #234b85;
	}
	.status-final {
		background: #e4f5e8;
		color: #285f35;
	}
	.status-superseded {
		background: #f1ece9;
		color: #76544a;
	}
	.version-bar {
		display: flex;
		gap: 0.45rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.version-bar a {
		padding: 0.38rem 0.6rem;
		border: 1px solid #d6d6cf;
		border-radius: 0.5rem;
		color: #555;
		text-decoration: none;
		font-size: 0.82rem;
	}
	.version-bar a.active {
		border-color: #222;
		color: #111;
		background: white;
		font-weight: 750;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.7rem;
		margin-bottom: 1rem;
	}
	.metrics div {
		display: grid;
		gap: 0.2rem;
		padding: 0.8rem;
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.65rem;
	}
	.metrics span {
		font-size: 0.75rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.metrics strong {
		font-size: 1.1rem;
	}
	.workspace-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(20rem, 0.75fr);
		gap: 1rem;
		align-items: start;
	}
	.sidebar-stack {
		display: grid;
		gap: 1rem;
	}
	.panel {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.1rem;
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
	}
	.section-heading h2,
	.panel h2 {
		margin: 0.3rem 0;
	}
	.section-heading > span {
		font-size: 0.82rem;
		color: #666;
	}
	.lines {
		display: grid;
		gap: 0.85rem;
		margin-top: 1rem;
	}
	.line {
		display: grid;
		gap: 0.8rem;
		border: 1px solid #e1e1da;
		border-radius: 0.65rem;
		padding: 0.9rem;
	}
	.line-header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.line-header > div:first-child {
		display: grid;
		gap: 0.18rem;
	}
	.line-header small,
	.line-money span,
	.line-no {
		color: #666;
		font-size: 0.78rem;
	}
	.line-money {
		display: grid;
		text-align: right;
		gap: 0.16rem;
	}
	.cost-box {
		padding: 0.75rem;
		background: #f7f7f4;
		border-radius: 0.55rem;
	}
	.cost-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.cost-box ul {
		list-style: none;
		margin: 0.65rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
	}
	.cost-box li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.82rem;
	}
	.cost-box p {
		color: #777;
		font-size: 0.82rem;
	}
	.empty {
		padding: 2rem 0.5rem;
		text-align: center;
		color: #666;
	}
	.form-grid,
	.compact-form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
		margin-top: 0.8rem;
	}
	.compact-form {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		padding-top: 0.7rem;
		border-top: 1px solid #ddd;
	}
	.wide {
		grid-column: 1/-1;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.8rem;
		font-weight: 650;
	}
	input,
	select,
	textarea {
		min-width: 0;
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.42rem;
		padding: 0.55rem;
		background: white;
	}
	textarea {
		resize: vertical;
	}
	.check {
		display: flex;
		grid-template-columns: auto 1fr;
		align-items: center;
		font-weight: 500;
	}
	button {
		font: inherit;
		font-weight: 750;
		border: 1px solid #111;
		border-radius: 0.45rem;
		padding: 0.58rem 0.75rem;
		background: #111;
		color: white;
		cursor: pointer;
		justify-self: start;
	}
	.secondary {
		background: white;
		color: #222;
	}
	.danger {
		border-color: #a66;
		color: #8a2929;
	}
	.action-panel p {
		color: #666;
		line-height: 1.45;
	}
	.banner {
		padding: 0.7rem 0.9rem;
		border: 1px solid #d9aaaa;
		background: #fff3f3;
		border-radius: 0.55rem;
	}
	.error {
		color: #941c1c;
	}
	@media (max-width: 980px) {
		.workspace-grid {
			grid-template-columns: 1fr;
		}
		.metrics {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (max-width: 650px) {
		.metrics,
		.form-grid,
		.compact-form {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
		.line-header {
			display: grid;
		}
		.line-money {
			text-align: left;
		}
	}
</style>
