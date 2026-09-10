<script lang="ts">
	let { data, form } = $props();
	const selected = $derived(data.selectedOpportunity);
</script>

<svelte:head><title>Corporate Development | NuBlox</title></svelte:head>

<section class="workspace">
	<header>
		<p class="eyebrow">F04 · Corporate Development & M&amp;A</p>
		<h1>Corporate Development command centre</h1>
		<p>Originate, evaluate and govern strategic transactions through one evidence-backed deal thread.</p>
	</header>

	{#if form?.error}<div class="error" role="alert">{form.error}</div>{/if}

	<div class="grid two">
		<section class="panel">
			<h2>Opportunity pipeline</h2>
			{#if data.opportunities.length}
				<ul class="list">
					{#each data.opportunities as opportunity}
						<li>
							<a href={`/corporate-development?opportunity=${opportunity.public_id}`} class:selected={selected?.public_id === opportunity.public_id}>
								<strong>{opportunity.opportunity_code} · {opportunity.title}</strong>
								<span>{opportunity.target_name} · {opportunity.pipeline_stage} · {opportunity.priority}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}<p>No corporate-development opportunities yet.</p>{/if}
		</section>

		{#if data.canManage}
		<section class="panel">
			<h2>Create opportunity</h2>
			<form method="POST" action="?/createOpportunity" class="form-grid">
				<label>Code <input name="opportunityCode" required /></label>
				<label>Title <input name="title" required /></label>
				<label>Deal type <select name="dealType"><option value="acquisition">Acquisition</option><option value="minority_investment">Minority investment</option><option value="joint_venture">Joint venture</option><option value="strategic_partnership">Strategic partnership</option><option value="divestiture">Divestiture</option><option value="other">Other</option></select></label>
				<label>Target / partner <input name="targetName" required /></label>
				<label>Owner <select name="ownerMemberId" required>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
				<label>Priority <select name="priority"><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option><option value="low">Low</option></select></label>
				<label>Identified on <input name="identifiedOn" type="date" required /></label>
				<label>Target decision <input name="targetDecisionDate" type="date" /></label>
				<label class="wide">Strategic thesis <textarea name="strategicThesis" required></textarea></label>
				<label class="wide">Strategic rationale <textarea name="strategicRationale" required></textarea></label>
				<label>Source domain <input name="targetSourceDomain" placeholder="crm" /></label>
				<label>Source record type <input name="targetSourceRecordType" /></label>
				<label>Source public ID <input name="targetSourcePublicId" /></label>
				<label>Source reference <input name="sourceReference" /></label>
				<label>F01 objective public ID <input name="strategyObjectivePublicId" /></label>
				<label>F01 KPI public ID <input name="strategyKpiPublicId" /></label>
				<label>F03 evidence public ID <input name="performanceEvidencePublicId" /></label>
				<button type="submit">Create opportunity</button>
			</form>
		</section>
		{/if}
	</div>

	{#if selected}
	<section class="panel hero">
		<p class="eyebrow">{selected.opportunity_code} · {selected.deal_type}</p>
		<h2>{selected.title}</h2>
		<p><strong>Target:</strong> {selected.target_name} · <strong>Stage:</strong> {selected.pipeline_stage} · <strong>Priority:</strong> {selected.priority}</p>
		<p>{selected.strategic_thesis}</p>
	</section>

	<div class="grid two">
		<section class="panel">
			<h2>Valuation cases</h2>
			{#if data.valuations.length}
				{#each data.valuations as valuation}
					<article class="card">
						<strong>{valuation.valuation_code} v{valuation.version_number} · {valuation.title}</strong>
						<p>{valuation.primary_method} · {valuation.currency_code} · {valuation.lifecycle_status}</p>
						<p>EV base: {valuation.enterprise_value_base ?? '—'} · Equity base: {valuation.equity_value_base ?? '—'}</p>
						<p>{valuation.recommendation}</p>
						{#if data.canApprove && valuation.lifecycle_status === 'draft'}
						<form method="POST" action="?/approveValuation"><input type="hidden" name="valuationPublicId" value={valuation.public_id} /><input type="hidden" name="opportunityPublicId" value={selected.public_id} /><button type="submit">Approve valuation</button></form>
						{/if}
					</article>
				{/each}
			{:else}<p>No valuation cases yet.</p>{/if}
		</section>

		{#if data.canManage}
		<section class="panel">
			<h2>Create valuation</h2>
			<form method="POST" action="?/createValuation" class="form-grid">
				<input type="hidden" name="opportunityPublicId" value={selected.public_id} />
				<label>Code <input name="valuationCode" required /></label>
				<label>Title <input name="title" required /></label>
				<label>Valuation date <input type="date" name="valuationDate" required /></label>
				<label>Currency <input name="currencyCode" maxlength="3" value="GBP" required /></label>
				<label>Method <select name="primaryMethod"><option value="dcf">DCF</option><option value="trading_comparables">Trading comparables</option><option value="precedent_transactions">Precedent transactions</option><option value="asset_based">Asset based</option><option value="sum_of_parts">Sum of parts</option><option value="venture_method">Venture method</option><option value="other">Other</option></select></label>
				<label>EV low <input name="enterpriseValueLow" inputmode="decimal" /></label><label>EV base <input name="enterpriseValueBase" inputmode="decimal" /></label><label>EV high <input name="enterpriseValueHigh" inputmode="decimal" /></label>
				<label>Equity low <input name="equityValueLow" inputmode="decimal" /></label><label>Equity base <input name="equityValueBase" inputmode="decimal" /></label><label>Equity high <input name="equityValueHigh" inputmode="decimal" /></label>
				<label class="wide">Recommendation <textarea name="recommendation" required></textarea></label>
				<button type="submit">Create valuation</button>
			</form>
		</section>
		{/if}
	</div>
	{/if}
</section>

<style>
	.workspace{display:grid;gap:1.25rem;max-width:1500px;margin:0 auto;padding:1.5rem}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.78rem}.grid{display:grid;gap:1rem}.two{grid-template-columns:repeat(auto-fit,minmax(360px,1fr))}.panel{border:1px solid var(--border-color,#d7d7d7);border-radius:12px;padding:1rem;background:var(--surface-color,#fff)}.hero{padding:1.25rem}.list{list-style:none;padding:0;margin:0;display:grid;gap:.5rem}.list a{display:grid;gap:.2rem;padding:.75rem;border-radius:8px;text-decoration:none;color:inherit;border:1px solid transparent}.list a.selected{border-color:currentColor}.list span{opacity:.72;font-size:.9rem}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.form-grid label{display:grid;gap:.3rem;font-size:.9rem}.form-grid .wide,.form-grid button{grid-column:1/-1}input,select,textarea,button{font:inherit;padding:.6rem;border-radius:7px;border:1px solid #aaa}textarea{min-height:90px}.card{border-top:1px solid #ddd;padding:.9rem 0}.error{padding:.8rem;border:1px solid #b00020;border-radius:8px}.card form{margin-top:.6rem}@media(max-width:700px){.form-grid{grid-template-columns:1fr}}
</style>
