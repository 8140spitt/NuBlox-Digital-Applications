# Package 004J — Controlled Bad Debt, Write-off and Recovery

Status: implemented on PR #32 pending the final documentation-synchronised release gate.

## Purpose

Package 004J provides a controlled, auditable path for recognising an uncollectible receivable and recording later cash recovery without deleting, rewriting or replacing the original invoice, credit-note, payment or allocation facts.

The write-off model is additive evidence. It is not an editable balance field and it is not a second accounts-receivable ledger.

## Authoritative receivable formula

For an issued invoice:

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
− Active Write-offs
```

A write-off reversal removes the write-off from that formula and therefore restores the receivable.

A later bad-debt recovery **does not** change the customer receivable. The debt has already been removed by the write-off. Recovery records how an existing payment receipt was applied as post-write-off cash recovery.

## Workflow

```text
Issued Invoice with Receivable Remaining
        ↓
Bad-Debt Assessment Case
        ↓
Immutable Write-off Recommendation
        ↓
Separate Write-off Authorisation
        ↓
Active Partial / Full Write-off
        ├── optional Write-off Reversal
        └── later Cash Recovery
                ↓
        Existing Payment Receipt
                ↓
        Recovery Evidence
                └── optional Recovery Reversal
```

Recommendation and authorisation are separate facts. A member who can assess and recommend a loss does not automatically gain authority to recognise that loss.

## Persistence model

Package 004J adds six tenant-scoped tables:

```text
receivable_bad_debt_cases
receivable_bad_debt_recommendations
receivable_write_offs
receivable_write_off_reversals
receivable_write_off_recoveries
receivable_write_off_recovery_reversals
```

### `receivable_bad_debt_cases`

- exact customer and invoice provenance;
- one open case per tenant/invoice;
- open/closed lifecycle;
- opening and closing reason/member/timestamp evidence;
- stores no receivable balance.

### `receivable_bad_debt_recommendations`

- immutable positive recommended amount;
- exact case and invoice provenance;
- recommending member and timestamp;
- recommendation does not change receivable.

### `receivable_write_offs`

- exact recommendation, case and invoice provenance;
- positive write-off amount;
- separate authorising member, reason and timestamp;
- explicit tax-treatment policy;
- active write-off reduces operational receivable.

Supported tax-treatment evidence values:

```text
no_tax_adjustment
separate_tax_adjustment_required
```

Package 004J does not itself post a tax adjustment or general-ledger entry. The operational tax catalogue and invoice tax-rate handling are documented separately in [`42 — Invoice Tax Settings`](42-invoice-tax-settings.md). Where bad-debt tax relief or another tax adjustment is required, that must be a separate explicit accounting fact rather than being inferred from the operational write-off.

### `receivable_write_off_reversals`

- additive one-to-one reversal evidence;
- original write-off remains immutable;
- active recovery must first be reversed;
- reversal restores customer receivable.

### `receivable_write_off_recoveries`

- exact write-off provenance;
- exact existing payment receipt provenance;
- positive recovered amount;
- recording member, timestamp and reason;
- consumes payment capacity;
- does **not** reopen customer receivable.

### `receivable_write_off_recovery_reversals`

- additive one-to-one recovery reversal evidence;
- original recovery remains immutable;
- restores payment capacity only.

## Cash-capacity invariant

An existing payment receipt can be used for ordinary invoice allocation or bad-debt recovery, but the same cash cannot be consumed twice.

```text
Available Payment
= Payment Amount
− Active Invoice Allocations
− Active Bad-Debt Recoveries
```

Payment allocation and recovery therefore both use the same remaining cash capacity.

A payment with active bad-debt recovery usage cannot be reversed through ordinary payment reversal. The recovery must first be reversed explicitly, preserving the stronger correction evidence chain.

## Locking and concurrency

004J follows the Package 004I canonical invoice mutation hierarchy:

```text
customer party
    ↓
invoice document
    ↓
re-derived receivable
    ↓
bad-debt recommendation / write-off fact
```

This serialises write-off decisions against concurrent invoice/receivable mutations.

Recovery uses the payment row as the cash mutex before calculating available payment capacity and recovery headroom.

Write-off authorisation always revalidates the recommendation against the **current** invoice outstanding balance. A recommendation that was valid when recorded cannot later over-write-off an invoice after a payment, credit note or previous write-off reduces the balance.

## Permissions

Package 004J adds:

```text
finance.bad_debt.view
finance.bad_debt.case.manage
finance.bad_debt.recommend
finance.bad_debt.write_off.authorise
finance.bad_debt.write_off.reverse
finance.bad_debt.recovery.record
finance.bad_debt.recovery.reverse
```

All granular keys use `finance.manage` only as the same-domain fallback. Existing explicit granular deny precedence remains unchanged.

Bad-debt viewing requires the established finance read boundary plus bad-debt view authority:

```text
finance.view
AND
(finance.bad_debt.view OR finance.manage)
```

### Standard role defaults

Owner / Administrator:

```text
✓ view
✓ case management
✓ recommend
✓ write-off authorise
✓ write-off reverse
✓ recovery record
✓ recovery reverse
```

Finance/Commercial:

```text
✓ view
✓ case management
✓ recommend
✕ write-off authorise
✕ write-off reverse
✓ recovery record
✓ recovery reverse
✕ finance.manage
```

The stronger loss-recognition authority is therefore separated from ordinary receivables/collections operations. Custom roles or explicit member delegation can alter this within the normal RBAC model.

Existing organisations receive the grants through the Package 004J migration. Future organisations receive equivalent persisted grants from `OrganisationBootstrapService`; integration coverage asserts parity.

## Application surfaces

```text
/finance/bad-debt
/finance/bad-debt/[casePublicId]
```

The portfolio exposes issued invoices with receivable remaining and the existing bad-debt case history.

The case workspace exposes recommendation, authorisation, reversal and recovery evidence according to effective permission decisions.

Existing payment and receivable surfaces are also integrated:

- payment available balance subtracts active recoveries;
- invoice allocation cannot consume cash already used for recovery;
- payment reversal is blocked while recovery is active;
- invoice receivable position includes active write-off amount;
- current aged receivables subtract active write-offs;
- historical statements show write-off as a credit at authorisation and write-off reversal as a debit at reversal time;
- recovery is not shown as a customer receivable movement because it does not reopen or settle the already-written-off debt.

## Deliberate exclusions

Package 004J does not implement:

- automatic bad-debt classification;
- VAT/tax bad-debt relief posting;
- general-ledger posting;
- bank reconciliation;
- FX conversion of write-off or recovery amounts;
- expected-credit-loss/provisioning accounting;
- legal debt-sale assignment;
- construction domestic reverse-charge accounting;
- deletion or mutation of original invoice/credit/payment facts.

## Validation target

The Package 004J release contract is:

```text
21 production migrations / 0 pending
362 base tables
804 foreign keys
465 CHECK constraints
zero generated Kysely drift
30 real-MySQL integration files / 129 tests
bad-debt core: 6 tests
bad-debt concurrency: 1 test
bad-debt bootstrap parity: 1 test
tax-settings regression: 4 tests
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must prove this complete gate before merge.
