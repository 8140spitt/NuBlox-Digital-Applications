<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Product &amp; Service Lifecycle | NuBlox</title></svelte:head>

<section class="workspace">
	<header class="hero">
		<p class="eyebrow">F05.05–F05.10 · Lifecycle control</p>
		<h1>Product &amp; Service lifecycle control</h1>
		<p>
			Govern approved design, development, launch, live lifecycle review, retirement and innovation
			learning as one attributable thread.
		</p>
		<a href="/product-service">Back to Product, Service &amp; Innovation command centre</a>
	</header>

	{#if form?.error}<div class="error" role="alert">{form.error}</div>{/if}

	<div class="metrics">
		<div><strong>{data.designs.length}</strong><span>Designs</span></div>
		<div><strong>{data.developmentPlans.length}</strong><span>Development plans</span></div>
		<div><strong>{data.launchPlans.length}</strong><span>Launch plans</span></div>
		<div><strong>{data.lifecycleReviews.length}</strong><span>Lifecycle reviews</span></div>
		<div><strong>{data.retirementPlans.length}</strong><span>Retirement plans</span></div>
		<div><strong>{data.innovationExperiments.length}</strong><span>Experiments</span></div>
	</div>

	<div class="grid two">
		<section class="panel">
			<h2>F05.05 · Product/service design</h2>
			{#each data.designs as design}
				<article class="card">
					<strong>{design.design_code} v{design.version_number} · {design.title}</strong>
					<p>{design.lifecycle_status}</p>
					<p>{design.design_brief}</p>
					{#if data.canApprove && design.lifecycle_status === 'draft'}
						<form method="POST" action="?/approveDesign">
							<input type="hidden" name="designPublicId" value={design.public_id} />
							<button type="submit">Approve reviewed design</button>
						</form>
					{/if}
				</article>
			{/each}
			{#if !data.designs.length}<p>No controlled designs yet.</p>{/if}
		</section>

		{#if data.canManage && data.offerings.length}
			<section class="panel">
				<h2>Create design</h2>
				<form method="POST" action="?/createDesign" class="form-grid">
					<label>Offering<select name="offeringPublicId" required>{#each data.offerings as offering}<option value={offering.public_id}>{offering.offering_code} · {offering.title}</option>{/each}</select></label>
					<label>Approved business case<select name="businessCasePublicId"><option value="">None</option>{#each data.businessCases.filter((item) => item.lifecycle_status === 'approved') as item}<option value={item.public_id}>{item.business_case_code} · {item.title}</option>{/each}</select></label>
					<label>Design code<input name="designCode" maxlength="50" required /></label>
					<label>Title<input name="title" required /></label>
					<label>Owner<select name="ownerMemberId" required>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
					<label>Evidence ID<input name="evidencePublicId" /></label>
					<label class="wide">Design brief<textarea name="designBrief" required></textarea></label>
					<label class="wide">Customer outcomes<textarea name="customerOutcomes" required></textarea></label>
					<label class="wide">Functional requirements<textarea name="functionalRequirements" required></textarea></label>
					<label class="wide">Non-functional requirements<textarea name="nonFunctionalRequirements"></textarea></label>
					<label class="wide">Acceptance criteria<textarea name="acceptanceCriteria" required></textarea></label>
					<label class="wide">Evidence reference<input name="evidenceReference" /></label>
					<button type="submit">Create design</button>
				</form>
			</section>
		{/if}
	</div>

	{#if data.canManage && data.designs.length}
		<section class="panel">
			<h3>Record design review</h3>
			<form method="POST" action="?/addDesignReview" class="form-grid">
				<label>Design<select name="designPublicId" required>{#each data.designs as design}<option value={design.public_id}>{design.design_code} · {design.title}</option>{/each}</select></label>
				<label>Review code<input name="reviewCode" maxlength="50" required /></label>
				<label>Review type<select name="reviewType"><option value="gate">Gate</option><option value="customer">Customer</option><option value="technical">Technical</option><option value="commercial">Commercial</option><option value="operational">Operational</option><option value="compliance">Compliance</option><option value="sustainability">Sustainability</option></select></label>
				<label>Outcome<select name="outcome"><option value="pass">Pass</option><option value="conditional">Conditional</option><option value="fail">Fail</option></select></label>
				<label>Review date<input name="reviewDate" type="date" required /></label>
				<label>Reviewer<select name="reviewerMemberId" required>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
				<label>Evidence ID<input name="evidencePublicId" /></label>
				<label class="wide">Findings<textarea name="findings" required></textarea></label>
				<label class="wide">Actions required<textarea name="actionsRequired"></textarea></label>
				<button type="submit">Record review</button>
			</form>
		</section>
	{/if}

	<div class="grid two">
		<section class="panel">
			<h2>F05.06 · Development</h2>
			{#each data.developmentPlans as plan}
				<article class="card">
					<strong>{plan.development_code} · {plan.title}</strong>
					<p>{plan.lifecycle_status}{plan.project_public_id ? ` · D5 ${plan.project_public_id}` : ''}</p>
					{#if data.canManage && plan.lifecycle_status !== 'completed'}
						<form method="POST" action="?/completeDevelopmentPlan"><input type="hidden" name="developmentPublicId" value={plan.public_id} /><button type="submit">Complete development</button></form>
					{/if}
				</article>
			{/each}
			{#if !data.developmentPlans.length}<p>No development plans yet.</p>{/if}
		</section>
		{#if data.canManage && data.designs.some((item) => item.lifecycle_status === 'approved')}
			<section class="panel">
				<h2>Create development plan</h2>
				<form method="POST" action="?/createDevelopmentPlan" class="form-grid">
					<label>Approved design<select name="designPublicId" required>{#each data.designs.filter((item) => item.lifecycle_status === 'approved') as design}<option value={design.public_id}>{design.design_code} · {design.title}</option>{/each}</select></label>
					<label>Code<input name="developmentCode" maxlength="50" required /></label>
					<label>Title<input name="title" required /></label>
					<label>Owner<select name="ownerMemberId" required>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
					<label>Planned start<input name="plannedStart" type="date" /></label>
					<label>Planned finish<input name="plannedFinish" type="date" /></label>
					<label>D5 project public ID<input name="projectPublicId" /></label>
					<label>Evidence ID<input name="evidencePublicId" /></label>
					<label class="wide">Delivery approach<textarea name="deliveryApproach" required></textarea></label>
					<label class="wide">Scope<textarea name="scopeText" required></textarea></label>
					<label class="wide">Definition of done<textarea name="definitionOfDone" required></textarea></label>
					<button type="submit">Create development plan</button>
				</form>
			</section>
		{/if}
	</div>

	<div class="grid two">
		<section class="panel">
			<h2>F05.07 · Launch management</h2>
			{#each data.launchPlans as plan}
				<article class="card">
					<strong>{plan.launch_code} · {plan.title}</strong>
					<p>{plan.lifecycle_status} · target {String(plan.target_launch_date).slice(0, 10)}</p>
					{#if data.canApprove && plan.lifecycle_status === 'planning'}<form method="POST" action="?/approveLaunch"><input type="hidden" name="launchPublicId" value={plan.public_id} /><button type="submit">Approve launch</button></form>{/if}
					{#if data.canManage && plan.lifecycle_status === 'approved'}<form method="POST" action="?/markLaunched"><input type="hidden" name="launchPublicId" value={plan.public_id} /><button type="submit">Mark launched</button></form>{/if}
				</article>
			{/each}
			{#if !data.launchPlans.length}<p>No launch plans yet.</p>{/if}
		</section>
		{#if data.canManage && data.offerings.length}
			<section class="panel">
				<h2>Create launch plan</h2>
				<form method="POST" action="?/createLaunchPlan" class="form-grid">
					<label>Offering<select name="offeringPublicId" required>{#each data.offerings as offering}<option value={offering.public_id}>{offering.offering_code} · {offering.title}</option>{/each}</select></label>
					<label>Completed development<select name="developmentPlanPublicId"><option value="">None</option>{#each data.developmentPlans.filter((item) => item.lifecycle_status === 'completed') as plan}<option value={plan.public_id}>{plan.development_code} · {plan.title}</option>{/each}</select></label>
					<label>Launch code<input name="launchCode" maxlength="50" required /></label>
					<label>Title<input name="title" required /></label>
					<label>Target launch date<input name="targetLaunchDate" type="date" required /></label>
					<label>Owner<select name="ownerMemberId" required>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
					<label>Readiness evidence ID<input name="readinessEvidencePublicId" /></label>
					<label>F02 governance decision ID<input name="governanceDecisionPublicId" /></label>
					<label class="wide">Target segments<textarea name="targetSegments" required></textarea></label>
					<label class="wide">Commercial readiness<textarea name="commercialReadiness" required></textarea></label>
					<label class="wide">Operational readiness<textarea name="operationalReadiness" required></textarea></label>
					<label class="wide">Customer readiness<textarea name="customerReadiness" required></textarea></label>
					<label class="wide">Support readiness<textarea name="supportReadiness" required></textarea></label>
					<button type="submit">Create launch plan</button>
				</form>
			</section>
		{/if}
	</div>

	<div class="grid two">
		<section class="panel">
			<h2>F05.08 · Lifecycle management</h2>
			{#each data.lifecycleReviews as review}<article class="card"><strong>{review.review_code} · {review.lifecycle_phase}</strong><p>{review.recommendation}</p><p>{review.performance_summary}</p></article>{/each}
			{#if !data.lifecycleReviews.length}<p>No lifecycle reviews yet.</p>{/if}
		</section>
		{#if data.canManage && data.offerings.length}
			<section class="panel">
				<h2>Record lifecycle review</h2>
				<form method="POST" action="?/recordLifecycleReview" class="form-grid">
					<label>Offering<select name="offeringPublicId" required>{#each data.offerings as offering}<option value={offering.public_id}>{offering.offering_code} · {offering.title}</option>{/each}</select></label>
					<label>Review code<input name="reviewCode" maxlength="50" required /></label>
					<label>Review date<input name="reviewDate" type="date" required /></label>
					<label>Phase<select name="lifecyclePhase"><option value="launch">Launch</option><option value="growth">Growth</option><option value="maturity">Maturity</option><option value="decline">Decline</option><option value="end_of_life">End of life</option></select></label>
					<label>Recommendation<select name="recommendation"><option value="continue">Continue</option><option value="improve">Improve</option><option value="reposition">Reposition</option><option value="invest">Invest</option><option value="retire">Retire</option></select></label>
					<label>Owner<select name="ownerMemberId" required>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
					<label>F03 evidence ID<input name="performanceEvidencePublicId" /></label>
					<label>Customer evidence ID<input name="customerEvidencePublicId" /></label>
					<label class="wide">Performance summary<textarea name="performanceSummary" required></textarea></label>
					<label class="wide">Customer summary<textarea name="customerSummary" required></textarea></label>
					<label class="wide">Financial summary<textarea name="financialSummary" required></textarea></label>
					<label class="wide">Risk summary<textarea name="riskSummary" required></textarea></label>
					<button type="submit">Record lifecycle review</button>
				</form>
			</section>
		{/if}
	</div>

	<div class="grid two">
		<section class="panel">
			<h2>F05.09 · Product retirement</h2>
			{#each data.retirementPlans as plan}
				<article class="card"><strong>{plan.retirement_code} · {plan.title}</strong><p>{plan.lifecycle_status}</p>{#if data.canApprove && plan.lifecycle_status === 'draft'}<form method="POST" action="?/approveRetirement"><input type="hidden" name="retirementPublicId" value={plan.public_id} /><button type="submit">Approve retirement</button></form>{/if}{#if data.canManage && plan.lifecycle_status === 'approved'}<form method="POST" action="?/completeRetirement"><input type="hidden" name="retirementPublicId" value={plan.public_id} /><button type="submit">Complete retirement</button></form>{/if}</article>
			{/each}
			{#if !data.retirementPlans.length}<p>No retirement plans yet.</p>{/if}
		</section>
		{#if data.canManage && data.offerings.length}
			<section class="panel">
				<h2>Create retirement plan</h2>
				<form method="POST" action="?/createRetirementPlan" class="form-grid">
					<label>Offering<select name="offeringPublicId" required>{#each data.offerings as offering}<option value={offering.public_id}>{offering.offering_code} · {offering.title}</option>{/each}</select></label>
					<label>Retirement review<select name="lifecycleReviewPublicId"><option value="">None</option>{#each data.lifecycleReviews.filter((item) => item.recommendation === 'retire') as review}<option value={review.public_id}>{review.review_code}</option>{/each}</select></label>
					<label>Code<input name="retirementCode" maxlength="50" required /></label>
					<label>Title<input name="title" required /></label>
					<label>Target end date<input name="targetEndDate" type="date" required /></label>
					<label>Owner<select name="ownerMemberId" required>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
					<label>F02 governance decision ID<input name="governanceDecisionPublicId" /></label>
					<label class="wide">Retirement rationale<textarea name="retirementRationale" required></textarea></label>
					<label class="wide">Customer transition plan<textarea name="customerTransitionPlan" required></textarea></label>
					<label class="wide">Operational transition plan<textarea name="operationalTransitionPlan" required></textarea></label>
					<label class="wide">Financial impact<textarea name="financialImpactSummary" required></textarea></label>
					<label class="wide">Data/record retention plan<textarea name="dataRecordRetentionPlan" required></textarea></label>
					<button type="submit">Create retirement plan</button>
				</form>
			</section>
		{/if}
	</div>

	<div class="grid two">
		<section class="panel">
			<h2>F05.10 · Innovation management</h2>
			{#each data.innovationExperiments as experiment}
				<article class="card"><strong>{experiment.experiment_code} · {experiment.title}</strong><p>{experiment.lifecycle_status}{experiment.outcome ? ` · ${experiment.outcome}` : ''}</p><p>{experiment.hypothesis}</p>{#if data.canManage && experiment.lifecycle_status !== 'completed'}<form method="POST" action="?/closeInnovationExperiment" class="form-grid"><input type="hidden" name="experimentPublicId" value={experiment.public_id} /><label>Outcome<select name="outcome"><option value="validated">Validated</option><option value="invalidated">Invalidated</option><option value="inconclusive">Inconclusive</option></select></label><label>Evidence ID<input name="evidencePublicId" /></label><label class="wide">Learning summary<textarea name="learningSummary" required></textarea></label><button type="submit">Close experiment</button></form>{/if}</article>
			{/each}
			{#if !data.innovationExperiments.length}<p>No innovation experiments yet.</p>{/if}
		</section>
		{#if data.canManage}
			<section class="panel">
				<h2>Create innovation experiment</h2>
				<form method="POST" action="?/createInnovationExperiment" class="form-grid">
					<label>Portfolio<select name="portfolioPublicId"><option value="">None</option>{#each data.portfolios as portfolio}<option value={portfolio.public_id}>{portfolio.portfolio_code}</option>{/each}</select></label>
					<label>Idea<select name="ideaPublicId"><option value="">None</option>{#each data.ideas as idea}<option value={idea.public_id}>{idea.idea_code}</option>{/each}</select></label>
					<label>Offering<select name="offeringPublicId"><option value="">None</option>{#each data.offerings as offering}<option value={offering.public_id}>{offering.offering_code}</option>{/each}</select></label>
					<label>Code<input name="experimentCode" maxlength="50" required /></label>
					<label>Title<input name="title" required /></label>
					<label>Owner<select name="ownerMemberId" required>{#each data.members as member}<option value={member.id}>{member.display_name}</option>{/each}</select></label>
					<label>Planned start<input name="plannedStart" type="date" /></label>
					<label>Planned finish<input name="plannedFinish" type="date" /></label>
					<label>Evidence ID<input name="evidencePublicId" /></label>
					<label class="wide">Hypothesis<textarea name="hypothesis" required></textarea></label>
					<label class="wide">Experiment method<textarea name="experimentMethod" required></textarea></label>
					<label class="wide">Success measure<textarea name="successMeasure" required></textarea></label>
					<button type="submit">Create experiment</button>
				</form>
			</section>
		{/if}
	</div>
</section>

<style>
	.workspace{display:grid;gap:1.25rem;max-width:1500px;margin:0 auto}.hero,.panel{border:1px solid var(--border,#d8dee8);border-radius:1rem;background:var(--surface,#fff);padding:1.25rem}.hero h1,.panel h2,.panel h3{margin-top:0}.eyebrow{font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}.metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.75rem}.metrics div{display:grid;gap:.2rem;border:1px solid var(--border,#d8dee8);border-radius:.8rem;padding:1rem;background:var(--surface,#fff)}.metrics strong{font-size:1.5rem}.grid.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.card{border-top:1px solid var(--border,#d8dee8);padding:.9rem 0}.card:first-of-type{border-top:0}.card p{margin:.35rem 0}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}label{display:grid;gap:.3rem;font-weight:600}input,select,textarea,button{font:inherit}input,select,textarea{width:100%;box-sizing:border-box;border:1px solid var(--border,#cbd5e1);border-radius:.55rem;padding:.6rem .7rem;background:inherit;color:inherit}textarea{min-height:5rem;resize:vertical}.wide{grid-column:1/-1}button{border:0;border-radius:.55rem;padding:.65rem .9rem;font-weight:700;cursor:pointer}.error{border:1px solid currentColor;border-radius:.6rem;padding:.75rem 1rem}@media(max-width:900px){.metrics,.grid.two,.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}}
</style>
