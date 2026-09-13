<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ActionBar,
		Alert,
		Button,
		EmptyState,
		Field,
		PageHeader,
		Panel,
		Stat,
		StatusBadge
	} from '$lib/components/ui';

	let { form } = $props();
</script>

<svelte:head>
	<title>Design system · NuBlox</title>
	<meta
		name="description"
		content="NuBlox design system laboratory for shared enterprise application patterns."
	/>
</svelte:head>

{#snippet headerActions()}
	<Button variant="secondary">Secondary action</Button>
	<Button>Primary action</Button>
{/snippet}

{#snippet headerMeta()}
	<div class="meta-row">
		<StatusBadge label="Foundation" tone="info" />
		<span>Semantic tokens · reusable components · progressive enhancement</span>
	</div>
{/snippet}

{#snippet panelAction()}
	<Button variant="quiet" size="sm">View guidance</Button>
{/snippet}

{#snippet emptyActions()}
	<Button variant="secondary">Create first record</Button>
{/snippet}

<div class="nb-page-wide laboratory">
	<PageHeader
		eyebrow="NuBlox design system"
		title="One interaction language for F01–F29"
		description="Shared foundations and enterprise patterns keep business workflows consistent while domain rules remain authoritative on the server."
		actions={headerActions}
		meta={headerMeta}
	/>

	<section class="stack" aria-label="Design system examples">
		<Panel
			title="Action hierarchy"
			description="Primary intent is visually dominant. Routine, quiet and destructive actions are distinct without creating function-specific variants."
			actions={panelAction}
		>
			<ActionBar>
				<Button>Save changes</Button>
				<Button variant="secondary">Save draft</Button>
				<Button variant="quiet">Cancel</Button>
				{#snippet secondary()}
					<Button variant="danger" size="sm">Archive</Button>
				{/snippet}
			</ActionBar>
		</Panel>

		<Panel
			title="Lifecycle and performance language"
			description="Status and performance components use semantic meaning rather than arbitrary raw colours."
		>
			<div class="status-row">
				<StatusBadge label="Draft" />
				<StatusBadge label="Active" tone="success" />
				<StatusBadge label="Needs attention" tone="warning" />
				<StatusBadge label="Blocked" tone="danger" />
				<StatusBadge label="In review" tone="info" />
			</div>
			<div class="stat-grid">
				<Stat label="On plan" value="82%" detail="12 of 15 objectives" tone="success" />
				<Stat label="Attention" value="3" detail="Material exceptions" tone="warning" />
				<Stat label="Decisions due" value="2" detail="Awaiting authority" tone="danger" />
				<Stat label="Next review" value="18 Sep" detail="Executive strategy review" tone="info" />
			</div>
		</Panel>

		<Panel
			title="Forms use actions and progressive enhancement"
			description="This form posts to a SvelteKit server action. JavaScript enhances the interaction, but validation and authority remain server-side."
			padding="spacious"
		>
			{#if form?.success}
				<Alert tone="success" title="Action completed">{form.message}</Alert>
			{:else if form?.errors}
				<Alert tone="danger" title="Check the highlighted fields">
					The server rejected the submitted values. Nothing was mutated.
				</Alert>
			{/if}

			<form method="POST" action="?/preview" use:enhance class="form-grid">
				<Field
					id="title"
					label="Record title"
					required
					hint="Use clear business language."
					error={form?.errors?.title}
				>
					<input
						class="nb-control"
						id="title"
						name="title"
						value={form?.values?.title ?? ''}
						aria-invalid={form?.errors?.title ? 'true' : undefined}
						aria-describedby={form?.errors?.title ? 'title-error' : 'title-hint'}
					/>
				</Field>

				<Field
					id="owner"
					label="Accountable owner"
					required
					hint="A person or governed position."
					error={form?.errors?.owner}
				>
					<input
						class="nb-control"
						id="owner"
						name="owner"
						value={form?.values?.owner ?? ''}
						aria-invalid={form?.errors?.owner ? 'true' : undefined}
						aria-describedby={form?.errors?.owner ? 'owner-error' : 'owner-hint'}
					/>
				</Field>

				<Field
					id="priority"
					label="Priority"
					required
					hint="Used only for this interaction example."
					error={form?.errors?.priority}
				>
					<select
						class="nb-control"
						id="priority"
						name="priority"
						aria-invalid={form?.errors?.priority ? 'true' : undefined}
						aria-describedby={form?.errors?.priority ? 'priority-error' : 'priority-hint'}
					>
						<option value="normal" selected={(form?.values?.priority ?? 'normal') === 'normal'}
							>Normal</option
						>
						<option value="high" selected={form?.values?.priority === 'high'}>High</option>
						<option value="critical" selected={form?.values?.priority === 'critical'}
							>Critical</option
						>
					</select>
				</Field>

				<div class="full">
					<Field id="notes" label="Notes" hint="Optional supporting context.">
						<textarea class="nb-control" id="notes" name="notes"
							>{form?.values?.notes ?? ''}</textarea
						>
					</Field>
				</div>

				<div class="form-actions full">
					<Button type="submit">Validate with server action</Button>
					<Button type="reset" variant="secondary">Reset</Button>
				</div>
			</form>
		</Panel>

		<div class="two-column">
			<Panel
				title="Empty state"
				description="Empty states explain what belongs here and offer the next meaningful action."
			>
				<EmptyState
					title="No strategic objectives yet"
					description="Create the first objective when the approved strategy is ready to translate into measurable outcomes."
					actions={emptyActions}
				/>
			</Panel>
			<Panel
				title="System feedback"
				description="Feedback uses the same semantic tones across every function."
			>
				<div class="stack compact">
					<Alert tone="info" title="Information"
						>A contextual fact that helps the user decide.</Alert
					>
					<Alert tone="success" title="Success">The governed action completed successfully.</Alert>
					<Alert tone="warning" title="Attention">A material condition needs review.</Alert>
					<Alert tone="danger" title="Unable to continue">The transaction cannot proceed.</Alert>
				</div>
			</Panel>
		</div>
	</section>
</div>

<style>
	.laboratory {
		padding-bottom: var(--nb-space-16);
	}
	.stack {
		display: grid;
		gap: var(--nb-space-6);
	}
	.stack.compact {
		gap: var(--nb-space-3);
	}
	.meta-row,
	.status-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--nb-space-2);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-sm);
	}
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--nb-space-6);
		margin-top: var(--nb-space-8);
	}
	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-5);
		margin-top: var(--nb-space-6);
	}
	.full {
		grid-column: 1 / -1;
	}
	.form-actions {
		display: flex;
		gap: var(--nb-space-2);
		padding-top: var(--nb-space-2);
	}
	.two-column {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--nb-space-6);
	}
	@media (max-width: 900px) {
		.stat-grid,
		.two-column {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 640px) {
		.stat-grid,
		.form-grid,
		.two-column {
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
