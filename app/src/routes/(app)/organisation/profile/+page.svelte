<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>Organisation profile · NuBlox</title>
</svelte:head>

<section class="page-header">
	<p class="eyebrow">Organisation administration</p>
	<h1>Organisation profile</h1>
	<p>Maintain the canonical legal and operating defaults used across NuBlox.</p>
</section>

<p><a href="/organisation">← Back to organisation administration</a></p>

{#if form?.profileError}
	<p class="notice error" role="alert">{form.profileError}</p>
{/if}
{#if form?.profileSuccess}
	<p class="notice success" role="status">{form.profileSuccess}</p>
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
			<input type="text" name="legalName" maxlength="255" required value={data.profile.legalName} />
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
