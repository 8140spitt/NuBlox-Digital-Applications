<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Contracts · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Package 004</p>
		<h1>Contracts</h1>
		<p>Controlled contract formation and execution evidence.</p>
	</div>
</section>

{#if !data.canView}
	<section class="panel">
		<h2>Contract access required</h2>
		<p>Your current organisation authority does not permit contract viewing.</p>
	</section>
{:else}
	<div class="grid">
		<section class="panel">
			<p class="eyebrow">Portfolio</p>
			<h2>Contracts</h2>
			{#if data.contracts.length === 0}
				<p class="muted">No contracts have been formed in this organisation yet.</p>
			{:else}
				<div class="records">
					{#each data.contracts as contract}
						<a class="record" href={`/contracts/${contract.publicId}`}>
							<span><strong>{contract.contractNumber}</strong><small>{contract.contractTypeName}</small></span>
							<span><strong>{contract.title}</strong><small>{contract.projectNumber ?? 'No project'}</small></span>
							<span class="status">{contract.lifecycleStatus.replaceAll('_', ' ')}</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<aside class="panel">
			<p class="eyebrow">Formation queue</p>
			<h2>Accepted work awaiting contract</h2>
			{#if !data.canCreate}
				<p class="muted">Contract creation authority and active project access are required.</p>
			{:else if data.eligibleProjects.length === 0}
				<p class="muted">No proposed projects from accepted quotations are waiting for contract formation.</p>
			{:else}
				<div class="queue">
					{#each data.eligibleProjects as project}
						<article>
							<strong>{project.projectNumber} · {project.projectName}</strong>
							<span>{project.customerDisplayName} · {project.quotationNumber}</span>
							<a href={`/contracts/new?project=${encodeURIComponent(project.projectPublicId)}`}>Form contract</a>
						</article>
					{/each}
				</div>
			{/if}
		</aside>
	</div>
{/if}

<style>
	.page-heading{margin-bottom:1rem}.page-heading h1{margin:.15rem 0 .3rem;font-size:clamp(2rem,5vw,2.8rem);letter-spacing:-.04em}.page-heading p{margin:0;color:#666}.eyebrow{margin:0;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;font-weight:760;color:#666}.grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(20rem,.75fr);gap:1rem;align-items:start}.panel{background:white;border:1px solid #d9d9d2;border-radius:.8rem;padding:1.1rem}.panel h2{margin:.3rem 0 .8rem}.muted{color:#666;line-height:1.5}.records,.queue{display:grid;gap:.55rem}.record{display:grid;grid-template-columns:minmax(9rem,.7fr) minmax(12rem,1fr) auto;gap:.8rem;align-items:center;padding:.75rem;border:1px solid #e3e3dd;border-radius:.55rem;color:inherit;text-decoration:none}.record span:not(.status){display:grid;gap:.15rem}.record small,.queue span{color:#666}.status{padding:.28rem .5rem;border-radius:999px;background:#f0f0eb;font-size:.75rem;font-weight:750;text-transform:capitalize}.queue article{display:grid;gap:.35rem;padding:.75rem;border:1px solid #e3e3dd;border-radius:.55rem}.queue a{font-weight:700}@media(max-width:850px){.grid{grid-template-columns:1fr}.record{grid-template-columns:1fr}}
</style>
