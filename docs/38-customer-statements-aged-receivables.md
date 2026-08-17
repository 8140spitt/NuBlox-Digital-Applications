# 38 — Operational Accounts Receivable: Customer Statements and Aged Receivables

## 1. Purpose

Package 004F turns the immutable finance facts activated in Packages 004C–004E into operational customer-account reporting.

It does **not** create another balance ledger or persist editable statement totals.

```text
Issued Invoices
      +
Issued Credit Notes
      +
Payment Allocations
      +
Allocation Reversals
      +
Exceptional Invoice Voids
      ↓
Derived Customer Account Movements
      ↓
Opening / Running / Closing Balance
      ↓
Outstanding Invoices as at Date
      ↓
Current | 1–30 | 31–60 | 61–90 | 91+
```

The governing rule is:

> **Statements and aging are reproducible reporting views over immutable finance events. They do not become a second source of truth for customer balances.**

## 2. Application surfaces

```text
/finance/receivables
/finance/receivables/[customerPartyPublicId]
```

`/finance/receivables` exposes the tenant's current customer-account positions and aging buckets, grouped separately by currency.

`/finance/receivables/[customerPartyPublicId]` exposes a selectable statement period with opening balance, period movements, running balance, closing balance and aging as at the selected end date.

The customer workspace deliberately identifies the result as a **derived account statement**. Package 004F does not claim that a persisted/issued statement document, PDF or delivery event exists.

## 3. Authority boundary

Package 004F adds no new permission key.

Normal reporting requires:

```text
active NuBlox user
AND active organisation membership
AND finance.view
AND same-tenant finance/customer scope
```

This is deliberate. Statements and aging expose the same invoice, credit-note and payment-allocation facts already protected by the finance read boundary. A second reporting permission would duplicate scope without protecting a distinct data class.

An explicit `finance.view` member deny therefore removes statement/aging access even when another role grants broader finance mutation authority.

No Package 004F bootstrap-role or permission migration is required.

## 4. No new finance business tables

Package 004F introduces no customer-statement, balance or aging tables.

It derives from existing normalised structures including:

```text
financial_documents
invoices
credit_notes
financial_document_items
financial_document_item_taxes
financial_document_issue_events
payments
payment_allocations
payment_allocation_reversals
payment_reversals
party_billing_settings
parties
```

The production migration count therefore remains unchanged by 004F.

## 5. Customer-account movement model

A statement is reconstructed from timestamped finance events.

The initial account movement convention is:

```text
Issued invoice          → debit
Issued credit note      → credit
Payment allocation      → credit
Allocation reversal     → debit
Exceptional invoice void→ credit
```

An unallocated payment receipt is **not** a customer-account credit in the statement because no invoice/customer receivable has been discharged by that cash yet.

This keeps the statement closing balance reconcilable to invoice outstanding:

```text
Invoice Gross
− Issued Credit Gross
− Active Allocations
= Outstanding Receivable
```

## 6. Event dates

The movement date comes from the authoritative event, not from a mutable reporting field:

```text
invoice / credit note → financial_document_issue_events.issued_at
allocation            → payment_allocations.allocated_at
allocation reversal   → payment_allocation_reversals.reversed_at
invoice void           → financial_documents.voided_at
```

This is essential for historical reconstruction.

## 7. Historical as-of correctness

A statement for an earlier date must not silently use today's active/reversed state.

For a statement cutoff `T`:

- an invoice contributes only if it was issued before `T`;
- a credit note contributes only if it was issued before `T`;
- an allocation contributes only if it occurred before `T`;
- an allocation is considered active at `T` when it had not yet been reversed before `T`;
- an invoice remains outstanding at `T` when it had not yet been voided before `T`.

Therefore an allocation made in June and reversed in August still reduces a statement ending in July. The August reversal appears only in an August-or-later statement.

## 8. Tenant timezone and date boundaries

Statement dates are business dates, while finance events are timestamps.

Package 004F resolves statement day boundaries using:

```text
organisations.default_timezone
```

A selected end date includes the complete tenant-local calendar day.

This avoids treating midnight UTC as the business-day boundary for every tenant.

## 9. Statement period

The customer statement accepts:

```text
from = YYYY-MM-DD
to   = YYYY-MM-DD
```

Defaults are month-to-date in the tenant timezone.

Validation requires:

- valid calendar dates;
- `from <= to`;
- `to` not in the future relative to the tenant business date;
- a bounded initial statement period of no more than 367 calendar days.

The report derives:

```text
Opening Balance
= Sum(all account movements before from)

Running Balance
= Opening Balance
+ period debits
− period credits

Closing Balance
= balance after all movements through to
```

## 10. Currency separation

NuBlox does not sum unlike currencies into one receivable balance without an explicit FX/reporting-currency policy.

A customer with GBP and EUR receivables therefore receives independent positions:

```text
GBP statement / aging
EUR statement / aging
```

Tenant-wide receivable totals are also grouped by currency.

No FX translation is performed by Package 004F.

## 11. Aged receivables

For each outstanding issued invoice as at the selected date:

```text
Outstanding
= Invoice Gross
− Issued Credit Gross as at date
− Active Allocations as at date
```

Only positive outstanding balances enter aging.

The initial buckets are:

```text
Current   → due date on/after as-of date, or no due date
1–30      → 1 to 30 days overdue
31–60     → 31 to 60 days overdue
61–90     → 61 to 90 days overdue
91+       → 91 or more days overdue
```

Aging is based on the invoice due date, not invoice creation date.

## 12. Voided invoices

An invoice that was validly issued contributes a debit from its issue time until its exceptional void time.

The void creates the reporting effect:

```text
invoice gross debit
then
matching void credit
```

For aging as at a date after the void, the invoice has no outstanding receivable.

For a historical date before the void, it remains part of the account position.

## 13. Credit notes

Only issued credit notes contribute to statements or aging.

A draft credit note is preparation state and does not reduce the receivable.

The credit uses the immutable issued credit-note gross already derived from its source-linked lines/tax evidence.

## 14. Payments and allocation reversals

A payment receipt becomes a statement movement only when value is allocated to an invoice.

An allocation reversal restores that amount to the customer receivable from its reversal timestamp.

A full payment reversal in Package 004E first creates reversal evidence for every still-active allocation. Those allocation-reversal events are therefore sufficient to restore the customer account without inventing a separate payment-reversal balance adjustment.

## 15. Customer identity and reference

The report groups receivables by the source customer party referenced by each financial document.

The customer display name is resolved for the current workspace, while the legal historical identity of each issued invoice/credit note remains preserved by the document snapshots.

Where available, the customer account reference comes from:

```text
party_billing_settings.customer_account_reference
```

Updating that reference affects reporting labelling only; it does not rewrite issued documents.

## 16. Tenant isolation

All account and financial-document queries remain tenant-scoped.

A foreign tenant customer public ID is masked as not found after the caller passes the finance-read boundary.

Matching public/surrogate IDs never establish authority by themselves.

## 17. Validation contract

The permanent real-MySQL suite must prove:

- reporting requires active tenant membership + `finance.view`;
- `finance.view` explicit deny blocks reporting;
- current customer aging is derived from issued invoices, issued credits and active allocations;
- current aging is grouped by currency without FX aggregation;
- due-date bucket boundaries are correct;
- historical statements retain allocations that were reversed only after the statement cutoff;
- later allocation reversal appears as a restoring debit only from its reversal timestamp;
- opening balance carries all movements before the selected period;
- closing statement balance reconciles to the derived receivable position as at the same end date;
- exceptional invoice void is represented at the actual void timestamp;
- foreign-tenant customer accounts are masked;
- invalid/future statement ranges are rejected;
- no generated Kysely drift occurs;
- Svelte/TypeScript diagnostics remain clean.

## 18. Deliberate exclusions / next boundary

Not claimed implemented by Package 004F:

- persisted/issued customer statement documents;
- PDF statement rendering;
- production outbound statement delivery;
- automatic statement schedules;
- dunning/reminder workflows;
- collections notes / promises-to-pay;
- customer credit limits / hold policy;
- bad-debt/write-off processing;
- dispute management;
- FX/reporting-currency translation;
- general-ledger posting;
- bank reconciliation.

The next finance boundary should be **controlled collections and dunning policy** over the derived overdue receivable position, while keeping communication/workflow state separate from immutable invoices, credits and cash facts.
