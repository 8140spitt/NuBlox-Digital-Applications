<script lang="ts">
	let { data, form } = $props();
	const statusLabels: Record<string, string> = {
		open: 'Open',
		won: 'Won',
		lost: 'Lost',
		cancelled: 'Cancelled'
	};
	const directionLabels: Record<string, string> = {
		inbound: 'Inbound',
		outbound: 'Outbound',
		internal: 'Internal'
	};

	function dateInput(value: Date | string | null): string {
		if (!value) return '';
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
	}

	function money(value: string | null, currency: string): string {
		if (value === null) return 'Not valued';
		const amount = Number(value);
		return Number.isFinite(amount)
			? new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount)
			: `${currency} ${value}`;
	}
</script>

<svelte:head>
	<title>{data.opportunity.title} · Opportunities · NuBlox</title>
</svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/crm">CRM</a>
	<span aria-hidden="true">/</span>
	<a href="/crm/opportunities">Opportunities</a>
	<span aria-hidden="true">/</span>
	<span>{data.opportunity.title}</span>
</nav>

<section class="opportunity-header">
	<div>
		<div class="header-meta">
			<span>{data.opportunity.pipelineName} · {data.opportunity.stageName}</span>
			<span class={`status status-${data.opportunity.status}`}>{statusLabels[data.opportunity.status]}</span>
		</div>
		<h1>{data.opportunity.title}</h1>
		<p>{data.opportunity.primaryPartyDisplayName ?? 'No primary customer'} · {money(data.opportunity.estimatedValue, data.opportunity.currencyCode)}</p>
	</div>
</section>

<div class="workspace-grid">
	<section class="panel summary">
		<p class="eyebrow">Opportunity</p>
		<h2>Commercial snapshot</h2>
		<dl>
			<div><dt>Status</dt><dd>{statusLabels[data.opportunity.status]}</dd></div>
			<div><dt>Stage</dt><dd>{data.opportunity.stageName}</dd></div>
			<div><dt>Probability</dt><dd>{data.opportunity.stageProbabilityPercent ? `${data.opportunity.stageProbabilityPercent}%` : 'Not set'}</dd></div>
			<div><dt>Customer</dt><dd>{data.opportunity.primaryPartyDisplayName ?? 'Not set'}</dd></div>
			<div><dt>Value</dt><dd>{money(data.opportunity.estimatedValue, data.opportunity.currencyCode)}</dd></div>
			<div><dt>Owner</dt><dd>{data.opportunity.ownerDisplayName ?? 'Unassigned'}</dd></div>
			<div><dt>Expected close</dt><dd>{data.opportunity.expectedCloseDate ? new Date(data.opportunity.expectedCloseDate).toLocaleDateString() : 'Not set'}</dd></div>
			<div><dt>Created</dt><dd>{new Date(data.opportunity.createdAt).toLocaleDateString()}</dd></div>
		</dl>
	</section>

	<section class="panel details">
		<p class="eyebrow">Details</p>
		<h2>{data.canManageOpportunities ? 'Maintain opportunity' : 'Opportunity details'}</h2>
		{#if data.canManageOpportunities}
			<form method="POST" action="?/update" class="edit-form">
				<label class="wide"><span>Title</span><input name="title" maxlength="255" required value={data.opportunity.title} /></label>
				<label class="wide"><span>Primary customer</span>
					<select name="primaryPartyPublicId" required>
						{#if data.opportunity.primaryPartyPublicId && !data.partyCandidates.some((party) => party.publicId === data.opportunity.primaryPartyPublicId)}
							<option value={data.opportunity.primaryPartyPublicId} selected>{data.opportunity.primaryPartyDisplayName ?? 'Current customer'} · inactive</option>
						{/if}
						{#each data.partyCandidates as party}
							<option value={party.publicId} selected={party.publicId === data.opportunity.primaryPartyPublicId}>{party.displayName}</option>
						{/each}
					</select>
				</label>
				<label class="wide"><span>Pipeline stage</span>
					<select name="stageSelection" required>
						{#each data.pipelines as pipeline}
							<optgroup label={pipeline.name}>
								{#each pipeline.stages as stage}
									<option value={`${pipeline.publicId}::${stage.name}`} selected={pipeline.publicId === data.opportunity.pipelinePublicId && stage.name === data.opportunity.stageName}>{stage.name}{stage.probabilityPercent ? ` · ${stage.probabilityPercent}%` : ''}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</label>
				<label><span>Status</span>
					<select name="status">
						{#each ['open', 'won', 'lost', 'cancelled'] as status}
							<option value={status} selected={data.opportunity.status === status}>{statusLabels[status]}</option>
						{/each}
					</select>
				</label>
				<label><span>Estimated value</span><input name="estimatedValue" inputmode="decimal" value={data.opportunity.estimatedValue ?? ''} /></label>
				<label><span>Currency</span><input name="currencyCode" maxlength="3" value={data.opportunity.currencyCode} /></label>
				<label><span>Expected close</span><input name="expectedCloseDate" type="date" value={dateInput(data.opportunity.expectedCloseDate)} /></label>
				<label class="wide"><span>Description</span><textarea name="description" rows="5" maxlength="10000">{data.opportunity.description ?? ''}</textarea></label>
				{#if form?.updateError}<p class="error wide" role="alert">{form.updateError}</p>{/if}
				<button type="submit">Save opportunity</button>
			</form>
		{:else}
			<p class="muted">You can view this opportunity but do not hold opportunity-management authority.</p>
			{#if data.opportunity.description}<p class="description">{data.opportunity.description}</p>{/if}
		{/if}
	</section>

	<section id="participants" class="panel full-width">
		<div class="panel-heading">
			<div><p class="eyebrow">Relationships</p><h2>Opportunity parties</h2></div>
			<span class="count">{data.participants.length}</span>
		</div>
		{#if data.participants.length === 0}
			<p class="muted">No CRM parties are linked to this opportunity.</p>
		{:else}
			<div class="participant-list">
				{#each data.participants as participant}
					<div class="participant-row">
						<div>
							<a href={`/crm/${participant.partyPublicId}`}><strong>{participant.displayName}</strong></a>
							<span>{participant.roleName}</span>
						</div>
						{#if participant.isPrimary}<span class="primary-badge">Primary customer</span>{/if}
						{#if data.canManageOpportunities && !participant.isPrimary}
							<form method="POST" action="?/removeParticipant">
								<input type="hidden" name="partyPublicId" value={participant.partyPublicId} />
								<input type="hidden" name="roleCode" value={participant.roleCode} />
								<button class="danger" type="submit">Remove</button>
							</form>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if data.canManageOpportunities}
			<form method="POST" action="?/addParticipant" class="participant-form">
				<label><span>CRM party</span>
					<select name="partyPublicId" required><option value="">Choose party</option>{#each data.partyCandidates as party}<option value={party.publicId}>{party.displayName}</option>{/each}</select>
				</label>
				<label><span>Opportunity role</span>
					<select name="roleCode" required><option value="">Choose role</option>{#each data.partyRoleTypes as role}<option value={role.code}>{role.name}</option>{/each}</select>
				</label>
				<button type="submit">Add participant</button>
			</form>
			{#if form?.participantError}<p class="error" role="alert">{form.participantError}</p>{/if}
		{/if}
	</section>

	<section id="timeline" class="panel full-width timeline-panel">
		<div class="panel-heading">
			<div><p class="eyebrow">CRM activity</p><h2>Activity timeline</h2></div>
			<span class="count">{data.activities.length}</span>
		</div>

		{#if data.canManageActivities}
			<form method="POST" action="?/createActivity" class="activity-form">
				<label><span>Activity type</span>
					<select name="activityTypeCode" required><option value="">Choose type</option>{#each data.activityTypes as type}<option value={type.code}>{type.name}</option>{/each}</select>
				</label>
				<label><span>Direction</span>
					<select name="direction"><option value="">Not applicable</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option><option value="internal">Internal</option></select>
				</label>
				<label class="wide"><span>Subject</span><input name="subject" required maxlength="255" /></label>
				<label class="wide"><span>Notes</span><textarea name="body" rows="4" maxlength="20000"></textarea></label>
				{#if data.participants.length > 0}
					<fieldset class="wide">
						<legend>External participants <small>optional; primary customer is used when none are selected</small></legend>
						<div class="party-checks">
							{#each data.participants as participant}
								<label><input type="checkbox" name="partyPublicId" value={participant.partyPublicId} /> <span>{participant.displayName}</span></label>
							{/each}
						</div>
					</fieldset>
				{/if}
				{#if form?.activityError}<p class="error wide" role="alert">{form.activityError}</p>{/if}
				<button type="submit">Log activity</button>
			</form>
		{/if}

		<div class="timeline">
			{#if data.activities.length === 0}
				<p class="muted">No activity has been logged for this opportunity.</p>
			{:else}
				{#each data.activities as activity}
					<article class="timeline-item">
						<div class="timeline-marker" aria-hidden="true"></div>
						<div class="timeline-content">
							<div class="activity-meta">
								<span>{activity.typeName}</span>
								{#if activity.direction}<span>{directionLabels[activity.direction] ?? activity.direction}</span>{/if}
								<time>{new Date(activity.occurredAt).toLocaleString()}</time>
							</div>
							<h3>{activity.subject}</h3>
							{#if activity.body}<p>{activity.body}</p>{/if}
							<p class="activity-by">Logged by {activity.createdByDisplayName}</p>
							{#if activity.parties.length > 0}
								<div class="activity-parties">
									{#each activity.parties as party}<a href={`/crm/${party.partyPublicId}`}>{party.displayName} · {party.participantRole}</a>{/each}
								</div>
							{/if}
						</div>
					</article>
				{/each}
			{/if}
		</div>
	</section>
</div>

<style>
	.breadcrumbs { display:flex; gap:.55rem; align-items:center; margin-bottom:1rem; color:#666; font-size:.9rem; }
	.breadcrumbs a { color:inherit; font-weight:650; }
	.opportunity-header { margin-bottom:1.25rem; }
	.header-meta { display:flex; align-items:center; gap:.6rem; color:#666; font-size:.82rem; font-weight:650; }
	h1 { margin:.5rem 0 .35rem; font-size:clamp(2rem,5vw,3rem); letter-spacing:-.045em; }
	.opportunity-header p { margin:0; color:#666; }
	.status { font-size:.72rem; font-weight:750; padding:.28rem .48rem; border-radius:999px; background:#ecece7; }
	.status-open { background:#e7efff; color:#234b85; }
	.status-won { background:#e4f5e8; color:#285f35; }
	.status-lost, .status-cancelled { background:#f1ece9; color:#76544a; }
	.workspace-grid { display:grid; grid-template-columns:minmax(17rem,.75fr) minmax(25rem,1.25fr); gap:1rem; align-items:start; }
	.panel { background:white; border:1px solid #d9d9d2; border-radius:.8rem; padding:1.15rem; }
	.full-width { grid-column:1 / -1; }
	.eyebrow { margin:0 0 .3rem; text-transform:uppercase; letter-spacing:.1em; font-size:.72rem; font-weight:760; color:#666; }
	h2, h3 { margin-top:0; }
	dl { display:grid; gap:.72rem; margin:0; }
	dl div { display:grid; grid-template-columns:7rem 1fr; gap:.8rem; }
	dt { color:#666; } dd { margin:0; font-weight:650; overflow-wrap:anywhere; }
	.edit-form, .activity-form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.75rem; }
	label { display:grid; gap:.35rem; font-size:.84rem; font-weight:650; }
	input, select, textarea { min-width:0; font:inherit; border:1px solid #b9b9b1; border-radius:.45rem; padding:.62rem; background:white; }
	textarea { resize:vertical; }
	.wide { grid-column:1 / -1; }
	button { font:inherit; font-weight:750; border:1px solid #111; border-radius:.48rem; padding:.58rem .78rem; background:#111; color:white; cursor:pointer; justify-self:start; }
	.error { color:#941c1c; }
	.muted, .description { color:#666; line-height:1.55; }
	.panel-heading { display:flex; justify-content:space-between; align-items:start; gap:1rem; }
	.count { min-width:2rem; height:2rem; display:grid; place-items:center; border-radius:999px; background:#eee; font-weight:750; }
	.participant-list { display:grid; gap:.5rem; margin-top:.7rem; }
	.participant-row { display:grid; grid-template-columns:1fr auto auto; gap:.75rem; align-items:center; padding:.72rem; border:1px solid #e1e1db; border-radius:.55rem; }
	.participant-row > div { display:grid; gap:.15rem; }
	.participant-row a { color:inherit; } .participant-row span { color:#666; font-size:.82rem; }
	.primary-badge { padding:.25rem .45rem; border-radius:999px; background:#e4f5e8; color:#285f35 !important; font-weight:700; }
	.danger { background:white; border-color:#9b1c1c; color:#8c1b1b; font-size:.78rem; }
	.participant-form { display:grid; grid-template-columns:1fr 1fr auto; gap:.7rem; align-items:end; margin-top:1rem; padding-top:1rem; border-top:1px solid #e5e5df; }
	.activity-form { margin:1rem 0 1.4rem; padding:1rem; border:1px solid #e0e0da; border-radius:.6rem; background:#fafaf7; }
	fieldset { border:1px solid #d9d9d2; border-radius:.5rem; padding:.75rem; }
	legend { padding:0 .3rem; font-size:.84rem; font-weight:700; }
	legend small { font-weight:500; color:#666; }
	.party-checks { display:flex; flex-wrap:wrap; gap:.5rem 1rem; }
	.party-checks label { display:flex; flex-direction:row; align-items:center; gap:.35rem; font-weight:550; }
	.timeline { display:grid; }
	.timeline-item { position:relative; display:grid; grid-template-columns:1.2rem 1fr; gap:.8rem; }
	.timeline-item:not(:last-child)::before { content:''; position:absolute; left:.36rem; top:1rem; bottom:-.4rem; width:1px; background:#d7d7d0; }
	.timeline-marker { width:.72rem; height:.72rem; margin-top:.35rem; border-radius:999px; background:#333; z-index:1; }
	.timeline-content { padding:0 0 1.25rem; }
	.activity-meta { display:flex; flex-wrap:wrap; gap:.4rem .8rem; color:#666; font-size:.78rem; }
	.timeline-content h3 { margin:.32rem 0; }
	.timeline-content > p { white-space:pre-wrap; line-height:1.5; margin:.4rem 0; }
	.activity-by { color:#777; font-size:.8rem; }
	.activity-parties { display:flex; flex-wrap:wrap; gap:.35rem; }
	.activity-parties a { color:#555; font-size:.78rem; text-decoration:none; padding:.24rem .42rem; border-radius:999px; background:#f0f0eb; }
	@media (max-width:900px) { .workspace-grid { grid-template-columns:1fr; } .full-width { grid-column:auto; } }
	@media (max-width:620px) { .edit-form, .activity-form, .participant-form { grid-template-columns:1fr; } .wide { grid-column:auto; } dl div { grid-template-columns:1fr; gap:.1rem; } .participant-row { grid-template-columns:1fr; } }
</style>
