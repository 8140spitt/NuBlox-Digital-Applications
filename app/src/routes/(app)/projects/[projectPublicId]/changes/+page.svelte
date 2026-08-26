<script lang="ts">
	let { data, form } = $props();

	let selectedChange = $derived(
		data.changes.find((change) => change.publicId === data.selectedChangePublicId) ?? null
	);

	function dateText(value: Date | null): string {
		return value ? value.toISOString().slice(0, 10) : 'Not recorded';
	}

	function impactLabel(value: string): string {
		return value === 'none' ? 'No impact' : value === 'potential' ? 'Potential' : 'Confirmed';
	}

	function statusLabel(value: string): string {
		return value.replaceAll('_', ' ');
	}

	function isChecked(values: string[] | undefined, publicId: string): boolean {
		return values?.includes(publicId) ?? false;
	}
</script>

<svelte:head>
	<title>Controlled change · {data.project.name} · NuBlox</title>
</svelte:head>

<div class="change-page">
	<header class="page-header">
		<div>
			<p class="eyebrow">Project controls · Change governance</p>
			<h1>Controlled project change</h1>
			<p class="lede">
				One governed path from change identification through scope, programme, cost, contract and
				information impact assessment to decision, implementation and closure.
			</p>
		</div>
		<nav class="context-links" aria-label="Project controls navigation">
			<a href={`/projects/${data.project.publicId}`}>Overview</a>
			<a href={`/projects/${data.project.publicId}/plan`}>Plan</a>
			<a href={`/projects/${data.project.publicId}/progress`}>Progress</a>
			<a href={`/projects/${data.project.publicId}/rida`}>RIDA</a>
			<a class="active" href={`/projects/${data.project.publicId}/changes`}>Change</a>
		</nav>
	</header>

	<section class="summary-grid" aria-label="Change control summary">
		<article>
			<span>Open changes</span><strong
				>{data.changes.filter((change) => !['closed', 'cancelled'].includes(change.status))
					.length}</strong
			>
		</article>
		<article>
			<span>Under review</span><strong
				>{data.changes.filter((change) => change.status === 'under_review').length}</strong
			>
		</article>
		<article>
			<span>Accepted</span><strong
				>{data.changes.filter((change) => change.status === 'accepted').length}</strong
			>
		</article>
		<article>
			<span>Implemented</span><strong
				>{data.changes.filter((change) => change.status === 'implemented').length}</strong
			>
		</article>
	</section>

	{#if form?.changeError}
		<p class="alert" role="alert">{form.changeError}</p>
	{/if}

	{#if data.canManage}
		<section class="panel raise-panel">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">Identify change</p>
					<h2>Raise a project change event</h2>
				</div>
				<span>Neutral change record first</span>
			</div>
			<form method="POST" action="?/createChange" class="raise-form">
				<label>
					Change type
					<select name="typeCode" required>
						{#each data.changeTypes as type}
							<option value={type.code}>{type.name}</option>
						{/each}
					</select>
				</label>
				<label>Title <input name="title" maxlength="255" required /></label>
				<label class="wide"
					>Description <textarea name="description" rows="3" required></textarea></label
				>
				<button type="submit">Raise change</button>
			</form>
		</section>
	{/if}

	<div class="workspace-grid">
		<section class="panel register-panel">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">Change register</p>
					<h2>Project changes</h2>
				</div>
				<span>{data.changes.length} records</span>
			</div>
			{#if data.changes.length}
				<div class="change-list">
					{#each data.changes as change}
						<a
							class:selected={change.publicId === data.selectedChangePublicId}
							href={`?change=${change.publicId}`}
						>
							<div class="change-card-head">
								<strong>{change.changeNumber}</strong>
								<span>{statusLabel(change.status)}</span>
							</div>
							<h3>{change.title}</h3>
							<p>{change.typeName}</p>
							{#if change.latestAssessment}
								<div class="mini-impacts">
									<span>S {change.latestAssessment.scopeImpactLevel[0].toUpperCase()}</span>
									<span>P {change.latestAssessment.programmeImpactLevel[0].toUpperCase()}</span>
									<span>C {change.latestAssessment.costImpactLevel[0].toUpperCase()}</span>
									<span>K {change.latestAssessment.contractImpactLevel[0].toUpperCase()}</span>
									<span>I {change.latestAssessment.informationImpactLevel[0].toUpperCase()}</span>
								</div>
							{/if}
						</a>
					{/each}
				</div>
			{:else}
				<p class="empty">No project changes have been raised.</p>
			{/if}
		</section>

		<section class="panel detail-panel">
			{#if selectedChange}
				<header class="detail-header">
					<div>
						<p class="eyebrow">{selectedChange.changeNumber} · {selectedChange.typeName}</p>
						<h2>{selectedChange.title}</h2>
						<p>{selectedChange.description}</p>
					</div>
					<span class="status-badge">{statusLabel(selectedChange.status)}</span>
				</header>

				<div class="evidence-strip">
					<span><strong>Identified</strong> {dateText(selectedChange.identifiedAt)}</span>
					<span><strong>Information links</strong> {selectedChange.informationLinkCount}</span>
					<span
						><strong>Commercial variations</strong> {selectedChange.commercialVariationCount}</span
					>
					<span><strong>Closed</strong> {dateText(selectedChange.closedAt)}</span>
				</div>

				{#if selectedChange.latestAssessment}
					<section class="assessment-summary">
						<div class="panel-heading compact">
							<div>
								<p class="eyebrow">Current impact position</p>
								<h3>Assessment v{selectedChange.latestAssessment.versionNumber}</h3>
							</div>
							<span>{selectedChange.latestAssessment.versionStatus}</span>
						</div>
						<div class="impact-grid">
							{#each [['Scope', selectedChange.latestAssessment.scopeImpactLevel, selectedChange.latestAssessment.scopeSummary], ['Programme', selectedChange.latestAssessment.programmeImpactLevel, selectedChange.latestAssessment.programmeSummary], ['Cost', selectedChange.latestAssessment.costImpactLevel, selectedChange.latestAssessment.costSummary], ['Contract', selectedChange.latestAssessment.contractImpactLevel, selectedChange.latestAssessment.contractSummary], ['Information', selectedChange.latestAssessment.informationImpactLevel, selectedChange.latestAssessment.informationSummary]] as impact}
								<article
									class:confirmed={impact[1] === 'confirmed'}
									class:potential={impact[1] === 'potential'}
								>
									<span>{impact[0]}</span><strong>{impactLabel(String(impact[1]))}</strong>
									{#if impact[2]}<p>{impact[2]}</p>{/if}
								</article>
							{/each}
						</div>
						<div class="quantified">
							<span
								><strong>Cost delta</strong>
								{selectedChange.latestAssessment.estimatedCostDelta ?? 'Not quantified'}
								{selectedChange.latestAssessment.currencyCode ?? ''}</span
							>
							<span
								><strong>Time delta</strong>
								{selectedChange.latestAssessment.estimatedTimeDeltaDays ?? 'Not quantified'}
								{selectedChange.latestAssessment.estimatedTimeDeltaDays ? 'days' : ''}</span
							>
						</div>
					</section>
				{/if}

				{#if data.canAssess && ['identified', 'under_review'].includes(selectedChange.status)}
					<section class="control-section">
						<div class="panel-heading compact">
							<div>
								<p class="eyebrow">Impact assessment</p>
								<h3>
									{selectedChange.latestAssessment?.versionStatus === 'submitted'
										? 'Prepare assessment revision'
										: 'Prepare assessment'}
								</h3>
							</div>
							<span>Draft until submitted</span>
						</div>
						<form method="POST" action="?/saveAssessment" class="assessment-form">
							<input type="hidden" name="changePublicId" value={selectedChange.publicId} />
							{#each [['Scope', 'scopeImpactLevel', 'scopeSummary', selectedChange.latestAssessment?.scopeImpactLevel ?? 'none', selectedChange.latestAssessment?.scopeSummary ?? ''], ['Programme', 'programmeImpactLevel', 'programmeSummary', selectedChange.latestAssessment?.programmeImpactLevel ?? 'none', selectedChange.latestAssessment?.programmeSummary ?? ''], ['Cost', 'costImpactLevel', 'costSummary', selectedChange.latestAssessment?.costImpactLevel ?? 'none', selectedChange.latestAssessment?.costSummary ?? ''], ['Contract', 'contractImpactLevel', 'contractSummary', selectedChange.latestAssessment?.contractImpactLevel ?? 'none', selectedChange.latestAssessment?.contractSummary ?? ''], ['Information', 'informationImpactLevel', 'informationSummary', selectedChange.latestAssessment?.informationImpactLevel ?? 'none', selectedChange.latestAssessment?.informationSummary ?? '']] as field}
								<div class="impact-editor">
									<label
										>{field[0]} impact
										<select name={field[1]} value={field[3]}>
											<option value="none">No impact</option><option value="potential"
												>Potential</option
											><option value="confirmed">Confirmed</option>
										</select>
									</label>
									<label>Assessment <textarea name={field[2]} rows="3">{field[4]}</textarea></label>
								</div>
							{/each}

							<div class="two-columns">
								<label
									>Estimated cost delta <input
										name="estimatedCostDelta"
										inputmode="decimal"
										value={selectedChange.latestAssessment?.estimatedCostDelta ?? ''}
										placeholder="0.00"
									/></label
								>
								<label
									>Currency <input
										name="currencyCode"
										maxlength="3"
										value={selectedChange.latestAssessment?.currencyCode ??
											data.project.currencyCode ??
											'GBP'}
									/></label
								>
								<label
									>Estimated time delta (days) <input
										name="estimatedTimeDeltaDays"
										inputmode="decimal"
										value={selectedChange.latestAssessment?.estimatedTimeDeltaDays ?? ''}
										placeholder="0.00"
									/></label
								>
							</div>

							<div class="link-grid">
								<fieldset>
									<legend>Scope / WBS</legend
									>{#if data.wbsOptions.length}{#each data.wbsOptions as option}<label class="check"
												><input
													type="checkbox"
													name="wbsPublicIds"
													value={option.publicId}
													checked={isChecked(
														selectedChange.latestAssessment?.wbsPublicIds,
														option.publicId
													)}
												/> <span>{option.code} · {option.name}</span></label
											>{/each}{:else}<p>No WBS nodes available.</p>{/if}
								</fieldset>
								<fieldset>
									<legend>Programme activities</legend
									>{#if data.activityOptions.length}{#each data.activityOptions as option}<label
												class="check"
												><input
													type="checkbox"
													name="activityPublicIds"
													value={option.publicId}
													checked={isChecked(
														selectedChange.latestAssessment?.activityPublicIds,
														option.publicId
													)}
												/> <span>{option.code} · {option.name}</span></label
											>{/each}{:else}<p>No plan activities available.</p>{/if}
								</fieldset>
								<fieldset>
									<legend>Cost codes</legend
									>{#if data.costCodeOptions.length}{#each data.costCodeOptions as option}<label
												class="check"
												><input
													type="checkbox"
													name="costCodePublicIds"
													value={option.publicId}
													checked={isChecked(
														selectedChange.latestAssessment?.costCodePublicIds,
														option.publicId
													)}
												/> <span>{option.code} · {option.name}</span></label
											>{/each}{:else}<p>No cost codes available.</p>{/if}
								</fieldset>
								<fieldset>
									<legend>Contracts</legend
									>{#if data.contractOptions.length}{#each data.contractOptions as option}<label
												class="check"
												><input
													type="checkbox"
													name="contractPublicIds"
													value={option.publicId}
													checked={isChecked(
														selectedChange.latestAssessment?.contractPublicIds,
														option.publicId
													)}
												/> <span>{option.contractNumber} · {option.title}</span></label
											>{/each}{:else}<p>No project contracts available.</p>{/if}
								</fieldset>
							</div>
							<button type="submit">Save impact assessment</button>
						</form>

						{#if selectedChange.latestAssessment?.versionStatus === 'draft'}
							<form method="POST" action="?/submitAssessment" class="action-form">
								<input type="hidden" name="changePublicId" value={selectedChange.publicId} />
								<button type="submit" class="primary">Submit assessment for decision</button>
							</form>
						{/if}
					</section>
				{/if}

				{#if data.canApprove && selectedChange.status === 'under_review' && selectedChange.latestAssessment?.versionStatus === 'submitted'}
					<section class="control-section decision-section">
						<div class="panel-heading compact">
							<div>
								<p class="eyebrow">Authority gate</p>
								<h3>Record change decision</h3>
							</div>
							<span>Immutable evidence</span>
						</div>
						<form method="POST" action="?/decideChange" class="decision-form">
							<input type="hidden" name="changePublicId" value={selectedChange.publicId} />
							<label
								>Decision <select name="decision" required
									><option value="accepted">Accept</option><option value="accepted_with_conditions"
										>Accept with conditions</option
									><option value="rejected">Reject</option><option value="deferred">Defer</option
									></select
								></label
							>
							<label>Rationale <textarea name="rationale" rows="4" required></textarea></label>
							<label
								>Conditions <textarea
									name="conditions"
									rows="3"
									placeholder="Required for acceptance with conditions"></textarea></label
							>
							<button type="submit">Record decision</button>
						</form>
					</section>
				{/if}

				{#if selectedChange.latestDecision}
					<section class="decision-evidence">
						<p class="eyebrow">Latest decision · #{selectedChange.latestDecision.decisionNumber}</p>
						<h3>{statusLabel(selectedChange.latestDecision.decision)}</h3>
						<p>{selectedChange.latestDecision.rationale}</p>
						{#if selectedChange.latestDecision.conditions}<p>
								<strong>Conditions:</strong>
								{selectedChange.latestDecision.conditions}
							</p>{/if}
						<span>{dateText(selectedChange.latestDecision.decidedAt)}</span>
					</section>
				{/if}

				{#if data.canImplement && selectedChange.status === 'accepted'}
					<section class="control-section">
						<div class="panel-heading compact">
							<div>
								<p class="eyebrow">Implementation gate</p>
								<h3>Record implementation</h3>
							</div>
							<span>After downstream controls are updated</span>
						</div>
						<form method="POST" action="?/recordImplementation" class="decision-form">
							<input type="hidden" name="changePublicId" value={selectedChange.publicId} />
							<label>Implemented on <input type="date" name="implementedAt" /></label>
							<label
								>Implementation evidence <textarea
									name="implementationSummary"
									rows="4"
									required
									placeholder="State what changed in scope, plan, cost, contract and information controls."
								></textarea></label
							>
							<button type="submit">Record as implemented</button>
						</form>
					</section>
				{/if}

				{#if selectedChange.implementation}
					<section class="implementation-evidence">
						<p class="eyebrow">Implementation evidence</p>
						<p>{selectedChange.implementation.implementationSummary}</p>
						<span>{dateText(selectedChange.implementation.implementedAt)}</span>
					</section>
				{/if}

				<div class="terminal-actions">
					{#if data.canClose && ['implemented', 'rejected'].includes(selectedChange.status)}
						<form method="POST" action="?/closeChange">
							<input type="hidden" name="changePublicId" value={selectedChange.publicId} /><button
								type="submit">Close change</button
							>
						</form>
					{/if}
					{#if data.canManage && ['identified', 'under_review'].includes(selectedChange.status)}
						<form method="POST" action="?/cancelChange">
							<input type="hidden" name="changePublicId" value={selectedChange.publicId} /><button
								type="submit"
								class="secondary">Cancel change</button
							>
						</form>
					{/if}
				</div>
			{:else}
				<p class="empty">Select a change to review its impact and governance evidence.</p>
			{/if}
		</section>
	</div>
</div>

<style>
	.change-page {
		display: grid;
		gap: 1.25rem;
		padding-bottom: 3rem;
	}
	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 2rem;
	}
	.page-header h1,
	.panel h2,
	.panel h3 {
		margin: 0;
	}
	.eyebrow {
		margin: 0 0 0.35rem;
		color: var(--color-text-muted);
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.lede {
		max-width: 52rem;
		margin: 0.65rem 0 0;
		color: var(--color-text-muted);
		line-height: 1.55;
	}
	.context-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.context-links a {
		padding: 0.45rem 0.7rem;
		border-radius: 0.55rem;
		color: inherit;
		text-decoration: none;
	}
	.context-links a.active {
		background: var(--color-surface-strong);
		font-weight: 700;
	}
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.summary-grid article {
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.9rem;
		background: var(--color-surface);
	}
	.summary-grid span {
		display: block;
		color: var(--color-text-muted);
		font-size: 0.82rem;
	}
	.summary-grid strong {
		display: block;
		margin-top: 0.25rem;
		font-size: 1.7rem;
	}
	.panel {
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		background: var(--color-surface);
		overflow: hidden;
	}
	.panel-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.15rem;
		border-bottom: 1px solid var(--color-border);
	}
	.panel-heading > span {
		color: var(--color-text-muted);
		font-size: 0.8rem;
	}
	.panel-heading.compact {
		padding: 0 0 0.8rem;
		border: 0;
	}
	.raise-panel {
		padding-bottom: 1rem;
	}
	.raise-form {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 0.8rem;
		padding: 1rem 1.15rem 0;
	}
	.raise-form .wide {
		grid-column: 1 / -1;
	}
	label {
		display: grid;
		gap: 0.35rem;
		color: var(--color-text-muted);
		font-size: 0.82rem;
		font-weight: 600;
	}
	input,
	select,
	textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid var(--color-border);
		border-radius: 0.55rem;
		background: var(--color-background);
		color: inherit;
		padding: 0.65rem 0.7rem;
		font: inherit;
	}
	textarea {
		resize: vertical;
	}
	button {
		width: fit-content;
		border: 0;
		border-radius: 0.6rem;
		padding: 0.65rem 0.95rem;
		background: var(--color-text);
		color: var(--color-background);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	button.secondary {
		background: var(--color-surface-strong);
		color: inherit;
	}
	.workspace-grid {
		display: grid;
		grid-template-columns: minmax(17rem, 0.72fr) minmax(0, 2fr);
		gap: 1rem;
		align-items: start;
	}
	.change-list {
		display: grid;
	}
	.change-list > a {
		display: grid;
		gap: 0.35rem;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid var(--color-border);
		color: inherit;
		text-decoration: none;
	}
	.change-list > a:hover,
	.change-list > a.selected {
		background: var(--color-surface-strong);
	}
	.change-list h3,
	.change-list p {
		margin: 0;
	}
	.change-list p {
		color: var(--color-text-muted);
		font-size: 0.82rem;
	}
	.change-card-head {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.78rem;
	}
	.change-card-head span {
		color: var(--color-text-muted);
		text-transform: capitalize;
	}
	.mini-impacts {
		display: flex;
		gap: 0.3rem;
		margin-top: 0.3rem;
	}
	.mini-impacts span {
		border: 1px solid var(--color-border);
		border-radius: 0.35rem;
		padding: 0.15rem 0.35rem;
		font-size: 0.7rem;
	}
	.detail-panel {
		padding: 1.15rem;
	}
	.detail-header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--color-border);
	}
	.detail-header p:last-child {
		margin-bottom: 0;
		color: var(--color-text-muted);
		line-height: 1.5;
	}
	.status-badge {
		align-self: flex-start;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		padding: 0.35rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: capitalize;
	}
	.evidence-strip,
	.quantified {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem 1.4rem;
		padding: 0.9rem 0;
		color: var(--color-text-muted);
		font-size: 0.8rem;
	}
	.evidence-strip strong,
	.quantified strong {
		color: var(--color-text);
	}
	.assessment-summary,
	.control-section,
	.decision-evidence,
	.implementation-evidence {
		margin-top: 1rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
	}
	.impact-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.55rem;
	}
	.impact-grid article {
		min-height: 5.5rem;
		padding: 0.7rem;
		border: 1px solid var(--color-border);
		border-radius: 0.65rem;
	}
	.impact-grid article.confirmed {
		border-width: 2px;
	}
	.impact-grid article.potential {
		border-style: dashed;
	}
	.impact-grid span,
	.impact-grid strong {
		display: block;
	}
	.impact-grid span {
		color: var(--color-text-muted);
		font-size: 0.72rem;
	}
	.impact-grid p {
		margin: 0.5rem 0 0;
		font-size: 0.78rem;
		line-height: 1.4;
	}
	.assessment-form {
		display: grid;
		gap: 0.8rem;
	}
	.impact-editor {
		display: grid;
		grid-template-columns: 10rem 1fr;
		gap: 0.8rem;
	}
	.two-columns {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}
	.link-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.7rem;
	}
	fieldset {
		display: grid;
		align-content: start;
		gap: 0.35rem;
		max-height: 13rem;
		overflow: auto;
		margin: 0;
		padding: 0.7rem;
		border: 1px solid var(--color-border);
		border-radius: 0.6rem;
	}
	legend {
		padding: 0 0.3rem;
		font-size: 0.78rem;
		font-weight: 700;
	}
	.check {
		grid-template-columns: auto 1fr;
		align-items: start;
		font-weight: 500;
	}
	.check input {
		width: auto;
		margin-top: 0.2rem;
	}
	.action-form {
		margin-top: 0.8rem;
	}
	.decision-form {
		display: grid;
		gap: 0.75rem;
	}
	.decision-evidence h3,
	.decision-evidence p,
	.implementation-evidence p {
		margin-top: 0;
	}
	.decision-evidence > span,
	.implementation-evidence > span {
		color: var(--color-text-muted);
		font-size: 0.8rem;
	}
	.terminal-actions {
		display: flex;
		gap: 0.6rem;
		margin-top: 1rem;
	}
	.alert {
		margin: 0;
		padding: 0.8rem 1rem;
		border: 1px solid currentColor;
		border-radius: 0.65rem;
	}
	.empty {
		padding: 1rem;
		color: var(--color-text-muted);
	}
	@media (max-width: 1050px) {
		.workspace-grid {
			grid-template-columns: 1fr;
		}
		.impact-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 760px) {
		.page-header {
			display: grid;
		}
		.summary-grid,
		.raise-form,
		.two-columns,
		.link-grid,
		.impact-editor {
			grid-template-columns: 1fr;
		}
		.raise-form .wide {
			grid-column: auto;
		}
		.impact-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
