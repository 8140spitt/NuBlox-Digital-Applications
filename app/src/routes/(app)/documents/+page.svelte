<script lang="ts">
	let { data, form } = $props();

	const formatDate = (value: Date | string | null) =>
		value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
</script>

<svelte:head>
	<title>Documents · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Built Environment OS · Project information</p>
		<h1>Documents & information</h1>
		<p>
			Controlled project information keeps a stable document identity, immutable issued revisions,
			file metadata, RFIs, submittals and formal instructions in one auditable register.
		</p>
	</div>
	<div class="principle-card">
		<span>Package 007 rule</span>
		<strong>New revision, never overwrite</strong>
	</div>
</section>

{#if form?.error}<p class="error-banner" role="alert">{form.error}</p>{/if}

{#if !data.canView}
	<section class="notice">
		<h2>Project information access is not enabled</h2>
		<p>Your current role does not grant visibility to controlled project information.</p>
	</section>
{:else}
	<section class="summary-grid" aria-label="Project information summary">
		<article><span>Documents</span><strong>{data.documents.length}</strong></article>
		<article><span>RFIs</span><strong>{data.rfis.length}</strong></article>
		<article><span>Submittals</span><strong>{data.submittals.length}</strong></article>
		<article><span>Instructions</span><strong>{data.instructions.length}</strong></article>
	</section>

	<nav class="workspace-tabs" aria-label="Information registers">
		<a href="#document-register">Documents</a>
		<a href="#rfi-register">RFIs</a>
		<a href="#submittal-register">Submittals</a>
		<a href="#instruction-register">Instructions</a>
	</nav>

	<section class="workspace-section" id="document-register">
		<div class="section-heading">
			<div><p class="eyebrow">Controlled information</p><h2>Document register</h2></div>
			<span class="count">{data.documents.length}</span>
		</div>
		<p class="section-copy">
			Numbers, titles, discipline/classification metadata and revision status are structured so the
			register is ready for project/global search without parsing filenames.
		</p>

		{#if data.documents.length === 0}
			<div class="empty-state"><h3>No controlled documents yet</h3><p>Create the first stable document identity and draft revision below.</p></div>
		{:else}
			<div class="register-list">
				{#each data.documents as document}
					<article class="document-card">
						<header>
							<div>
								<p class="reference">{document.containerNumber}</p>
								<h3>{document.title}</h3>
								<p class="muted">{document.projectNumber} · {document.projectName} · {document.typeName}</p>
							</div>
							<span class="status">{document.lifecycleStatus}</span>
						</header>
						<div class="metadata-row">
							<span>Discipline · {document.disciplineCode ?? '—'}</span>
							<span>Classification · {document.classificationCode ?? '—'}</span>
						</div>

						{#if document.versions.length === 0}
							<p class="muted">No revisions recorded.</p>
						{:else}
							<div class="version-list">
								{#each document.versions as version}
									<article class="version-card">
										<div class="version-heading">
											<div><strong>{version.revisionCode}</strong><span>Sequence {version.versionSequence}</span></div>
											<span class:issued={version.status === 'issued'} class="status">{version.status}</span>
										</div>
										<p>{version.titleAtVersion}</p>
										<p class="metadata-row"><span>Purpose · {version.purposeCode ?? '—'}</span><span>Suitability · {version.suitabilityCode ?? '—'}</span><span>Locked · {formatDate(version.lockedAt)}</span></p>
										{#if version.files.length > 0}
											<div class="file-list" aria-label="Registered files">
												{#each version.files as file}
													<div><strong>{file.originalFilename}</strong><span>{file.fileRole} · {file.contentType ?? 'unknown type'} · scan {file.malwareScanStatus}</span><code>{file.checksumAlgorithm}:{file.checksumValue}</code></div>
												{/each}
											</div>
										{/if}

										{#if version.status === 'draft'}
											<div class="inline-actions">
												{#if data.canManage}
													<details>
														<summary>Edit draft metadata</summary>
														<form method="POST" action="?/updateRevision" class="stack-form compact-form">
															<input type="hidden" name="versionPublicId" value={version.publicId} />
															<label>Revision title<input name="titleAtVersion" value={version.titleAtVersion} required maxlength="500" /></label>
															<label>Purpose<select name="purposeCode"><option value="">No purpose code</option>{#each data.purposeCodes as purpose}<option value={purpose.code} selected={purpose.code === version.purposeCode}>{purpose.code} · {purpose.name}</option>{/each}</select></label>
															<label>Suitability<input name="suitabilityCode" value={version.suitabilityCode ?? ''} maxlength="64" /></label>
															<button type="submit">Save draft</button>
														</form>
													</details>
												{/if}
												{#if data.canManageFiles}
													<details>
														<summary>Register file metadata</summary>
														<form method="POST" action="?/registerFile" class="stack-form compact-form">
															<input type="hidden" name="versionPublicId" value={version.publicId} />
															<label>Role<select name="fileRole"><option value="authoritative">Authoritative</option><option value="native">Native</option><option value="rendition">Rendition</option><option value="thumbnail">Thumbnail</option><option value="attachment">Attachment</option></select></label>
															<div class="two-up"><label>Storage provider<input name="storageProvider" value="object-storage" required maxlength="64" /></label><label>Bucket / container<input name="storageBucket" required maxlength="255" /></label></div>
															<label>Object key<input name="storageKey" required maxlength="1000" /></label>
															<div class="two-up"><label>Original filename<input name="originalFilename" required maxlength="500" /></label><label>Content type<input name="contentType" maxlength="255" placeholder="application/pdf" /></label></div>
															<div class="two-up"><label>Size bytes<input name="sizeBytes" inputmode="numeric" required /></label><label>Checksum algorithm<input name="checksumAlgorithm" value="sha256" required maxlength="32" /></label></div>
															<label>Checksum value<input name="checksumValue" required maxlength="256" /></label>
															<button type="submit">Register file metadata</button>
														</form>
													</details>
												{/if}
												{#if data.canIssue}
													<form method="POST" action="?/issueRevision" class="issue-form">
														<input type="hidden" name="versionPublicId" value={version.publicId} />
														<input type="hidden" name="channel" value="portal" />
														<button type="submit" class="primary">Issue {version.revisionCode}</button>
													</form>
												{/if}
											</div>
										{/if}
									</article>
								{/each}
							</div>
						{/if}

						{#if data.canManage}
							<details class="new-revision">
								<summary>Create a new revision</summary>
								<form method="POST" action="?/createRevision" class="stack-form compact-form">
									<input type="hidden" name="containerPublicId" value={document.publicId} />
									<div class="two-up"><label>Revision code<input name="revisionCode" required maxlength="80" /></label><label>Suitability<input name="suitabilityCode" maxlength="64" /></label></div>
									<label>Revision title<input name="titleAtVersion" value={document.title} required maxlength="500" /></label>
									<label>Purpose<select name="purposeCode"><option value="">No purpose code</option>{#each data.purposeCodes as purpose}<option value={purpose.code}>{purpose.code} · {purpose.name}</option>{/each}</select></label>
									<button type="submit">Create revision</button>
								</form>
							</details>
						{/if}
					</article>
				{/each}
			</div>
		{/if}

		{#if data.canManage}
			<section class="action-panel" id="create-document">
				<p class="eyebrow">Register information</p><h3>Create controlled document</h3>
				<form method="POST" action="?/createDocument" class="stack-form">
					<label>Project<select name="projectPublicId" required><option value="">Select project</option>{#each data.projects as project}<option value={project.publicId}>{project.projectNumber} · {project.name}</option>{/each}</select></label>
					<div class="two-up"><label>Document type<select name="typeCode" required><option value="">Select type</option>{#each data.containerTypes as type}<option value={type.code}>{type.name}</option>{/each}</select></label><label>Document number<input name="containerNumber" required maxlength="160" /></label></div>
					<label>Title<input name="title" required maxlength="500" /></label>
					<div class="two-up"><label>Discipline code<input name="disciplineCode" maxlength="64" /></label><label>Classification code<input name="classificationCode" maxlength="120" /></label></div>
					<div class="two-up"><label>Initial revision<input name="revisionCode" value="P01" required maxlength="80" /></label><label>Suitability<input name="suitabilityCode" maxlength="64" /></label></div>
					<label>Purpose<select name="purposeCode"><option value="">No purpose code</option>{#each data.purposeCodes as purpose}<option value={purpose.code}>{purpose.code} · {purpose.name}</option>{/each}</select></label>
					<button type="submit" class="primary">Create document</button>
				</form>
			</section>
		{/if}
	</section>

	<section class="workspace-section" id="rfi-register">
		<div class="section-heading"><div><p class="eyebrow">Questions & responses</p><h2>RFI register</h2></div><span class="count">{data.rfis.length}</span></div>
		<div class="register-list">
			{#each data.rfis as rfi}
				<article class="workflow-card">
					<header><div><p class="reference">{rfi.rfiNumber}</p><h3>{rfi.subject}</h3><p class="muted">{rfi.projectNumber} · {rfi.projectName}</p></div><span class="status">{rfi.status}</span></header>
					<p>{rfi.question}</p><p class="metadata-row"><span>Priority · {rfi.priority}</span><span>Due · {formatDate(rfi.dueAt)}</span></p>
					<div class="inline-actions">
						{#if data.canManageRfis && rfi.status === 'draft'}<form method="POST" action="?/openRfi"><input type="hidden" name="rfiPublicId" value={rfi.publicId} /><button type="submit">Open RFI</button></form>{/if}
						{#if data.canRespondRfis && (rfi.status === 'open' || rfi.status === 'reopened')}
							<details><summary>Record response</summary><form method="POST" action="?/respondRfi" class="stack-form compact-form"><input type="hidden" name="rfiPublicId" value={rfi.publicId} /><label>Response<textarea name="responseText" rows="4" required></textarea></label><input type="hidden" name="final" value="true" /><button type="submit">Record final response</button></form></details>
						{/if}
						{#if data.canManageRfis && rfi.status === 'answered'}<form method="POST" action="?/closeRfi"><input type="hidden" name="rfiPublicId" value={rfi.publicId} /><button type="submit">Close RFI</button></form>{/if}
					</div>
				</article>
			{/each}
		</div>
		{#if data.canManageRfis}
			<section class="action-panel" id="create-rfi"><p class="eyebrow">Request information</p><h3>Create RFI</h3><form method="POST" action="?/createRfi" class="stack-form">
				<label>Project<select name="projectPublicId" required><option value="">Select project</option>{#each data.projects as project}<option value={project.publicId}>{project.projectNumber} · {project.name}</option>{/each}</select></label>
				<div class="two-up"><label>RFI number<input name="rfiNumber" required maxlength="120" /></label><label>Priority<select name="priority"><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div>
				<label>Subject<input name="subject" required maxlength="500" /></label><label>Question<textarea name="question" rows="4" required></textarea></label><label>Due<input type="datetime-local" name="dueAt" /></label><button type="submit">Create RFI draft</button>
			</form></section>
		{/if}
	</section>

	<section class="workspace-section" id="submittal-register">
		<div class="section-heading"><div><p class="eyebrow">Controlled review</p><h2>Submittal register</h2></div><span class="count">{data.submittals.length}</span></div>
		<div class="register-list">
			{#each data.submittals as submittal}
				<article class="workflow-card"><header><div><p class="reference">{submittal.submittalNumber}</p><h3>{submittal.title}</h3><p class="muted">{submittal.projectNumber} · {submittal.typeName}</p></div><span class="status">{submittal.status}</span></header><p class="metadata-row"><span>Due · {formatDate(submittal.dueAt)}</span><span>Submitted · {formatDate(submittal.submittedAt)}</span></p>
					<div class="inline-actions">{#if data.canManageSubmittals && submittal.status === 'draft'}<form method="POST" action="?/submitSubmittal"><input type="hidden" name="submittalPublicId" value={submittal.publicId} /><button type="submit">Submit</button></form>{/if}
					{#if data.canReviewSubmittals && (submittal.status === 'submitted' || submittal.status === 'under_review')}<details><summary>Record review</summary><form method="POST" action="?/reviewSubmittal" class="stack-form compact-form"><input type="hidden" name="submittalPublicId" value={submittal.publicId} /><label>Outcome<select name="outcome"><option value="approved">Approved</option><option value="approved_with_comments">Approved with comments</option><option value="revise_resubmit">Revise and resubmit</option><option value="rejected">Rejected</option><option value="no_objection">No objection</option><option value="for_information">For information</option></select></label><label>Comments<textarea name="comments" rows="3"></textarea></label><button type="submit">Record review</button></form></details>{/if}</div>
				</article>
			{/each}
		</div>
		{#if data.canManageSubmittals}<section class="action-panel" id="create-submittal"><p class="eyebrow">Submit information</p><h3>Create submittal</h3><form method="POST" action="?/createSubmittal" class="stack-form">
			<label>Project<select name="projectPublicId" required><option value="">Select project</option>{#each data.projects as project}<option value={project.publicId}>{project.projectNumber} · {project.name}</option>{/each}</select></label>
			<div class="two-up"><label>Submittal number<input name="number" required maxlength="120" /></label><label>Type<select name="typeCode" required><option value="">Select type</option>{#each data.submittalTypes as type}<option value={type.code}>{type.name}</option>{/each}</select></label></div><label>Title<input name="title" required maxlength="500" /></label>
			<label>Document revision (optional)<select name="versionPublicId"><option value="">No linked revision</option>{#each data.documents as document}{#each document.versions as version}<option value={version.publicId}>{document.containerNumber} · {version.revisionCode} · {document.title}</option>{/each}{/each}</select></label><label>Review due<input type="datetime-local" name="dueAt" /></label><button type="submit">Create submittal draft</button>
		</form></section>{/if}
	</section>

	<section class="workspace-section" id="instruction-register">
		<div class="section-heading"><div><p class="eyebrow">Formal direction</p><h2>Instruction register</h2></div><span class="count">{data.instructions.length}</span></div>
		<div class="register-list">{#each data.instructions as instruction}<article class="workflow-card"><header><div><p class="reference">{instruction.instructionNumber}</p><h3>{instruction.subject}</h3><p class="muted">{instruction.projectNumber} · {instruction.typeName}</p></div><span class="status">{instruction.status}</span></header><p>{instruction.instructionText}</p><p class="metadata-row"><span>Issued · {formatDate(instruction.issuedAt)}</span></p>{#if data.canIssueInstructions && instruction.status === 'draft'}<form method="POST" action="?/issueInstruction"><input type="hidden" name="instructionPublicId" value={instruction.publicId} /><button type="submit" class="primary">Issue instruction</button></form>{/if}</article>{/each}</div>
		{#if data.canManageInstructions}<section class="action-panel" id="create-instruction"><p class="eyebrow">Formal project record</p><h3>Create instruction</h3><form method="POST" action="?/createInstruction" class="stack-form"><label>Project<select name="projectPublicId" required><option value="">Select project</option>{#each data.projects as project}<option value={project.publicId}>{project.projectNumber} · {project.name}</option>{/each}</select></label><div class="two-up"><label>Instruction number<input name="number" required maxlength="120" /></label><label>Type<select name="typeCode" required><option value="">Select type</option>{#each data.instructionTypes as type}<option value={type.code}>{type.name}</option>{/each}</select></label></div><label>Subject<input name="subject" required maxlength="500" /></label><label>Instruction<textarea name="instructionText" rows="5" required></textarea></label><button type="submit">Create instruction draft</button></form></section>{/if}
	</section>
{/if}

<style>
	.page-header,.section-heading,.document-card header,.workflow-card header,.version-heading{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.page-header{margin-bottom:1.5rem}.page-header h1{margin:.15rem 0 .45rem;font-size:clamp(2rem,4vw,3.2rem)}.page-header p{max-width:72ch}.eyebrow{margin:0;text-transform:uppercase;letter-spacing:.12em;font-size:.75rem;font-weight:800;color:var(--nublox-text-muted,#5d6675)}.principle-card,.summary-grid article,.workspace-section,.action-panel,.document-card,.workflow-card,.notice{border:1px solid var(--nublox-border,#d9dde5);border-radius:1rem;background:var(--nublox-surface,#fff);box-shadow:0 10px 30px rgba(31,41,55,.05)}.principle-card{padding:1rem 1.2rem;min-width:15rem}.principle-card span,.principle-card strong{display:block}.principle-card span{font-size:.78rem;color:#667085}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem;margin-bottom:1rem}.summary-grid article{padding:1rem}.summary-grid span{display:block;color:#667085;font-size:.82rem}.summary-grid strong{font-size:1.8rem}.workspace-tabs{display:flex;gap:.5rem;overflow:auto;padding:.2rem 0 1rem}.workspace-tabs a{white-space:nowrap;text-decoration:none;color:inherit;border:1px solid #d9dde5;border-radius:999px;padding:.55rem .85rem;background:#fff}.workspace-section{padding:1.25rem;margin-bottom:1.25rem;scroll-margin-top:5rem}.section-heading h2,.action-panel h3{margin:.15rem 0}.count,.status{border-radius:999px;padding:.28rem .58rem;font-size:.75rem;font-weight:800;background:#eef2f6;text-transform:capitalize}.status.issued{background:#e8f5ee;color:#17623a}.section-copy,.muted{color:#667085}.register-list{display:grid;gap:.9rem;margin-top:1rem}.document-card,.workflow-card{padding:1rem;box-shadow:none}.reference{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;margin:0 0 .2rem}.document-card h3,.workflow-card h3{margin:.15rem 0}.metadata-row{display:flex;gap:1rem;flex-wrap:wrap;color:#667085;font-size:.82rem}.version-list{display:grid;gap:.7rem;margin-top:.9rem}.version-card{border-left:3px solid #d9dde5;padding:.7rem .85rem;background:#fafbfc;border-radius:.5rem}.version-heading>div{display:flex;gap:.7rem;align-items:baseline}.version-heading span{font-size:.78rem;color:#667085}.file-list{display:grid;gap:.45rem;margin:.65rem 0}.file-list div{display:grid;gap:.15rem;border:1px dashed #d9dde5;padding:.55rem;border-radius:.5rem}.file-list span,.file-list code{font-size:.76rem;color:#667085;overflow-wrap:anywhere}.inline-actions{display:flex;gap:.65rem;flex-wrap:wrap;align-items:flex-start;margin-top:.65rem}.inline-actions details,.new-revision{border:1px solid #d9dde5;border-radius:.6rem;padding:.55rem;background:#fff}.inline-actions summary,.new-revision summary{cursor:pointer;font-weight:700}.new-revision{margin-top:.8rem}.action-panel{padding:1rem;margin-top:1rem;background:#fafbfc}.stack-form{display:grid;gap:.75rem;margin-top:.75rem}.stack-form label{display:grid;gap:.3rem;font-weight:700;font-size:.88rem}.stack-form input,.stack-form select,.stack-form textarea{font:inherit;border:1px solid #cfd5df;border-radius:.55rem;padding:.65rem;background:#fff;color:inherit;min-width:0}.two-up{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem}.compact-form{min-width:min(31rem,75vw);margin-top:.65rem}.stack-form button,form>button{justify-self:start;border:0;border-radius:.6rem;padding:.65rem .9rem;font:inherit;font-weight:800;cursor:pointer;background:#e8ebf0;color:#1d2939}.stack-form button.primary,button.primary{background:#172b4d;color:#fff}.issue-form{display:inline}.empty-state,.error-banner{padding:1rem;border-radius:.75rem}.empty-state{background:#f7f8fa}.error-banner{background:#fff0f0;color:#9f1d1d;border:1px solid #f2b8b5;margin-bottom:1rem}.notice{padding:1.2rem}@media(max-width:800px){.page-header{display:grid}.principle-card{min-width:0}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.two-up{grid-template-columns:1fr}.compact-form{min-width:0;width:min(100%,80vw)}.workspace-section{padding:1rem}.document-card header,.workflow-card header{display:grid}.metadata-row{gap:.45rem 1rem}}@media(max-width:480px){.summary-grid{grid-template-columns:1fr}.workspace-tabs{margin-inline:-.4rem}.compact-form{width:72vw}}
</style>
