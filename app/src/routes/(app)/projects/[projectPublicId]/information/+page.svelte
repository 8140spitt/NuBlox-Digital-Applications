<script lang="ts">
	let { data, form } = $props();

	const selectedRequirement = $derived(
		data.requirements.find((requirement) => requirement.publicId === data.selectedRequirementPublicId) ??
			null
	);

	const healthLabels: Record<string, string> = {
		draft: 'Draft',
		open: 'Open',
		overdue: 'Overdue',
		fulfilled: 'Fulfilled',
		withdrawn: 'Withdrawn'
	};

	const responsibilityLabels: Record<string, string> = {
		responsible: 'Responsible',
		accountable: 'Accountable',
		consulted: 'Consulted',
		informed: 'Informed'
	};

	function dateValue(value: Date | string | null): string {
		if (!value) return '';
		return new Date(value).toISOString().slice(0, 10);
	}

	function displayDate(value: Date | string | null): string {
		if (!value) return 'Not set';
		return new Date(value).toLocaleDateString('en-GB', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	function assignmentValue(organisationPublicId: string, roleKey: string): string {
		return `${organisationPublicId}|${roleKey}`;
	}
</script>

<svelte:head>
	<title>Information requirements · {data.project.name} · NuBlox</title>
</svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/projects">Projects</a>
	<span aria-hidden="true">/</span>
	<a href={`/projects/${data.project.publicId}`}>{data.project.projectNumber}</a>
	<span aria-hidden="true">/</span>
	<span>Information</span>
</nav>

<header class="workspace-header">
	<div>
		<p class="eyebrow">Design, engineering, BIM & CDE</p>
		<h1>Information requirements</h1>
		<p>
			Control OIR, AIR, PIR and EIR obligations against project roles and issued information in the
			canonical CDE.
		</p>
	</div>
	<a class="secondary-link" href={`/documents?project=${encodeURIComponent(data.project.publicId)}`}>
		Open CDE register
	</a>
</header>

<section class="metrics" aria-label="Information requirement summary">
	<article>
		<span>Total</span>
		<strong>{data.requirements.length}</strong>
	</article>
	<article>
		<span>Approved</span>
		<strong>{data.requirements.filter((requirement) => requirement.status === 'approved').length}</strong>
	</article>
	<article>
		<span>Fulfilled</span>
		<strong>{data.requirements.filter((requirement) => requirement.health === 'fulfilled').length}</strong>
	</article>
	<article>
		<span>Overdue</span>
		<strong>{data.requirements.filter((requirement) => requirement.health === 'overdue').length}</strong>
	</article>
</section>

{#if form?.informationError}
	<p class="error-banner" role="alert">{form.informationError}</p>
{/if}

<div class="workspace-grid">
	<aside class="register-panel">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Controlled register</p>
				<h2>Requirements</h2>
			</div>
			<span class="count">{data.requirements.length}</span>
		</div>

		{#if data.requirements.length === 0}
			<p class="empty-state">
				No information requirements have been recorded for this project yet.
			</p>
		{:else}
			<nav class="requirement-list" aria-label="Information requirements">
				{#each data.requirements as requirement}
					<a
						class:active={requirement.publicId === data.selectedRequirementPublicId}
						href={`?requirement=${encodeURIComponent(requirement.publicId)}`}
					>
						<div class="requirement-row-top">
							<code>{requirement.requirementCode}</code>
							<span class={`health health-${requirement.health}`}>
								{healthLabels[requirement.health] ?? requirement.health}
							</span>
						</div>
						<strong>{requirement.title}</strong>
						<small>{requirement.requirementType} · Due {displayDate(requirement.requiredByOn)}</small>
					</a>
				{/each}
			</nav>
		{/if}

		{#if data.canManage}
			<details class="create-panel" open={data.requirements.length === 0}>
				<summary>Create requirement</summary>
				<form method="POST" action="?/createRequirement" class="stack-form">
					<div class="field-grid two">
						<label>
							<span>Requirement code</span>
							<input name="requirementCode" maxlength="80" placeholder="PIR-001" required />
						</label>
						<label>
							<span>Type</span>
							<select name="requirementType" required>
								{#each data.requirementTypes as type}
									<option value={type.code}>{type.code} · {type.name}</option>
								{/each}
							</select>
						</label>
					</div>
					<label>
						<span>Title</span>
						<input name="title" maxlength="255" required />
					</label>
					<label>
						<span>Description</span>
						<textarea name="description" rows="3"></textarea>
					</label>
					<div class="field-grid two">
						<label>
							<span>Expected container type</span>
							<select name="containerTypeCode">
								<option value="">Any type</option>
								{#each data.containerTypes as type}
									<option value={type.code}>{type.name}</option>
								{/each}
							</select>
						</label>
						<label>
							<span>Required purpose</span>
							<select name="requiredPurposeCode">
								<option value="">Any purpose</option>
								{#each data.purposeCodes as purpose}
									<option value={purpose.code}>{purpose.code} · {purpose.name}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="field-grid two">
						<label>
							<span>Required suitability</span>
							<input name="requiredSuitabilityCode" maxlength="64" placeholder="Optional" />
						</label>
						<label>
							<span>Required by</span>
							<input name="requiredByOn" type="date" />
						</label>
					</div>
					<button type="submit">Create draft requirement</button>
				</form>
			</details>
		{/if}
	</aside>

	<main class="detail-panel">
		{#if selectedRequirement}
			<section class="detail-header">
				<div>
					<div class="detail-meta">
						<code>{selectedRequirement.requirementCode}</code>
						<span>{selectedRequirement.requirementType}</span>
						<span class={`health health-${selectedRequirement.health}`}>
							{healthLabels[selectedRequirement.health] ?? selectedRequirement.health}
						</span>
					</div>
					<h2>{selectedRequirement.title}</h2>
					{#if selectedRequirement.description}
						<p>{selectedRequirement.description}</p>
					{/if}
				</div>
			</section>

			<section class="control-summary">
				<dl>
					<div>
						<dt>Container type</dt>
						<dd>{selectedRequirement.containerTypeName ?? 'Any controlled type'}</dd>
					</div>
					<div>
						<dt>Purpose</dt>
						<dd>{selectedRequirement.requiredPurposeCode ?? 'Any purpose'}</dd>
					</div>
					<div>
						<dt>Suitability</dt>
						<dd>{selectedRequirement.requiredSuitabilityCode ?? 'Any suitability'}</dd>
					</div>
					<div>
						<dt>Required by</dt>
						<dd>{displayDate(selectedRequirement.requiredByOn)}</dd>
					</div>
				</dl>
			</section>

			{#if selectedRequirement.status === 'draft' && data.canManage}
				<details class="section-card">
					<summary>Edit draft requirement</summary>
					<form method="POST" action="?/updateRequirement" class="stack-form">
						<input
							type="hidden"
							name="requirementPublicId"
							value={selectedRequirement.publicId}
						/>
						<div class="field-grid two">
							<label>
								<span>Requirement code</span>
								<input
									name="requirementCode"
									maxlength="80"
									value={selectedRequirement.requirementCode}
									required
								/>
							</label>
							<label>
								<span>Type</span>
								<select name="requirementType" required>
									{#each data.requirementTypes as type}
										<option
											value={type.code}
											selected={type.code === selectedRequirement.requirementType}
										>{type.code} · {type.name}</option>
									{/each}
								</select>
							</label>
						</div>
						<label>
							<span>Title</span>
							<input name="title" maxlength="255" value={selectedRequirement.title} required />
						</label>
						<label>
							<span>Description</span>
							<textarea name="description" rows="3">{selectedRequirement.description ?? ''}</textarea>
						</label>
						<div class="field-grid two">
							<label>
								<span>Expected container type</span>
								<select name="containerTypeCode">
									<option value="">Any type</option>
									{#each data.containerTypes as type}
										<option
											value={type.code}
											selected={type.code === selectedRequirement.containerTypeCode}
										>{type.name}</option>
									{/each}
								</select>
							</label>
							<label>
								<span>Required purpose</span>
								<select name="requiredPurposeCode">
									<option value="">Any purpose</option>
									{#each data.purposeCodes as purpose}
										<option
											value={purpose.code}
											selected={purpose.code === selectedRequirement.requiredPurposeCode}
										>{purpose.code} · {purpose.name}</option>
									{/each}
								</select>
							</label>
						</div>
						<div class="field-grid two">
							<label>
								<span>Required suitability</span>
								<input
									name="requiredSuitabilityCode"
									maxlength="64"
									value={selectedRequirement.requiredSuitabilityCode ?? ''}
								/>
							</label>
							<label>
								<span>Required by</span>
								<input
									name="requiredByOn"
									type="date"
									value={dateValue(selectedRequirement.requiredByOn)}
								/>
							</label>
						</div>
						<button type="submit">Save draft</button>
					</form>
				</details>
			{/if}

			<section class="section-card">
				<div class="section-heading">
					<div>
						<p class="eyebrow">Responsibility matrix</p>
						<h3>RACI assignments</h3>
					</div>
					<span class="count">{selectedRequirement.responsibilities.length}</span>
				</div>

				{#if selectedRequirement.responsibilities.length > 0}
					<div class="assignment-list">
						{#each selectedRequirement.responsibilities as responsibility}
							<div>
								<span class={`responsibility responsibility-${responsibility.responsibilityCode}`}>
									{responsibilityLabels[responsibility.responsibilityCode]}
								</span>
								<strong>{responsibility.organisationName}</strong>
								<small>{responsibility.roleName}</small>
							</div>
						{/each}
					</div>
				{:else}
					<p class="empty-state">No project-role responsibilities have been assigned.</p>
				{/if}

				{#if selectedRequirement.status === 'draft' && data.canManageResponsibilities}
					<form method="POST" action="?/saveResponsibilities" class="raci-form">
						<input
							type="hidden"
							name="requirementPublicId"
							value={selectedRequirement.publicId}
						/>
						{#each ['responsible', 'accountable', 'consulted', 'informed'] as responsibilityCode}
							<label>
								<span>{responsibilityLabels[responsibilityCode]}</span>
								<select name={responsibilityCode} multiple size="4">
									{#each data.responsibilityOptions as option}
										<option
											value={assignmentValue(option.organisationPublicId, option.roleKey)}
											selected={selectedRequirement.responsibilities.some(
												(assignment) =>
													assignment.responsibilityCode === responsibilityCode &&
													assignment.organisationPublicId === option.organisationPublicId &&
													assignment.roleKey === option.roleKey
											)}
										>
											{option.organisationName} · {option.roleName}
										</option>
									{/each}
								</select>
							</label>
						{/each}
						<button type="submit">Save responsibility matrix</button>
					</form>
				{/if}
			</section>

			<section class="section-card">
				<div class="section-heading">
					<div>
						<p class="eyebrow">CDE fulfilment</p>
						<h3>Controlled information evidence</h3>
					</div>
					<span class="count">{selectedRequirement.evidence.length}</span>
				</div>
				<p class="section-copy">
					A linked container fulfils an approved requirement only when an issued revision matches the
					required purpose and suitability controls.
				</p>

				{#if selectedRequirement.evidence.length > 0}
					<div class="evidence-list">
						{#each selectedRequirement.evidence as evidence}
							<article>
								<div class="evidence-title">
									<div>
										<code>{evidence.containerNumber}</code>
										<strong>{evidence.containerTitle}</strong>
									</div>
									<span class:qualifying={evidence.qualifyingRevisionPublicId} class="evidence-state">
										{evidence.qualifyingRevisionPublicId ? 'Qualifying issue' : 'Awaiting qualifying issue'}
									</span>
								</div>
								<small>
									{evidence.containerTypeName} · {evidence.containerOwnerOrganisationName}
								</small>
								{#if evidence.qualifyingRevisionPublicId}
									<p>
										Revision {evidence.qualifyingRevisionCode} · Purpose
										{evidence.qualifyingPurposeCode ?? '—'} · Suitability
										{evidence.qualifyingSuitabilityCode ?? '—'}
									</p>
								{/if}
								{#if data.canLinkEvidence && selectedRequirement.status !== 'withdrawn'}
									<form method="POST" action="?/unlinkContainer">
										<input
											type="hidden"
											name="requirementPublicId"
											value={selectedRequirement.publicId}
										/>
										<input
											type="hidden"
											name="containerPublicId"
											value={evidence.containerPublicId}
										/>
										<button class="text-button" type="submit">Unlink evidence</button>
									</form>
								{/if}
							</article>
						{/each}
					</div>
				{:else}
					<p class="empty-state">No CDE containers are linked to this requirement.</p>
				{/if}

				{#if data.canLinkEvidence && selectedRequirement.status !== 'withdrawn'}
					<form method="POST" action="?/linkContainer" class="inline-form">
						<input
							type="hidden"
							name="requirementPublicId"
							value={selectedRequirement.publicId}
						/>
						<select name="containerPublicId" required>
							<option value="">Select CDE container</option>
							{#each data.containerOptions.filter(
								(container) =>
									!selectedRequirement.evidence.some(
										(evidence) => evidence.containerPublicId === container.publicId
									) &&
									(!selectedRequirement.containerTypeCode ||
										selectedRequirement.containerTypeCode === container.typeCode)
							) as container}
								<option value={container.publicId}>
									{container.containerNumber} · {container.title} · {container.typeName}
								</option>
							{/each}
						</select>
						<button type="submit">Link container</button>
					</form>
				{/if}
			</section>

			{#if selectedRequirement.status === 'draft' && data.canApprove}
				<section class="governance-card">
					<div>
						<p class="eyebrow">Governance gate</p>
						<h3>Approve controlled requirement</h3>
						<p>
							Approval locks the requirement definition and RACI matrix. At least one Responsible or
							Accountable project-role assignment is required.
						</p>
					</div>
					<form method="POST" action="?/approveRequirement">
						<input
							type="hidden"
							name="requirementPublicId"
							value={selectedRequirement.publicId}
						/>
						<button type="submit">Approve requirement</button>
					</form>
				</section>
			{:else if selectedRequirement.status === 'approved' && data.canApprove}
				<details class="governance-card danger-zone">
					<summary>Withdraw approved requirement</summary>
					<form method="POST" action="?/withdrawRequirement" class="stack-form">
						<input
							type="hidden"
							name="requirementPublicId"
							value={selectedRequirement.publicId}
						/>
						<label>
							<span>Withdrawal reason</span>
							<textarea name="reason" rows="3" maxlength="2000" required></textarea>
						</label>
						<button class="danger" type="submit">Withdraw requirement</button>
					</form>
				</details>
			{/if}

			{#if selectedRequirement.status === 'withdrawn'}
				<section class="withdrawal-note">
					<strong>Withdrawn {displayDate(selectedRequirement.withdrawnAt)}</strong>
					<p>{selectedRequirement.withdrawalReason}</p>
				</section>
			{/if}
		{:else}
			<section class="empty-detail">
				<p class="eyebrow">Information governance</p>
				<h2>Select a requirement</h2>
				<p>
					Use the controlled register to define what information is required, who is responsible and
					which issued CDE records satisfy the obligation.
				</p>
			</section>
		{/if}
	</main>
</div>

<style>
	:global(body) {
		background: #f5f7f8;
	}

	.breadcrumbs {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		font-size: 0.83rem;
		color: #64727b;
		margin-bottom: 1.15rem;
	}

	.breadcrumbs a {
		color: inherit;
	}

	.workspace-header {
		display: flex;
		justify-content: space-between;
		gap: 2rem;
		align-items: flex-start;
		margin-bottom: 1.3rem;
	}

	.workspace-header h1,
	.detail-header h2,
	.panel-heading h2,
	.section-heading h3,
	.governance-card h3,
	.empty-detail h2 {
		margin: 0;
		color: #17252e;
	}

	.workspace-header h1 {
		font-size: clamp(1.7rem, 3vw, 2.45rem);
	}

	.workspace-header > div > p:last-child {
		max-width: 58rem;
		color: #5c6c76;
		margin: 0.45rem 0 0;
	}

	.eyebrow {
		margin: 0 0 0.3rem;
		font-size: 0.72rem;
		font-weight: 750;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #64727b;
	}

	.secondary-link {
		white-space: nowrap;
		border: 1px solid #cad2d7;
		border-radius: 0.55rem;
		padding: 0.65rem 0.85rem;
		background: #fff;
		color: #23333d;
		font-weight: 650;
		text-decoration: none;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.8rem;
		margin-bottom: 1rem;
	}

	.metrics article {
		background: #fff;
		border: 1px solid #dde3e6;
		border-radius: 0.75rem;
		padding: 0.9rem 1rem;
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.metrics span {
		color: #687780;
		font-size: 0.83rem;
	}

	.metrics strong {
		font-size: 1.35rem;
		color: #17252e;
	}

	.error-banner {
		border: 1px solid #c77;
		background: #fff6f4;
		color: #7f2525;
		border-radius: 0.65rem;
		padding: 0.8rem 1rem;
	}

	.workspace-grid {
		display: grid;
		grid-template-columns: minmax(18rem, 0.75fr) minmax(0, 1.8fr);
		gap: 1rem;
		align-items: start;
	}

	.register-panel,
	.detail-panel {
		background: #fff;
		border: 1px solid #dde3e6;
		border-radius: 0.85rem;
		box-shadow: 0 1px 2px rgb(24 38 47 / 4%);
	}

	.register-panel {
		position: sticky;
		top: 1rem;
		overflow: hidden;
	}

	.detail-panel {
		padding: 1.15rem;
	}

	.panel-heading,
	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.panel-heading {
		padding: 1rem;
		border-bottom: 1px solid #e6eaec;
	}

	.panel-heading h2,
	.section-heading h3 {
		font-size: 1rem;
	}

	.count {
		min-width: 1.8rem;
		height: 1.8rem;
		padding: 0 0.45rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: #eef2f3;
		color: #44545e;
		font-size: 0.78rem;
		font-weight: 700;
	}

	.requirement-list {
		display: grid;
		max-height: 34rem;
		overflow: auto;
	}

	.requirement-list a {
		display: grid;
		gap: 0.34rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid #edf0f1;
		text-decoration: none;
		color: #263741;
	}

	.requirement-list a:hover,
	.requirement-list a.active {
		background: #f3f7f7;
	}

	.requirement-list a.active {
		box-shadow: inset 3px 0 0 #227a78;
	}

	.requirement-row-top,
	.detail-meta,
	.evidence-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
	}

	.requirement-list strong {
		font-size: 0.9rem;
	}

	.requirement-list small,
	.assignment-list small,
	.evidence-list small {
		color: #6b7a83;
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		color: #39515f;
	}

	.health,
	.responsibility,
	.evidence-state {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		padding: 0.2rem 0.48rem;
		font-size: 0.68rem;
		font-weight: 750;
		line-height: 1.2;
	}

	.health-draft {
		background: #eef1f3;
		color: #58666f;
	}

	.health-open {
		background: #edf4fa;
		color: #285d7d;
	}

	.health-overdue {
		background: #fff1ed;
		color: #9c3a22;
	}

	.health-fulfilled {
		background: #e8f5ef;
		color: #246548;
	}

	.health-withdrawn {
		background: #f2eff2;
		color: #6b5968;
	}

	.create-panel {
		padding: 0.9rem 1rem 1rem;
		border-top: 1px solid #e6eaec;
	}

	details > summary {
		cursor: pointer;
		font-weight: 700;
		color: #2a3d47;
	}

	.stack-form,
	.raci-form {
		display: grid;
		gap: 0.75rem;
		margin-top: 0.9rem;
	}

	.field-grid {
		display: grid;
		gap: 0.7rem;
	}

	.field-grid.two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.78rem;
		font-weight: 650;
		color: #4c5d66;
	}

	input,
	select,
	textarea {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #cbd4d8;
		border-radius: 0.45rem;
		background: #fff;
		padding: 0.58rem 0.65rem;
		font: inherit;
		color: #20313a;
	}

	textarea {
		resize: vertical;
	}

	button {
		justify-self: start;
		border: 0;
		border-radius: 0.48rem;
		background: #1f6666;
		color: #fff;
		font-weight: 700;
		padding: 0.6rem 0.8rem;
		cursor: pointer;
	}

	button.danger {
		background: #98372d;
	}

	.text-button {
		background: transparent;
		color: #8b3a32;
		padding: 0;
		font-size: 0.76rem;
	}

	.detail-header {
		padding-bottom: 1rem;
		border-bottom: 1px solid #e3e8ea;
	}

	.detail-header h2 {
		font-size: 1.35rem;
		margin-top: 0.45rem;
	}

	.detail-header p {
		color: #5a6b74;
		margin-bottom: 0;
	}

	.detail-meta {
		justify-content: flex-start;
		font-size: 0.75rem;
		color: #63727b;
	}

	.control-summary {
		padding: 1rem 0;
	}

	.control-summary dl {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.6rem;
		margin: 0;
	}

	.control-summary dl div {
		background: #f6f8f8;
		border-radius: 0.55rem;
		padding: 0.7rem;
	}

	.control-summary dt {
		font-size: 0.7rem;
		color: #6b7a82;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.control-summary dd {
		margin: 0.25rem 0 0;
		font-size: 0.84rem;
		font-weight: 650;
		color: #283a44;
	}

	.section-card,
	.governance-card,
	.withdrawal-note {
		border: 1px solid #e0e5e7;
		border-radius: 0.7rem;
		padding: 1rem;
		margin-top: 0.85rem;
	}

	.section-copy,
	.governance-card p,
	.withdrawal-note p {
		color: #63727b;
		font-size: 0.82rem;
	}

	.assignment-list,
	.evidence-list {
		display: grid;
		gap: 0.55rem;
		margin-top: 0.8rem;
	}

	.assignment-list > div {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) minmax(7rem, auto);
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid #eef1f2;
	}

	.responsibility-responsible {
		background: #e8f5ef;
		color: #246548;
	}

	.responsibility-accountable {
		background: #edf1fa;
		color: #3e527d;
	}

	.responsibility-consulted {
		background: #fff4e8;
		color: #89591f;
	}

	.responsibility-informed {
		background: #f0eff5;
		color: #625a7a;
	}

	.raci-form {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding-top: 0.8rem;
		border-top: 1px solid #e9edee;
	}

	.raci-form button {
		grid-column: 1 / -1;
	}

	.evidence-list article {
		border: 1px solid #e5e9eb;
		border-radius: 0.55rem;
		padding: 0.75rem;
	}

	.evidence-title > div {
		display: flex;
		gap: 0.55rem;
		align-items: baseline;
	}

	.evidence-state {
		background: #fff2e5;
		color: #8a5820;
	}

	.evidence-state.qualifying {
		background: #e8f5ef;
		color: #246548;
	}

	.evidence-list p {
		font-size: 0.76rem;
		color: #586a73;
		margin: 0.45rem 0;
	}

	.inline-form {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.55rem;
		align-items: center;
		margin-top: 0.85rem;
	}

	.governance-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		background: #f6f9f9;
	}

	.governance-card p {
		margin-bottom: 0;
		max-width: 42rem;
	}

	details.governance-card {
		display: block;
	}

	.danger-zone {
		background: #fff8f6;
		border-color: #ecd5ce;
	}

	.withdrawal-note {
		background: #f5f3f5;
		color: #5e505b;
	}

	.empty-state {
		color: #6b7a82;
		font-size: 0.82rem;
		padding: 0.75rem 1rem;
		margin: 0;
	}

	.empty-detail {
		padding: 3rem 1rem;
		text-align: center;
		color: #61717a;
	}

	.empty-detail p:last-child {
		max-width: 36rem;
		margin: 0.6rem auto 0;
	}

	@media (max-width: 980px) {
		.workspace-grid {
			grid-template-columns: 1fr;
		}

		.register-panel {
			position: static;
		}

		.metrics,
		.control-summary dl {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.workspace-header,
		.governance-card {
			flex-direction: column;
		}

		.metrics,
		.control-summary dl,
		.field-grid.two,
		.raci-form,
		.inline-form {
			grid-template-columns: 1fr;
		}

		.assignment-list > div {
			grid-template-columns: 1fr;
		}
	}
</style>