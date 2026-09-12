<script lang="ts">
	let { data, form } = $props();
	const submitted = $derived(data.quote.state === 'completed' || Boolean(data.quote.submittedAt));

	function dateTime(value: string | null): string {
		if (!value) return 'No deadline';
		return new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}
</script>

<svelte:head>
	<title>{data.quote.rfqNumber} supplier quotation · NuBlox Network</title>
</svelte:head>

<div class="workspace">
	<header class="hero">
		<div>
			<p class="eyebrow">Supplier quotation</p>
			<h1>{data.quote.rfqNumber}</h1>
			<p>{data.quote.title}</p>
		</div>
		<div class:complete={submitted} class="status">
			{submitted ? 'Submitted' : 'Action required'}
		</div>
	</header>

	<section class="context-grid" aria-label="Quotation context">
		<div><span>Issued by</span><strong>{data.quote.ownerName}</strong></div>
		<div><span>Project</span><strong>{data.quote.projectNumber} · {data.quote.projectName}</strong></div>
		<div><span>Currency</span><strong>{data.quote.currencyCode}</strong></div>
		<div><span>Response due</span><strong>{dateTime(data.quote.responseDeadlineAt)}</strong></div>
	</section>

	{#if form?.message}<p class="notice error" role="alert">{form.message}</p>{/if}
	{#if submitted}
		<p class="notice success">
			Quotation submitted{data.quote.submittedAt ? ` ${dateTime(data.quote.submittedAt)}` : ''}.
			This is the controlled copy held against the RFQ.
		</p>
	{/if}

	<form method="POST" action="?/submit" class="quote-form">
		<section class="commercial-details">
			<label>
				<span>Supplier reference</span>
				<input
					name="supplierReference"
					value={data.quote.supplierReference}
					maxlength="160"
					disabled={submitted}
				/>
			</label>
			<label>
				<span>Valid until</span>
				<input name="validUntil" type="date" value={data.quote.validUntil ?? ''} disabled={submitted} />
			</label>
		</section>

		<section class="lines" aria-label="RFQ lines">
			{#each data.quote.lines as line}
				<article class="line-card">
					<header>
						<div>
							<span class="line-number">Line {line.lineNumber}</span>
							<h2>{line.description}</h2>
						</div>
						<p>Requested: <strong>{line.requestedQuantity}</strong></p>
					</header>
					<div class="line-inputs">
						<label>
							<span>Offered quantity</span>
							<input
								name={`quantity:${line.rfqItemId}`}
								value={line.offeredQuantity}
								inputmode="decimal"
								required
								disabled={submitted}
							/>
						</label>
						<label>
							<span>Unit rate ({data.quote.currencyCode})</span>
							<input
								name={`rate:${line.rfqItemId}`}
								value={line.unitRate}
								inputmode="decimal"
								required
								disabled={submitted}
							/>
						</label>
						<label>
							<span>Lead time (days)</span>
							<input
								name={`lead:${line.rfqItemId}`}
								type="number"
								min="0"
								step="1"
								value={line.leadTimeDays ?? ''}
								disabled={submitted}
							/>
						</label>
					</div>
					<label class="note-field">
						<span>Qualification / note</span>
						<textarea
							name={`note:${line.rfqItemId}`}
							rows="2"
							maxlength="4000"
							disabled={submitted}>{line.qualificationNote}</textarea
						>
					</label>
				</article>
			{/each}
		</section>

		{#if !submitted}
			<div class="submit-bar">
				<p>Submitting locks this response as the supplier return for this RFQ invitation.</p>
				<button type="submit">Submit quotation</button>
			</div>
		{/if}
	</form>
</div>

<style>
	.workspace { display: grid; gap: 1.2rem; }
	.hero {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: flex-start;
	}
	.eyebrow, .line-number {
		margin: 0 0 0.3rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--nb-text-muted);
	}
	h1 { margin: 0; font-size: clamp(1.8rem, 5vw, 2.7rem); letter-spacing: -0.04em; }
	.hero p { margin: 0.35rem 0 0; color: var(--nb-text-muted); }
	.status {
		flex: none;
		padding: 0.45rem 0.7rem;
		border-radius: 999px;
		background: #fff2d6;
		font-size: 0.78rem;
		font-weight: 800;
	}
	.status.complete { background: #e8f6eb; }
	.context-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.65rem;
	}
	.context-grid > div {
		display: grid;
		gap: 0.2rem;
		padding: 0.85rem;
		border: 1px solid #dfe3ea;
		border-radius: 0.65rem;
		background: white;
	}
	.context-grid span, label span { font-size: 0.75rem; color: var(--nb-text-muted); }
	.notice { margin: 0; padding: 0.85rem 1rem; border-radius: 0.65rem; }
	.notice.error { background: #fff0f0; color: #9b1c1c; }
	.notice.success { background: #e8f6eb; }
	.quote-form { display: grid; gap: 1rem; }
	.commercial-details, .line-inputs {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.commercial-details { grid-template-columns: 2fr 1fr; }
	label { display: grid; gap: 0.35rem; font-weight: 700; }
	input, textarea {
		font: inherit;
		min-width: 0;
		border: 1px solid #c9d0da;
		border-radius: 0.55rem;
		padding: 0.65rem 0.75rem;
		background: white;
	}
	input:disabled, textarea:disabled { background: #f5f6f8; color: #505967; }
	.lines { display: grid; gap: 0.75rem; }
	.line-card {
		display: grid;
		gap: 0.85rem;
		padding: 1rem;
		border: 1px solid #dfe3ea;
		border-radius: 0.75rem;
		background: white;
	}
	.line-card header { display: flex; justify-content: space-between; gap: 1rem; }
	.line-card h2 { margin: 0; font-size: 1rem; }
	.line-card header p { margin: 0; color: var(--nb-text-muted); }
	.note-field { font-weight: 650; }
	.submit-bar {
		position: sticky;
		bottom: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1rem;
		border: 1px solid #ccd4df;
		border-radius: 0.75rem;
		background: rgb(255 255 255 / 0.96);
		box-shadow: 0 0.6rem 1.5rem rgb(20 31 50 / 0.08);
	}
	.submit-bar p { margin: 0; color: var(--nb-text-muted); font-size: 0.82rem; }
	button {
		flex: none;
		font: inherit;
		font-weight: 800;
		border: 1px solid var(--nb-ink);
		border-radius: 0.55rem;
		padding: 0.7rem 1rem;
		background: var(--nb-ink);
		color: white;
		cursor: pointer;
	}
	@media (max-width: 780px) {
		.context-grid, .commercial-details, .line-inputs { grid-template-columns: 1fr; }
		.hero, .line-card header, .submit-bar { align-items: stretch; flex-direction: column; }
		.submit-bar { position: static; }
	}
</style>
