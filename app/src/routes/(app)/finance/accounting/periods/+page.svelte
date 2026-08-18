<script lang="ts">
	let { data, form } = $props();

	function dateText(value: Date) {
		return new Date(value).toLocaleDateString();
	}

	function stateLabel(value: string) {
		return value === 'soft_closed' ? 'Soft closed' : value === 'hard_closed' ? 'Hard closed' : 'Open';
	}
</script>

<svelte:head><title>Accounting periods · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/finance/invoices">Finance</a><span>/</span><a href="/finance/accounting">Accounting</a><span>/</span><span>Periods</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Close governance</p>
		<h1>Accounting periods</h1>
		<p>Define financial years and accounting periods, then control posting windows with additive close and reopen evidence.</p>
	</div>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="notice">
	<strong>Period history is never rewritten</strong>
	<span>Open, soft-close, hard-close and reopen transitions are recorded as immutable evidence. Closing a period does not alter operational finance events or existing journals.</span>
</section>

{#if data.canConfigure}
	<section class="panel">
		<div class="section-heading">
			<div><p class="eyebrow">Configuration</p><h2>Financial calendar</h2></div>
		</div>
		<div class="configure-grid">
			<form method="POST" action="?/createFinancialYear" class="form-grid card">
				<strong>Create financial year</strong>
				<label>Name<input name="name" maxlength="80" placeholder="2026/27" required /></label>
				<label>Starts on<input type="date" name="startsOn" required /></label>
				<label>Ends on<input type="date" name="endsOn" required /></label>
				<button type="submit">Create financial year</button>
			</form>

			<form method="POST" action="?/createPeriod" class="form-grid card">
				<strong>Create accounting period</strong>
				<label>Financial year
					<select name="financialYearPublicId" required>
						<option value="">Choose a financial year</option>
						{#each data.financialYears as year}
							<option value={year.publicId}>{year.name} · {dateText(year.startsOn)}–{dateText(year.endsOn)}</option>
						{/each}
					</select>
				</label>
				<label>Period number<input type="number" name="periodNumber" min="1" max="999" required /></label>
				<label>Name<input name="name" maxlength="80" placeholder="August 2026" required /></label>
				<label>Starts on<input type="date" name="startsOn" required /></label>
				<label>Ends on<input type="date" name="endsOn" required /></label>
				<button type="submit" disabled={data.financialYears.length === 0}>Create period</button>
			</form>
		</div>
	</section>
{/if}

<section class="panel">
	<div class="section-heading">
		<div><p class="eyebrow">Governed periods</p><h2>Period status</h2></div>
		<span>{data.periods.length} periods</span>
	</div>

	{#if data.periods.length === 0}
		<p class="muted">No accounting periods have been configured yet.</p>
	{:else}
		<div class="records">
			{#each data.periods as period}
				<article class="record">
					<div class="record-head">
						<div>
							<strong>{period.financialYearName} · {period.periodNumber}. {period.name}</strong>
							<small>{dateText(period.startsOn)}–{dateText(period.endsOn)} · state version {period.stateVersion}</small>
						</div>
						<em class:hard={period.state === 'hard_closed'} class:soft={period.state === 'soft_closed'}>{stateLabel(period.state)}</em>
					</div>

					{#if period.state === 'open' && (data.canSoftClose || data.canHardClose)}
						<div class="actions">
							{#if data.canSoftClose}
								<form method="POST" action="?/transition" class="inline-action">
									<input type="hidden" name="periodPublicId" value={period.publicId} />
									<input type="hidden" name="toState" value="soft_closed" />
									<label>Reason<input name="reason" maxlength="1000" required /></label>
									<button type="submit">Soft close</button>
								</form>
							{/if}
							{#if data.canHardClose}
								<form method="POST" action="?/transition" class="inline-action danger-action">
									<input type="hidden" name="periodPublicId" value={period.publicId} />
									<input type="hidden" name="toState" value="hard_closed" />
									<label>Reason<input name="reason" maxlength="1000" required /></label>
									<button type="submit">Hard close</button>
								</form>
							{/if}
						</div>
					{:else if period.state === 'soft_closed'}
						<div class="actions">
							{#if data.canHardClose}
								<form method="POST" action="?/transition" class="inline-action danger-action">
									<input type="hidden" name="periodPublicId" value={period.publicId} />
									<input type="hidden" name="toState" value="hard_closed" />
									<label>Reason<input name="reason" maxlength="1000" required /></label>
									<button type="submit">Hard close</button>
								</form>
							{/if}
							{#if data.canReopen}
								<form method="POST" action="?/transition" class="inline-action">
									<input type="hidden" name="periodPublicId" value={period.publicId} />
									<input type="hidden" name="toState" value="open" />
									<label>Reopen authority reason<input name="reason" maxlength="1000" required /></label>
									<button type="submit">Reopen</button>
								</form>
							{/if}
						</div>
					{:else if period.state === 'hard_closed' && data.canReopen}
						<form method="POST" action="?/transition" class="inline-action">
							<input type="hidden" name="periodPublicId" value={period.publicId} />
							<input type="hidden" name="toState" value="open" />
							<label>Reopen authority reason<input name="reason" maxlength="1000" required /></label>
							<button type="submit">Reopen hard-closed period</button>
						</form>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.breadcrumbs{display:flex;gap:.45rem;align-items:center;margin-bottom:1rem;color:var(--text-muted,#64748b);font-size:.9rem}.breadcrumbs a{color:inherit}.page-heading{display:flex;justify-content:space-between;gap:1rem;margin-bottom:1rem}.page-heading h1{margin:.15rem 0 .4rem}.page-heading p{max-width:70ch}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--text-muted,#64748b);margin:0}.notice,.panel{border:1px solid var(--border,#dbe2ea);border-radius:14px;background:var(--surface,#fff);padding:1rem;margin-bottom:1rem}.notice{display:grid;gap:.25rem}.banner{padding:.75rem 1rem;border-radius:10px}.error{background:#fee2e2;color:#991b1b}.section-heading,.record-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.section-heading{margin-bottom:1rem}.section-heading h2{margin:.15rem 0 0}.configure-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}.card,.record{border:1px solid var(--border,#dbe2ea);border-radius:12px;padding:1rem}.form-grid{display:grid;gap:.75rem}.form-grid label,.inline-action label{display:grid;gap:.3rem;font-size:.88rem}.form-grid input,.form-grid select,.inline-action input{padding:.55rem .65rem;border:1px solid var(--border,#cbd5e1);border-radius:8px;background:inherit;color:inherit}.form-grid button,.inline-action button{width:max-content;padding:.55rem .8rem;border:0;border-radius:8px;cursor:pointer}.records{display:grid;gap:.75rem}.record-head small{display:block;margin-top:.25rem;color:var(--text-muted,#64748b)}.record-head em{font-style:normal;font-weight:700;color:#166534}.record-head em.soft{color:#92400e}.record-head em.hard{color:#991b1b}.actions{display:grid;gap:.65rem;margin-top:.85rem}.inline-action{display:flex;gap:.65rem;align-items:end;flex-wrap:wrap;margin-top:.85rem}.danger-action button{font-weight:700}.muted{color:var(--text-muted,#64748b)}
</style>
