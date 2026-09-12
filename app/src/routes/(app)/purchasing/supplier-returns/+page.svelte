<script lang="ts">
	let { data } = $props();

	function date(value: Date | string | null | undefined) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);
	}

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}
</script>

<svelte:head><title>Supplier returns · Purchasing · NuBlox</title></svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Procurement</p>
		<h1>Supplier quotation returns</h1>
		<p>Submitted RFQ responses from suppliers within your effective project scope.</p>
	</div>
	<a href="/purchasing">Back to purchasing</a>
</section>

{#if !data.canView}
	<section class="notice">
		<h2>Purchasing access is not enabled</h2>
		<p>Your current role does not grant <code>procurement.view</code>.</p>
	</section>
{:else if data.returns.length === 0}
	<section class="notice">
		<h2>No supplier returns yet</h2>
		<p>Responses submitted through the supplier portal will appear here automatically.</p>
	</section>
{:else}
	<div class="return-list">
		{#each data.returns as response}
			<article class="return-card">
				<header>
					<div>
						<p class="reference">{response.rfqNumber} · submission {response.submissionNumber}</p>
						<h2>{response.rfqTitle}</h2>
						<p>{response.projectNumber} · {response.projectName} · {response.supplierName}</p>
					</div>
					<span class="status">{response.status}</span>
				</header>
				<div class="metadata">
					<span>Submitted · {date(response.submittedAt)}</span><span
						>Valid until · {date(response.validUntil)}</span
					><span>Supplier ref · {response.supplierReference ?? '—'}</span>
				</div>
				<div class="table">
					<div class="row head">
						<span>Line</span><span>Description</span><span>Requested</span><span>Offered</span><span
							>Unit rate</span
						><span>Lead</span>
					</div>
					{#each response.items as item}
						<div class="row">
							<span>{item.lineNumber}</span><span>{item.description}</span><span
								>{item.requestedQuantity}</span
							><span>{item.offeredQuantity}</span><span
								>{money(item.unitRate, response.currencyCode)}</span
							><span>{item.leadTimeDays === null ? '—' : `${item.leadTimeDays} days`}</span>
						</div>
						{#if item.qualificationNote}<p class="qualification">
								<strong>Qualification:</strong>
								{item.qualificationNote}
							</p>{/if}
					{/each}
				</div>
			</article>
		{/each}
	</div>
{/if}

<style>
	.page-header {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: end;
		margin-bottom: 1.25rem;
	}
	.page-header a {
		border: 1px solid #aaa;
		border-radius: 0.5rem;
		padding: 0.65rem 0.85rem;
		color: inherit;
		text-decoration: none;
		font-weight: 700;
	}
	.eyebrow,
	.reference {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #666;
	}
	h1 {
		margin: 0.2rem 0;
	}
	.page-header p,
	.return-card p,
	.notice p {
		color: #60605a;
	}
	.notice,
	.return-card {
		border: 1px solid #ddd;
		border-radius: 0.75rem;
		padding: 1rem;
		background: white;
	}
	.return-list {
		display: grid;
		gap: 1rem;
	}
	.return-card header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.return-card h2 {
		margin: 0.2rem 0;
	}
	.status {
		height: fit-content;
		border-radius: 999px;
		padding: 0.35rem 0.6rem;
		background: #e2f3e7;
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: capitalize;
	}
	.metadata {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.25rem;
		margin: 1rem 0;
		color: #666;
		font-size: 0.86rem;
	}
	.table {
		border: 1px solid #ddd;
		border-radius: 0.55rem;
		overflow-x: auto;
	}
	.row {
		min-width: 50rem;
		display: grid;
		grid-template-columns: 4rem minmax(14rem, 1fr) 7rem 7rem 9rem 8rem;
		gap: 0.6rem;
		padding: 0.65rem 0.75rem;
		border-top: 1px solid #eee;
	}
	.row.head {
		border-top: 0;
		background: #f4f4ef;
		font-weight: 800;
	}
	.qualification {
		min-width: 50rem;
		box-sizing: border-box;
		margin: 0;
		padding: 0.5rem 0.75rem 0.75rem;
		border-top: 1px dashed #eee;
	}
	@media (max-width: 760px) {
		.page-header,
		.return-card header {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
