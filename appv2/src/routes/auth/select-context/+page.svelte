<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head>
	<title>Select organisation · NuBlox</title>
	<meta name="description" content="Choose the NuBlox organisation you are authorised to access." />
</svelte:head>

<main class="context-shell">
	<section class="context-card">
		<a class="brand" href={resolve('/auth/start')}>NuBlox</a>
		<p class="nb-eyebrow">Authorised context</p>
		<h1>Choose an organisation</h1>
		<p class="lede">
			{data.user.name}, your account is active in more than one NuBlox organisation. Choose the
			organisation you want to work in.
		</p>

		<div class="context-list">
			{#each data.contexts as context}
				<a class="context-option" href={context.href}>
					<strong>{context.organisationName}</strong>
					<span>{context.organisationPublicId}</span>
				</a>
			{/each}
		</div>

		<p class="identity-note">Signed in as {data.user.email}</p>
	</section>
</main>

<style>
	.context-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 28px;
		background: var(--nb-ink);
	}

	.context-card {
		width: min(100%, 680px);
		border-radius: 16px;
		padding: clamp(30px, 6vw, 52px);
		background: var(--nb-surface);
	}

	.brand {
		display: inline-block;
		margin-bottom: 58px;
		font-weight: 850;
		letter-spacing: -0.03em;
		text-decoration: none;
	}

	h1 {
		margin: 0;
		font-size: clamp(2.5rem, 7vw, 4.5rem);
		line-height: 0.98;
		letter-spacing: -0.06em;
	}

	.lede {
		max-width: 560px;
		margin: 20px 0 0;
		color: var(--nb-muted);
		line-height: 1.7;
	}

	.context-list {
		display: grid;
		gap: 12px;
		margin-top: 32px;
	}

	.context-option {
		display: grid;
		gap: 5px;
		border: 1px solid var(--nb-border);
		border-radius: 12px;
		padding: 16px 18px;
		color: var(--nb-ink);
		text-decoration: none;
	}

	.context-option:hover,
	.context-option:focus-visible {
		border-color: var(--nb-ink);
	}

	.context-option strong {
		font-size: 1rem;
	}

	.context-option span,
	.identity-note {
		color: var(--nb-muted);
		font-size: 0.76rem;
	}

	.identity-note {
		margin: 26px 0 0;
	}
</style>
