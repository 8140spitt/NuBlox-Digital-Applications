<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
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
	import { resolveInternalPath } from '$lib/routing/resolve-path';

	let { data, form } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	const template = $derived(data.template);
	const editable = $derived(template.status === 'draft' && template.canManage);
	let nodes = $state<Array<(typeof data.template.nodes)[number]>>([]);
	let dragKey = $state<string | null>(null);
	let routeFrom = $state<string | null>(null);
	let savingOrder = $state(false);
	let canvasMessage = $state<string | null>(null);
	let canvasError = $state<string | null>(null);

	$effect(() => {
		if (!dragKey && !savingOrder) nodes = [...template.nodes];
	});

	function tone(status: string): 'success' | 'info' | 'warning' | 'neutral' {
		if (status === 'published') return 'success';
		if (status === 'draft') return 'info';
		if (status === 'superseded') return 'warning';
		return 'neutral';
	}

	function outgoing(nodeKey: string) {
		return template.links.filter((link) => link.fromNodeKey === nodeKey);
	}

	function participants(nodeKey: string) {
		return template.participants.filter((participant) => participant.nodeKey === nodeKey);
	}

	function beginDrag(event: DragEvent, nodeKey: string) {
		if (!editable) return;
		dragKey = nodeKey;
		canvasMessage = null;
		canvasError = null;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', nodeKey);
		}
	}

	async function dropBefore(event: DragEvent, targetKey: string) {
		event.preventDefault();
		if (!editable || !dragKey || dragKey === targetKey || targetKey === 'start') return;
		const sourceIndex = nodes.findIndex((node) => node.nodeKey === dragKey);
		let targetIndex = nodes.findIndex((node) => node.nodeKey === targetKey);
		if (sourceIndex < 0 || targetIndex < 0) return;
		const [moving] = nodes.splice(sourceIndex, 1);
		if (sourceIndex < targetIndex) targetIndex -= 1;
		nodes.splice(targetIndex, 0, moving);
		dragKey = null;
		await persistOrder();
	}

	async function persistOrder() {
		savingOrder = true;
		canvasMessage = null;
		canvasError = null;
		try {
			const response = await fetch(
				resolveInternalPath(`${appPath(tenant, 'workflow')}/${template.publicId}/designer-order`),
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ nodeKeys: nodes.map((node) => node.nodeKey) })
				}
			);
			const result = (await response.json()) as { success?: boolean; error?: string };
			if (!response.ok || !result.success) {
				throw new Error(result.error ?? 'Workflow order could not be saved.');
			}
			canvasMessage = 'Design order saved as a governed workflow revision.';
			await invalidateAll();
		} catch (cause) {
			canvasError = cause instanceof Error ? cause.message : 'Workflow order could not be saved.';
			nodes = [...template.nodes];
		} finally {
			savingOrder = false;
		}
	}
</script>

<svelte:head>
	<title>{template.name} · Workflow designer · NuBlox</title>
	<meta name="description" content="Graphically design a governed NuBlox workflow." />
</svelte:head>

<div class="nb-page-wide designer-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Workflow administration', href: appPath(tenant, 'workflow') },
			{
				label: template.name,
				href: resolveInternalPath(`${appPath(tenant, 'workflow')}/${template.publicId}`)
			},
			{ label: 'Designer' }
		]}
	/>
	<PageHeader
		eyebrow={`Graphical workflow designer · v${template.versionLabel}`}
		title={template.name}
		description="Arrange the process visually, connect execution routes and keep detailed governance controls separate from the canvas."
	>
		{#snippet actions()}
			<StatusBadge label={template.status} tone={tone(template.status)} />
			<LinkButton
				href={resolveInternalPath(`${appPath(tenant, 'workflow')}/${template.publicId}`)}
				variant="secondary">Governance settings</LinkButton
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

	{#if form?.formError}<Alert tone="danger" title="Designer change not applied"
			>{form.formError}</Alert
		>{:else if form?.success}<Alert tone="success" title="Workflow updated">{form.success}</Alert
		>{/if}
	{#if canvasError}<Alert tone="danger" title="Design order not saved">{canvasError}</Alert
		>{:else if canvasMessage}<Alert tone="success" title="Design order saved">{canvasMessage}</Alert
		>{/if}

	<div class="designer-status">
		<div><span>Steps</span><strong>{template.nodes.length}</strong></div>
		<div><span>Routes</span><strong>{template.links.length}</strong></div>
		<div><span>Participants</span><strong>{template.participants.length}</strong></div>
		<div><span>Bindings</span><strong>{template.bindings.length}</strong></div>
		{#if savingOrder}<div class="saving"><span>Designer</span><strong>Saving…</strong></div>{/if}
	</div>

	<Panel
		title="Process canvas"
		description={editable
			? 'Drag process steps to reorder the design. Start and End stay fixed. Choose Route from here, then Connect here on another node to create a direct route.'
			: 'This published process is immutable. Create a revision before changing its design.'}
	>
		<div class="canvas-shell">
			<ol class="process-canvas" aria-label="Workflow process design">
				{#each nodes as node, index (node.publicId)}
					<li
						class="canvas-node"
						class:dragging={dragKey === node.nodeKey}
						class:route-source={routeFrom === node.nodeKey}
						ondragover={(event) => editable && event.preventDefault()}
						ondrop={(event) => dropBefore(event, node.nodeKey)}
					>
						{#if index > 0}<div class="flow-arrow" aria-hidden="true">→</div>{/if}
						<article
							class="node-card"
							class:terminal={node.nodeType === 'start' || node.nodeType === 'end'}
						>
							<div class="node-topline">
								<span class="node-type">{node.nodeType.replaceAll('_', ' ')}</span>
								{#if editable && node.nodeType !== 'start' && node.nodeType !== 'end'}
									<button
										class="drag-handle"
										type="button"
										draggable="true"
										ondragstart={(event) => beginDrag(event, node.nodeKey)}
										ondragend={() => (dragKey = null)}
										aria-label={`Drag ${node.label}`}>↕ Drag</button
									>
								{/if}
							</div>
							<strong class="node-label">{node.label}</strong>
							<code>{node.nodeKey}</code>
							<div class="node-facts">
								{#if node.responsibleRoleKey}<span>Role · {node.responsibleRoleKey}</span>{/if}
								{#if node.deadlineMinutes !== null}<span>Due · {node.deadlineMinutes} min</span
									>{/if}
								{#if node.requiresElectronicSignature}<span>E-signature</span>{/if}
							</div>
							{#if participants(node.nodeKey).length > 0}
								<div class="participant-list">
									{#each participants(node.nodeKey) as participant (participant.id)}<span
											>{participant.participantKey}</span
										>{/each}
								</div>
							{/if}
							<div class="outgoing">
								<span class="section-label">Routes</span>
								{#if outgoing(node.nodeKey).length === 0}<span class="muted">None</span
									>{:else}{#each outgoing(node.nodeKey) as link (link.publicId)}<span
											class="route-chip"
											>{link.eventKey ? `${link.eventKey} → ` : '→ '}{link.toNodeKey}</span
										>{/each}{/if}
							</div>
							{#if editable && node.nodeType !== 'end'}
								<div class="node-actions">
									{#if routeFrom === node.nodeKey}<Button
											type="button"
											variant="secondary"
											size="sm"
											onclick={() => (routeFrom = null)}>Cancel route</Button
										>{:else}<Button
											type="button"
											variant="secondary"
											size="sm"
											onclick={() => (routeFrom = node.nodeKey)}>Route from here</Button
										>{/if}
									{#if node.nodeType !== 'start'}
										<form method="POST" action="?/deleteNode" use:enhance>
											<input type="hidden" name="nodeKey" value={node.nodeKey} /><Button
												type="submit"
												variant="danger"
												size="sm">Remove</Button
											>
										</form>
									{/if}
								</div>
							{/if}
							{#if editable && routeFrom && routeFrom !== node.nodeKey && node.nodeType !== 'start'}
								<form
									class="connect-target"
									method="POST"
									action="?/addLink"
									use:enhance
									onsubmit={() => (routeFrom = null)}
								>
									<input type="hidden" name="fromNodeKey" value={routeFrom} />
									<input type="hidden" name="toNodeKey" value={node.nodeKey} />
									<input type="hidden" name="displayOrder" value="50" />
									<Button type="submit" size="sm">Connect here</Button>
								</form>
							{/if}
						</article>
					</li>
				{/each}
			</ol>
		</div>
	</Panel>

	{#if editable}
		<div class="authoring-grid">
			<Panel
				title="Add process step"
				description="Add the step on the canvas, then use Governance settings for deadlines, completion rules, electronic signatures and other expert controls."
				padding="spacious"
			>
				<form method="POST" action="?/addNode" use:enhance class="form-stack">
					<Field id="nodeLabel" label="Step label" required
						><input class="nb-control" id="nodeLabel" name="label" required /></Field
					>
					<Field
						id="nodeKey"
						label="Stable key"
						hint="Lowercase key, for example commercial_review."
						required><input class="nb-control" id="nodeKey" name="nodeKey" required /></Field
					>
					<Field id="nodeType" label="Step type" required
						><select class="nb-control" id="nodeType" name="nodeType"
							><option value="activity">Human activity</option><option value="ad_hoc_activity"
								>Ad-hoc activity</option
							><option value="subprocess">Subprocess</option><option value="and">AND gateway</option
							><option value="or">OR gateway</option><option value="threshold"
								>Threshold gateway</option
							><option value="conditional">Conditional router</option><option value="notification"
								>Notification</option
							><option value="timer">Timer</option><option value="checkpoint">Checkpoint</option
							><option value="service">Service action</option><option value="synchronize"
								>Synchronization</option
							><option value="integration">Integration</option></select
						></Field
					>
					<input type="hidden" name="displayOrder" value="80" />
					<Button type="submit">Add to canvas</Button>
				</form>
			</Panel>

			<Panel
				title="Route editor"
				description="Use direct Connect here for a simple path. Use this editor when a route needs a named event, loop or predecessor termination."
				padding="spacious"
			>
				<form method="POST" action="?/addLink" use:enhance class="form-stack">
					<div class="two-fields">
						<Field id="routeFrom" label="From" required
							><select class="nb-control" id="routeFrom" name="fromNodeKey" required
								>{#each nodes.filter((node) => node.nodeType !== 'end') as node (node.publicId)}<option
										value={node.nodeKey}>{node.label}</option
									>{/each}</select
							></Field
						>
						<Field id="routeTo" label="To" required
							><select class="nb-control" id="routeTo" name="toNodeKey" required
								>{#each nodes.filter((node) => node.nodeType !== 'start') as node (node.publicId)}<option
										value={node.nodeKey}>{node.label}</option
									>{/each}</select
							></Field
						>
					</div>
					<Field
						id="eventKey"
						label="Routing event"
						hint="Optional, for example approve, reject or return."
						><input class="nb-control" id="eventKey" name="eventKey" /></Field
					>
					<div class="checks">
						<label><input type="checkbox" name="loop" /> Loop route</label><label
							><input type="checkbox" name="terminateOpenPredecessors" /> Terminate unneeded predecessors</label
						>
					</div>
					<input type="hidden" name="displayOrder" value="50" />
					<Button type="submit">Add route</Button>
				</form>
			</Panel>
		</div>
	{/if}

	<Panel
		title="Route inspector"
		description="The executable graph is explicit. Removing a route changes the draft only and is recorded as a governed minor version."
	>
		{#if template.links.length === 0}<EmptyState
				title="No routes"
				description="Connect Start to the process and ensure every valid branch can reach End before publication."
			/>{:else}<div class="route-table">
				{#each template.links as link (link.publicId)}<div>
						<div>
							<strong>{link.fromNodeKey}</strong><span>→</span><strong>{link.toNodeKey}</strong
							>{#if link.eventKey}<code>{link.eventKey}</code>{/if}{#if link.loop}<span>Loop</span
								>{/if}
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
	</Panel>
</div>

<style>
	.designer-page {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.designer-status {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
		margin: var(--nb-space-5) 0;
	}
	.designer-status > div {
		display: flex;
		align-items: baseline;
		gap: var(--nb-space-2);
		min-width: 110px;
		padding: var(--nb-space-2) var(--nb-space-3);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.designer-status span {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
	}
	.canvas-shell {
		overflow-x: auto;
		padding: var(--nb-space-2) 0 var(--nb-space-4);
	}
	.process-canvas {
		display: flex;
		align-items: stretch;
		gap: 42px;
		min-width: max-content;
		margin: 0;
		padding: var(--nb-space-3);
		list-style: none;
	}
	.canvas-node {
		position: relative;
		width: 250px;
		min-height: 300px;
		transition:
			transform 0.12s ease,
			opacity 0.12s ease;
	}
	.canvas-node.dragging {
		opacity: 0.45;
		transform: scale(0.98);
	}
	.canvas-node.route-source .node-card {
		outline: 2px solid var(--nb-color-action-primary);
		outline-offset: 2px;
	}
	.flow-arrow {
		position: absolute;
		left: -34px;
		top: 68px;
		color: var(--nb-color-text-muted);
		font-size: 24px;
	}
	.node-card {
		position: relative;
		display: grid;
		align-content: start;
		gap: var(--nb-space-2);
		height: 100%;
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
		box-shadow: var(--nb-shadow-xs);
	}
	.node-card.terminal {
		background: var(--nb-color-bg-subtle);
	}
	.node-topline,
	.node-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nb-space-2);
	}
	.node-type,
	.section-label {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.drag-handle {
		border: 0;
		background: transparent;
		color: var(--nb-color-action-primary);
		font: inherit;
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		cursor: grab;
	}
	.drag-handle:active {
		cursor: grabbing;
	}
	.node-label {
		font-size: var(--nb-font-size-lg);
	}
	.node-facts,
	.participant-list,
	.outgoing {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nb-space-1);
	}
	.node-facts span,
	.participant-list span,
	.route-chip {
		padding: 3px 7px;
		border-radius: var(--nb-radius-sm);
		background: var(--nb-color-bg-subtle);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-xs);
	}
	.outgoing {
		margin-top: var(--nb-space-2);
		padding-top: var(--nb-space-2);
		border-top: 1px solid var(--nb-color-border-subtle);
	}
	.node-actions {
		margin-top: auto;
		padding-top: var(--nb-space-3);
		align-items: flex-end;
	}
	.connect-target {
		margin-top: var(--nb-space-2);
		padding: var(--nb-space-2);
		border: 1px dashed var(--nb-color-action-primary);
		border-radius: var(--nb-radius-md);
		text-align: center;
	}
	.authoring-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-5);
		margin: var(--nb-space-5) 0;
		align-items: start;
	}
	.form-stack {
		display: grid;
		gap: var(--nb-space-3);
	}
	.two-fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-3);
	}
	.checks {
		display: grid;
		gap: var(--nb-space-2);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
	}
	.checks label {
		display: flex;
		align-items: center;
		gap: var(--nb-space-2);
	}
	.route-table {
		display: grid;
		gap: var(--nb-space-2);
	}
	.route-table > div {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--nb-space-3);
		padding: var(--nb-space-3);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
	}
	.route-table > div > div {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--nb-space-2);
	}
	.muted {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
	}
	code {
		overflow-wrap: anywhere;
	}
	@media (max-width: 880px) {
		.authoring-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 620px) {
		.two-fields {
			grid-template-columns: 1fr;
		}
		.route-table > div {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
