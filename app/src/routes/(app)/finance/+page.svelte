<script lang="ts">
	let { data } = $props();
	const finance = $derived(data.workspaceDirectory.find((section) => section.id === 'finance'));
</script>

<svelte:head><title>Finance · NuBlox</title></svelte:head>

<section class="page-heading">
	<p class="eyebrow">Business workspace</p>
	<h1>Finance</h1>
	<p>
		Move between accounts payable, billing, receivables, collections and accounting without returning
		to the global menu.
	</p>
</section>

<section class="featured" aria-label="Procure to pay">
	<a class="workspace-card featured-card" href="/finance/accounts-payable">
		<strong>Accounts Payable</strong>
		<span>Supplier invoices, three-way matching, exceptions and maker/checker approval.</span>
	</a>
</section>

{#if finance}
	<section class="workspace-grid" aria-label="Finance workspaces">
		{#each finance.items as item (item.id)}
			<a class="workspace-card" href={item.href}>
				<strong>{item.label}</strong>
				<span>{item.description ?? 'Open finance workspace'}</span>
			</a>
		{/each}
	</section>
{:else}
	<section class="notice">
		<h2>Finance access is not enabled</h2>
		<p>Your current organisation role does not expose a finance workspace.</p>
	</section>
{/if}

<style>
	.page-heading {
		max-width: 52rem;
		margin-bottom: 1.25rem;
	}
	.page-heading h1 {
		margin: 0.15rem 0 0.35rem;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.045em;
	}
	.page-heading p:last-child {
		margin: 0;
		color: var(--nb-text-muted);
		line-height: 1.55;
	}
	.eyebrow {
		margin: 0;
		color: var(--nb-text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.featured {
		margin-bottom: 0.8rem;
	}
	.workspace-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: 0.8rem;
	}
	.workspace-card,
	.notice {
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-white);
	}
	.workspace-card {
		display: grid;
		gap: 0.35rem;
		padding: 1rem;
		color: var(--nb-text);
		text-decoration: none;
	}
	.featured-card {
		border-color: var(--nb-border-strong);
		background: linear-gradient(135deg, var(--nb-white), var(--nb-surface-muted));
	}
	.workspace-card:hover,
	.workspace-card:focus-visible {
		border-color: var(--nb-border-strong);
		box-shadow: 0 8px 24px rgb(7 24 46 / 0.08);
	}
	.workspace-card span {
		color: var(--nb-text-muted);
		font-size: 0.82rem;
		line-height: 1.45;
	}
	.notice {
		padding: 1rem;
	}
</style>
