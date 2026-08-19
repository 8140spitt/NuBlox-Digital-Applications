<script lang="ts">
	let { data, form } = $props();

	const formatDateTime = (value: Date | string, timezone: string) =>
		new Intl.DateTimeFormat('en-GB', {
			timeZone: timezone,
			weekday: 'short',
			day: '2-digit',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value));
</script>

<svelte:head>
	<title>Schedule · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Business OS · Delivery planning</p>
		<h1>Schedule</h1>
		<p>
			Planned work stays separate from attendance and claimed time. Project work can only be assigned to workers already staffed to that project.
		</p>
	</div>
	{#if data.currentWorker}
		<div class="identity-card"><span>Your workforce identity</span><strong>{data.currentWorker.displayName}</strong></div>
	{/if}
</section>

{#if form?.error}<p class="error-banner" role="alert">{form.error}</p>{/if}

{#if !data.canView}
	<section class="notice"><h2>Schedule access is not enabled</h2><p>Your current role does not grant schedule visibility.</p></section>
{:else}
	<section class="schedule-layout">
		<div class="timeline-column">
			<section class="panel">
				<div class="section-heading">
					<div><p class="eyebrow">Assigned work</p><h2>{data.canManage ? 'Organisation schedule' : 'My schedule'}</h2></div>
					<span class="count">{data.events.length}</span>
				</div>
				<p class="range">Showing work from {new Date(data.from).toLocaleDateString('en-GB')} to {new Date(data.to).toLocaleDateString('en-GB')}</p>

				{#if data.events.length === 0}
					<div class="empty-state"><h3>No scheduled work in this window</h3><p>{data.canManage ? 'Create an appointment, visit, shift, work session or other planned event.' : 'Assigned work will appear here once a scheduler allocates your workforce record.'}</p></div>
				{:else}
					<div class="timeline">
						{#each data.events as event}
							<article class="event-card">
								<div class="time-rail" aria-label="Event time">
									<strong>{formatDateTime(event.startsAt, event.timezone)}</strong>
									<span>to {formatDateTime(event.endsAt, event.timezone)}</span>
								</div>
								<div class="event-body">
									<div class="event-topline"><span class="event-type">{event.eventTypeName}</span><span class="status">{event.status}</span></div>
									<h3>{event.title}</h3>
									{#if event.projectName}<p class="project-link">Project · {event.projectName}</p>{/if}
									{#if event.description}<p>{event.description}</p>{/if}
									<div class="assignees" aria-label="Assigned workers">
										{#each event.workers as assignment}<span>{assignment.workerName}</span>{/each}
									</div>
								</div>
							</article>
						{/each}
					</div>
				{/if}
			</section>
		</div>

		{#if data.canManage}
			<aside class="side-column">
				<section class="panel create-panel" id="schedule-work">
					<p class="eyebrow">Plan work</p>
					<h2>Schedule work</h2>
					<p class="muted">Use <strong>Work session</strong> for an actionable task/work allocation. Project-linked work enforces prior project staffing.</p>
					<form method="POST" action="?/create" class="stack-form">
						<label>Type<select name="eventTypeCode" required><option value="">Select type</option>{#each data.eventTypes as type}<option value={type.code}>{type.name}</option>{/each}</select></label>
						<label>Title<input name="title" maxlength="255" required /></label>
						<label>Project / job<select name="projectPublicId"><option value="">No project</option>{#each data.projects as project}<option value={project.publicId}>{project.projectNumber} · {project.name}</option>{/each}</select></label>
						<label>Workers<select name="workerPublicIds" multiple size="5" required>{#each data.workers as worker}<option value={worker.publicId}>{worker.displayName}</option>{/each}</select><small>Use Ctrl/Cmd or touch multi-select behavior to assign more than one worker.</small></label>
						<div class="two-up"><label>Starts<input type="datetime-local" name="startsAtLocal" required /></label><label>Ends<input type="datetime-local" name="endsAtLocal" required /></label></div>
						<label>Timezone<input name="timezone" value="Europe/London" maxlength="64" required /></label>
						<label>Description<textarea name="description" rows="3"></textarea></label>
						<button type="submit">Schedule work</button>
					</form>
				</section>
			</aside>
		{/if}
	</section>
{/if}

<style>
	.page-header { display:flex; justify-content:space-between; gap:2rem; align-items:flex-end; margin-bottom:1.5rem; }
	.page-header h1,.section-heading h2,.create-panel h2 { margin:.15rem 0 .35rem; }
	.page-header p { max-width:52rem; margin:.25rem 0 0; color:var(--text-muted); }
	.eyebrow { margin:0; text-transform:uppercase; letter-spacing:.12em; font-size:.72rem; font-weight:800; color:var(--brand-blue); }
	.identity-card { min-width:13rem; padding:.85rem 1rem; border:1px solid var(--border-subtle); border-radius:var(--radius-lg); background:var(--surface-raised); }
	.identity-card span { display:block; color:var(--text-muted); font-size:.75rem; }
	.identity-card strong { display:block; margin-top:.18rem; }
	.error-banner,.notice { padding:1rem 1.1rem; border-radius:var(--radius-md); margin-bottom:1rem; }
	.error-banner { color:var(--danger-strong,#8b1e1e); background:#fff2f1; border:1px solid #efb5b1; }
	.notice { border:1px solid var(--border-subtle); background:var(--surface-raised); }
	.schedule-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(19rem,25rem); gap:1.25rem; align-items:start; }
	.timeline-column,.side-column { min-width:0; }
	.panel { border:1px solid var(--border-subtle); border-radius:var(--radius-lg); background:var(--surface-raised); padding:1.15rem; box-shadow:var(--shadow-sm); }
	.section-heading { display:flex; justify-content:space-between; gap:1rem; align-items:center; }
	.count { display:grid; place-items:center; min-width:2rem; height:2rem; padding:0 .55rem; border-radius:999px; background:var(--surface-accent); font-weight:800; }
	.range,.muted { color:var(--text-muted); }
	.range { margin:.15rem 0 1rem; font-size:.82rem; }
	.timeline { display:grid; gap:.75rem; }
	.event-card { display:grid; grid-template-columns:minmax(9rem,12rem) 1fr; border:1px solid var(--border-subtle); border-radius:var(--radius-md); overflow:hidden; background:var(--surface-base); }
	.time-rail { padding:1rem; background:var(--surface-soft); border-right:1px solid var(--border-subtle); }
	.time-rail strong,.time-rail span { display:block; }
	.time-rail span { margin-top:.25rem; color:var(--text-muted); font-size:.8rem; }
	.event-body { padding:1rem; min-width:0; }
	.event-topline { display:flex; justify-content:space-between; gap:.8rem; align-items:center; }
	.event-type { color:var(--brand-blue); font-size:.76rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
	.status { display:inline-flex; width:max-content; border-radius:999px; padding:.2rem .55rem; font-size:.75rem; font-weight:750; background:var(--surface-accent); text-transform:capitalize; }
	.event-body h3 { margin:.35rem 0 .3rem; }
	.event-body p { margin:.3rem 0; color:var(--text-muted); }
	.project-link { font-weight:700; color:var(--text-primary) !important; }
	.assignees { display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.75rem; }
	.assignees span { padding:.3rem .5rem; border-radius:999px; border:1px solid var(--border-subtle); font-size:.78rem; }
	.empty-state { padding:1rem; border-radius:var(--radius-md); background:var(--surface-soft); }
	.empty-state h3 { margin-top:0; }
	.stack-form { display:grid; gap:.8rem; margin-top:1rem; }
	.stack-form label { display:grid; gap:.35rem; font-size:.82rem; font-weight:700; }
	.stack-form input,.stack-form select,.stack-form textarea { width:100%; box-sizing:border-box; border:1px solid var(--border-strong); background:var(--surface-base); color:var(--text-primary); border-radius:var(--radius-sm); padding:.65rem .7rem; font:inherit; }
	.stack-form select[multiple] { padding:.35rem; }
	.stack-form select[multiple] option { padding:.45rem; border-radius:.25rem; }
	.stack-form small { color:var(--text-muted); font-weight:500; }
	.stack-form textarea { resize:vertical; }
	.two-up { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; }
	button { border:0; border-radius:var(--radius-sm); background:var(--brand-blue); color:white; padding:.7rem .85rem; font:inherit; font-weight:800; cursor:pointer; }
	@media (max-width: 980px) { .schedule-layout { grid-template-columns:1fr; } }
	@media (max-width: 700px) { .page-header { display:grid; align-items:start; } .identity-card { width:100%; box-sizing:border-box; } .event-card { grid-template-columns:1fr; } .time-rail { border-right:0; border-bottom:1px solid var(--border-subtle); } .two-up { grid-template-columns:1fr; } .panel { padding:.9rem; } }
</style>
