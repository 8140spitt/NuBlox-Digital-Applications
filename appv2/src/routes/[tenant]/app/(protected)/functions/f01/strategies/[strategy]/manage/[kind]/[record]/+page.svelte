<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		Field,
		LinkButton,
		PageHeader,
		Panel,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const record = $derived(data.managedRecord);
	const relationshipEditor = $derived(data.relationshipEditor);
	const approvalStatus = $derived(data.approvalStatus ?? null);
	const postedValues = $derived((form?.values ?? {}) as Record<string, string>);

	function recordLabel(kind: string): string {
		return kind
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	function valueFor(name: string, fallback: string): string {
		return postedValues[name] ?? fallback;
	}

	function sectionHref(): string {
		if (record.section === 'framework')
			return routes.strategyFramework(data.tenant.slug, record.framework.publicId);
		if (record.section === 'analysis')
			return routes.strategyAnalysis(data.tenant.slug, record.framework.publicId);
		if (record.section === 'planning')
			return routes.strategyPlanning(data.tenant.slug, record.framework.publicId);
		if (record.section === 'business-planning')
			return routes.strategyBusinessPlanning(data.tenant.slug, record.framework.publicId);
		if (record.section === 'performance')
			return routes.strategyPerformance(data.tenant.slug, record.framework.publicId);
		return routes.strategyReview(data.tenant.slug, record.framework.publicId);
	}

	function statusTone(status: string): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
		if (
			[
				'approved',
				'active',
				'validated',
				'selected',
				'completed',
				'fulfilled',
				'satisfied',
				'achieved'
			].includes(status)
		)
			return 'success';
		if (['draft', 'proposed', 'unvalidated', 'identified', 'requested', 'open'].includes(status))
			return 'warning';
		if (['rejected', 'invalidated', 'cancelled'].includes(status)) return 'danger';
		if (['in_progress', 'committed', 'accepted', 'challenged'].includes(status)) return 'info';
		return 'neutral';
	}

	function stateExplanation(): string {
		if (approvalStatus)
			return 'This record has been submitted and remains unchanged until the review reaches its decision.';
		if (record.status === 'superseded')
			return 'This is historical evidence. It remains available for reference and cannot be changed.';
		if (record.canRevise)
			return 'This approved record is protected from direct editing. Create a controlled revision to change it.';
		if (record.canEdit)
			return 'You can update this working record before it moves to its next business stage.';
		return 'This record is protected in its current business state.';
	}
</script>

<svelte:head><title>{recordLabel(record.kind)} · {record.title} · NuBlox</title></svelte:head>

<div class="nb-page-form record-page">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: record.framework.title,
				href: routes.strategyFramework(data.tenant.slug, record.framework.publicId)
			},
			{ label: recordLabel(record.kind), href: sectionHref() },
			{ label: 'Edit' }
		]}
	/>

	<PageHeader
		eyebrow={`F01 · ${recordLabel(record.kind)}`}
		title={record.code ? `${record.code} · ${record.title}` : record.title}
		description={stateExplanation()}
	/>

	{#if form?.formError}<Alert tone="danger" title="Action not completed">{form.formError}</Alert
		>{/if}

	<section class="business-state">
		<div>
			<strong>{approvalStatus ? 'Under review' : recordLabel(record.status)}</strong>
			{#if record.versionLabel}<span>Version {record.versionLabel}</span>{/if}
		</div>
		<StatusBadge
			label={approvalStatus ? 'Under review' : recordLabel(record.status)}
			tone={approvalStatus ? 'info' : statusTone(record.status)}
		/>
	</section>

	{#if approvalStatus}
		<Panel
			title={approvalStatus.activityTitle}
			description="The current business record remains unchanged while the review is in progress."
		>
			<div class="review-row">
				<div>
					<p>Submitted {new Date(approvalStatus.submittedAt).toLocaleString()}</p>
					<p>Currently with <strong>{approvalStatus.assigneeLabel}</strong></p>
				</div>
				{#if approvalStatus.actionableByMember}
					<LinkButton href={routes.myWork(data.tenant.slug)}>Open my review task</LinkButton>
				{:else}
					<StatusBadge label="Awaiting review" tone="info" />
				{/if}
			</div>
		</Panel>
	{/if}

	{#if record.canEdit}
		<Panel
			title={`Edit ${recordLabel(record.kind).toLowerCase()}`}
			description="Keep the business content current before progressing it to the next stage."
		>
			<form method="POST" action="?/update" use:enhance class="record-form">
				{#each record.fields as field (field.name)}
					<Field id={field.name} label={field.label} hint={field.hint} required={field.required}>
						{#if field.type === 'textarea'}
							<textarea
								class="nb-control"
								id={field.name}
								name={field.name}
								rows="5"
								required={field.required}>{valueFor(field.name, field.value)}</textarea
							>
						{:else if field.type === 'select'}
							<select
								class="nb-control"
								id={field.name}
								name={field.name}
								required={field.required}
								value={valueFor(field.name, field.value)}
							>
								{#each field.options ?? [] as option (option.value)}<option value={option.value}
										>{option.label}</option
									>{/each}
							</select>
						{:else}
							<input
								class="nb-control"
								id={field.name}
								name={field.name}
								type={field.type}
								value={valueFor(field.name, field.value)}
								min={field.min}
								max={field.max}
								step={field.step}
								required={field.required}
							/>
						{/if}
					</Field>
				{/each}
				<div class="form-actions">
					<Button type="submit">Save changes</Button><LinkButton
						href={sectionHref()}
						variant="secondary">Cancel</LinkButton
					>
				</div>
			</form>
		</Panel>
	{/if}

	{#if relationshipEditor && record.canEdit}
		<Panel
			title="Strategic connections"
			description="Keep the relationships that explain why this record exists and what it supports."
		>
			<form method="POST" action="?/relationships" use:enhance class="relationship-form">
				{#each relationshipEditor.groups as group (group.key)}
					<fieldset class="relationship-group">
						<legend>{group.label}{group.required ? ' *' : ''}</legend>
						<p>{group.description}</p>
						{#if group.mode === 'single'}
							<select class="nb-control" name={group.key} required={group.required}>
								{#if !group.required}<option value="">No association</option>{/if}
								{#each group.options as option (option.value)}<option
										value={option.value}
										selected={option.selected}>{option.label}</option
									>{/each}
							</select>
						{:else if group.options.length > 0}
							<div class="relationship-options">
								{#each group.options as option (option.value)}
									<label class="relationship-option"
										><input
											type="checkbox"
											name={group.key}
											value={option.value}
											checked={option.selected}
										/><span>{option.label}</span></label
									>
								{/each}
							</div>
						{:else}
							<p class="muted">No eligible records are available yet.</p>
						{/if}
					</fieldset>
				{/each}
				<div class="form-actions"><Button type="submit">Save connections</Button></div>
			</form>
		</Panel>
	{/if}

	{#if !approvalStatus && record.transitions.length > 0}
		<Panel
			title="Next step"
			description="Only business actions that are valid for this record are available."
		>
			<div class="transition-list">
				{#each record.transitions as transition (`${record.status}-${transition.to}`)}
					<form method="POST" action="?/transition" use:enhance class="transition-card">
						<input type="hidden" name="targetStatus" value={transition.to} />
						<div>
							<strong>{transition.label}</strong>
							<p>{recordLabel(record.status)} → {recordLabel(transition.to)}</p>
						</div>
						{#if transition.requiresNote}
							<Field
								id={`transitionNote-${transition.to}`}
								label="Rationale / completion note"
								required
								><textarea
									class="nb-control"
									id={`transitionNote-${transition.to}`}
									name="transitionNote"
									rows="3"
									required></textarea></Field
							>
						{/if}
						{#if transition.requiresTargetReference}
							<div class="target-grid">
								<Field
									id={`targetRecordType-${transition.to}`}
									label="Completed in"
									hint="Canonical record type"
									required
									><input
										class="nb-control"
										id={`targetRecordType-${transition.to}`}
										name="targetRecordType"
										required
									/></Field
								>
								<Field id={`targetPublicId-${transition.to}`} label="Record reference" required
									><input
										class="nb-control"
										id={`targetPublicId-${transition.to}`}
										name="targetPublicId"
										required
									/></Field
								>
							</div>
						{/if}
						<Button type="submit" variant={transition.tone === 'danger' ? 'danger' : 'secondary'}
							>{transition.label}</Button
						>
					</form>
				{/each}
			</div>
		</Panel>
	{/if}

	{#if record.canRevise}
		<Panel
			title="Change an approved record"
			description="Create a new working version without overwriting the approved history."
		>
			<form method="POST" action="?/revise" use:enhance class="review-row">
				<div>
					<strong>Create controlled revision</strong>
					<p>The approved version remains current until the new version passes review.</p>
				</div>
				<Button type="submit">Create revision</Button>
			</form>
		</Panel>
	{/if}

	{#if record.versionHistory.length > 0}
		<details class="history">
			<summary>Version history</summary>
			<div class="history-list">
				{#each record.versionHistory as version (`${version.major}.${version.minor}-${version.createdAt}`)}
					<div>
						<strong>v{version.label}</strong><span>{recordLabel(version.status)}</span><time
							datetime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time
						><small>{version.changeNote ?? 'Saved record version'}</small>
					</div>
				{/each}
			</div>
		</details>
	{/if}

	{#if record.canDelete}
		<details class="danger-zone">
			<summary>Delete this record</summary>
			<form method="POST" action="?/delete" use:enhance class="delete-row">
				<Field id="deleteConfirmation" label="Type DELETE to confirm" required
					><input
						class="nb-control"
						id="deleteConfirmation"
						name="deleteConfirmation"
						autocomplete="off"
						required
					/></Field
				>
				<Button type="submit" variant="danger">Delete permanently</Button>
			</form>
		</details>
	{/if}
</div>

<style>
	.record-page,
	.record-form,
	.relationship-form,
	.transition-list {
		display: grid;
		gap: var(--nb-space-5);
	}
	.business-state {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-4);
		padding: var(--nb-space-4) var(--nb-space-5);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.business-state > div {
		display: flex;
		align-items: baseline;
		gap: var(--nb-space-3);
	}
	.business-state span,
	.muted {
		color: var(--nb-color-text-muted);
	}
	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--nb-space-3);
	}
	.relationship-group {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.relationship-group legend {
		font-weight: var(--nb-weight-semibold);
	}
	.relationship-group > p {
		color: var(--nb-color-text-secondary);
	}
	.relationship-options {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-2);
	}
	.relationship-option {
		display: flex;
		align-items: center;
		gap: var(--nb-space-2);
		padding: var(--nb-space-3);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-md);
	}
	.transition-card {
		display: grid;
		grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.2fr) auto;
		align-items: end;
		gap: var(--nb-space-4);
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-md);
	}
	.transition-card p,
	.review-row p {
		margin-bottom: 0;
		color: var(--nb-color-text-secondary);
	}
	.target-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-3);
	}
	.review-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-5);
	}
	.history,
	.danger-zone {
		padding: var(--nb-space-4) 0;
		border-top: 1px solid var(--nb-color-border-default);
	}
	.history summary,
	.danger-zone summary {
		cursor: pointer;
		font-weight: var(--nb-weight-semibold);
	}
	.history-list {
		display: grid;
		gap: var(--nb-space-2);
		margin-top: var(--nb-space-4);
	}
	.history-list > div {
		display: grid;
		grid-template-columns: 80px 120px 200px 1fr;
		gap: var(--nb-space-3);
		padding: var(--nb-space-3);
		background: var(--nb-color-bg-subtle);
		border-radius: var(--nb-radius-md);
	}
	.delete-row {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--nb-space-5);
		margin-top: var(--nb-space-4);
	}
	@media (max-width: 800px) {
		.relationship-options,
		.target-grid,
		.history-list > div {
			grid-template-columns: 1fr;
		}
		.transition-card,
		.review-row,
		.delete-row {
			display: flex;
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
