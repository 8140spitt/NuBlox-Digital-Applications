<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Alert,
		Breadcrumbs,
		Button,
		Field,
		LinkButton,
		PageHeader,
		Panel
	} from '$lib/components/ui';
	import { routes } from '$lib/routing/route-contract';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Create strategy · NuBlox</title>
	<meta
		name="description"
		content="Create a governed F01 strategy cycle with purpose, vision and planning horizon."
	/>
</svelte:head>

{#snippet headerActions()}
	<LinkButton href={routes.strategy(data.tenant.slug)} variant="quiet">Cancel</LinkButton>
{/snippet}

<div class="nb-page strategy-create-page">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: routes.dashboard(data.tenant.slug) },
			{ label: 'Functions', href: routes.functions(data.tenant.slug) },
			{ label: 'Strategy & Enterprise Planning', href: routes.strategy(data.tenant.slug) },
			{ label: 'Create strategy' }
		]}
	/>

	<PageHeader
		eyebrow="F01 · New strategy cycle"
		title="Set the direction before building the plan"
		description="Create the governed strategic context first. Environmental evidence, strategic choices, objectives, business plans, operating-model changes, KPIs, reviews and scenarios will all attach to this cycle."
		actions={headerActions}
	/>

	<div class="create-layout">
		<Panel padding="spacious">
			{#if form?.formError}
				<Alert tone="danger" title="Unable to create strategy">{form.formError}</Alert>
			{:else if form?.errors && Object.keys(form.errors).length > 0}
				<Alert tone="danger" title="Check the highlighted fields">
					The strategy has not been created. Correct the fields below and submit again.
				</Alert>
			{/if}

			<form method="POST" action="?/create" use:enhance class="strategy-form">
				<div class="full">
					<Field
						id="title"
						label="Strategy title"
						required
						hint="Use a name that will remain meaningful in the strategy history."
						error={form?.errors?.title}
					>
						<input
							class="nb-control"
							id="title"
							name="title"
							maxlength="255"
							required
							autocomplete="off"
							value={form?.values?.title ?? ''}
							placeholder="e.g. Perspective BC 2027–2030 Strategy"
							aria-invalid={form?.errors?.title ? 'true' : undefined}
							aria-describedby={form?.errors?.title ? 'title-error' : 'title-hint'}
						/>
					</Field>
				</div>

				<Field
					id="horizonStart"
					label="Horizon start"
					required
					hint="When this strategy becomes relevant."
					error={form?.errors?.horizonStart}
				>
					<input
						class="nb-control"
						id="horizonStart"
						name="horizonStart"
						type="date"
						required
						value={form?.values?.horizonStart ?? ''}
						aria-invalid={form?.errors?.horizonStart ? 'true' : undefined}
						aria-describedby={form?.errors?.horizonStart
							? 'horizonStart-error'
							: 'horizonStart-hint'}
					/>
				</Field>

				<Field
					id="horizonEnd"
					label="Horizon end"
					required
					hint="The intended strategic planning horizon."
					error={form?.errors?.horizonEnd}
				>
					<input
						class="nb-control"
						id="horizonEnd"
						name="horizonEnd"
						type="date"
						required
						value={form?.values?.horizonEnd ?? ''}
						aria-invalid={form?.errors?.horizonEnd ? 'true' : undefined}
						aria-describedby={form?.errors?.horizonEnd ? 'horizonEnd-error' : 'horizonEnd-hint'}
					/>
				</Field>

				<div class="full">
					<Field
						id="purpose"
						label="Purpose"
						required
						hint="Why does the organisation exist, for whom, and what enduring value does it create?"
						error={form?.errors?.purpose}
					>
						<textarea
							class="nb-control narrative"
							id="purpose"
							name="purpose"
							rows="4"
							required
							aria-invalid={form?.errors?.purpose ? 'true' : undefined}
							aria-describedby={form?.errors?.purpose ? 'purpose-error' : 'purpose-hint'}
							>{form?.values?.purpose ?? ''}</textarea
						>
					</Field>
				</div>

				<div class="full">
					<Field
						id="vision"
						label="Vision"
						required
						hint="Describe the future state that should be recognisably true by the end of the horizon."
						error={form?.errors?.vision}
					>
						<textarea
							class="nb-control narrative"
							id="vision"
							name="vision"
							rows="5"
							required
							aria-invalid={form?.errors?.vision ? 'true' : undefined}
							aria-describedby={form?.errors?.vision ? 'vision-error' : 'vision-hint'}
							>{form?.values?.vision ?? ''}</textarea
						>
					</Field>
				</div>

				<div class="full">
					<Field
						id="mission"
						label="Mission"
						hint="Optional. Use this only if the organisation distinguishes mission from purpose."
					>
						<textarea class="nb-control narrative" id="mission" name="mission" rows="3"
							>{form?.values?.mission ?? ''}</textarea
						>
					</Field>
				</div>

				<div class="form-actions full">
					<Button type="submit">Create strategy cycle</Button>
					<LinkButton href={routes.strategy(data.tenant.slug)} variant="secondary"
						>Cancel</LinkButton
					>
				</div>
			</form>
		</Panel>

		<aside class="guidance" aria-label="Strategy creation guidance">
			<p class="guidance-kicker">What this creates</p>
			<h2>One governed strategic context.</h2>
			<p>
				This action creates a draft strategy cycle owned by you. It does not approve strategy or
				invent objectives on your behalf.
			</p>
			<ol>
				<li>
					<span>01</span>
					<div>
						<strong>Direction</strong><small
							>Purpose, vision and horizon become the stable strategic frame.</small
						>
					</div>
				</li>
				<li>
					<span>02</span>
					<div>
						<strong>Evidence and choice</strong><small
							>Environmental analysis supports options and objectives.</small
						>
					</div>
				</li>
				<li>
					<span>03</span>
					<div>
						<strong>Plan and execute</strong><small
							>Business plans, resources and initiatives connect to delivery.</small
						>
					</div>
				</li>
				<li>
					<span>04</span>
					<div>
						<strong>Measure and learn</strong><small
							>KPIs, reviews and scenarios close the strategy loop.</small
						>
					</div>
				</li>
			</ol>
			<div class="authority-note">
				<strong>Governance rule</strong>
				<p>
					Draft work can be amended. Approved strategy becomes immutable enterprise evidence and is
					changed through a controlled revision.
				</p>
			</div>
		</aside>
	</div>
</div>

<style>
	.strategy-create-page {
		display: grid;
		gap: var(--nb-space-5);
		padding-bottom: var(--nb-space-16);
	}

	.create-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.75fr);
		gap: var(--nb-space-8);
		align-items: start;
	}

	.strategy-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-6);
		margin-top: var(--nb-space-6);
	}

	.full {
		grid-column: 1 / -1;
	}

	.narrative {
		min-height: auto;
		resize: vertical;
		line-height: var(--nb-line-relaxed);
	}

	.form-actions {
		display: flex;
		align-items: center;
		gap: var(--nb-space-3);
		padding-top: var(--nb-space-2);
	}

	.guidance {
		position: sticky;
		top: 88px;
		padding: var(--nb-space-6);
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-subtle);
	}

	.guidance-kicker {
		margin: 0;
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.guidance h2 {
		margin: var(--nb-space-2) 0 0;
		font-size: var(--nb-font-size-xl);
		letter-spacing: -0.025em;
	}

	.guidance > p:not(.guidance-kicker) {
		margin: var(--nb-space-3) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-sm);
		line-height: var(--nb-line-relaxed);
	}

	.guidance ol {
		display: grid;
		margin: var(--nb-space-6) 0 0;
		padding: 0;
		border-top: 1px solid var(--nb-color-border-default);
		list-style: none;
	}

	.guidance li {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr);
		gap: var(--nb-space-3);
		padding: var(--nb-space-4) 0;
		border-bottom: 1px solid var(--nb-color-border-default);
	}

	.guidance li > span {
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
	}

	.guidance li div {
		display: grid;
		gap: var(--nb-space-1);
	}

	.guidance li strong {
		font-size: var(--nb-font-size-sm);
	}

	.guidance li small {
		color: var(--nb-color-text-secondary);
		line-height: var(--nb-line-normal);
	}

	.authority-note {
		margin-top: var(--nb-space-6);
		padding: var(--nb-space-4);
		border-left: 3px solid var(--nb-color-info);
		background: var(--nb-color-bg-surface);
	}

	.authority-note strong {
		font-size: var(--nb-font-size-sm);
	}

	.authority-note p {
		margin: var(--nb-space-2) 0 0;
		color: var(--nb-color-text-secondary);
		font-size: var(--nb-font-size-xs);
		line-height: var(--nb-line-relaxed);
	}

	@media (max-width: 900px) {
		.create-layout {
			grid-template-columns: 1fr;
		}

		.guidance {
			position: static;
		}
	}

	@media (max-width: 640px) {
		.strategy-form {
			grid-template-columns: 1fr;
		}

		.full {
			grid-column: auto;
		}

		.form-actions {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
