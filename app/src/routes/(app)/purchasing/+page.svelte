<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currencyCode = 'GBP') {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: currencyCode,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(Number(value));
	}

	function date(value: Date | string | null | undefined) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
	}
</script>

<svelte:head>
	<title>Purchasing · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Procurement</p>
		<h1>Purchasing</h1>
		<p>
			Project-scoped procurement from requirement through enquiry, controlled purchase-order issue
			and receipt. Suppliers remain CRM parties; NuBlox does not maintain a duplicate supplier
			master.
		</p>
	</div>
	{#if data.canManagePackages}<a class="header-action" href="#create-package">New package</a>{/if}
</section>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

{#if !data.canView}
	<section class="notice">
		<h2>Purchasing access is not enabled</h2>
		<p>Your current role does not grant <code>procurement.view</code>.</p>
	</section>
{:else}
	<section class="metrics" aria-label="Procurement overview">
		<article><span>Packages</span><strong>{data.packages.length}</strong></article>
		<article><span>Enquiries</span><strong>{data.rfqs.length}</strong></article>
		<article><span>Purchase orders</span><strong>{data.orders.length}</strong></article>
		<article><span>Eligible suppliers</span><strong>{data.suppliers.length}</strong></article>
	</section>

	<nav class="workspace-tabs" aria-label="Purchasing registers">
		<a href="#package-register">Packages</a>
		<a href="#rfq-register">Enquiries</a>
		<a href="#po-register">Purchase orders</a>
	</nav>

	<section class="workspace-section" id="package-register">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Requirements</p>
				<h2>Procurement packages</h2>
			</div>
			<span class="count">{data.packages.length}</span>
		</div>
		{#if data.packages.length === 0}
			<div class="empty-state">
				<h3>No procurement packages</h3>
				<p>
					Create a package against a project to establish the requirement before enquiry or order.
				</p>
			</div>
		{:else}
			<div class="register-list">
				{#each data.packages as procurementPackage}
					<article class="record-card">
						<header>
							<div>
								<p class="reference">{procurementPackage.packageNumber}</p>
								<h3>{procurementPackage.title}</h3>
								<p class="muted">
									{procurementPackage.projectNumber} · {procurementPackage.projectName} · {procurementPackage.typeName}
								</p>
							</div>
							<span class="status">{procurementPackage.status}</span>
						</header>
						<div class="metadata-row">
							<span
								>{procurementPackage.itemCount} requirement{procurementPackage.itemCount === 1
									? ''
									: 's'}</span
							>
							<span
								>{procurementPackage.rfqCount} enquiry record{procurementPackage.rfqCount === 1
									? ''
									: 's'}</span
							>
							<span>Required · {date(procurementPackage.requiredByDate)}</span>
						</div>
						{#if procurementPackage.description}<p>{procurementPackage.description}</p>{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="workspace-section" id="rfq-register">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Supplier enquiry</p>
				<h2>Enquiries / RFQs</h2>
			</div>
			<span class="count">{data.rfqs.length}</span>
		</div>
		{#if data.rfqs.length === 0}
			<div class="empty-state">
				<h3>No enquiries yet</h3>
				<p>Create an RFQ from a procurement package.</p>
			</div>
		{:else}
			<div class="register-list">
				{#each data.rfqs as rfq}
					<article class="record-card rfq-card">
						<header>
							<div>
								<p class="reference">{rfq.rfqNumber}</p>
								<h3>{rfq.latestVersion?.title ?? rfq.packageTitle}</h3>
								<p class="muted">{rfq.packageNumber} · {rfq.packageTitle}</p>
							</div>
							<span class="status">{rfq.latestVersion?.status ?? rfq.status}</span>
						</header>
						{#if rfq.latestVersion}
							<p class="metadata-row">
								<span>Version {rfq.latestVersion.versionNumber}</span>
								<span>Response due · {date(rfq.latestVersion.responseDeadlineAt)}</span>
							</p>
						{/if}
						{#if data.canIssueRfqs && rfq.latestVersion?.status === 'draft'}
							<form method="POST" action="?/issueRfq" class="inline-form">
								<input type="hidden" name="rfqPublicId" value={rfq.publicId} />
								<label>
									Supplier
									<select name="supplierPublicId" required>
										<option value="">Select supplier</option>
										{#each data.suppliers as supplier}<option value={supplier.publicId}
												>{supplier.displayName}</option
											>{/each}
									</select>
								</label>
								<button type="submit">Issue enquiry</button>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="workspace-section" id="po-register">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Commitments</p>
				<h2>Purchase orders</h2>
			</div>
			<span class="count">{data.orders.length}</span>
		</div>
		{#if data.orders.length === 0}
			<div class="empty-state">
				<h3>No purchase orders</h3>
				<p>Create a supplier order against a project.</p>
			</div>
		{:else}
			<div class="register-list">
				{#each data.orders as order}
					<article class="record-card po-card">
						<header>
							<div>
								<p class="reference">{order.purchaseOrderNumber}</p>
								<h3>{order.latestVersion?.title ?? order.supplierName}</h3>
								<p class="muted">{order.projectNumber} · {order.supplierName} · {order.typeName}</p>
							</div>
							<span class="status">{order.latestVersion?.status ?? order.status}</span>
						</header>
						<p class="money-value">{money(order.netTotal, order.currencyCode)}</p>
						<p class="metadata-row">
							<span>Version {order.latestVersion?.versionNumber ?? '—'}</span>
							<span>{order.items.length} line{order.items.length === 1 ? '' : 's'}</span>
							<span>{order.receiptCount} receipt{order.receiptCount === 1 ? '' : 's'}</span>
						</p>
						<div class="inline-actions">
							{#if data.canApprovePurchaseOrders && order.latestVersion?.status === 'draft'}
								<form method="POST" action="?/approvePurchaseOrder">
									<input type="hidden" name="purchaseOrderPublicId" value={order.publicId} />
									<button type="submit">Approve purchase order</button>
								</form>
							{/if}
							{#if data.canIssuePurchaseOrders && order.latestVersion?.status === 'approved'}
								<form method="POST" action="?/issuePurchaseOrder">
									<input type="hidden" name="purchaseOrderPublicId" value={order.publicId} />
									<button type="submit" class="primary">Issue purchase order</button>
								</form>
							{/if}
						</div>
						{#if data.canManageReceipts && order.latestVersion?.status === 'issued' && order.items[0]}
							<details class="record-receipt">
								<summary>Record receipt</summary>
								<form method="POST" action="?/recordReceipt" class="stack-form compact-form">
									<input type="hidden" name="purchaseOrderPublicId" value={order.publicId} />
									<label>
										Line
										<select name="lineNumber" required>
											{#each order.items as item}<option value={item.lineNumber}
													>{item.lineNumber} · {item.description}</option
												>{/each}
										</select>
									</label>
									<label
										>Receipt type<select name="receiptType"
											><option value="goods">Goods</option><option value="service">Service</option
											><option value="mixed">Mixed</option></select
										></label
									>
									<label
										>Quantity received<input
											name="quantityReceived"
											inputmode="decimal"
											required
											value="1"
										/></label
									>
									<label
										>Quantity rejected<input
											name="quantityRejected"
											inputmode="decimal"
											value="0"
										/></label
									>
									<label
										>Supplier delivery reference<input
											name="supplierDeliveryReference"
											maxlength="160"
										/></label
									>
									<label>Notes<textarea name="notes" rows="2"></textarea></label>
									<button type="submit">Record confirmed receipt</button>
								</form>
							</details>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	{#if data.canManagePackages}
		<section class="action-panel" id="create-package">
			<p class="eyebrow">Plan procurement</p>
			<h2>Create procurement package</h2>
			<form method="POST" action="?/createPackage" class="stack-form">
				<div class="two-up">
					<label
						>Project<select name="projectPublicId" required
							><option value="">Select project</option>{#each data.projects as project}<option
									value={project.publicId}>{project.projectNumber} · {project.name}</option
								>{/each}</select
						></label
					>
					<label
						>Package type<select name="packageTypeCode" required
							><option value="">Select type</option>{#each data.packageTypes as type}<option
									value={type.code}>{type.name}</option
								>{/each}</select
						></label
					>
				</div>
				<label>Package title<input name="title" maxlength="255" required /></label>
				<label>Description<textarea name="description" rows="3"></textarea></label>
				<div class="three-up">
					<label>Currency<input name="currencyCode" value="GBP" maxlength="3" required /></label>
					<label>Required by<input type="date" name="requiredByDate" /></label>
					<label
						>Item type<select name="salesItemTypeId" required
							><option value="">Select item type</option>{#each data.salesItemTypes as type}<option
									value={type.id}>{type.name}</option
								>{/each}</select
						></label
					>
				</div>
				<label
					>Requirement description<input name="lineDescription" maxlength="10000" required /></label
				>
				<div class="three-up">
					<label>Quantity<input name="quantity" inputmode="decimal" value="1" required /></label>
					<label
						>Unit<select name="unitOfMeasureId"
							><option value="">No unit</option>{#each data.units as unit}<option value={unit.id}
									>{unit.code} · {unit.name}</option
								>{/each}</select
						></label
					>
					<label>Target unit cost<input name="targetUnitCost" inputmode="decimal" /></label>
				</div>
				<button type="submit">Create procurement package</button>
			</form>
		</section>
	{/if}

	{#if data.canManageRfqs}
		<section class="action-panel" id="create-rfq">
			<p class="eyebrow">Supplier enquiry</p>
			<h2>Create enquiry / RFQ</h2>
			<form method="POST" action="?/createRfq" class="stack-form">
				<label
					>Procurement package<select name="packagePublicId" required
						><option value="">Select package</option
						>{#each data.packages as procurementPackage}<option value={procurementPackage.publicId}
								>{procurementPackage.packageNumber} · {procurementPackage.title}</option
							>{/each}</select
					></label
				>
				<label>RFQ title<input name="title" maxlength="255" required /></label>
				<label>Response deadline<input type="datetime-local" name="responseDeadlineAt" /></label>
				<button type="submit">Create RFQ draft</button>
			</form>
		</section>
	{/if}

	{#if data.canManagePurchaseOrders}
		<section class="action-panel" id="create-po">
			<p class="eyebrow">Controlled commitment</p>
			<h2>Create purchase order</h2>
			<form method="POST" action="?/createPurchaseOrder" class="stack-form">
				<div class="two-up">
					<label
						>Project<select name="projectPublicId" required
							><option value="">Select project</option>{#each data.projects as project}<option
									value={project.publicId}>{project.projectNumber} · {project.name}</option
								>{/each}</select
						></label
					>
					<label
						>Supplier<select name="supplierPublicId" required
							><option value="">Select supplier</option>{#each data.suppliers as supplier}<option
									value={supplier.publicId}>{supplier.displayName}</option
								>{/each}</select
						></label
					>
				</div>
				<div class="two-up">
					<label
						>Order type<select name="purchaseOrderTypeCode" required
							><option value="">Select type</option>{#each data.purchaseOrderTypes as type}<option
									value={type.code}>{type.name}</option
								>{/each}</select
						></label
					>
					<label
						>Procurement package <small>optional</small><select name="packagePublicId"
							><option value="">Direct project order</option
							>{#each data.packages as procurementPackage}<option
									value={procurementPackage.publicId}
									>{procurementPackage.packageNumber} · {procurementPackage.title}</option
								>{/each}</select
						></label
					>
				</div>
				<label>Purchase-order title<input name="title" maxlength="255" required /></label>
				<div class="three-up">
					<label>Supplier reference<input name="supplierReference" maxlength="160" /></label>
					<label>Order date<input type="date" name="orderDate" /></label>
					<label>Required by<input type="date" name="requiredByDate" /></label>
				</div>
				<div class="three-up">
					<label>Currency<input name="currencyCode" value="GBP" maxlength="3" required /></label>
					<label
						>Item type<select name="salesItemTypeId" required
							><option value="">Select item type</option>{#each data.salesItemTypes as type}<option
									value={type.id}>{type.name}</option
								>{/each}</select
						></label
					>
					<label
						>Unit<select name="unitOfMeasureId"
							><option value="">No unit</option>{#each data.units as unit}<option value={unit.id}
									>{unit.code} · {unit.name}</option
								>{/each}</select
						></label
					>
				</div>
				<label
					>Order line description<input name="lineDescription" maxlength="10000" required /></label
				>
				<div class="two-up">
					<label>Quantity<input name="quantity" inputmode="decimal" value="1" required /></label>
					<label>Unit rate<input name="unitRate" inputmode="decimal" required /></label>
				</div>
				<button type="submit">Create purchase-order draft</button>
			</form>
		</section>
	{/if}
{/if}

<style>
	.page-header,
	.section-heading,
	.record-card header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}
	.page-header {
		margin-bottom: 1.5rem;
		align-items: end;
	}
	.page-header > div {
		max-width: 72ch;
	}
	.page-header h1 {
		margin: 0.15rem 0 0.45rem;
		font-size: clamp(2rem, 4vw, 3.2rem);
		letter-spacing: -0.04em;
	}
	.page-header p:last-child {
		color: #5d6675;
		line-height: 1.55;
	}
	.eyebrow {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.72rem;
		font-weight: 800;
		color: #667085;
	}
	.header-action,
	button {
		font: inherit;
		font-weight: 750;
		border: 1px solid #111827;
		border-radius: 0.55rem;
		padding: 0.68rem 0.9rem;
		background: #111827;
		color: white;
		text-decoration: none;
		cursor: pointer;
	}
	.notice,
	.workspace-section,
	.action-panel {
		background: white;
		border: 1px solid #d9dde5;
		border-radius: 0.85rem;
		padding: 1.15rem;
		margin-bottom: 1rem;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.metrics article {
		background: white;
		border: 1px solid #d9dde5;
		border-radius: 0.75rem;
		padding: 1rem;
		display: grid;
		gap: 0.25rem;
	}
	.metrics span {
		color: #667085;
		font-size: 0.82rem;
	}
	.metrics strong {
		font-size: 1.55rem;
	}
	.workspace-tabs {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}
	.workspace-tabs a {
		color: #344054;
		background: #f2f4f7;
		border-radius: 999px;
		padding: 0.45rem 0.75rem;
		text-decoration: none;
		font-weight: 700;
	}
	.section-heading {
		align-items: center;
		margin-bottom: 0.9rem;
	}
	.section-heading h2,
	.action-panel h2 {
		margin: 0.2rem 0 0;
	}
	.count {
		min-width: 2rem;
		text-align: center;
		padding: 0.3rem 0.55rem;
		border-radius: 999px;
		background: #f2f4f7;
		font-weight: 750;
	}
	.register-list {
		display: grid;
		gap: 0.75rem;
	}
	.record-card {
		border: 1px solid #e4e7ec;
		border-radius: 0.75rem;
		padding: 1rem;
	}
	.record-card h3 {
		margin: 0.1rem 0 0.3rem;
	}
	.reference {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #475467;
	}
	.muted,
	.metadata-row {
		color: #667085;
	}
	.metadata-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.85rem;
		font-size: 0.84rem;
	}
	.status {
		text-transform: capitalize;
		font-size: 0.78rem;
		font-weight: 800;
		background: #f2f4f7;
		border-radius: 999px;
		padding: 0.35rem 0.6rem;
	}
	.money-value {
		font-size: 1.25rem;
		font-weight: 800;
		margin: 0.6rem 0;
	}
	.empty-state {
		border: 1px dashed #cfd4dc;
		border-radius: 0.7rem;
		padding: 1rem;
		color: #667085;
	}
	.empty-state h3 {
		margin-top: 0;
		color: #344054;
	}
	.stack-form {
		display: grid;
		gap: 0.8rem;
		margin-top: 0.9rem;
	}
	.compact-form {
		max-width: 42rem;
	}
	.two-up {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.three-up {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}
	label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.84rem;
		font-weight: 700;
	}
	label small {
		font-weight: 500;
		color: #667085;
	}
	input,
	select,
	textarea {
		min-width: 0;
		font: inherit;
		border: 1px solid #b8c0cc;
		border-radius: 0.5rem;
		padding: 0.62rem;
		background: white;
	}
	textarea {
		resize: vertical;
	}
	.inline-form {
		display: flex;
		gap: 0.7rem;
		align-items: end;
		flex-wrap: wrap;
		margin-top: 0.8rem;
	}
	.inline-form label {
		min-width: min(22rem, 100%);
	}
	.inline-actions {
		display: flex;
		gap: 0.55rem;
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}
	.record-receipt {
		margin-top: 0.8rem;
	}
	details summary {
		cursor: pointer;
		font-weight: 750;
		color: #344054;
	}
	.error {
		border: 1px solid #f0a5a5;
		background: #fff1f1;
		color: #8a1c1c;
		padding: 0.75rem;
		border-radius: 0.65rem;
		margin-bottom: 1rem;
	}
	@media (max-width: 800px) {
		.page-header {
			display: grid;
		}
		.metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.two-up,
		.three-up {
			grid-template-columns: 1fr;
		}
	}
</style>
