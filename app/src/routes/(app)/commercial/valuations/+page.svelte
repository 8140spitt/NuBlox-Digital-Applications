<script lang="ts">
	let { data, form } = $props();

	const selectedProject = $derived(
		data.projects.find((project) => project.publicId === data.selectedProjectPublicId) ?? null
	);

	function money(value: string, currencyCode: string) {
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
	<title>Commercial valuations · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Commercial</p>
		<h1>Valuations</h1>
		<p>
			Controlled supplier applications and assessments against authoritative issued purchase orders.
			Valuations remain commercial evidence and do not create or duplicate finance/AP transactions.
		</p>
	</div>
	{#if data.canManage && selectedProject}<a class="header-action" href="#create-valuation">New supplier application</a>{/if}
</section>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

{#if !data.canView}
	<section class="notice">
		<h2>Commercial valuations are restricted</h2>
		<p>Your current role does not grant confidential project commercial-control visibility.</p>
	</section>
{:else}
	<section class="project-filter">
		<form method="GET">
			<label>
				Project
				<select name="project">
					{#each data.projects as project}
						<option value={project.publicId} selected={project.publicId === data.selectedProjectPublicId}>
							{project.projectNumber} · {project.name}
						</option>
					{/each}
				</select>
			</label>
			<button type="submit">View project</button>
		</form>
	</section>

	<section class="workspace-section" id="valuation-register">
		<div class="section-heading">
			<div><p class="eyebrow">QS evidence</p><h2>Supplier applications</h2></div>
			<span class="count">{data.valuations.length}</span>
		</div>
		{#if data.valuations.length === 0}
			<div class="empty-state">
				<h3>No supplier applications</h3>
				<p>Create a valuation against an issued purchase order, then submit and assess it.</p>
			</div>
		{:else}
			<div class="register-list">
				{#each data.valuations as valuation}
					<article class="record-card valuation-card">
						<header>
							<div>
								<p class="reference">{valuation.valuationNumber}</p>
								<h3>{valuation.purchaseOrderNumber ?? 'Supplier application'}</h3>
								<p class="muted">{valuation.kind.replaceAll('_', ' ')} · Valuation date {date(valuation.valuationDate)}</p>
							</div>
							<span class="status">{valuation.status}</span>
						</header>
						<p class="money-value">{money(valuation.totalGrossValueToDate, valuation.currencyCode)}</p>
						<p class="metadata-row">
							<span>Submitted · {date(valuation.submittedAt)}</span>
							<span>Assessed · {date(valuation.assessedAt)}</span>
						</p>
						<div class="inline-actions">
							{#if data.canManage && valuation.status === 'draft' && selectedProject}
								<form method="POST" action="?/submitValuation">
									<input type="hidden" name="valuationPublicId" value={valuation.publicId} />
									<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
									<button type="submit">Submit application</button>
								</form>
							{/if}
							{#if data.canAssess && valuation.status === 'submitted' && selectedProject}
								<form method="POST" action="?/assessValuation">
									<input type="hidden" name="valuationPublicId" value={valuation.publicId} />
									<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
									<button type="submit" class="primary">Assess application</button>
								</form>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>

	{#if data.canManage && selectedProject}
		<section class="action-panel" id="create-valuation">
			<p class="eyebrow">Supplier application</p>
			<h2>Create valuation</h2>
			<form method="POST" action="?/createSupplierApplication" class="stack-form">
				<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
				<label>Project<input value={`${selectedProject.projectNumber} · ${selectedProject.name}`} disabled /></label>
				<label>
					Issued purchase order
					<select name="purchaseOrderPublicId" required>
						<option value="">Select purchase order</option>
						{#each data.purchaseOrders as order}<option value={order.publicId}>{order.purchaseOrderNumber} · {order.supplierName}</option>{/each}
					</select>
				</label>
				<label>
					Cost code <small>optional</small>
					<select name="costCodePublicId">
						<option value="">No cost-code classification</option>
						{#each data.costCodes as costCode}<option value={costCode.publicId}>{costCode.code} · {costCode.name}</option>{/each}
					</select>
				</label>
				<div class="two-up">
					<label>Valuation date<input type="date" name="valuationDate" required /></label>
					<label>Gross value to date<input name="grossValueToDate" inputmode="decimal" required /></label>
				</div>
				<label>Description<textarea name="description" rows="3" required></textarea></label>
				<button type="submit">Create supplier application</button>
			</form>
		</section>
	{/if}
{/if}

<style>
	.page-header,
	.section-heading,
	.record-card header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
	.page-header { margin-bottom: 1.5rem; align-items: end; }
	.page-header > div { max-width: 72ch; }
	.page-header h1 { margin: 0.15rem 0 0.45rem; font-size: clamp(2rem, 4vw, 3.2rem); letter-spacing: -0.04em; }
	.page-header p:last-child { color: #5d6675; line-height: 1.55; }
	.eyebrow { margin: 0; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.72rem; font-weight: 800; color: #667085; }
	.header-action,
	button { font: inherit; font-weight: 750; border: 1px solid #111827; border-radius: 0.55rem; padding: 0.68rem 0.9rem; background: #111827; color: white; text-decoration: none; cursor: pointer; }
	.notice,
	.project-filter,
	.workspace-section,
	.action-panel { background: white; border: 1px solid #d9dde5; border-radius: 0.85rem; padding: 1.15rem; margin-bottom: 1rem; }
	.project-filter form { display: flex; gap: 0.7rem; align-items: end; max-width: 45rem; }
	.project-filter label { flex: 1; }
	.section-heading { align-items: center; margin-bottom: 0.9rem; }
	.section-heading h2,
	.action-panel h2 { margin: 0.2rem 0 0; }
	.count { min-width: 2rem; text-align: center; padding: 0.3rem 0.55rem; border-radius: 999px; background: #f2f4f7; font-weight: 750; }
	.register-list { display: grid; gap: 0.75rem; }
	.record-card { border: 1px solid #e4e7ec; border-radius: 0.75rem; padding: 1rem; }
	.record-card h3 { margin: 0.1rem 0 0.3rem; }
	.reference { margin: 0; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.08em; color: #475467; }
	.muted,
	.metadata-row { color: #667085; }
	.metadata-row { display: flex; flex-wrap: wrap; gap: 0.85rem; font-size: 0.84rem; }
	.status { text-transform: capitalize; font-size: 0.78rem; font-weight: 800; background: #f2f4f7; border-radius: 999px; padding: 0.35rem 0.6rem; }
	.money-value { font-size: 1.25rem; font-weight: 800; margin: 0.6rem 0; }
	.empty-state { border: 1px dashed #cfd4dc; border-radius: 0.7rem; padding: 1rem; color: #667085; }
	.empty-state h3 { margin-top: 0; color: #344054; }
	.stack-form { display: grid; gap: 0.8rem; margin-top: 0.9rem; }
	.two-up { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
	label { display: grid; gap: 0.35rem; font-size: 0.84rem; font-weight: 700; }
	label small { font-weight: 500; color: #667085; }
	input,
	select,
	textarea { min-width: 0; font: inherit; border: 1px solid #b8c0cc; border-radius: 0.5rem; padding: 0.62rem; background: white; }
	textarea { resize: vertical; }
	.inline-actions { display: flex; gap: 0.55rem; flex-wrap: wrap; margin-top: 0.75rem; }
	.error { border: 1px solid #f0a5a5; background: #fff1f1; color: #8a1c1c; padding: 0.75rem; border-radius: 0.65rem; margin-bottom: 1rem; }
	@media (max-width: 700px) {
		.page-header,
		.project-filter form { display: grid; }
		.two-up { grid-template-columns: 1fr; }
	}
</style>
