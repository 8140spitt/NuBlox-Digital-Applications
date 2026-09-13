<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Breadcrumbs, Button, Field, LinkButton, PageHeader, Panel } from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();

	const copy = $derived(
		data.recordKind === 'evidence'
			? {
					eyebrow: 'F01.02 · Evidence',
					title: 'Add a source the strategy can stand behind',
					description: 'Record what the evidence is, where it came from, when it was observed and how reliable it is before using it to support environmental analysis.',
					submit: 'Add evidence'
				}
			: data.recordKind === 'factor'
				? {
						eyebrow: 'F01.02 · Environmental factor',
						title: 'Turn evidence into a strategic implication',
						description: 'Classify the factor, explain what the evidence means and state explicitly why it matters to this strategy cycle.',
						submit: 'Add environmental factor'
					}
				: {
						eyebrow: 'F01.02 · Assumption',
						title: 'Expose uncertainty before it shapes a decision',
						description: 'Record a material belief, why it is being used, how confident the organisation is and when it must be reviewed.',
						submit: 'Add assumption'
					}
	);

	function value(key: string): string {
		return form?.values?.[key] ?? '';
	}
</script>

<svelte:head>
	<title>{copy.title} · NuBlox</title>
</svelte:head>

{#snippet headerActions()}
	<LinkButton href={routes.strategyAnalysis(data.tenant.slug, data.framework.publicId)} variant="quiet">Cancel</LinkButton>
{/snippet}

<div class="nb-page transaction-page">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{ label: data.framework.title, href: routes.strategyFramework(data.tenant.slug, data.framework.publicId) },
			{ label: 'Environmental analysis', href: routes.strategyAnalysis(data.tenant.slug, data.framework.publicId) },
			{ label: `Add ${data.recordKind}` }
		]}
	/>

	<PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} actions={headerActions} />

	<Panel padding="spacious">
		{#if form?.formError}
			<Alert tone="danger" title="Record not created">{form.formError}</Alert>
		{/if}

		<form method="POST" action="?/create" use:enhance class="transaction-form">
			{#if data.recordKind === 'evidence'}
				<Field id="evidenceType" label="Evidence type" required>
					<select class="nb-control" id="evidenceType" name="evidenceType" required value={value('evidenceType')}>
						<option value="">Select type</option>
						<option value="internal_data">Internal data</option>
						<option value="external_report">External report</option>
						<option value="market_intelligence">Market intelligence</option>
						<option value="regulatory">Regulatory</option>
						<option value="expert_judgement">Expert judgement</option>
						<option value="stakeholder">Stakeholder evidence</option>
						<option value="other">Other</option>
					</select>
				</Field>
				<Field id="title" label="Evidence title" required>
					<input class="nb-control" id="title" name="title" maxlength="255" required value={value('title')} />
				</Field>
				<Field id="publisherName" label="Publisher or source owner" hint="Use the accountable internal owner, issuing body or publisher.">
					<input class="nb-control" id="publisherName" name="publisherName" maxlength="255" value={value('publisherName')} />
				</Field>
				<Field id="sourceReference" label="Source reference" hint="Document number, dataset identifier, report title or other durable reference.">
					<input class="nb-control" id="sourceReference" name="sourceReference" maxlength="512" value={value('sourceReference')} />
				</Field>
				<div class="full">
					<Field id="sourceUri" label="Source URI" hint="Optional link to the authoritative source location.">
						<input class="nb-control" id="sourceUri" name="sourceUri" type="url" maxlength="2048" value={value('sourceUri')} />
					</Field>
				</div>
				<Field id="publishedOn" label="Published date">
					<input class="nb-control" id="publishedOn" name="publishedOn" type="date" value={value('publishedOn')} />
				</Field>
				<Field id="observedOn" label="Observed date" required hint="When this evidence was current or observed for strategic analysis.">
					<input class="nb-control" id="observedOn" name="observedOn" type="date" required value={value('observedOn')} />
				</Field>
				<Field id="reliabilityScore" label="Reliability" required hint="1 = weak/uncertain source, 5 = authoritative/high confidence.">
					<select class="nb-control" id="reliabilityScore" name="reliabilityScore" required value={value('reliabilityScore')}>
						<option value="">Select</option>{#each [1, 2, 3, 4, 5] as score}<option value={score}>{score}</option>{/each}
					</select>
				</Field>
				<div class="full">
					<Field id="summaryText" label="Evidence summary" required hint="State the relevant facts or findings without turning them into a strategic conclusion yet.">
						<textarea class="nb-control narrative" id="summaryText" name="summaryText" rows="6" required>{value('summaryText')}</textarea>
					</Field>
				</div>
			{:else if data.recordKind === 'factor'}
				<Field id="contextScope" label="Scope" required>
					<select class="nb-control" id="contextScope" name="contextScope" required value={value('contextScope')}>
						<option value="">Select</option><option value="internal">Internal</option><option value="external">External</option>
					</select>
				</Field>
				<Field id="dimension" label="Dimension" required>
					<select class="nb-control" id="dimension" name="dimension" required value={value('dimension')}>
						<option value="">Select</option>
						<option value="economic">Economic</option><option value="competitive">Competitive</option><option value="market">Market</option><option value="technology">Technology</option><option value="regulatory">Regulatory</option><option value="operational">Operational</option><option value="other">Other</option>
					</select>
				</Field>
				<Field id="direction" label="Strategic direction" required>
					<select class="nb-control" id="direction" name="direction" required value={value('direction')}>
						<option value="">Select</option><option value="strength">Strength</option><option value="weakness">Weakness</option><option value="opportunity">Opportunity</option><option value="threat">Threat</option><option value="neutral">Neutral</option>
					</select>
				</Field>
				<Field id="observedOn" label="Observed date" required>
					<input class="nb-control" id="observedOn" name="observedOn" type="date" required value={value('observedOn')} />
				</Field>
				<div class="full"><Field id="title" label="Factor title" required><input class="nb-control" id="title" name="title" maxlength="255" required value={value('title')} /></Field></div>
				<div class="full"><Field id="analysisText" label="Analysis" required hint="What does the evidence tell us about the organisation or its environment?"><textarea class="nb-control narrative" id="analysisText" name="analysisText" rows="5" required>{value('analysisText')}</textarea></Field></div>
				<div class="full"><Field id="implicationText" label="Strategic implication" required hint="What could this mean for strategic choices, priorities or constraints?"><textarea class="nb-control narrative" id="implicationText" name="implicationText" rows="5" required>{value('implicationText')}</textarea></Field></div>
				<Field id="likelihoodScore" label="Likelihood" required hint="1 = unlikely, 5 = highly likely."><select class="nb-control" id="likelihoodScore" name="likelihoodScore" required value={value('likelihoodScore')}><option value="">Select</option>{#each [1,2,3,4,5] as score}<option value={score}>{score}</option>{/each}</select></Field>
				<Field id="impactScore" label="Impact" required hint="1 = low consequence, 5 = enterprise-critical."><select class="nb-control" id="impactScore" name="impactScore" required value={value('impactScore')}><option value="">Select</option>{#each [1,2,3,4,5] as score}<option value={score}>{score}</option>{/each}</select></Field>
				<Field id="confidenceScore" label="Confidence" required hint="Confidence that the factor and analysis are sound."><select class="nb-control" id="confidenceScore" name="confidenceScore" required value={value('confidenceScore')}><option value="">Select</option>{#each [1,2,3,4,5] as score}<option value={score}>{score}</option>{/each}</select></Field>
				<div class="full evidence-select">
					<fieldset>
						<legend>Supporting evidence <span>Required</span></legend>
						<p>Choose one or more structured evidence items. Factors without evidence are not accepted in V2.</p>
						{#if data.evidence.length === 0}
							<Alert tone="warning" title="Evidence required">Create an evidence item before creating an environmental factor.</Alert>
						{:else}
							<div class="checkbox-list">{#each data.evidence as evidence (evidence.publicId)}<label><input type="checkbox" name="evidencePublicIds" value={evidence.publicId} /><span><strong>{evidence.title}</strong><small>{evidence.evidenceType.replaceAll('_', ' ')} · reliability {evidence.reliabilityScore}/5</small></span></label>{/each}</div>
						{/if}
					</fieldset>
				</div>
			{:else}
				<div class="full"><Field id="statementText" label="Assumption" required hint="Write the belief as a testable statement, not as a fact."><textarea class="nb-control narrative" id="statementText" name="statementText" rows="5" required>{value('statementText')}</textarea></Field></div>
				<div class="full"><Field id="rationaleText" label="Why this assumption is being used" required><textarea class="nb-control narrative" id="rationaleText" name="rationaleText" rows="4" required>{value('rationaleText')}</textarea></Field></div>
				<Field id="confidenceScore" label="Confidence" required><select class="nb-control" id="confidenceScore" name="confidenceScore" required value={value('confidenceScore')}><option value="">Select</option>{#each [1,2,3,4,5] as score}<option value={score}>{score}</option>{/each}</select></Field>
				<Field id="reviewBy" label="Review by" required hint="Assumptions must have a defined challenge/review point."><input class="nb-control" id="reviewBy" name="reviewBy" type="date" required value={value('reviewBy')} /></Field>
			{/if}

			<div class="form-actions full">
				<Button type="submit" disabled={data.recordKind === 'factor' && data.evidence.length === 0}>{copy.submit}</Button>
				<LinkButton href={routes.strategyAnalysis(data.tenant.slug, data.framework.publicId)} variant="secondary">Cancel</LinkButton>
			</div>
		</form>
	</Panel>
</div>

<style>
	.transaction-page { display: grid; gap: var(--nb-space-5); padding-bottom: var(--nb-space-16); }
	.transaction-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--nb-space-6); margin-top: var(--nb-space-6); }
	.full { grid-column: 1 / -1; }
	.narrative { min-height: 120px; resize: vertical; line-height: var(--nb-line-relaxed); }
	.form-actions { display: flex; gap: var(--nb-space-3); align-items: center; padding-top: var(--nb-space-2); }
	.evidence-select fieldset { margin: 0; border: 0; padding: 0; }
	.evidence-select legend { font-size: var(--nb-font-size-sm); font-weight: var(--nb-weight-semibold); }
	.evidence-select legend span { color: var(--nb-color-danger); font-size: var(--nb-font-size-xs); }
	.evidence-select fieldset > p { margin: var(--nb-space-2) 0 var(--nb-space-4); color: var(--nb-color-text-muted); font-size: var(--nb-font-size-xs); }
	.checkbox-list { display: grid; gap: var(--nb-space-2); }
	.checkbox-list label { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--nb-space-3); align-items: start; padding: var(--nb-space-3); border: 1px solid var(--nb-color-border-default); border-radius: var(--nb-radius-md); cursor: pointer; }
	.checkbox-list input { margin-top: 3px; }
	.checkbox-list span { display: grid; gap: 2px; }
	.checkbox-list small { color: var(--nb-color-text-muted); text-transform: capitalize; }
	@media (max-width: 700px) { .transaction-form { grid-template-columns: 1fr; } .full { grid-column: auto; } .form-actions { flex-wrap: wrap; } }
</style>
