# Package 004K — Controlled VAT Bad-Debt Relief

Status: implemented application boundary pending exact documentation-synchronised release gate.

## Purpose

Package 004K adds a controlled evidence chain for UK VAT bad-debt relief after NuBlox has already recorded an authorised operational bad-debt write-off.

It deliberately separates four different facts:

```text
Operational bad-debt write-off
        ↓
Prepared VAT relief evidence
        ↓
Separate VAT relief authorisation
        ↓
VAT-return posting evidence
        ↓
Later customer recovery, if any
        ↓
Proportional VAT repayment evidence
        ↓
VAT-return repayment posting evidence
```

The package does **not** mutate the original invoice, source VAT snapshot, write-off, payment or recovery. Corrections are additive reversals.

It also does **not** implement or claim to submit a statutory VAT Return, maintain the organisation's VAT account with HMRC, prove that VAT was previously paid to HMRC, or create a general ledger.

## HMRC basis

The implementation was checked against HMRC `VAT Notice 700/18 — Relief from VAT on bad debts` and HMRC's VAT Bad Debt Relief manual on 18 August 2026.

The application boundary reflects these current rules:

- relief is available only after the debt has been written off and the other scheme conditions are satisfied;
- the claim cannot be made until at least six months after the later of the date payment was due and payable and the date of supply;
- for normal post-30-April-1997 supplies the claim deadline is four years and six months after that same later date;
- the relief amount is included in Box 4 of the VAT Return covering the date the conditions are met;
- the claimant must retain separate bad-debt records including the amount written off, VAT claimed, original VAT period, VAT charged and claim period;
- if payment is later received, the VAT element covered by that payment must be repaid proportionally and recorded in Box 1 for the VAT period in which the payment is received.

NuBlox records evidence for these rules but does not infer facts it cannot prove internally. In particular, VAT-accounted-and-paid, debt assignment/factoring and scheme-applicability conditions are explicit operator attestations.

## Entry condition

A write-off is a 004K candidate only when all of the following remain true:

```text
source invoice lifecycle = issued
source write-off = active
write-off tax_treatment_policy = separate_tax_adjustment_required
```

A write-off marked `no_tax_adjustment` is not silently converted into VAT relief work.

## Authoritative source evidence

The claim never accepts a user-entered VAT rate or VAT amount.

Each claim line references the exact immutable source invoice tax snapshot:

```text
receivable_vat_bad_debt_claim_lines
        ↓
financial_document_items
        ↓
financial_document_item_taxes
        ↓
tax_categories
```

For each selected source tax line:

```text
Source Gross
= Source Taxable Amount + Source VAT Amount

VAT Relief
= Source VAT Amount
  × Claim Consideration Basis
  ÷ Source Gross
```

Fixed-point decimal arithmetic is used. The calculated VAT is persisted as evidence with the source-line provenance.

A zero-VAT source line cannot produce VAT bad-debt relief.

## Eligibility dates

The preparation stores:

```text
supply_date
payment_due_date
relevant_date
eligible_from
claim_deadline
original_vat_period_reference
```

The controlled service derives:

```text
relevant_date = later(supply_date, payment_due_date)
eligible_from = relevant_date + 6 calendar months
claim_deadline = relevant_date + 54 calendar months
```

Where the issued invoice has a stored due date, that date is authoritative. Operator input cannot substitute an earlier due date to accelerate eligibility.

A future supply date is rejected.

Authorisation rechecks the current date against `eligible_from` and `claim_deadline`; preparation alone never claims statutory relief.

## Eligibility attestations

Preparation requires all of these explicit confirmations:

```text
vat_accounted_and_paid
debt_not_sold_or_factored
selling_price_condition_met
relief_scheme_applicable
```

These are evidence statements by an authorised operator. NuBlox does not claim that its database independently proves those external/legal facts.

## Capacity and overclaim prevention

An authorised VAT relief claim consumes part of the active write-off's relief basis.

```text
Available Write-off Relief Basis
= Active Write-off Amount
− Active Bad-Debt Recoveries
− Other Active Authorised VAT Relief Claim Bases
```

The service also prevents cumulative authorised claim basis from exceeding the remaining gross capacity of each exact source invoice tax line.

Preparation and authorisation use customer → invoice → write-off/source-evidence locking/current reads so a stale prepared claim cannot later overclaim after recovery or another authorised claim changes the available basis.

## Claim lifecycle

### Prepared

Preparation records:

- exact write-off and invoice provenance;
- dates and original VAT period reference;
- eligibility attestations;
- source invoice tax lines;
- consideration basis and calculated VAT amount;
- preparer, timestamp and reason.

A prepared claim has no authorisation fact and must not be treated as VAT relief already claimed.

### Authorised

Authorisation is a separate one-to-one evidence row:

```text
receivable_vat_bad_debt_claim_authorisations
```

Authorisation revalidates:

- active issued invoice;
- active `separate_tax_adjustment_required` write-off;
- eligibility window;
- current write-off capacity after recoveries and other claims;
- source tax-line capacity;
- calculated VAT against the immutable invoice tax snapshot.

### Reversed

A claim reversal is additive:

```text
receivable_vat_bad_debt_claim_reversals
```

The original preparation and authorisation remain immutable.

An active claim cannot be reversed while it has active VAT-return posting evidence or active VAT-repayment evidence. Those downstream facts must be reversed first.

Likewise Package 004J now refuses to reverse the source write-off while an authorised non-reversed VAT relief claim remains active.

## Later payment / recovery repayment

A later customer payment enters 004K only through an existing active Package 004J bad-debt recovery linked to the same write-off.

The VAT repayment is derived from the authorised claim:

```text
VAT Repayment
= Authorised Claim VAT
  × Recovered Consideration
  ÷ Authorised Claim Consideration
```

The service prevents repayment consideration from exceeding either:

- unused consideration on the selected operational recovery; or
- remaining consideration covered by the active VAT relief claim.

The original recovery remains immutable.

A repayment reversal is additive in:

```text
receivable_vat_bad_debt_repayment_reversals
```

Package 004J refuses to reverse the operational recovery while active VAT repayment evidence still depends on it.

## VAT-return posting evidence

Package 004K records evidence that an authorised relief amount or a recovery repayment was included in a VAT return:

```text
receivable_vat_return_postings
receivable_vat_return_posting_reversals
```

For a relief claim:

```text
posting_kind = relief_claim
vat_return_box = 4
amount = authorised claim VAT
```

For a later recovery repayment:

```text
posting_kind = relief_repayment
vat_return_box = 1
amount = repayment VAT
```

Posting amount and box are derived by the service; users cannot choose them.

Relief-claim posting must use a VAT period whose end falls within the recorded eligibility window.

Recovery-repayment posting must use a VAT period containing the actual `receivable_write_off_recoveries.recovered_at` receipt date. An operator cannot move the repayment into another accounting period.

Each posting stores:

- VAT period reference;
- VAT period start and end;
- derived box;
- derived amount;
- optional external reference;
- reason, member and timestamp.

This is posting **evidence**. NuBlox does not claim to have submitted the VAT Return to HMRC.

## Persistence model

Package 004K adds eight tenant-scoped tables:

```text
receivable_vat_bad_debt_claims
receivable_vat_bad_debt_claim_lines
receivable_vat_bad_debt_claim_authorisations
receivable_vat_bad_debt_claim_reversals
receivable_vat_bad_debt_repayments
receivable_vat_bad_debt_repayment_reversals
receivable_vat_return_postings
receivable_vat_return_posting_reversals
```

It also adds context keys to the existing Package 004J write-off/recovery tables so composite tenant/provenance foreign keys remain explicit.

No mutable VAT-relief balance is stored.

## Permissions

Package 004K adds:

```text
finance.tax_relief.view
finance.tax_relief.prepare
finance.tax_relief.authorise
finance.tax_relief.reverse
finance.tax_relief.repayment.record
finance.tax_relief.repayment.reverse
finance.tax_relief.post
finance.tax_relief.post.reverse
```

All granular keys use `finance.manage` only as the same-domain fallback. Explicit granular deny still wins.

Viewing requires the established finance read boundary plus tax-relief view authority:

```text
finance.view
AND
(finance.tax_relief.view OR finance.manage)
```

### Standard role defaults

Owner / Administrator:

```text
✓ view
✓ prepare
✓ authorise
✓ claim reversal
✓ recovery repayment record
✓ recovery repayment reversal
✓ VAT-return posting evidence
✓ VAT-return posting reversal
```

Finance/Commercial:

```text
✓ view
✓ prepare
✕ authorise
✕ claim reversal
✕ repayment record
✕ repayment reversal
✕ VAT-return posting evidence
✕ posting reversal
✕ finance.manage
```

This keeps source-document preparation with the operational finance team while reserving statutory recognition/correction evidence for stronger authority by default.

Existing organisations receive equivalent grants from the Package 004K migration. Future organisations receive the same persisted split from `OrganisationBootstrapService`; integration coverage verifies parity.

## Application surface

```text
/finance/tax-relief
```

The protected workspace provides:

- active 004J write-offs requiring separate tax treatment;
- exact source VAT snapshots and remaining claim capacity;
- controlled preparation and eligibility attestations;
- separate authorisation;
- Box 4 posting evidence;
- recovery-linked proportional VAT repayment;
- Box 1 posting evidence;
- additive reversal controls and history.

The route uses `ControlledTaxReliefService`, which wraps the transactional `TaxReliefService` with authoritative invoice-due-date and recovery-period guards.

## Audit actions

```text
finance.tax_relief.claim.prepared
finance.tax_relief.claim.authorised
finance.tax_relief.claim.reversed
finance.tax_relief.repayment.recorded
finance.tax_relief.repayment.reversed
finance.tax_relief.return_posting.recorded
finance.tax_relief.return_posting.reversed
```

## Deliberate exclusions

Package 004K does not implement:

- direct HMRC VAT Return submission;
- Making Tax Digital API integration;
- complete VAT account / VAT control account;
- general-ledger journals or double-entry posting;
- automatic proof that VAT was paid to HMRC;
- automatic legal determination of debt sale/factoring or connected-party status;
- Cash Accounting Scheme logic;
- special historical bad-debt-relief rules for legacy pre-1997 supplies;
- foreign VAT regimes;
- FX translation;
- bank reconciliation;
- tax authority payment/refund settlement.

## Validation target

```text
22 production migrations / 0 pending
370 base tables
824 foreign keys
473 CHECK constraints
zero generated Kysely drift
32 integration files / 136 tests
svelte-check: 0 errors / 0 warnings
```

The exact final release SHA and CI run are recorded only after the documentation-synchronised head passes the complete gate.

## Primary regulatory sources checked

- GOV.UK — `Relief from VAT on bad debts (VAT Notice 700/18)`
- GOV.UK HMRC internal manual — `VBDR4100 Repayment of relief when subsequent payments received`
- GOV.UK HMRC internal manual — `VBDR4200 How and when repayment is made`
- GOV.UK HMRC internal manual — `VBDR1600 What time limits apply for claiming relief?`
