<script lang="ts">
	import { page } from '$app/state';
	import { Breadcrumbs, LinkButton, PageHeader, Panel, StatusBadge } from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';
	import { resolveInternalPath as resolve } from '$lib/routing/resolve-path';

	let { data } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	const baseHref = $derived(appPath(tenant, 'organisation/job-architecture'));
	const positionsHref = $derived(appPath(tenant, 'organisation/positions'));
</script>

<svelte:head>
	<title>Job architecture · NuBlox</title>
	<meta
		name="description"
		content="NuBlox canonical functional roles and job profiles across all 29 enterprise functions."
	/>
</svelte:head>

<div class="nb-page-wide architecture-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Organisation' },
			{ label: 'Job architecture' }
		]}
	/>

	<PageHeader
		eyebrow="Organisation design"
		title="Job architecture"
		description="The canonical people architecture behind NuBlox. Enterprise functions define the work; functional roles bundle accountability; job profiles compose employable jobs; your organisation instantiates those profiles as positions."
	>
		{#snippet actions()}
			<LinkButton href={positionsHref}>Organisation positions</LinkButton>
		{/snippet}
	</PageHeader>

	<div class="metric-grid" aria-label="Job architecture coverage">
		<div><strong>{data.coverage.generated.jobFamilies}</strong><span>Job families</span></div>
		<div><strong>{data.coverage.generated.functionalRoles}</strong><span>Functional roles</span></div>
		<div><strong>{data.coverage.generated.jobProfiles}</strong><span>Job profiles</span></div>
		<div><strong>{data.coverage.source.activities}</strong><span>Source activities</span></div>
	</div>

	<Panel
		title="Governed separation"
		description="Job architecture describes who performs work. It does not grant application authority."
	>
		<div class="model-chain" aria-label="NuBlox job architecture model">
			<span>Enterprise function</span><b aria-hidden="true">→</b><span>Functional role</span
			><b aria-hidden="true">→</b><span>Job profile</span><b aria-hidden="true">→</b
			><span>Organisation position</span><b aria-hidden="true">→</b><span>Person</span>
		</div>
		<p class="model-note">
			Access roles and permission grants remain a separate security model. Generated records are
			candidate architecture until curated and approved.
		</p>
	</Panel>

	<Panel
		title="Find a canonical job profile"
		description="Filter the generated catalogue by enterprise function, level or search text."
	>
		<form class="filters" method="GET" action={resolve(baseHref)}>
			<label>
				<span>Search</span>
				<input
					class="nb-control"
					type="search"
					name="q"
					value={data.filters.query}
					placeholder="Title, profile ID, function or sub-function"
				/>
			</label>
			<label>
				<span>Job family</span>
				<select class="nb-control" name="family" value={data.filters.family}>
					<option value="">All job families</option>
					{#each data.families as family (family.id)}
						<option value={family.id}>{family.sourceFunctionId} · {family.name}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Level</span>
				<select class="nb-control" name="level" value={data.filters.level}>
					<option value="">All levels</option>
					{#each data.levels as level (level)}
						<option value={level}>{level}</option>
					{/each}
				</select>
			</label>
			<div class="filter-actions">
				<button class="nb-button nb-button--primary" type="submit">Apply filters</button>
				<a class="nb-button nb-button--secondary" href={resolve(baseHref)}>Clear</a>
			</div>
		</form>
	</Panel>

	<Panel
		title={`${data.profiles.length} matching job profiles`}
		description="Open a profile to see its functional roles, source sub-functions, accountabilities, skills and measures."
	>
		{#if data.profiles.length === 0}
			<p class="empty-copy">No job profiles match those filters.</p>
		{:else}
			<div class="profile-grid">
				{#each data.profiles as profile (profile.id)}
					<article class="profile-card">
						<div class="profile-heading">
							<div>
								<span class="profile-id">{profile.id}</span>
								<h2>{profile.title}</h2>
							</div>
							<StatusBadge
								label={profile.status === 'candidate' ? 'Candidate' : profile.status}
								tone={profile.status === 'approved' ? 'success' : 'warning'}
							/>
						</div>
						<div class="metadata">
							<span>{profile.jobFamilyName}</span>
							<span>{profile.level}</span>
							<span>{profile.primaryRoleCount} primary roles</span>
						</div>
						<p>{profile.purpose}</p>
						<div class="source-tags">
							{#each profile.functionIds as functionId (functionId)}
								<span>{functionId}</span>
							{/each}
							{#each profile.subfunctionIds.slice(0, 5) as subfunctionId (subfunctionId)}
								<span>{subfunctionId}</span>
							{/each}
							{#if profile.subfunctionIds.length > 5}
								<span>+{profile.subfunctionIds.length - 5}</span>
							{/if}
						</div>
						<LinkButton href={appPath(tenant, `organisation/job-architecture/${profile.id}`)} variant="secondary"
							>Open profile</LinkButton
						>
					</article>
				{/each}
			</div>
		{/if}
	</Panel>
</div>

<style>
	.architecture-page {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.metric-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-3);
		margin: var(--nb-space-5) 0;
	}
	.metric-grid > div {
		display: grid;
		gap: var(--nb-space-1);
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.metric-grid strong {
		font-size: var(--nb-font-size-xl);
	}
	.metric-grid span,
	.model-note,
	.profile-card p,
	.metadata,
	.profile-id,
	.empty-copy {
		color: var(--nb-color-text-muted);
	}
	.model-chain {
		display: flex;
		align-items: center;
		gap: var(--nb-space-2);
		flex-wrap: wrap;
		font-weight: var(--nb-weight-semibold);
	}
	.model-chain span {
		padding: var(--nb-space-2) var(--nb-space-3);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}
	.model-chain b {
		color: var(--nb-color-text-muted);
	}
	.model-note {
		margin: var(--nb-space-3) 0 0;
	}
	.filters {
		display: grid;
		grid-template-columns: minmax(220px, 1.5fr) minmax(220px, 1fr) minmax(160px, 0.6fr) auto;
		gap: var(--nb-space-3);
		align-items: end;
	}
	.filters label {
		display: grid;
		gap: var(--nb-space-2);
		font-size: var(--nb-font-size-sm);
		font-weight: var(--nb-weight-medium);
	}
	.filter-actions {
		display: flex;
		gap: var(--nb-space-2);
	}
	.profile-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-4);
	}
	.profile-card {
		display: grid;
		gap: var(--nb-space-3);
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.profile-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--nb-space-3);
	}
	.profile-heading h2 {
		margin: var(--nb-space-1) 0 0;
		font-size: var(--nb-font-size-lg);
	}
	.profile-id {
		font-family: var(--nb-font-family-mono);
		font-size: var(--nb-font-size-xs);
	}
	.metadata,
	.source-tags {
		display: flex;
		gap: var(--nb-space-2);
		flex-wrap: wrap;
		font-size: var(--nb-font-size-xs);
	}
	.metadata span + span::before {
		content: '•';
		margin-right: var(--nb-space-2);
	}
	.source-tags span {
		padding: 2px var(--nb-space-2);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-color-bg-subtle);
		color: var(--nb-color-text-secondary);
	}
	@media (max-width: 1100px) {
		.filters {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 820px) {
		.metric-grid,
		.profile-grid,
		.filters {
			grid-template-columns: 1fr;
		}
		.filter-actions {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
