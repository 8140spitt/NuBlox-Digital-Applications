<script lang="ts">
	let { data } = $props();
</script>

<section class="nb-page actions-page">
	<p class="nb-eyebrow">{data.crmParty.slug} · CRM Party participation</p>
	<h1>Actions</h1>
	<p class="nb-lede">
		Actions shown here must arise from projects associated with this CRM Party and resolve directly
		to a canonical NuBlox business record: quotation, submission, approval, response,
		acknowledgement or another governed party action.
	</p>
	<div class="empty-state">
		<strong>No CRM Party actions are connected to V2 yet.</strong>
		<p>
			Generic external work items do not belong here; each action will be derived from its owning
			business process and project relationship.
		</p>
	</div>
</section>

<style>
	.actions-page {
		display: grid;
		gap: 22px;
	}
	h1 {
		margin: 0;
		font-size: clamp(2rem, 5vw, 3.4rem);
		letter-spacing: -0.045em;
	}
	.empty-state {
		margin-top: 16px;
		padding: 28px;
		border: 1px solid var(--nb-border);
		border-radius: 14px;
		background: white;
	}
	.empty-state p {
		margin: 8px 0 0;
		color: var(--nb-muted);
	}
</style>
