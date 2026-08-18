<script lang="ts">
	let { data, form } = $props();
	const activeRoleCodes = $derived(new Set(data.party.roles.map((role) => role.code)));
	const statusLabels: Record<string, string> = {
		active: 'Active',
		inactive: 'Inactive',
		archived: 'Archived'
	};
</script>

<svelte:head>
	<title>{data.party.displayName} · CRM · NuBlox</title>
</svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/crm">CRM</a>
	<span aria-hidden="true">/</span>
	<span>{data.party.displayName}</span>
</nav>

<section class="party-header">
	<div>
		<div class="header-meta">
			<span>{data.party.kind === 'organisation' ? 'Organisation' : 'Person'}</span>
			<span class={`status status-${data.party.status}`}
				>{statusLabels[data.party.status] ?? data.party.status}</span
			>
		</div>
		<h1>{data.party.displayName}</h1>
		<div class="role-list">
			{#if data.party.roles.length > 0}
				{#each data.party.roles as role}<span>{role.name}</span>{/each}
			{:else}
				<em>No business role assigned</em>
			{/if}
		</div>
	</div>
</section>

<div class="workspace-grid">
	<section class="panel summary">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Record</p>
				<h2>CRM identity</h2>
			</div>
		</div>
		<dl>
			<div>
				<dt>Type</dt>
				<dd>{data.party.kind === 'organisation' ? 'Organisation' : 'Person'}</dd>
			</div>
			<div>
				<dt>Status</dt>
				<dd>{statusLabels[data.party.status]}</dd>
			</div>
			<div>
				<dt>Email</dt>
				<dd>{data.party.primaryEmail ?? 'Not recorded'}</dd>
			</div>
			<div>
				<dt>Phone</dt>
				<dd>{data.party.primaryPhone ?? 'Not recorded'}</dd>
			</div>
			<div>
				<dt>Created</dt>
				<dd>{new Date(data.party.createdAt).toLocaleDateString()}</dd>
			</div>
			<div>
				<dt>Updated</dt>
				<dd>{new Date(data.party.updatedAt).toLocaleDateString()}</dd>
			</div>
		</dl>
		<p class="private-note">
			This record belongs only to the active NuBlox organisation. It is not a platform-wide identity
			record.
		</p>
	</section>

	<section class="panel details">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Details</p>
				<h2>{data.canManage ? 'Maintain record' : 'Record details'}</h2>
			</div>
		</div>

		{#if data.canManage}
			<form method="POST" action="?/update" class="edit-form">
				{#if data.party.kind === 'organisation'}
					<label class="wide">
						<span>Legal name</span>
						<input name="legalName" maxlength="255" required value={data.party.legalName ?? ''} />
					</label>
					<label class="wide">
						<span>Trading name <small>optional</small></span>
						<input name="tradingName" maxlength="255" value={data.party.tradingName ?? ''} />
					</label>
				{:else}
					<label>
						<span>Honorific</span>
						<input name="honorific" maxlength="64" value={data.party.honorific ?? ''} />
					</label>
					<label>
						<span>Given names</span>
						<input name="givenNames" maxlength="200" value={data.party.givenNames ?? ''} />
					</label>
					<label>
						<span>Family name</span>
						<input name="familyName" maxlength="160" value={data.party.familyName ?? ''} />
					</label>
					<label>
						<span>Preferred name</span>
						<input name="preferredName" maxlength="160" value={data.party.preferredName ?? ''} />
					</label>
				{/if}

				<label>
					<span>Primary email</span>
					<input
						name="primaryEmail"
						type="email"
						maxlength="320"
						value={data.party.primaryEmail ?? ''}
					/>
				</label>
				<label>
					<span>Primary phone <small>E.164</small></span>
					<input
						name="primaryPhone"
						maxlength="32"
						value={data.party.primaryPhone ?? ''}
						placeholder="+442071234567"
					/>
				</label>
				<label>
					<span>Status</span>
					<select name="status">
						<option value="active" selected={data.party.status === 'active'}>Active</option>
						<option value="inactive" selected={data.party.status === 'inactive'}>Inactive</option>
						<option value="archived" selected={data.party.status === 'archived'}>Archived</option>
					</select>
				</label>

				<fieldset class="wide role-fieldset">
					<legend>Business roles</legend>
					<div class="role-options">
						{#each data.roleTypes as role}
							<label>
								<input
									type="checkbox"
									name="roleCode"
									value={role.code}
									checked={activeRoleCodes.has(role.code)}
								/>
								<span>{role.name}</span>
							</label>
						{/each}
					</div>
				</fieldset>

				{#if form?.updateError}<p class="error wide" role="alert">{form.updateError}</p>{/if}
				<button type="submit">Save CRM record</button>
			</form>
		{:else}
			<p class="muted">
				You have CRM read access but not <code>crm.party.manage</code> (or its
				<code>crm.manage</code> umbrella).
			</p>
		{/if}
	</section>

	{#if data.party.kind === 'organisation'}
		<section id="contacts" class="panel contacts full-width">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">Contacts</p>
					<h2>People at this organisation</h2>
				</div>
				<span class="count">{data.contacts.length}</span>
			</div>

			{#if form?.contactActionError}<p class="error" role="alert">{form.contactActionError}</p>{/if}

			{#if data.contacts.length === 0}
				<p class="muted">No current contacts are linked to this organisation.</p>
			{:else}
				<div class="contact-list">
					{#each data.contacts as contact}
						<div class="contact-row">
							<div>
								<a href={`/crm/${contact.personPublicId}`}><strong>{contact.displayName}</strong></a
								>
								<span
									>{[contact.jobTitle, contact.department].filter(Boolean).join(' · ') ||
										'Contact'}</span
								>
							</div>
							<div class="contact-methods">
								{#if contact.primaryEmail}<span>{contact.primaryEmail}</span>{/if}
								{#if contact.primaryPhone}<span>{contact.primaryPhone}</span>{/if}
							</div>
							{#if contact.isPrimaryContact}<span class="primary-badge">Primary contact</span>{/if}
							{#if data.canManageContacts}
								<div class="row-actions">
									{#if !contact.isPrimaryContact}
										<form method="POST" action="?/makePrimaryContact">
											<input
												type="hidden"
												name="personPartyPublicId"
												value={contact.personPublicId}
											/>
											<button class="secondary-button" type="submit">Make primary</button>
										</form>
									{/if}
									<form method="POST" action="?/endContact">
										<input
											type="hidden"
											name="personPartyPublicId"
											value={contact.personPublicId}
										/>
										<button class="danger-button" type="submit">End relationship</button>
									</form>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if data.canManageContacts && data.party.status !== 'archived'}
				<div class="contact-admin-grid">
					<section class="subpanel">
						<h3>Create a new contact</h3>
						<p>
							Create the person once in this CRM and link their current role at this organisation.
						</p>
						<form method="POST" action="?/createContact" class="compact-form">
							<div class="two-col">
								<label><span>Given names</span><input name="givenNames" maxlength="200" /></label>
								<label><span>Family name</span><input name="familyName" maxlength="160" /></label>
								<label
									><span>Preferred name</span><input name="preferredName" maxlength="160" /></label
								>
								<label><span>Honorific</span><input name="honorific" maxlength="64" /></label>
								<label
									><span>Email</span><input
										name="primaryEmail"
										type="email"
										maxlength="320"
									/></label
								>
								<label
									><span>Phone <small>E.164</small></span><input
										name="primaryPhone"
										maxlength="32"
										placeholder="+442071234567"
									/></label
								>
								<label><span>Job title</span><input name="jobTitle" maxlength="200" /></label>
								<label><span>Department</span><input name="department" maxlength="200" /></label>
							</div>
							<label class="check-label"
								><input type="checkbox" name="isPrimaryContact" />
								<span>Primary contact for this organisation</span></label
							>
							{#if form?.contactError}<p class="error" role="alert">{form.contactError}</p>{/if}
							<button type="submit">Create contact</button>
						</form>
					</section>

					<section class="subpanel">
						<h3>Link an existing person</h3>
						<p>Use this when the person already exists elsewhere in this tenant's CRM.</p>
						{#if data.contactCandidates.length > 0}
							<form method="POST" action="?/linkContact" class="compact-form">
								<label>
									<span>Person</span>
									<select name="personPartyPublicId" required>
										<option value="">Choose a person</option>
										{#each data.contactCandidates as person}
											<option value={person.publicId}>{person.displayName}</option>
										{/each}
									</select>
								</label>
								<div class="two-col">
									<label><span>Job title</span><input name="jobTitle" maxlength="200" /></label>
									<label><span>Department</span><input name="department" maxlength="200" /></label>
								</div>
								<label class="check-label"
									><input type="checkbox" name="isPrimaryContact" />
									<span>Primary contact</span></label
								>
								{#if form?.linkContactError}<p class="error" role="alert">
										{form.linkContactError}
									</p>{/if}
								<button type="submit">Link person</button>
							</form>
						{:else}
							<p class="muted">
								Every active person in this CRM is already linked here, or no standalone people
								exist yet.
							</p>
						{/if}
					</section>
				</div>
			{/if}
		</section>
	{:else}
		<section class="panel affiliations full-width">
			<div class="panel-heading">
				<div>
					<p class="eyebrow">Affiliations</p>
					<h2>Organisation relationships</h2>
				</div>
				<span class="count">{data.affiliations.length}</span>
			</div>
			{#if data.affiliations.length === 0}
				<p class="muted">
					This person is not currently linked as a contact for a CRM organisation.
				</p>
			{:else}
				<div class="affiliation-list">
					{#each data.affiliations as affiliation}
						<a href={`/crm/${affiliation.organisationPublicId}`}>
							<strong>{affiliation.organisationName}</strong>
							<span
								>{[affiliation.jobTitle, affiliation.department].filter(Boolean).join(' · ') ||
									'Contact'}</span
							>
							{#if affiliation.isPrimaryContact}<em>Primary contact</em>{/if}
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.breadcrumbs {
		display: flex;
		gap: 0.55rem;
		align-items: center;
		margin-bottom: 1rem;
		color: #686862;
		font-size: 0.9rem;
	}
	.breadcrumbs a {
		color: inherit;
		font-weight: 650;
	}
	.party-header {
		margin-bottom: 1.4rem;
	}
	.header-meta {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: #666;
		font-size: 0.82rem;
		font-weight: 650;
	}
	h1 {
		margin: 0.5rem 0;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.045em;
	}
	.role-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.role-list span {
		padding: 0.25rem 0.5rem;
		background: #ecece7;
		border-radius: 999px;
		font-size: 0.78rem;
	}
	.role-list em {
		color: #777;
		font-style: normal;
	}
	.status {
		font-size: 0.72rem;
		font-weight: 750;
		padding: 0.28rem 0.48rem;
		border-radius: 999px;
		background: #ecece6;
	}
	.status-active {
		background: #e4f5e8;
	}
	.status-inactive {
		background: #fff1cd;
	}
	.status-archived {
		color: #666;
	}
	.workspace-grid {
		display: grid;
		grid-template-columns: minmax(16rem, 0.75fr) minmax(24rem, 1.25fr);
		gap: 1rem;
		align-items: start;
	}
	.panel {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.2rem;
	}
	.full-width {
		grid-column: 1 / -1;
	}
	.panel-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
		margin-bottom: 1rem;
	}
	.eyebrow {
		margin: 0 0 0.3rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.72rem;
		font-weight: 760;
		color: #666;
	}
	h2,
	h3 {
		margin-top: 0;
	}
	.count {
		min-width: 2rem;
		height: 2rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		background: #f0f0eb;
		font-weight: 750;
	}
	dl {
		display: grid;
		gap: 0.75rem;
		margin: 0;
	}
	dl div {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: 1rem;
	}
	dt {
		color: #6a6a64;
	}
	dd {
		margin: 0;
		font-weight: 650;
		overflow-wrap: anywhere;
	}
	.private-note,
	.muted,
	.subpanel > p {
		color: #65655f;
		line-height: 1.55;
		font-size: 0.9rem;
	}
	.private-note {
		margin: 1rem 0 0;
		padding-top: 0.8rem;
		border-top: 1px solid #e5e5df;
	}
	.edit-form,
	.compact-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}
	.edit-form label,
	.compact-form label {
		display: grid;
		gap: 0.35rem;
		font-size: 0.84rem;
		font-weight: 650;
	}
	input,
	select {
		min-width: 0;
		font: inherit;
		border: 1px solid #b9b9b1;
		border-radius: 0.45rem;
		padding: 0.62rem;
		background: white;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.role-fieldset {
		border: 1px solid #d7d7d0;
		border-radius: 0.55rem;
		padding: 0.8rem;
	}
	.role-fieldset legend {
		padding: 0 0.3rem;
		font-weight: 700;
		font-size: 0.85rem;
	}
	.role-options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.8rem;
	}
	.role-options label,
	.check-label {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.35rem;
		font-weight: 550;
	}
	button {
		font: inherit;
		font-weight: 750;
		border: 1px solid #111;
		border-radius: 0.48rem;
		padding: 0.62rem 0.82rem;
		background: #111;
		color: white;
		cursor: pointer;
		justify-self: start;
	}
	.error {
		color: #9b1c1c;
		margin: 0;
	}
	.contact-list,
	.affiliation-list {
		display: grid;
		gap: 0.55rem;
	}
	.contact-row {
		display: grid;
		grid-template-columns: minmax(12rem, 1.2fr) minmax(11rem, 1fr) auto auto;
		gap: 0.8rem;
		align-items: center;
		padding: 0.8rem;
		border: 1px solid #e1e1db;
		border-radius: 0.55rem;
	}
	.contact-row > div:first-child,
	.contact-methods {
		display: grid;
		gap: 0.15rem;
	}
	.contact-row a {
		color: inherit;
	}
	.contact-row span,
	.contact-methods span {
		color: #666;
		font-size: 0.8rem;
	}
	.primary-badge {
		padding: 0.25rem 0.45rem;
		border-radius: 999px;
		background: #e4f5e8;
		color: #285f35 !important;
		font-weight: 700;
	}
	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.row-actions form {
		margin: 0;
	}
	.secondary-button,
	.danger-button {
		background: white;
		color: #222;
		padding: 0.42rem 0.58rem;
		font-size: 0.78rem;
	}
	.danger-button {
		border-color: #9b1c1c;
		color: #8c1b1b;
	}
	.contact-admin-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}
	.subpanel {
		border: 1px solid #e0e0da;
		border-radius: 0.6rem;
		padding: 1rem;
		background: #fafaf7;
	}
	.compact-form {
		grid-template-columns: 1fr;
	}
	.two-col {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.7rem;
	}
	.affiliation-list a {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid #e1e1db;
		border-radius: 0.55rem;
		color: inherit;
		text-decoration: none;
	}
	.affiliation-list span,
	.affiliation-list em {
		color: #666;
		font-size: 0.82rem;
		font-style: normal;
	}
	@media (max-width: 900px) {
		.workspace-grid {
			grid-template-columns: 1fr;
		}
		.full-width {
			grid-column: auto;
		}
		.contact-admin-grid {
			grid-template-columns: 1fr;
		}
		.contact-row {
			grid-template-columns: 1fr auto;
		}
		.contact-methods,
		.row-actions {
			grid-column: 1 / -1;
		}
	}
	@media (max-width: 560px) {
		dl div {
			grid-template-columns: 1fr;
			gap: 0.15rem;
		}
		.edit-form,
		.two-col {
			grid-template-columns: 1fr;
		}
		.wide {
			grid-column: auto;
		}
		.affiliation-list a {
			grid-template-columns: 1fr;
		}
	}
</style>
