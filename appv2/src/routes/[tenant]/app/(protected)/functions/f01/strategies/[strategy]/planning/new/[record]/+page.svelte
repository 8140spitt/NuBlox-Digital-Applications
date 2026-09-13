<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		Field,
		LinkButton,
		PageHeader,
		Panel
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const selectedOptions = $derived(
		data.options.filter((option) => option.decisionStatus === 'selected')
	);
	const copy = $derived(
		data.recordKind === 'option'
			? {
					eyebrow: 'F01.03 · Strategic option',
					title: 'Create an alternative that can be evaluated and decided',
					description:
						'Tie the option to environmental factors or assumptions so the reason for considering it remains explicit.',
					submit: 'Add strategic option'
				}
			: data.recordKind === 'theme'
				? {
						eyebrow: 'F01.03 · Strategic theme',
						title: 'Define an enterprise outcome theme',
						description:
							'Themes provide a stable strategic structure for objectives and prevent the plan becoming an unconnected list of goals.',
						submit: 'Add strategic theme'
					}
				: {
						eyebrow: 'F01.03 · Strategic objective',
						title: 'Turn a selected choice into an accountable outcome',
						description:
							'Every objective must inherit decision lineage from at least one selected option and belong to a strategic theme.',
						submit: 'Add strategic objective'
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
	<LinkButton
		href={routes.strategyPlanning(data.tenant.slug, data.framework.publicId)}
		variant="quiet">Cancel</LinkButton
	>
{/snippet}

<div class="nb-page transaction-page">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: data.framework.title,
				href: routes.strategyFramework(data.tenant.slug, data.framework.publicId)
			},
			{
				label: 'Strategic planning',
				href: routes.strategyPlanning(data.tenant.slug, data.framework.publicId)
			},
			{ label: `Add ${data.recordKind}` }
		]}
	/>

	<PageHeader
		eyebrow={copy.eyebrow}
		title={copy.title}
		description={copy.description}
		actions={headerActions}
	/>

	<Panel padding="spacious">
		{#if form?.formError}
			<Alert tone="danger" title="Record not created">{form.formError}</Alert>
		{/if}

		<form method="POST" action="?/create" use:enhance class="transaction-form">
			{#if data.recordKind === 'option'}
				<div class="full">
					<Field id="title" label="Option title" required
						><input
							class="nb-control"
							id="title"
							name="title"
							maxlength="255"
							required
							value={value('title')}
						/></Field
					>
				</div>
				<Field
					id="priorityRank"
					label="Priority rank"
					required
					hint="Controls evaluation order; it does not mean the option has been selected."
					><input
						class="nb-control"
						id="priorityRank"
						name="priorityRank"
						type="number"
						min="1"
						step="1"
						required
						value={value('priorityRank')}
					/></Field
				>
				<div class="full">
					<Field
						id="description"
						label="Option description"
						required
						hint="Describe the strategic alternative and what would materially change if it were pursued."
						><textarea
							class="nb-control narrative"
							id="description"
							name="description"
							rows="5"
							required>{value('description')}</textarea
						></Field
					>
				</div>
				<div class="full">
					<Field
						id="evaluationSummary"
						label="Evaluation summary"
						required
						hint="Summarise expected value, feasibility, trade-offs, constraints and consequences."
						><textarea
							class="nb-control narrative"
							id="evaluationSummary"
							name="evaluationSummary"
							rows="5"
							required>{value('evaluationSummary')}</textarea
						></Field
					>
				</div>
				<div class="full driver-grid">
					<fieldset>
						<legend>Environmental drivers</legend>
						<p>
							Select the factors this option responds to. At least one factor or assumption is
							required.
						</p>
						<div class="checkbox-list">
							{#each data.factors as factor (factor.publicId)}<label
									><input type="checkbox" name="factorPublicIds" value={factor.publicId} /><span
										><strong>{factor.title}</strong><small
											>{factor.direction} · impact {factor.impactScore ?? '—'} · likelihood {factor.likelihoodScore ??
												'—'}</small
										></span
									></label
								>{/each}
						</div>
					</fieldset>
					<fieldset>
						<legend>Assumptions</legend>
						<p>Select material assumptions on which the option depends.</p>
						<div class="checkbox-list">
							{#each data.assumptions as assumption (assumption.publicId)}<label
									><input
										type="checkbox"
										name="assumptionPublicIds"
										value={assumption.publicId}
									/><span
										><strong>{assumption.statementText}</strong><small
											>{assumption.validationStatus} · confidence {assumption.confidenceScore ??
												'—'}/5</small
										></span
									></label
								>{/each}
						</div>
					</fieldset>
				</div>
			{:else if data.recordKind === 'theme'}
				<div class="full">
					<Field id="title" label="Theme title" required
						><input
							class="nb-control"
							id="title"
							name="title"
							maxlength="255"
							required
							value={value('title')}
						/></Field
					>
				</div>
				<Field id="priorityRank" label="Priority rank" required
					><input
						class="nb-control"
						id="priorityRank"
						name="priorityRank"
						type="number"
						min="1"
						step="1"
						required
						value={value('priorityRank')}
					/></Field
				>
				<div class="full">
					<Field
						id="description"
						label="Theme description"
						required
						hint="Describe the enterprise outcome this theme groups and the strategic boundary it creates."
						><textarea
							class="nb-control narrative"
							id="description"
							name="description"
							rows="6"
							required>{value('description')}</textarea
						></Field
					>
				</div>
			{:else}
				<div class="full">
					<Field id="title" label="Objective title" required
						><input
							class="nb-control"
							id="title"
							name="title"
							maxlength="255"
							required
							value={value('title')}
						/></Field
					>
				</div>
				<Field id="priorityRank" label="Priority rank" required
					><input
						class="nb-control"
						id="priorityRank"
						name="priorityRank"
						type="number"
						min="1"
						step="1"
						required
						value={value('priorityRank')}
					/></Field
				>
				<Field
					id="targetDate"
					label="Target date"
					required
					hint={`Must fall within ${data.framework.horizonStart} to ${data.framework.horizonEnd}.`}
					><input
						class="nb-control"
						id="targetDate"
						name="targetDate"
						type="date"
						min={data.framework.horizonStart}
						max={data.framework.horizonEnd}
						required
						value={value('targetDate')}
					/></Field
				>
				<Field id="themePublicId" label="Primary strategic theme" required>
					<select
						class="nb-control"
						id="themePublicId"
						name="themePublicId"
						required
						value={value('themePublicId')}
					>
						<option value="">Select theme</option
						>{#each data.themes as theme (theme.publicId)}<option value={theme.publicId}
								>{theme.code} · {theme.title}</option
							>{/each}
					</select>
				</Field>
				<Field
					id="parentObjectivePublicId"
					label="Parent objective"
					hint="Optional. Use this to create a controlled objective hierarchy/cascade."
				>
					<select
						class="nb-control"
						id="parentObjectivePublicId"
						name="parentObjectivePublicId"
						value={value('parentObjectivePublicId')}
					>
						<option value="">Enterprise-level objective</option
						>{#each data.objectives as objective (objective.publicId)}<option
								value={objective.publicId}>{objective.code} · {objective.title}</option
							>{/each}
					</select>
				</Field>
				<div class="full">
					<Field
						id="description"
						label="Objective outcome"
						required
						hint="Describe the outcome that must be true, not the activity that will be performed."
						><textarea
							class="nb-control narrative"
							id="description"
							name="description"
							rows="6"
							required>{value('description')}</textarea
						></Field
					>
				</div>
				<div class="full">
					<fieldset>
						<legend>Selected strategic choices <span>Required</span></legend>
						<p>
							An objective must derive from at least one option that has been explicitly selected.
						</p>
						{#if selectedOptions.length === 0}
							<Alert tone="warning" title="Selected option required"
								>Select a strategic option before creating objectives.</Alert
							>
						{:else}
							<div class="checkbox-list">
								{#each selectedOptions as option (option.publicId)}<label
										><input type="checkbox" name="optionPublicIds" value={option.publicId} /><span
											><strong>{option.title}</strong><small
												>{option.factorCount} factors · {option.assumptionCount} assumptions</small
											></span
										></label
									>{/each}
							</div>
						{/if}
					</fieldset>
				</div>
			{/if}

			<div class="form-actions full">
				<Button
					type="submit"
					disabled={data.recordKind === 'objective' &&
						(selectedOptions.length === 0 || data.themes.length === 0)}>{copy.submit}</Button
				>
				<LinkButton
					href={routes.strategyPlanning(data.tenant.slug, data.framework.publicId)}
					variant="secondary">Cancel</LinkButton
				>
			</div>
		</form>
	</Panel>
</div>

<style>
	.transaction-page {
		display: grid;
		gap: var(--nb-space-5);
		padding-bottom: var(--nb-space-16);
	}
	.transaction-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-6);
		margin-top: var(--nb-space-6);
	}
	.full {
		grid-column: 1 / -1;
	}
	.narrative {
		min-height: 120px;
		resize: vertical;
		line-height: var(--nb-line-relaxed);
	}
	.form-actions {
		display: flex;
		gap: var(--nb-space-3);
		align-items: center;
		padding-top: var(--nb-space-2);
	}
	.driver-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-6);
	}
	fieldset {
		min-width: 0;
		margin: 0;
		border: 0;
		padding: 0;
	}
	legend {
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-semibold);
	}
	legend span {
		color: var(--nb-color-danger);
		font-size: var(--nb-font-size-xs);
	}
	fieldset > p {
		margin: var(--nb-space-2) 0 var(--nb-space-4);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		line-height: var(--nb-line-relaxed);
	}
	.checkbox-list {
		display: grid;
		gap: var(--nb-space-2);
	}
	.checkbox-list label {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--nb-space-3);
		align-items: start;
		padding: var(--nb-space-3);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-md);
		cursor: pointer;
	}
	.checkbox-list input {
		margin-top: 3px;
	}
	.checkbox-list span {
		display: grid;
		gap: 2px;
	}
	.checkbox-list small {
		color: var(--nb-color-text-muted);
		text-transform: capitalize;
	}
	@media (max-width: 760px) {
		.transaction-form,
		.driver-grid {
			grid-template-columns: 1fr;
		}
		.full {
			grid-column: auto;
		}
		.form-actions {
			flex-wrap: wrap;
		}
	}
</style>
