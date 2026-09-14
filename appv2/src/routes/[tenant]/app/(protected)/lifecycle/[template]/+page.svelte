<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		Alert,
		Breadcrumbs,
		Button,
		EmptyState,
		Field,
		PageHeader,
		Panel,
		StatusBadge
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	const template = $derived(data.template);
	const draft = $derived(template.status === 'draft');
	const published = $derived(template.status === 'published');
	const advanced = $derived(template.mode === 'advanced');

	function statusTone(status: string): 'success' | 'info' | 'warning' | 'default' {
		if (status === 'published') return 'success';
		if (status === 'draft') return 'info';
		if (status === 'superseded') return 'warning';
		return 'default';
	}
</script>

<svelte:head>
	<title>{template.name} · Lifecycle administration · NuBlox</title>
	<meta
		name="description"
		content="Govern lifecycle phases, transitions, role access, bindings and controlled versions."
	/>
</svelte:head>

<div class="nb-page-wide lifecycle-detail">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Lifecycle administration', href: routes.lifecycle(tenant) },
			{ label: template.name }
		]}
	/>

	<PageHeader
		eyebrow="Lifecycle template governance"
		title={template.name}
		description={template.description ?? 'No description has been supplied for this lifecycle template.'}
	/>

	<div class="summary-row" aria-label="Lifecycle template summary">
		<StatusBadge label={template.status} tone={statusTone(template.status)} />
		<StatusBadge label={template.mode} tone={advanced ? 'info' : 'default'} />
		{#if template.isActiveBinding}
			<StatusBadge label="Active binding" tone="success" />
		{/if}
		<span>{template.templateKey}</span>
		<span>Version {template.versionLabel}</span>
		<span>{template.objectType}</span>
	</div>

	{#if form?.formError}
		<Alert tone="danger" title="Lifecycle action not completed">{form.formError}</Alert>
	{/if}

	{#if published}
		<Alert tone="success" title="Published major version">
			This version is immutable. Create a controlled revision to change phases, transitions, roles or access rules.
		</Alert>
	{:else if template.status === 'superseded'}
		<Alert tone="info" title="Historical lifecycle version">
			This version is retained as governed history and cannot be modified.
		</Alert>
	{/if}

	<div class="governance-grid">
		<main class="stack">
			<Panel
				title="Template definition"
				description="Object binding, mode and initial phase define the lifecycle contract consumed by the platform kernel."
				padding="spacious"
			>
				{#if draft && template.canManage}
					<form method="POST" action="?/update" use:enhance class="form-grid">
						<Field id="name" label="Name" required>
							<input class="nb-control" id="name" name="name" value={template.name} required />
						</Field>
						<Field id="objectType" label="Object type" required>
							<input
								class="nb-control"
								id="objectType"
								name="objectType"
								value={template.objectType}
								required
							/>
						</Field>
						<Field id="initialState" label="Initial phase" required>
							<select class="nb-control" id="initialState" name="initialState">
								{#each template.phases as phase (phase.phaseKey)}
									<option value={phase.phaseKey} selected={phase.phaseKey === template.initialState}>
										{phase.label} ({phase.phaseKey})
									</option>
								{/each}
							</select>
						</Field>
						<div class="full">
							<Field id="description" label="Description">
								<textarea class="nb-control" id="description" name="description">{template.description ?? ''}</textarea>
							</Field>
						</div>
						<div class="full"><Button type="submit">Save template definition</Button></div>
					</form>
				{:else}
					<dl class="definition-list">
						<div><dt>Template key</dt><dd>{template.templateKey}</dd></div>
						<div><dt>Object type</dt><dd>{template.objectType}</dd></div>
						<div><dt>Mode</dt><dd>{template.mode}</dd></div>
						<div><dt>Initial phase</dt><dd>{template.initialState}</dd></div>
					</dl>
				{/if}
			</Panel>

			<Panel
				title="Lifecycle phases"
				description="A phase controls ordinary edit, delete and revise capability. Advanced templates can add role-scoped access below."
			>
				<div class="record-list">
					{#each template.phases as phase (phase.phaseKey)}
						<div class="record-row">
							<div>
								<strong>{phase.label}</strong>
								<div class="record-meta">
									<span>{phase.phaseKey}</span><span>Order {phase.displayOrder}</span>
									{#if phase.editable}<span>Edit</span>{/if}
									{#if phase.deletable}<span>Delete</span>{/if}
									{#if phase.revisable}<span>Revise</span>{/if}
								</div>
							</div>
							{#if draft && template.canManage && phase.phaseKey !== template.initialState}
								<form method="POST" action="?/deletePhase" use:enhance>
									<input type="hidden" name="phaseKey" value={phase.phaseKey} />
									<Button type="submit" variant="danger" size="sm">Remove</Button>
								</form>
							{/if}
						</div>
					{/each}
				</div>

				{#if draft && template.canManage}
					<form method="POST" action="?/addPhase" use:enhance class="inline-form">
						<input class="nb-control" name="phaseKey" placeholder="phase_key" aria-label="Phase key" required />
						<input class="nb-control" name="label" placeholder="Phase label" aria-label="Phase label" required />
						<input class="nb-control order" type="number" min="0" name="displayOrder" value="20" aria-label="Display order" />
						<label class="check"><input type="checkbox" name="editable" /> Edit</label>
						<label class="check"><input type="checkbox" name="deletable" /> Delete</label>
						<label class="check"><input type="checkbox" name="revisable" /> Revise</label>
						<Button type="submit" variant="secondary" size="sm">Add phase</Button>
					</form>
				{/if}
			</Panel>

			<Panel
				title="Permitted transitions"
				description="Transitions are explicit business events. Permission and workflow bindings are optional gates, not substitutes for domain invariants."
			>
				{#if template.transitions.length === 0}
					<EmptyState title="No transitions yet" description="Add the legal state changes before publishing this lifecycle." />
				{:else}
					<div class="record-list">
						{#each template.transitions as transition (transition.publicId)}
							<div class="record-row">
								<div>
									<strong>{transition.label}</strong>
									<div class="record-meta">
										<span>{transition.fromState} → {transition.toState}</span>
										{#if transition.requiredPermissionKey}<span>{transition.requiredPermissionKey}</span>{/if}
										{#if transition.workflowKey}<span>Workflow: {transition.workflowKey}</span>{/if}
										{#if transition.requiresNote}<span>Note required</span>{/if}
									</div>
								</div>
								{#if draft && template.canManage}
									<form method="POST" action="?/deleteTransition" use:enhance>
										<input type="hidden" name="transitionPublicId" value={transition.publicId} />
										<Button type="submit" variant="danger" size="sm">Remove</Button>
									</form>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				{#if draft && template.canManage && template.phases.length >= 2}
					<form method="POST" action="?/addTransition" use:enhance class="transition-form">
						<Field id="fromState" label="From" required>
							<select class="nb-control" id="fromState" name="fromState">
								{#each template.phases as phase (phase.phaseKey)}<option value={phase.phaseKey}>{phase.label}</option>{/each}
							</select>
						</Field>
						<Field id="toState" label="To" required>
							<select class="nb-control" id="toState" name="toState">
								{#each template.phases as phase (phase.phaseKey)}<option value={phase.phaseKey}>{phase.label}</option>{/each}
							</select>
						</Field>
						<Field id="transitionLabel" label="Label" required>
							<input class="nb-control" id="transitionLabel" name="label" required />
						</Field>
						<Field id="requiredPermissionKey" label="Required permission">
							<select class="nb-control" id="requiredPermissionKey" name="requiredPermissionKey">
								<option value="">None</option>
								{#each data.referenceData.permissions as permission (permission.key)}
									<option value={permission.key}>{permission.key}</option>
								{/each}
							</select>
						</Field>
						<Field id="workflowKey" label="Workflow hook">
							<input class="nb-control" id="workflowKey" name="workflowKey" placeholder="Optional work-kernel process key" />
						</Field>
						<Field id="tone" label="Tone">
							<select class="nb-control" id="tone" name="tone"><option value="default">Default</option><option value="danger">Danger</option></select>
						</Field>
						<div class="full transition-options">
							<label class="check"><input type="checkbox" name="requiresNote" /> Require rationale / note</label>
							<label class="check"><input type="checkbox" name="requiresTargetReference" /> Require canonical target reference</label>
							<Button type="submit" variant="secondary" size="sm">Add transition</Button>
						</div>
					</form>
				{/if}
			</Panel>

			{#if advanced}
				<Panel
					title="Lifecycle roles and phase-scoped access"
					description="Advanced lifecycle grants are contextual and additive. Explicit member denies and tenant security remain authoritative."
				>
					{#if template.roles.length === 0}
						<EmptyState title="No lifecycle roles" description="Define roles such as Author, Reviewer or Approver, then map organisation roles to them." />
					{:else}
						<div class="role-grid">
							{#each template.roles as role (role.roleKey)}
								<div class="role-card">
									<div class="role-heading"><strong>{role.label}</strong><span>{role.roleKey}</span></div>
									{#if role.description}<p>{role.description}</p>{/if}
									<div class="chips">
										{#each role.organisationRoles as organisationRole (`${role.roleKey}-${organisationRole.publicId}`)}
											<form method="POST" action="?/unbindRole" use:enhance class="chip-form">
												<input type="hidden" name="lifecycleRoleKey" value={role.roleKey} />
												<input type="hidden" name="organisationRolePublicId" value={organisationRole.publicId} />
												<span>{organisationRole.name}</span>
												{#if draft && template.canManage}<button type="submit" aria-label={`Remove ${organisationRole.name}`}>×</button>{/if}
											</form>
										{/each}
									</div>
									{#if draft && template.canManage}
										<form method="POST" action="?/bindRole" use:enhance class="compact-form">
											<input type="hidden" name="lifecycleRoleKey" value={role.roleKey} />
											<select class="nb-control" name="organisationRolePublicId" aria-label={`Map organisation role to ${role.label}`}>
												{#each data.referenceData.organisationRoles as organisationRole (organisationRole.publicId)}
													<option value={organisationRole.publicId}>{organisationRole.name}</option>
												{/each}
											</select>
											<Button type="submit" variant="secondary" size="sm">Map role</Button>
										</form>
										<form method="POST" action="?/deleteRole" use:enhance>
											<input type="hidden" name="roleKey" value={role.roleKey} />
											<Button type="submit" variant="danger" size="sm">Remove lifecycle role</Button>
										</form>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if draft && template.canManage}
						<form method="POST" action="?/addRole" use:enhance class="inline-form role-create">
							<input class="nb-control" name="roleKey" placeholder="role.key" aria-label="Lifecycle role key" required />
							<input class="nb-control" name="label" placeholder="Role label" aria-label="Lifecycle role label" required />
							<input class="nb-control" name="description" placeholder="Description" aria-label="Lifecycle role description" />
							<Button type="submit" variant="secondary" size="sm">Add lifecycle role</Button>
						</form>
					{/if}

					<div class="subsection">
						<h3>Phase access rules</h3>
						{#if template.accessRules.length === 0}
							<p class="muted">No contextual phase grants have been defined.</p>
						{:else}
							<div class="record-list compact">
								{#each template.accessRules as rule (rule.id)}
									<div class="record-row">
										<span><strong>{rule.phaseKey}</strong> · {rule.roleKey} → {rule.permissionKey}</span>
										{#if draft && template.canManage}
											<form method="POST" action="?/deleteAccessRule" use:enhance>
												<input type="hidden" name="ruleId" value={rule.id} />
												<Button type="submit" variant="danger" size="sm">Remove</Button>
											</form>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						{#if draft && template.canManage && template.roles.length > 0}
							<form method="POST" action="?/addAccessRule" use:enhance class="access-form">
								<select class="nb-control" name="phaseKey" aria-label="Lifecycle phase">
									{#each template.phases as phase (phase.phaseKey)}<option value={phase.phaseKey}>{phase.label}</option>{/each}
								</select>
								<select class="nb-control" name="roleKey" aria-label="Lifecycle role">
									{#each template.roles as role (role.roleKey)}<option value={role.roleKey}>{role.label}</option>{/each}
								</select>
								<select class="nb-control" name="permissionKey" aria-label="Permission">
									{#each data.referenceData.permissions as permission (permission.key)}<option value={permission.key}>{permission.key}</option>{/each}
								</select>
								<Button type="submit" variant="secondary" size="sm">Add phase grant</Button>
							</form>
						{/if}
					</div>
				</Panel>
			{/if}
		</main>

		<aside class="stack">
			<Panel
				title="Version control"
				description="Minor versions are working definitions; publishing creates an immutable major version and activates the object binding."
			>
				<div class="version-current">
					<strong>Version {template.versionLabel}</strong>
					<StatusBadge label={template.status} tone={statusTone(template.status)} />
				</div>
				<div class="action-stack">
					{#if draft && template.canPublish}
						<form method="POST" action="?/publish" use:enhance>
							<Button type="submit">Publish major version</Button>
						</form>
					{/if}
					{#if published && template.canManage}
						<form method="POST" action="?/revise" use:enhance>
							<Button type="submit">Create controlled revision</Button>
						</form>
					{/if}
					{#if published && template.canPublish && !template.isActiveBinding}
						<form method="POST" action="?/activate" use:enhance>
							<Button type="submit" variant="secondary">Make active for {template.objectType}</Button>
						</form>
					{/if}
				</div>

				<div class="version-history">
					<h3>Version history</h3>
					{#if template.versionHistory.length === 0}
						<p class="muted">No governed version evidence yet.</p>
					{:else}
						{#each template.versionHistory as item (`${item.label}-${item.createdAt}`)}
							<div class="history-row">
								<strong>v{item.label}</strong>
								<span>{item.status}</span>
								<small>{new Date(item.createdAt).toLocaleString()}</small>
								{#if item.changeNote}<p>{item.changeNote}</p>{/if}
							</div>
						{/each}
					{/if}
				</div>
			</Panel>

			{#if draft && template.canManage}
				<Panel
					title="Discard working revision"
					description="Discard removes only the editable draft. Governed version evidence remains in history."
				>
					<form method="POST" action="?/discard" use:enhance class="action-stack">
						<Field id="confirmation" label="Type DISCARD to confirm" required>
							<input class="nb-control" id="confirmation" name="confirmation" required />
						</Field>
						<Button type="submit" variant="danger">Discard working revision</Button>
					</form>
				</Panel>
			{/if}
		</aside>
	</div>
</div>

<style>
	.lifecycle-detail {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.summary-row,
	.record-meta,
	.chips {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
	}
	.summary-row {
		margin: calc(var(--nb-space-2) * -1) 0 var(--nb-space-5);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
	}
	.summary-row span + span::before,
	.record-meta span + span::before {
		content: '•';
		margin-right: var(--nb-space-2);
	}
	.governance-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 390px);
		gap: var(--nb-space-6);
		align-items: start;
		margin-top: var(--nb-space-6);
	}
	.stack,
	.record-list,
	.role-grid,
	.action-stack,
	.version-history {
		display: grid;
		gap: var(--nb-space-4);
	}
	.form-grid,
	.transition-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}
	.full {
		grid-column: 1 / -1;
	}
	.definition-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-4);
		margin: 0;
	}
	.definition-list div {
		display: grid;
		gap: var(--nb-space-1);
	}
	.definition-list dt,
	.record-meta,
	.role-heading span,
	.muted,
	.history-row small {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
	}
	.definition-list dd {
		margin: 0;
		font-weight: var(--nb-weight-semibold);
	}
	.record-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-4);
		padding: var(--nb-space-3) 0;
		border-bottom: 1px solid var(--nb-color-border-subtle);
	}
	.record-list.compact .record-row {
		padding: var(--nb-space-2) 0;
	}
	.inline-form,
	.access-form,
	.compact-form,
	.transition-options {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
		margin-top: var(--nb-space-4);
	}
	.inline-form .nb-control {
		flex: 1 1 145px;
	}
	.inline-form .order {
		flex: 0 0 92px;
	}
	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--nb-space-1);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
	}
	.role-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.role-card {
		display: grid;
		gap: var(--nb-space-3);
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
	}
	.role-card p {
		margin: 0;
		color: var(--nb-color-text-secondary);
	}
	.role-heading {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-2);
	}
	.chip-form {
		display: inline-flex;
		align-items: center;
		gap: var(--nb-space-1);
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--nb-color-bg-subtle);
		font-size: var(--nb-font-size-xs);
	}
	.chip-form button {
		border: 0;
		background: transparent;
		cursor: pointer;
	}
	.subsection {
		margin-top: var(--nb-space-6);
	}
	.subsection h3,
	.version-history h3 {
		margin: 0 0 var(--nb-space-3);
		font-size: var(--nb-font-size-sm);
	}
	.access-form .nb-control {
		flex: 1 1 170px;
	}
	.version-current {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-3);
		margin-bottom: var(--nb-space-4);
	}
	.history-row {
		display: grid;
		grid-template-columns: auto auto 1fr;
		gap: var(--nb-space-1) var(--nb-space-2);
		padding-top: var(--nb-space-3);
		border-top: 1px solid var(--nb-color-border-subtle);
		font-size: var(--nb-font-size-sm);
	}
	.history-row small {
		text-align: right;
	}
	.history-row p {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--nb-color-text-secondary);
	}
	@media (max-width: 1050px) {
		.governance-grid,
		.role-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 720px) {
		.form-grid,
		.transition-form,
		.definition-list {
			grid-template-columns: 1fr;
		}
		.full {
			grid-column: auto;
		}
	}
</style>
