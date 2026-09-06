<script lang="ts">
	let { data, form } = $props();

	function dateValue(value: Date | string | null | undefined) {
		if (!value) return '';
		return new Date(value).toISOString().slice(0, 10);
	}

	function label(value: string) {
		return value.replaceAll('_', ' ');
	}

	function money(value: string | number, currencyCode: string) {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: currencyCode,
			maximumFractionDigits: 0
		}).format(Number(value));
	}

	function objectiveFor(id: string) {
		return data.objectives.find((objective) => objective.id === id);
	}

	function projectFor(id: string | null) {
		return id ? data.executionProjects.find((project) => project.id === id) : undefined;
	}

	function budgetFor(id: string | null) {
		return id ? data.executionBudgets.find((budget) => budget.id === id) : undefined;
	}

	function initiativeFor(id: string) {
		return data.initiatives.find((initiative) => initiative.id === id);
	}

	function componentFor(id: string) {
		return data.operatingModelComponents.find((component) => component.id === id);
	}

	function memberFor(id: string | null) {
		return id ? data.members.find((member) => member.id === id) : undefined;
	}
</script>

<svelte:head><title>Business planning & operating model · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/more">More</a><span>/</span><a href="/strategy">Strategy</a><span>/</span><span>Business planning</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">F01.04 + F01.05 · Strategy & Enterprise Planning</p>
		<h1>Business planning & operating model</h1>
		<p>
			Turn approved strategy into governed business plans, funded initiatives and a target operating
			model. Preserve the thread from strategic objective to accountable execution without copying
			project budgets, organisational access roles or downstream actuals.
		</p>
	</div>
	<div class="heading-actions">
		<span class="status-badge">VS3 Strategy-to-performance</span>
		<span class="status-badge">D8 + D1 + D19</span>
	</div>
</section>

{#if form?.error}
	<section class="notice error" role="alert">{form.error}</section>
{/if}

<section class="principle-strip">
	<div><strong>Intent</strong><span>Approved strategy and objectives</span></div>
	<div class="arrow">→</div>
	<div><strong>Plan</strong><span>Envelope, initiatives and milestones</span></div>
	<div class="arrow">→</div>
	<div><strong>Operating model</strong><span>Target capabilities and accountability</span></div>
	<div class="arrow">→</div>
	<div><strong>Execution</strong><span>Canonical project and approved budget</span></div>
</section>

{#if data.plans.length}
	<section class="panel version-strip">
		<div>
			<p class="eyebrow">Business-plan history</p>
			<strong>Controlled versions</strong>
		</div>
		<div class="version-links">
			{#each data.plans as plan}
				<a class:active={data.selectedPlan?.public_id === plan.public_id} href={`/strategy/planning?plan=${plan.public_id}`}>
					<span>{plan.plan_code} · v{plan.version_number}</span>
					<small>{label(plan.lifecycle_status)}</small>
				</a>
			{/each}
		</div>
	</section>
{/if}

{#if !data.selectedPlan}
	<section class="empty-state">
		<p class="eyebrow">F01.04 · Business planning</p>
		<h2>Create the first strategy-linked business plan</h2>
		<p>
			A plan can only originate from approved strategic evidence. Its financial envelope is planning
			intent; execution and actuals remain owned by their canonical project and finance domains.
		</p>
	</section>

	{#if data.canManage && data.approvedFrameworks.length}
		<section class="panel">
			<h2>New business plan</h2>
			<form method="POST" action="?/createPlan" class="form-grid">
				<label>
					Approved strategy
					<select name="frameworkPublicId" required>
						{#each data.approvedFrameworks as framework}
							<option value={framework.public_id}>{framework.framework_code} · v{framework.version_number} — {framework.title}</option>
						{/each}
					</select>
				</label>
				<label>Plan code <input name="planCode" placeholder="BP-2027" required /></label>
				<label>Title <input name="title" placeholder="2027 Enterprise Business Plan" required /></label>
				<label>
					Accountable owner
					<select name="ownerMemberId">
						<option value="">Unassigned</option>
						{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}
					</select>
				</label>
				<label>Period start <input type="date" name="periodStart" required /></label>
				<label>Period end <input type="date" name="periodEnd" required /></label>
				<label>Currency <input name="currencyCode" value="GBP" maxlength="3" required /></label>
				<label>Planned revenue <input type="number" min="0" step="0.01" name="plannedRevenueAmount" value="0" /></label>
				<label>Planned operating expenditure <input type="number" min="0" step="0.01" name="plannedOpexAmount" value="0" /></label>
				<label>Planned capital expenditure <input type="number" min="0" step="0.01" name="plannedCapexAmount" value="0" /></label>
				<label class="wide">Plan narrative <textarea name="narrative" rows="4" required></textarea></label>
				<div class="form-actions"><button type="submit">Create business-plan draft</button></div>
			</form>
		</section>
	{:else if !data.approvedFrameworks.length}
		<section class="notice warning">
			<strong>Approved strategy required.</strong>
			<span>Complete and approve a strategic framework before creating a business plan.</span>
			<a href="/strategy">Open strategy workspace</a>
		</section>
	{/if}
{:else}
	{@const plan = data.selectedPlan}

	<section class="plan-summary">
		<div><span>Business plan</span><strong>{plan.plan_code} · version {plan.version_number}</strong></div>
		<div><span>Status</span><strong class:approved={plan.lifecycle_status === 'approved'}>{label(plan.lifecycle_status)}</strong></div>
		<div><span>Period</span><strong>{dateValue(plan.period_start)} → {dateValue(plan.period_end)}</strong></div>
		<div><span>Strategy source</span><strong>{data.selectedFramework?.framework_code ?? '—'} · v{data.selectedFramework?.version_number ?? '—'}</strong></div>
	</section>

	<section class="financial-grid">
		<article><span>Revenue plan</span><strong>{money(plan.planned_revenue_amount, plan.currency_code)}</strong></article>
		<article><span>Operating expenditure</span><strong>{money(plan.planned_opex_amount, plan.currency_code)}</strong></article>
		<article><span>Capital expenditure</span><strong>{money(plan.planned_capex_amount, plan.currency_code)}</strong></article>
		<article><span>Strategic initiatives</span><strong>{data.initiatives.length}</strong></article>
		<article><span>Target-model components</span><strong>{data.operatingModelComponents.length}</strong></article>
		<article><span>Execution links</span><strong>{data.initiatives.filter((initiative) => initiative.project_id).length}</strong></article>
	</section>

	<section class="panel trace-panel">
		<p class="eyebrow">Governed digital thread</p>
		<h2>{plan.title}</h2>
		<p>{plan.narrative}</p>
		<div class="trace-line">
			<span>Strategy v{data.selectedFramework?.version_number ?? '—'}</span><b>→</b><span>{data.objectives.length} objectives</span><b>→</b><span>{data.initiatives.length} initiatives</span><b>→</b><span>{data.operatingModelComponents.length} target components</span><b>→</b><span>canonical execution</span>
		</div>
	</section>

	{#if plan.lifecycle_status === 'approved'}
		<section class="notice success">
			<div>
				<strong>Approved business-plan evidence</strong>
				<span>This version, its initiative commitments and target operating model are immutable. Changes proceed through a controlled revision.</span>
			</div>
			{#if data.canManage}
				<form method="POST" action="?/revisePlan">
					<input type="hidden" name="planPublicId" value={plan.public_id} />
					<button type="submit" class="secondary">Create plan revision</button>
				</form>
			{/if}
		</section>
	{/if}

	<div class="workspace-grid">
		<section class="panel" id="initiatives">
			<div class="section-heading">
				<div><p class="eyebrow">F01.04</p><h2>Strategic initiatives</h2></div>
				<span>{data.initiatives.length} initiatives</span>
			</div>

			<div class="record-list">
				{#each data.initiatives as initiative}
					{@const objective = objectiveFor(initiative.strategy_objective_id)}
					{@const project = projectFor(initiative.project_id)}
					{@const budget = budgetFor(initiative.project_budget_id)}
					<article class="initiative-card">
						<div class="record-meta"><span>{initiative.initiative_code}</span><span>{label(initiative.lifecycle_status)}</span><span>priority {initiative.priority_rank}</span></div>
						<h3>{initiative.title}</h3>
						<p>{initiative.outcome_text}</p>
						<div class="source-thread"><strong>Objective</strong><span>{objective?.objective_code ?? '—'} · {objective?.title ?? 'Unknown objective'}</span></div>
						<div class="metric-row">
							<span><b>{money(initiative.planned_investment_amount, initiative.currency_code)}</b> planned investment</span>
							<span><b>{Number(initiative.planned_fte).toFixed(2)}</b> planned FTE</span>
							<span><b>{dateValue(initiative.end_date)}</b> target finish</span>
						</div>
						{#if project}
							<div class="execution-link"><strong>Execution</strong><span>{project.projectNumber} · {project.name}</span>{#if budget}<span>{budget.budgetNumber} · approved v{budget.approvedVersion}</span>{/if}</div>
						{/if}
						{#if initiative.benefit_statement}<small>Benefit: {initiative.benefit_statement}</small>{/if}
						{#if initiative.risk_summary}<small>Risk: {initiative.risk_summary}</small>{/if}
						<div class="milestones">
							{#each data.milestones.filter((milestone) => milestone.strategy_initiative_id === initiative.id) as milestone}
								<span>{milestone.milestone_code} · {milestone.title} · {dateValue(milestone.target_date)}</span>
							{/each}
						</div>
					</article>
				{/each}
				{#if !data.initiatives.length}<p class="muted">No initiatives defined yet.</p>{/if}
			</div>

			{#if plan.lifecycle_status === 'draft' && data.canManage}
				<details class="add-record">
					<summary>Add strategic initiative</summary>
					<form method="POST" action="?/addInitiative" class="stack-form">
						<input type="hidden" name="planPublicId" value={plan.public_id} />
						<div class="form-grid compact">
							<label>Strategic objective <select name="objectivePublicId" required>{#each data.objectives.filter((objective) => objective.lifecycle_status === 'active') as objective}<option value={objective.public_id}>{objective.objective_code} · {objective.title}</option>{/each}</select></label>
							<label>Initiative code <input name="initiativeCode" placeholder="INIT-01" required /></label>
							<label>Priority rank <input type="number" min="1" name="priorityRank" value="1" required /></label>
							<label>Currency <input name="currencyCode" value={plan.currency_code} maxlength="3" required /></label>
						</div>
						<label>Initiative title <input name="title" required /></label>
						<label>Target outcome <textarea name="outcomeText" rows="3" required></textarea></label>
						<label>Benefit statement <textarea name="benefitStatement" rows="2"></textarea></label>
						<div class="form-grid compact">
							<label>Start date <input type="date" name="startDate" required /></label>
							<label>End date <input type="date" name="endDate" required /></label>
							<label>Planned investment <input type="number" min="0" step="0.01" name="plannedInvestmentAmount" value="0" /></label>
							<label>Planned FTE <input type="number" min="0" step="0.01" name="plannedFte" value="0" /></label>
						</div>
						<div class="form-grid compact">
							<label>Accountable owner <select name="ownerMemberId"><option value="">Unassigned</option>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
							<label>Executive sponsor <select name="sponsorMemberId"><option value="">Unassigned</option>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
						</div>
						<label>Resource assumptions <textarea name="resourceAssumptions" rows="2"></textarea></label>
						<label>Risk summary <textarea name="riskSummary" rows="2"></textarea></label>
						<div class="execution-selector">
							<p class="eyebrow">Optional canonical execution link</p>
							<div class="form-grid compact">
								<label>Execution project <select name="projectPublicId"><option value="">No project link</option>{#each data.executionProjects as project}<option value={project.publicId}>{project.projectNumber} · {project.name}</option>{/each}</select></label>
								<label>Approved project budget <select name="projectBudgetPublicId"><option value="">No budget link</option>{#each data.executionBudgets as budget}<option value={budget.publicId}>{budget.budgetNumber} · {budget.name} · v{budget.approvedVersion}</option>{/each}</select></label>
							</div>
							<small>NuBlox validates that any budget belongs to the selected project and has an approved canonical version.</small>
						</div>
						<button type="submit">Add initiative</button>
					</form>
				</details>

				{#if data.initiatives.length}
					<details class="add-record">
						<summary>Add initiative milestone</summary>
						<form method="POST" action="?/addMilestone" class="form-grid compact">
							<input type="hidden" name="planPublicId" value={plan.public_id} />
							<label>Initiative <select name="initiativePublicId" required>{#each data.initiatives as initiative}<option value={initiative.public_id}>{initiative.initiative_code} · {initiative.title}</option>{/each}</select></label>
							<label>Milestone code <input name="milestoneCode" placeholder="MS-01" required /></label>
							<label>Title <input name="title" required /></label>
							<label>Target date <input type="date" name="targetDate" required /></label>
							<label>Owner <select name="ownerMemberId"><option value="">Unassigned</option>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
							<div class="form-actions"><button type="submit">Add milestone</button></div>
						</form>
					</details>
				{/if}

				{#if data.initiatives.length > 1}
					<details class="add-record">
						<summary>Add initiative dependency</summary>
						<form method="POST" action="?/addDependency" class="form-grid compact">
							<input type="hidden" name="planPublicId" value={plan.public_id} />
							<label>Initiative <select name="initiativePublicId" required>{#each data.initiatives as initiative}<option value={initiative.public_id}>{initiative.initiative_code}</option>{/each}</select></label>
							<label>Depends on <select name="dependsOnInitiativePublicId" required>{#each data.initiatives as initiative}<option value={initiative.public_id}>{initiative.initiative_code}</option>{/each}</select></label>
							<label>Dependency type <select name="dependencyType"><option value="finish_to_start">Finish to start</option><option value="governance">Governance</option><option value="resource">Resource</option><option value="external">External</option></select></label>
							<div class="form-actions"><button type="submit">Add dependency</button></div>
						</form>
					</details>
				{/if}
			{/if}
		</section>

		<section class="panel" id="operating-model">
			<div class="section-heading">
				<div><p class="eyebrow">F01.05</p><h2>Target operating model</h2></div>
				<span>{data.operatingModelComponents.length} components</span>
			</div>

			<div class="record-list">
				{#each data.operatingModelComponents as component}
					<article class="component-card">
						<div class="record-meta"><span>{component.component_code}</span><span>{label(component.component_type)}</span><span>{label(component.lifecycle_status)}</span></div>
						<h3>{component.title}</h3>
						{#if component.current_state_text}<small>Current: {component.current_state_text}</small>{/if}
						<p><strong>Target:</strong> {component.target_state_text}</p>
						<div class="accountability-list">
							{#each data.accountabilities.filter((item) => item.operating_model_component_id === component.id) as accountability}
								<div><span>{label(accountability.accountability_type)}</span><strong>{accountability.position_label}</strong>{#if accountability.member_id}<small>{memberFor(accountability.member_id)?.display_name ?? 'Named member'}</small>{/if}</div>
							{/each}
						</div>
						<div class="change-links">
							{#each data.initiativeComponentLinks.filter((link) => link.operating_model_component_id === component.id) as link}
								<span>{initiativeFor(link.initiative_id)?.initiative_code ?? 'Initiative'} → {label(link.change_role)}</span>
							{/each}
						</div>
					</article>
				{/each}
				{#if !data.operatingModelComponents.length}<p class="muted">No target operating-model components defined yet.</p>{/if}
			</div>

			{#if plan.lifecycle_status === 'draft' && data.canManage}
				<details class="add-record">
					<summary>Add operating-model component</summary>
					<form method="POST" action="?/addComponent" class="stack-form">
						<input type="hidden" name="planPublicId" value={plan.public_id} />
						<div class="form-grid compact">
							<label>Component code <input name="componentCode" placeholder="CAP-01" required /></label>
							<label>Component type <select name="componentType"><option value="business_capability">Business capability</option><option value="value_stream">Value stream</option><option value="organisation_design">Organisation design</option><option value="process">Process</option><option value="governance">Governance</option><option value="information">Information</option><option value="technology">Technology</option><option value="partner_ecosystem">Partner ecosystem</option><option value="location">Location</option></select></label>
							<label>Parent component <select name="parentComponentPublicId"><option value="">No parent</option>{#each data.operatingModelComponents as component}<option value={component.public_id}>{component.component_code} · {component.title}</option>{/each}</select></label>
						</div>
						<label>Component title <input name="title" required /></label>
						<label>Current state <textarea name="currentStateText" rows="2"></textarea></label>
						<label>Target state <textarea name="targetStateText" rows="3" required></textarea></label>
						<button type="submit">Add target component</button>
					</form>
				</details>

				{#if data.operatingModelComponents.length}
					<details class="add-record">
						<summary>Add business accountability</summary>
						<form method="POST" action="?/addAccountability" class="stack-form">
							<input type="hidden" name="planPublicId" value={plan.public_id} />
							<div class="form-grid compact">
								<label>Component <select name="componentPublicId" required>{#each data.operatingModelComponents as component}<option value={component.public_id}>{component.component_code} · {component.title}</option>{/each}</select></label>
								<label>Accountability <select name="accountabilityType"><option value="accountable">Accountable</option><option value="responsible">Responsible</option><option value="consulted">Consulted</option><option value="informed">Informed</option><option value="assured">Assured</option></select></label>
								<label>Business position label <input name="positionLabel" placeholder="Chief Operating Officer" required /></label>
								<label>Named member (optional) <select name="memberId"><option value="">Position only</option>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
							</div>
							<label>Notes <textarea name="notes" rows="2"></textarea></label>
							<small>Business accountability is deliberately separate from NuBlox access roles and permissions.</small>
							<button type="submit">Add accountability</button>
						</form>
					</details>
				{/if}

				{#if data.operatingModelComponents.length && data.initiatives.length}
					<details class="add-record">
						<summary>Link initiative to operating model</summary>
						<form method="POST" action="?/linkInitiativeComponent" class="form-grid compact">
							<input type="hidden" name="planPublicId" value={plan.public_id} />
							<label>Initiative <select name="initiativePublicId" required>{#each data.initiatives as initiative}<option value={initiative.public_id}>{initiative.initiative_code} · {initiative.title}</option>{/each}</select></label>
							<label>Target component <select name="componentPublicId" required>{#each data.operatingModelComponents as component}<option value={component.public_id}>{component.component_code} · {component.title}</option>{/each}</select></label>
							<label>Change role <select name="changeRole"><option value="transform">Transform</option><option value="create">Create</option><option value="enable">Enable</option><option value="consume">Consume</option><option value="retire">Retire</option></select></label>
							<div class="form-actions"><button type="submit">Link change</button></div>
						</form>
					</details>
				{/if}
			{/if}
		</section>
	</div>

	{#if data.dependencies.length}
		<section class="panel">
			<p class="eyebrow">Delivery network</p>
			<h2>Initiative dependencies</h2>
			<div class="dependency-list">
				{#each data.dependencies as dependency}
					<span>{initiativeFor(dependency.initiative_id)?.initiative_code ?? '—'} depends on {initiativeFor(dependency.depends_on_initiative_id)?.initiative_code ?? '—'} · {label(dependency.dependency_type)}</span>
				{/each}
			</div>
		</section>
	{/if}

	{#if plan.lifecycle_status === 'draft' && data.canApprove}
		<section class="approval-panel">
			<div>
				<p class="eyebrow">Controlled approval</p>
				<h2>Approve business plan version {plan.version_number}</h2>
				<p>Approval requires initiatives, accountable target-model components, an initiative-to-model change link for every initiative, an acyclic dependency network and valid canonical project/budget references.</p>
			</div>
			<form method="POST" action="?/approvePlan">
				<input type="hidden" name="planPublicId" value={plan.public_id} />
				<button type="submit">Approve plan version {plan.version_number}</button>
			</form>
		</section>
	{/if}
{/if}

<style>
	:global(body) { background: #f6f7f9; }
	.breadcrumbs { display: flex; gap: .5rem; align-items: center; margin-bottom: 1rem; font-size: .84rem; color: #64748b; }
	.breadcrumbs a { color: inherit; text-decoration: none; }
	.page-heading { display: flex; justify-content: space-between; gap: 2rem; align-items: flex-start; margin-bottom: 1.25rem; }
	.page-heading h1 { margin: .15rem 0 .45rem; font-size: clamp(1.8rem, 3vw, 2.65rem); letter-spacing: -.035em; }
	.page-heading p { max-width: 76ch; margin: 0; color: #475569; line-height: 1.6; }
	.eyebrow { margin: 0; font-size: .72rem; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; color: #64748b; }
	.heading-actions { display: flex; gap: .5rem; flex-wrap: wrap; justify-content: flex-end; }
	.status-badge { border: 1px solid #d7dde5; background: white; border-radius: 999px; padding: .45rem .7rem; font-size: .74rem; white-space: nowrap; }
	.principle-strip { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr; gap: .75rem; align-items: center; padding: 1rem 1.15rem; margin-bottom: 1rem; background: #101827; color: white; border-radius: 14px; }
	.principle-strip div:not(.arrow) { display: flex; flex-direction: column; gap: .15rem; }
	.principle-strip span { font-size: .75rem; color: #b9c5d7; }
	.arrow { color: #6f8199; }
	.panel, .empty-state, .approval-panel, .notice { background: white; border: 1px solid #e2e7ed; border-radius: 14px; padding: 1.1rem; margin-bottom: 1rem; }
	.notice { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
	.notice > div { display: flex; flex-direction: column; gap: .25rem; }
	.notice.error { border-color: #fecaca; background: #fff7f7; color: #991b1b; }
	.notice.success { border-color: #bbf7d0; background: #f4fff7; }
	.notice.warning { border-color: #fde68a; background: #fffdf3; }
	.notice a { color: inherit; font-weight: 700; }
	.empty-state { text-align: center; padding: 2rem; }
	.empty-state h2 { margin: .35rem 0; }
	.version-strip { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
	.version-links { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: flex-end; }
	.version-links a { display: flex; flex-direction: column; padding: .55rem .7rem; border: 1px solid #dde3ea; border-radius: 10px; text-decoration: none; color: #172033; font-size: .78rem; }
	.version-links a.active { border-color: #172033; box-shadow: 0 0 0 1px #172033 inset; }
	.version-links small { color: #64748b; }
	.plan-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: .75rem; margin-bottom: .75rem; }
	.plan-summary > div, .financial-grid article { background: white; border: 1px solid #e2e7ed; border-radius: 12px; padding: .9rem; display: flex; flex-direction: column; gap: .25rem; }
	.plan-summary span, .financial-grid span { color: #64748b; font-size: .74rem; }
	.approved { color: #087443; }
	.financial-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: .75rem; margin-bottom: 1rem; }
	.financial-grid strong { font-size: 1.05rem; }
	.trace-panel h2 { margin: .25rem 0; }
	.trace-panel > p:not(.eyebrow) { color: #475569; }
	.trace-line { display: flex; gap: .55rem; flex-wrap: wrap; align-items: center; margin-top: .9rem; }
	.trace-line span { padding: .45rem .6rem; border: 1px solid #dce3eb; border-radius: 8px; background: #f8fafc; font-size: .76rem; }
	.trace-line b { color: #94a3b8; }
	.workspace-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 1rem; align-items: start; }
	.section-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; border-bottom: 1px solid #edf0f4; padding-bottom: .75rem; margin-bottom: .75rem; }
	.section-heading h2 { margin: .15rem 0 0; }
	.section-heading > span { font-size: .75rem; color: #64748b; }
	.record-list { display: grid; gap: .7rem; }
	.record-list article { border: 1px solid #e4e9ef; border-radius: 11px; padding: .9rem; }
	.record-list h3 { margin: .35rem 0; font-size: 1rem; }
	.record-list p { margin: .35rem 0; color: #475569; line-height: 1.5; }
	.record-list small { display: block; color: #64748b; margin-top: .3rem; }
	.record-meta { display: flex; gap: .4rem; flex-wrap: wrap; }
	.record-meta span { font-size: .67rem; text-transform: uppercase; letter-spacing: .06em; padding: .2rem .4rem; border-radius: 5px; background: #eef2f6; color: #536174; }
	.source-thread, .execution-link { display: flex; gap: .45rem; align-items: baseline; flex-wrap: wrap; border-left: 3px solid #dbe3ec; padding-left: .55rem; margin-top: .55rem; font-size: .77rem; }
	.source-thread span, .execution-link span { color: #475569; }
	.metric-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin-top: .7rem; }
	.metric-row span { background: #f7f9fb; padding: .45rem; border-radius: 7px; font-size: .68rem; color: #64748b; }
	.metric-row b { display: block; color: #1f2937; font-size: .8rem; }
	.milestones, .change-links { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .55rem; }
	.milestones span, .change-links span { font-size: .68rem; background: #f2f5f8; padding: .3rem .45rem; border-radius: 6px; }
	.accountability-list { display: grid; gap: .35rem; margin-top: .65rem; }
	.accountability-list div { display: grid; grid-template-columns: auto 1fr auto; gap: .45rem; align-items: center; padding: .4rem .5rem; border: 1px solid #edf0f4; border-radius: 7px; }
	.accountability-list span { font-size: .65rem; text-transform: uppercase; color: #64748b; }
	.accountability-list strong { font-size: .76rem; }
	.accountability-list small { margin: 0; }
	.add-record { border-top: 1px solid #edf0f4; margin-top: .9rem; padding-top: .75rem; }
	.add-record summary { cursor: pointer; font-weight: 700; font-size: .82rem; }
	.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; margin-top: .8rem; }
	.form-grid.compact { gap: .6rem; }
	.stack-form { display: grid; gap: .7rem; margin-top: .8rem; }
	label { display: flex; flex-direction: column; gap: .3rem; font-size: .74rem; color: #475569; font-weight: 600; }
	input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cfd7e1; border-radius: 8px; padding: .55rem .6rem; font: inherit; background: white; color: #111827; }
	textarea { resize: vertical; }
	.wide { grid-column: 1 / -1; }
	.form-actions { display: flex; align-items: end; }
	button { border: 0; border-radius: 8px; background: #172033; color: white; padding: .6rem .85rem; font-weight: 700; cursor: pointer; }
	button.secondary { background: white; color: #172033; border: 1px solid #cfd7e1; }
	.execution-selector { border: 1px solid #dce3eb; border-radius: 9px; padding: .7rem; background: #f8fafc; }
	.execution-selector small { color: #64748b; }
	.dependency-list { display: flex; flex-wrap: wrap; gap: .45rem; margin-top: .7rem; }
	.dependency-list span { border: 1px solid #dce3eb; border-radius: 7px; padding: .4rem .55rem; font-size: .73rem; }
	.approval-panel { display: flex; justify-content: space-between; gap: 2rem; align-items: center; background: #101827; color: white; }
	.approval-panel h2 { margin: .2rem 0; }
	.approval-panel p:not(.eyebrow) { color: #c3cedd; max-width: 72ch; }
	.approval-panel .eyebrow { color: #aebcd0; }
	.approval-panel button { background: white; color: #101827; white-space: nowrap; }
	.muted { color: #94a3b8 !important; }
	@media (max-width: 1100px) {
		.financial-grid { grid-template-columns: repeat(3, 1fr); }
		.workspace-grid { grid-template-columns: 1fr; }
	}
	@media (max-width: 760px) {
		.page-heading, .version-strip, .approval-panel, .notice { flex-direction: column; }
		.heading-actions, .version-links { justify-content: flex-start; }
		.principle-strip { grid-template-columns: 1fr; }
		.principle-strip .arrow { transform: rotate(90deg); width: fit-content; }
		.plan-summary, .financial-grid, .form-grid, .metric-row { grid-template-columns: 1fr; }
		.wide { grid-column: auto; }
	}
</style>
