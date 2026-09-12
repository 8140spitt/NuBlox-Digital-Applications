<script lang="ts">
	import { routes } from '$lib/routing/route-contract';

	let { data } = $props();
</script>

<section class="nb-page dashboard">
	<header class="dashboard-heading">
		<div>
			<p class="nb-eyebrow">Organisation home</p>
			<h1>{data.tenant.displayName}</h1>
			<p class="nb-lede">
				Orientation, priorities and exceptions belong here. NuBlox V2 keeps transactions and record
				management inside their focused workspaces instead of loading the home screen with forms.
			</p>
		</div>
		<div class="context-card">
			<span>Current context</span>
			<strong>{data.tenant.displayName}</strong>
			<small>/{data.tenant.slug}</small>
		</div>
	</header>

	<section class="focus-panel" aria-labelledby="focus-heading">
		<div class="panel-copy">
			<p class="nb-eyebrow">Your focus</p>
			<h2 id="focus-heading">Start with work that requires attention.</h2>
			<p>
				My Work will consolidate governed actions, approvals, decisions, reviews and exceptions from
				every activated business function.
			</p>
		</div>
		<a class="primary-action" href={routes.myWork(data.tenant.slug)}>Open My work</a>
	</section>

	<div class="workspace-grid" aria-label="V2 foundations">
		<article>
			<div class="card-index">01</div>
			<h2>Enterprise functions</h2>
			<p>
				Browse the canonical F01–F29 operating model without exposing backend capability boundaries as
				navigation.
			</p>
			<a href={routes.functions(data.tenant.slug)}>Explore all 29 functions</a>
		</article>

		<article>
			<div class="card-index">02</div>
			<h2>Persistent context</h2>
			<p>
				Tenant context is explicit in every internal URL. External collaboration will remain separately
				scoped by tenant and CRM party.
			</p>
			<span class="foundation-state">Foundation active</span>
		</article>

		<article>
			<div class="card-index">03</div>
			<h2>Focused workspaces</h2>
			<p>
				Each page will have one primary purpose: orient, compare, inspect a record, complete a
				transaction or make a decision.
			</p>
			<span class="foundation-state">V2 operating rule</span>
		</article>
	</div>
</section>

<style>
	.dashboard {
		display: grid;
		gap: 34px;
	}

	.dashboard-heading {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
		gap: 44px;
		align-items: end;
	}

	.dashboard h1 {
		margin: 0 0 16px;
		font-size: clamp(2.3rem, 5vw, 4.2rem);
		line-height: 1;
		letter-spacing: -0.055em;
	}

	.context-card {
		display: grid;
		gap: 6px;
		padding: 20px;
		border: 1px solid var(--nb-border);
		border-radius: 14px;
		background: var(--nb-surface);
	}

	.context-card span,
	.context-card small {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--nb-muted);
	}

	.context-card strong {
		font-size: 1.05rem;
	}

	.focus-panel {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 28px;
		padding: 28px;
		border-radius: 16px;
		background: var(--nb-ink);
		color: var(--nb-surface);
	}

	.panel-copy {
		max-width: 720px;
	}

	.focus-panel .nb-eyebrow {
		color: color-mix(in srgb, var(--nb-surface) 68%, transparent);
	}

	.focus-panel h2 {
		margin: 4px 0 8px;
		font-size: clamp(1.35rem, 3vw, 2rem);
		letter-spacing: -0.035em;
	}

	.focus-panel p:last-child {
		margin: 0;
		line-height: 1.6;
		color: color-mix(in srgb, var(--nb-surface) 72%, transparent);
	}

	.primary-action {
		flex: 0 0 auto;
		padding: 11px 14px;
		border-radius: 9px;
		background: var(--nb-surface);
		color: var(--nb-ink);
		font-weight: 780;
		text-decoration: none;
	}

	.workspace-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
	}

	.workspace-grid article {
		display: flex;
		min-height: 240px;
		flex-direction: column;
		padding: 22px;
		border: 1px solid var(--nb-border);
		border-radius: 14px;
		background: var(--nb-surface);
	}

	.card-index {
		font-size: 0.72rem;
		font-weight: 850;
		letter-spacing: 0.08em;
		color: var(--nb-muted);
	}

	.workspace-grid h2 {
		margin: 30px 0 8px;
		font-size: 1.08rem;
	}

	.workspace-grid p {
		margin: 0 0 24px;
		line-height: 1.58;
		color: var(--nb-muted);
	}

	.workspace-grid a,
	.foundation-state {
		margin-top: auto;
		font-size: 0.84rem;
		font-weight: 760;
	}

	.workspace-grid a {
		text-decoration: none;
	}

	.foundation-state {
		color: var(--nb-muted);
	}

	@media (max-width: 850px) {
		.dashboard-heading,
		.workspace-grid {
			grid-template-columns: 1fr;
		}

		.focus-panel {
			align-items: flex-start;
			flex-direction: column;
		}
	}
</style>
