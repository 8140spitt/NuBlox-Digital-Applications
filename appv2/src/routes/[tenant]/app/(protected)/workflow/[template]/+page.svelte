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
	import { appPath, routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	const template = $derived(data.template);
	const editable = $derived(template.status === 'draft' && template.canManage);

	function tone(status: string): 'success' | 'info' | 'warning' | 'neutral' {
		if (status === 'published') return 'success';
		if (status === 'draft') return 'info';
		if (status === 'superseded') return 'warning';
		return 'neutral';
	}

	function participantsFor(nodeKey: string) {
		return template.participants.filter((participant) => participant.nodeKey === nodeKey);
	}
</script>

<svelte:head>
	<title>{template.name} · Workflow administration · NuBlox</title>
	<meta name="description" content="Govern a versioned NuBlox workflow template." />
</svelte:head>

<div class="nb-page-wide workflow-detail">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Lifecycle administration', href: routes.lifecycle(tenant) },
			{ label: 'Workflow administration', href: appPath(tenant, 'workflow') },
			{ label: template.name }
		]}
	/>

	<PageHeader
		eyebrow={`Workflow · ${template.templateKey} · v${template.versionLabel}`}
		title={template.name}
		description={template.description ?? 'Reusable governed workflow template.'}
	>
		{#snippet actions()}
			<StatusBadge label={template.status} tone={tone(template.status)} />
			{#if template.status === 'draft' && template.canPublish}
				<form method="POST" action="?/publish" use:enhance>
					<Button type="submit">Publish version</Button>
				</form>
			{:else if template.status === 'published' && template.canManage}
				<form method="POST" action="?/revise" use:enhance>
					<Button type="submit" variant="secondary">Create revision</Button>
				</form>
			{/if}
		{/snippet}
	</PageHeader>

	{#if form?.formError}
		<Alert tone="danger" title="Workflow change not applied">{form.formError}</Alert>
	{:else if form?.success}
		<Alert tone="success" title="Workflow updated">{form.success}</Alert>
	{/if}

	{#if template.status === 'draft'}
		<Alert tone="info" title="Working version">
			Changes are recorded as governed minor versions. Publication validates the complete graph
			before this workflow can be bound to business events.
		</Alert>
	{:else if template.status === 'published'}
		<Alert tone="success" title="Published major version">
			This definition is immutable. Create a controlled revision for any structural change; existing
			active bindings move only when the revision is published.
		</Alert>
	{/if}

	<div class="detail-grid">
		<div class="main-stack">
			<Panel
				title="Process graph"
				description="The persisted graph is the executable contract. Node order is for authoring readability; routes determine execution flow."
			>
				<div class="node-list">
					{#each template.nodes as node (node.publicId)}
						<article class="node-card">
							<div class="node-heading">
								<div>
									<span class="node-type">{node.nodeType.replaceAll('_', ' ')}</span>
									<strong>{node.label}</strong>
									<code>{node.nodeKey}</code>
								</div>
								{#if editable && node.nodeType !== 'start' && node.nodeType !== 'end'}
									<form method="POST" action="?/deleteNode" use:enhance>
										<input type="hidden" name="nodeKey" value={node.nodeKey} />
										<Button type="submit" variant="danger" size="sm">Remove</Button>
									</form>
								{/if}
							</div>
							<div class="node-meta">
								{#if node.responsibleRoleKey}<span>Role: {node.responsibleRoleKey}</span>{/if}
								{#if node.completionRuleType}<span
										>Completion: {node.completionRuleType}{node.completionCount
											? ` ${node.completionCount}`
											: ''}</span
									>{/if}
								{#if node.deadlineMinutes !== null}<span>Deadline: {node.deadlineMinutes} min</span
									>{/if}
								{#if node.requiresElectronicSignature}<span>E-signature required</span>{/if}
							</div>
							{#if participantsFor(node.nodeKey).length > 0}
								<div class="participant-row">
									{#each participantsFor(node.nodeKey) as participant (participant.id)}
										<span
											>{participant.participantType}: {participant.participantKey}{participant.required
												? ' · required'
												: ''}</span
										>
									{/each}
								</div>
							{/if}
						</article>
					{/each}
				</div>

				{#if editable}
					<details class="editor-disclosure">
						<summary>Add workflow node</summary>
						<form method="POST" action="?/addNode" use:enhance class="editor-form">
							<div class="form-grid">
								<Field id="nodeKey" label="Node key" required
									><input class="nb-control" id="nodeKey" name="nodeKey" required /></Field
								>
								<Field id="nodeLabel" label="Label" required
									><input class="nb-control" id="nodeLabel" name="label" required /></Field
								>
								<Field id="nodeType" label="Node type" required>
									<select class="nb-control" id="nodeType" name="nodeType">
										<option value="activity">Activity</option>
										<option value="ad_hoc_activity">Ad-hoc activity</option>
										<option value="subprocess">Subprocess</option>
										<option value="block">Block</option>
										<option value="and">AND gateway</option>
										<option value="or">OR gateway</option>
										<option value="threshold">Threshold gateway</option>
										<option value="conditional">Conditional gateway</option>
										<option value="notification">Notification</option>
										<option value="timer">Timer</option>
										<option value="checkpoint">Checkpoint</option>
										<option value="service">Service action</option>
										<option value="synchronize">Synchronize</option>
										<option value="integration">Integration</option>
									</select>
								</Field>
								<Field id="displayOrder" label="Display order" required
									><input
										class="nb-control"
										id="displayOrder"
										name="displayOrder"
										type="number"
										min="0"
										value="50"
										required
									/></Field
								>
								<Field id="responsibleRoleKey" label="Responsible workflow role"
									><input
										class="nb-control"
										id="responsibleRoleKey"
										name="responsibleRoleKey"
									/></Field
								>
								<Field id="completionRuleType" label="Completion rule">
									<select class="nb-control" id="completionRuleType" name="completionRuleType">
										<option value="">Default</option><option value="any">Any</option><option
											value="all">All</option
										><option value="count">Count</option>
									</select>
								</Field>
								<Field id="completionCount" label="Completion count"
									><input
										class="nb-control"
										id="completionCount"
										name="completionCount"
										type="number"
										min="1"
									/></Field
								>
								<Field id="routingEvents" label="Routing events" hint="Comma-separated event keys."
									><input class="nb-control" id="routingEvents" name="routingEvents" /></Field
								>
								<Field id="deadlineMinutes" label="Deadline minutes"
									><input
										class="nb-control"
										id="deadlineMinutes"
										name="deadlineMinutes"
										type="number"
										min="0"
									/></Field
								>
								<Field id="deadlineRelativeTo" label="Deadline relative to">
									<select class="nb-control" id="deadlineRelativeTo" name="deadlineRelativeTo"
										><option value="">None</option><option value="node_start">Node start</option
										><option value="process_start">Process start</option></select
									>
								</Field>
								<Field id="overdueAction" label="Overdue action">
									<select class="nb-control" id="overdueAction" name="overdueAction"
										><option value="">None</option><option value="notify">Notify</option><option
											value="reassign">Reassign</option
										><option value="skip">Skip</option><option value="complete">Complete</option
										><option value="escalate">Escalate</option><option value="block">Block</option
										></select
									>
								</Field>
								<Field id="deadlineResponsibleRoleKey" label="Deadline role"
									><input
										class="nb-control"
										id="deadlineResponsibleRoleKey"
										name="deadlineResponsibleRoleKey"
									/></Field
								>
								<Field
									id="deadlineNotifyRoleKeys"
									label="Deadline notify roles"
									hint="Comma-separated workflow role keys."
									><input
										class="nb-control"
										id="deadlineNotifyRoleKeys"
										name="deadlineNotifyRoleKeys"
									/></Field
								>
								<Field id="thresholdCount" label="Threshold count"
									><input
										class="nb-control"
										id="thresholdCount"
										name="thresholdCount"
										type="number"
										min="1"
									/></Field
								>
								<Field id="subprocessKey" label="Subprocess key"
									><input class="nb-control" id="subprocessKey" name="subprocessKey" /></Field
								>
								<Field id="serviceActionKey" label="Allow-listed service action"
									><input class="nb-control" id="serviceActionKey" name="serviceActionKey" /></Field
								>
								<Field id="integrationKey" label="Integration key"
									><input class="nb-control" id="integrationKey" name="integrationKey" /></Field
								>
								<Field id="timerMinutes" label="Timer minutes"
									><input
										class="nb-control"
										id="timerMinutes"
										name="timerMinutes"
										type="number"
										min="0"
									/></Field
								>
								<Field id="synchronizeEventKey" label="Synchronization event"
									><input
										class="nb-control"
										id="synchronizeEventKey"
										name="synchronizeEventKey"
									/></Field
								>
							</div>
							<div class="check-grid">
								<label
									><input type="checkbox" name="requiresElectronicSignature" /> Require electronic signature</label
								>
								<label
									><input type="checkbox" name="recordVariableChanges" /> Record variable changes</label
								>
								<label><input type="checkbox" name="recordVotes" /> Record votes</label>
								<label
									><input type="checkbox" name="recordReassignments" /> Record reassignments</label
								>
								<label><input type="checkbox" name="abortOnError" /> Abort on error</label>
								<label
									><input type="checkbox" name="abortParentOnError" /> Abort parent on error</label
								>
							</div>
							<Button type="submit">Add node</Button>
						</form>
					</details>
				{/if}
			</Panel>

			<Panel
				title="Routing"
				description="Routes connect nodes and may carry a typed business event. Conditions remain kernel-owned rather than executable administrator code."
			>
				{#if template.links.length === 0}
					<EmptyState
						title="No routes"
						description="Add a route before this workflow can execute beyond its start node."
					/>
				{:else}
					<div class="route-list">
						{#each template.links as link (link.publicId)}
							<div class="route-row">
								<div>
									<strong>{link.fromNodeKey}</strong><span>→</span><strong>{link.toNodeKey}</strong
									>{#if link.eventKey}<code>{link.eventKey}</code>{/if}
								</div>
								{#if editable}
									<form method="POST" action="?/deleteLink" use:enhance>
										<input type="hidden" name="linkPublicId" value={link.publicId} /><Button
											type="submit"
											variant="danger"
											size="sm">Remove</Button
										>
									</form>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
				{#if editable}
					<details class="editor-disclosure">
						<summary>Add route</summary>
						<form method="POST" action="?/addLink" use:enhance class="editor-form compact-form">
							<div class="form-grid">
								<Field id="fromNodeKey" label="From node" required
									><select class="nb-control" id="fromNodeKey" name="fromNodeKey"
										>{#each template.nodes as node (node.publicId)}<option value={node.nodeKey}
												>{node.label} · {node.nodeKey}</option
											>{/each}</select
									></Field
								>
								<Field id="toNodeKey" label="To node" required
									><select class="nb-control" id="toNodeKey" name="toNodeKey"
										>{#each template.nodes as node (node.publicId)}<option value={node.nodeKey}
												>{node.label} · {node.nodeKey}</option
											>{/each}</select
									></Field
								>
								<Field id="eventKey" label="Routing event"
									><input class="nb-control" id="eventKey" name="eventKey" /></Field
								>
								<Field id="routeDisplayOrder" label="Display order"
									><input
										class="nb-control"
										id="routeDisplayOrder"
										name="displayOrder"
										type="number"
										min="0"
										value="50"
									/></Field
								>
							</div>
							<div class="check-grid">
								<label><input type="checkbox" name="loop" /> Loop route</label><label
									><input type="checkbox" name="terminateOpenPredecessors" /> Terminate open predecessors</label
								>
							</div>
							<Button type="submit">Add route</Button>
						</form>
					</details>
				{/if}
			</Panel>

			<Panel
				title="Participants"
				description="Human work resolves participants from explicit governed sources rather than implied access authority."
			>
				{#if template.participants.length === 0}
					<EmptyState
						title="No participants configured"
						description="Activity participants can resolve from members, teams, organisation roles, lifecycle roles, workflow roles, the initiating actor or governed variables."
					/>
				{:else}
					<div class="simple-list">
						{#each template.participants as participant (participant.id)}<div>
								<strong>{participant.nodeKey}</strong><span>{participant.participantType}</span
								><code>{participant.participantKey}</code><span
									>{participant.required ? 'Required' : 'Optional'}</span
								>
							</div>{/each}
					</div>
				{/if}
				{#if editable && template.nodes.length > 0}
					<details class="editor-disclosure">
						<summary>Add participant</summary>
						<form
							method="POST"
							action="?/addParticipant"
							use:enhance
							class="editor-form compact-form"
						>
							<div class="form-grid">
								<Field id="participantNodeKey" label="Node" required
									><select class="nb-control" id="participantNodeKey" name="nodeKey"
										>{#each template.nodes as node (node.publicId)}<option value={node.nodeKey}
												>{node.label} · {node.nodeKey}</option
											>{/each}</select
									></Field
								>
								<Field id="participantType" label="Participant source" required
									><select class="nb-control" id="participantType" name="participantType"
										><option value="workflow_role">Workflow role</option><option
											value="organisation_role">Organisation role</option
										><option value="lifecycle_role">Lifecycle role</option><option value="member"
											>Member</option
										><option value="team">Team</option><option value="actor">Actor</option><option
											value="variable">Variable</option
										></select
									></Field
								>
								<Field id="participantKey" label="Participant key" required
									><input
										class="nb-control"
										id="participantKey"
										name="participantKey"
										required
									/></Field
								>
							</div>
							<label class="single-check"
								><input type="checkbox" name="required" checked /> Required participant</label
							>
							<Button type="submit">Add participant</Button>
						</form>
					</details>
				{/if}
			</Panel>
		</div>

		<aside class="side-stack">
			<Panel
				title="Template control"
				description="Identity and version metadata are kept separate from the executable graph."
				padding="spacious"
			>
				{#if editable}
					<form method="POST" action="?/update" use:enhance class="editor-form">
						<Field id="name" label="Name" required
							><input
								class="nb-control"
								id="name"
								name="name"
								value={template.name}
								required
							/></Field
						>
						<Field id="description" label="Description"
							><textarea class="nb-control" id="description" name="description"
								>{template.description ?? ''}</textarea
							></Field
						>
						<Button type="submit" variant="secondary">Save details</Button>
					</form>
				{:else}
					<div class="control-facts">
						<span>Template key</span><strong>{template.templateKey}</strong><span>Version</span
						><strong>{template.versionLabel}</strong><span>Status</span><strong
							>{template.status}</strong
						>
					</div>
				{/if}
			</Panel>

			<Panel
				title="Workflow roles"
				description="Workflow roles express process responsibility. They do not grant NuBlox access permissions."
				padding="spacious"
			>
				{#if template.roles.length > 0}<div class="simple-list role-list">
						{#each template.roles as role (role.roleKey)}<div>
								<strong>{role.label}</strong><code>{role.roleKey}</code>{#if role.description}<span
										>{role.description}</span
									>{/if}
							</div>{/each}
					</div>{:else}<p class="muted">No workflow roles.</p>{/if}
				{#if editable}
					<details class="editor-disclosure">
						<summary>Add workflow role</summary>
						<form method="POST" action="?/addRole" use:enhance class="editor-form">
							<Field id="roleKey" label="Role key" required
								><input class="nb-control" id="roleKey" name="roleKey" required /></Field
							><Field id="roleLabel" label="Label" required
								><input class="nb-control" id="roleLabel" name="label" required /></Field
							><Field id="roleDescription" label="Description"
								><textarea class="nb-control" id="roleDescription" name="description"
								></textarea></Field
							><Button type="submit">Add role</Button>
						</form>
					</details>
				{/if}
			</Panel>

			<Panel
				title="Variables"
				description="Typed process and node variables carry governed workflow context."
				padding="spacious"
			>
				{#if template.variables.length > 0}<div class="simple-list">
						{#each template.variables as variable (variable.variableKey)}<div>
								<strong>{variable.variableKey}</strong><span
									>{variable.variableType} · {variable.variableScope}</span
								>
							</div>{/each}
					</div>{:else}<p class="muted">No workflow variables.</p>{/if}
				{#if editable}
					<details class="editor-disclosure">
						<summary>Add variable</summary>
						<form method="POST" action="?/addVariable" use:enhance class="editor-form">
							<Field id="variableKey" label="Variable key" required
								><input class="nb-control" id="variableKey" name="variableKey" required /></Field
							><Field id="variableType" label="Type" required
								><select class="nb-control" id="variableType" name="variableType"
									><option value="string">String</option><option value="number">Number</option
									><option value="boolean">Boolean</option><option value="date">Date</option><option
										value="json">JSON</option
									><option value="object_reference">Object reference</option></select
								></Field
							><Field id="variableScope" label="Scope" required
								><select class="nb-control" id="variableScope" name="variableScope"
									><option value="process">Process</option><option value="node">Node</option
									></select
								></Field
							>
							<div class="check-grid">
								<label><input type="checkbox" name="visible" checked /> Visible</label><label
									><input type="checkbox" name="required" /> Required</label
								><label><input type="checkbox" name="readOnly" /> Read only</label><label
									><input type="checkbox" name="resettable" /> Resettable</label
								>
							</div>
							<Button type="submit">Add variable</Button>
						</form>
					</details>
				{/if}
			</Panel>

			<Panel
				title="Business-event bindings"
				description="A binding activates this published workflow for one source-domain event."
				padding="spacious"
			>
				{#if template.bindings.length > 0}
					<div class="binding-list">
						{#each template.bindings as binding (binding.id)}<div>
								<div>
									<strong>{binding.sourceDomain}</strong><span>{binding.sourceType}</span><code
										>{binding.eventKey}</code
									>
								</div>
								{#if template.canPublish}<form method="POST" action="?/unbind" use:enhance>
										<input type="hidden" name="bindingId" value={binding.id} /><Button
											type="submit"
											variant="danger"
											size="sm">Remove</Button
										>
									</form>{/if}
							</div>{/each}
					</div>
				{:else}<p class="muted">No active bindings.</p>{/if}
				{#if template.status === 'published' && template.canPublish}
					<details class="editor-disclosure">
						<summary>Activate binding</summary>
						<form method="POST" action="?/bind" use:enhance class="editor-form">
							<Field id="sourceDomain" label="Source domain" required
								><input
									class="nb-control"
									id="sourceDomain"
									name="sourceDomain"
									placeholder="strategy"
									required
								/></Field
							><Field id="sourceType" label="Source type" required
								><input
									class="nb-control"
									id="sourceType"
									name="sourceType"
									placeholder="framework"
									required
								/></Field
							><Field id="bindingEventKey" label="Event key" required
								><input
									class="nb-control"
									id="bindingEventKey"
									name="eventKey"
									placeholder="submit_for_approval"
									required
								/></Field
							><Button type="submit">Activate binding</Button>
						</form>
					</details>
				{/if}
			</Panel>

			<Panel
				title="Version history"
				description="Every controlled draft mutation and publication is retained as platform evidence."
				padding="spacious"
			>
				<div class="history-list">
					{#each template.versionHistory as version (version.label)}<div>
							<div>
								<strong>v{version.label}</strong><StatusBadge
									label={version.status}
									tone={tone(version.status === 'historical' ? 'superseded' : version.status)}
								/>
							</div>
							<span>{version.changeNote ?? 'Governed version'}</span>
						</div>{/each}
				</div>
			</Panel>
		</aside>
	</div>
</div>

<style>
	.workflow-detail {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.detail-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
		gap: var(--nb-space-6);
		align-items: start;
		margin-top: var(--nb-space-6);
	}
	.main-stack,
	.side-stack {
		display: grid;
		gap: var(--nb-space-5);
	}
	.node-list,
	.route-list,
	.simple-list,
	.binding-list,
	.history-list {
		display: grid;
		gap: var(--nb-space-3);
	}
	.node-card,
	.route-row,
	.simple-list > div,
	.binding-list > div,
	.history-list > div {
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
		padding: var(--nb-space-3);
	}
	.node-heading,
	.route-row,
	.binding-list > div,
	.history-list > div > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-3);
	}
	.node-heading > div {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nb-space-2);
	}
	.node-type {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.node-meta,
	.participant-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
		margin-top: var(--nb-space-2);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-xs);
	}
	.node-meta span,
	.participant-row span {
		padding: 3px 7px;
		border-radius: var(--nb-radius-sm);
		background: var(--nb-color-bg-subtle);
	}
	.route-row > div {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nb-space-2);
	}
	.simple-list > div {
		display: grid;
		gap: var(--nb-space-1);
	}
	.binding-list > div > div {
		display: grid;
		gap: 2px;
	}
	.history-list > div {
		display: grid;
		gap: var(--nb-space-1);
	}
	.history-list > div > span,
	.muted {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
	}
	.control-facts {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--nb-space-2) var(--nb-space-3);
	}
	.control-facts span {
		color: var(--nb-color-text-muted);
	}
	.editor-disclosure {
		margin-top: var(--nb-space-4);
		border-top: 1px solid var(--nb-color-border-subtle);
		padding-top: var(--nb-space-3);
	}
	.editor-disclosure summary {
		cursor: pointer;
		color: var(--nb-color-action-primary);
		font-weight: var(--nb-weight-semibold);
	}
	.editor-form {
		display: grid;
		gap: var(--nb-space-3);
		margin-top: var(--nb-space-4);
	}
	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-3);
	}
	.check-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-2);
	}
	.check-grid label,
	.single-check {
		display: flex;
		gap: var(--nb-space-2);
		align-items: center;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
	}
	code {
		overflow-wrap: anywhere;
	}
	@media (max-width: 1080px) {
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 720px) {
		.form-grid,
		.check-grid {
			grid-template-columns: 1fr;
		}
		.node-heading,
		.route-row,
		.binding-list > div {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
