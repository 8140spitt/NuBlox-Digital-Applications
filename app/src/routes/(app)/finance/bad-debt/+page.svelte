<script lang="ts">
	let { data, form } = $props();

	function money(value: string, currencyCode: string) {
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currencyCode }).format(Number(value));
	}
</script>

<svelte:head><title>Bad Debt · NuBlox</title></svelte:head>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<a href="/finance/receivables">Receivables</a><span aria-hidden="true">/</span><span>Bad Debt</span>
</nav>

<section class="page-heading">
	<div>
		<p class="eyebrow">Package 004J</p>
		<h1>Bad Debt, Write-off & Recovery</h1>
		<p>Controlled additive evidence over immutable invoice and payment facts.</p>
	</div>
	<a class="secondary" href="/finance/collections">Collections</a>
</section>

{#if form?.actionError}<p class="error banner" role="alert">{form.actionError}</p>{/if}

<section class="boundary">
	<strong>Write-off is not invoice mutation.</strong>
	<span>Operational outstanding is issued invoice gross − issued credits − active allocations − active write-offs. Recovery consumes real payment availability but does not reopen the written-off receivable. Reversal evidence restores the relevant derived position without deleting history.</span>
</section>

<div class="layout">
	<div class="stack">
		<section class="panel">
			<p class="eyebrow">Receivable candidates</p><h2>Invoices available for write-off</h2>
			{#if data.invoices.length === 0}
				<p class="muted">No issued invoices currently have a positive receivable available for write-off.</p>
			{:else}
				<div class="cards">
					{#each data.invoices as invoice}
						<article class="record">
							<div class="record-head"><span><strong>{invoice.invoiceNumber}</strong><small>{invoice.customerDisplayName}</small></span><em>{money(invoice.outstandingAmount, invoice.currencyCode)}</em></div>
							<p class="muted">Active write-off: {money(invoice.activeWriteOffAmount, invoice.currencyCode)}</p>
							{#if data.canWriteOff}
								<form method="POST" action="?/writeOff" class="inline-form">
									<input type="hidden" name="invoicePublicId" value={invoice.invoicePublicId}/>
									<label>Amount<input name="amount" inputmode="decimal" value={invoice.outstandingAmount} required/></label>
									<label>Reason<input name="reason" maxlength="1000" required/></label>
									<button type="submit">Record write-off</button>
								</form>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</section>

		<section class="panel">
			<p class="eyebrow">Write-off evidence</p><h2>Write-off history</h2>
			{#if data.writeOffs.length === 0}
				<p class="muted">No write-offs have been recorded.</p>
			{:else}
				<div class="cards">
					{#each data.writeOffs as writeOff}
						<article class:reversed={writeOff.isReversed} class="record">
							<div class="record-head">
								<span><strong>{writeOff.invoiceNumber} · {writeOff.customerDisplayName}</strong><small>{new Date(writeOff.writtenOffAt).toLocaleString()}</small></span>
								<em>{writeOff.isReversed ? 'Reversed' : money(writeOff.amount, writeOff.currencyCode)}</em>
							</div>
							<p>{writeOff.reason}</p>
							<dl>
								<div><dt>Written off</dt><dd>{money(writeOff.amount, writeOff.currencyCode)}</dd></div>
								<div><dt>Recovered</dt><dd>{money(writeOff.recoveredAmount, writeOff.currencyCode)}</dd></div>
								<div><dt>Recoverable</dt><dd>{writeOff.isReversed ? '—' : money(writeOff.remainingRecoverableAmount, writeOff.currencyCode)}</dd></div>
							</dl>
							{#if writeOff.isReversed}
								<p class="muted">Reversed {writeOff.reversedAt ? new Date(writeOff.reversedAt).toLocaleString() : ''}: {writeOff.reversalReason}</p>
							{:else if data.canReverseWriteOff && Number(writeOff.recoveredAmount) === 0}
								<form method="POST" action="?/reverseWriteOff" class="inline-form">
									<input type="hidden" name="writeOffPublicId" value={writeOff.publicId}/>
									<label>Reversal reason<input name="reason" maxlength="1000" required/></label>
									<button class="quiet" type="submit">Reverse write-off</button>
								</form>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</section>

		<section class="panel">
			<p class="eyebrow">Recovery evidence</p><h2>Recovery history</h2>
			{#if data.recoveries.length === 0}
				<p class="muted">No bad-debt recoveries have been recorded.</p>
			{:else}
				<div class="cards">
					{#each data.recoveries as recovery}
						<article class:reversed={recovery.isReversed} class="record">
							<div class="record-head"><span><strong>{recovery.amount}</strong><small>Payment {recovery.paymentPublicId}</small></span><em>{recovery.isReversed ? 'Reversed' : 'Recovery'}</em></div>
							<p>{recovery.reason}</p>
							<p class="muted">Recorded {new Date(recovery.recoveredAt).toLocaleString()}</p>
							{#if recovery.isReversed}
								<p class="muted">Reversed {recovery.reversedAt ? new Date(recovery.reversedAt).toLocaleString() : ''}: {recovery.reversalReason}</p>
							{:else if data.canReverseRecovery}
								<form method="POST" action="?/reverseRecovery" class="inline-form">
									<input type="hidden" name="recoveryPublicId" value={recovery.publicId}/>
									<label>Reversal reason<input name="reason" maxlength="1000" required/></label>
									<button class="quiet" type="submit">Reverse recovery</button>
								</form>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<aside class="stack">
		{#if data.canRecover}
			<section class="panel action-panel">
				<p class="eyebrow">Recovered cash</p><h2>Record a recovery</h2>
				<p class="muted">Use a real, unreversed payment receipt with remaining unallocated cash. The recovery consumes that cash and remains linked to the original write-off.</p>
				<form method="POST" action="?/recordRecovery">
					<label>Active write-off
						<select name="writeOffPublicId" required><option value="">Select write-off</option>{#each data.writeOffs.filter((item) => !item.isReversed && Number(item.remainingRecoverableAmount) > 0) as item}<option value={item.publicId}>{item.invoiceNumber} · {item.currencyCode} {item.remainingRecoverableAmount}</option>{/each}</select>
					</label>
					<label>Payment
						<select name="paymentPublicId" required><option value="">Select payment</option>{#each data.payments as payment}<option value={payment.publicId}>{payment.currencyCode} {payment.usableAmount} · {payment.paymentReference ?? payment.publicId}</option>{/each}</select>
					</label>
					<label>Amount<input name="amount" inputmode="decimal" required/></label>
					<label>Reason<textarea name="reason" rows="4" maxlength="1000" required></textarea></label>
					<button type="submit">Record recovery</button>
				</form>
			</section>
		{/if}

		<section class="panel">
			<p class="eyebrow">Control model</p><h2>Evidence hierarchy</h2>
			<ul>
				<li>Write-off can never exceed the live outstanding invoice balance.</li>
				<li>A write-off with active recovery evidence cannot be reversed.</li>
				<li>Recovery cannot exceed either remaining written-off debt or payment availability.</li>
				<li>Payment reversal is blocked while active recovery evidence exists.</li>
				<li>Recovery reversal restores payment availability but does not reopen the receivable.</li>
			</ul>
		</section>
	</aside>
</div>

<style>
	.breadcrumbs{display:flex;gap:.55rem;align-items:center;margin-bottom:1rem;color:#666;font-size:.9rem}.breadcrumbs a{color:inherit;font-weight:650}.page-heading{display:flex;justify-content:space-between;gap:1rem;align-items:start;margin-bottom:1rem}.page-heading h1{margin:.15rem 0 .3rem;font-size:clamp(2rem,5vw,2.8rem);letter-spacing:-.04em}.page-heading p{margin:0;color:#666}.eyebrow{margin:0;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;font-weight:760;color:#666}.secondary{padding:.55rem .72rem;border:1px solid #cfcfc8;border-radius:.46rem;color:#222;text-decoration:none;font-weight:700}.boundary{display:grid;gap:.2rem;padding:.85rem 1rem;margin-bottom:1rem;border:1px solid #c8d4e6;border-radius:.65rem;background:#f5f8fc}.boundary span,.muted{color:#666;line-height:1.5}.layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(20rem,.65fr);gap:1rem;align-items:start}.stack,.cards,form{display:grid;gap:.8rem}.panel{background:#fff;border:1px solid #d9d9d2;border-radius:.8rem;padding:1.1rem}.panel h2{margin:.3rem 0 .8rem}.action-panel{border-color:#b9cbe6}.record{padding:.85rem;border:1px solid #e1e1db;border-radius:.6rem}.record.reversed{background:#f7f7f4;color:#666}.record-head{display:flex;justify-content:space-between;gap:.8rem;align-items:start}.record-head span{display:grid;gap:.15rem}.record-head small{color:#666}.record-head em{font-style:normal;font-size:.76rem;font-weight:760}.record p{line-height:1.45}dl{display:grid;gap:.4rem;margin:.7rem 0}dl div{display:grid;grid-template-columns:7.5rem 1fr;gap:.6rem}dt{font-size:.82rem;color:#666}dd{margin:0}.inline-form{margin-top:.7rem;padding-top:.7rem;border-top:1px solid #ecece7}label{display:grid;gap:.3rem;font-weight:650}input,select,textarea{width:100%;box-sizing:border-box;padding:.58rem;border:1px solid #c9c9c2;border-radius:.45rem;background:#fff;font:inherit}button{width:max-content;padding:.62rem .8rem;border:0;border-radius:.46rem;background:#111;color:white;font:inherit;font-weight:750;cursor:pointer}.quiet{background:#6f342d}.error{color:#8a3025}.banner{padding:.7rem .8rem;background:#fff0ed;border:1px solid #e1b1aa;border-radius:.5rem}ul{padding-left:1.2rem;line-height:1.5}@media(max-width:900px){.layout{grid-template-columns:1fr}.page-heading{display:grid}dl div{grid-template-columns:1fr;gap:.1rem}}
</style>