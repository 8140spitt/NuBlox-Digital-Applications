<script lang="ts">
	import type { PageData } from './$types';

	let { data, form }: { data: PageData; form: { error?: string } | null } = $props();

	const selected = $derived(data.selectedFramework);
	const kpiById = $derived(new Map(data.kpis.map((row) => [row.id, row])));
	const periodById = $derived(new Map(data.periods.map((row) => [row.id, row])));
	const packById = $derived(new Map(data.packs.map((row) => [row.id, row])));
	const varianceById = $derived(new Map(data.variances.map((row) => [row.id, row])));

	function formatDate(value: Date | string | null | undefined) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
	}

	function displayNumber(value: string | number | null | undefined) {
		if (value === null || value === undefined || value === '') return '—';
		const number = Number(value);
		return Number.isFinite(number) ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(number) : String(value);
	}
</script>

<svelte:head><title>Enterprise Performance | NuBlox</title></svelte:head>

<div class="workspace">
	<header class="hero">
		<div>
			<p class="eyebrow">F03 · Enterprise Performance Management</p>
			<h1>Performance command centre</h1>
			<p>Convert approved strategic KPIs into governed reporting, intervention, executive review, benchmarking and benefits evidence.</p>
		</div>
		<div class="hero-stats">
			<div><strong>{data.kpis.length}</strong><span>approved KPIs</span></div>
			<div><strong>{data.packs.length}</strong><span>reporting packs</span></div>
			<div><strong>{data.variances.filter((row) => row.lifecycle_status !== 'closed').length}</strong><span>open variances</span></div>
			<div><strong>{data.benefits.filter((row) => row.lifecycle_status === 'active').length}</strong><span>active benefits</span></div>
		</div>
	</header>

	{#if form?.error}<div class="error" role="alert">{form.error}</div>{/if}

	<section class="selector card">
		<div>
			<span class="section-code">F03.01</span>
			<h2>Performance framework</h2>
		</div>
		{#if data.frameworks.length}
			<nav aria-label="Performance frameworks">
				{#each data.frameworks as framework}
					<a class:active={selected?.public_id === framework.public_id} href={`/performance?framework=${framework.public_id}`}>
						<strong>{framework.framework_code}</strong> v{framework.version_number}
						<span>{framework.lifecycle_status}</span>
					</a>
				{/each}
			</nav>
		{:else}<p>No performance framework exists yet. Create the first governed framework below.</p>{/if}
	</section>

	{#if selected}
		<section class="overview-grid">
			<article class="card emphasis">
				<span class="section-code">Current framework</span>
				<h2>{selected.title}</h2>
				<p>{selected.purpose_text}</p>
				<dl>
					<div><dt>Cadence</dt><dd>{selected.reporting_cadence}</dd></div>
					<div><dt>Effective</dt><dd>{formatDate(selected.effective_from)}</dd></div>
					<div><dt>Status</dt><dd>{selected.lifecycle_status}</dd></div>
				</dl>
				{#if data.canApprove && selected.lifecycle_status === 'draft'}
					<form method="POST" action="?/approveFramework"><input type="hidden" name="frameworkPublicId" value={selected.public_id} /><button>Approve framework</button></form>
				{/if}
				{#if data.canManage && selected.lifecycle_status === 'approved'}
					<form method="POST" action="?/reviseFramework"><input type="hidden" name="frameworkPublicId" value={selected.public_id} /><button class="secondary">Create controlled revision</button></form>
				{/if}
			</article>

			<article class="card">
				<span class="section-code">KPI composition</span>
				<h2>{data.frameworkKpis.length} measures in scope</h2>
				<div class="list compact">
					{#each data.frameworkKpis as link}
						{@const kpi = kpiById.get(link.strategy_kpi_id)}
						<div class="row"><div><strong>{kpi?.kpi_code ?? 'KPI'}</strong><span>{kpi?.title ?? 'Canonical KPI'}</span></div><div class="metric">Target {displayNumber(kpi?.target_value)} {kpi?.unit_label}</div></div>
					{/each}
				</div>
			</article>
		</section>
	{/if}

	<section class="flow-grid">
		<article class="card span-2">
			<div class="section-heading"><div><span class="section-code">F03.02</span><h2>Performance reporting</h2></div><span class="badge">Authoritative KPI snapshots</span></div>
			<div class="list">
				{#each data.packs as pack}
					{@const period = periodById.get(pack.performance_period_id)}
					<div class="row report-row">
						<div><strong>{pack.pack_code} · {pack.title}</strong><span>{period?.title ?? 'Reporting period'} · {pack.lifecycle_status}</span></div>
						<div class="row-actions">
							<span>{data.packKpis.filter((item) => item.performance_pack_id === pack.id).length} KPIs</span>
							{#if data.canApprove && pack.lifecycle_status === 'draft'}<form method="POST" action="?/approvePack"><input type="hidden" name="packPublicId" value={pack.public_id}/><input type="hidden" name="frameworkPublicId" value={selected?.public_id ?? ''}/><button class="small">Approve</button></form>{/if}
						</div>
					</div>
				{/each}
				{#if !data.packs.length}<p class="empty">No packs yet. Open a reporting period and build a pack from canonical KPI observations.</p>{/if}
			</div>
		</article>

		<article class="card">
			<span class="section-code">F03.03</span><h2>Variance & intervention</h2>
			<div class="list compact">
				{#each data.variances as variance}
					<div class="row"><div><strong>{variance.variance_code}</strong><span>{variance.cause_category} · {variance.materiality}</span></div><span class:critical={variance.materiality === 'critical'} class="status">{variance.lifecycle_status}</span></div>
				{/each}
				{#if !data.variances.length}<p class="empty">No governed variance cases.</p>{/if}
			</div>
		</article>

		<article class="card">
			<span class="section-code">F03.04</span><h2>Executive review</h2>
			<div class="list compact">
				{#each data.reviews as review}
					<div class="row"><div><strong>{review.review_code}</strong><span>{review.title} · {formatDate(review.review_date)}</span></div><span class="status">{review.lifecycle_status}</span></div>
				{/each}
				{#if !data.reviews.length}<p class="empty">No executive performance reviews recorded.</p>{/if}
			</div>
		</article>

		<article class="card">
			<span class="section-code">F03.05</span><h2>Benchmarking</h2>
			<div class="list compact">
				{#each data.benchmarks as benchmark}
					<div class="row"><div><strong>{benchmark.benchmark_code}</strong><span>{benchmark.title} · {benchmark.benchmark_type}</span></div><span class="metric">{displayNumber(benchmark.benchmark_value)} {benchmark.unit_label}</span></div>
				{/each}
				{#if !data.benchmarks.length}<p class="empty">No internal, peer or industry benchmarks registered.</p>{/if}
			</div>
		</article>

		<article class="card">
			<span class="section-code">F03.06</span><h2>Benefits realisation</h2>
			<div class="list compact">
				{#each data.benefits as benefit}
					<div class="row"><div><strong>{benefit.benefit_code}</strong><span>{benefit.title} · due {formatDate(benefit.target_date)}</span></div><span class="status">{benefit.lifecycle_status}</span></div>
				{/each}
				{#if !data.benefits.length}<p class="empty">No benefits are under active measurement.</p>{/if}
			</div>
		</article>
	</section>

	{#if data.canManage}
		<section class="forms">
			<h2>Operate the performance cycle</h2>
			<p>Each transaction is organisation-scoped, permission checked, audited and emitted to the outbox.</p>
			<div class="form-grid">
				<details class="card" open={!selected}>
					<summary>Create performance framework</summary>
					<form method="POST" action="?/createFramework" class="stack">
						<label>Code<input name="frameworkCode" placeholder="PERF-2027" required /></label><label>Title<input name="title" required /></label>
						<label>Purpose<textarea name="purposeText" required></textarea></label><label>Scope<textarea name="scopeText" required></textarea></label>
						<label>Cadence<select name="reportingCadence"><option>monthly</option><option>quarterly</option><option>weekly</option><option>annual</option></select></label>
						<label>Owner<select name="ownerMemberId" required>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
						<label>Effective from<input type="date" name="effectiveFrom" required /></label><label>Effective to<input type="date" name="effectiveTo" /></label><button>Create framework</button>
					</form>
				</details>

				{#if selected?.lifecycle_status === 'draft'}
					<details class="card" open><summary>Add canonical KPI</summary><form method="POST" action="?/addFrameworkKpi" class="stack">
						<input type="hidden" name="frameworkPublicId" value={selected.public_id}/><label>KPI<select name="kpiPublicId" required>{#each data.kpis as kpi}<option value={kpi.public_id}>{kpi.kpi_code} · {kpi.title}</option>{/each}</select></label>
						<label>Display order<input type="number" min="1" name="displayOrder" value="1" /></label><label>Materiality threshold %<input type="number" step="0.01" name="materialityThresholdPercent" /></label><label class="check"><input type="checkbox" name="commentaryRequired" checked /> Commentary required</label><button>Add KPI</button>
					</form></details>
				{/if}

				{#if selected?.lifecycle_status === 'approved'}
					<details class="card"><summary>Open reporting period</summary><form method="POST" action="?/createPeriod" class="stack"><input type="hidden" name="frameworkPublicId" value={selected.public_id}/><label>Period code<input name="periodCode" placeholder="2026-09" required/></label><label>Title<input name="title" required/></label><label>Start<input type="date" name="periodStart" required/></label><label>End<input type="date" name="periodEnd" required/></label><label>Reporting date<input type="date" name="reportingDate" required/></label><button>Open period</button></form></details>
					<details class="card"><summary>Build reporting pack</summary><form method="POST" action="?/createPack" class="stack"><input type="hidden" name="frameworkPublicId" value={selected.public_id}/><label>Period<select name="periodPublicId" required>{#each data.periods.filter((row) => row.lifecycle_status !== 'closed') as period}<option value={period.public_id}>{period.period_code} · {period.title}</option>{/each}</select></label><label>Pack code<input name="packCode" required/></label><label>Title<input name="title" required/></label><label>Executive summary<textarea name="executiveSummary" required></textarea></label><button>Build from canonical KPI facts</button></form></details>
				{/if}

				<details class="card"><summary>Open variance case</summary><form method="POST" action="?/createVariance" class="stack"><input type="hidden" name="frameworkPublicId" value={selected?.public_id ?? ''}/><label>Off-track KPI<select name="packKpiId" required>{#each data.packKpis.filter((row) => row.assessment !== 'on_track') as item}<option value={item.id}>{kpiById.get(item.strategy_kpi_id)?.kpi_code ?? 'KPI'} · {item.assessment}</option>{/each}</select></label><label>Variance code<input name="varianceCode" required/></label><label>Materiality<select name="materiality"><option>medium</option><option>high</option><option>critical</option><option>low</option></select></label><label>Cause<select name="causeCategory"><option>productivity</option><option>volume</option><option>price</option><option>timing</option><option>scope</option><option>quality</option><option>external</option><option>forecast</option><option>other</option></select></label><label>Root cause<textarea name="rootCauseText" required></textarea></label><label>Impact<textarea name="impactText" required></textarea></label><label>Owner<select name="ownerMemberId">{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label><button>Open variance</button></form></details>

				<details class="card"><summary>Create corrective action</summary><form method="POST" action="?/createAction" class="stack"><input type="hidden" name="frameworkPublicId" value={selected?.public_id ?? ''}/><label>Variance<select name="variancePublicId" required>{#each data.variances.filter((row) => row.lifecycle_status !== 'closed') as variance}<option value={variance.public_id}>{variance.variance_code}</option>{/each}</select></label><label>Action code<input name="actionCode" required/></label><label>Title<input name="title" required/></label><label>Action<textarea name="actionText" required></textarea></label><label>Owner<select name="ownerMemberId">{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label><label>Due date<input type="date" name="dueDate" required/></label><label>Source domain<input name="sourceDomain" placeholder="projects"/></label><label>Source record type<input name="sourceRecordType" placeholder="project_action"/></label><label>Source public ID<input name="sourcePublicId"/></label><button>Create corrective action</button></form></details>

				<details class="card"><summary>Complete corrective action</summary><form method="POST" action="?/completeAction" class="stack"><input type="hidden" name="frameworkPublicId" value={selected?.public_id ?? ''}/><label>Action<select name="actionPublicId" required>{#each data.actions.filter((row) => row.lifecycle_status !== 'completed') as action}<option value={action.public_id}>{action.action_code} · {action.title}</option>{/each}</select></label><label>Completion evidence<textarea name="completionEvidence" required></textarea></label><button>Record completion</button></form></details>

				<details class="card"><summary>Close variance</summary><form method="POST" action="?/closeVariance" class="stack"><input type="hidden" name="frameworkPublicId" value={selected?.public_id ?? ''}/><label>Variance<select name="variancePublicId" required>{#each data.variances.filter((row) => row.lifecycle_status !== 'closed') as variance}<option value={variance.public_id}>{variance.variance_code}</option>{/each}</select></label><label>Resolution<textarea name="resolutionText" required></textarea></label><button>Close variance</button></form></details>

				<details class="card"><summary>Record executive review</summary><form method="POST" action="?/createReview" class="stack"><input type="hidden" name="frameworkPublicId" value={selected?.public_id ?? ''}/><label>Approved pack<select name="packPublicId" required>{#each data.packs.filter((row) => row.lifecycle_status === 'approved') as pack}<option value={pack.public_id}>{pack.pack_code} · {pack.title}</option>{/each}</select></label><label>Review code<input name="reviewCode" required/></label><label>Review date<input type="date" name="reviewDate" required/></label><label>Title<input name="title" required/></label><label>Summary<textarea name="summary" required></textarea></label><label>Decision<textarea name="decisionText"></textarea></label><label>Governance meeting public ID<input name="governanceMeetingPublicId"/></label><label>Governance decision public ID<input name="governanceDecisionPublicId"/></label><button>Record executive review</button></form></details>

				<details class="card"><summary>Create benchmark</summary><form method="POST" action="?/createBenchmark" class="stack"><input type="hidden" name="frameworkPublicId" value={selected?.public_id ?? ''}/><label>KPI<select name="kpiPublicId" required>{#each data.kpis as kpi}<option value={kpi.public_id}>{kpi.kpi_code} · {kpi.title}</option>{/each}</select></label><label>Benchmark code<input name="benchmarkCode" required/></label><label>Type<select name="benchmarkType"><option>internal</option><option>peer</option><option>industry</option><option>external</option><option>target</option></select></label><label>Title<input name="title" required/></label><label>Scope<textarea name="scopeText" required></textarea></label><label>Unit<input name="unitLabel" required/></label><label>Period start<input type="date" name="periodStart" required/></label><label>Period end<input type="date" name="periodEnd" required/></label><label>Benchmark value<input type="number" step="any" name="benchmarkValue" required/></label><label>Provenance<textarea name="provenanceText" required></textarea></label><label>Source reference<input name="sourceReference"/></label><button>Create benchmark</button></form></details>

				<details class="card"><summary>Compare benchmark</summary><form method="POST" action="?/compareBenchmark" class="stack"><input type="hidden" name="frameworkPublicId" value={selected?.public_id ?? ''}/><label>Benchmark<select name="benchmarkPublicId" required>{#each data.benchmarks as benchmark}<option value={benchmark.public_id}>{benchmark.benchmark_code}</option>{/each}</select></label><label>Observation<select name="observationPublicId" required>{#each data.observations as observation}<option value={observation.public_id}>{kpiById.get(observation.strategy_kpi_id)?.kpi_code ?? 'KPI'} · {formatDate(observation.observed_on)} · {displayNumber(observation.actual_value)}</option>{/each}</select></label><label>Interpretation<textarea name="interpretation" required></textarea></label><button>Record comparison</button></form></details>

				<details class="card"><summary>Register benefit</summary><form method="POST" action="?/createBenefit" class="stack"><input type="hidden" name="frameworkPublicId" value={selected?.public_id ?? ''}/><label>KPI<select name="kpiPublicId" required>{#each data.kpis as kpi}<option value={kpi.public_id}>{kpi.kpi_code} · {kpi.title}</option>{/each}</select></label><label>Benefit code<input name="benefitCode" required/></label><label>Title<input name="title" required/></label><label>Type<select name="benefitType"><option>financial</option><option>operational</option><option>customer</option><option>people</option><option>risk</option><option>sustainability</option><option>other</option></select></label><label>Unit<input name="unitLabel" required/></label><label>Baseline<input type="number" step="any" name="baselineValue" required/></label><label>Target<input type="number" step="any" name="targetValue" required/></label><label>Target date<input type="date" name="targetDate" required/></label><label>Owner<select name="ownerMemberId">{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label><label>Review cadence<select name="reviewCadence"><option>monthly</option><option>quarterly</option><option>weekly</option><option>annual</option></select></label><label>Source domain<input name="sourceDomain" placeholder="projects" required/></label><label>Source record type<input name="sourceRecordType" placeholder="project" required/></label><label>Source public ID<input name="sourcePublicId" required/></label><button>Register benefit</button></form></details>

				<details class="card"><summary>Measure benefit</summary><form method="POST" action="?/measureBenefit" class="stack"><input type="hidden" name="frameworkPublicId" value={selected?.public_id ?? ''}/><label>Benefit<select name="benefitPublicId" required>{#each data.benefits.filter((row) => !['closed','cancelled'].includes(row.lifecycle_status)) as benefit}<option value={benefit.public_id}>{benefit.benefit_code} · {benefit.title}</option>{/each}</select></label><label>Measured on<input type="date" name="measuredOn" required/></label><label>Realised value<input type="number" step="any" name="realisedValue" required/></label><label>Confidence %<input type="number" min="0" max="100" step="0.01" name="confidencePercent" required/></label><label>Evidence<textarea name="evidenceText" required></textarea></label><label>Source domain<input name="sourceDomain"/></label><label>Source record type<input name="sourceRecordType"/></label><label>Source public ID<input name="sourcePublicId"/></label><button>Record measurement</button></form></details>
			</div>
		</section>
	{/if}
</div>

<style>
	:global(body){background:#f4f6f8}.workspace{max-width:1500px;margin:0 auto;padding:28px;display:grid;gap:20px;color:#15202b}.hero{display:flex;justify-content:space-between;gap:32px;align-items:flex-end;padding:30px;border-radius:18px;background:#15202b;color:white}.hero h1{font-size:clamp(2rem,4vw,3.4rem);margin:.2rem 0}.hero p{max-width:760px;color:#cbd5df}.eyebrow,.section-code{font-size:.76rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.eyebrow{color:#8fd3ff}.hero-stats{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:10px}.hero-stats div{background:#ffffff12;border:1px solid #ffffff20;border-radius:12px;padding:14px}.hero-stats strong{display:block;font-size:1.8rem}.hero-stats span{font-size:.78rem;color:#cbd5df}.card{background:white;border:1px solid #dfe5ea;border-radius:14px;padding:20px;box-shadow:0 8px 24px #1122330a}.selector{display:flex;justify-content:space-between;gap:20px;align-items:center}.selector nav{display:flex;gap:8px;flex-wrap:wrap}.selector a{display:grid;gap:2px;text-decoration:none;color:#263442;border:1px solid #d8e0e7;border-radius:9px;padding:9px 12px}.selector a span{font-size:.72rem;text-transform:uppercase}.selector a.active{border-color:#15202b;background:#eef3f7}.section-code{color:#567083}.overview-grid,.flow-grid,.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.flow-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.span-2{grid-column:span 2}.emphasis{border-top:4px solid #15202b}.section-heading{display:flex;justify-content:space-between;gap:12px;align-items:start}.badge,.status{font-size:.74rem;font-weight:700;padding:5px 8px;border-radius:999px;background:#eef2f5;text-transform:uppercase}.critical{background:#fee2e2;color:#991b1b}.list{display:grid;gap:10px;margin-top:16px}.compact{gap:7px}.row{display:flex;justify-content:space-between;gap:16px;align-items:center;border-top:1px solid #eef2f5;padding-top:10px}.row:first-child{border-top:0}.row div:first-child{display:grid;gap:3px}.row span{font-size:.82rem;color:#60707d}.metric{font-size:.84rem;font-weight:700;text-align:right}.row-actions{display:flex;align-items:center;gap:8px}.empty{color:#71808d;font-size:.9rem}.forms{padding-top:8px}.stack{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.stack label{display:grid;gap:5px;font-size:.8rem;font-weight:700;color:#42515e}.stack textarea{min-height:86px}.stack textarea,.stack input,.stack select{width:100%;box-sizing:border-box;border:1px solid #cfd8df;border-radius:8px;padding:9px;background:white;color:#17212b;font:inherit}.stack label:has(textarea){grid-column:span 2}.check{display:flex!important;grid-column:span 2;align-items:center!important}.check input{width:auto}.stack button{grid-column:span 2}button{border:0;border-radius:8px;background:#15202b;color:white;font-weight:800;padding:10px 14px;cursor:pointer}.secondary{background:#e9eef2;color:#15202b}.small{padding:6px 9px;font-size:.76rem}summary{font-weight:800;cursor:pointer}.error{border-radius:10px;background:#fee2e2;color:#991b1b;padding:13px 16px;font-weight:700}dl{display:flex;gap:18px;flex-wrap:wrap}dt{font-size:.72rem;color:#71808d;text-transform:uppercase}dd{margin:2px 0 0;font-weight:800}@media(max-width:1000px){.hero,.selector{align-items:stretch;flex-direction:column}.flow-grid,.overview-grid,.form-grid{grid-template-columns:1fr}.span-2{grid-column:auto}}@media(max-width:650px){.workspace{padding:14px}.hero{padding:22px}.hero-stats{grid-template-columns:1fr 1fr}.stack{grid-template-columns:1fr}.stack label:has(textarea),.check,.stack button{grid-column:auto}}
</style>
