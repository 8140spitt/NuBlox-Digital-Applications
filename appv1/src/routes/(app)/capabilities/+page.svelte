<script lang="ts">
	let { data } = $props();

	function maturityLabel(value: string): string {
		if (value === 'operational') return 'Operational core';
		if (value === 'partial') return 'Partial native coverage';
		return 'Planned';
	}
</script>

<svelte:head>
	<title>Capability map · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Product architecture</p>
		<h1>Native capability map</h1>
		<p>
			The 19 stable NuBlox capability domains are product boundaries, not separate applications.
			Maturity describes current native implementation; workspace links are filtered by your
			effective permissions.
		</p>
	</div>
</section>

<section class="metrics" aria-label="Capability registry summary">
	<article>
		<span>Native domains</span>
		<strong>{data.capabilitySummary.total}</strong>
	</article>
	<article>
		<span>Operational core</span>
		<strong>{data.capabilitySummary.operational}</strong>
	</article>
	<article>
		<span>Partial coverage</span>
		<strong>{data.capabilitySummary.partial}</strong>
	</article>
	<article>
		<span>Planned</span>
		<strong>{data.capabilitySummary.planned}</strong>
	</article>
</section>

<section class="registry" aria-label="NuBlox native capability domains">
	{#each data.capabilityRegistry as domain (domain.id)}
		<article class="capability-card" data-capability-domain={domain.id}>
			<div class="capability-heading">
				<div>
					<p class="domain-number">Domain {domain.id}</p>
					<h2>{domain.name}</h2>
				</div>
				<span class:maturity-operational={domain.maturity === 'operational'} class="maturity">
					{maturityLabel(domain.maturity)}
				</span>
			</div>

			<p class="description">{domain.description}</p>
			<p class="maturity-note">{domain.maturityNote}</p>

			<div class="metadata">
				<div>
					<strong>Permission namespaces</strong>
					<p>{domain.permissionNamespaces.join(' · ')}</p>
				</div>
				<div>
					<strong>Your routes</strong>
					{#if domain.routes.length > 0}
						<div class="route-list">
							{#each domain.routes as route (route.href)}
								<a href={route.href}>{route.label}</a>
							{/each}
						</div>
					{:else}
						<p>
							{domain.maturity === 'planned'
								? 'No live workspace yet.'
								: 'No route in your effective permission scope.'}
						</p>
					{/if}
				</div>
			</div>
		</article>
	{/each}
</section>

<style>
	.page-header {
		max-width: 62rem;
		margin-bottom: 1rem;
	}

	.eyebrow,
	.domain-number {
		margin: 0 0 0.35rem;
		color: var(--nb-text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.04em;
	}

	.page-header p:last-child {
		color: var(--nb-text-muted);
		line-height: 1.6;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.metrics article {
		display: grid;
		gap: 0.25rem;
		padding: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-white);
	}

	.metrics span {
		color: var(--nb-text-muted);
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.metrics strong {
		font-size: 1.75rem;
	}

	.registry {
		display: grid;
		gap: 0.75rem;
	}

	.capability-card {
		padding: 1.1rem 1.2rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-white);
	}

	.capability-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	h2 {
		margin: 0;
		font-size: 1.08rem;
		letter-spacing: -0.015em;
	}

	.maturity {
		flex: 0 0 auto;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--nb-border);
		border-radius: 999px;
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
		font-size: 0.72rem;
		font-weight: 800;
	}

	.maturity-operational {
		border-color: var(--nb-border-strong);
		color: var(--nb-text);
	}

	.description,
	.maturity-note,
	.metadata p {
		color: var(--nb-text-muted);
		line-height: 1.5;
	}

	.description {
		margin-bottom: 0.4rem;
	}

	.maturity-note {
		margin-top: 0;
	}

	.metadata {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--nb-border);
	}

	.metadata strong {
		font-size: 0.76rem;
	}

	.metadata p {
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
	}

	.route-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.35rem;
	}

	.route-list a {
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		color: var(--nb-blue);
		font-size: 0.78rem;
		font-weight: 750;
		text-decoration: none;
	}

	.route-list a:hover,
	.route-list a:focus-visible {
		background: var(--nb-surface-muted);
	}

	@media (max-width: 760px) {
		.metrics,
		.metadata {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (max-width: 560px) {
		.metrics,
		.metadata {
			grid-template-columns: 1fr;
		}

		.capability-heading {
			flex-direction: column;
		}
	}
</style>
