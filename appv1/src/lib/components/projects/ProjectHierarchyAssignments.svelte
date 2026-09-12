<script lang="ts">
	let { projects, programmes, form } = $props();
</script>

<section class="assignment-panel" aria-labelledby="programme-assignments-heading">
	<div>
		<p class="eyebrow">Project parentage</p>
		<h3 id="programme-assignments-heading">Assign projects to programmes</h3>
		<p class="muted">
			Set or clear the programme parent for an organisation-owned project. Cross-organisation
			participant projects remain read-only at the service boundary.
		</p>
	</div>

	{#if projects.length === 0}
		<p class="muted">No authorised projects are available.</p>
	{:else}
		<div class="assignment-list">
			{#each projects as project}
				<form method="POST" action="?/assignProgramme" class="assignment-row">
					<input type="hidden" name="projectPublicId" value={project.publicId} />
					<div class="project-identity">
						<small>{project.projectNumber}</small>
						<strong>{project.name}</strong>
					</div>
					<label>
						<span class="sr-only">Programme for {project.name}</span>
						<select name="programmePublicId" aria-label={`Programme for ${project.name}`}>
							<option value="" selected={!project.hierarchy?.programmePublicId}
								>Standalone project</option
							>
							{#each programmes as programme}
								<option
									value={programme.publicId}
									selected={project.hierarchy?.programmePublicId === programme.publicId}
								>
									{programme.portfolioNumber
										? `${programme.portfolioNumber} / `
										: ''}{programme.programmeNumber} · {programme.name}
								</option>
							{/each}
						</select>
					</label>
					<button type="submit">Save parent</button>
					{#if form?.hierarchyError && form.hierarchyAction === `assign-${project.publicId}`}
						<p class="error" role="alert">{form.hierarchyError}</p>
					{/if}
				</form>
			{/each}
		</div>
	{/if}
</section>

<style>
	.assignment-panel {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e5df;
	}
	.assignment-panel h3,
	.assignment-panel p {
		margin-top: 0;
	}
	.eyebrow {
		margin: 0 0 0.35rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.72rem;
		font-weight: 800;
		color: #61615b;
	}
	.muted {
		color: #5d5d57;
		line-height: 1.55;
	}
	.assignment-list {
		display: grid;
		gap: 0.5rem;
	}
	.assignment-row {
		display: grid;
		grid-template-columns: minmax(12rem, 0.8fr) minmax(15rem, 1.4fr) auto;
		gap: 0.65rem;
		align-items: center;
		padding: 0.7rem;
		border: 1px solid #deded7;
		border-radius: 0.55rem;
		background: #fafaf7;
	}
	.project-identity {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	.project-identity small {
		color: #74746d;
		font-weight: 700;
	}
	.project-identity strong {
		overflow-wrap: anywhere;
	}
	select,
	button {
		font: inherit;
	}
	select {
		width: 100%;
		border: 1px solid #b9b9b1;
		border-radius: 0.5rem;
		padding: 0.65rem;
		background: white;
	}
	button {
		border: 1px solid #111;
		border-radius: 0.5rem;
		padding: 0.65rem 0.8rem;
		background: #111;
		color: white;
		font-weight: 750;
		cursor: pointer;
	}
	.error {
		grid-column: 1 / -1;
		margin: 0;
		color: #9b1c1c;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	@media (max-width: 760px) {
		.assignment-row {
			grid-template-columns: 1fr;
		}
		button {
			justify-self: start;
		}
	}
</style>
