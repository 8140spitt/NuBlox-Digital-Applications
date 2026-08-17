<script lang="ts">
	let { data, form } = $props();

	function date(value: Date | string | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
	}

	function money(value: string, currency: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(value));
	}
</script>

<svelte:head><title>Collections automation · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/finance/collections">Collections</a><span>/</span><span>Automation</span></nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Controlled collections</p>
		<h1>Automation policy</h1>
		<p>Generate due reminders from live aged receivables, then dispatch them explicitly with delivery-attempt evidence.</p>
	</div>
	<a class="button secondary" href="/finance/collections">Collections portfolio</a>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="panel">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Active policy</p>
			<h2>{data.activePolicy ? `${data.activePolicy.name} · v${data.activePolicy.versionNumber}` : 'No active policy'}</h2>
			<p class="muted">Activated policy versions are immutable. Changes are prepared in a new draft and activated explicitly.</p>
		</div>
		{#if data.activePolicy}<span class="status active">active</span>{/if}
	</div>
	{#if data.activePolicy}
		<div class="stage-list">
			{#each data.activePolicy.stages as stage}
				<article class="stage-row"><strong>{stage.sequenceNumber}. {stage.name}</strong><span>{stage.triggerDaysOverdue}+ days overdue</span><small>Email · disputes {stage.suppressOnOpenDispute ? 'suppress' : 'do not suppress'} · current promises {stage.suppressOnCurrentPromise ? 'suppress' : 'do not suppress'}</small></article>
			{/each}
		</div>
	{:else}<p class="muted">Create and activate a policy before reminder candidates can be generated.</p>{/if}
</section>

{#if data.canManagePolicy}
	<section class="panel">
		<div class="section-heading"><div><p class="eyebrow">Policy authoring</p><h2>{data.draftPolicy ? `${data.draftPolicy.name} · draft v${data.draftPolicy.versionNumber}` : 'Create draft policy'}</h2></div>{#if data.draftPolicy}<span class="status">draft</span>{/if}</div>
		{#if !data.draftPolicy}
			<form method="POST" action="?/createDraft" class="inline-form"><label>Policy name<input name="name" required maxlength="160" value="Collections policy"/></label><button type="submit">Create draft</button></form>
		{:else}
			<div class="draft-grid">
				{#each data.draftPolicy.stages as stage}
					<form method="POST" action="?/saveStage" class="stage-form">
						<input type="hidden" name="policyPublicId" value={data.draftPolicy.publicId}/><input type="hidden" name="stagePublicId" value={stage.publicId}/>
						<label>Sequence<input type="number" name="sequenceNumber" min="1" max="100" value={stage.sequenceNumber} required/></label>
						<label>Stage name<input name="name" maxlength="160" value={stage.name} required/></label>
						<label>Days overdue<input type="number" name="triggerDaysOverdue" min="1" max="3650" value={stage.triggerDaysOverdue} required/></label>
						<label class="wide">Subject template<input name="subjectTemplate" maxlength="255" value={stage.subjectTemplate} required/></label>
						<label class="wide">Body template<textarea name="bodyTemplate" rows="5" required>{stage.bodyTemplate}</textarea></label>
						<label class="check"><input type="checkbox" name="suppressOnOpenDispute" checked={stage.suppressOnOpenDispute}/> Suppress on open dispute</label>
						<label class="check"><input type="checkbox" name="suppressOnCurrentPromise" checked={stage.suppressOnCurrentPromise}/> Suppress on current promise</label>
						<div class="wide form-actions"><button type="submit">Save stage</button><button class="danger" type="submit" formaction="?/deleteStage" name="stagePublicId" value={stage.publicId}>Delete</button></div>
					</form>
				{/each}
				<form method="POST" action="?/saveStage" class="stage-form new-stage">
					<input type="hidden" name="policyPublicId" value={data.draftPolicy.publicId}/>
					<label>Sequence<input type="number" name="sequenceNumber" min="1" max="100" value={data.draftPolicy.stages.length + 1} required/></label>
					<label>Stage name<input name="name" maxlength="160" placeholder="First reminder" required/></label>
					<label>Days overdue<input type="number" name="triggerDaysOverdue" min="1" max="3650" value="7" required/></label>
					<label class="wide">Subject template<input name="subjectTemplate" maxlength="255" value="Payment reminder for {{customer_name}}" required/></label>
					<label class="wide">Body template<textarea name="bodyTemplate" rows="5" required>Hello {{customer_name}},

Our records show {{invoice_count}} invoice(s) are overdue, with the oldest now {{days_overdue}} days overdue as at {{as_of_date}}.

Please contact us if you need to discuss the account.</textarea></label>
					<label class="check"><input type="checkbox" name="suppressOnOpenDispute" checked/> Suppress on open dispute</label>
					<label class="check"><input type="checkbox" name="suppressOnCurrentPromise" checked/> Suppress on current promise</label>
					<div class="wide"><button type="submit">Add stage</button></div>
				</form>
			</div>
			<p class="muted template-help">Supported placeholders: <code>{{customer_name}}</code>, <code>{{account_reference}}</code>, <code>{{days_overdue}}</code>, <code>{{invoice_count}}</code>, <code>{{as_of_date}}</code>.</p>
			<form method="POST" action="?/activatePolicy"><input type="hidden" name="policyPublicId" value={data.draftPolicy.publicId}/><button type="submit">Activate draft policy</button></form>
		{/if}
	</section>
{/if}

<section class="panel">
	<div class="section-heading"><div><p class="eyebrow">As at {data.asOf}</p><h2>Due reminder candidates</h2><p class="muted">A candidate exists only for an open collections case whose live overdue age has reached an active policy stage and has not already generated that stage.</p></div><span>{data.dueReminders.length}</span></div>
	{#if data.dueReminders.length === 0}<p class="muted">No policy reminders are currently due.</p>{:else}
		<div class="stack">{#each data.dueReminders as candidate}<article class="record">
			<div><strong>{candidate.customerDisplayName}</strong><small>{candidate.stageName} · {candidate.maxDaysOverdue} days overdue · {candidate.overdueInvoiceCount} invoice{candidate.overdueInvoiceCount === 1 ? '' : 's'}</small>{#if candidate.recipient}<small>Recipient: {candidate.recipient.displayName} · {candidate.recipient.email}</small>{/if}</div>
			{#if candidate.blockedReasons.length}<ul>{#each candidate.blockedReasons as reason}<li>{reason}</li>{/each}</ul>{/if}
			{#if data.canGenerateReminders && candidate.canGenerate}<form method="POST" action="?/generateReminder"><input type="hidden" name="casePublicId" value={candidate.casePublicId}/><input type="hidden" name="stagePublicId" value={candidate.stagePublicId}/><button type="submit">Generate reminder</button></form>{/if}
		</article>{/each}</div>
	{/if}
</section>

<div class="grid-two">
	<section class="panel">
		<div class="section-heading"><div><p class="eyebrow">Promise monitoring</p><h2>Due / overdue promises</h2></div><span>{data.promiseReviews.length}</span></div>
		{#if data.promiseReviews.length === 0}<p class="muted">No open promises require due-date review.</p>{:else}<div class="stack">{#each data.promiseReviews as promise}<a class="record link-record" href={`/finance/collections/${promise.customerPartyPublicId}`}><div><strong>{promise.customerDisplayName}</strong><small>{money(promise.promisedAmount, promise.currencyCode)} · due {date(promise.dueOn)}</small></div><span class="status">{promise.daysPastDue === 0 ? 'due today' : `${promise.daysPastDue}d overdue`}</span></a>{/each}</div>{/if}
	</section>

	<section class="panel">
		<p class="eyebrow">Delivery boundary</p><h2>Controlled dispatch</h2>
		<p class="muted">Generation never sends a message. Dispatch uses the configured provider-neutral email adapter, records every failed/successful attempt, and revalidates the live overdue position before sending.</p>
		{#if !data.canViewCrm}<p class="warning">CRM viewing authority is required to resolve recipients for new reminders.</p>{/if}
	</section>
</div>

<section class="panel">
	<div class="section-heading"><div><p class="eyebrow">Reminder evidence</p><h2>Generated reminders</h2></div><span>{data.reminders.length}</span></div>
	{#if data.reminders.length === 0}<p class="muted">No reminders have been generated.</p>{:else}<div class="stack">{#each data.reminders as reminder}<article class="record reminder-record">
		<div><strong>{reminder.customerDisplayName} · {reminder.stageName}</strong><small>Policy v{reminder.policyVersionNumber} · generated {date(reminder.generatedAt)} · {reminder.recipientEmail}</small><p>{reminder.subject}</p></div>
		<span class={`status ${reminder.status === 'sent' ? 'active' : ''}`}>{reminder.status}</span>
		{#if reminder.lastAttemptOutcome}<small>Last attempt: {reminder.lastAttemptOutcome} · {date(reminder.lastAttemptAt)}{reminder.lastAttemptError ? ` · ${reminder.lastAttemptError}` : ''}</small>{/if}
		{#if reminder.status === 'pending' && data.canDispatchReminders}<form method="POST" action="?/dispatchReminder"><input type="hidden" name="reminderPublicId" value={reminder.publicId}/><button type="submit">{reminder.attemptCount > 0 ? 'Retry dispatch' : 'Dispatch reminder'}</button></form>{/if}
	</article>{/each}</div>{/if}
</section>

<style>
	.breadcrumbs{display:flex;gap:.45rem;margin-bottom:1rem;font-size:.85rem}.page-heading,.section-heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-heading{margin-bottom:1.2rem}.page-heading h1,.panel h2{margin:.15rem 0}.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.72rem;font-weight:700;color:var(--muted,#667085);margin:0}.panel{border:1px solid var(--border,#d0d5dd);border-radius:14px;background:var(--surface,#fff);padding:1rem;margin-bottom:1rem}.grid-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.stage-list,.stack{display:grid;gap:.65rem;margin-top:.8rem}.stage-row,.record{border:1px solid var(--border,#e4e7ec);border-radius:10px;padding:.8rem;display:grid;gap:.35rem}.draft-grid{display:grid;gap:1rem;margin:1rem 0}.stage-form{display:grid;grid-template-columns:100px 1fr 160px;gap:.7rem;padding:1rem;border:1px solid var(--border,#e4e7ec);border-radius:12px}.stage-form label,.inline-form label{display:grid;gap:.3rem;font-size:.84rem;font-weight:650}.stage-form input,.stage-form textarea,.inline-form input{font:inherit;padding:.6rem;border:1px solid var(--border,#d0d5dd);border-radius:8px;background:white}.wide{grid-column:1/-1}.check{display:flex!important;grid-auto-flow:column;justify-content:start;align-items:center}.check input{width:auto}.form-actions,.inline-form{display:flex;gap:.6rem;align-items:end;flex-wrap:wrap}.inline-form label{min-width:280px}.new-stage{background:var(--surface-subtle,#f8fafc)}.record ul{margin:.3rem 0;padding-left:1.2rem;color:#b54708}.reminder-record{grid-template-columns:minmax(0,1fr) auto;align-items:start}.link-record{text-decoration:none;color:inherit;grid-template-columns:minmax(0,1fr) auto}.status{justify-self:start;text-transform:uppercase;font-size:.72rem;border:1px solid var(--border,#d0d5dd);border-radius:999px;padding:.25rem .5rem}.active{background:#ecfdf3;color:#027a48;border-color:#abefc6}.muted,small{color:var(--muted,#667085)}small{display:block}.template-help code{white-space:nowrap}.button,button{font:inherit;font-weight:700;padding:.62rem .82rem;border-radius:9px;border:0;background:#1d2939;color:white;text-decoration:none;cursor:pointer}.secondary{background:transparent;color:inherit;border:1px solid var(--border,#d0d5dd)}.danger{background:#b42318}.banner{padding:.75rem 1rem;border-radius:9px}.error{color:#b42318;background:#fef3f2}.warning{color:#b54708;background:#fffaeb;padding:.7rem;border-radius:8px}@media(max-width:800px){.page-heading{display:grid}.grid-two{grid-template-columns:1fr}.stage-form{grid-template-columns:1fr}.wide{grid-column:auto}.reminder-record{grid-template-columns:1fr}}
</style>
