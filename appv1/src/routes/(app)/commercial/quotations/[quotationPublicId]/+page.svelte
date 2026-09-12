<script lang="ts">
	let { data, form } = $props();
	const statusLabels: Record<string, string> = {
		draft: 'Draft',
		issued: 'Issued',
		accepted: 'Accepted',
		rejected: 'Rejected',
		revision_requested: 'Revision requested',
		expired: 'Expired',
		superseded: 'Superseded',
		withdrawn: 'Withdrawn'
	};
	const responseLabels: Record<string, string> = {
		accepted: 'Accepted',
		rejected: 'Rejected',
		revision_requested: 'Revision requested',
		withdrawn_by_customer: 'Withdrawn by customer'
	};
	function money(value: string) {
		const amount = Number(value);
		return Number.isFinite(amount)
			? new Intl.NumberFormat('en-GB', {
					style: 'currency',
					currency: data.version.currencyCode
				}).format(amount)
			: `${data.version.currencyCode} ${value}`;
	}
	function dateInput(value: Date | null) {
		return value ? new Date(value).toISOString().slice(0, 10) : '';
	}
	function dateTimeInput(value: Date) {
		const d = new Date(value);
		const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
		return local.toISOString().slice(0, 16);
	}
</script>

<svelte:head><title>{data.quotation.quotationNumber} · Quotation · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/commercial/quotations">Quotations</a><span aria-hidden="true">/</span><span
		>{data.quotation.quotationNumber}</span
	><a class="sibling" href="/commercial/estimates">Estimates</a>
</nav>
<section class="page-heading">
	<div>
		<p class="eyebrow">{data.quotation.quotationNumber}</p>
		<h1>{data.version.title}</h1>
		<p>
			{data.quotation.customerDisplayName}{data.quotation.opportunityTitle
				? ` · ${data.quotation.opportunityTitle}`
				: ''}
		</p>
	</div>
	<span class={`status status-${data.effectiveStatus}`}
		>{statusLabels[data.effectiveStatus] ?? data.effectiveStatus}</span
	>
</section>

<div class="version-bar" aria-label="Quotation versions">
	{#each data.versions as version}<a
			class:active={version.id === data.version.id}
			href={`?version=${version.versionNumber}`}
			>v{version.versionNumber} · {version.versionStatus}</a
		>{/each}
</div>
{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="metrics">
	<div><span>Net</span><strong>{money(data.netTotal)}</strong></div>
	<div><span>Tax</span><strong>{money(data.taxTotal)}</strong></div>
	<div><span>Gross</span><strong>{money(data.grossTotal)}</strong></div>
	<div>
		<span>Valid until</span><strong
			>{data.version.validUntil
				? new Date(data.version.validUntil).toLocaleDateString()
				: 'Not set'}</strong
		>
	</div>
</section>

<div class="workspace-grid">
	<section class="panel lines-panel">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Version {data.version.versionNumber}</p>
				<h2>Quotation lines</h2>
			</div>
			<span>{data.items.length} lines</span>
		</div>
		{#if data.items.length === 0}<div class="empty">No quotation lines.</div>{:else}<div
				class="lines"
			>
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
								<strong>{money(item.grossAmount)}</strong><span
									>Net {money(item.netAmount)} · Tax {money(item.taxAmount)}</span
								>
							</div>
						</div>
						<div class="line-meta">
							<span>{item.quantity} × {money(item.unitRate)}</span
							>{#if item.taxes.length}{#each item.taxes as tax}<span
										>{tax.taxCategoryName} {tax.appliedRatePercent}%</span
									>{/each}{:else}<span>No tax snapshot</span>{/if}
						</div>
						{#if data.canManageQuotations && data.version.versionStatus === 'draft'}
							<div class="line-actions">
								<form method="POST" action="?/setTax" class="tax-form">
									<input
										type="hidden"
										name="versionNumber"
										value={data.version.versionNumber}
									/><input type="hidden" name="lineNumber" value={item.lineNumber} /><label
										><span>Tax treatment</span><select name="taxCategoryPublicId"
											><option value="">No tax</option>{#each data.taxCategories as tax}<option
													value={tax.publicId}
													selected={item.taxes[0]?.taxCategoryPublicId === tax.publicId}
													>{tax.name}{tax.ratePercent ? ` · ${tax.ratePercent}%` : ''}</option
												>{/each}</select
										></label
									><button class="secondary" type="submit">Apply tax</button>
								</form>
								<form method="POST" action="?/removeLine">
									<input
										type="hidden"
										name="versionNumber"
										value={data.version.versionNumber}
									/><input type="hidden" name="lineNumber" value={item.lineNumber} /><button
										class="secondary danger"
										type="submit">Remove line</button
									>
								</form>
							</div>
						{/if}
					</article>
				{/each}
			</div>{/if}

		<div class="narrative">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Commercial narrative</p>
					<h2>Scope, assumptions and terms</h2>
				</div>
				<span>{data.textBlocks.length} blocks</span>
			</div>
			{#if data.textBlocks.length === 0}<p class="muted">No narrative blocks.</p>{:else}<div
					class="blocks"
				>
					{#each data.textBlocks as block}<article>
							<span>{block.blockType}</span>{#if block.heading}<h3>{block.heading}</h3>{/if}
							<p>{block.body}</p>
						</article>{/each}
				</div>{/if}
		</div>
	</section>

	<aside class="sidebar-stack">
		<section class="panel">
			<p class="eyebrow">Customer</p>
			<h2>{data.quotation.customerDisplayName}</h2>
			{#if data.quotation.primaryContactDisplayName}<p>
					Attention: {data.quotation.primaryContactDisplayName}
				</p>{/if}
			<p class="muted">
				CRM identity remains linked to the logical quotation; issue-time snapshots preserve what was
				actually sent.
			</p>
		</section>

		{#if data.canManageQuotations && data.version.versionStatus === 'draft'}
			<section class="panel">
				<p class="eyebrow">Draft details</p>
				<h2>Quotation header</h2>
				<form method="POST" action="?/updateDraft" class="form-grid">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber} /><label
						class="wide"
						><span>Title</span><input
							name="title"
							maxlength="255"
							value={data.version.title}
							required
						/></label
					><label class="wide"
						><span>Customer reference</span><input
							name="customerReference"
							maxlength="160"
							value={data.version.customerReference ?? ''}
						/></label
					><label class="wide"
						><span>Valid until</span><input
							name="validUntil"
							type="date"
							value={dateInput(data.version.validUntil)}
						/></label
					><button type="submit">Save draft details</button>
				</form>
			</section>
			<section class="panel">
				<p class="eyebrow">Add line</p>
				<h2>Additional quotation item</h2>
				<form method="POST" action="?/addLine" class="form-grid">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber} /><label
						><span>Type</span><select name="salesItemTypeId" required
							>{#each data.salesItemTypes as type}<option value={type.id}>{type.name}</option
								>{/each}</select
						></label
					><label
						><span>Unit</span><select name="unitOfMeasureId"
							><option value="">None</option>{#each data.units as unit}<option value={unit.id}
									>{unit.name}</option
								>{/each}</select
						></label
					><label class="wide"
						><span>Description</span><textarea name="description" rows="3" required
						></textarea></label
					><label
						><span>Quantity</span><input
							name="quantity"
							inputmode="decimal"
							value="1"
							required
						/></label
					><label
						><span>Unit rate</span><input
							name="unitRate"
							inputmode="decimal"
							value="0.00"
							required
						/></label
					><label class="check wide"
						><input type="checkbox" name="isOptional" /><span>Optional line</span></label
					><button type="submit">Add quotation line</button>
				</form>
			</section>
			<section class="panel">
				<p class="eyebrow">Narrative</p>
				<h2>Add commercial text</h2>
				<form method="POST" action="?/addText" class="form-grid">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber} /><label
						><span>Type</span><select name="blockType"
							><option value="scope">Scope</option><option value="assumption">Assumption</option
							><option value="exclusion">Exclusion</option><option value="clarification"
								>Clarification</option
							><option value="term">Term</option><option value="note">Note</option></select
						></label
					><label class="wide"><span>Heading</span><input name="heading" maxlength="255" /></label
					><label class="wide"
						><span>Body</span><textarea name="body" rows="4" required></textarea></label
					><button type="submit">Add narrative block</button>
				</form>
			</section>
		{/if}

		{#if data.canIssueQuotations && data.version.versionStatus === 'draft'}
			<section class="panel action-panel">
				<p class="eyebrow">Issue control</p>
				<h2>Lock and issue</h2>
				<p>
					Issue snapshots customer/contact facts, freezes this version and creates an immutable
					issue event.
				</p>
				<form method="POST" action="?/issue" class="form-grid">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber} /><label
						><span>Channel</span><select name="deliveryChannel"
							><option value="manual">Manual</option><option value="email">Email record</option
							><option value="portal">Portal</option><option value="api">API</option><option
								value="other">Other</option
							></select
						></label
					><label class="wide"
						><span>Recipient name</span><input
							name="recipientName"
							maxlength="255"
							placeholder={data.quotation.primaryContactDisplayName ??
								data.quotation.customerDisplayName}
						/></label
					><label class="wide"
						><span>Recipient email</span><input
							name="recipientEmail"
							type="email"
							maxlength="320"
						/></label
					><label class="wide"
						><span>Issue note</span><textarea name="note" rows="3" maxlength="1000"
						></textarea></label
					><button type="submit">Issue quotation version {data.version.versionNumber}</button>
				</form>
			</section>
		{/if}

		{#if data.version.versionStatus !== 'draft'}
			<section class="panel">
				<p class="eyebrow">Issue history</p>
				<h2>Issued evidence</h2>
				{#if data.issues.length === 0}<p class="muted">
						No issue events for this version.
					</p>{:else}<div class="timeline">
						{#each data.issues as issue}<article>
								<strong>Issue {issue.issueSequence} · {issue.deliveryChannel}</strong><span
									>{new Date(issue.issuedAt).toLocaleString()}</span
								>{#each issue.recipients as recipient}<small
										>{recipient.recipientName ?? recipient.recipientEmail ?? 'Recipient'} · {recipient.deliveryStatus}</small
									>{/each}
							</article>{/each}
					</div>{/if}
			</section>
		{/if}

		{#if data.canRecordResponses && data.version.versionStatus === 'issued' && data.effectiveStatus !== 'accepted'}
			<section class="panel action-panel">
				<p class="eyebrow">Customer response</p>
				<h2>Record response</h2>
				<form method="POST" action="?/recordResponse" class="form-grid">
					<input type="hidden" name="versionNumber" value={data.version.versionNumber} /><label
						class="wide"
						><span>Response</span><select name="responseType"
							><option value="accepted">Accepted</option><option value="rejected">Rejected</option
							><option value="revision_requested">Revision requested</option><option
								value="withdrawn_by_customer">Withdrawn by customer</option
							></select
						></label
					><label class="wide"
						><span>Responded at</span><input
							name="respondedAt"
							type="datetime-local"
							value={dateTimeInput(new Date())}
						/></label
					><label class="wide"
						><span>Respondent name</span><input name="respondentName" maxlength="255" /></label
					><label class="wide"
						><span>Respondent email</span><input
							name="respondentEmail"
							type="email"
							maxlength="320"
						/></label
					><label class="wide"><span>Notes</span><textarea name="notes" rows="3"></textarea></label
					><button type="submit">Record response</button>
				</form>
			</section>
		{/if}

		{#if data.responses.length}<section class="panel">
				<p class="eyebrow">Response history</p>
				<div class="timeline">
					{#each data.responses as response}<article>
							<strong>{responseLabels[response.responseType] ?? response.responseType}</strong><span
								>{new Date(response.respondedAt).toLocaleString()}</span
							>{#if response.respondentName}<small
									>{response.respondentName}{response.respondentEmail
										? ` · ${response.respondentEmail}`
										: ''}</small
								>{/if}{#if response.notes}<p>{response.notes}</p>{/if}
						</article>{/each}
				</div>
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
	}
	.status-draft {
		background: #e7efff;
		color: #234b85;
	}
	.status-issued {
		background: #eee8ff;
		color: #54428b;
	}
	.status-accepted {
		background: #e4f5e8;
		color: #285f35;
	}
	.status-rejected,
	.status-withdrawn,
	.status-expired {
		background: #f1ece9;
		color: #76544a;
	}
	.status-revision_requested {
		background: #fff3d8;
		color: #725317;
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
		font-size: 1.05rem;
	}
	.workspace-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(20rem, 0.8fr);
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
		gap: 0.8rem;
		margin-top: 1rem;
	}
	.line {
		display: grid;
		gap: 0.65rem;
		padding: 0.9rem;
		border: 1px solid #e0e0da;
		border-radius: 0.62rem;
	}
	.line-header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}
	.line-header > div:first-child,
	.line-money {
		display: grid;
		gap: 0.18rem;
	}
	.line-money {
		text-align: right;
	}
	.line-no,
	.line-header small,
	.line-money span,
	.line-meta,
	.muted {
		color: #666;
		font-size: 0.8rem;
	}
	.line-meta {
		display: flex;
		gap: 0.5rem 1rem;
		flex-wrap: wrap;
	}
	.line-actions {
		display: flex;
		gap: 0.6rem;
		justify-content: space-between;
		align-items: end;
		padding-top: 0.6rem;
		border-top: 1px solid #e2e2dc;
	}
	.tax-form {
		display: flex;
		gap: 0.5rem;
		align-items: end;
		flex: 1;
	}
	.tax-form label {
		min-width: 15rem;
	}
	.narrative {
		margin-top: 1.3rem;
		padding-top: 1rem;
		border-top: 1px solid #e0e0da;
	}
	.blocks {
		display: grid;
		gap: 0.65rem;
		margin-top: 0.75rem;
	}
	.blocks article {
		padding: 0.75rem;
		background: #f7f7f4;
		border-radius: 0.5rem;
	}
	.blocks article > span {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #666;
	}
	.blocks h3 {
		margin: 0.25rem 0;
	}
	.blocks p {
		margin: 0.25rem 0;
		white-space: pre-wrap;
	}
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
		margin-top: 0.8rem;
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
	.timeline {
		display: grid;
		gap: 0.6rem;
		margin-top: 0.7rem;
	}
	.timeline article {
		display: grid;
		gap: 0.18rem;
		padding: 0.65rem;
		border-left: 3px solid #ccc;
		background: #f8f8f5;
	}
	.timeline span,
	.timeline small {
		font-size: 0.78rem;
		color: #666;
	}
	.timeline p {
		margin: 0.3rem 0 0;
	}
	.empty {
		padding: 2rem 0.5rem;
		text-align: center;
		color: #666;
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
		.form-grid {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
		.line-header,
		.line-actions,
		.tax-form {
			display: grid;
		}
		.line-money {
			text-align: left;
		}
	}
</style>
