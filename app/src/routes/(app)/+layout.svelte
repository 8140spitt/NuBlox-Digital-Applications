<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';

	let { data, children } = $props();

	async function signOut() {
		await fetch('/api/tenant/select', { method: 'DELETE' });
		await authClient.signOut();
		await goto('/signin', { invalidateAll: true });
	}
</script>

<div class="app-shell">
	<header class="topbar">
		<a class="brand" href="/dashboard">NuBlox</a>
		<div class="tenant">
			<span>{data.organisation.name}</span>
			<a href="/select-organisation">Switch organisation</a>
		</div>
		<div class="account">
			<span>{data.actor.displayName}</span>
			<button type="button" onclick={signOut}>Sign out</button>
		</div>
	</header>

	<aside class="sidebar" aria-label="Primary navigation">
		<nav>
			<a href="/dashboard">Dashboard</a>
			<a href="/crm">CRM</a>
			<a class="subnav" href="/crm/opportunities">Opportunities</a>
			<a href="/commercial/estimates">Commercial</a>
			<a class="subnav" href="/commercial/estimates">Estimates</a>
			<a class="subnav" href="/commercial/quotations">Quotations</a>
			<a href="/projects">Projects</a>
			<a href="/contracts">Contracts</a>
			<a href="/finance/invoices">Finance</a>
			<a class="subnav" href="/finance/invoices">Invoices</a>
			<a class="subnav" href="/finance/credit-notes">Credit notes</a>
			<a class="subnav" href="/finance/payments">Payments</a>
			<a class="subnav" href="/finance/receivables">Receivables</a>
			<a class="subnav" href="/finance/billing">Billing settings</a>
			<a href="/organisation">Organisation</a>
		</nav>
	</aside>

	<main class="content">
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		min-height: 100vh;
		display: grid;
		grid-template-columns: 15rem 1fr;
		grid-template-rows: auto 1fr;
		background: #f5f5f2;
		color: #151515;
	}
	.topbar {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: 15rem 1fr auto;
		align-items: center;
		min-height: 4rem;
		border-bottom: 1px solid #d9d9d2;
		background: white;
	}
	.brand { padding: 0 1.25rem; font-weight: 850; text-decoration: none; color: inherit; }
	.tenant, .account { display: flex; align-items: center; gap: 0.8rem; padding: 0 1.25rem; }
	.tenant span, .account span { font-weight: 650; }
	.tenant a, .account button { color: #555; font: inherit; font-size: 0.88rem; }
	.account { justify-content: flex-end; }
	.account button { border: 0; background: transparent; text-decoration: underline; cursor: pointer; padding: 0; }
	.sidebar { border-right: 1px solid #d9d9d2; background: white; padding: 1rem; }
	.sidebar nav { display: grid; gap: 0.35rem; }
	.sidebar a { padding: 0.7rem 0.8rem; border-radius: 0.45rem; text-decoration: none; color: inherit; font-weight: 650; }
	.sidebar a.subnav { margin-left: .8rem; padding-block: .5rem; color:#5d5d58; font-size:.88rem; font-weight:600; }
	.sidebar a:hover, .sidebar a:focus-visible { background: #f0f0eb; }
	.content { min-width: 0; padding: 2rem; }
	@media (max-width: 760px) {
		.app-shell { display: block; }
		.topbar { display: flex; flex-wrap: wrap; gap: 0.65rem; padding: 0.8rem 1rem; }
		.brand, .tenant, .account { padding: 0; }
		.tenant { flex: 1 1 100%; order: 3; }
		.account { margin-left: auto; }
		.sidebar { border-right: 0; border-bottom: 1px solid #d9d9d2; padding: 0.5rem 1rem; }
		.sidebar nav { display: flex; flex-wrap: wrap; }
		.sidebar a.subnav { margin-left:0; }
		.content { padding: 1rem; }
	}
</style>
