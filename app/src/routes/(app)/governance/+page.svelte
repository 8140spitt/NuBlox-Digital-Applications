<script lang="ts">
	let { data, form } = $props();

	function dateValue(value: Date | string | null | undefined) {
		if (!value) return '';
		return new Date(value).toISOString().slice(0, 10);
	}

	function dateTimeValue(value: Date | string | null | undefined) {
		if (!value) return '';
		return new Date(value).toISOString().slice(0, 16);
	}

	function label(value: string) {
		return value.replaceAll('_', ' ');
	}

	function memberName(memberId: string | null | undefined) {
		if (!memberId) return 'Unassigned';
		return (
			data.members.find((member) => member.id === memberId)?.display_name ?? `Member ${memberId}`
		);
	}

	function bodyName(bodyId: string) {
		return data.bodies.find((body) => body.id === bodyId)?.title ?? `Body ${bodyId}`;
	}

	function meetingName(meetingId: string) {
		return (
			data.meetings.find((meeting) => meeting.id === meetingId)?.title ?? `Meeting ${meetingId}`
		);
	}

	function decisionForAgenda(agendaId: string) {
		return data.decisions.find((decision) => decision.governance_agenda_item_id === agendaId);
	}

	function policyAttested(policyId: string) {
		return data.policyAttestations.some(
			(attestation) =>
				attestation.governance_policy_id === policyId &&
				attestation.organisation_member_id === data.actorMemberId
		);
	}
</script>

<svelte:head><title>Corporate governance · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/more">More</a><span>/</span><span>Corporate governance</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">F02 · Corporate Governance</p>
		<h1>Corporate governance</h1>
		<p>
			Govern constitutional authority, boards, executives, committees, meetings, decisions, actions,
			policy and ethics as attributable enterprise evidence. Business delegation of authority
			remains separate from NuBlox access permissions.
		</p>
	</div>
	<div class="heading-actions">
		<span class="status-badge">VS3 Strategy-to-performance</span>
		<span class="status-badge">VS9 Risk-to-assurance</span>
		<span class="status-badge">D1 + D19 + D14</span>
	</div>
</section>

{#if form?.error}
	<section class="notice error" role="alert">{form.error}</section>
{/if}

{#if data.frameworks.length}
	<section class="panel version-strip">
		<div>
			<p class="eyebrow">Governance history</p>
			<strong>Controlled framework versions</strong>
		</div>
		<div class="version-links">
			{#each data.frameworks as framework}
				<a
					class:active={data.selectedFramework?.public_id === framework.public_id}
					href={`/governance?framework=${framework.public_id}`}
				>
					<span>{framework.framework_code} · v{framework.version_number}</span>
					<small>{label(framework.lifecycle_status)}</small>
				</a>
			{/each}
		</div>
	</section>
{/if}

{#if !data.selectedFramework}
	<section class="empty-state">
		<p class="eyebrow">No governance framework yet</p>
		<h2>Create the enterprise governance constitution</h2>
		<p>
			Define the governance purpose and principles before establishing accountable bodies and
			business authority.
		</p>
	</section>
	{#if data.canManage}
		<section class="panel">
			<h2>New governance framework</h2>
			<form method="POST" action="?/createFramework" class="form-grid">
				<label>Framework code <input name="frameworkCode" value="CORPORATE" required /></label>
				<label
					>Title <input name="title" placeholder="Corporate Governance Framework" required /></label
				>
				<label>Effective from <input type="date" name="effectiveFrom" required /></label>
				<label>Effective to <input type="date" name="effectiveTo" /></label>
				<label class="wide"
					>Purpose <textarea name="purposeText" rows="3" required></textarea></label
				>
				<label class="wide"
					>Governance principles <textarea name="principlesText" rows="4" required
					></textarea></label
				>
				<label
					>Accountable owner
					<select name="ownerMemberId"
						><option value="">Unassigned</option>{#each data.members as member}<option
								value={member.id}>{member.display_name}</option
							>{/each}</select
					>
				</label>
				<div class="form-actions"><button type="submit">Create governance draft</button></div>
			</form>
		</section>
	{/if}
{:else}
	{@const framework = data.selectedFramework}
	<section class="strategy-summary">
		<div>
			<span>Framework</span><strong
				>{framework.framework_code} · version {framework.version_number}</strong
			>
		</div>
		<div><span>Status</span><strong>{label(framework.lifecycle_status)}</strong></div>
		<div>
			<span>Effective</span><strong
				>{dateValue(framework.effective_from)}{#if framework.effective_to}
					→ {dateValue(framework.effective_to)}{/if}</strong
			>
		</div>
		<div>
			<span>Evidence</span><strong
				>{data.bodies.length} bodies · {data.authorityRules.length} authority rules · {data
					.decisions.length} decisions</strong
			>
		</div>
	</section>

	<section class="intent-grid">
		<article class="intent-card">
			<p class="eyebrow">Governance purpose</p>
			<p>{framework.purpose_text}</p>
		</article>
		<article class="intent-card">
			<p class="eyebrow">Governance principles</p>
			<p>{framework.principles_text}</p>
		</article>
		<article class="intent-card">
			<p class="eyebrow">Accountable owner</p>
			<p>{memberName(framework.owner_member_id)}</p>
		</article>
	</section>

	{#if framework.lifecycle_status === 'approved'}
		<section class="notice success">
			<div>
				<strong>Approved governance constitution</strong><span
					>This version is immutable. Meetings, decisions and policy draw authority from this
					approved evidence.</span
				>
			</div>
			{#if data.canManage}<form method="POST" action="?/reviseFramework">
					<input type="hidden" name="frameworkPublicId" value={framework.public_id} /><button
						class="secondary">Create framework revision</button
					>
				</form>{/if}
		</section>
	{/if}

	<section class="panel">
		<div class="section-heading">
			<div>
				<p class="eyebrow">F02.01 + F02.04 + F02.05</p>
				<h2>Governance bodies</h2>
			</div>
			<span>{data.bodies.length} bodies</span>
		</div>
		<div class="record-list">
			{#each data.bodies as body}
				<article>
					<div class="record-meta">
						<span>{label(body.body_type)}</span><span>{body.body_code}</span><span
							>{label(body.lifecycle_status)}</span
						>
					</div>
					<h3>{body.title}</h3>
					<p>{body.mandate_text}</p>
					<small
						>Quorum {body.quorum_count} · Chair {memberName(body.chair_member_id)} · Secretary {memberName(
							body.secretary_member_id
						)}</small
					>
					<div class="member-chips">
						{#each data.bodyMemberships.filter((membership) => membership.governance_body_id === body.id) as membership}
							<span
								>{memberName(membership.organisation_member_id)} · {label(
									membership.governance_role
								)}{membership.voting_rights ? ' · voting' : ''}</span
							>
						{/each}
					</div>
				</article>
			{/each}
			{#if !data.bodies.length}<p class="muted">No governance bodies established yet.</p>{/if}
		</div>

		{#if framework.lifecycle_status === 'draft' && data.canManage}
			<details class="add-record">
				<summary>Add governance body</summary>
				<form method="POST" action="?/addBody" class="form-grid compact">
					<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
					<label>Body code <input name="bodyCode" required /></label>
					<label
						>Body type <select name="bodyType"
							><option value="board">Board</option><option value="executive">Executive</option
							><option value="committee">Committee</option></select
						></label
					>
					<label>Title <input name="title" required /></label>
					<label>Quorum <input type="number" min="1" name="quorumCount" value="1" required /></label
					>
					<label
						>Chair <select name="chairMemberId"
							><option value="">Unassigned</option>{#each data.members as member}<option
									value={member.id}>{member.display_name}</option
								>{/each}</select
						></label
					>
					<label
						>Secretary <select name="secretaryMemberId"
							><option value="">Unassigned</option>{#each data.members as member}<option
									value={member.id}>{member.display_name}</option
								>{/each}</select
						></label
					>
					<label class="wide"
						>Mandate <textarea name="mandateText" rows="3" required></textarea></label
					>
					<div class="form-actions"><button>Add governance body</button></div>
				</form>
			</details>
			{#if data.bodies.length}
				<details class="add-record">
					<summary>Appoint governance-body member</summary>
					<form method="POST" action="?/appointMember" class="form-grid compact">
						<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
						<label
							>Governance body <select name="bodyPublicId"
								>{#each data.bodies as body}<option value={body.public_id}
										>{body.body_code} · {body.title}</option
									>{/each}</select
							></label
						>
						<label
							>Member <select name="memberId"
								>{#each data.members as member}<option value={member.id}
										>{member.display_name}</option
									>{/each}</select
							></label
						>
						<label
							>Governance role <select name="governanceRole"
								><option value="member">Member</option><option value="chair">Chair</option><option
									value="secretary">Secretary</option
								><option value="executive">Executive</option></select
							></label
						>
						<label>Appointed on <input type="date" name="appointedOn" required /></label>
						<label>Term ends on <input type="date" name="termEndsOn" /></label>
						<label class="checkbox"
							><input type="checkbox" name="votingRights" checked /> Voting rights</label
						>
						<div class="form-actions"><button>Appoint member</button></div>
					</form>
				</details>
			{/if}
		{/if}
	</section>

	<section class="panel">
		<div class="section-heading">
			<div>
				<p class="eyebrow">F02.03</p>
				<h2>Business delegation of authority</h2>
			</div>
			<span>{data.authorityRules.length} rules</span>
		</div>
		<p class="muted">
			These rules govern business decisions and financial approval limits. They do not grant NuBlox
			access roles or permissions.
		</p>
		<div class="record-list">
			{#each data.authorityRules as rule}
				<article>
					<div class="record-meta">
						<span>{rule.authority_code}</span><span>{rule.subject_domain}</span><span
							>{rule.action_key}</span
						>
					</div>
					<h3>{bodyName(rule.authority_body_id)}</h3>
					<p>{rule.description}</p>
					<small
						>{rule.min_amount ?? 'No minimum'}{#if rule.max_amount !== null}
							→ {rule.max_amount}{/if}{#if rule.currency_code}
							{rule.currency_code}{/if} · {dateValue(rule.effective_from)}{#if rule.effective_to}
							→ {dateValue(rule.effective_to)}{/if}</small
					>
				</article>
			{/each}
		</div>
		{#if framework.lifecycle_status === 'draft' && data.canManage && data.bodies.length}
			<details class="add-record">
				<summary>Add delegation-of-authority rule</summary>
				<form method="POST" action="?/addAuthorityRule" class="form-grid compact">
					<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
					<label>Authority code <input name="authorityCode" required /></label>
					<label
						>Authority body <select name="bodyPublicId"
							>{#each data.bodies as body}<option value={body.public_id}
									>{body.body_code} · {body.title}</option
								>{/each}</select
						></label
					>
					<label>Subject domain <input name="subjectDomain" value="general" required /></label>
					<label
						>Action key <input name="actionKey" placeholder="enterprise.approve" required /></label
					>
					<label>Minimum amount <input type="number" min="0" step="0.01" name="minAmount" /></label>
					<label>Maximum amount <input type="number" min="0" step="0.01" name="maxAmount" /></label>
					<label>Currency <input name="currencyCode" maxlength="3" placeholder="GBP" /></label>
					<label>Effective from <input type="date" name="effectiveFrom" required /></label>
					<label>Effective to <input type="date" name="effectiveTo" /></label>
					<label class="wide"
						>Authority description <textarea name="description" rows="3" required></textarea></label
					>
					<div class="form-actions"><button>Add authority rule</button></div>
				</form>
			</details>
		{/if}
		{#if framework.lifecycle_status === 'draft' && data.canApprove}
			<form method="POST" action="?/approveFramework" class="approval-bar">
				<input type="hidden" name="frameworkPublicId" value={framework.public_id} /><button
					>Approve governance framework version {framework.version_number}</button
				>
			</form>
		{/if}
	</section>

	{#if framework.lifecycle_status === 'approved'}
		<section class="panel">
			<div class="section-heading">
				<div>
					<p class="eyebrow">F02.01 + F02.04 + F02.05</p>
					<h2>Meetings, decisions and actions</h2>
				</div>
				<span>{data.meetings.length} meetings</span>
			</div>
			{#if data.canManage && data.bodies.length}
				<details class="add-record">
					<summary>Create governance meeting</summary>
					<form method="POST" action="?/createMeeting" class="form-grid compact">
						<input type="hidden" name="frameworkPublicId" value={framework.public_id} />
						<label
							>Governance body <select name="bodyPublicId"
								>{#each data.bodies.filter((body) => body.lifecycle_status === 'active') as body}<option
										value={body.public_id}>{body.body_code} · {body.title}</option
									>{/each}</select
							></label
						>
						<label>Meeting code <input name="meetingCode" required /></label>
						<label
							>Meeting type <select name="meetingType"
								><option value="scheduled">Scheduled</option><option value="special">Special</option
								><option value="written_resolution">Written resolution</option></select
							></label
						>
						<label
							>Scheduled date/time <input
								type="datetime-local"
								name="scheduledAt"
								required
							/></label
						>
						<label>Meeting title <input name="title" required /></label>
						<label>Location / channel <input name="locationText" /></label>
						<div class="form-actions"><button>Create meeting</button></div>
					</form>
				</details>
			{/if}

			<div class="meeting-list">
				{#each data.meetings as meeting}
					<article class="meeting-card">
						<div class="record-meta">
							<span>{bodyName(meeting.governance_body_id)}</span><span>{meeting.meeting_code}</span
							><span>{label(meeting.lifecycle_status)}</span>
						</div>
						<h3>{meeting.title}</h3>
						<p>
							{dateTimeValue(meeting.scheduled_at).replace('T', ' ')} · quorum {meeting.quorum_required_count}{meeting.quorum_met
								? ' · met'
								: ''}
						</p>
						<div class="member-chips">
							{#each data.meetingAttendees.filter((attendee) => attendee.governance_meeting_id === meeting.id) as attendee}<span
									>{memberName(attendee.organisation_member_id)} · {attendee.attendance_status}{attendee.voting_eligible
										? ' · voting'
										: ''}</span
								>{/each}
						</div>

						{#if meeting.lifecycle_status === 'draft' && data.canManage}
							<details class="add-record">
								<summary>Record attendance</summary>
								<form method="POST" action="?/setAttendance" class="form-grid compact">
									<input type="hidden" name="frameworkPublicId" value={framework.public_id} /><input
										type="hidden"
										name="meetingPublicId"
										value={meeting.public_id}
									/>
									<label
										>Attendee <select name="memberId"
											>{#each data.bodyMemberships.filter((membership) => membership.governance_body_id === meeting.governance_body_id && membership.lifecycle_status === 'active') as membership}<option
													value={membership.organisation_member_id}
													>{memberName(membership.organisation_member_id)}</option
												>{/each}</select
										></label
									>
									<label
										>Attendance <select name="attendanceStatus"
											><option value="present">Present</option><option value="apology"
												>Apology</option
											><option value="absent">Absent</option></select
										></label
									>
									<div class="form-actions"><button>Record attendance</button></div>
								</form>
							</details>
							<details class="add-record">
								<summary>Add agenda item</summary>
								<form method="POST" action="?/addAgendaItem" class="form-grid compact">
									<input type="hidden" name="frameworkPublicId" value={framework.public_id} /><input
										type="hidden"
										name="meetingPublicId"
										value={meeting.public_id}
									/>
									<label
										>Agenda number <input
											type="number"
											min="1"
											name="agendaNumber"
											required
										/></label
									>
									<label
										>Item type <select name="itemType"
											><option value="decision">Decision</option><option value="information"
												>Information</option
											><option value="review">Review</option><option value="policy">Policy</option
											><option value="ethics">Ethics</option></select
										></label
									>
									<label>Agenda title <input name="title" required /></label><label
										>Authority action key <input name="authorityActionKey" /></label
									>
									<label>Source domain <input name="sourceDomain" placeholder="strategy" /></label
									><label>Source record type <input name="sourceRecordType" /></label><label
										>Source public ID <input name="sourcePublicId" /></label
									>
									<label
										>Decision amount <input
											type="number"
											min="0"
											step="0.01"
											name="decisionAmount"
										/></label
									><label>Currency <input name="currencyCode" maxlength="3" /></label>
									<label class="wide"
										>Agenda description <textarea name="description" rows="3" required
										></textarea></label
									>
									<div class="form-actions"><button>Add agenda item</button></div>
								</form>
							</details>
							{#if data.agendaItems.some((item) => item.governance_meeting_id === meeting.id)}
								<form method="POST" action="?/conveneMeeting" class="approval-bar">
									<input type="hidden" name="frameworkPublicId" value={framework.public_id} /><input
										type="hidden"
										name="meetingPublicId"
										value={meeting.public_id}
									/><button>Convene meeting and prove quorum</button>
								</form>
							{/if}
						{/if}

						<div class="agenda-list">
							{#each data.agendaItems.filter((item) => item.governance_meeting_id === meeting.id) as item}
								<div class="agenda-item">
									<strong>{item.agenda_number}. {item.title}</strong><small
										>{label(item.item_type)}{#if item.source_domain}
											· source {item.source_domain}/{item.source_record_type}/{item.source_public_id}{/if}</small
									>
									<p>{item.description}</p>
									{@const decision = decisionForAgenda(item.id)}
									{#if decision}<div class="decision-evidence">
											<strong>{decision.decision_code} · {label(decision.decision_outcome)}</strong>
											<p>{decision.resolution_text}</p>
											{#if decision.governance_authority_rule_id}<small
													>Authority proven by rule {decision.governance_authority_rule_id}</small
												>{/if}
										</div>{/if}
									{#if meeting.lifecycle_status === 'convened' && !decision && data.canManage}
										<form method="POST" action="?/recordDecision" class="form-grid compact">
											<input
												type="hidden"
												name="frameworkPublicId"
												value={framework.public_id}
											/><input
												type="hidden"
												name="agendaItemPublicId"
												value={item.public_id}
											/><label>Decision code <input name="decisionCode" required /></label><label
												>Outcome <select name="decisionOutcome"
													><option value="approved">Approved</option><option value="rejected"
														>Rejected</option
													><option value="deferred">Deferred</option><option value="noted"
														>Noted</option
													></select
												></label
											><label class="wide"
												>Resolution <textarea name="resolutionText" rows="3" required
												></textarea></label
											>
											<div class="form-actions"><button>Record governed decision</button></div>
										</form>
									{/if}
								</div>
							{/each}
						</div>

						{#each data.decisions.filter((decision) => decision.governance_meeting_id === meeting.id && decision.decision_outcome === 'approved') as decision}
							<div class="action-block">
								<h4>Actions from {decision.decision_code}</h4>
								{#each data.actions.filter((action) => action.governance_decision_id === decision.id) as action}<div
										class="action-row"
									>
										<div>
											<strong>{action.action_code} · {action.title}</strong><small
												>{label(action.lifecycle_status)} · owner {memberName(
													action.owner_member_id
												)} · due {dateValue(action.due_date)}</small
											>
										</div>
										{#if action.lifecycle_status !== 'completed' && data.canManage}<form
												method="POST"
												action="?/completeAction"
											>
												<input
													type="hidden"
													name="frameworkPublicId"
													value={framework.public_id}
												/><input
													type="hidden"
													name="actionPublicId"
													value={action.public_id}
												/><input
													name="completionEvidence"
													placeholder="Completion evidence"
													required
												/><button class="secondary">Complete action</button>
											</form>{/if}
									</div>{/each}
								{#if data.canManage}<details class="add-record">
										<summary>Add decision action</summary>
										<form method="POST" action="?/createAction" class="form-grid compact">
											<input
												type="hidden"
												name="frameworkPublicId"
												value={framework.public_id}
											/><input
												type="hidden"
												name="decisionPublicId"
												value={decision.public_id}
											/><label>Action code <input name="actionCode" required /></label><label
												>Action title <input name="title" required /></label
											><label
												>Owner <select name="ownerMemberId"
													>{#each data.members as member}<option value={member.id}
															>{member.display_name}</option
														>{/each}</select
												></label
											><label>Due date <input type="date" name="dueDate" required /></label><label
												>Source domain <input name="sourceDomain" /></label
											><label>Source record type <input name="sourceRecordType" /></label><label
												>Source public ID <input name="sourcePublicId" /></label
											><label class="wide"
												>Action description <textarea name="description" rows="2" required
												></textarea></label
											>
											<div class="form-actions"><button>Create action</button></div>
										</form>
									</details>{/if}
							</div>
						{/each}

						{#if meeting.lifecycle_status === 'convened' && data.canManage}
							<form method="POST" action="?/closeMeeting" class="stack-form close-form">
								<input type="hidden" name="frameworkPublicId" value={framework.public_id} /><input
									type="hidden"
									name="meetingPublicId"
									value={meeting.public_id}
								/><label
									>Approved minutes <textarea name="minutesText" rows="3" required
									></textarea></label
								>
								<div class="form-actions"><button>Close meeting with minutes</button></div>
							</form>
						{:else if meeting.lifecycle_status === 'closed' && meeting.minutes_text}<div
								class="minutes"
							>
								<strong>Closed minutes</strong>
								<p>{meeting.minutes_text}</p>
							</div>{/if}
					</article>
				{/each}
			</div>
		</section>

		<section class="panel">
			<div class="section-heading">
				<div>
					<p class="eyebrow">F02.06</p>
					<h2>Policy governance</h2>
				</div>
				<span>{data.policies.length} versions</span>
			</div>
			<div class="record-list">
				{#each data.policies as policy}<article>
						<div class="record-meta">
							<span>{policy.policy_code} · v{policy.version_number}</span><span
								>{label(policy.policy_category)}</span
							><span>{label(policy.lifecycle_status)}</span>
						</div>
						<h3>{policy.title}</h3>
						<p>{policy.scope_text}</p>
						<small
							>Effective {dateValue(policy.effective_from)} · review {dateValue(
								policy.review_due_on
							)} · approval body {bodyName(policy.approval_body_id)}</small
						>
						{#if policy.lifecycle_status === 'draft' && data.canApprove}<form
								method="POST"
								action="?/approvePolicy"
							>
								<input type="hidden" name="frameworkPublicId" value={framework.public_id} /><input
									type="hidden"
									name="policyPublicId"
									value={policy.public_id}
								/><button>Approve policy version {policy.version_number}</button>
							</form>{/if}
						{#if policy.lifecycle_status === 'approved'}<div class="inline-actions">
								{#if !policyAttested(policy.id)}<form method="POST" action="?/attestPolicy">
										<input
											type="hidden"
											name="frameworkPublicId"
											value={framework.public_id}
										/><input type="hidden" name="policyPublicId" value={policy.public_id} /><input
											type="hidden"
											name="attestationStatus"
											value="acknowledged"
										/><button class="secondary">Acknowledge policy</button>
									</form>{/if}{#if data.canManage}<form method="POST" action="?/revisePolicy">
										<input
											type="hidden"
											name="frameworkPublicId"
											value={framework.public_id}
										/><input type="hidden" name="policyPublicId" value={policy.public_id} /><button
											class="secondary">Create policy revision</button
										>
									</form>{/if}
							</div>{/if}
					</article>{/each}
			</div>
			{#if data.canManage && data.bodies.length}<details class="add-record">
					<summary>Create governed policy</summary>
					<form method="POST" action="?/createPolicy" class="form-grid compact">
						<input type="hidden" name="frameworkPublicId" value={framework.public_id} /><label
							>Policy code <input name="policyCode" required /></label
						><label>Policy title <input name="title" required /></label><label
							>Category <select name="policyCategory"
								><option value="corporate">Corporate</option><option value="finance">Finance</option
								><option value="people">People</option><option value="safety">Safety</option><option
									value="information">Information</option
								><option value="ethics">Ethics</option><option value="other">Other</option></select
							></label
						><label
							>Approval body <select name="approvalBodyPublicId"
								>{#each data.bodies.filter((body) => body.lifecycle_status === 'active') as body}<option
										value={body.public_id}>{body.title}</option
									>{/each}</select
							></label
						><label
							>Policy owner <select name="ownerMemberId"
								><option value="">Unassigned</option>{#each data.members as member}<option
										value={member.id}>{member.display_name}</option
									>{/each}</select
							></label
						><label>Effective from <input type="date" name="effectiveFrom" required /></label><label
							>Review due on <input type="date" name="reviewDueOn" required /></label
						><label class="wide"
							>Scope <textarea name="scopeText" rows="2" required></textarea></label
						><label class="wide"
							>Policy text <textarea name="policyText" rows="4" required></textarea></label
						>
						<div class="form-actions"><button>Create policy draft</button></div>
					</form>
				</details>{/if}
		</section>

		{#if data.canViewEthics || data.canManage}
			<section class="panel">
				<div class="section-heading">
					<div>
						<p class="eyebrow">F02.07</p>
						<h2>Ethics and conflicts</h2>
					</div>
					<span>{data.conflicts.length} conflicts · {data.ethicsCases.length} cases</span>
				</div>
				<div class="workspace-grid">
					<div>
						<h3>Conflict declarations</h3>
						<div class="record-list">
							{#each data.conflicts as conflict}<article>
									<div class="record-meta">
										<span>{label(conflict.declaration_type)}</span><span
											>{label(conflict.lifecycle_status)}</span
										>
									</div>
									<strong>{conflict.subject_text}</strong>
									<p>{conflict.details}</p>
									{#if conflict.review_outcome}<small
											>{conflict.review_outcome} · {conflict.management_action}</small
										>{/if}{#if data.canManageEthics && conflict.lifecycle_status === 'open'}<form
											method="POST"
											action="?/reviewConflict"
											class="stack-form"
										>
											<input
												type="hidden"
												name="frameworkPublicId"
												value={framework.public_id}
											/><input
												type="hidden"
												name="conflictPublicId"
												value={conflict.public_id}
											/><label
												>Review outcome <textarea name="reviewOutcome" rows="2" required
												></textarea></label
											><label
												>Management action <textarea name="managementAction" rows="2" required
												></textarea></label
											><label class="checkbox"
												><input type="checkbox" name="close" /> Close after review</label
											><button>Record conflict review</button>
										</form>{/if}
								</article>{/each}
						</div>
					</div>
					<div>
						<h3>Ethics cases</h3>
						<div class="record-list">
							{#each data.ethicsCases as ethicsCase}<article>
									<div class="record-meta">
										<span>{ethicsCase.case_code}</span><span>{label(ethicsCase.severity)}</span
										><span>{label(ethicsCase.lifecycle_status)}</span>
									</div>
									<strong>{ethicsCase.subject_text}</strong>
									<p>{ethicsCase.description}</p>
									{#if ethicsCase.resolution_text}<small
											>Resolution: {ethicsCase.resolution_text}</small
										>{/if}{#if data.canManageEthics && ethicsCase.lifecycle_status !== 'resolved' && ethicsCase.lifecycle_status !== 'closed'}<form
											method="POST"
											action="?/resolveEthicsCase"
											class="stack-form"
										>
											<input
												type="hidden"
												name="frameworkPublicId"
												value={framework.public_id}
											/><input
												type="hidden"
												name="casePublicId"
												value={ethicsCase.public_id}
											/><label
												>Resolution <textarea name="resolutionText" rows="2" required
												></textarea></label
											><button>Resolve ethics case</button>
										</form>{/if}
								</article>{/each}
						</div>
					</div>
				</div>
				{#if data.canManage}<div class="workspace-grid">
						<details class="add-record">
							<summary>Declare conflict of interest</summary>
							<form method="POST" action="?/declareConflict" class="stack-form">
								<input type="hidden" name="frameworkPublicId" value={framework.public_id} /><label
									>Related policy <select name="policyPublicId"
										><option value="">None</option
										>{#each data.policies.filter((policy) => policy.lifecycle_status === 'approved') as policy}<option
												value={policy.public_id}>{policy.policy_code} · {policy.title}</option
											>{/each}</select
									></label
								><label
									>Declaration type <select name="declarationType"
										><option value="actual">Actual</option><option value="potential"
											>Potential</option
										><option value="perceived">Perceived</option></select
									></label
								><label>Conflict subject <input name="subjectText" required /></label><label
									>Declared on <input type="date" name="declaredOn" required /></label
								><label>Details <textarea name="details" rows="3" required></textarea></label
								><button>Declare conflict</button>
							</form>
						</details>
						<details class="add-record">
							<summary>Raise ethics case</summary>
							<form method="POST" action="?/createEthicsCase" class="stack-form">
								<input type="hidden" name="frameworkPublicId" value={framework.public_id} /><label
									>Case code <input name="caseCode" required /></label
								><label
									>Related policy <select name="policyPublicId"
										><option value="">None</option
										>{#each data.policies.filter((policy) => policy.lifecycle_status === 'approved') as policy}<option
												value={policy.public_id}>{policy.policy_code} · {policy.title}</option
											>{/each}</select
									></label
								><label>Case subject <input name="subjectText" required /></label><label
									>Severity <select name="severity"
										><option value="low">Low</option><option value="medium">Medium</option><option
											value="high">High</option
										><option value="critical">Critical</option></select
									></label
								><label
									>Case owner <select name="ownerMemberId"
										><option value="">Unassigned</option>{#each data.members as member}<option
												value={member.id}>{member.display_name}</option
											>{/each}</select
									></label
								><label class="checkbox"
									><input type="checkbox" name="anonymous" /> Record reporter as anonymous</label
								><label
									>Description <textarea name="description" rows="3" required></textarea></label
								><button>Raise ethics case</button>
							</form>
						</details>
					</div>{/if}
			</section>
		{/if}
	{/if}
{/if}

<style>
	.member-chips,
	.inline-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.member-chips span {
		border: 1px solid var(--border-color, #d8d8d8);
		border-radius: 999px;
		padding: 0.25rem 0.6rem;
		font-size: 0.8rem;
	}
	.meeting-list {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}
	.meeting-card {
		border: 1px solid var(--border-color, #d8d8d8);
		border-radius: 0.75rem;
		padding: 1rem;
	}
	.agenda-list {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}
	.agenda-item,
	.decision-evidence,
	.action-block,
	.minutes {
		border-left: 3px solid currentColor;
		padding: 0.75rem 1rem;
	}
	.action-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
		padding: 0.5rem 0;
	}
	.action-row div {
		display: grid;
		gap: 0.2rem;
	}
	.approval-bar,
	.close-form {
		margin-top: 1rem;
	}
	.checkbox {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	@media (max-width: 800px) {
		.action-row {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
