<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Alert, Breadcrumbs, Button, LinkButton, PageHeader, Panel, StatusBadge } from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	const catalogueHref = $derived(appPath(tenant, 'organisation/job-architecture'));
</script>

<svelte:head>
	<title>Organisation positions · NuBlox</title>
	<meta
		name="description"
		content="Create tenant organisation positions from canonical NuBlox job profiles and assign organisation members."
	/>
</svelte:head>

<div class="nb-page-wide positions-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Organisation' },
			{ label: 'Positions' }
		]}
	/>

	<PageHeader
		eyebrow="Organisation design"
		title="Organisation positions"
		description={`Instantiate canonical job profiles inside ${data.organisationName}. Positions hold local reporting and FTE context; position assignments connect people to those positions without granting permissions.`}
	>
		{#snippet actions()}
			<LinkButton href={catalogueHref} variant="secondary">Browse job architecture</LinkButton>
		{/snippet}
	</PageHeader>

	{#if form?.formError}
		<Alert tone="danger" title="Organisation structure not updated">{form.formError}</Alert>
	{:else if form?.success}
		<Alert tone="success" title="Organisation structure updated">{form.message}</Alert>
	{/if}

	<div class="principles" aria-label="Organisation structure rules">
		<div><strong>Canonical job</strong><span>Reusable NuBlox job profile</span></div>
		<div><strong>Local position</strong><span>Your title, reporting line and FTE</span></div>
		<div><strong>Person assignment</strong><span>Who occupies the position and when</span></div>
		<div><strong>Security</strong><span>Still governed independently by RBAC</span></div>
	</div>

	{#if data.canManage}
		<Panel
			title="Create position"
			description="Choose a canonical job profile, then add only the organisation-specific context that differs from the catalogue."
		>
			<form class="position-form" method="POST" action="?/create" use:enhance>
				<label>
					<span>Position code</span>
					<input class="nb-control" name="positionCode" maxlength="64" placeholder="PROC-001" required />
				</label>
				<label class="profile-field">
					<span>Canonical job profile</span>
					<select class="nb-control" name="jobProfileKey" required>
						<option value="">Select a profile</option>
						{#each data.profiles as profile (profile.id)}
							<option value={profile.id}>
								{profile.title} · {profile.familyName} · {profile.level}{profile.status === 'candidate' ? ' · candidate' : ''}
							</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Local title override</span>
					<input class="nb-control" name="titleOverride" maxlength="200" placeholder="Optional" />
				</label>
				<label>
					<span>Reports to</span>
					<select class="nb-control" name="reportsToPublicId">
						<option value="">No reporting position</option>
						{#each data.positions.filter((position) => position.status !== 'closed') as position (position.publicId)}
							<option value={position.publicId}>{position.positionCode} · {position.title}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>FTE</span>
					<input class="nb-control" name="fte" type="number" min="0.01" max="1" step="0.01" value="1" required />
				</label>
				<label>
					<span>Valid from</span>
					<input class="nb-control" name="validFrom" type="date" />
				</label>
				<label>
					<span>Valid to</span>
					<input class="nb-control" name="validTo" type="date" />
				</label>
				<div class="form-action"><Button type="submit">Create position</Button></div>
			</form>
		</Panel>
	{/if}

	<Panel
		title={`${data.positions.length} organisation positions`}
		description="Positions are tenant records. Their canonical job definition stays anchored to the generated job architecture."
	>
		{#if data.positions.length === 0}
			<p class="empty-copy">No positions have been created yet. Start from a canonical job profile above.</p>
		{:else}
			<div class="position-list">
				{#each data.positions as position (position.publicId)}
					<article class="position-card">
						<div class="position-heading">
							<div>
								<span class="position-code">{position.positionCode}</span>
								<h2>{position.title}</h2>
								<p>{position.jobProfileTitle} · {position.jobFamilyName}</p>
							</div>
							<StatusBadge
								label={position.status}
								tone={position.status === 'open' ? 'success' : position.status === 'frozen' ? 'warning' : 'neutral'}
							/>
						</div>
						<div class="position-metadata">
							<span>{position.fte} FTE</span>
							<span>{position.reportsToCode ? `Reports to ${position.reportsToCode}` : 'No reporting position'}</span>
							<span>{position.validFrom ?? 'Open start'} → {position.validTo ?? 'Open ended'}</span>
							<a href={appPath(tenant, `organisation/job-architecture/${position.jobProfileKey}`)}>Canonical profile</a>
						</div>

						<div class="assignment-section">
							<h3>Position assignments</h3>
							{#if position.assignments.length === 0}
								<p class="empty-copy">No people assigned.</p>
							{:else}
								<div class="assignment-list">
									{#each position.assignments as assignment (assignment.publicId)}
										<div class="assignment-row">
											<div>
												<strong>{assignment.memberName}</strong>
												<span>{assignment.memberEmail}</span>
											</div>
											<div>
												<span>{assignment.assignmentType} · {assignment.allocationPercent}%</span>
												<span>{assignment.startDate} → {assignment.endDate ?? 'open ended'}</span>
											</div>
											<StatusBadge
												label={assignment.status}
												tone={assignment.status === 'active' ? 'success' : 'neutral'}
											/>
										</div>
									{/each}
								</div>
							{/if}

							{#if data.canManage && position.status !== 'closed'}
								<details class="assign-person">
									<summary>Assign person</summary>
									<form method="POST" action="?/assign" use:enhance>
										<input type="hidden" name="positionPublicId" value={position.publicId} />
										<label>
											<span>Organisation member</span>
											<select class="nb-control" name="memberPublicId" required>
												<option value="">Select person</option>
												{#each data.members as member (member.publicId)}
													<option value={member.publicId}>{member.name} · {member.email}</option>
												{/each}
											</select>
										</label>
										<label>
											<span>Assignment type</span>
											<select class="nb-control" name="assignmentType">
												<option value="primary">Primary</option>
												<option value="acting">Acting</option>
												<option value="secondary">Secondary</option>
											</select>
										</label>
										<label>
											<span>Allocation %</span>
											<input class="nb-control" type="number" name="allocationPercent" min="0.01" max="100" step="0.01" value="100" required />
										</label>
										<label>
											<span>Start date</span>
											<input class="nb-control" type="date" name="startDate" required />
										</label>
										<label>
											<span>End date</span>
											<input class="nb-control" type="date" name="endDate" />
										</label>
										<div class="form-action"><Button type="submit" variant="secondary">Assign person</Button></div>
									</form>
								</details>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</Panel>
</div>

<style>
	.positions-page {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.principles {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-3);
		margin: var(--nb-space-5) 0;
	}
	.principles > div {
		display: grid;
		gap: var(--nb-space-1);
		padding: var(--nb-space-3);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.principles span,
	.position-heading p,
	.position-metadata,
	.assignment-row span,
	.empty-copy {
		color: var(--nb-color-text-muted);
	}
	.principles span {
		font-size: var(--nb-font-size-sm);
	}
	.position-form {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--nb-space-3);
		align-items: end;
	}
	.position-form label,
	.assign-person label {
		display: grid;
		gap: var(--nb-space-2);
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-medium);
	}
	.profile-field {
		grid-column: span 2;
	}
	.form-action {
		display: flex;
		align-items: end;
	}
	.position-list {
		display: grid;
		gap: var(--nb-space-4);
	}
	.position-card {
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.position-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-3);
	}
	.position-heading h2 {
		margin: var(--nb-space-1) 0;
	}
	.position-heading p {
		margin: 0;
	}
	.position-code {
		font-family: var(--nb-font-family-mono);
		font-size: var(--nb-font-size-xs);
		color: var(--nb-color-text-muted);
	}
	.position-metadata {
		display: flex;
		gap: var(--nb-space-3);
		flex-wrap: wrap;
		margin-top: var(--nb-space-3);
		font-size: var(--nb-font-size-sm);
	}
	.assignment-section {
		margin-top: var(--nb-space-4);
		padding-top: var(--nb-space-4);
		border-top: 1px solid var(--nb-color-border-subtle);
	}
	.assignment-section h3 {
		margin: 0 0 var(--nb-space-3);
	}
	.assignment-list {
		display: grid;
		gap: var(--nb-space-2);
	}
	.assignment-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
		gap: var(--nb-space-3);
		align-items: center;
		padding: var(--nb-space-3);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}
	.assignment-row > div {
		display: grid;
		gap: 2px;
	}
	.assign-person {
		margin-top: var(--nb-space-3);
	}
	.assign-person summary {
		cursor: pointer;
		font-weight: var(--nb-weight-medium);
	}
	.assign-person form {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: var(--nb-space-3);
		align-items: end;
		margin-top: var(--nb-space-3);
		padding: var(--nb-space-3);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}
	@media (max-width: 1050px) {
		.principles,
		.position-form {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.assign-person form {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.profile-field {
			grid-column: auto;
		}
	}
	@media (max-width: 700px) {
		.principles,
		.position-form,
		.assign-person form,
		.assignment-row {
			grid-template-columns: 1fr;
		}
	}
</style>
