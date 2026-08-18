<script lang="ts">
	let { data, form } = $props();
	const statusLabels: Record<string, string> = {
		open: 'Open',
		won: 'Won',
		lost: 'Lost',
		cancelled: 'Cancelled'
	};

	function money(value: string | null, currency: string): string {
		if (value === null) return 'Not valued';
		const amount = Number(value);
		if (!Number.isFinite(amount)) return `${currency} ${value}`;
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
	}
</script>

<svelte:head>
	<title>Opportunities · CRM · NuBlox</title>
</svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/crm">CRM</a>
	<span aria-hidden="true">/</span>
	<span>Opportunities</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">CRM</p>
		<h1>Opportunities</h1>
		<p>
			Track prospective work from first lead through commercial outcome without duplicating customer
			identity.
		</p>
	</div>
	<span class="count">{data.opportunities.length}</span>
</section>

{#if !data.canView}
	<section class="panel">
		<p>You do not have <code>crm.view</code> permission for this organisation.</p>
	</section>
{:else}
	<div class="page-grid">
		<section class="panel portfolio">
			<form method="GET" class="filters">
				<label>
					<span>Search</span>
					<input
						name="q"
						value={data.filters.search ?? ''}
						placeholder="Opportunity or customer"
						maxlength="200"
					/>
				</label>
				<label>
					<span>Status</span>
					<select name="status">
						<option value="">All statuses</option>
						{#each ['open', 'won', 'lost', 'cancelled'] as status}
							<option value={status} selected={data.filters.status === status}
								>{statusLabels[status]}</option
							>
						{/each}
					</select>
				</label>
				<button class="secondary" type="submit">Filter</button>
			</form>

			{#if data.opportunities.length === 0}
				<div class="empty">
					<h2>No matching opportunities</h2>
					<p>Create the first opportunity when prospective work enters the CRM.</p>
				</div>
			{:else}
				<div class="opportunity-list">
					{#each data.opportunities as opportunity}
						<a class="opportunity-card" href={`/crm/opportunities/${opportunity.publicId}`}>
							<div class="card-title">
								<div>
									<strong>{opportunity.title}</strong>
									<span>{opportunity.primaryPartyDisplayName ?? 'No primary customer'}</span>
								</div>
								<span class={`status status-${opportunity.status}`}
									>{statusLabels[opportunity.status]}</span
								>
							</div>
							<div class="card-meta">
								<span>{opportunity.pipelineName} · {opportunity.stageName}</span>
								<span>{money(opportunity.estimatedValue, opportunity.currencyCode)}</span>
								<span
									>{opportunity.expectedCloseDate
										? `Expected ${new Date(opportunity.expectedCloseDate).toLocaleDateString()}`
										: 'No close date'}</span
								>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		{#if data.canManageOpportunities}
			<section class="panel create-panel">
				<p class="eyebrow">New opportunity</p>
				<h2>Capture prospective work</h2>
				{#if data.pipelines.length === 0}
					<p class="error">No active CRM pipeline is configured for this organisation.</p>
				{:else if data.partyCandidates.length === 0}
					<p class="error">
						Create an active CRM person or organisation before opening an opportunity.
					</p>
				{:else}
					<form method="POST" action="?/create" class="create-form">
						<label class="wide"
							><span>Title</span><input name="title" required maxlength="255" /></label
						>
						<label class="wide"
							><span>Primary customer</span>
							<select name="primaryPartyPublicId" required>
								<option value="">Choose CRM party</option>
								{#each data.partyCandidates as party}<option value={party.publicId}
										>{party.displayName}</option
									>{/each}
							</select>
						</label>
						<label class="wide"
							><span>Pipeline stage</span>
							<select name="stageSelection" required>
								<option value="">Choose stage</option>
								{#each data.pipelines as pipeline}
									<optgroup label={pipeline.name}>
										{#each pipeline.stages as stage}
											<option value={`${pipeline.publicId}::${stage.name}`}
												>{stage.name}{stage.probabilityPercent
													? ` · ${stage.probabilityPercent}%`
													: ''}</option
											>
										{/each}
									</optgroup>
								{/each}
							</select>
						</label>
						<label
							><span>Estimated value</span><input
								name="estimatedValue"
								inputmode="decimal"
								placeholder="0.00"
							/></label
						>
						<label
							><span>Currency</span><input name="currencyCode" maxlength="3" value="GBP" /></label
						>
						<label class="wide"
							><span>Expected close date</span><input name="expectedCloseDate" type="date" /></label
						>
						<label class="wide"
							><span>Description</span><textarea name="description" rows="5" maxlength="10000"
							></textarea></label
						>
						{#if form?.createError}<p class="error wide" role="alert">{form.createError}</p>{/if}
						<button type="submit">Create opportunity</button>
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
		max-width: 48rem;
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
	.filters {
		display: grid;
		grid-template-columns: 1fr 12rem auto;
		gap: 0.7rem;
		align-items: end;
		padding-bottom: 1rem;
		border-bottom: 1px solid #e5e5df;
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
	.secondary {
		background: white;
		color: #222;
	}
	.opportunity-list {
		display: grid;
		gap: 0.6rem;
		margin-top: 1rem;
	}
	.opportunity-card {
		display: grid;
		gap: 0.65rem;
		padding: 0.9rem;
		border: 1px solid #e0e0da;
		border-radius: 0.62rem;
		color: inherit;
		text-decoration: none;
	}
	.opportunity-card:hover {
		border-color: #999;
	}
	.card-title {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
	}
	.card-title > div {
		display: grid;
		gap: 0.18rem;
	}
	.card-title strong {
		font-size: 1.02rem;
	}
	.card-title span,
	.card-meta span {
		color: #666;
		font-size: 0.82rem;
	}
	.card-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 1rem;
	}
	.status {
		padding: 0.26rem 0.48rem;
		border-radius: 999px;
		background: #ecece7;
		font-size: 0.74rem !important;
		font-weight: 750;
	}
	.status-open {
		background: #e7efff;
		color: #234b85 !important;
	}
	.status-won {
		background: #e4f5e8;
		color: #285f35 !important;
	}
	.status-lost,
	.status-cancelled {
		background: #f1ece9;
		color: #76544a !important;
	}
	.create-panel h2,
	.empty h2 {
		margin: 0.35rem 0;
	}
	.create-form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.error {
		color: #941c1c;
	}
	.empty {
		padding: 2rem 0.5rem;
		text-align: center;
		color: #666;
	}
	@media (max-width: 900px) {
		.page-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 620px) {
		.filters,
		.create-form {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
	}
</style>
