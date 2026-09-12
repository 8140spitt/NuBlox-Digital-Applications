<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Product, Service &amp; Innovation | NuBlox</title></svelte:head>

<section class="workspace">
	<header class="hero">
		<p class="eyebrow">F05 · Product, Service &amp; Innovation Management</p>
		<h1>Product, Service &amp; Innovation command centre</h1>
		<p>
			Turn evidence-backed needs into governed ideas, investment cases and lifecycle decisions
			without duplicating strategy, CRM, finance, project or performance truth.
		</p>
	</header>

	{#if form?.error}<div class="error" role="alert">{form.error}</div>{/if}

	<div class="metrics">
		<div><strong>{data.portfolios.length}</strong><span>Portfolios</span></div>
		<div><strong>{data.offerings.length}</strong><span>Offerings</span></div>
		<div><strong>{data.needs.length}</strong><span>Needs</span></div>
		<div><strong>{data.ideas.length}</strong><span>Ideas</span></div>
		<div><strong>{data.businessCases.length}</strong><span>Business cases</span></div>
	</div>

	<div class="grid two">
		<section class="panel">
			<h2>F05.01 · Portfolio strategy</h2>
			{#if data.portfolios.length}
				{#each data.portfolios as portfolio}
					<article class="card">
						<strong>{portfolio.portfolio_code} · {portfolio.title}</strong>
						<p>{portfolio.portfolio_type} · {portfolio.priority} · {portfolio.lifecycle_status}</p>
						<p>{portfolio.strategic_thesis}</p>
					</article>
				{/each}
			{:else}
				<p>No product/service portfolios yet.</p>
			{/if}
			<h3>Offerings</h3>
			{#if data.offerings.length}
				{#each data.offerings as offering}
					<article class="card compact">
						<strong>{offering.offering_code} · {offering.title}</strong>
						<p>{offering.offering_type} · {offering.lifecycle_stage}</p>
					</article>
				{/each}
			{:else}
				<p>No offerings yet.</p>
			{/if}
		</section>

		{#if data.canManage}
			<section class="panel">
				<h2>Create portfolio</h2>
				<form method="POST" action="?/createPortfolio" class="form-grid">
					<label>Code <input name="portfolioCode" maxlength="50" required /></label>
					<label>Title <input name="title" required /></label>
					<label>
						Type
						<select name="portfolioType">
							<option value="product">Product</option>
							<option value="service">Service</option>
							<option value="mixed">Mixed</option>
							<option value="platform">Platform</option>
							<option value="innovation">Innovation</option>
						</select>
					</label>
					<label>
						Priority
						<select name="priority">
							<option value="medium">Medium</option>
							<option value="high">High</option>
							<option value="critical">Critical</option>
							<option value="low">Low</option>
						</select>
					</label>
					<label>
						Owner
						<select name="ownerMemberId" required>
							{#each data.members as member}<option value={member.id}>{member.display_name}</option
								>{/each}
						</select>
					</label>
					<label class="wide"
						>Strategic thesis <textarea name="strategicThesis" required></textarea></label
					>
					<label>F01 objective ID <input name="strategyObjectivePublicId" /></label>
					<label>F01 KPI ID <input name="strategyKpiPublicId" /></label>
					<label>F03 evidence ID <input name="performanceEvidencePublicId" /></label>
					<button type="submit">Create portfolio</button>
				</form>

				{#if data.portfolios.length}
					<h2>Create offering</h2>
					<form method="POST" action="?/createOffering" class="form-grid">
						<label>
							Portfolio
							<select name="portfolioPublicId" required>
								{#each data.portfolios as portfolio}
									<option value={portfolio.public_id}
										>{portfolio.portfolio_code} · {portfolio.title}</option
									>
								{/each}
							</select>
						</label>
						<label>Code <input name="offeringCode" maxlength="50" required /></label>
						<label>Title <input name="title" required /></label>
						<label>
							Type
							<select name="offeringType">
								<option value="product">Product</option>
								<option value="service">Service</option>
								<option value="platform">Platform</option>
								<option value="solution">Solution</option>
								<option value="internal_capability">Internal capability</option>
								<option value="other">Other</option>
							</select>
						</label>
						<label>
							Owner
							<select name="ownerMemberId" required>
								{#each data.members as member}<option value={member.id}
										>{member.display_name}</option
									>{/each}
							</select>
						</label>
						<label class="wide"
							>Value proposition <textarea name="valueProposition" required></textarea></label
						>
						<button type="submit">Create offering</button>
					</form>
				{/if}
			</section>
		{/if}
	</div>

	<div class="grid two">
		<section class="panel">
			<h2>F05.02 · Market/customer needs</h2>
			{#if data.needs.length}
				{#each data.needs as need}
					<article class="card">
						<strong>{need.need_code} · {need.title}</strong>
						<p>{need.need_type} · {need.urgency} urgency · {need.evidence_strength} evidence</p>
						<p>{need.need_statement}</p>
						<small
							>{need.source_domain}{need.source_reference
								? ` · ${need.source_reference}`
								: ''}</small
						>
					</article>
				{/each}
			{:else}<p>No validated market/customer needs yet.</p>{/if}
		</section>

		{#if data.canManage}
			<section class="panel">
				<h2>Capture need</h2>
				<form method="POST" action="?/createNeed" class="form-grid">
					<label>
						Portfolio
						<select name="portfolioPublicId">
							<option value="">Unassigned</option>
							{#each data.portfolios as portfolio}<option value={portfolio.public_id}
									>{portfolio.portfolio_code}</option
								>{/each}
						</select>
					</label>
					<label>Code <input name="needCode" maxlength="50" required /></label>
					<label>Title <input name="title" required /></label>
					<label>
						Need type
						<select name="needType">
							<option value="customer">Customer</option>
							<option value="market">Market</option>
							<option value="operational">Operational</option>
							<option value="regulatory">Regulatory</option>
							<option value="technology">Technology</option>
							<option value="sustainability">Sustainability</option>
							<option value="commercial">Commercial</option>
							<option value="other">Other</option>
						</select>
					</label>
					<label
						>Source domain <input name="sourceDomain" maxlength="50" value="crm" required /></label
					>
					<label>Source record type <input name="sourceRecordType" /></label>
					<label>Source public ID <input name="sourcePublicId" /></label>
					<label>Source reference <input name="sourceReference" /></label>
					<label>Customer / market segment <input name="customerOrMarketSegment" /></label>
					<label>
						Evidence
						<select name="evidenceStrength">
							<option value="medium">Medium</option>
							<option value="high">High</option>
							<option value="validated">Validated</option>
							<option value="low">Low</option>
						</select>
					</label>
					<label>
						Urgency
						<select name="urgency">
							<option value="medium">Medium</option>
							<option value="high">High</option>
							<option value="critical">Critical</option>
							<option value="low">Low</option>
						</select>
					</label>
					<label>
						Owner
						<select name="ownerMemberId" required>
							{#each data.members as member}<option value={member.id}>{member.display_name}</option
								>{/each}
						</select>
					</label>
					<label class="wide"
						>Need statement <textarea name="needStatement" required></textarea></label
					>
					<button type="submit">Capture need</button>
				</form>
			</section>
		{/if}
	</div>

	<div class="grid two">
		<section class="panel">
			<h2>F05.03 · Product/service ideation</h2>
			{#if data.ideas.length}
				{#each data.ideas as idea}
					<article class="card">
						<strong>{idea.idea_code} · {idea.title}</strong>
						<p>{idea.idea_type} · {idea.stage} · score {idea.overall_score ?? '—'}</p>
						<p>{idea.proposed_value}</p>
						{#if data.canManage}
							<form method="POST" action="?/scoreIdea" class="score-grid">
								<input type="hidden" name="ideaPublicId" value={idea.public_id} />
								<label
									>Strategic <input
										name="strategicFit"
										type="number"
										min="0"
										max="100"
										required
									/></label
								>
								<label
									>Customer <input
										name="customerValue"
										type="number"
										min="0"
										max="100"
										required
									/></label
								>
								<label
									>Feasibility <input
										name="feasibility"
										type="number"
										min="0"
										max="100"
										required
									/></label
								>
								<label
									>Commercial <input
										name="commercialValue"
										type="number"
										min="0"
										max="100"
										required
									/></label
								>
								<label>Risk <input name="risk" type="number" min="0" max="100" required /></label>
								<button type="submit">Score idea</button>
							</form>
						{/if}
					</article>
				{/each}
			{:else}<p>No ideas in the innovation funnel yet.</p>{/if}
		</section>

		{#if data.canManage}
			<section class="panel">
				<h2>Submit idea</h2>
				<form method="POST" action="?/createIdea" class="form-grid">
					<label>
						Portfolio
						<select name="portfolioPublicId">
							<option value="">Unassigned</option>
							{#each data.portfolios as portfolio}<option value={portfolio.public_id}
									>{portfolio.portfolio_code}</option
								>{/each}
						</select>
					</label>
					<label>
						Need
						<select name="needPublicId">
							<option value="">Unlinked</option>
							{#each data.needs as need}<option value={need.public_id}
									>{need.need_code} · {need.title}</option
								>{/each}
						</select>
					</label>
					<label>Code <input name="ideaCode" maxlength="50" required /></label>
					<label>Title <input name="title" required /></label>
					<label>
						Idea type
						<select name="ideaType">
							<option value="new_product">New product</option>
							<option value="new_service">New service</option>
							<option value="enhancement">Enhancement</option>
							<option value="process_innovation">Process innovation</option>
							<option value="technology_innovation">Technology innovation</option>
							<option value="business_model">Business model</option>
							<option value="other">Other</option>
						</select>
					</label>
					<label
						>Provenance <input
							name="provenance"
							maxlength="50"
							value="customer_need"
							required
						/></label
					>
					<label>Source reference <input name="sourceReference" /></label>
					<label>
						Owner
						<select name="ownerMemberId" required>
							{#each data.members as member}<option value={member.id}>{member.display_name}</option
								>{/each}
						</select>
					</label>
					<label class="wide"
						>Problem statement <textarea name="problemStatement" required></textarea></label
					>
					<label class="wide"
						>Proposed value <textarea name="proposedValue" required></textarea></label
					>
					<button type="submit">Submit idea</button>
				</form>
			</section>
		{/if}
	</div>

	<div class="grid two">
		<section class="panel">
			<h2>F05.04 · Business case development</h2>
			{#if data.businessCases.length}
				{#each data.businessCases as businessCase}
					<article class="card">
						<strong
							>{businessCase.business_case_code} v{businessCase.version_number} · {businessCase.title}</strong
						>
						<p>{businessCase.currency_code} · {businessCase.lifecycle_status}</p>
						<p>
							Investment {businessCase.investment_cost ?? '—'} · annual value {businessCase.annual_revenue_or_value ??
								'—'} · benefit {businessCase.expected_benefit_value ?? '—'}
						</p>
						<p>{businessCase.recommendation}</p>
						{#if data.canApprove && businessCase.lifecycle_status === 'draft'}
							<form method="POST" action="?/approveBusinessCase">
								<input type="hidden" name="businessCasePublicId" value={businessCase.public_id} />
								<button type="submit">Approve business case</button>
							</form>
						{/if}
					</article>
				{/each}
			{:else}<p>No business cases yet.</p>{/if}
		</section>

		{#if data.canManage && data.ideas.length}
			<section class="panel">
				<h2>Create business case</h2>
				<form method="POST" action="?/createBusinessCase" class="form-grid">
					<label>
						Idea
						<select name="ideaPublicId" required>
							{#each data.ideas as idea}<option value={idea.public_id}
									>{idea.idea_code} · {idea.title}</option
								>{/each}
						</select>
					</label>
					<label>
						Offering
						<select name="offeringPublicId">
							<option value="">Not yet assigned</option>
							{#each data.offerings as offering}<option value={offering.public_id}
									>{offering.offering_code} · {offering.title}</option
								>{/each}
						</select>
					</label>
					<label>Code <input name="businessCaseCode" maxlength="50" required /></label>
					<label>Title <input name="title" required /></label>
					<label>Currency <input name="currencyCode" maxlength="3" value="GBP" required /></label>
					<label>Investment cost <input name="investmentCost" inputmode="decimal" /></label>
					<label
						>Annual operating cost <input name="annualOperatingCost" inputmode="decimal" /></label
					>
					<label
						>Annual revenue/value <input name="annualRevenueOrValue" inputmode="decimal" /></label
					>
					<label>Expected benefit <input name="expectedBenefitValue" inputmode="decimal" /></label>
					<label>Payback months <input name="paybackMonths" type="number" min="0" /></label>
					<label>F01 objective ID <input name="strategyObjectivePublicId" /></label>
					<label>F03 benefit ID <input name="performanceBenefitPublicId" /></label>
					<label class="wide">Risk summary <textarea name="riskSummary" required></textarea></label>
					<label class="wide"
						>Recommendation <textarea name="recommendation" required></textarea></label
					>
					<button type="submit">Create business case</button>
				</form>
			</section>
		{/if}
	</div>

	<section class="panel roadmap">
		<h2>Lifecycle control thread</h2>
		<div class="roadmap-grid">
			<div>
				<strong>F05.05</strong><span>Product/service design</span><small
					>Next lifecycle tranche</small
				>
			</div>
			<div>
				<strong>F05.06</strong><span>Development</span><small>Next lifecycle tranche</small>
			</div>
			<div>
				<strong>F05.07</strong><span>Launch management</span><small>Next lifecycle tranche</small>
			</div>
			<div>
				<strong>F05.08</strong><span>Lifecycle management</span><small>Next lifecycle tranche</small
				>
			</div>
			<div>
				<strong>F05.09</strong><span>Product retirement</span><small>Next lifecycle tranche</small>
			</div>
			<div>
				<strong>F05.10</strong><span>Innovation management</span><small
					>Next lifecycle tranche</small
				>
			</div>
		</div>
	</section>
</section>

<style>
	.workspace {
		display: grid;
		gap: 1.25rem;
		max-width: 1500px;
		margin: 0 auto;
	}
	.hero,
	.panel {
		border: 1px solid var(--border, #d8dee8);
		border-radius: 1rem;
		background: var(--surface, #fff);
		padding: 1.25rem;
	}
	.hero h1,
	.panel h2,
	.panel h3 {
		margin-top: 0;
	}
	.eyebrow {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.metrics div {
		display: grid;
		gap: 0.2rem;
		border: 1px solid var(--border, #d8dee8);
		border-radius: 0.8rem;
		padding: 1rem;
		background: var(--surface, #fff);
	}
	.metrics strong {
		font-size: 1.6rem;
	}
	.grid.two {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}
	.card {
		border-top: 1px solid var(--border, #d8dee8);
		padding: 0.9rem 0;
	}
	.card:first-of-type {
		border-top: 0;
	}
	.card p {
		margin: 0.35rem 0;
	}
	.card.compact {
		padding: 0.65rem 0;
	}
	.form-grid,
	.score-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.score-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: 0.8rem;
	}
	label {
		display: grid;
		gap: 0.3rem;
		font-weight: 600;
	}
	input,
	select,
	textarea,
	button {
		font: inherit;
	}
	input,
	select,
	textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--border, #cbd5e1);
		border-radius: 0.55rem;
		padding: 0.6rem 0.7rem;
		background: inherit;
		color: inherit;
	}
	textarea {
		min-height: 6rem;
		resize: vertical;
	}
	.wide {
		grid-column: 1 / -1;
	}
	button {
		border: 0;
		border-radius: 0.55rem;
		padding: 0.65rem 0.9rem;
		font-weight: 700;
		cursor: pointer;
	}
	.error {
		border: 1px solid currentColor;
		border-radius: 0.6rem;
		padding: 0.75rem 1rem;
	}
	.roadmap-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.roadmap-grid div {
		display: grid;
		gap: 0.25rem;
		border: 1px dashed var(--border, #cbd5e1);
		border-radius: 0.7rem;
		padding: 0.8rem;
	}
	.roadmap-grid small {
		opacity: 0.7;
	}
	@media (max-width: 900px) {
		.metrics,
		.grid.two,
		.roadmap-grid,
		.form-grid,
		.score-grid {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
	}
</style>
