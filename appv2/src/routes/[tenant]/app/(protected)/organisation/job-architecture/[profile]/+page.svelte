<script lang="ts">
	import { page } from '$app/state';
	import { Breadcrumbs, LinkButton, PageHeader, Panel, StatusBadge } from '$lib/components/ui';
	import { appPath, routes } from '$lib/routing/route-contract';

	let { data } = $props();
	const tenant = $derived(page.params.tenant ?? 'tenant');
	const catalogueHref = $derived(appPath(tenant, 'organisation/job-architecture'));
	const positionsHref = $derived(appPath(tenant, 'organisation/positions'));
</script>

<svelte:head>
	<title>{data.profile.title} · NuBlox</title>
	<meta name="description" content={data.profile.purpose} />
</svelte:head>

<div class="nb-page-wide profile-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(tenant) },
			{ label: 'Job architecture', href: catalogueHref },
			{ label: data.profile.title }
		]}
	/>

	<PageHeader
		eyebrow={`${data.family.sourceFunctionId} · ${data.family.name}`}
		title={data.profile.title}
		description={data.profile.purpose}
	>
		{#snippet actions()}
			<StatusBadge
				label={data.profile.status === 'candidate' ? 'Candidate profile' : data.profile.status}
				tone={data.profile.status === 'approved' ? 'success' : 'warning'}
			/>
			<LinkButton href={positionsHref}>Create organisation position</LinkButton>
		{/snippet}
	</PageHeader>

	<div class="identity-grid">
		<div><span>Profile ID</span><strong>{data.profile.id}</strong></div>
		<div><span>Level</span><strong>{data.profile.level}</strong></div>
		<div><span>Job family</span><strong>{data.family.name}</strong></div>
		<div>
			<span>Source functions</span><strong
				>{data.profile.sourceMappings.functionIds.join(', ')}</strong
			>
		</div>
	</div>

	<div class="content-grid">
		<div class="primary-column">
			<Panel
				title="Functional roles"
				description="The work and accountability composed into this job profile."
			>
				<div class="role-list">
					{#each data.primaryRoles as role (role.id)}
						<article class="role-card">
							<div class="role-heading">
								<div>
									<code>{role.id}</code>
									<h2>{role.name}</h2>
								</div>
								<StatusBadge label="Primary" tone="info" />
							</div>
							<p>{role.purpose}</p>
							<details>
								<summary>{role.activities.length} inherited activities</summary>
								<ul>
									{#each role.activities as activity (activity)}<li>{activity}</li>{/each}
								</ul>
							</details>
						</article>
					{/each}
					{#each data.secondaryRoles as role (role.id)}
						<article class="role-card">
							<div class="role-heading">
								<div>
									<code>{role.id}</code>
									<h2>{role.name}</h2>
								</div>
								<StatusBadge label="Secondary" tone="neutral" />
							</div>
							<p>{role.purpose}</p>
						</article>
					{/each}
				</div>
			</Panel>

			<Panel
				title="Key accountabilities"
				description="The canonical accountability baseline for this profile."
			>
				<ul class="evidence-list">
					{#each data.profile.keyAccountabilities as item (item)}<li>{item}</li>{/each}
				</ul>
			</Panel>

			<Panel
				title="Expected outputs"
				description="Controlled outcomes and deliverables expected from the role."
			>
				<ul class="evidence-list">
					{#each data.profile.expectedOutputs as item (item)}<li>{item}</li>{/each}
				</ul>
			</Panel>
		</div>

		<div class="secondary-column">
			<Panel title="Knowledge & technical skills">
				<div class="tag-list">
					{#each data.profile.knowledgeAndTechnicalSkills as item (item)}<span>{item}</span>{/each}
				</div>
			</Panel>

			<Panel title="Behavioural competencies">
				<ul class="compact-list">
					{#each data.profile.behaviouralCompetencies as item (item)}<li>{item}</li>{/each}
				</ul>
			</Panel>

			<Panel title="Experience">
				<p class="muted-copy">{data.profile.experience}</p>
			</Panel>

			<Panel title="Qualifications">
				{#if data.profile.qualifications.length === 0}
					<p class="muted-copy">No canonical qualification has been mandated at candidate stage.</p>
				{:else}
					<ul class="compact-list">
						{#each data.profile.qualifications as item (item)}<li>{item}</li>{/each}
					</ul>
				{/if}
			</Panel>

			<Panel title="Performance measures">
				<ul class="compact-list">
					{#each data.profile.performanceMeasures as item (item)}<li>{item}</li>{/each}
				</ul>
			</Panel>

			<Panel title="Taxonomy coverage">
				<div class="tag-list">
					{#each data.profile.sourceMappings.subfunctionIds as item (item)}<span>{item}</span
						>{/each}
				</div>
			</Panel>
		</div>
	</div>
</div>

<style>
	.profile-page {
		padding-top: var(--nb-space-5);
		padding-bottom: var(--nb-space-10);
	}
	.identity-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-3);
		margin: var(--nb-space-5) 0;
	}
	.identity-grid > div {
		display: grid;
		gap: var(--nb-space-1);
		padding: var(--nb-space-3);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-surface);
	}
	.identity-grid span,
	.role-card p,
	.muted-copy {
		color: var(--nb-color-text-muted);
	}
	.identity-grid span {
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		text-transform: uppercase;
	}
	.content-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.6fr) minmax(300px, 0.8fr);
		gap: var(--nb-space-5);
		align-items: start;
	}
	.primary-column,
	.secondary-column,
	.role-list {
		display: grid;
		gap: var(--nb-space-4);
	}
	.role-card {
		padding: var(--nb-space-4);
		border: 1px solid var(--nb-color-border-subtle);
		border-radius: var(--nb-radius-md);
		background: var(--nb-color-bg-subtle);
	}
	.role-heading {
		display: flex;
		justify-content: space-between;
		gap: var(--nb-space-3);
		align-items: flex-start;
	}
	.role-heading h2 {
		margin: var(--nb-space-1) 0 0;
		font-size: var(--nb-font-size-md);
	}
	.role-card details {
		margin-top: var(--nb-space-3);
	}
	.role-card summary {
		cursor: pointer;
		font-weight: var(--nb-weight-medium);
	}
	.evidence-list,
	.compact-list {
		margin: 0;
		padding-left: var(--nb-space-5);
	}
	.evidence-list {
		display: grid;
		gap: var(--nb-space-2);
	}
	.tag-list {
		display: flex;
		gap: var(--nb-space-2);
		flex-wrap: wrap;
	}
	.tag-list span {
		padding: var(--nb-space-1) var(--nb-space-2);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-color-bg-subtle);
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-xs);
	}
	@media (max-width: 980px) {
		.identity-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.content-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 620px) {
		.identity-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
