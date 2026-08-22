<script lang="ts">
	let { data, form } = $props();
	let assignableMembers = $derived(data.members.filter((member) => !member.isCurrent));
</script>

<svelte:head>
	<title>Permission exceptions · NuBlox</title>
</svelte:head>

<section class="page-header">
	<p class="eyebrow">Organisation administration</p>
	<h1>Permission exceptions</h1>
	<p>
		Maintain explicit member allows and denies without changing the member's organisation roles.
	</p>
</section>

<section class="precedence" aria-label="Permission precedence">
	<strong>Effective precedence</strong>
	<span>member deny</span>
	<span>member allow</span>
	<span>active role grant</span>
	<span>default deny</span>
</section>

{#if form?.overrideError}
	<p class="notice error" role="alert">{form.overrideError}</p>
{/if}

<section class="panel" aria-labelledby="new-override-heading">
	<div class="panel-heading">
		<div>
			<p class="eyebrow">Controlled exception</p>
			<h2 id="new-override-heading">Set member override</h2>
		</div>
		<p>
			Every exception requires a reason and is written to audit history and the transactional event
			outbox.
		</p>
	</div>

	<form method="POST" action="?/setOverride" class="form-grid" novalidate>
		<label>
			<span>Member</span>
			<select name="memberPublicId" required>
				<option value="">Select member</option>
				{#each assignableMembers as member}
					<option value={member.publicId}>
						{member.displayName}{member.email ? ` · ${member.email}` : ''} · {member.status}
					</option>
				{/each}
			</select>
		</label>

		<label>
			<span>Permission key</span>
			<input
				type="text"
				name="permissionKey"
				list="permission-keys"
				maxlength="160"
				required
				placeholder="crm.view"
			/>
			<datalist id="permission-keys">
				{#each data.permissions as permission}
					<option value={permission.key}>{permission.name}</option>
				{/each}
			</datalist>
		</label>

		<label>
			<span>Effect</span>
			<select name="effect" required>
				<option value="deny">Deny</option>
				<option value="allow">Allow</option>
			</select>
		</label>

		<label class="reason-field">
			<span>Reason</span>
			<textarea name="reason" maxlength="500" rows="3" required></textarea>
		</label>

		<div class="action-cell">
			<button type="submit">Set permission exception</button>
		</div>
	</form>
</section>

<section class="panel" aria-labelledby="current-overrides-heading">
	<div class="panel-heading compact">
		<div>
			<p class="eyebrow">Effective exceptions</p>
			<h2 id="current-overrides-heading">Current member overrides</h2>
		</div>
		<p>Removing an exception returns permission evaluation to the next rule in the precedence chain.</p>
	</div>

	{#if data.overrides.length === 0}
		<p class="empty-state">No explicit member permission exceptions are active.</p>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th scope="col">Member</th>
						<th scope="col">Permission</th>
						<th scope="col">Effect</th>
						<th scope="col">Reason</th>
						<th scope="col"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.overrides as override}
						<tr>
							<td>{override.memberDisplayName}</td>
							<td>
								<code>{override.permissionKey}</code>
								<small>{override.permissionName}</small>
							</td>
							<td><span class:deny={override.effect === 'deny'} class="effect">{override.effect}</span></td>
							<td>{override.reason}</td>
							<td class="row-action">
								<form method="POST" action="?/removeOverride">
									<input type="hidden" name="memberPublicId" value={override.memberPublicId} />
									<input type="hidden" name="permissionKey" value={override.permissionKey} />
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
	.empty-state,
	td small {
		color: var(--nb-text-muted);
		line-height: 1.5;
	}

	.precedence {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-surface-muted);
		padding: 0.75rem;
	}

	.precedence span {
		border-radius: 999px;
		background: var(--nb-white);
		padding: 0.32rem 0.58rem;
		font-size: 0.8rem;
		font-weight: 700;
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
		grid-template-columns: 1.1fr 1.1fr 0.55fr;
		gap: 1rem;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-weight: 700;
	}

	.reason-field,
	.action-cell {
		grid-column: 1 / -1;
	}

	input,
	select,
	textarea {
		width: 100%;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
		color: var(--nb-text);
		padding: 0.68rem;
		font: inherit;
	}

	textarea {
		resize: vertical;
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
		vertical-align: top;
	}

	th {
		color: var(--nb-text-muted);
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	td small {
		display: block;
	}

	.effect {
		display: inline-block;
		border-radius: 999px;
		background: #edf7ef;
		color: #185c29;
		padding: 0.25rem 0.5rem;
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.effect.deny {
		background: #fff2f2;
		color: #8d1717;
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

	@media (max-width: 800px) {
		.panel-heading {
			display: block;
		}

		.panel-heading > p {
			margin-top: 0.5rem;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.reason-field,
		.action-cell {
			grid-column: auto;
		}
	}
</style>
