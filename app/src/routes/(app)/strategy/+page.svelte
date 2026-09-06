<script lang="ts">
	let { data, form } = $props();

	function dateValue(value: Date | string | null | undefined) {
		if (!value) return '';
		return new Date(value).toISOString().slice(0, 10);
	}

	function label(value: string) {
		return value.replaceAll('_', ' ');
	}
</script>

<svelte:head><title>Strategy & enterprise planning · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/more">More</a><span>/</span><span>Strategy & enterprise planning</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">F01 · Strategy & Enterprise Planning</p>
		<h1>Strategy & enterprise planning</h1>
		<p>
			Control purpose, vision, environmental evidence, strategic choices and objectives as one
			versioned enterprise record. Approved versions are immutable and changes proceed through
			attributable superseding revisions.
		</p>
	</div>
	<div class="heading-actions">
		<span class="status-badge">VS3 Strategy-to-performance</span>
		<span class="status-badge">D8 + D19</span>
	</div>
</section>

{#if form?.error}
	<section class="notice error" role="alert">{form.error}</section>
{/if}

{#if data.frameworks.length}
	<section class="panel version-strip">
		<div>
			<p class="eyebrow">Strategy history</p>
			<strong>Controlled versions</strong>
		</div>
		<div class="version-links">
			{#each data.frameworks as framework}
				<a
					class:active={data.selectedFramework?.public_id === framework.public_id}
					href={`/strategy?framework=${framework.public_id}`}
				>
					<span>{framework.framework_code} · v{framework.version_number}</span>
					<small>{label(framework.lifecycle_status)}</small>
				</a>
			{/each}
		</div>
	</section>
{/if}

{#if !data.selectedFramework}
	<section class="empty-state">
		<p class="eyebrow">No strategic framework yet</p>
		<h2>Create the first governed enterprise strategy</h2>
		<p>
			Start with the organisation's strategic horizon, purpose, vision and mission. Environmental
			analysis, strategic options and objectives are then captured against the same version.
		</p>
	</section>

	{#if data.canManage}
		<section class="panel">
			<h2>New strategic framework</h2>
			<form method="POST" action="?/createFramework" class="form-grid">
				<label>Framework code <input name="frameworkCode" value="ENTERPRISE" required /></label>
				<label>Title <input name="title" placeholder="2027–2031 Enterprise Strategy" required /></label>
				<label>Horizon start <input type="date" name="horizonStart" required /></label>
				<label>Horizon end <input type="date" name="horizonEnd" required /></label>
				<label class="wide">Purpose <textarea name="purposeText" rows="3" required></textarea></label>
				<label class="wide">Vision <textarea name="visionText" rows="3" required></textarea></label>
				<label class="wide">Mission <textarea name="missionText" rows="3" required></textarea></label>
				<label>
					Accountable owner
					<select name="ownerMemberId">
						<option value="">Unassigned</option>
						{#each data.members as member}
							<option value={member.id}>{member.display_name}</option>
						{/each}
					</select>
				</label>
				<div class="form-actions"><button type="submit">Create strategy draft</button></div>
			</form>
		</section>
	{/if}
{:else}
	{@const framework = data.selectedFramework}

	<section class="strategy-summary">
		<div>
			<span>Framework</span>
			<strong>{framework.framework_code} · version {framework.version_number}</strong>
		</div>
		<div>
			<span>Status</span>
			<strong class:approved={framework.lifecycle_status === 'approved'}>{label(framework.lifecycle_status)}</strong>
		</div>
		<div>
			<span>Horizon</span>
			<strong>{dateValue(framework.horizon_start)} → {dateValue(framework.horizon_end)}</strong>
		</div>
		<div>
			<span>Evidence</span>
			<strong>{data.environmentFactors.length} factors · {data.options.length} options · {data.objectives.length} objectives</strong>
		</div>
	</section>

	{#if framework.lifecycle_status === 'approved'}
		<section class="notice success">
			<div>
				<strong>Approved strategy version</strong>
				<span>
					This version is immutable. Any change creates a new draft that explicitly supersedes this
					approved evidence.
				</span>
			</div>
			{#if data.canManage}
				<form method="POST" action="?/reviseFramework">
					<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
					<button type="submit" class="secondary">Create revision</button>
				</form>
			{/if}
		</section>
	{/if}

	<section class="intent-grid">
		<article class="intent-card">
			<p class="eyebrow">Purpose</p>
			<p>{framework.purpose_text}</p>
		</article>
		<article class="intent-card">
			<p class="eyebrow">Vision</p>
			<p>{framework.vision_text}</p>
		</article>
		<article class="intent-card">
			<p class="eyebrow">Mission</p>
			<p>{framework.mission_text}</p>
		</article>
	</section>

	{#if framework.lifecycle_status === 'draft' && data.canManage}
		<details class="panel edit-panel">
			<summary>Edit strategic intent</summary>
			<form method="POST" action="?/updateFramework" class="form-grid">
				<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
				<label>Title <input name="title" value={framework.title} required /></label>
				<label>
					Accountable owner
					<select name="ownerMemberId">
						<option value="">Unassigned</option>
						{#each data.members as member}
							<option value={member.id} selected={framework.owner_member_id === member.id}>{member.display_name}</option>
						{/each}
					</select>
				</label>
				<label>Horizon start <input type="date" name="horizonStart" value={dateValue(framework.horizon_start)} required /></label>
				<label>Horizon end <input type="date" name="horizonEnd" value={dateValue(framework.horizon_end)} required /></label>
				<label class="wide">Purpose <textarea name="purposeText" rows="3" required>{framework.purpose_text}</textarea></label>
				<label class="wide">Vision <textarea name="visionText" rows="3" required>{framework.vision_text}</textarea></label>
				<label class="wide">Mission <textarea name="missionText" rows="3" required>{framework.mission_text}</textarea></label>
				<div class="form-actions"><button type="submit">Save draft intent</button></div>
			</form>
		</details>
	{/if}

	<div class="workspace-grid">
		<section class="panel">
			<div class="section-heading">
				<div>
					<p class="eyebrow">F01.02</p>
					<h2>Environmental analysis</h2>
				</div>
				<span>{data.environmentFactors.length} factors</span>
			</div>
			<div class="record-list">
				{#each data.environmentFactors as factor}
					<article>
						<div class="record-meta">
							<span>{factor.context_scope}</span><span>{factor.dimension}</span><span>{factor.direction}</span>
						</div>
						<h3>{factor.title}</h3>
						<p>{factor.analysis_text}</p>
						{#if factor.evidence_reference}<small>Evidence: {factor.evidence_reference}</small>{/if}
						{#if factor.likelihood_score || factor.impact_score}
							<small>Likelihood {factor.likelihood_score ?? '—'} / 5 · impact {factor.impact_score ?? '—'} / 5</small>
						{/if}
					</article>
				{/each}
				{#if !data.environmentFactors.length}<p class="muted">No environmental evidence captured yet.</p>{/if}
			</div>

			{#if framework.lifecycle_status === 'draft' && data.canManage}
				<details class="add-record">
					<summary>Add environmental factor</summary>
					<form method="POST" action="?/addEnvironmentFactor" class="stack-form">
						<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
						<div class="form-grid compact">
							<label>Scope <select name="contextScope"><option value="external">External</option><option value="internal">Internal</option></select></label>
							<label>Dimension <select name="dimension"><option value="economic">Economic</option><option value="competitive">Competitive</option><option value="market">Market</option><option value="technology">Technology</option><option value="regulatory">Regulatory</option><option value="operational">Operational</option><option value="other">Other</option></select></label>
							<label>Direction <select name="direction"><option value="opportunity">Opportunity</option><option value="threat">Threat</option><option value="strength">Strength</option><option value="weakness">Weakness</option><option value="neutral">Neutral</option></select></label>
							<label>Observed on <input type="date" name="observedOn" /></label>
						</div>
						<label>Title <input name="title" required /></label>
						<label>Analysis <textarea name="analysisText" rows="4" required></textarea></label>
						<label>Evidence/source reference <textarea name="evidenceReference" rows="2"></textarea></label>
						<div class="form-grid compact">
							<label>Likelihood (1–5) <input type="number" min="1" max="5" name="likelihoodScore" /></label>
							<label>Impact (1–5) <input type="number" min="1" max="5" name="impactScore" /></label>
							<label>Owner <select name="ownerMemberId"><option value="">Unassigned</option>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
						</div>
						<button type="submit">Add factor</button>
					</form>
				</details>
			{/if}
		</section>

		<section class="panel">
			<div class="section-heading">
				<div>
					<p class="eyebrow">F01.03</p>
					<h2>Strategic options</h2>
				</div>
				<span>{data.options.filter((option) => option.decision_status === 'selected').length} selected</span>
			</div>
			<div class="record-list">
				{#each data.options as option}
					<article>
						<div class="record-meta"><span>{label(option.decision_status)}</span>{#if option.priority_rank}<span>priority {option.priority_rank}</span>{/if}</div>
						<h3>{option.title}</h3>
						<p>{option.description}</p>
						{#if option.evaluation_summary}<small>{option.evaluation_summary}</small>{/if}
						{#if option.decision_rationale}<small>Decision: {option.decision_rationale}</small>{/if}
						{#if framework.lifecycle_status === 'draft' && data.canApprove}
							<form method="POST" action="?/decideOption" class="decision-form">
								<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
								<input type="hidden" name="optionPublicId" value={option.public_id} />
								<select name="decisionStatus"><option value="selected">Select</option><option value="rejected">Reject</option></select>
								<input name="decisionRationale" placeholder="Decision rationale" required />
								<button type="submit" class="secondary">Record decision</button>
							</form>
						{/if}
					</article>
				{/each}
				{#if !data.options.length}<p class="muted">No strategic options captured yet.</p>{/if}
			</div>

			{#if framework.lifecycle_status === 'draft' && data.canManage}
				<details class="add-record">
					<summary>Add strategic option</summary>
					<form method="POST" action="?/addOption" class="stack-form">
						<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
						<label>Option title <input name="title" required /></label>
						<label>Description <textarea name="description" rows="4" required></textarea></label>
						<label>Evaluation summary <textarea name="evaluationSummary" rows="3"></textarea></label>
						<label>Priority rank <input type="number" min="1" name="priorityRank" /></label>
						<button type="submit">Add option</button>
					</form>
				</details>
			{/if}
		</section>
	</div>

	<section class="panel">
		<div class="section-heading">
			<div>
				<p class="eyebrow">F01.03</p>
				<h2>Strategic objectives and priorities</h2>
			</div>
			<span>{data.objectives.length} objectives</span>
		</div>
		<div class="objective-grid">
			{#each data.objectives as objective}
				<article>
					<div class="objective-rank">{objective.priority_rank}</div>
					<div>
						<div class="record-meta"><span>{objective.objective_code}</span><span>{label(objective.lifecycle_status)}</span></div>
						<h3>{objective.title}</h3>
						<p>{objective.description}</p>
						{#if objective.target_date}<small>Target {dateValue(objective.target_date)}</small>{/if}
					</div>
				</article>
			{/each}
			{#if !data.objectives.length}<p class="muted">No strategic objectives captured yet.</p>{/if}
		</div>

		{#if framework.lifecycle_status === 'draft' && data.canManage}
			<details class="add-record">
				<summary>Add strategic objective</summary>
				<form method="POST" action="?/addObjective" class="form-grid">
					<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
					<label>Objective code <input name="objectiveCode" placeholder="OBJ-01" required /></label>
					<label>Priority rank <input type="number" min="1" name="priorityRank" required /></label>
					<label class="wide">Title <input name="title" required /></label>
					<label class="wide">Description <textarea name="description" rows="4" required></textarea></label>
					<label>Target date <input type="date" name="targetDate" /></label>
					<label>Owner <select name="ownerMemberId"><option value="">Unassigned</option>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
					<div class="form-actions"><button type="submit">Add objective</button></div>
				</form>
			</details>
		{/if}
	</section>

	{#if framework.lifecycle_status === 'draft' && data.canApprove}
		<section class="approval-panel">
			<div>
				<p class="eyebrow">Controlled publication</p>
				<h2>Approve strategy version</h2>
				<p>
					Approval requires environmental evidence, at least one strategic objective, all options to be
					decided and at least one option selected. Any previously approved version is then superseded.
				</p>
			</div>
			<form method="POST" action="?/approveFramework">
				<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
				<button type="submit">Approve version {framework.version_number}</button>
			</form>
		</section>
	{/if}
{/if}

<style>
	.breadcrumbs { display: flex; gap: .5rem; align-items: center; margin-bottom: 1rem; font-size: .9rem; color: var(--text-muted, #64748b); }
	.breadcrumbs a { color: inherit; }
	.page-heading { display: flex; justify-content: space-between; gap: 2rem; align-items: flex-start; margin-bottom: 1.5rem; }
	.page-heading h1 { margin: .2rem 0 .5rem; font-size: clamp(1.9rem, 3vw, 2.7rem); }
	.page-heading p { max-width: 78ch; margin: 0; color: var(--text-muted, #64748b); line-height: 1.55; }
	.eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .08em; font-size: .72rem; font-weight: 700; color: var(--text-muted, #64748b); }
	.heading-actions, .version-links, .record-meta { display: flex; gap: .5rem; flex-wrap: wrap; }
	.status-badge, .record-meta span { border: 1px solid var(--border, #dbe2ea); border-radius: 999px; padding: .3rem .55rem; font-size: .75rem; background: var(--surface, #fff); }
	.panel, .empty-state, .approval-panel { border: 1px solid var(--border, #dbe2ea); background: var(--surface, #fff); border-radius: 14px; padding: 1.25rem; margin-bottom: 1rem; }
	.version-strip { display: flex; gap: 1rem; align-items: center; justify-content: space-between; }
	.version-links a { border: 1px solid var(--border, #dbe2ea); padding: .55rem .7rem; border-radius: 10px; text-decoration: none; display: grid; gap: .15rem; color: inherit; }
	.version-links a.active { border-color: currentColor; }
	.version-links small { color: var(--text-muted, #64748b); }
	.notice { border-radius: 12px; padding: .9rem 1rem; margin-bottom: 1rem; }
	.notice.error { background: #fef2f2; border: 1px solid #fecaca; }
	.notice.success { background: #f0fdf4; border: 1px solid #bbf7d0; display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
	.notice.success div { display: grid; gap: .25rem; }
	.notice.success span { color: var(--text-muted, #64748b); }
	.strategy-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .75rem; margin-bottom: 1rem; }
	.strategy-summary div { border: 1px solid var(--border, #dbe2ea); border-radius: 12px; padding: .9rem; background: var(--surface, #fff); display: grid; gap: .25rem; }
	.strategy-summary span { color: var(--text-muted, #64748b); font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; }
	.strategy-summary strong { font-size: .95rem; }
	.approved { color: #166534; }
	.intent-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1rem; }
	.intent-card { padding: 1.2rem; border-radius: 14px; background: #0f172a; color: white; min-height: 140px; }
	.intent-card .eyebrow { color: #cbd5e1; }
	.intent-card p:last-child { font-size: 1.02rem; line-height: 1.55; }
	.workspace-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
	.section-heading { display: flex; justify-content: space-between; align-items: start; gap: 1rem; margin-bottom: 1rem; }
	.section-heading h2, .approval-panel h2, .panel h2 { margin: .2rem 0 0; }
	.section-heading > span { color: var(--text-muted, #64748b); font-size: .85rem; }
	.record-list { display: grid; gap: .75rem; }
	.record-list article, .objective-grid article { border: 1px solid var(--border, #dbe2ea); border-radius: 12px; padding: .9rem; }
	.record-list h3, .objective-grid h3 { margin: .45rem 0; }
	.record-list p, .objective-grid p { margin: .25rem 0; line-height: 1.5; }
	.record-list small, .objective-grid small { display: block; margin-top: .45rem; color: var(--text-muted, #64748b); }
	.objective-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
	.objective-grid article { display: flex; gap: .9rem; }
	.objective-rank { width: 2rem; height: 2rem; flex: 0 0 auto; border-radius: 999px; display: grid; place-items: center; background: #0f172a; color: white; font-weight: 700; }
	.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .85rem; margin-top: 1rem; }
	.form-grid.compact { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	.form-grid .wide, .form-actions { grid-column: 1 / -1; }
	.stack-form { display: grid; gap: .75rem; margin-top: .8rem; }
	label { display: grid; gap: .35rem; font-size: .84rem; font-weight: 600; }
	input, textarea, select { width: 100%; box-sizing: border-box; border: 1px solid var(--border, #cbd5e1); border-radius: 9px; padding: .65rem .7rem; background: var(--surface, #fff); color: inherit; font: inherit; }
	textarea { resize: vertical; }
	button { border: 0; border-radius: 9px; padding: .68rem .9rem; background: #0f172a; color: white; font-weight: 700; cursor: pointer; }
	button.secondary { background: transparent; color: inherit; border: 1px solid var(--border, #cbd5e1); }
	.add-record, .edit-panel { margin-top: 1rem; }
	summary { cursor: pointer; font-weight: 700; }
	.decision-form { display: grid; grid-template-columns: 120px 1fr auto; gap: .5rem; margin-top: .75rem; }
	.approval-panel { display: flex; justify-content: space-between; gap: 2rem; align-items: center; border-width: 2px; }
	.approval-panel p { max-width: 72ch; color: var(--text-muted, #64748b); }
	.muted { color: var(--text-muted, #64748b); }
	@media (max-width: 900px) {
		.page-heading, .version-strip, .approval-panel { flex-direction: column; }
		.strategy-summary, .intent-grid, .workspace-grid, .objective-grid, .form-grid, .form-grid.compact { grid-template-columns: 1fr; }
		.decision-form { grid-template-columns: 1fr; }
	}
</style>
