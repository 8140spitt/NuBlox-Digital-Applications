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
		if (record.section === 'framework') {
			return routes.strategyFramework(data.tenant.slug, record.framework.publicId);
		}
		if (record.section === 'analysis') {
			return routes.strategyAnalysis(data.tenant.slug, record.framework.publicId);
		}
		if (record.section === 'planning') {
			return routes.strategyPlanning(data.tenant.slug, record.framework.publicId);
		}
		if (record.section === 'business-planning') {
			return routes.strategyBusinessPlanning(data.tenant.slug, record.framework.publicId);
		}
		if (record.section === 'performance') {
			return routes.strategyPerformance(data.tenant.slug, record.framework.publicId);
		}
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

	function lifecycleExplanation(): string {
		if (record.status === 'superseded') {
			return 'This is historical enterprise evidence. It remains readable but cannot be edited or moved forward.';
		}
		if (record.canRevise) {
			return 'This approved version remains current and immutable. Create a controlled revision to change it; when the revision is approved, this version becomes superseded automatically.';
		}
		if (record.transitions.length > 0) {
			return 'Only the valid next lifecycle actions are available below. NuBlox re-checks every transition on the server before committing it.';
		}
		if (record.canEdit) {
			return 'This record is still mutable in its current state. Save changes before progressing it through governance.';
		}
		return 'This record is governed in its current state and has no further direct lifecycle action.';
	}
</script>

<svelte:head>
	<title>Manage {recordLabel(record.kind)} · {record.title} · NuBlox</title>
</svelte:head>

<div class="nb-page-form manage-page">
	<Breadcrumbs
		items={[
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{
				label: record.framework.title,
				href: routes.strategyFramework(data.tenant.slug, record.framework.publicId)
			},
			{ label: recordLabel(record.kind), href: sectionHref() },
			{ label: 'Manage' }
		]}
	/>

	<PageHeader
		eyebrow={`F01 · ${recordLabel(record.kind)} governance`}
		title={record.code ? `${record.code} · ${record.title}` : record.title}
		description="Modify the mutable record, complete a valid lifecycle transition, or create a controlled revision when the governed version must change."
	/>

	{#if form?.formError}
		<Alert tone="danger" title="Action not completed">{form.formError}</Alert>
	{/if}

	{#if record.versionLabel}
		<section class="version-card" aria-labelledby="version-title">
			<div>
				<p class="section-kicker">Version control</p>
				<h2 id="version-title">Version {record.versionLabel}</h2>
				<p>
					{record.versionStage === 'draft'
						? 'Working minor version. Each meaningful save creates the next minor version; approval publishes the next major version.'
						: record.versionStage === 'published'
							? 'Current published major version. It is immutable; create a controlled revision to change it.'
							: 'Historical published major version retained as immutable enterprise evidence.'}
				</p>
			</div>
			<StatusBadge
				label={record.versionStage === 'draft'
					? 'Working draft'
					: record.versionStage === 'published'
						? 'Published'
						: 'Historical'}
				tone={record.versionStage === 'published'
					? 'success'
					: record.versionStage === 'draft'
						? 'warning'
						: 'neutral'}
			/>
		</section>

		{#if record.versionHistory.length > 0}
			<Panel
				title="Version history"
				description="Published majors remain immutable; working minors record meaningful saved revisions."
			>
				<div class="version-history">
					{#each record.versionHistory as version (`${version.major}.${version.minor}-${version.createdAt}`)}
						<div class="version-row">
							<strong>v{version.label}</strong>
							<span>{recordLabel(version.status)}</span>
							<time datetime={version.createdAt}
								>{new Date(version.createdAt).toLocaleString()}</time
							>
							<small>{version.changeNote ?? 'Governed version snapshot'}</small>
						</div>
					{/each}
				</div>
			</Panel>
		{/if}
	{/if}

	<section class="state-card" aria-labelledby="lifecycle-title">
		<div>
			<p class="section-kicker">Current lifecycle position</p>
			<h2 id="lifecycle-title">{recordLabel(record.status)}</h2>
			<p>{lifecycleExplanation()}</p>
		</div>
		<StatusBadge label={recordLabel(record.status)} tone={statusTone(record.status)} />
	</section>

	{#if record.canEdit}
		<Panel
			title="Modify record"
			description="Changes are allowed only while this record remains mutable. Existing lineage and governed relationships are preserved."
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
								{#each field.options ?? [] as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
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
					<Button type="submit">Save changes</Button>
					<LinkButton href={sectionHref()} variant="secondary">Cancel</LinkButton>
				</div>
			</form>
		</Panel>
	{:else}
		<Alert tone="info" title="Direct editing is closed">
			{record.canRevise
				? 'Use controlled revision below. The currently approved record stays intact until the revision is approved.'
				: 'This lifecycle state is immutable. Use an available lifecycle action rather than overwriting governed history.'}
		</Alert>
	{/if}

	{#if relationshipEditor}
		<Panel
			title="Associations & strategic lineage"
			description="Maintain the governed relationships that carry context downstream. NuBlox validates scope, lifecycle and orphaning rules before committing changes."
		>
			<form method="POST" action="?/relationships" use:enhance class="relationship-form">
				{#each relationshipEditor.groups as group (group.key)}
					<fieldset class="relationship-group">
						<legend>{group.label}{group.required ? ' *' : ''}</legend>
						<p>{group.description}</p>
						{#if group.mode === 'single'}
							<select class="nb-control" name={group.key} required={group.required}>
								{#if !group.required}<option value="">No association</option>{/if}
								{#each group.options as option (option.value)}
									<option value={option.value} selected={option.selected}>{option.label}</option>
								{/each}
							</select>
						{:else if group.options.length > 0}
							<div class="relationship-options">
								{#each group.options as option (option.value)}
									<label class="relationship-option">
										<input
											type="checkbox"
											name={group.key}
											value={option.value}
											checked={option.selected}
										/>
										<span>{option.label}</span>
									</label>
								{/each}
							</div>
						{:else}
							<p class="relationship-empty">
								No eligible records are available in the governing context.
							</p>
						{/if}
					</fieldset>
				{/each}
				<div class="form-actions">
					<Button type="submit">Save associations</Button>
				</div>
			</form>
		</Panel>
	{/if}

	{#if record.transitions.length > 0}
		<section class="lifecycle-actions" aria-labelledby="available-actions-title">
			<div class="section-heading">
				<p class="section-kicker">Available next actions</p>
				<h2 id="available-actions-title">Move the record deliberately</h2>
			</div>
			<div class="transition-grid">
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
							>
								<textarea
									class="nb-control"
									id={`transitionNote-${transition.to}`}
									name="transitionNote"
									rows="3"
									required></textarea>
							</Field>
						{/if}
						{#if transition.requiresTargetReference}
							<div class="target-grid">
								<Field
									id={`targetRecordType-${transition.to}`}
									label="Canonical record type"
									required
								>
									<input
										class="nb-control"
										id={`targetRecordType-${transition.to}`}
										name="targetRecordType"
										required
									/>
								</Field>
								<Field id={`targetPublicId-${transition.to}`} label="Canonical public ID" required>
									<input
										class="nb-control"
										id={`targetPublicId-${transition.to}`}
										name="targetPublicId"
										required
									/>
								</Field>
							</div>
						{/if}
						<Button type="submit" variant={transition.tone === 'danger' ? 'danger' : 'secondary'}>
							{transition.label}
						</Button>
					</form>
				{/each}
			</div>
		</section>
	{/if}

	{#if record.canRevise}
		<Panel
			title="Controlled revision"
			description="Creates the next draft version from this approved record. This version stays current until the new version passes approval; only then does NuBlox mark this version superseded."
		>
			<form method="POST" action="?/revise" use:enhance class="revision-row">
				<div>
					<strong>Create next draft version</strong>
					<p>No approved history is overwritten.</p>
				</div>
				<Button type="submit">Create revision</Button>
			</form>
		</Panel>
	{/if}

	{#if record.canDelete}
		<Panel
			title="Delete ungoverned record"
			description="Permanent deletion is only available before the record becomes governed or is depended on by downstream records."
		>
			<form method="POST" action="?/delete" use:enhance class="delete-row">
				<Field
					id="deleteConfirmation"
					label="Type DELETE to confirm"
					hint="After governance, use retire, cancel or controlled revision instead of deletion."
					required
				>
					<input
						class="nb-control"
						id="deleteConfirmation"
						name="deleteConfirmation"
						autocomplete="off"
						required
					/>
				</Field>
				<Button type="submit" variant="danger">Delete permanently</Button>
			</form>
		</Panel>
	{/if}
</div>

<style>
	.manage-page,
	.record-form,
	.lifecycle-actions {
		display: grid;
		gap: var(--nb-space-6);
		padding-bottom: var(--nb-space-16);
	}
	.state-card,
	.version-card {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-6);
		padding: var(--nb-space-6);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.section-kicker {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.state-card h2,
	.section-heading h2 {
		margin: var(--nb-space-2) 0 0;
	}
	.state-card p:not(.section-kicker),
	.transition-card p,
	.revision-row p {
		margin: var(--nb-space-2) 0 0;
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-relaxed);
	}
	.version-history {
		display: grid;
		gap: var(--nb-space-3);
	}
	.version-row {
		display: grid;
		grid-template-columns: 80px 110px minmax(160px, auto) 1fr;
		gap: var(--nb-space-3);
		align-items: baseline;
		padding-block: var(--nb-space-3);
		border-bottom: 1px solid var(--nb-color-border-subtle);
	}
	.version-row:last-child {
		border-bottom: 0;
	}
	.version-row span,
	.version-row time,
	.version-row small {
		color: var(--nb-color-text-secondary);
	}

	.record-form {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding-bottom: 0;
	}
	.record-form :global(.nb-field:has(textarea)) {
		grid-column: 1 / -1;
	}
	.form-actions {
		grid-column: 1 / -1;
		display: flex;
		justify-content: flex-end;
		gap: var(--nb-space-3);
	}
	.transition-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}
	.transition-card {
		display: grid;
		align-content: start;
		gap: var(--nb-space-4);
		padding: var(--nb-space-5);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	.target-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-3);
	}
	.revision-row,
	.delete-row {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: var(--nb-space-6);
	}
	.delete-row :global(.nb-field) {
		flex: 1;
	}
	@media (max-width: 760px) {
		.record-form,
		.transition-grid,
		.target-grid {
			grid-template-columns: 1fr;
		}
		.revision-row,
		.delete-row,
		.state-card {
			align-items: stretch;
			flex-direction: column;
		}
	}

	.relationship-form {
		display: grid;
		gap: var(--nb-space-6);
	}

	.relationship-group {
		display: grid;
		gap: var(--nb-space-3);
		margin: 0;
		padding: 0 0 var(--nb-space-5);
		border: 0;
		border-bottom: 1px solid var(--nb-color-border-subtle);
	}

	.relationship-group legend {
		font-weight: 750;
	}

	.relationship-group p,
	.relationship-empty {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
	}

	.relationship-options {
		display: grid;
		gap: var(--nb-space-2);
	}

	.relationship-option {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: var(--nb-space-3);
		padding: var(--nb-space-3);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
	}
</style>
