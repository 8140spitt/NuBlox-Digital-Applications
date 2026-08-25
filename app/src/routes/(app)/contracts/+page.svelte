<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Contracts · NuBlox</title></svelte:head>

<section class="page-heading">
	<div>
		<p class="eyebrow">Commercial progression</p>
		<h1>Contracts</h1>
		<p>Accepted customer offers progress into controlled contract formation before project mobilisation.</p>
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
						<a
							class="record"
							href={contract.lifecycleStatus === 'active' && !contract.projectPublicId
								? `/contracts/${contract.publicId}/mobilise`
								: `/contracts/${contract.publicId}`}
						>
							<span
								><strong>{contract.contractNumber}</strong><small>{contract.contractTypeName}</small
								></span
							>
							<span
								><strong>{contract.title}</strong><small
									>{contract.projectNumber ??
										(contract.lifecycleStatus === 'active'
											? 'Ready for project mobilisation'
											: 'Awaiting project mobilisation')}</small
								></span
							>
							<span class="status">{contract.lifecycleStatus.replaceAll('_', ' ')}</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<aside class="stack">
			<section class="panel progression-panel">
				<p class="eyebrow">Quote → contract</p>
				<h2>Awaiting contract formation</h2>
				<p class="muted">
					Customer and accepted commercial context are inherited from the quotation. A project is not
					created until the resulting contract is executed.
				</p>
				{#if data.acceptedQuotationsAwaitingContract.length === 0}
					<p class="muted">No accepted quotations are waiting for contract formation.</p>
				{:else}
					<div class="queue">
						{#each data.acceptedQuotationsAwaitingContract as quotation}
							<article>
								<strong>{quotation.quotationNumber} · {quotation.quotationTitle}</strong>
								<span
									>{quotation.customerDisplayName} · accepted {new Date(
										quotation.acceptedAt
									).toLocaleDateString()}</span
								>
								{#if data.canFormContract}
									<a
										href={`/contracts/new?quotation=${encodeURIComponent(quotation.quotationPublicId)}&version=${quotation.versionNumber}`}
										>Form contract</a
									>
								{:else}
									<small class="muted">Contract-creation authority is required.</small>
								{/if}
							</article>
						{/each}
					</div>
				{/if}
			</section>

			{#if data.eligibleProjects.length > 0}
				<section class="panel compatibility-panel">
					<p class="eyebrow">Legacy compatibility</p>
					<h2>Projects created before contract</h2>
					<p class="muted">
						These records were created under the previous quote→project→contract sequence. NuBlox keeps
						them operable while new work follows quote→contract→project.
					</p>
					<div class="queue">
						{#each data.eligibleProjects as project}
							<article>
								<strong>{project.projectNumber} · {project.projectName}</strong>
								<span>{project.customerDisplayName} · {project.quotationNumber}</span>
								{#if data.canCreate}
									<a href={`/contracts/new?project=${encodeURIComponent(project.projectPublicId)}`}
										>Form legacy contract</a
									>
								{/if}
							</article>
						{/each}
					</div>
				</section>
			{/if}
		</aside>
	</div>
{/if}

<style>
	.page-heading {
		margin-bottom: 1rem;
	}
	.page-heading h1 {
		margin: 0.15rem 0 0.3rem;
		font-size: clamp(2rem, 5vw, 2.8rem);
		letter-spacing: -0.04em;
	}
	.page-heading p {
		margin: 0;
		color: #666;
		max-width: 52rem;
		line-height: 1.5;
	}
	.eyebrow {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.72rem;
		font-weight: 760;
		color: #666;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.75fr);
		gap: 1rem;
		align-items: start;
	}
	.stack {
		display: grid;
		gap: 1rem;
	}
	.panel {
		background: white;
		border: 1px solid #d9d9d2;
		border-radius: 0.8rem;
		padding: 1.1rem;
	}
	.panel h2 {
		margin: 0.3rem 0 0.8rem;
	}
	.progression-panel {
		border-color: #b8c8b8;
	}
	.compatibility-panel {
		background: #faf9f5;
	}
	.muted {
		color: #666;
		line-height: 1.5;
	}
	.records,
	.queue {
		display: grid;
		gap: 0.55rem;
	}
	.record {
		display: grid;
		grid-template-columns: minmax(9rem, 0.7fr) minmax(12rem, 1fr) auto;
		gap: 0.8rem;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid #e3e3dd;
		border-radius: 0.55rem;
		color: inherit;
		text-decoration: none;
	}
	.record span:not(.status) {
		display: grid;
		gap: 0.15rem;
	}
	.record small,
	.queue span {
		color: #666;
	}
	.status {
		padding: 0.28rem 0.5rem;
		border-radius: 999px;
		background: #f0f0eb;
		font-size: 0.75rem;
		font-weight: 750;
		text-transform: capitalize;
	}
	.queue article {
		display: grid;
		gap: 0.35rem;
		padding: 0.75rem;
		border: 1px solid #e3e3dd;
		border-radius: 0.55rem;
	}
	.queue a {
		font-weight: 700;
	}
	@media (max-width: 850px) {
		.grid {
			grid-template-columns: 1fr;
		}
		.record {
			grid-template-columns: 1fr;
		}
	}
</style>
