<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Enterprise functions · NuBlox</title>
</svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Enterprise operating model</p>
		<h1>Functions</h1>
		<p class="lede">
			NuBlox is organised around the 29 functions the business performs. Your role controls what you
			can access; it does not change where work lives.
		</p>
	</div>
	<div class="legend" aria-label="Function status legend">
		<span><i class="status-dot available"></i> Available to you</span>
		<span><i class="status-dot delivered"></i> Live but not in your access</span>
		<span><i class="status-dot roadmap"></i> Functional workspace not yet live</span>
	</div>
</section>

<div class="function-list" aria-label="NuBlox enterprise functions">
	{#each data.functionDirectory as fn (fn.id)}
		{#if fn.available && fn.href}
			<a class="function-row available-row" href={fn.href}>
				<span class="function-id">{fn.id}</span>
				<span class="function-copy">
					<strong>{fn.name}</strong>
					<small>{fn.purpose}</small>
				</span>
				<span class="function-action">Open →</span>
			</a>
		{:else}
			<div class="function-row" class:delivered-row={fn.delivered}>
				<span class="function-id">{fn.id}</span>
				<span class="function-copy">
					<strong>{fn.name}</strong>
					<small>{fn.purpose}</small>
				</span>
				<span class="function-status">
					{fn.delivered ? 'Not in your access' : 'Workspace not yet live'}
				</span>
			</div>
		{/if}
	{/each}
</div>

<style>
	.page-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2rem;
		align-items: end;
		margin-bottom: 1.25rem;
	}

	.page-header > div:first-child {
		max-width: 54rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--nb-text-muted);
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.04em;
	}

	.lede {
		max-width: 48rem;
		margin: 0.55rem 0 0;
		color: var(--nb-text-muted);
		line-height: 1.55;
	}

	.legend {
		display: grid;
		gap: 0.35rem;
		padding: 0.8rem 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
		font-size: 0.76rem;
		color: var(--nb-text-muted);
	}

	.legend span {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--nb-border-strong);
	}

	.status-dot.available {
		background: var(--nb-blue);
	}

	.status-dot.delivered {
		background: var(--nb-text-muted);
	}

	.function-list {
		display: grid;
		border-top: 1px solid var(--nb-border);
		background: var(--nb-white);
	}

	.function-row {
		display: grid;
		grid-template-columns: 3.6rem minmax(0, 1fr) minmax(9rem, auto);
		gap: 1rem;
		align-items: center;
		min-height: 4.6rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--nb-border);
		color: var(--nb-text);
		text-decoration: none;
	}

	a.function-row:hover,
	a.function-row:focus-visible {
		background: var(--nb-surface-muted);
	}

	.function-id {
		font-size: 0.78rem;
		font-weight: 850;
		letter-spacing: 0.08em;
		color: var(--nb-text-muted);
	}

	.function-copy {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
	}

	.function-copy strong {
		font-size: 0.96rem;
	}

	.function-copy small {
		color: var(--nb-text-muted);
		line-height: 1.4;
	}

	.function-action,
	.function-status {
		justify-self: end;
		font-size: 0.76rem;
		font-weight: 750;
	}

	.function-action {
		color: var(--nb-blue);
	}

	.function-status {
		color: var(--nb-text-muted);
	}

	.function-row:not(.available-row) {
		background: color-mix(in srgb, var(--nb-surface-muted) 45%, var(--nb-white));
	}

	@media (max-width: 860px) {
		.page-header {
			grid-template-columns: 1fr;
		}

		.legend {
			width: fit-content;
		}
	}

	@media (max-width: 640px) {
		.function-row {
			grid-template-columns: 2.8rem minmax(0, 1fr);
			gap: 0.75rem;
		}

		.function-action,
		.function-status {
			grid-column: 2;
			justify-self: start;
		}
	}
</style>
