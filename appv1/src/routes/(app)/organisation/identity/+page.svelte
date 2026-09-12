<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Legal identity · NuBlox</title>
</svelte:head>

<section class="page-header">
	<p class="eyebrow">Organisation administration</p>
	<h1>Legal identity</h1>
	<p>Maintain registry, tax and other legal identifiers against the canonical organisation.</p>
</section>

{#if form?.identifierError}
	<p class="notice error" role="alert">{form.identifierError}</p>
{/if}

<section class="panel" aria-labelledby="identifiers-heading">
	<div class="panel-heading">
		<div>
			<p class="eyebrow">Master data</p>
			<h2 id="identifiers-heading">{data.organisation.legalName}</h2>
		</div>
		<p>
			Use stable identifier types such as <code>companies_house_number</code>,
			<code>vat_number</code> or <code>lei</code>. Identifier types are normalised to lowercase.
		</p>
	</div>

	<form method="POST" action="?/addIdentifier" class="form-grid" novalidate>
		<label>
			<span>Identifier type</span>
			<input
				type="text"
				name="identifierType"
				maxlength="64"
				required
				placeholder="companies_house_number"
			/>
		</label>
		<label>
			<span>Identifier value</span>
			<input type="text" name="identifierValue" maxlength="160" required placeholder="12345678" />
		</label>
		<label>
			<span>Issuing country</span>
			<input type="text" name="issuingCountryCode" maxlength="2" placeholder="GB" />
			<small>Optional two-letter ISO country code.</small>
		</label>
		<div class="action-cell">
			<button type="submit">Add identifier</button>
		</div>
	</form>
</section>

<section class="panel" aria-labelledby="registered-heading">
	<div class="panel-heading compact">
		<div>
			<p class="eyebrow">Registered identifiers</p>
			<h2 id="registered-heading">Current legal identifiers</h2>
		</div>
		<p>
			Corrections are remove-and-replace operations so both changes remain explicit in audit
			history.
		</p>
	</div>

	{#if data.identifiers.length === 0}
		<p class="empty-state">No legal or regulatory identifiers have been recorded.</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Type</th>
						<th scope="col">Value</th>
						<th scope="col">Issuing country</th>
						<th scope="col"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.identifiers as identifier}
						<tr>
							<td><code>{identifier.identifierType}</code></td>
							<td>{identifier.identifierValue}</td>
							<td>{identifier.issuingCountryCode ?? '—'}</td>
							<td class="row-action">
								<form method="POST" action="?/removeIdentifier">
									<input type="hidden" name="identifierType" value={identifier.identifierType} />
									<input type="hidden" name="identifierValue" value={identifier.identifierValue} />
									<button class="secondary" type="submit">Remove</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.page-header {
		margin-bottom: 1rem;
	}

	.eyebrow {
		margin: 0 0 0.35rem;
		color: var(--nb-text-muted);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	h1,
	h2 {
		color: var(--nb-ink);
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.04em;
	}

	.page-header > p:last-child,
	.panel-heading > p,
	label small,
	.empty-state {
		color: var(--nb-text-muted);
		line-height: 1.5;
	}

	.notice {
		margin: 0 0 1rem;
		border: 1px solid;
		border-radius: var(--nb-radius-sm);
		padding: 0.8rem 1rem;
	}

	.notice.error {
		border-color: #e1aaaa;
		background: #fff2f2;
		color: #8d1717;
	}

	.panel {
		margin-bottom: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-md);
		background: var(--nb-surface);
		padding: 1.25rem;
		box-shadow: var(--nb-shadow-sm);
	}

	.panel-heading {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 1.2rem;
	}

	.panel-heading.compact {
		margin-bottom: 0.8rem;
	}

	.panel-heading h2 {
		margin: 0;
		font-size: 1.45rem;
	}

	.panel-heading > p {
		margin: 0;
		max-width: 38rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1.4fr 0.55fr auto;
		align-items: end;
		gap: 1rem;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-weight: 700;
	}

	input {
		width: 100%;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
		color: var(--nb-text);
		padding: 0.68rem;
	}

	button {
		border: 1px solid var(--nb-ink);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-ink);
		color: var(--nb-white);
		font-weight: 750;
		padding: 0.65rem 0.95rem;
		cursor: pointer;
	}

	button.secondary {
		background: var(--nb-white);
		color: var(--nb-ink);
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		border-top: 1px solid var(--nb-border);
		padding: 0.75rem 0.65rem;
		text-align: left;
		vertical-align: middle;
	}

	th {
		color: var(--nb-text-muted);
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.row-action {
		text-align: right;
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

	@media (max-width: 900px) {
		.form-grid {
			grid-template-columns: 1fr 1fr;
		}

		.action-cell {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 760px) {
		.panel-heading {
			display: block;
		}

		.panel-heading > p {
			margin-top: 0.5rem;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.action-cell {
			grid-column: auto;
		}
	}
</style>
