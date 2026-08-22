<script lang="ts">
	let { data, form } = $props();
	let profileSuccess = $derived(form?.profileSuccess ?? data.profileSuccess);
</script>

<svelte:head>
	<title>Organisation profile · NuBlox</title>
</svelte:head>

<section class="page-header">
	<p class="eyebrow">Organisation administration</p>
	<h1>Organisation profile</h1>
	<p>Maintain the canonical legal and operating defaults used across NuBlox.</p>
</section>

<p class="back-link"><a href="/organisation">← Back to access & roles</a></p>

{#if form?.profileError}
	<p class="notice error" role="alert">{form.profileError}</p>
{/if}
{#if profileSuccess}
	<p class="notice success" role="status">{profileSuccess}</p>
{/if}

<section class="panel" aria-labelledby="profile-heading">
	<div class="panel-heading">
		<div>
			<p class="eyebrow">Master data</p>
			<h2 id="profile-heading">Legal and operating identity</h2>
		</div>
		<p>
			These values belong to the organisation master record. Customer, supplier and project records
			reference this authority rather than creating duplicate organisation identities.
		</p>
	</div>

	<form method="POST" action="?/update" class="form-grid">
		<label class="wide">
			<span>Legal name</span>
			<input
				type="text"
				name="legalName"
				maxlength="255"
				autocomplete="organization"
				required
				value={data.profile.legalName}
			/>
		</label>

		<label class="wide">
			<span>Trading name</span>
			<input
				type="text"
				name="tradingName"
				maxlength="255"
				value={data.profile.tradingName ?? ''}
			/>
		</label>

		<label>
			<span>Default timezone</span>
			<input
				type="text"
				name="defaultTimezone"
				maxlength="64"
				required
				value={data.profile.defaultTimezone}
				placeholder="Europe/London"
			/>
			<small>Use an IANA timezone such as Europe/London.</small>
		</label>

		<label>
			<span>Default currency</span>
			<input
				type="text"
				name="defaultCurrencyCode"
				minlength="3"
				maxlength="3"
				pattern="[A-Za-z]{3}"
				required
				value={data.profile.defaultCurrencyCode}
				placeholder="GBP"
			/>
			<small>Three-letter ISO currency code.</small>
		</label>

		<div class="wide">
			<button type="submit">Save organisation profile</button>
		</div>
	</form>
</section>

<style>
	.page-header {
		margin-bottom: 0.9rem;
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
	label small {
		color: var(--nb-text-muted);
		line-height: 1.5;
	}

	.back-link {
		margin: 0 0 1rem;
	}

	.back-link a {
		color: var(--nb-blue);
		font-weight: 700;
		text-decoration: none;
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

	.notice.success {
		border-color: #a8d3b0;
		background: #f0faf2;
		color: #185c29;
	}

	.panel {
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
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.wide {
		grid-column: 1 / -1;
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

		.wide {
			grid-column: auto;
		}
	}
</style>
