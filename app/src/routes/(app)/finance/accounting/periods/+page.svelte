<script lang="ts">
	let { data, form } = $props();

	function dateText(value: Date) {
		return new Date(value).toLocaleDateString('en-GB');
	}

	function statusText(value: string) {
		return value.replaceAll('_', ' ');
	}
</script>

<svelte:head><title>Accounting periods · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/finance/invoices">Finance</a><span>/</span><a href="/finance/accounting">Accounting</a
	><span>/</span><span>Periods</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Close governance</p>
		<h1>Accounting periods</h1>
		<p>
			Configure financial years and periods, control open/soft-closed/hard-closed state, and retain
			reasoned transition evidence without rewriting journal history.
		</p>
	</div>
	<div class="heading-actions">
		<a class="secondary" href="/finance/bank-reconciliation">Bank reconciliation</a>
		<a class="secondary" href="/finance/accounting">Accounting workspace</a>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="notice">
	<strong>Period policy</strong>
	<span
		>Journal posting and reversal require an open period. Export requires an exact soft-closed or
		hard-closed period. Hard close is blocked until every journal has active export evidence and
		every active supplier-payment cash journal has bank settlement evidence.</span
	>
</section>

{#if data.canConfigure}
	<section class="panel">
		<div class="section-heading">
			<div>
				<p class="eyebrow">Configuration</p>
				<h2>Financial years and periods</h2>
			</div>
		</div>
		<div class="configure-grid">
			<form method="POST" action="?/createFinancialYear" class="form-grid card">
				<strong>Create financial year</strong>
				<label>Code<input name="yearCode" maxlength="32" placeholder="FY2027" required /></label>
				<label
					>Name<input
						name="name"
						maxlength="160"
						placeholder="Financial year 2027"
						required
					/></label
				>
				<div class="two">
					<label>Starts<input type="date" name="startsOn" required /></label><label
						>Ends<input type="date" name="endsOn" required /></label
					>
				</div>
				<button type="submit">Create financial year</button>
			</form>

			<form method="POST" action="?/createPeriod" class="form-grid card">
				<strong>Create accounting period</strong>
				<label
					>Financial year
					<select name="financialYearPublicId" required>
						<option value="">Choose a financial year</option>
						{#each data.financialYears as year}<option value={year.publicId}
								>{year.yearCode} · {year.name}</option
							>{/each}
					</select>
				</label>
				<div class="two">
					<label
						>Period number<input
							type="number"
							min="1"
							max="999"
							name="periodNumber"
							required
						/></label
					><label
						>Name<input name="name" maxlength="120" placeholder="January 2027" required /></label
					>
				</div>
				<div class="two">
					<label>Starts<input type="date" name="startsOn" required /></label><label
						>Ends<input type="date" name="endsOn" required /></label
					>
				</div>
				<button type="submit">Create period</button>
			</form>
		</div>
	</section>
{/if}

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Governed calendar</p>
			<h2>Financial years</h2>
		</div>
		<span>{data.financialYears.length}</span>
	</div>
	{#if data.financialYears.length === 0}
		<p class="muted">No financial years have been configured.</p>
	{:else}
		<div class="years">
			{#each data.financialYears as year}
				<article class="year-card">
					<header>
						<div>
							<strong>{year.yearCode} · {year.name}</strong><small
								>{dateText(year.startsOn)}–{dateText(year.endsOn)}</small
							>
						</div>
						<span>{year.periods.length} periods</span>
					</header>
					{#if year.periods.length === 0}
						<p class="muted">No periods configured for this financial year.</p>
					{:else}
						<div class="table-wrap">
							<table>
								<thead
									><tr
										><th>Period</th><th>Dates</th><th>Status</th><th>Unexported journals</th><th
											>Unreconciled supplier payments</th
										><th>Action</th></tr
									></thead
								>
								<tbody>
									{#each year.periods as period}
										<tr>
											<td><strong>{period.periodNumber} · {period.name}</strong></td>
											<td>{dateText(period.startsOn)}–{dateText(period.endsOn)}</td>
											<td
												><span
													class:hard={period.status === 'hard_closed'}
													class:soft={period.status === 'soft_closed'}
													class="status">{statusText(period.status)}</span
												></td
											>
											<td>{period.unexportedJournalCount}</td><td
												>{period.unreconciledSupplierPaymentCount}</td
											>
											<td>
												{#if period.status === 'open' && data.canClose}
													<form method="POST" action="?/softClose" class="inline-form">
														<input
															type="hidden"
															name="periodPublicId"
															value={period.publicId}
														/><input
															name="reason"
															maxlength="1000"
															placeholder="Close reason"
															required
														/><button type="submit">Soft close</button>
													</form>
												{:else if period.status === 'soft_closed' && data.canClose}
													<form method="POST" action="?/hardClose" class="inline-form">
														<input
															type="hidden"
															name="periodPublicId"
															value={period.publicId}
														/><input
															name="reason"
															maxlength="1000"
															placeholder="Hard-close reason"
															required
														/><button type="submit">Hard close</button>
													</form>
												{/if}
												{#if period.status !== 'open' && data.canReopen}
													<form method="POST" action="?/reopen" class="inline-form reopen">
														<input
															type="hidden"
															name="periodPublicId"
															value={period.publicId}
														/><input
															name="reason"
															maxlength="1000"
															placeholder="Reopen reason"
															required
														/><button type="submit">Reopen</button>
													</form>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Additive evidence</p>
			<h2>Recent period transitions</h2>
		</div>
		<span>{data.recentEvents.length}</span>
	</div>
	{#if data.recentEvents.length === 0}
		<p class="muted">No period status changes have been recorded.</p>
	{:else}
		<div class="events">
			{#each data.recentEvents as event}
				<article>
					<div>
						<strong>{event.periodName}</strong><small
							>{statusText(event.fromStatus)} → {statusText(event.toStatus)} · {dateText(
								event.changedAt
							)}</small
						>
					</div>
					<p>{event.reason}</p>
				</article>
			{/each}
		</div>
	{/if}
</section>

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
	.year-card header {
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
		max-width: 72rem;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.72rem;
		font-weight: 700;
		color: #667085;
		margin: 0;
	}
	.heading-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.secondary {
		font-weight: 700;
		color: #344054;
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
	.panel {
		border: 1px solid #d0d5dd;
		border-radius: 14px;
		background: white;
		padding: 1rem;
		margin-bottom: 1rem;
	}
	.configure-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.8rem;
		margin-top: 0.8rem;
	}
	.form-grid {
		display: grid;
		gap: 0.7rem;
	}
	.card,
	.year-card {
		border: 1px solid #e4e7ec;
		border-radius: 10px;
		padding: 0.85rem;
	}
	.two {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem;
	}
	.years,
	.events {
		display: grid;
		gap: 0.8rem;
		margin-top: 0.8rem;
	}
	.year-card header small,
	.events small {
		display: block;
		color: #667085;
		margin-top: 0.15rem;
	}
	.table-wrap {
		overflow: auto;
		margin-top: 0.7rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}
	th,
	td {
		text-align: left;
		vertical-align: top;
		padding: 0.55rem;
		border-bottom: 1px solid #e4e7ec;
	}
	.status {
		display: inline-block;
		text-transform: capitalize;
		padding: 0.2rem 0.45rem;
		border-radius: 999px;
		background: #ecfdf3;
		color: #027a48;
	}
	.status.soft {
		background: #fffaeb;
		color: #b54708;
	}
	.status.hard {
		background: #f2f4f7;
		color: #344054;
	}
	.inline-form {
		display: flex;
		gap: 0.35rem;
		margin-bottom: 0.35rem;
	}
	.inline-form input {
		min-width: 10rem;
	}
	.inline-form.reopen button {
		background: #475467;
	}
	.events article {
		display: grid;
		grid-template-columns: minmax(14rem, 0.4fr) 1fr;
		gap: 1rem;
		padding: 0.65rem;
		background: #f8fafc;
		border-radius: 8px;
	}
	.events p {
		margin: 0;
		color: #344054;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.85rem;
		font-weight: 650;
	}
	input,
	select {
		font: inherit;
		padding: 0.58rem;
		border: 1px solid #cfd4dc;
		border-radius: 8px;
		background: white;
	}
	button {
		font: inherit;
		font-weight: 700;
		padding: 0.6rem 0.8rem;
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
		.page-heading,
		.year-card header {
			display: grid;
		}
		.configure-grid,
		.two,
		.events {
			grid-template-columns: 1fr;
		}
		.inline-form {
			display: grid;
		}
		.inline-form input {
			min-width: 0;
		}
	}
</style>
