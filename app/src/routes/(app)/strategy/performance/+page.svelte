<script lang="ts">
	let { data, form } = $props();

	function dateValue(value: Date | string | null | undefined) {
		if (!value) return '—';
		return new Date(value).toISOString().slice(0, 10);
	}

	function label(value: string) {
		return value.replaceAll('_', ' ');
	}

	function objectiveFor(id: string) {
		return data.objectives.find((objective) => objective.id === id);
	}

	function memberFor(id: string | null) {
		return id ? data.members.find((member) => member.id === id) : undefined;
	}

	function observationsForKpi(id: string) {
		return data.observations.filter((observation) => observation.strategy_kpi_id === id);
	}

	function latestObservation(id: string) {
		return observationsForKpi(id)[0];
	}

	function kpiFor(id: string) {
		return data.kpis.find((kpi) => kpi.id === id);
	}

	function reviewSnapshots(id: string) {
		return data.reviewKpis.filter((snapshot) => snapshot.strategy_review_id === id);
	}

	function scenarioAssumptions(id: string) {
		return data.scenarioAssumptions.filter((assumption) => assumption.strategy_scenario_id === id);
	}

	function scenarioProjections(id: string) {
		return data.scenarioProjections.filter((projection) => projection.strategy_scenario_id === id);
	}
</script>

<svelte:head><title>Strategy performance & foresight · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/more">More</a><span>/</span><a href="/strategy">Strategy</a><span>/</span><span>Performance & foresight</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">F01.06 + F01.07 + F01.08 · Strategy & Enterprise Planning</p>
		<h1>Strategy performance & foresight</h1>
		<p>Govern KPI definitions, actuals, variance, corrective action, strategic review and scenarios as one evidence chain. Canonical source identifiers remain visible so management reporting can drill back to operational truth.</p>
	</div>
	<div class="heading-actions">
		<span class="status-badge">VS3 Strategy-to-performance</span>
		<span class="status-badge">VS8 Record-to-report</span>
		<span class="status-badge">D8 + D19 + D1</span>
	</div>
</section>

{#if form?.error}<section class="notice error" role="alert">{form.error}</section>{/if}

<section class="principle-strip">
	<div><strong>Objective</strong><span>Approved strategic intent</span></div><div class="arrow">→</div>
	<div><strong>KPI + target</strong><span>Governed definition</span></div><div class="arrow">→</div>
	<div><strong>Actual + forecast</strong><span>Manual or canonical evidence</span></div><div class="arrow">→</div>
	<div><strong>Variance + action</strong><span>Accountable response</span></div><div class="arrow">→</div>
	<div><strong>Review + scenario</strong><span>Decision and foresight</span></div>
</section>

{#if data.frameworks.length}
	<section class="panel version-strip">
		<div><p class="eyebrow">Approved strategy</p><strong>Performance scope</strong></div>
		<div class="version-links">
			{#each data.frameworks as framework}
				<a class:active={data.selectedFramework?.public_id === framework.public_id} href={`/strategy/performance?framework=${framework.public_id}`}>
					<span>{framework.framework_code} · v{framework.version_number}</span><small>{framework.title}</small>
				</a>
			{/each}
		</div>
	</section>
{/if}

{#if !data.selectedFramework}
	<section class="empty-state">
		<p class="eyebrow">Approved strategy required</p>
		<h2>Performance evidence begins with approved strategic intent</h2>
		<p>Create and approve the enterprise strategy before defining KPIs, reviews or scenarios.</p>
		<a class="button-link" href="/strategy">Open strategy workspace</a>
	</section>
{:else}
	<section class="summary-grid">
		<div class="metric"><span>KPIs</span><strong>{data.kpis.filter((kpi) => kpi.lifecycle_status === 'approved').length}</strong><small>approved definitions</small></div>
		<div class="metric"><span>Observations</span><strong>{data.observations.length}</strong><small>append-only actuals</small></div>
		<div class="metric"><span>Actions</span><strong>{data.actions.filter((action) => ['open', 'in_progress'].includes(action.lifecycle_status)).length}</strong><small>open responses</small></div>
		<div class="metric"><span>Reviews</span><strong>{data.reviews.filter((review) => review.lifecycle_status === 'approved').length}</strong><small>approved evidence</small></div>
		<div class="metric"><span>Scenarios</span><strong>{data.scenarios.filter((scenario) => scenario.lifecycle_status === 'approved').length}</strong><small>approved versions</small></div>
	</section>

	<section class="panel">
		<div class="section-heading"><div><p class="eyebrow">F01.06 · Goal & KPI management</p><h2>KPI register</h2></div></div>
		{#if data.kpis.length}
			<div class="card-grid">
				{#each data.kpis as kpi}
					<article class="record-card">
						<div class="record-head"><div><small>{kpi.kpi_code} · v{kpi.version_number}</small><h3>{kpi.title}</h3></div><span class="pill">{label(kpi.lifecycle_status)}</span></div>
						<p>{kpi.description}</p>
						<div class="facts">
							<span><b>Objective</b>{objectiveFor(kpi.strategy_objective_id)?.objective_code ?? '—'}</span>
							<span><b>Baseline</b>{kpi.baseline_value} {kpi.unit_label}</span>
							<span><b>Target</b>{kpi.target_value} {kpi.unit_label}</span>
							<span><b>Direction</b>{label(kpi.direction)}</span>
							<span><b>Owner</b>{memberFor(kpi.owner_member_id)?.display_name ?? '—'}</span>
							<span><b>Source</b>{kpi.source_mode === 'canonical' ? `${kpi.source_domain} · ${kpi.source_record_type} · ${kpi.source_measure_key}` : 'manual evidence'}</span>
						</div>
						{#if latestObservation(kpi.id)}
							{@const observation = latestObservation(kpi.id)}
							<div class="observation"><b>Latest actual</b><strong>{observation.actual_value} {kpi.unit_label}</strong><span>{dateValue(observation.observed_on)} · forecast {observation.forecast_value ?? '—'}</span>{#if observation.source_mode === 'canonical'}<small>Source: {observation.source_domain}/{observation.source_record_type}/{observation.source_public_id}/{observation.source_measure_key}</small>{/if}</div>
						{/if}
						{#if data.canApprove && kpi.lifecycle_status === 'draft'}
							<form method="POST" action="?/approveKpi" class="inline-form"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><input type="hidden" name="kpiPublicId" value={kpi.public_id} /><button type="submit">Approve KPI version {kpi.version_number}</button></form>
						{/if}
						{#if data.canManage && kpi.lifecycle_status === 'approved'}
							<form method="POST" action="?/reviseKpi" class="inline-form"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><input type="hidden" name="kpiPublicId" value={kpi.public_id} /><button class="secondary" type="submit">Create KPI revision</button></form>
						{/if}
					</article>
				{/each}
			</div>
		{:else}<p class="muted">No KPI definitions yet.</p>{/if}
	</section>

	{#if data.canManage}
		<section class="panel split">
			<div>
				<h2>Define KPI</h2>
				<form method="POST" action="?/createKpi" class="form-grid">
					<input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} />
					<label>Strategic objective<select name="objectivePublicId" required>{#each data.objectives.filter((objective) => objective.lifecycle_status === 'active') as objective}<option value={objective.public_id}>{objective.objective_code} · {objective.title}</option>{/each}</select></label>
					<label>KPI code<input name="kpiCode" placeholder="KPI-MARGIN" required /></label>
					<label>KPI title<input name="title" required /></label>
					<label>Accountable owner<select name="ownerMemberId" required><option value="">Select owner</option>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
					<label>Unit<input name="unitLabel" placeholder="%" required /></label>
					<label>Direction<select name="direction"><option value="higher_is_better">Higher is better</option><option value="lower_is_better">Lower is better</option><option value="target_is_best">Target is best</option><option value="band">Target band</option></select></label>
					<label>Aggregation<select name="aggregationMethod"><option value="latest">Latest</option><option value="sum">Sum</option><option value="average">Average</option><option value="minimum">Minimum</option><option value="maximum">Maximum</option><option value="ratio">Ratio</option></select></label>
					<label>Baseline<input type="number" step="any" name="baselineValue" required /></label>
					<label>Target<input type="number" step="any" name="targetValue" required /></label>
					<label>Warning threshold<input type="number" step="any" name="warningThreshold" /></label>
					<label>Critical threshold<input type="number" step="any" name="criticalThreshold" /></label>
					<label>Target date<input type="date" name="targetDate" /></label>
					<label>Source mode<select name="sourceMode"><option value="manual">Manual evidence</option><option value="canonical">Canonical source</option></select></label>
					<label>Source domain<input name="sourceDomain" placeholder="finance" /></label>
					<label>Source record type<input name="sourceRecordType" placeholder="accounting_report" /></label>
					<label>Source measure key<input name="sourceMeasureKey" placeholder="gross_margin_percent" /></label>
					<label class="wide">KPI description<textarea name="description" rows="3" required></textarea></label>
					<div class="form-actions"><button type="submit">Create KPI draft</button></div>
				</form>
			</div>
			<div>
				<h2>Record actual & forecast</h2>
				<form method="POST" action="?/recordObservation" class="form-grid">
					<input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} />
					<label>Approved KPI<select name="kpiPublicId" required>{#each data.kpis.filter((kpi) => kpi.lifecycle_status === 'approved') as kpi}<option value={kpi.public_id}>{kpi.kpi_code} · {kpi.title}</option>{/each}</select></label>
					<label>Observed date<input type="date" name="observedOn" required /></label>
					<label>Actual value<input type="number" step="any" name="actualValue" required /></label>
					<label>Forecast value<input type="number" step="any" name="forecastValue" /></label>
					<label>Source mode<select name="sourceMode"><option value="manual">Manual evidence</option><option value="canonical">Canonical source</option></select></label>
					<label>Source domain<input name="sourceDomain" /></label>
					<label>Source record type<input name="sourceRecordType" /></label>
					<label>Source public ID<input name="sourcePublicId" /></label>
					<label>Source measure key<input name="sourceMeasureKey" /></label>
					<label class="wide">Commentary<textarea name="commentary" rows="3"></textarea></label>
					<div class="form-actions"><button type="submit">Record KPI observation</button></div>
				</form>
			</div>
		</section>

		<section class="panel">
			<h2>Corrective actions</h2>
			{#if data.actions.length}<div class="table-wrap"><table><thead><tr><th>Action</th><th>KPI</th><th>Owner</th><th>Due</th><th>Status</th><th>Control</th></tr></thead><tbody>{#each data.actions as action}<tr><td><strong>{action.action_code}</strong><br />{action.title}</td><td>{kpiFor(action.strategy_kpi_id)?.kpi_code ?? '—'}</td><td>{memberFor(action.owner_member_id)?.display_name ?? '—'}</td><td>{dateValue(action.due_date)}</td><td>{label(action.lifecycle_status)}</td><td>{#if ['open', 'in_progress'].includes(action.lifecycle_status)}<form method="POST" action="?/completeAction" class="compact"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><input type="hidden" name="actionPublicId" value={action.public_id} /><input name="completionNote" aria-label={`Completion note ${action.action_code}`} placeholder="Completion evidence" required /><button type="submit">Complete</button></form>{else}{action.completion_note ?? '—'}{/if}</td></tr>{/each}</tbody></table></div>{/if}
			<form method="POST" action="?/createAction" class="form-grid compact-top">
				<input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} />
				<label>Approved KPI<select name="kpiPublicId" required>{#each data.kpis.filter((kpi) => kpi.lifecycle_status === 'approved') as kpi}<option value={kpi.public_id}>{kpi.kpi_code} · {kpi.title}</option>{/each}</select></label>
				<label>Observation<select name="observationPublicId"><option value="">No specific observation</option>{#each data.observations as observation}<option value={observation.public_id}>{kpiFor(observation.strategy_kpi_id)?.kpi_code} · {dateValue(observation.observed_on)} · {observation.actual_value}</option>{/each}</select></label>
				<label>Action code<input name="actionCode" required /></label><label>Action title<input name="title" required /></label>
				<label>Action owner<select name="ownerMemberId" required>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label><label>Due date<input type="date" name="dueDate" required /></label>
				<label class="wide">Action<textarea name="actionText" rows="3" required></textarea></label><div class="form-actions"><button type="submit">Create corrective action</button></div>
			</form>
		</section>
	{/if}

	<section class="panel">
		<p class="eyebrow">F01.07 · Strategic review</p><h2>Management review evidence</h2>
		<div class="card-grid">
			{#each data.reviews as review}
				<article class="record-card"><div class="record-head"><div><small>{review.review_code} · {dateValue(review.review_date)}</small><h3>{review.title}</h3></div><span class="pill">{label(review.lifecycle_status)}</span></div><p>{review.summary}</p>
					{#each reviewSnapshots(review.id) as snapshot}<div class="snapshot"><b>{kpiFor(snapshot.strategy_kpi_id)?.kpi_code}</b><span>actual {snapshot.actual_value_snapshot} / target {snapshot.target_value_snapshot}</span><strong>{label(snapshot.assessment)}</strong><small>variance {snapshot.variance_value} ({snapshot.variance_percent ?? 'n/a'}%)</small></div>{/each}
					{#if data.canApprove && review.lifecycle_status === 'draft'}<form method="POST" action="?/approveReview" class="inline-form"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><input type="hidden" name="reviewPublicId" value={review.public_id} /><button type="submit">Approve strategic review</button></form>{/if}
				</article>
			{/each}
		</div>
		{#if data.canManage}
			<div class="split compact-top">
				<form method="POST" action="?/createReview" class="form-grid"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><h3 class="wide">New strategic review</h3><label>Review code<input name="reviewCode" required /></label><label>Review date<input type="date" name="reviewDate" required /></label><label class="wide">Review title<input name="title" required /></label><label class="wide">Review summary<textarea name="summary" rows="3" required></textarea></label><label class="wide">Decisions<textarea name="decisionsText" rows="3"></textarea></label><div class="form-actions"><button type="submit">Create review draft</button></div></form>
				<form method="POST" action="?/addReviewKpi" class="form-grid"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><h3 class="wide">Snapshot KPI into review</h3><label>Draft review<select name="reviewPublicId" required>{#each data.reviews.filter((review) => review.lifecycle_status === 'draft') as review}<option value={review.public_id}>{review.review_code} · {review.title}</option>{/each}</select></label><label>Approved KPI<select name="kpiPublicId" required>{#each data.kpis.filter((kpi) => kpi.lifecycle_status === 'approved') as kpi}<option value={kpi.public_id}>{kpi.kpi_code} · {kpi.title}</option>{/each}</select></label><label>KPI observation<select name="observationPublicId" required>{#each data.observations as observation}<option value={observation.public_id}>{kpiFor(observation.strategy_kpi_id)?.kpi_code} · {dateValue(observation.observed_on)} · {observation.actual_value}</option>{/each}</select></label><label>Assessment<select name="assessment"><option value="on_track">On track</option><option value="watch">Watch</option><option value="off_track">Off track</option><option value="not_measured">Not measured</option></select></label><label class="wide">Review commentary<textarea name="commentary" rows="3"></textarea></label><div class="form-actions"><button type="submit">Add KPI snapshot</button></div></form>
			</div>
		{/if}
	</section>

	<section class="panel">
		<p class="eyebrow">F01.08 · Scenario & foresight planning</p><h2>Scenario portfolio</h2>
		<div class="card-grid">
			{#each data.scenarios as scenario}
				<article class="record-card"><div class="record-head"><div><small>{scenario.scenario_code} · v{scenario.version_number} · {label(scenario.scenario_type)}</small><h3>{scenario.title}</h3></div><span class="pill">{label(scenario.lifecycle_status)}</span></div><p>{scenario.narrative}</p><small>{dateValue(scenario.horizon_start)} → {dateValue(scenario.horizon_end)}</small>
					{#each scenarioAssumptions(scenario.id) as assumption}<div class="snapshot"><b>{assumption.assumption_code} · {assumption.title}</b><span>{assumption.baseline_value} → {assumption.scenario_value} {assumption.unit_label}</span><small>{assumption.variable_key} · sensitivity {assumption.sensitivity_percent ?? '—'}%</small></div>{/each}
					{#each scenarioProjections(scenario.id) as projection}<div class="snapshot"><b>{kpiFor(projection.strategy_kpi_id)?.kpi_code} projection</b><span>{projection.projected_value} · {dateValue(projection.projection_date)}</span><small>{projection.rationale}</small></div>{/each}
					{#if data.canApprove && scenario.lifecycle_status === 'draft'}<form method="POST" action="?/approveScenario" class="inline-form"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><input type="hidden" name="scenarioPublicId" value={scenario.public_id} /><button type="submit">Approve scenario version {scenario.version_number}</button></form>{/if}
					{#if data.canManage && scenario.lifecycle_status === 'approved'}<form method="POST" action="?/reviseScenario" class="inline-form"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><input type="hidden" name="scenarioPublicId" value={scenario.public_id} /><button class="secondary" type="submit">Create scenario revision</button></form>{/if}
				</article>
			{/each}
		</div>
		{#if data.canManage}
			<div class="split compact-top">
				<form method="POST" action="?/createScenario" class="form-grid"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><h3 class="wide">New scenario</h3><label>Scenario code<input name="scenarioCode" required /></label><label>Scenario type<select name="scenarioType"><option value="baseline">Baseline</option><option value="upside">Upside</option><option value="downside">Downside</option><option value="stress">Stress</option><option value="custom">Custom</option></select></label><label>Scenario title<input name="title" required /></label><label>Horizon start<input type="date" name="horizonStart" required /></label><label>Horizon end<input type="date" name="horizonEnd" required /></label><label class="wide">Scenario narrative<textarea name="narrative" rows="3" required></textarea></label><div class="form-actions"><button type="submit">Create scenario draft</button></div></form>
				<form method="POST" action="?/addScenarioAssumption" class="form-grid"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><h3 class="wide">Scenario assumption</h3><label>Draft scenario<select name="scenarioPublicId" required>{#each data.scenarios.filter((scenario) => scenario.lifecycle_status === 'draft') as scenario}<option value={scenario.public_id}>{scenario.scenario_code} · v{scenario.version_number}</option>{/each}</select></label><label>Assumption code<input name="assumptionCode" required /></label><label>Assumption title<input name="title" required /></label><label>Variable key<input name="variableKey" required /></label><label>Unit<input name="unitLabel" required /></label><label>Baseline value<input type="number" step="any" name="baselineValue" required /></label><label>Scenario value<input type="number" step="any" name="scenarioValue" required /></label><label>Sensitivity percent<input type="number" step="any" min="0" name="sensitivityPercent" /></label><label class="wide">Assumption description<textarea name="description" rows="3" required></textarea></label><div class="form-actions"><button type="submit">Add scenario assumption</button></div></form>
			</div>
			<form method="POST" action="?/addScenarioProjection" class="form-grid compact-top"><input type="hidden" name="frameworkPublicId" value={data.selectedFramework.public_id} /><h3 class="wide">KPI scenario projection</h3><label>Draft scenario<select name="scenarioPublicId" required>{#each data.scenarios.filter((scenario) => scenario.lifecycle_status === 'draft') as scenario}<option value={scenario.public_id}>{scenario.scenario_code} · v{scenario.version_number}</option>{/each}</select></label><label>Approved KPI<select name="kpiPublicId" required>{#each data.kpis.filter((kpi) => kpi.lifecycle_status === 'approved') as kpi}<option value={kpi.public_id}>{kpi.kpi_code} · {kpi.title}</option>{/each}</select></label><label>Projection date<input type="date" name="projectionDate" required /></label><label>Projected value<input type="number" step="any" name="projectedValue" required /></label><label class="wide">Projection rationale<textarea name="rationale" rows="3" required></textarea></label><div class="form-actions"><button type="submit">Add KPI projection</button></div></form>
		{/if}
	</section>
{/if}

<style>
	.breadcrumbs{display:flex;gap:.5rem;align-items:center;margin-bottom:1rem;font-size:.85rem}.breadcrumbs a{color:var(--color-text-muted,#5d6673)}
	.page-heading{display:flex;justify-content:space-between;gap:2rem;align-items:flex-start;margin-bottom:1.5rem}.page-heading h1{margin:.2rem 0 .5rem;font-size:2rem}.page-heading p{max-width:75rem;color:var(--color-text-muted,#5d6673)}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--color-text-muted,#5d6673)}.heading-actions{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end}.status-badge,.pill{border:1px solid var(--color-border,#dfe3e8);border-radius:999px;padding:.35rem .65rem;font-size:.75rem;white-space:nowrap}.principle-strip{display:flex;align-items:center;gap:.75rem;padding:1rem;border:1px solid var(--color-border,#dfe3e8);border-radius:.75rem;margin-bottom:1.5rem;overflow:auto}.principle-strip div:not(.arrow){min-width:9rem}.principle-strip span{display:block;color:var(--color-text-muted,#5d6673);font-size:.78rem}.arrow{color:var(--color-text-muted,#5d6673)}.panel{border:1px solid var(--color-border,#dfe3e8);border-radius:.75rem;padding:1.25rem;margin-bottom:1.25rem;background:var(--color-surface,#fff)}.version-strip{display:flex;gap:1rem;align-items:center}.version-links{display:flex;gap:.5rem;overflow:auto}.version-links a{display:flex;flex-direction:column;padding:.55rem .75rem;border:1px solid var(--color-border,#dfe3e8);border-radius:.5rem;min-width:13rem;text-decoration:none}.version-links a.active{outline:2px solid currentColor}.version-links small,.muted{color:var(--color-text-muted,#5d6673)}.summary-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.75rem;margin-bottom:1.25rem}.metric{border:1px solid var(--color-border,#dfe3e8);border-radius:.75rem;padding:1rem;display:flex;flex-direction:column}.metric strong{font-size:1.7rem}.metric small{color:var(--color-text-muted,#5d6673)}.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(19rem,1fr));gap:.8rem}.record-card{border:1px solid var(--color-border,#dfe3e8);border-radius:.65rem;padding:1rem}.record-head{display:flex;justify-content:space-between;gap:1rem}.record-head h3{margin:.2rem 0}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.5rem;font-size:.82rem}.facts span{display:flex;flex-direction:column}.observation,.snapshot{display:flex;flex-direction:column;gap:.15rem;padding:.7rem;margin-top:.7rem;border-radius:.5rem;background:var(--color-surface-subtle,#f6f7f8)}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}.form-grid label{display:flex;flex-direction:column;gap:.3rem;font-size:.82rem;font-weight:600}.form-grid input,.form-grid select,.form-grid textarea,.compact input{padding:.55rem;border:1px solid var(--color-border,#cbd2d9);border-radius:.4rem;background:var(--color-surface,#fff);color:inherit}.wide,.form-actions{grid-column:1/-1}.form-actions{display:flex;justify-content:flex-end}.split{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.25rem}.compact-top{margin-top:1.25rem}.inline-form{margin-top:.75rem}.compact{display:flex;gap:.4rem}.notice{padding:1rem;border-radius:.5rem;margin-bottom:1rem}.error{border:1px solid #b42318}.empty-state{text-align:center;padding:3rem;border:1px dashed var(--color-border,#dfe3e8);border-radius:.75rem}.button-link,button{display:inline-block;border:0;border-radius:.45rem;padding:.6rem .9rem;background:var(--color-primary,#1f5eff);color:#fff;text-decoration:none;cursor:pointer}.secondary{background:var(--color-text-muted,#5d6673)}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.65rem;border-bottom:1px solid var(--color-border,#dfe3e8);vertical-align:top;font-size:.82rem}
	@media(max-width:900px){.page-heading,.version-strip{flex-direction:column}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.split,.form-grid{grid-template-columns:1fr}.wide,.form-actions{grid-column:auto}.principle-strip{align-items:flex-start}.heading-actions{justify-content:flex-start}}
</style>
