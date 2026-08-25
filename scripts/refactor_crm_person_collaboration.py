from pathlib import Path

path = Path("app/src/routes/portal/+page.svelte")
text = path.read_text()
start = text.index('<section class="hero">')
style = text.index('<style>')
member_markup = text[start:style].rstrip()
external_markup = '''{#if data.mode === 'external'}
<section class="hero">
	<div>
		<p class="eyebrow">External collaboration</p>
		<h1>Your shared projects</h1>
		<p class="lede">
			Project access has been granted to you personally. You do not need a NuBlox organisation,
			and your employer or CRM affiliation is not mapped to a platform organisation.
		</p>
	</div>
</section>

<section class="metrics" aria-label="External project access summary">
	<article>
		<strong>{data.externalProjects.length}</strong>
		<span>Shared projects</span>
	</article>
	<article>
		<strong>{data.externalProjects.reduce((total, project) => total + project.roles.length, 0)}</strong>
		<span>Project roles</span>
	</article>
	<article>
		<strong>Person</strong>
		<span>Access boundary</span>
	</article>
</section>

<section class="section-block" aria-labelledby="external-projects-heading">
	<div class="section-heading">
		<div>
			<p class="eyebrow">Project access</p>
			<h2 id="external-projects-heading">Projects shared with you</h2>
		</div>
	</div>
	<div class="project-grid">
		{#each data.externalProjects as project (project.collaboratorPublicId)}
			<article class="project-card">
				<div>
					<span class="project-number">{project.projectNumber}</span>
					<span class="status-pill">{titleCase(project.projectStatus)}</span>
				</div>
				<h3>{project.projectName}</h3>
				<p>Shared by {project.owningOrganisationName}</p>
				{#if project.crmOrganisationName}
					<p class="muted">CRM affiliation: {project.crmOrganisationName}</p>
				{/if}
				{#if project.roles.length}
					<p class="muted">Project roles: {project.roles.join(', ')}</p>
				{/if}
			</article>
		{/each}
	</div>
</section>

<section class="section-block">
	<div class="empty-state">
		<strong>External access is deliberately project-scoped.</strong>
		<p>
			NuBlox tenant administration, organisation membership and internal business data remain outside
			your external collaboration scope. Controlled RFI, submittal and information sharing can be
			added to this person-level boundary without creating an organisation identity.
		</p>
	</div>
</section>
{:else}
'''
updated = text[:start] + external_markup + member_markup + '\n{/if}\n\n' + text[style:]
path.write_text(updated)
