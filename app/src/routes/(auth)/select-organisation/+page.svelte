<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

	let { data } = $props();
	let selecting = $state<string | null>(null);
	let message = $state('');

	async function selectOrganisation(organisationPublicId: string) {
		selecting = organisationPublicId;
		message = '';
		const response = await fetch('/api/tenant/select', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ organisationPublicId })
		});
		selecting = null;
		if (!response.ok) {
			message = 'That organisation could not be selected.';
			return;
		}
		await goto('/dashboard', { invalidateAll: true });
	}

	async function signOut() {
		await authClient.signOut();
		await goto('/signin', { invalidateAll: true });
	}
</script>

<svelte:head>
	<title>Select organisation · NuBlox</title>
</svelte:head>

<main class="shell">
	<section class="card">
		<p class="brand">NuBlox</p>
		<h1>Select an organisation</h1>
		<p class="lede">Signed in as {data.actor.displayName} · {data.actor.email}</p>

		{#if data.memberships.length === 0}
			<div class="notice">
				Your account does not currently have an active organisation membership. Ask an organisation
				administrator for an invitation.
			</div>
		{:else}
			<div class="choices">
				{#each data.memberships as membership}
					<button
						class:current={membership.organisationPublicId === data.currentOrganisationPublicId}
						type="button"
						disabled={selecting !== null}
						onclick={() => selectOrganisation(membership.organisationPublicId)}
					>
						<span>{membership.organisationName}</span>
						<small>
							{selecting === membership.organisationPublicId
								? 'Selecting…'
								: membership.organisationPublicId === data.currentOrganisationPublicId
									? 'Current organisation'
									: 'Open organisation'}
						</small>
					</button>
				{/each}
			</div>
		{/if}

		{#if message}<p class="error" role="alert">{message}</p>{/if}
		<button class="signout" type="button" onclick={signOut}>Sign out</button>
	</section>
</main>

<style>
	.shell { min-height: 100vh; display: grid; place-items: center; padding: 2rem; background: #f5f5f2; }
	.card { width: min(100%, 42rem); background: white; border: 1px solid #d9d9d2; border-radius: 1rem; padding: 2rem; }
	.brand { margin: 0 0 2rem; font-weight: 800; }
	h1 { margin: 0; font-size: 2rem; }
	.lede { color: #5c5c56; }
	.choices { display: grid; gap: 0.75rem; margin: 1.5rem 0; }
	.choices button {
		display: flex; justify-content: space-between; align-items: center; gap: 1rem;
		width: 100%; text-align: left; padding: 1rem; border: 1px solid #c9c9c2;
		border-radius: 0.7rem; background: white; font: inherit; cursor: pointer;
	}
	.choices button:hover, .choices button:focus-visible { border-color: #111; }
	.choices button.current { border-color: #111; background: #f4f4ef; }
	.choices span { font-weight: 700; }
	.choices small { color: #666; }
	.notice { margin: 1.5rem 0; padding: 1rem; border-radius: 0.6rem; background: #f0f0ec; line-height: 1.5; }
	.error { color: #9b1c1c; }
	.signout { border: 0; background: transparent; padding: 0; text-decoration: underline; cursor: pointer; font: inherit; }
</style>
