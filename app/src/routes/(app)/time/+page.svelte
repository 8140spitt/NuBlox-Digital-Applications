<script lang="ts">
	let { data, form } = $props();

	const dateText = (value: Date | string) => new Date(value).toLocaleDateString('en-GB');
	const hoursText = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
	const canEdit = (status: string) => ['draft', 'rejected', 'reopened'].includes(status);
</script>

<svelte:head>
	<title>Time · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Business OS · Time</p>
		<h1>Time</h1>
		<p>Record time against staffed projects or assigned work, then submit it through a controlled approval lifecycle.</p>
	</div>
	{#if data.currentWorker}
		<div class="identity-card"><span>Recording as</span><strong>{data.currentWorker.displayName}</strong></div>
	{/if}
</section>

{#if form?.error}<p class="error-banner" role="alert">{form.error}</p>{/if}

{#if !data.canView}
	<section class="notice"><h2>Timesheet access is not enabled</h2><p>Your current role does not grant timesheet visibility.</p></section>
{:else}
	<section class="time-layout">
		<div class="main-column">
			<section class="panel" aria-labelledby="my-timesheets-heading">
				<div class="section-heading">
					<div><p class="eyebrow">Personal time</p><h2 id="my-timesheets-heading">My timesheets</h2></div>
					<span class="count">{data.ownTimesheets.length}</span>
				</div>

				{#if !data.currentWorker}
					<div class="empty-state"><h3>No workforce identity linked</h3><p>An authorised workforce manager must link your organisation membership to a worker record before you can record time.</p></div>
				{:else if data.ownTimesheets.length === 0}
					<div class="empty-state"><h3>No timesheets yet</h3><p>Create a period, add time entries and submit when complete.</p></div>
				{:else}
					<div class="timesheet-list">
						{#each data.ownTimesheets as timesheet}
							<article class="timesheet-card">
								<div class="timesheet-heading">
									<div><h3>{dateText(timesheet.periodStart)} → {dateText(timesheet.periodEnd)}</h3><p>{timesheet.entries.length} time {timesheet.entries.length === 1 ? 'entry' : 'entries'}</p></div>
									<span class={`status status-${timesheet.status}`}>{timesheet.status}</span>
								</div>

								{#if timesheet.entries.length > 0}
									<div class="entry-list">
										{#each timesheet.entries as entry}
											<div class="entry-row">
												<div><strong>{dateText(entry.workDate)}</strong><span>{entry.projectName ?? 'General / non-project time'}</span></div>
												<strong>{hoursText(entry.workedMinutes)}</strong>
												<span>{entry.description ?? 'No description'}</span>
											</div>
										{/each}
									</div>
								{/if}

								{#if data.canManageOwn && canEdit(timesheet.status)}
									<details class="entry-form-wrap">
										<summary>Add time entry</summary>
										<form method="POST" action="?/addEntry" class="entry-form">
											<input type="hidden" name="timesheetPublicId" value={timesheet.publicId} />
											<div class="two-up"><label>Work date<input name="workDate" type="date" required /></label><label>Minutes<input name="workedMinutes" type="number" min="1" max="1440" step="1" required /></label></div>
											<label>Project / job<select name="projectPublicId"><option value="">General / non-project</option>{#each data.projectAssignments as assignment}<option value={assignment.projectPublicId}>{assignment.projectNumber} · {assignment.projectName}</option>{/each}</select></label>
											<label>Assigned work<select name="scheduleEventPublicId"><option value="">No schedule event</option>{#each data.assignedScheduleEvents as event}<option value={event.publicId}>{event.title} · {dateText(event.startsAt)}</option>{/each}</select></label>
											<label>Description<input name="description" maxlength="1000" /></label>
											<label class="check"><input type="checkbox" name="isBillable" checked /> Billable time</label>
											<button class="secondary" type="submit">Add time entry</button>
										</form>
									</details>
								{/if}

								{#if data.canSubmitOwn && canEdit(timesheet.status)}
									<form method="POST" action="?/submit" class="submit-row">
										<input type="hidden" name="timesheetPublicId" value={timesheet.publicId} />
										<button type="submit">Submit timesheet</button>
									</form>
								{/if}
							</article>
						{/each}
					</div>
				{/if}
			</section>

			{#if data.canApprove}
				<section class="panel" aria-labelledby="approval-heading">
					<div class="section-heading"><div><p class="eyebrow">Control</p><h2 id="approval-heading">Approval queue</h2></div><span class="count">{data.approvalQueue.length}</span></div>
					{#if data.approvalQueue.length === 0}
						<p class="muted">No submitted timesheets require your approval.</p>
					{:else}
						<div class="approval-list">
							{#each data.approvalQueue as timesheet}
								<article class="approval-card">
									<div class="approval-heading"><div><strong>{timesheet.workerName}</strong><span>{dateText(timesheet.periodStart)} → {dateText(timesheet.periodEnd)}</span></div><span class="status status-submitted">Submitted</span></div>
									<div class="approval-entries">
										{#each timesheet.entries as entry}<p><strong>{dateText(entry.workDate)}</strong> · {hoursText(entry.workedMinutes)} · {entry.projectName ?? 'General'} · {entry.description ?? 'No description'}</p>{/each}
									</div>
									<div class="decision-grid">
										<form method="POST" action="?/approve">
											<input type="hidden" name="timesheetPublicId" value={timesheet.publicId} />
											<label>Approval note<input name="comment" maxlength="1000" /></label>
											<button type="submit">Approve</button>
										</form>
										<form method="POST" action="?/reject">
											<input type="hidden" name="timesheetPublicId" value={timesheet.publicId} />
											<label>Rejection note<input name="comment" maxlength="1000" required /></label>
											<button class="danger" type="submit">Reject</button>
										</form>
									</div>
								</article>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		</div>

		<aside class="side-column">
			{#if data.canManageOwn && data.currentWorker}
				<section class="panel create-panel" id="new-timesheet">
					<p class="eyebrow">New period</p><h2>Create timesheet</h2>
					<p class="muted">Periods cannot overlap and are limited to 31 days.</p>
					<form method="POST" action="?/createTimesheet" class="stack-form">
						<label>Period start<input name="periodStart" type="date" required /></label>
						<label>Period end<input name="periodEnd" type="date" required /></label>
						<button type="submit">Create timesheet</button>
					</form>
				</section>
			{/if}

			<section class="panel scope-panel">
				<p class="eyebrow">Recording scope</p><h2>Available work</h2>
				<dl><div><dt>Staffed projects</dt><dd>{data.projectAssignments.length}</dd></div><div><dt>Assigned schedule events</dt><dd>{data.assignedScheduleEvents.length}</dd></div></dl>
				<p class="muted">Project time is accepted only while your workforce record has an active project resource assignment. Schedule-linked time must reference work assigned to you.</p>
			</section>
		</aside>
	</section>
{/if}

<style>
	.page-header { display:flex; justify-content:space-between; gap:2rem; align-items:flex-end; margin-bottom:1.5rem; }
	.page-header h1,.section-heading h2,.create-panel h2,.scope-panel h2 { margin:.15rem 0 .35rem; }
	.page-header p { max-width:52rem; margin:.25rem 0 0; color:var(--text-muted); }
	.eyebrow { margin:0; text-transform:uppercase; letter-spacing:.12em; font-size:.72rem; font-weight:800; color:var(--brand-blue); }
	.identity-card { min-width:13rem; padding:.85rem 1rem; border:1px solid var(--border-subtle); border-radius:var(--radius-lg); background:var(--surface-raised); }
	.identity-card span { display:block; color:var(--text-muted); font-size:.75rem; }.identity-card strong { display:block; margin-top:.18rem; }
	.error-banner,.notice { padding:1rem 1.1rem; border-radius:var(--radius-md); margin-bottom:1rem; }
	.error-banner { color:var(--danger-strong,#8b1e1e); background:#fff2f1; border:1px solid #efb5b1; }.notice { border:1px solid var(--border-subtle); background:var(--surface-raised); }
	.time-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(18rem,23rem); gap:1.25rem; align-items:start; }
	.main-column,.side-column { display:grid; gap:1.25rem; min-width:0; }
	.panel { border:1px solid var(--border-subtle); border-radius:var(--radius-lg); background:var(--surface-raised); padding:1.15rem; box-shadow:var(--shadow-sm); min-width:0; }
	.section-heading { display:flex; justify-content:space-between; gap:1rem; align-items:center; margin-bottom:1rem; }
	.count { display:grid; place-items:center; min-width:2rem; height:2rem; padding:0 .55rem; border-radius:999px; background:var(--surface-accent); font-weight:800; }
	.muted { color:var(--text-muted); }
	.empty-state { padding:1rem; border-radius:var(--radius-md); background:var(--surface-soft); }.empty-state h3 { margin-top:0; }
	.timesheet-list,.approval-list { display:grid; gap:.85rem; }
	.timesheet-card,.approval-card { border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1rem; background:var(--surface-base); }
	.timesheet-heading,.approval-heading { display:flex; justify-content:space-between; gap:1rem; align-items:start; }.timesheet-heading h3 { margin:0; }.timesheet-heading p,.approval-heading span { margin:.18rem 0 0; color:var(--text-muted); font-size:.82rem; }
	.status { display:inline-flex; width:max-content; border-radius:999px; padding:.2rem .55rem; font-size:.75rem; font-weight:750; background:var(--surface-accent); text-transform:capitalize; }.status-approved { background:#e8f7ef; color:#14633b; }.status-rejected { background:#fff1ef; color:#8b2e26; }.status-submitted { background:#edf4ff; color:#2258a5; }
	.entry-list { display:grid; gap:.35rem; margin-top:.8rem; }
	.entry-row { display:grid; grid-template-columns:minmax(10rem,1fr) auto minmax(10rem,1.2fr); gap:.7rem; align-items:center; padding:.55rem .65rem; border-radius:var(--radius-sm); background:var(--surface-soft); }.entry-row span { color:var(--text-muted); font-size:.8rem; }.entry-row div span { display:block; margin-top:.12rem; }
	.entry-form-wrap { margin-top:.8rem; border-top:1px solid var(--border-subtle); padding-top:.7rem; }.entry-form-wrap summary { cursor:pointer; font-weight:800; color:var(--brand-blue); }
	.entry-form,.stack-form { display:grid; gap:.7rem; margin-top:.75rem; }.entry-form label,.stack-form label,.decision-grid label { display:grid; gap:.3rem; font-size:.8rem; font-weight:700; }
	.entry-form input,.entry-form select,.stack-form input,.decision-grid input { width:100%; box-sizing:border-box; border:1px solid var(--border-strong); background:var(--surface-base); color:var(--text-primary); border-radius:var(--radius-sm); padding:.6rem .65rem; font:inherit; }
	.two-up { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; }.check { display:flex !important; align-items:center; gap:.5rem !important; }.check input { width:auto; }
	button { border:0; border-radius:var(--radius-sm); background:var(--brand-blue); color:white; padding:.65rem .8rem; font:inherit; font-weight:800; cursor:pointer; }.secondary { background:var(--brand-ink); }.danger { background:#8b2e26; }
	.submit-row { display:flex; justify-content:flex-end; margin-top:.85rem; }
	.approval-entries { margin:.8rem 0; padding:.7rem; border-radius:var(--radius-sm); background:var(--surface-soft); }.approval-entries p { margin:.35rem 0; font-size:.83rem; }
	.decision-grid { display:grid; grid-template-columns:1fr 1fr; gap:.7rem; }.decision-grid form { display:grid; gap:.5rem; }
	.scope-panel dl { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; }.scope-panel dl div { padding:.7rem; background:var(--surface-soft); border-radius:var(--radius-sm); }.scope-panel dt { color:var(--text-muted); font-size:.72rem; text-transform:uppercase; }.scope-panel dd { margin:.2rem 0 0; font-size:1.4rem; font-weight:850; }
	@media (max-width: 980px) { .time-layout { grid-template-columns:1fr; }.side-column { grid-template-columns:1fr 1fr; } }
	@media (max-width: 700px) { .page-header { display:grid; align-items:start; }.identity-card { width:100%; box-sizing:border-box; }.side-column,.two-up,.decision-grid { grid-template-columns:1fr; }.entry-row { grid-template-columns:1fr auto; }.entry-row>span { grid-column:1/-1; }.panel { padding:.9rem; } }
</style>
