<script lang="ts">
	let { data, form } = $props();

	const selectedProject = $derived(
		data.projects.find((project) => project.publicId === data.selectedProjectPublicId) ?? null
	);
	const allFindings = $derived(data.inspections.flatMap((inspection) => inspection.findings));
	const anyView = $derived(data.canViewSite || data.canViewQuality || data.canViewSafety);

	function siteName(siteId: string) {
		const site = data.sites.find((candidate) => candidate.id === siteId);
		return site ? `${site.siteCode} · ${site.name}` : 'Project site';
	}

	function shortDate(value: Date | string | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
	}

	function shortDateTime(value: Date | string | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}
</script>

<svelte:head>
	<title>Site, quality & safety · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Operations</p>
		<h1>Site, quality & safety</h1>
		<p>
			Capture controlled field evidence from project site records through diaries, inspections,
			defects, non-conformances and safety actions.
		</p>
	</div>
	{#if data.canManageDiaries && selectedProject && data.sites.length > 0}
		<a class="header-action" href="#create-diary">New site diary</a>
	{/if}
</section>

{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

{#if !anyView}
	<section class="notice">
		<h2>Site operations are restricted</h2>
		<p>Your current role does not grant site, quality or safety visibility.</p>
	</section>
{:else}
	<section class="project-filter" aria-label="Project filter">
		<form method="GET">
			<label>
				Project
				<select name="project" onchange={(event) => event.currentTarget.form?.requestSubmit()}>
					{#each data.projects as project}
						<option
							value={project.publicId}
							selected={project.publicId === data.selectedProjectPublicId}
						>
							{project.projectNumber} · {project.name}
						</option>
					{/each}
				</select>
			</label>
			<noscript><button type="submit">View project</button></noscript>
		</form>
	</section>

	{#if selectedProject}
		<section class="metrics" aria-label="Field operations summary">
			<article><span>Sites</span><strong>{data.sites.length}</strong></article>
			<article><span>Diaries</span><strong>{data.diaries.length}</strong></article>
			<article>
				<span>Open defects</span><strong
					>{data.defects.filter((row) => row.status !== 'closed').length}</strong
				>
			</article>
			<article>
				<span>Open safety events</span><strong
					>{data.safetyEvents.filter((row) => row.status !== 'closed').length}</strong
				>
			</article>
		</section>
	{/if}

	{#if data.canViewSite}
		<section class="workspace-section" id="site-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Locations</p>
					<h2>Project sites</h2>
				</div>
				<span class="count">{data.sites.length}</span>
			</div>
			{#if data.sites.length === 0}
				<div class="empty-state">
					<h3>No project sites</h3>
					<p>Create the first controlled site/location before recording field activity.</p>
				</div>
			{:else}
				<div class="card-grid">
					{#each data.sites as site}
						<article class="record-card">
							<header>
								<div>
									<p class="reference">{site.siteCode}</p>
									<h3>{site.name}</h3>
								</div>
								<span class="status">{site.isActive ? 'active' : 'inactive'}</span>
							</header>
							<p class="muted">{site.timezone ?? 'Project timezone'}</p>
						</article>
					{/each}
				</div>
			{/if}
		</section>

		{#if data.canManageSites && selectedProject}
			<section class="form-panel" id="create-site">
				<div>
					<p class="eyebrow">Location control</p>
					<h2>Create project site</h2>
				</div>
				<form method="POST" action="?/createSite" class="form-grid">
					<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
					<label
						>Site code<input name="siteCode" maxlength="80" required placeholder="SITE-01" /></label
					>
					<label
						>Site name<input name="name" maxlength="255" required placeholder="Main works" /></label
					>
					<label>Timezone<input name="timezone" maxlength="64" value="Europe/London" /></label>
					<div class="form-actions"><button type="submit">Create project site</button></div>
				</form>
			</section>
		{/if}

		<section class="workspace-section" id="diary-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Field record</p>
					<h2>Site diaries</h2>
				</div>
				<span class="count">{data.diaries.length}</span>
			</div>
			{#if data.diaries.length === 0}
				<div class="empty-state">
					<h3>No site diaries</h3>
					<p>Capture progress and field activity against an active project site.</p>
				</div>
			{:else}
				<div class="register-list">
					{#each data.diaries as diary}
						<article class="record-card diary-card">
							<header>
								<div>
									<p class="reference">
										{shortDate(diary.diaryDate)}{diary.shiftLabel ? ` · ${diary.shiftLabel}` : ''}
									</p>
									<h3>{siteName(diary.projectSiteId)}</h3>
								</div>
								<span class="status">{diary.status}</span>
							</header>
							{#if diary.summary}<p>{diary.summary}</p>{/if}
							<p class="muted">
								Submitted {shortDateTime(diary.submittedAt)} · Approved {shortDateTime(
									diary.approvedAt
								)}
							</p>
							<div class="inline-actions">
								{#if data.canSubmitDiaries && diary.status === 'draft' && selectedProject}
									<form method="POST" action="?/submitDiary">
										<input
											type="hidden"
											name="projectPublicId"
											value={selectedProject.publicId}
										/><input type="hidden" name="diaryPublicId" value={diary.publicId} /><button
											type="submit">Submit diary</button
										>
									</form>
								{/if}
								{#if data.canApproveDiaries && diary.status === 'submitted' && selectedProject}
									<form method="POST" action="?/approveDiary">
										<input
											type="hidden"
											name="projectPublicId"
											value={selectedProject.publicId}
										/><input type="hidden" name="diaryPublicId" value={diary.publicId} /><button
											type="submit">Approve diary</button
										>
									</form>
								{/if}
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>

		{#if data.canManageDiaries && selectedProject && data.sites.length > 0}
			<section class="form-panel" id="create-diary">
				<div>
					<p class="eyebrow">Mobile capture</p>
					<h2>New site diary</h2>
				</div>
				<form method="POST" action="?/createDiary" class="form-grid">
					<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
					<label
						>Site<select name="sitePublicId" required
							>{#each data.sites.filter((site) => site.isActive) as site}<option
									value={site.publicId}>{site.siteCode} · {site.name}</option
								>{/each}</select
						></label
					>
					<label>Diary date<input name="diaryDate" type="date" required /></label>
					<label>Shift<input name="shiftLabel" maxlength="80" placeholder="Day shift" /></label>
					<label class="wide"
						>Summary<textarea name="summary" rows="3" placeholder="Overall site position"
						></textarea></label
					>
					<label class="wide"
						>Activity description<textarea
							name="activityDescription"
							rows="4"
							required
							placeholder="Work completed, constraints and progress"></textarea></label
					>
					<label>Location<input name="locationDescription" maxlength="255" /></label>
					<label
						>Progress %<input name="progressPercent" inputmode="decimal" placeholder="50" /></label
					>
					<div class="form-actions wide"><button type="submit">Create diary draft</button></div>
				</form>
			</section>
		{/if}
	{/if}

	{#if data.canViewQuality}
		<section class="workspace-section" id="template-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Controlled definitions</p>
					<h2>Published inspection templates</h2>
				</div>
				<span class="count">{data.templates.length}</span>
			</div>
			{#if data.templates.length === 0}
				<div class="empty-state">
					<h3>No published checklists</h3>
					<p>Publish a simple V1 checklist before creating a quality inspection.</p>
				</div>
			{:else}
				<div class="card-grid">
					{#each data.templates as template}<article class="record-card">
							<header>
								<div>
									<p class="reference">{template.code} · v{template.versionNumber}</p>
									<h3>{template.name}</h3>
								</div>
								<span class="status">{template.status}</span>
							</header>
							{#if template.description}<p>{template.description}</p>{/if}
						</article>{/each}
				</div>
			{/if}
		</section>

		{#if data.canManageTemplates && selectedProject}
			<section class="form-panel" id="create-template">
				<div>
					<p class="eyebrow">Checklist definition</p>
					<h2>Publish inspection template</h2>
				</div>
				<form method="POST" action="?/createTemplate" class="form-grid">
					<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
					<label
						>Template code<input
							name="code"
							maxlength="80"
							required
							placeholder="ELEC-1STFIX"
						/></label
					>
					<label>Template name<input name="name" maxlength="255" required /></label>
					<label class="wide">Description<textarea name="description" rows="2"></textarea></label>
					<label class="wide"
						>Checklist prompts <small>One required check per line</small><textarea
							name="checklistPrompts"
							rows="5"
							required
							placeholder={'Containment securely fixed\nRoutes match issued drawing\nFire stopping complete'}
						></textarea></label
					>
					<div class="form-actions wide"><button type="submit">Publish checklist v1</button></div>
				</form>
			</section>
		{/if}

		<section class="workspace-section" id="inspection-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Quality control</p>
					<h2>Inspections</h2>
				</div>
				<span class="count">{data.inspections.length}</span>
			</div>
			{#if data.inspections.length === 0}
				<div class="empty-state">
					<h3>No inspections</h3>
					<p>Start an inspection against an exact published checklist version.</p>
				</div>
			{:else}
				<div class="register-list">
					{#each data.inspections as inspection}
						<article class="record-card inspection-card">
							<header>
								<div>
									<p class="reference">{inspection.inspectionNumber}</p>
									<h3>{inspection.title}</h3>
									<p class="muted">
										{siteName(inspection.projectSiteId)} · {inspection.templateName}
									</p>
								</div>
								<span class="status">{inspection.status}</span>
							</header>
							{#if inspection.locationDescription}<p>{inspection.locationDescription}</p>{/if}
							<div class="checklist">
								{#each inspection.items as item}
									<div class="check-item">
										<div>
											<strong>{item.itemNumber}. {item.promptText}</strong>{#if item.response}<span
													class="result result-{item.response.resultCode}"
													>{item.response.resultCode.replaceAll('_', ' ')}</span
												>{/if}
										</div>
										{#if data.canManageInspections && inspection.status === 'in_progress' && selectedProject}
											<form method="POST" action="?/recordInspectionResponse" class="inline-form">
												<input
													type="hidden"
													name="projectPublicId"
													value={selectedProject.publicId}
												/><input
													type="hidden"
													name="inspectionPublicId"
													value={inspection.publicId}
												/><input type="hidden" name="templateItemId" value={item.id} />
												<label
													>Result<select name="resultCode" required
														><option value="pass">Pass</option><option value="fail">Fail</option
														><option value="not_applicable">Not applicable</option><option
															value="observation">Observation</option
														></select
													></label
												>
												<label
													>Comments<input
														name="comments"
														value={item.response?.comments ?? ''}
													/></label
												>
												<button type="submit">Record check</button>
											</form>
											{#if item.allowFinding && item.response}
												<details>
													<summary>Raise finding</summary>
													<form method="POST" action="?/raiseFinding" class="stack-form">
														<input
															type="hidden"
															name="projectPublicId"
															value={selectedProject.publicId}
														/><input
															type="hidden"
															name="inspectionPublicId"
															value={inspection.publicId}
														/><input type="hidden" name="templateItemId" value={item.id} /><label
															>Finding type<select name="findingTypeCode"
																>{#each data.findingTypes as type}<option value={type.code}
																		>{type.name}</option
																	>{/each}</select
															></label
														><label
															>Severity<select name="severity"
																><option>low</option><option selected>medium</option><option
																	>high</option
																><option>critical</option></select
															></label
														><label>Title<input name="title" required /></label><label
															>Description<textarea name="description" rows="3" required
															></textarea></label
														><button type="submit">Raise finding</button>
													</form>
												</details>
											{/if}
										{/if}
									</div>
								{/each}
							</div>
							{#if inspection.findings.length > 0}<div class="finding-list">
									<h4>Findings</h4>
									{#each inspection.findings as finding}<p>
											<span class="status">{finding.severity}</span>
											<strong>{finding.findingTypeName}</strong>
											· {finding.title}
										</p>{/each}
								</div>{/if}
							{#if data.canManageInspections && inspection.status === 'in_progress' && selectedProject}<form
									method="POST"
									action="?/completeInspection"
								>
									<input
										type="hidden"
										name="projectPublicId"
										value={selectedProject.publicId}
									/><input
										type="hidden"
										name="inspectionPublicId"
										value={inspection.publicId}
									/><button type="submit">Complete inspection</button>
								</form>{/if}
						</article>
					{/each}
				</div>
			{/if}
		</section>

		{#if data.canManageInspections && selectedProject && data.sites.length > 0 && data.templates.length > 0}
			<section class="form-panel" id="create-inspection">
				<div>
					<p class="eyebrow">Quality capture</p>
					<h2>Start inspection</h2>
				</div>
				<form method="POST" action="?/createInspection" class="form-grid">
					<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
					<label
						>Site<select name="sitePublicId" required
							>{#each data.sites.filter((site) => site.isActive) as site}<option
									value={site.publicId}>{site.siteCode} · {site.name}</option
								>{/each}</select
						></label
					>
					<label
						>Checklist<select name="templateVersionPublicId" required
							>{#each data.templates as template}<option value={template.versionPublicId}
									>{template.code} · {template.name} · v{template.versionNumber}</option
								>{/each}</select
						></label
					>
					<label class="wide">Inspection title<input name="title" maxlength="500" required /></label
					>
					<label class="wide">Location<input name="locationDescription" maxlength="255" /></label>
					<div class="form-actions wide"><button type="submit">Start inspection</button></div>
				</form>
			</section>
		{/if}

		<section class="workspace-section" id="defect-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Snagging</p>
					<h2>Defects</h2>
				</div>
				<span class="count">{data.defects.length}</span>
			</div>
			{#if data.defects.length === 0}<div class="empty-state">
					<h3>No defects</h3>
					<p>Raise a standalone defect or link one to an inspection finding.</p>
				</div>{:else}<div class="register-list">
					{#each data.defects as defect}<article class="record-card defect-card">
							<header>
								<div>
									<p class="reference">{defect.defectNumber}</p>
									<h3>{defect.title}</h3>
									<p class="muted">{siteName(defect.projectSiteId)} · {defect.severity}</p>
								</div>
								<span class="status">{defect.status}</span>
							</header>
							<p>{defect.description}</p>
							{#if defect.targetDate}<p class="muted">
									Target {shortDate(defect.targetDate)}
								</p>{/if}{#if data.canManageDefects && defect.status !== 'closed' && defect.status !== 'cancelled' && selectedProject}<form
									method="POST"
									action="?/closeDefect"
								>
									<input
										type="hidden"
										name="projectPublicId"
										value={selectedProject.publicId}
									/><input type="hidden" name="defectPublicId" value={defect.publicId} /><button
										type="submit">Close defect</button
									>
								</form>{/if}
						</article>{/each}
				</div>{/if}
		</section>

		{#if data.canManageDefects && selectedProject && data.sites.length > 0}
			<section class="form-panel" id="create-defect">
				<div>
					<p class="eyebrow">Quality issue</p>
					<h2>Raise defect</h2>
				</div>
				<form method="POST" action="?/createDefect" class="form-grid">
					<input type="hidden" name="projectPublicId" value={selectedProject.publicId} /><label
						>Site<select name="sitePublicId"
							>{#each data.sites.filter((site) => site.isActive) as site}<option
									value={site.publicId}>{site.siteCode} · {site.name}</option
								>{/each}</select
						></label
					><label
						>Severity<select name="severity"
							><option>low</option><option selected>medium</option><option>high</option><option
								>critical</option
							></select
						></label
					><label class="wide">Title<input name="title" required /></label><label class="wide"
						>Description<textarea name="description" rows="3" required></textarea></label
					><label>Location<input name="locationDescription" /></label><label
						>Target date<input name="targetDate" type="date" /></label
					><label class="wide"
						>Inspection finding<select name="findingPublicId"
							><option value="">No linked finding</option>{#each allFindings as finding}<option
									value={finding.publicId}>{finding.findingTypeName} · {finding.title}</option
								>{/each}</select
						></label
					>
					<div class="form-actions wide"><button type="submit">Raise defect</button></div>
				</form>
			</section>
		{/if}

		<section class="workspace-section" id="ncr-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Non-conformance</p>
					<h2>NCR register</h2>
				</div>
				<span class="count">{data.ncrs.length}</span>
			</div>
			{#if data.ncrs.length === 0}<div class="empty-state">
					<h3>No non-conformances</h3>
					<p>
						Formal NCRs remain separate from the defect lifecycle even when both arise from one
						inspection.
					</p>
				</div>{:else}<div class="register-list">
					{#each data.ncrs as ncr}<article class="record-card ncr-card">
							<header>
								<div>
									<p class="reference">{ncr.ncrNumber}</p>
									<h3>{ncr.title}</h3>
									<p class="muted">{siteName(ncr.projectSiteId)} · {ncr.severity}</p>
								</div>
								<span class="status">{ncr.status}</span>
							</header>
							<p>{ncr.statement}</p>
							{#if ncr.immediateContainment}<p>
									<strong>Containment:</strong>
									{ncr.immediateContainment}
								</p>{/if}{#if data.canManageNcrs && ncr.status !== 'closed' && ncr.status !== 'cancelled' && selectedProject}<form
									method="POST"
									action="?/closeNcr"
								>
									<input
										type="hidden"
										name="projectPublicId"
										value={selectedProject.publicId}
									/><input type="hidden" name="ncrPublicId" value={ncr.publicId} /><button
										type="submit">Close NCR</button
									>
								</form>{/if}
						</article>{/each}
				</div>{/if}
		</section>

		{#if data.canManageNcrs && selectedProject && data.sites.length > 0}
			<section class="form-panel" id="create-ncr">
				<div>
					<p class="eyebrow">Formal quality control</p>
					<h2>Raise NCR</h2>
				</div>
				<form method="POST" action="?/createNcr" class="form-grid">
					<input type="hidden" name="projectPublicId" value={selectedProject.publicId} /><label
						>Site<select name="sitePublicId"
							>{#each data.sites.filter((site) => site.isActive) as site}<option
									value={site.publicId}>{site.siteCode} · {site.name}</option
								>{/each}</select
						></label
					><label
						>Severity<select name="severity"
							><option>low</option><option selected>medium</option><option>high</option><option
								>critical</option
							></select
						></label
					><label class="wide">Title<input name="title" required /></label><label class="wide"
						>Non-conformance statement<textarea name="statement" rows="3" required
						></textarea></label
					><label class="wide"
						>Immediate containment<textarea name="immediateContainment" rows="2"></textarea></label
					><label>Target date<input name="targetDate" type="date" /></label><label
						>Inspection finding<select name="findingPublicId"
							><option value="">No linked finding</option>{#each allFindings as finding}<option
									value={finding.publicId}>{finding.findingTypeName} · {finding.title}</option
								>{/each}</select
						></label
					>
					<div class="form-actions wide"><button type="submit">Raise NCR</button></div>
				</form>
			</section>
		{/if}
	{/if}

	{#if data.canViewSafety}
		<section class="workspace-section" id="safety-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Safety control</p>
					<h2>Observations & actions</h2>
				</div>
				<span class="count">{data.safetyEvents.length}</span>
			</div>
			{#if data.safetyEvents.length === 0}<div class="empty-state">
					<h3>No safety events</h3>
					<p>Record positive or corrective site observations and close attributable actions.</p>
				</div>{:else}<div class="register-list">
					{#each data.safetyEvents as event}<article class="record-card safety-card">
							<header>
								<div>
									<p class="reference">
										{event.eventNumber} · {event.eventKind.replaceAll('_', ' ')}
									</p>
									<h3>{event.title}</h3>
									<p class="muted">
										{siteName(event.projectSiteId)} · {shortDateTime(event.occurredAt)}
									</p>
								</div>
								<span class="status">{event.status}</span>
							</header>
							<p>{event.description}</p>
							{#if event.observationCategory}<p class="muted">
									{event.observationCategory} · {event.isPositiveObservation
										? 'positive observation'
										: 'action required'}
								</p>{/if}{#if event.immediateActionTaken}<p>
									<strong>Immediate action:</strong>
									{event.immediateActionTaken}
								</p>{/if}{#if event.actions.length > 0}<div class="action-list">
									<h4>Actions</h4>
									{#each event.actions as action}<div class="action-row">
											<div>
												<strong>{action.actionType}</strong> · {action.actionText}<span
													class="status">{action.status}</span
												>
											</div>
											{#if data.canManageSafetyActions && action.status !== 'completed' && action.status !== 'verified' && selectedProject}<form
													method="POST"
													action="?/completeSafetyAction"
													class="inline-form"
												>
													<input
														type="hidden"
														name="projectPublicId"
														value={selectedProject.publicId}
													/><input
														type="hidden"
														name="safetyEventPublicId"
														value={event.publicId}
													/><input type="hidden" name="actionId" value={action.id} /><label
														>Completion note<input name="verificationNote" /></label
													><button type="submit">Complete action</button>
												</form>{/if}
										</div>{/each}
								</div>{/if}{#if data.canManageSafetyActions && event.status !== 'closed' && selectedProject}<details
								>
									<summary>Add safety action</summary>
									<form method="POST" action="?/createSafetyAction" class="stack-form">
										<input
											type="hidden"
											name="projectPublicId"
											value={selectedProject.publicId}
										/><input
											type="hidden"
											name="safetyEventPublicId"
											value={event.publicId}
										/><label
											>Action type<select name="actionType"
												><option value="immediate">Immediate</option><option
													value="corrective"
													selected>Corrective</option
												><option value="preventive">Preventive</option><option value="investigation"
													>Investigation</option
												><option value="verification">Verification</option></select
											></label
										><label>Action<textarea name="actionText" rows="3" required></textarea></label
										><label>Target date<input name="targetDate" type="date" /></label><button
											type="submit">Create safety action</button
										>
									</form>
								</details>{/if}{#if data.canManageSafetyEvents && event.status !== 'closed' && event.status !== 'cancelled' && selectedProject}<form
									method="POST"
									action="?/closeSafetyEvent"
								>
									<input
										type="hidden"
										name="projectPublicId"
										value={selectedProject.publicId}
									/><input type="hidden" name="safetyEventPublicId" value={event.publicId} /><button
										type="submit">Close safety event</button
									>
								</form>{/if}
						</article>{/each}
				</div>{/if}
		</section>

		{#if data.canManageSafetyEvents && selectedProject && data.sites.length > 0}
			<section class="form-panel" id="create-safety-observation">
				<div>
					<p class="eyebrow">Mobile safety capture</p>
					<h2>Report safety observation</h2>
				</div>
				<form method="POST" action="?/createSafetyObservation" class="form-grid">
					<input type="hidden" name="projectPublicId" value={selectedProject.publicId} /><label
						>Site<select name="sitePublicId"
							>{#each data.sites.filter((site) => site.isActive) as site}<option
									value={site.publicId}>{site.siteCode} · {site.name}</option
								>{/each}</select
						></label
					><label>Occurred at<input name="occurredAt" type="datetime-local" required /></label
					><label
						>Category<select name="observationCategory"
							><option>condition</option><option>behaviour</option><option>process</option><option
								>housekeeping</option
							><option>environment</option><option>other</option></select
						></label
					><label class="checkbox"
						><input name="isPositiveObservation" type="checkbox" /> Positive observation</label
					><label class="wide">Title<input name="title" required /></label><label class="wide"
						>Description<textarea name="description" rows="3" required></textarea></label
					><label>Location<input name="locationDescription" /></label><label class="wide"
						>Immediate action taken<textarea name="immediateActionTaken" rows="2"></textarea></label
					>
					<div class="form-actions wide"><button type="submit">Report observation</button></div>
				</form>
			</section>
		{/if}
	{/if}

	{#if data.canLinkEvidence && selectedProject}
		<section class="form-panel" id="link-evidence">
			<div>
				<p class="eyebrow">Controlled information</p>
				<h2>Link photo or evidence revision</h2>
				<p>
					Evidence remains an exact issued project-information revision; Site does not create a
					second file store.
				</p>
			</div>
			<form method="POST" action="?/linkEvidence" class="form-grid">
				<input type="hidden" name="projectPublicId" value={selectedProject.publicId} />
				<label
					>Record type<select name="subjectType"
						><option value="diary">Site diary</option><option value="defect">Defect</option><option
							value="ncr">NCR</option
						><option value="safety">Safety event</option></select
					></label
				>
				<label
					>Record<select name="subjectPublicId" required
						><option value="">Select field record</option>{#each data.diaries as row}<option
								value={row.publicId}
								>Diary · {shortDate(row.diaryDate)} · {siteName(row.projectSiteId)}</option
							>{/each}{#each data.defects as row}<option value={row.publicId}
								>Defect · {row.defectNumber} · {row.title}</option
							>{/each}{#each data.ncrs as row}<option value={row.publicId}
								>NCR · {row.ncrNumber} · {row.title}</option
							>{/each}{#each data.safetyEvents as row}<option value={row.publicId}
								>Safety · {row.eventNumber} · {row.title}</option
							>{/each}</select
					></label
				>
				<label class="wide"
					>Issued information revision<select name="informationVersionPublicId" required
						>{#each data.evidenceVersions as version}<option value={version.publicId}
								>{version.containerNumber} · {version.title} · {version.revisionCode}</option
							>{/each}</select
					></label
				>
				<label
					>Link role<select name="linkRole"
						><option value="photo">Photo</option><option value="evidence">Evidence</option></select
					></label
				>
				<div class="form-actions"><button type="submit">Link controlled evidence</button></div>
			</form>
		</section>
	{/if}
{/if}

<style>
	:global(body) {
		overflow-x: hidden;
	}
	.page-header,
	.section-heading,
	.record-card header,
	.inline-actions,
	.action-row > div {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		justify-content: space-between;
	}
	.page-header {
		margin-bottom: 1.25rem;
	}
	.page-header h1,
	.section-heading h2,
	.form-panel h2 {
		margin: 0.15rem 0 0.35rem;
	}
	.page-header p,
	.section-heading p,
	.form-panel p {
		max-width: 72ch;
	}
	.eyebrow {
		margin: 0;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-text-muted, #667085);
	}
	.header-action,
	button {
		min-height: 2.75rem;
		border: 0;
		border-radius: 0.65rem;
		padding: 0.65rem 0.95rem;
		background: var(--color-action, #183153);
		color: white;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	button:hover,
	.header-action:hover {
		filter: brightness(1.08);
	}
	.error,
	.notice {
		padding: 1rem;
		border-radius: 0.75rem;
		background: var(--color-surface-warning, #fff4e5);
		margin: 1rem 0;
	}
	.project-filter,
	.form-panel,
	.workspace-section,
	.metrics {
		margin: 1.1rem 0;
	}
	.project-filter form {
		max-width: 42rem;
	}
	.project-filter label {
		display: grid;
		gap: 0.4rem;
		font-weight: 700;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.metrics article {
		padding: 1rem;
		border: 1px solid var(--color-border, #d0d5dd);
		border-radius: 0.8rem;
		background: var(--color-surface, white);
	}
	.metrics span {
		display: block;
		color: var(--color-text-muted, #667085);
		font-size: 0.85rem;
	}
	.metrics strong {
		display: block;
		margin-top: 0.25rem;
		font-size: 1.6rem;
	}
	.workspace-section,
	.form-panel {
		padding: 1rem;
		border: 1px solid var(--color-border, #d0d5dd);
		border-radius: 0.9rem;
		background: var(--color-surface, white);
	}
	.section-heading {
		align-items: center;
		margin-bottom: 0.85rem;
	}
	.count {
		min-width: 2rem;
		height: 2rem;
		display: inline-grid;
		place-items: center;
		border-radius: 999px;
		background: var(--color-surface-subtle, #f2f4f7);
		font-weight: 800;
	}
	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.8rem;
	}
	.register-list {
		display: grid;
		gap: 0.85rem;
	}
	.record-card {
		min-width: 0;
		padding: 1rem;
		border: 1px solid var(--color-border, #d0d5dd);
		border-radius: 0.75rem;
		background: var(--color-surface-subtle, #fcfcfd);
	}
	.record-card h3,
	.record-card h4 {
		margin: 0.15rem 0 0.35rem;
		overflow-wrap: anywhere;
	}
	.reference {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 800;
		color: var(--color-text-muted, #667085);
	}
	.muted {
		color: var(--color-text-muted, #667085);
		font-size: 0.87rem;
	}
	.status,
	.result {
		display: inline-flex;
		align-items: center;
		width: fit-content;
		border-radius: 999px;
		padding: 0.2rem 0.55rem;
		background: var(--color-surface-subtle, #eef2f6);
		font-size: 0.74rem;
		font-weight: 800;
		text-transform: capitalize;
		white-space: nowrap;
	}
	.result-pass {
		background: #e8f7ee;
	}
	.result-fail {
		background: #fdecec;
	}
	.empty-state {
		padding: 1.1rem;
		border-radius: 0.7rem;
		background: var(--color-surface-subtle, #f8fafc);
	}
	.empty-state h3 {
		margin-top: 0;
	}
	.form-panel > div:first-child {
		margin-bottom: 0.8rem;
	}
	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}
	.form-grid label,
	.stack-form label,
	.inline-form label {
		display: grid;
		gap: 0.35rem;
		min-width: 0;
		font-weight: 700;
	}
	.form-grid .wide {
		grid-column: 1 / -1;
	}
	.form-actions {
		display: flex;
		align-items: end;
	}
	input,
	select,
	textarea {
		box-sizing: border-box;
		width: 100%;
		max-width: 100%;
		min-height: 2.75rem;
		border: 1px solid var(--color-border, #b8c0cc);
		border-radius: 0.55rem;
		padding: 0.65rem 0.7rem;
		background: var(--color-surface, white);
		color: inherit;
		font: inherit;
	}
	textarea {
		min-height: 5rem;
		resize: vertical;
	}
	input:focus-visible,
	select:focus-visible,
	textarea:focus-visible,
	button:focus-visible,
	summary:focus-visible,
	a:focus-visible {
		outline: 3px solid var(--color-focus, #6aa9ff);
		outline-offset: 2px;
	}
	.checkbox {
		display: flex !important;
		flex-direction: row;
		align-items: center;
		gap: 0.55rem !important;
		min-height: 2.75rem;
	}
	.checkbox input {
		width: 1.2rem;
		min-height: 1.2rem;
	}
	small {
		font-weight: 400;
		color: var(--color-text-muted, #667085);
	}
	.inline-actions,
	.inline-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: end;
	}
	.inline-form {
		margin-top: 0.6rem;
	}
	.inline-form label {
		flex: 1 1 12rem;
	}
	.stack-form {
		display: grid;
		gap: 0.65rem;
		margin-top: 0.65rem;
	}
	details {
		margin-top: 0.7rem;
	}
	summary {
		cursor: pointer;
		font-weight: 800;
		min-height: 2.4rem;
		display: flex;
		align-items: center;
	}
	.checklist {
		display: grid;
		gap: 0.7rem;
		margin: 0.8rem 0;
	}
	.check-item {
		padding: 0.75rem;
		border-left: 3px solid var(--color-border, #98a2b3);
		background: var(--color-surface, white);
	}
	.check-item > div:first-child {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		align-items: center;
		justify-content: space-between;
	}
	.finding-list,
	.action-list {
		margin: 0.8rem 0;
		padding: 0.75rem;
		border-radius: 0.6rem;
		background: var(--color-surface, white);
	}
	.finding-list h4,
	.action-list h4 {
		margin-top: 0;
	}
	.action-row {
		padding: 0.6rem 0;
		border-top: 1px solid var(--color-border, #e4e7ec);
	}
	.action-row:first-of-type {
		border-top: 0;
	}

	@media (max-width: 820px) {
		.metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.page-header {
			flex-direction: column;
		}
		.header-action {
			width: 100%;
			box-sizing: border-box;
		}
	}
	@media (max-width: 620px) {
		.metrics,
		.form-grid,
		.card-grid {
			grid-template-columns: 1fr;
		}
		.form-grid .wide {
			grid-column: auto;
		}
		.workspace-section,
		.form-panel {
			padding: 0.8rem;
			margin-inline: -0.2rem;
		}
		.record-card header,
		.section-heading {
			flex-direction: column;
		}
		.status {
			white-space: normal;
		}
		.inline-form {
			display: grid;
			grid-template-columns: 1fr;
		}
		.inline-form label,
		.inline-form button {
			width: 100%;
		}
	}
</style>
