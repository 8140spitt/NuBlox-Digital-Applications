<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Locations · NuBlox</title>
</svelte:head>

<section class="page-header">
	<p class="eyebrow">Organisation master data</p>
	<h1>Locations</h1>
	<p>Maintain offices, depots, yards, workshops and other organisation-owned locations.</p>
</section>

<section class="correction-note" aria-label="Address correction policy">
	<strong>Address corrections preserve history.</strong>
	<span>
		When an address changes, NuBlox relinks the location to a new canonical address record rather
		than mutating an address that may be referenced elsewhere.
	</span>
</section>

{#if form?.locationError}
	<p class="notice error" role="alert">{form.locationError}</p>
{/if}

<datalist id="location-types">
	<option value="headquarters">Headquarters</option>
	<option value="office">Office</option>
	<option value="branch">Branch</option>
	<option value="depot">Depot</option>
	<option value="yard">Yard</option>
	<option value="warehouse">Warehouse</option>
	<option value="workshop">Workshop</option>
</datalist>

<section class="panel" aria-labelledby="create-location-heading">
	<div class="panel-heading">
		<div>
			<p class="eyebrow">New master record</p>
			<h2 id="create-location-heading">Add organisation location</h2>
		</div>
		<p>Only organisation managers can maintain canonical organisation locations.</p>
	</div>

	<form method="POST" action="?/createLocation" class="location-form" novalidate>
		<div class="core-grid">
			<label>
				<span>Name</span>
				<input name="name" maxlength="200" required placeholder="London Headquarters" />
			</label>
			<label>
				<span>Location type</span>
				<input
					name="locationType"
					list="location-types"
					maxlength="64"
					required
					placeholder="office"
				/>
			</label>
			<label>
				<span>Timezone</span>
				<input name="timezone" maxlength="64" placeholder="Europe/London" />
			</label>
		</div>

		<fieldset>
			<legend>Address</legend>
			<div class="address-grid">
				<label class="wide">
					<span>Address line 1</span>
					<input name="line1" maxlength="255" />
				</label>
				<label class="wide">
					<span>Address line 2</span>
					<input name="line2" maxlength="255" />
				</label>
				<label class="wide">
					<span>Address line 3</span>
					<input name="line3" maxlength="255" />
				</label>
				<label>
					<span>Locality</span>
					<input name="locality" maxlength="160" />
				</label>
				<label>
					<span>City</span>
					<input name="city" maxlength="160" />
				</label>
				<label>
					<span>Region</span>
					<input name="region" maxlength="160" />
				</label>
				<label>
					<span>Postal code</span>
					<input name="postalCode" maxlength="32" />
				</label>
				<label>
					<span>Country code</span>
					<input name="countryCode" maxlength="2" placeholder="GB" />
				</label>
			</div>
		</fieldset>

		<button type="submit">Add location</button>
	</form>
</section>

<section class="panel" aria-labelledby="locations-heading">
	<div class="panel-heading compact">
		<div>
			<p class="eyebrow">Canonical locations</p>
			<h2 id="locations-heading">Current locations</h2>
		</div>
		<p>{data.locations.length} recorded</p>
	</div>

	{#if data.locations.length === 0}
		<p class="empty-state">No organisation locations have been recorded.</p>
	{:else}
		<div class="location-list">
			{#each data.locations as location}
				<details>
					<summary>
						<span>
							<strong>{location.name}</strong>
							<small
								>{location.locationType}{location.timezone ? ` · ${location.timezone}` : ''}</small
							>
						</span>
						<span class:inactive={!location.isActive} class="status">
							{location.isActive ? 'Active' : 'Inactive'}
						</span>
					</summary>

					<form method="POST" action="?/updateLocation" class="location-form edit-form" novalidate>
						<input type="hidden" name="locationPublicId" value={location.publicId} />
						<div class="core-grid">
							<label>
								<span>Name</span>
								<input name="name" maxlength="200" required value={location.name} />
							</label>
							<label>
								<span>Location type</span>
								<input
									name="locationType"
									list="location-types"
									maxlength="64"
									required
									value={location.locationType}
								/>
							</label>
							<label>
								<span>Timezone</span>
								<input name="timezone" maxlength="64" value={location.timezone ?? ''} />
							</label>
						</div>

						<fieldset>
							<legend>Address</legend>
							<div class="address-grid">
								<label class="wide">
									<span>Address line 1</span>
									<input name="line1" maxlength="255" value={location.address?.line1 ?? ''} />
								</label>
								<label class="wide">
									<span>Address line 2</span>
									<input name="line2" maxlength="255" value={location.address?.line2 ?? ''} />
								</label>
								<label class="wide">
									<span>Address line 3</span>
									<input name="line3" maxlength="255" value={location.address?.line3 ?? ''} />
								</label>
								<label>
									<span>Locality</span>
									<input name="locality" maxlength="160" value={location.address?.locality ?? ''} />
								</label>
								<label>
									<span>City</span>
									<input name="city" maxlength="160" value={location.address?.city ?? ''} />
								</label>
								<label>
									<span>Region</span>
									<input name="region" maxlength="160" value={location.address?.region ?? ''} />
								</label>
								<label>
									<span>Postal code</span>
									<input
										name="postalCode"
										maxlength="32"
										value={location.address?.postalCode ?? ''}
									/>
								</label>
								<label>
									<span>Country code</span>
									<input
										name="countryCode"
										maxlength="2"
										value={location.address?.countryCode ?? ''}
									/>
								</label>
							</div>
						</fieldset>

						<label class="active-toggle">
							<input type="checkbox" name="isActive" checked={location.isActive} />
							<span>Location is active</span>
						</label>

						<button type="submit">Save location</button>
					</form>
				</details>
			{/each}
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
	summary small,
	.correction-note span {
		color: var(--nb-text-muted);
		line-height: 1.5;
	}

	.correction-note {
		display: grid;
		gap: 0.2rem;
		margin-bottom: 1rem;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-surface-muted);
		padding: 0.8rem 1rem;
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
		max-width: 36rem;
	}

	.location-form {
		display: grid;
		gap: 1rem;
	}

	.core-grid,
	.address-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.85rem;
	}

	.address-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.wide {
		grid-column: 1 / -1;
	}

	label {
		display: grid;
		gap: 0.35rem;
		font-weight: 700;
	}

	fieldset {
		margin: 0;
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		padding: 1rem;
	}

	legend {
		padding: 0 0.4rem;
		color: var(--nb-ink);
		font-weight: 800;
	}

	input {
		width: 100%;
		border: 1px solid var(--nb-border-strong);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
		color: var(--nb-text);
		padding: 0.68rem;
		font: inherit;
	}

	button {
		justify-self: start;
		border: 1px solid var(--nb-ink);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-ink);
		color: var(--nb-white);
		font-weight: 750;
		padding: 0.65rem 0.95rem;
		cursor: pointer;
	}

	.location-list {
		display: grid;
		gap: 0.75rem;
	}

	details {
		border: 1px solid var(--nb-border);
		border-radius: var(--nb-radius-sm);
		background: var(--nb-white);
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1rem;
		cursor: pointer;
	}

	summary > span:first-child {
		display: grid;
		gap: 0.2rem;
	}

	.status {
		border-radius: 999px;
		background: #edf7ef;
		color: #185c29;
		padding: 0.28rem 0.55rem;
		font-size: 0.76rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.status.inactive {
		background: var(--nb-surface-muted);
		color: var(--nb-text-muted);
	}

	.edit-form {
		border-top: 1px solid var(--nb-border);
		padding: 1rem;
	}

	.active-toggle {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.active-toggle input {
		width: auto;
	}

	@media (max-width: 800px) {
		.panel-heading {
			display: block;
		}

		.panel-heading > p {
			margin-top: 0.5rem;
		}

		.core-grid,
		.address-grid {
			grid-template-columns: 1fr;
		}

		.wide {
			grid-column: auto;
		}
	}
</style>
