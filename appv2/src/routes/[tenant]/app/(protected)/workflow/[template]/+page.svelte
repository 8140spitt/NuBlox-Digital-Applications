<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		Alert,
		Breadcrumbs,
		Button,
		EmptyState,
		Field,
		LinkButton,
		PageHeader,
		Panel,
		StatusBadge
	} from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	const template = $derived(data.template);
	const editable = $derived(template.status === 'draft' && template.canManage);
	let area = $state('design');

	function tone(status: string): 'success' | 'info' | 'warning' | 'neutral' {
		if (status === 'published') return 'success';
		if (status === 'draft') return 'info';
		if (status === 'superseded') return 'warning';
		return 'neutral';
	}
	function participantsFor(nodeKey: string) {
		return template.participants.filter((participant) => participant.nodeKey === nodeKey);
	}
	function outgoing(nodeKey: string) {
		return template.links.filter((link) => link.fromNodeKey === nodeKey);
	}
</script>

<svelte:head>
	<title>{template.name} · Workflow administration · NuBlox</title>
	<meta name="description" content="Design and govern a versioned NuBlox workflow template." />
</svelte:head>

<div class="nb-page-wide workflow-detail">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
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
			<LinkButton href={appPath(tenant, 'workflow/operations')} variant="secondary"
				>Operations</LinkButton
			>
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
		<Alert tone="info" title="Working version"
			>Design changes remain isolated until publication validates the complete graph and freezes the
			major version.</Alert
		>
	{:else if template.status === 'published'}
		<Alert tone="success" title="Published version"
			>This definition is immutable. Create a controlled revision to change its design.</Alert
		>
	{/if}

	<nav class="area-tabs" aria-label="Workflow template areas">
		<button class:active={area === 'design'} type="button" onclick={() => (area = 'design')}
			>Designer</button
		>
		<button class:active={area === 'people'} type="button" onclick={() => (area = 'people')}
			>People & data</button
		>
		<button class:active={area === 'activation'} type="button" onclick={() => (area = 'activation')}
			>Activation</button
		>
		<button class:active={area === 'history'} type="button" onclick={() => (area = 'history')}
			>History</button
		>
	</nav>

	{#if area === 'design'}
		<div class="designer-layout">
			<div class="main-stack">
				<Panel
					title="Process designer"
					description="Read the workflow left-to-right. Routes, not card order, determine execution; each node shows its outgoing path and operational rules."
				>
					<div class="process-canvas" aria-label="Workflow process graph">
						{#each template.nodes as node (node.publicId)}
							<article
								class="node-card"
								class:start-end={node.nodeType === 'start' || node.nodeType === 'end'}
							>
								<div class="node-topline">
									<span class="node-type">{node.nodeType.replaceAll('_', ' ')}</span
									>{#if editable && node.nodeType !== 'start' && node.nodeType !== 'end'}<form
											method="POST"
											action="?/deleteNode"
											use:enhance
										>
											<input type="hidden" name="nodeKey" value={node.nodeKey} /><Button
												type="submit"
												variant="danger"
												size="sm">Remove</Button
											>
										</form>{/if}
								</div>
								<strong>{node.label}</strong><code>{node.nodeKey}</code>
								<div class="node-facts">
									{#if node.responsibleRoleKey}<span>Role · {node.responsibleRoleKey}</span
										>{/if}{#if node.deadlineMinutes !== null}<span
											>Deadline · {node.deadlineMinutes} min</span
										>{/if}{#if node.requiresElectronicSignature}<span>E-signature</span>{/if}
								</div>
								{#if participantsFor(node.nodeKey).length > 0}<div class="participant-chips">
										{#each participantsFor(node.nodeKey) as participant (participant.id)}<span
												>{participant.participantKey}</span
											>{/each}
									</div>{/if}
								<div class="route-chips">
									{#if outgoing(node.nodeKey).length === 0}<span class="muted"
											>No outgoing route</span
										>{:else}{#each outgoing(node.nodeKey) as link (link.publicId)}<span
												>{link.eventKey ? `${link.eventKey} → ` : '→ '}{link.toNodeKey}</span
											>{/each}{/if}
								</div>
							</article>
						{/each}
					</div>
					{#if editable}
						<details class="editor-disclosure">
							<summary>Add process step</summary>
							<form method="POST" action="?/addNode" use:enhance class="editor-form">
								<div class="form-grid">
									<Field id="nodeKey" label="Node key" required
										><input class="nb-control" id="nodeKey" name="nodeKey" required /></Field
									>
									<Field id="nodeLabel" label="Label" required
										><input class="nb-control" id="nodeLabel" name="label" required /></Field
									>
									<Field id="nodeType" label="Step type" required
										><select class="nb-control" id="nodeType" name="nodeType"
											><option value="activity">Activity</option><option value="ad_hoc_activity"
												>Ad-hoc activity</option
											><option value="subprocess">Subprocess</option><option value="block"
												>Block</option
											><option value="and">AND gateway</option><option value="or">OR gateway</option
											><option value="threshold">Threshold gateway</option><option
												value="conditional">Conditional gateway</option
											><option value="notification">Notification</option><option value="timer"
												>Timer</option
											><option value="checkpoint">Checkpoint</option><option value="service"
												>Service action</option
											><option value="synchronize">Synchronize</option><option value="integration"
												>Integration</option
											></select
										></Field
									>
									<Field id="displayOrder" label="Design order" required
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
									<Field id="responsibleRoleKey" label="Responsible role"
										><input
											class="nb-control"
											id="responsibleRoleKey"
											name="responsibleRoleKey"
										/></Field
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
								</div>
								<details class="advanced">
									<summary>Advanced execution controls</summary>
									<div class="form-grid advanced-grid">
										<Field id="completionRuleType" label="Completion rule"
											><select class="nb-control" id="completionRuleType" name="completionRuleType"
												><option value="">Default</option><option value="any">Any</option><option
													value="all">All</option
												><option value="count">Count</option></select
											></Field
										>
										<Field id="completionCount" label="Completion count"
											><input
												class="nb-control"
												id="completionCount"
												name="completionCount"
												type="number"
												min="1"
											/></Field
										>
										<Field
											id="routingEvents"
											label="Routing events"
											hint="Comma-separated event keys."
											><input class="nb-control" id="routingEvents" name="routingEvents" /></Field
										>
										<Field id="deadlineRelativeTo" label="Deadline relative to"
											><select class="nb-control" id="deadlineRelativeTo" name="deadlineRelativeTo"
												><option value="">None</option><option value="node_start">Node start</option
												><option value="process_start">Process start</option></select
											></Field
										>
										<Field id="overdueAction" label="Overdue action"
											><select class="nb-control" id="overdueAction" name="overdueAction"
												><option value="">None</option><option value="notify">Notify</option><option
													value="reassign">Reassign</option
												><option value="skip">Skip</option><option value="complete">Complete</option
												><option value="escalate">Escalate</option><option value="block"
													>Block</option
												></select
											></Field
										>
										<Field id="deadlineResponsibleRoleKey" label="Escalation role"
											><input
												class="nb-control"
												id="deadlineResponsibleRoleKey"
												name="deadlineResponsibleRoleKey"
											/></Field
										>
										<Field id="deadlineNotifyRoleKeys" label="Notify roles"
											><input
												class="nb-control"
												id="deadlineNotifyRoleKeys"
												name="deadlineNotifyRoleKeys"
											/></Field
										>
										<Field id="thresholdCount" label="Threshold"
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
										<Field id="serviceActionKey" label="Service action"
											><input
												class="nb-control"
												id="serviceActionKey"
												name="serviceActionKey"
											/></Field
										>
										<Field id="integrationKey" label="Integration"
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
											><input type="checkbox" name="requiresElectronicSignature" /> Electronic signature</label
										><label
											><input type="checkbox" name="recordVariableChanges" /> Record variable changes</label
										><label><input type="checkbox" name="recordVotes" /> Record votes</label><label
											><input type="checkbox" name="recordReassignments" /> Record reassignments</label
										><label><input type="checkbox" name="abortOnError" /> Abort on error</label
										><label
											><input type="checkbox" name="abortParentOnError" /> Abort parent on error</label
										>
									</div>
								</details>
								<Button type="submit">Add step</Button>
							</form>
						</details>
					{/if}
				</Panel>

				<Panel
					title="Routing"
					description="Connect steps with explicit events. Conditional and quorum behaviour stays typed and kernel-owned."
				>
					{#if template.links.length === 0}<EmptyState
							title="No routes"
							description="Connect Start to the first meaningful step and continue until every executable path reaches End."
						/>{:else}<div class="route-list">
							{#each template.links as link (link.publicId)}<div class="route-row">
									<div>
										<strong>{link.fromNodeKey}</strong><span>→</span><strong
											>{link.toNodeKey}</strong
										>{#if link.eventKey}<code>{link.eventKey}</code>{/if}
									</div>
									{#if editable}<form method="POST" action="?/deleteLink" use:enhance>
											<input type="hidden" name="linkPublicId" value={link.publicId} /><Button
												type="submit"
												variant="danger"
												size="sm">Remove</Button
											>
										</form>{/if}
								</div>{/each}
						</div>{/if}
					{#if editable}<details class="editor-disclosure">
							<summary>Add route</summary>
							<form method="POST" action="?/addLink" use:enhance class="editor-form">
								<div class="form-grid">
									<Field id="fromNodeKey" label="From" required
										><select class="nb-control" id="fromNodeKey" name="fromNodeKey"
											>{#each template.nodes as node (node.publicId)}<option value={node.nodeKey}
													>{node.label}</option
												>{/each}</select
										></Field
									><Field id="toNodeKey" label="To" required
										><select class="nb-control" id="toNodeKey" name="toNodeKey"
											>{#each template.nodes as node (node.publicId)}<option value={node.nodeKey}
													>{node.label}</option
												>{/each}</select
										></Field
									><Field id="eventKey" label="Event"
										><input class="nb-control" id="eventKey" name="eventKey" /></Field
									><Field id="routeDisplayOrder" label="Order"
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
										><input type="checkbox" name="terminateOpenPredecessors" /> Terminate unneeded predecessors</label
									>
								</div>
								<Button type="submit">Add route</Button>
							</form>
						</details>{/if}
				</Panel>
			</div>

			<aside class="side-stack">
				<Panel
					title="Template identity"
					description="Business identity is kept separate from executable process design."
					padding="spacious"
				>
					{#if editable}<form method="POST" action="?/update" use:enhance class="editor-form">
							<Field id="name" label="Name" required
								><input
									class="nb-control"
									id="name"
									name="name"
									value={template.name}
									required
								/></Field
							><Field id="description" label="Purpose"
								><textarea class="nb-control" id="description" name="description"
									>{template.description ?? ''}</textarea
								></Field
							><Button type="submit" variant="secondary">Save details</Button>
						</form>{:else}<div class="facts">
							<span>Template key</span><strong>{template.templateKey}</strong><span>Version</span
							><strong>{template.versionLabel}</strong><span>Status</span><strong
								>{template.status}</strong
							>
						</div>{/if}
				</Panel>
				<Panel
					title="Design readiness"
					description="Publication validates graph integrity before activation."
					padding="spacious"
					><div class="readiness">
						<div><strong>{template.nodes.length}</strong><span>Steps</span></div>
						<div><strong>{template.links.length}</strong><span>Routes</span></div>
						<div><strong>{template.participants.length}</strong><span>Participants</span></div>
						<div><strong>{template.bindings.length}</strong><span>Bindings</span></div>
					</div></Panel
				>
			</aside>
		</div>
	{:else if area === 'people'}
		<div class="people-grid">
			<Panel
				title="Workflow roles"
				description="Process responsibility is explicit and separate from application access permissions."
			>
				{#if template.roles.length === 0}<p class="muted">No workflow roles.</p>{:else}<div
						class="simple-list"
					>
						{#each template.roles as role (role.roleKey)}<div>
								<strong>{role.label}</strong><code>{role.roleKey}</code>{#if role.description}<span
										>{role.description}</span
									>{/if}
							</div>{/each}
					</div>{/if}
				{#if editable}<details class="editor-disclosure">
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
					</details>{/if}
			</Panel>
			<Panel
				title="Participants"
				description="Resolve human work from governed sources such as workflow roles, organisation roles, teams, members or process variables."
			>
				{#if template.participants.length === 0}<p class="muted">
						No participants configured.
					</p>{:else}<div class="simple-list">
						{#each template.participants as participant (participant.id)}<div>
								<strong>{participant.nodeKey}</strong><span
									>{participant.participantType.replaceAll('_', ' ')}</span
								><code>{participant.participantKey}</code><span
									>{participant.required ? 'Required' : 'Optional'}</span
								>
							</div>{/each}
					</div>{/if}
				{#if editable}<details class="editor-disclosure">
						<summary>Add participant</summary>
						<form method="POST" action="?/addParticipant" use:enhance class="editor-form">
							<Field id="participantNodeKey" label="Step" required
								><select class="nb-control" id="participantNodeKey" name="nodeKey"
									>{#each template.nodes as node (node.publicId)}<option value={node.nodeKey}
											>{node.label}</option
										>{/each}</select
								></Field
							><Field id="participantType" label="Participant source" required
								><select class="nb-control" id="participantType" name="participantType"
									><option value="workflow_role">Workflow role</option><option
										value="organisation_role">Organisation role</option
									><option value="lifecycle_role">Lifecycle role</option><option value="member"
										>Member</option
									><option value="team">Team</option><option value="actor">Actor</option><option
										value="variable">Variable</option
									></select
								></Field
							><Field id="participantKey" label="Participant key" required
								><input
									class="nb-control"
									id="participantKey"
									name="participantKey"
									required
								/></Field
							><label class="single-check"
								><input type="checkbox" name="required" checked /> Required participant</label
							><Button type="submit">Add participant</Button>
						</form>
					</details>{/if}
			</Panel>
			<Panel
				title="Process variables"
				description="Typed process data carries context without executable administrator code."
			>
				{#if template.variables.length === 0}<p class="muted">No workflow variables.</p>{:else}<div
						class="simple-list"
					>
						{#each template.variables as variable (variable.variableKey)}<div>
								<strong>{variable.variableKey}</strong><span
									>{variable.variableType} · {variable.variableScope}</span
								>
							</div>{/each}
					</div>{/if}
				{#if editable}<details class="editor-disclosure">
						<summary>Add variable</summary>
						<form method="POST" action="?/addVariable" use:enhance class="editor-form">
							<Field id="variableKey" label="Variable key" required
								><input class="nb-control" id="variableKey" name="variableKey" required /></Field
							>
							<div class="form-grid">
								<Field id="variableType" label="Type" required
									><select class="nb-control" id="variableType" name="variableType"
										><option value="string">String</option><option value="number">Number</option
										><option value="boolean">Boolean</option><option value="date">Date</option
										><option value="json">JSON</option><option value="object_reference"
											>Object reference</option
										></select
									></Field
								><Field id="variableScope" label="Scope" required
									><select class="nb-control" id="variableScope" name="variableScope"
										><option value="process">Process</option><option value="node">Node</option
										></select
									></Field
								>
							</div>
							<div class="check-grid">
								<label><input type="checkbox" name="visible" checked /> Visible</label><label
									><input type="checkbox" name="required" /> Required</label
								><label><input type="checkbox" name="readOnly" /> Read only</label><label
									><input type="checkbox" name="resettable" /> Resettable</label
								>
							</div>
							<Button type="submit">Add variable</Button>
						</form>
					</details>{/if}
			</Panel>
		</div>
	{:else if area === 'activation'}
		<div class="activation-grid">
			<Panel
				title="Business-event bindings"
				description="Bindings activate one immutable published version for a controlled source-domain event."
			>
				{#if template.bindings.length === 0}<EmptyState
						title="No active bindings"
						description="Publish the workflow, then bind it to the business event that should start it."
					/>{:else}<div class="binding-list">
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
					</div>{/if}
				{#if template.status === 'published' && template.canPublish}<details
						class="editor-disclosure"
					>
						<summary>Activate binding</summary>
						<form method="POST" action="?/bind" use:enhance class="editor-form">
							<div class="form-grid">
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
								>
							</div>
							<Field id="bindingEventKey" label="Business event" required
								><input
									class="nb-control"
									id="bindingEventKey"
									name="eventKey"
									placeholder="submit_for_approval"
									required
								/></Field
							><Button type="submit">Activate binding</Button>
						</form>
					</details>{/if}
			</Panel>
			<Panel
				title="Activation rules"
				description="Running work is pinned to the published definition it started with."
				><div class="rule-list">
					<div><strong>Draft</strong><span>Editable, not executable.</span></div>
					<div>
						<strong>Published</strong><span>Immutable and eligible for business-event binding.</span
						>
					</div>
					<div>
						<strong>Revision</strong><span
							>Controlled successor; active bindings move only when the successor is published.</span
						>
					</div>
				</div></Panel
			>
		</div>
	{:else}
		<Panel
			title="Version history"
			description="Every governed draft mutation and publication remains attributable platform evidence."
		>
			<div class="history-list">
				{#each template.versionHistory as version (version.label)}<article>
						<div>
							<strong>v{version.label}</strong><StatusBadge
								label={version.status}
								tone={tone(version.status === 'historical' ? 'superseded' : version.status)}
							/>
						</div>
						<p>{version.changeNote ?? 'Governed version'}</p>
					</article>{/each}
			</div>
		</Panel>
	{/if}
</div>

<style>
	.workflow-detail {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.area-tabs {
		display: flex;
		gap: var(--nb-space-1);
		margin: var(--nb-space-5) 0;
		padding: var(--nb-space-1);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
		overflow-x: auto;
	}
	.area-tabs button {
		border: 0;
		border-radius: var(--nb-radius-sm);
		background: transparent;
		padding: var(--nb-space-2) var(--nb-space-3);
		color: var(--nb-color-text-secondary);
		font: inherit;
		font-weight: var(--nb-weight-semibold);
		cursor: pointer;
		white-space: nowrap;
	}
	.area-tabs button.active {
		background: var(--nb-color-bg-surface);
		color: var(--nb-color-text-primary);
		box-shadow: var(--nb-shadow-xs);
	}
	.designer-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
		gap: var(--nb-space-5);
		align-items: start;
	}
	.main-stack,
	.side-stack,
	.people-grid,
	.activation-grid {
		display: grid;
		gap: var(--nb-space-5);
	}
	.people-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		align-items: start;
	}
	.activation-grid {
		grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
		align-items: start;
	}
	.process-canvas {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--nb-space-3);
	}
	.node-card {
		display: grid;
		align-content: start;
		gap: var(--nb-space-2);
		min-height: 180px;
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.node-card.start-end {
		background: var(--nb-color-bg-subtle);
	}
	.node-topline,
	.route-row,
	.binding-list > div,
	.history-list article > div {
		display: flex;
		justify-content: space-between;
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
	.node-facts,
	.participant-chips,
	.route-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-1);
		font-size: var(--nb-font-size-xs);
	}
	.node-facts span,
	.participant-chips span,
	.route-chips span {
		padding: 3px 7px;
		border-radius: var(--nb-radius-sm);
		background: var(--nb-color-bg-subtle);
		color: var(--nb-color-text-secondary);
	}
	.route-list,
	.simple-list,
	.binding-list,
	.history-list,
	.rule-list {
		display: grid;
		gap: var(--nb-space-3);
	}
	.route-row,
	.simple-list > div,
	.binding-list > div,
	.history-list article,
	.rule-list > div {
		padding: var(--nb-space-3);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.route-row > div {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nb-space-2);
	}
	.simple-list > div,
	.rule-list > div {
		display: grid;
		gap: var(--nb-space-1);
	}
	.binding-list > div > div {
		display: grid;
		gap: 2px;
	}
	.history-list article p {
		margin: var(--nb-space-2) 0 0;
		color: var(--nb-color-text-muted);
	}
	.editor-disclosure {
		margin-top: var(--nb-space-4);
		border-top: 1px solid var(--nb-color-border-subtle);
		padding-top: var(--nb-space-3);
	}
	.editor-disclosure summary,
	.advanced summary {
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
	.advanced {
		padding: var(--nb-space-3);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}
	.advanced-grid {
		margin-top: var(--nb-space-3);
	}
	.check-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-2);
	}
	.check-grid label,
	.single-check {
		display: flex;
		align-items: center;
		gap: var(--nb-space-2);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
	}
	.facts {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--nb-space-2) var(--nb-space-3);
	}
	.facts span,
	.muted,
	.simple-list span,
	.rule-list span {
		color: var(--nb-color-text-muted);
	}
	.readiness {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--nb-space-3);
	}
	.readiness > div {
		display: grid;
		gap: 2px;
	}
	.readiness strong {
		font-size: var(--nb-font-size-xl);
	}
	.readiness span {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
	}
	code {
		overflow-wrap: anywhere;
	}
	@media (max-width: 1100px) {
		.designer-layout,
		.activation-grid {
			grid-template-columns: 1fr;
		}
		.people-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	@media (max-width: 720px) {
		.people-grid,
		.form-grid,
		.check-grid {
			grid-template-columns: 1fr;
		}
		.node-topline,
		.route-row,
		.binding-list > div {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
