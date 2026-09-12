<script lang="ts">
	let { data, form } = $props();
	let partyKind = $state<'person' | 'organisation'>('organisation');

	const statusLabels: Record<string, string> = {
		active: 'Active',
		inactive: 'Inactive',
		archived: 'Archived'
	};
</script>

<svelte:head>
	<title>Customers · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Customers &amp; pipeline</p>
		<h1>Customers &amp; contacts</h1>
		<p>
			Private organisations and people known to this NuBlox organisation. CRM records are not a
			public NuBlox directory.
		</p>
	</div>
	{#if data.canManage}<a class="header-action" href="#new-party">Add customer or contact</a>{/if}
</section>

{#if !data.canView}
	<section class="notice">
		<h2>CRM access is not enabled</h2>
		<p>Your current organisation role does not grant <code>crm.view</code>.</p>
	</section>
{:else}
	<section class="panel filters" aria-label="CRM filters">
		<form method="GET">
			<label class="search-field">
				<span>Search</span>
				<input name="q" value={data.filters.search ?? ''} placeholder="Name, email or phone" />
			</label>
			<label>
				<span>Type</span>
				<select name="kind">
					<option value="">All</option>
					<option value="organisation" selected={data.filters.kind === 'organisation'}
						>Organisations</option
					>
					<option value="person" selected={data.filters.kind === 'person'}>People</option>
				</select>
			</label>
			<label>
				<span>Status</span>
				<select name="status">
					<option value="">All</option>
					<option value="active" selected={data.filters.status === 'active'}>Active</option>
					<option value="inactive" selected={data.filters.status === 'inactive'}>Inactive</option>
					<option value="archived" selected={data.filters.status === 'archived'}>Archived</option>
				</select>
			</label>
			<button type="submit">Filter</button>
			<a class="secondary" href="/crm">Clear</a>
		</form>
	</section>

	<section class="panel directory">
		<div class="panel-heading">
			<div>
				<p class="eyebrow">Directory</p>
				<h2>CRM parties</h2>
			</div>
			<span class="count">{data.parties.length}</span>
		</div>

		{#if data.parties.length === 0}
			<div class="empty-state">
				<h3>No matching CRM records</h3>
				<p>Create an organisation or person, or adjust the current filters.</p>
			</div>
		{:else}
			<div class="party-list">
				{#each data.parties as party}
					<a class="party-row" href={`/crm/${party.publicId}`}>
						<div class="identity">
							<strong>{party.displayName}</strong>
							<span>{party.kind === 'organisation' ? 'Organisation' : 'Person'}</span>
						</div>
						<div class="roles">
							{#if party.roles.length > 0}
								{#each party.roles as role}<span>{role.name}</span>{/each}
							{:else}
								<em>No business role</em>
							{/if}
						</div>
						<div class="contact">
							{#if party.primaryEmail}<span>{party.primaryEmail}</span>{/if}
							{#if party.primaryPhone}<span>{party.primaryPhone}</span>{/if}
						</div>
						<span class={`status status-${party.status}`}
							>{statusLabels[party.status] ?? party.status}</span
						>
					</a>
				{/each}
			</div>
		{/if}
	</section>
{/if}

{#if data.canManage}
	<section id="new-party" class="panel create-panel">
		<div class="create-copy">
			<p class="eyebrow">New record</p>
			<h2>Add an organisation or person</h2>
			<p>
				An organisation is the CRM account. Every new organisation is created together with its
				first contact, who becomes the primary CRM contact automatically.
			</p>
		</div>

		<form method="POST" action="?/create" class="party-form">
			<label>
				<span>Record type</span>
				<select name="kind" bind:value={partyKind}>
					<option value="organisation">Organisation</option>
					<option value="person">Person</option>
				</select>
			</label>

			{#if partyKind === 'organisation'}
				<div class="form-section wide">
					<div class="section-heading">
						<p class="eyebrow">Organisation</p>
						<h3>Account details</h3>
					</div>
					<div class="section-grid">
						<label class="wide">
							<span>Legal name</span>
							<input
								name="legalName"
								maxlength="255"
								required
								placeholder="Example Construction Ltd"
							/>
						</label>
						<label class="wide">
							<span>Trading name <small>optional</small></span>
							<input name="tradingName" maxlength="255" />
						</label>
						<label>
							<span>Organisation email <small>optional</small></span>
							<input name="organisationEmail" type="email" maxlength="320" />
						</label>
						<label>
							<span>Organisation phone <small>E.164, optional</small></span>
							<input name="organisationPhone" maxlength="32" placeholder="+442071234567" />
						</label>
					</div>
				</div>

				<div class="form-section primary-contact-section wide">
					<div class="section-heading">
						<p class="eyebrow">Primary contact</p>
						<h3>First organisation contact</h3>
						<p>
							Required. This person becomes the CRM primary contact and is used automatically when
							an opportunity contact is left blank.
						</p>
					</div>
					<div class="section-grid">
						<label>
							<span>Honorific <small>optional</small></span>
							<input name="contactHonorific" maxlength="64" placeholder="Ms" />
						</label>
						<label>
							<span>Preferred name <small>optional</small></span>
							<input name="contactPreferredName" maxlength="160" />
						</label>
						<label>
							<span>Given names</span>
							<input name="contactGivenNames" maxlength="200" required />
						</label>
						<label>
							<span>Family name</span>
							<input name="contactFamilyName" maxlength="160" required />
						</label>
						<label>
							<span>Email <small>optional</small></span>
							<input name="contactEmail" type="email" maxlength="320" />
						</label>
						<label>
							<span>Phone <small>E.164, optional</small></span>
							<input name="contactPhone" maxlength="32" placeholder="+447700900000" />
						</label>
						<label>
							<span>Job title <small>optional</small></span>
							<input name="contactJobTitle" maxlength="160" />
						</label>
						<label>
							<span>Department <small>optional</small></span>
							<input name="contactDepartment" maxlength="160" />
						</label>
					</div>
				</div>
			{:else}
				<label>
					<span>Honorific <small>optional</small></span>
					<input name="honorific" maxlength="64" placeholder="Ms" />
				</label>
				<label>
					<span>Given names</span>
					<input name="givenNames" maxlength="200" />
				</label>
				<label>
					<span>Family name</span>
					<input name="familyName" maxlength="160" />
				</label>
				<label>
					<span>Preferred name <small>optional</small></span>
					<input name="preferredName" maxlength="160" />
				</label>
				<label>
					<span>Primary email <small>optional</small></span>
					<input name="primaryEmail" type="email" maxlength="320" />
				</label>
				<label>
					<span>Primary phone <small>E.164</small></span>
					<input name="primaryPhone" maxlength="32" placeholder="+442071234567" />
				</label>
			{/if}

			<fieldset class="wide role-fieldset">
				<legend>Business roles</legend>
				<div class="role-options">
					{#each data.roleTypes as role}
						<label
							><input type="checkbox" name="roleCode" value={role.code} />
							<span>{role.name}</span></label
						>
					{/each}
				</div>
			</fieldset>

			{#if form?.createError}<p class="error wide" role="alert">{form.createError}</p>{/if}
			<button type="submit"
				>{partyKind === 'organisation' ? 'Create organisation' : 'Create person'}</button
			>
		</form>
	</section>
{/if}

<style>
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1.5rem;
		margin-bottom: 1.4rem;
	}
	.page-header > div {
		max-width: 60rem;
	}
	.page-header p:last-child,
	.create-copy p,
	.section-heading p:last-child {
		color: #5d5d57;
		line-height: 1.6;
	}
	.eyebrow {
		margin: 0 0 0.3rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.72rem;
		font-weight: 760;
		color: #666;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.1rem);
		letter-spacing: -0.045em;
	}
	h2,
	h3 {
		margin: 0;
	}
	.panel,
	.notice {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.2rem;
		margin-bottom: 1rem;
	}
	.header-action,
	button {
		font: inherit;
		font-weight: 750;
		border: 1px solid #111;
		border-radius: 0.5rem;
		padding: 0.68rem 0.9rem;
		background: #111;
		color: white;
		text-decoration: none;
		cursor: pointer;
	}
	.secondary {
		color: #333;
		font-weight: 650;
	}
	.filters form {
		display: grid;
		grid-template-columns: minmax(16rem, 1fr) 11rem 11rem auto auto;
		gap: 0.75rem;
		align-items: end;
	}
	.filters label,
	.party-form label {
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
		padding: 0.64rem;
		background: white;
	}
	.panel-heading {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
		margin-bottom: 0.9rem;
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
	.party-list {
		display: grid;
		gap: 0.5rem;
	}
	.party-row {
		display: grid;
		grid-template-columns: minmax(13rem, 1.2fr) minmax(12rem, 1fr) minmax(12rem, 1fr) auto;
		gap: 1rem;
		align-items: center;
		padding: 0.8rem;
		border: 1px solid #e1e1db;
		border-radius: 0.55rem;
		color: inherit;
		text-decoration: none;
	}
	.party-row:hover,
	.party-row:focus-visible {
		border-color: #898982;
	}
	.identity,
	.contact {
		display: grid;
		gap: 0.16rem;
	}
	.identity span,
	.contact span,
	.roles em {
		color: #6b6b65;
		font-size: 0.8rem;
		font-style: normal;
	}
	.roles {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.roles > span {
		padding: 0.2rem 0.42rem;
		border-radius: 999px;
		background: #f1f1ec;
		font-size: 0.75rem;
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
	.empty-state {
		padding: 1rem;
		background: #fafaf7;
		border-radius: 0.55rem;
	}
	.empty-state h3 {
		margin-top: 0;
	}
	.create-panel {
		display: grid;
		grid-template-columns: minmax(14rem, 0.7fr) minmax(24rem, 1.3fr);
		gap: 2rem;
		align-items: start;
	}
	.party-form,
	.section-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem;
	}
	.party-form small {
		color: #777;
		font-weight: 500;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.form-section {
		display: grid;
		gap: 0.9rem;
		padding: 1rem;
		border: 1px solid #deded7;
		border-radius: 0.65rem;
		background: #fafaf7;
	}
	.primary-contact-section {
		border-color: #c8d4c8;
		background: #fbfdfb;
	}
	.section-heading {
		display: grid;
		gap: 0.25rem;
	}
	.section-heading p {
		margin: 0;
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
	.role-options label {
		display: flex;
		grid-template-columns: none;
		flex-direction: row;
		align-items: center;
		gap: 0.35rem;
		font-weight: 550;
	}
	.error {
		color: #9b1c1c;
		margin: 0;
	}
	.party-form button {
		justify-self: start;
	}
	@media (max-width: 1000px) {
		.filters form {
			grid-template-columns: 1fr 1fr;
		}
		.search-field {
			grid-column: 1 / -1;
		}
		.party-row {
			grid-template-columns: 1fr auto;
		}
		.roles,
		.contact {
			grid-column: 1 / -1;
		}
	}
	@media (max-width: 760px) {
		.page-header {
			display: block;
		}
		.header-action {
			display: inline-block;
			margin-top: 0.6rem;
		}
		.create-panel {
			grid-template-columns: 1fr;
		}
		.party-form,
		.section-grid,
		.filters form {
			grid-template-columns: 1fr;
		}
		.wide,
		.search-field {
			grid-column: auto;
		}
	}
</style>
