<script lang="ts">
	let { data, form } = $props();

	const selectedProject = $derived(
		data.projects.find((project) => project.publicId === data.selectedProjectPublicId) ?? null
	);
	const selectedCostCodes = $derived(
		selectedProject ? data.costCodes.filter((row) => row.projectId === selectedProject.id) : []
	);
	const selectedBudgets = $derived(
		selectedProject ? data.budgets.filter((row) => row.projectId === selectedProject.id) : []
	);
	const selectedOrders = $derived(
		selectedProject
			? data.purchaseOrders.filter((row) => row.projectPublicId === selectedProject.publicId)
			: []
	);
	const selectedVariations = $derived(
		selectedProject ? data.variations.filter((row) => row.projectId === selectedProject.id) : []
	);

	function money(value: string, currencyCode = 'GBP') {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: currencyCode,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(Number(value));
	}
</script>

<svelte:head>
	<title>Project cost control · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Commercial</p>
		<h1>Project cost control</h1>
		<p>
			Confidential project commercial position derived from approved budgets, authoritative issued
			purchase orders, receipts and controlled change. The reporting view does not maintain editable
			duplicate balances.
		</p>
	</div>
	{#if data.canManageCostCodes && selectedProject}<a class="header-action" href="#create-cost-code">New cost code</a>{/if}
</section>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

{#if !data.canView}
	<section class="notice">
		<h2>Commercial cost control is restricted</h2>
		<p>
			Project participation alone does not expose budgets, supplier rates, commitments or variation
			values. Your current role does not grant <code>commercial.cost_control.view</code>.
		</p>
	</section>
{:else}
	<section class="project-filter">
		<form method="GET">
			<label>
				Project
				<select name="project" onchange="this.form?.requestSubmit()">
					{#each data.projects as project}
						<option value={project.publicId} selected={project.publicId === data.selectedProjectPublicId}>
							{project.projectNumber} · {project.name}
						</option>
					{/each}
				</select>
			</label>
			<noscript><button type="submit">View project</button></noscript>
		</form>
	</section>

	{#if data.position && selectedProject}
		<section class="position" aria-label="Project commercial position">
			<div class="position-heading">
				<div>
					<p class="eyebrow">Controlled position</p>
					<h2>{selectedProject.projectNumber} · {selectedProject.name}</h2>
				</div>
				<span>{data.position.currencyCode}</span>
			</div>
			<div class="metrics">
				<article><span>Approved baseline budget</span><strong>{money(data.position.approvedBaselineBudget, data.position.currencyCode)}</strong></article>
				<article><span>Issued PO commitment</span><strong>{money(data.position.issuedPurchaseOrderCommitment, data.position.currencyCode)}</strong></article>
				<article><span>Cost-code classified</span><strong>{money(data.position.classifiedCommitment, data.position.currencyCode)}</strong></article>
				<article><span>Accepted receipt cost</span><strong>{money(data.position.acceptedReceiptCost, data.position.currencyCode)}</strong></article>
				<article><span>Approved change</span><strong>{money(data.position.approvedChange, data.position.currencyCode)}</strong></article>
				<article><span>Pending change exposure</span><strong>{money(data.position.pendingChangeExposure, data.position.currencyCode)}</strong></article>
				<article><span>Budget headroom</span><strong>{money(data.position.budgetHeadroom, data.position.currencyCode)}</strong></article>
				<article><span>Exposed headroom</span><strong>{money(data.position.exposedHeadroom, data.position.currencyCode)}</strong></article>
			</div>
		</section>
	{/if}

	<section class="workspace-section" id="cost-code-register">
		<div class="section-heading"><div><p class="eyebrow">Classification</p><h2>Project cost codes</h2></div><span class="count">{selectedCostCodes.length}</span></div>
		{#if selectedCostCodes.length === 0}
			<div class="empty-state"><h3>No project cost codes</h3><p>Create the first classification before setting a budget or classifying commitments.</p></div>
		{:else}
			<div class="register-list">
				{#each selectedCostCodes as costCode}
					<article class="record-card">
						<header><div><p class="reference">{costCode.code}</p><h3>{costCode.name}</h3><p class="muted">{costCode.categoryName}</p></div><span class="status">{costCode.isActive ? 'active' : 'inactive'}</span></header>
						{#if costCode.description}<p>{costCode.description}</p>{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="workspace-section" id="budget-register">
		<div class="section-heading"><div><p class="eyebrow">Baseline</p><h2>Project budgets</h2></div><span class="count">{selectedBudgets.length}</span></div>
		{#if selectedBudgets.length === 0}
			<div class="empty-state"><h3>No controlled budget</h3><p>Create a draft budget and approve it to establish the commercial baseline.</p></div>
		{:else}
			<div class="register-list">
				{#each selectedBudgets as budget}
					<article class="record-card budget-card">
						<header>
							<div><p class="reference">{budget.budgetNumber}</p><h3>{budget.name}</h3></div>
							<span class="status">{budget.latestVersion?.status ?? budget.status}</span>
						</header>
						<p class="money-value">{money(budget.total, budget.latestVersion?.currencyCode ?? 'GBP')}</p>
						<p class="muted">Version {budget.latestVersion?.versionNumber ?? '—'} · {budget.latestVersion?.currencyCode ?? '—'}</p>
						{#if data.canApproveBudgets && budget.latestVersion?.status === 'draft' && selectedProject}
							<form method="POST" action="?/approveBudget">
								<input type="hidden" name="budgetPublicId" value={budget.publicId} />
								<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
								<button type="submit">Approve baseline budget</button>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="workspace-section" id="commitment-register">
		<div class="section-heading"><div><p class="eyebrow">Authoritative source facts</p><h2>Purchase-order commitments</h2></div><span class="count">{selectedOrders.length}</span></div>
		<p class="section-copy">Purchase-order value stays authoritative in Procurement. Commercial control only classifies the issued line against a project cost code.</p>
		{#if selectedOrders.length === 0}
			<div class="empty-state"><h3>No project purchase orders</h3><p>Issue a purchase order in Purchasing before classifying its commitment.</p></div>
		{:else}
			<div class="register-list">
				{#each selectedOrders as order}
					<article class="record-card commitment-card">
						<header><div><p class="reference">{order.purchaseOrderNumber}</p><h3>{order.supplierName}</h3><p class="muted">{order.typeName} · {order.currencyCode}</p></div><span class="status">{order.status}</span></header>
						{#if data.canManageCostCodes && selectedCostCodes.length > 0 && selectedProject}
							<form method="POST" action="?/allocatePurchaseOrderLine" class="inline-form">
								<input type="hidden" name="purchaseOrderPublicId" value={order.publicId} />
								<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
								<label>PO line number<input name="lineNumber" type="number" min="1" value="10" required /></label>
								<label>Cost code<select name="costCodePublicId" required><option value="">Select cost code</option>{#each selectedCostCodes as costCode}<option value={costCode.publicId}>{costCode.code} · {costCode.name}</option>{/each}</select></label>
								<button type="submit">Classify full line</button>
							</form>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="workspace-section" id="variation-register">
		<div class="section-heading"><div><p class="eyebrow">Controlled change</p><h2>Commercial variations</h2></div><span class="count">{selectedVariations.length}</span></div>
		{#if selectedVariations.length === 0}
			<div class="empty-state"><h3>No commercial variations</h3><p>Create a cost, revenue or internal variation and issue a locked version before recording a decision.</p></div>
		{:else}
			<div class="register-list">
				{#each selectedVariations as variation}
					<article class="record-card variation-card">
						<header>
							<div><p class="reference">{variation.variationNumber}</p><h3>{variation.title}</h3><p class="muted">{variation.typeName} · {variation.commercialSide}</p></div>
							<span class="status">{variation.latestVersion?.status ?? variation.status}</span>
						</header>
						<p class="money-value">{money(variation.versionTotal, variation.currencyCode)}</p>
						{#if variation.latestDecision}<p class="decision">Decision · <strong>{variation.latestDecision}</strong>{#if variation.decisionAmount} · {money(variation.decisionAmount, variation.currencyCode)}{/if}</p>{/if}
						<div class="inline-actions">
							{#if data.canIssueVariations && variation.latestVersion?.status === 'draft' && selectedProject}
								<form method="POST" action="?/issueVariation">
									<input type="hidden" name="variationPublicId" value={variation.publicId} />
									<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
									<button type="submit">Issue variation</button>
								</form>
							{/if}
						</div>
						{#if data.canDecideVariations && variation.latestVersion?.status === 'issued' && selectedProject}
							<details class="decision-panel">
								<summary>Record decision</summary>
								<form method="POST" action="?/decideVariation" class="stack-form compact-form">
									<input type="hidden" name="variationPublicId" value={variation.publicId} />
									<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
									<label>Decision<select name="decision" required><option value="accepted">Accepted</option><option value="partially_accepted">Partially accepted</option><option value="pending">Pending</option><option value="rejected">Rejected</option><option value="withdrawn">Withdrawn</option></select></label>
									<label>Decision amount <small>blank = full amount for accepted decisions</small><input name="decisionAmount" inputmode="decimal" /></label>
									<label>Comments<textarea name="comments" rows="2"></textarea></label>
									<button type="submit">Record variation decision</button>
								</form>
							</details>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	{#if selectedProject && data.canManageCostCodes}
		<section class="action-panel" id="create-cost-code">
			<p class="eyebrow">Classification</p><h2>Create project cost code</h2>
			<form method="POST" action="?/createCostCode" class="stack-form">
				<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
				<label>Project<input value={`${selectedProject.projectNumber} · ${selectedProject.name}`} disabled /></label>
				<div class="three-up">
					<label>Cost category<select name="categoryCode" required><option value="">Select category</option>{#each data.costCategories as category}<option value={category.code}>{category.name}</option>{/each}</select></label>
					<label>Cost code<input name="code" maxlength="120" required /></label>
					<label>Name<input name="name" maxlength="255" required /></label>
				</div>
				<label>Description<textarea name="description" rows="2"></textarea></label>
				<button type="submit">Create cost code</button>
			</form>
		</section>
	{/if}

	{#if selectedProject && data.canManageBudgets && selectedCostCodes.length > 0}
		<section class="action-panel" id="create-budget">
			<p class="eyebrow">Controlled baseline</p><h2>Create project budget</h2>
			<form method="POST" action="?/createBudget" class="stack-form">
				<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
				<label>Cost code<select name="costCodePublicId" required><option value="">Select cost code</option>{#each selectedCostCodes as costCode}<option value={costCode.publicId}>{costCode.code} · {costCode.name}</option>{/each}</select></label>
				<div class="three-up">
					<label>Budget name<input name="name" maxlength="255" required /></label>
					<label>Currency<input name="currencyCode" value="GBP" maxlength="3" required /></label>
					<label>Effective date<input type="date" name="effectiveOn" /></label>
				</div>
				<label>Description<input name="description" maxlength="500" /></label>
				<label>Budget amount<input name="budgetAmount" inputmode="decimal" required /></label>
				<button type="submit">Create budget draft</button>
			</form>
		</section>
	{/if}

	{#if selectedProject && data.canManageVariations}
		<section class="action-panel" id="create-variation">
			<p class="eyebrow">Controlled change</p><h2>Create commercial variation</h2>
			<form method="POST" action="?/createVariation" class="stack-form">
				<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
				<div class="two-up">
					<label>Variation type<select name="variationTypeCode" required><option value="">Select type</option>{#each data.variationTypes as type}<option value={type.code}>{type.name}</option>{/each}</select></label>
					<label>Commercial side<select name="commercialSide" required><option value="cost">Cost / downstream</option><option value="revenue">Revenue / upstream</option><option value="internal">Internal</option></select></label>
				</div>
				<div class="two-up">
					<label>Cost code <small>optional</small><select name="costCodePublicId"><option value="">No cost-code classification</option>{#each selectedCostCodes as costCode}<option value={costCode.publicId}>{costCode.code} · {costCode.name}</option>{/each}</select></label>
					<label>Purchase order <small>cost-side only, optional</small><select name="purchaseOrderPublicId"><option value="">No linked purchase order</option>{#each selectedOrders as order}<option value={order.publicId}>{order.purchaseOrderNumber} · {order.supplierName}</option>{/each}</select></label>
				</div>
				<label>Variation title<input name="title" maxlength="500" required /></label>
				<label>Description<textarea name="description" rows="3" required></textarea></label>
				<div class="three-up">
					<label>Currency<input name="currencyCode" value="GBP" maxlength="3" required /></label>
					<label>Quantity<input name="quantity" value="1" inputmode="decimal" required /></label>
					<label>Unit rate<input name="unitRate" inputmode="decimal" required /></label>
				</div>
				<button type="submit">Create variation draft</button>
			</form>
		</section>
	{/if}
{/if}

<style>
	.page-header,
	.section-heading,
	.record-card header,
	.position-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
	.page-header { margin-bottom: 1.5rem; align-items: end; }
	.page-header > div { max-width: 74ch; }
	.page-header h1 { margin: 0.15rem 0 0.45rem; font-size: clamp(2rem, 4vw, 3.2rem); letter-spacing: -0.04em; }
	.page-header p:last-child,
	.section-copy { color: #5d6675; line-height: 1.55; }
	.eyebrow { margin: 0; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.72rem; font-weight: 800; color: #667085; }
	.header-action,
	button { font: inherit; font-weight: 750; border: 1px solid #111827; border-radius: 0.55rem; padding: 0.68rem 0.9rem; background: #111827; color: white; text-decoration: none; cursor: pointer; }
	.notice,
	.project-filter,
	.position,
	.workspace-section,
	.action-panel { background: white; border: 1px solid #d9dde5; border-radius: 0.85rem; padding: 1.15rem; margin-bottom: 1rem; }
	.project-filter form { max-width: 38rem; }
	.project-filter label { display: grid; gap: 0.35rem; font-size: 0.84rem; font-weight: 700; }
	.position-heading { align-items: center; margin-bottom: 0.9rem; }
	.position-heading h2 { margin: 0.2rem 0 0; }
	.position-heading > span { font-weight: 800; background: #f2f4f7; border-radius: 999px; padding: 0.35rem 0.65rem; }
	.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.7rem; }
	.metrics article { border: 1px solid #e4e7ec; border-radius: 0.7rem; padding: 0.85rem; display: grid; gap: 0.35rem; }
	.metrics span { color: #667085; font-size: 0.78rem; }
	.metrics strong { font-size: 1.05rem; overflow-wrap: anywhere; }
	.section-heading { align-items: center; margin-bottom: 0.9rem; }
	.section-heading h2,
	.action-panel h2 { margin: 0.2rem 0 0; }
	.count { min-width: 2rem; text-align: center; padding: 0.3rem 0.55rem; border-radius: 999px; background: #f2f4f7; font-weight: 750; }
	.register-list { display: grid; gap: 0.75rem; }
	.record-card { border: 1px solid #e4e7ec; border-radius: 0.75rem; padding: 1rem; }
	.record-card h3 { margin: 0.1rem 0 0.3rem; }
	.reference { margin: 0; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; color: #475467; }
	.muted { color: #667085; }
	.status { text-transform: capitalize; font-size: 0.78rem; font-weight: 800; background: #f2f4f7; border-radius: 999px; padding: 0.35rem 0.6rem; }
	.money-value { font-size: 1.25rem; font-weight: 800; margin: 0.6rem 0; }
	.decision { color: #475467; }
	.empty-state { border: 1px dashed #cfd4dc; border-radius: 0.7rem; padding: 1rem; color: #667085; }
	.empty-state h3 { margin-top: 0; color: #344054; }
	.stack-form { display: grid; gap: 0.8rem; margin-top: 0.9rem; }
	.compact-form { max-width: 40rem; }
	.two-up { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
	.three-up { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; }
	label { display: grid; gap: 0.35rem; font-size: 0.84rem; font-weight: 700; }
	label small { font-weight: 500; color: #667085; }
	input,
	select,
	textarea { min-width: 0; font: inherit; border: 1px solid #b8c0cc; border-radius: 0.5rem; padding: 0.62rem; background: white; }
	textarea { resize: vertical; }
	.inline-form { display: flex; gap: 0.7rem; align-items: end; flex-wrap: wrap; margin-top: 0.8rem; }
	.inline-form label { min-width: 12rem; flex: 1; }
	.inline-actions { display: flex; gap: 0.55rem; flex-wrap: wrap; margin-top: 0.75rem; }
	.decision-panel { margin-top: 0.8rem; }
	details summary { cursor: pointer; font-weight: 750; color: #344054; }
	.error { border: 1px solid #f0a5a5; background: #fff1f1; color: #8a1c1c; padding: 0.75rem; border-radius: 0.65rem; margin-bottom: 1rem; }
	@media (max-width: 900px) {
		.metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (max-width: 700px) {
		.page-header { display: grid; }
		.metrics,
		.two-up,
		.three-up { grid-template-columns: 1fr; }
	}
</style>
