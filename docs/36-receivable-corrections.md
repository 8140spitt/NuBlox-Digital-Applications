# 36 — Operational Accounts Receivable: Receivable Corrections

## 1. Purpose

Package 004D activates the controlled receivable-correction structures already present in **Package 004 — Contracts and Finance**.

It extends the issued-invoice boundary without making issued invoice content editable:

```text
Issued Invoice
    ↓
Correction decision
    ├── Credit Note
    │      ↓
    │   Draft correction
    │      ├── exact source invoice line
    │      ├── partial/full source quantity
    │      └── original applied tax evidence
    │      ↓
    │   Controlled issue + CN number
    │      ↓
    │   Immutable issued credit note
    │
    └── Exceptional invoice void
           ↓
        explicit reason + void evidence
```

The governing rule remains:

> **Issued financial documents are immutable commercial facts. Corrections create controlled new facts or an explicit void state; they do not rewrite issued lines, tax or party evidence.**

Package 004D deliberately did not create cash facts. **Package 004E now activates payment receipt, allocation and reversal** over the existing Package 004 payment relations; see [`37-payment-receipt-allocation.md`](37-payment-receipt-allocation.md).

## 2. Application surfaces

```text
/finance/credit-notes
/finance/credit-notes/[creditNotePublicId]
```

`/finance/credit-notes` exposes issued-invoice correction candidates, remaining creditable gross, credit-note history and—where the actor has stronger authority—exceptional invoice void controls.

`/finance/credit-notes/[creditNotePublicId]` exposes the correction reason, exact source lines, partial quantities, derived totals, controlled issue and immutable issue/snapshot evidence.

Existing invoice pages remain the authoritative issued-invoice evidence surface.

## 3. Permission family

Package 004D adds:

```text
finance.credit_note.create
finance.credit_note.draft.manage
finance.credit_note.issue
finance.invoice.void
```

All four are under the existing same-domain umbrella:

```text
finance.manage
```

Permission resolution remains:

```text
explicit granular member deny
    > granular member allow / role grant
    > finance.manage fallback
    > default deny
```

`commercial.manage` and `contract.manage` do not grant receivable-correction authority.

Standard defaults are deliberately asymmetric:

```text
Owner / Administrator
    finance.credit_note.create
    finance.credit_note.draft.manage
    finance.credit_note.issue
    finance.invoice.void
    + existing finance.manage

Finance/Commercial
    finance.credit_note.create
    finance.credit_note.draft.manage
    finance.credit_note.issue
    # deliberately no finance.invoice.void
    # deliberately no finance.manage
```

Invoice void is intentionally stronger than ordinary credit-note preparation/issue because it changes the lifecycle of an already-issued legal document rather than adding a correcting document.

## 4. Existing normalised data model

No new correction business tables are introduced.

Package 004D uses:

```text
financial_documents
    ├── invoices
    └── credit_notes

financial_document_items
financial_document_item_taxes
credit_note_item_sources
financial_document_party_snapshots
financial_document_party_snapshot_addresses
financial_document_issue_events
financial_document_issue_recipients
```

The shared financial-document supertype already supports `invoice | credit_note`, `draft | issued | void`, and explicit void evidence.

## 5. Credit-note source boundary

A credit note may be created only from an invoice that:

- belongs to the active tenant;
- is `issued`;
- has a legal invoice number;
- still has positive remaining creditable value after issued credit notes.

The credit-note header copies the source invoice customer, billing contact, project, contract and currency context. The subtype retains the exact original invoice document and correction reason.

Credit-note creation itself does not require `contract.view`: the source is the tenant-owned issued invoice, not a fresh contract traversal.

## 6. Draft identity and legal numbering

A new correction remains:

```text
document_kind = credit_note
lifecycle_status = draft
document_number = NULL
```

Draft creation consumes no legal credit-note number. Tenant-local `CN-000001`, `CN-000002`, … allocation occurs only inside the issue transaction.

## 7. Exact source-line provenance

Every credit-note line identifies exactly one original invoice line through `credit_note_item_sources`.

The application does not accept free-form correction lines disconnected from invoice evidence in this slice.

A draft may credit part or all of the original line quantity. The copied credit line retains the original line's sales item classification, optional catalogue/unit references, description, unit rate and quotation-item provenance where present. The user supplies only the quantity being credited.

## 8. Positive credit magnitudes

Credit-note line values are stored as **positive magnitudes**. The accounting/receivable sign comes from:

```text
document_kind = credit_note
```

not from negative quantities or negative unit rates.

This preserves one arithmetic convention across invoice and credit-note line tables.

## 9. Over-credit prevention

The application derives already-credited quantity from **issued** credit-note lines linked to the exact source invoice item.

Draft preparation checks currently available quantity, but issue is authoritative because competing drafts may exist. Issue therefore:

1. locks the original invoice document;
2. resolves issued credited quantity for every source item;
3. adds the current draft credit quantity;
4. rejects issue if cumulative quantity would exceed the original invoice quantity.

All credit-note issue transactions therefore serialise through the same original invoice row before committing a new issued correction.

## 10. Original tax evidence is preserved

Credit-note tax does **not** use today's tax rate.

For each source-linked correction line, Package 004D uses the original invoice line's persisted `tax_category_id` and `applied_rate_percent`, then computes the credit magnitude from the corrected quantity at that historic applied percentage.

At issue the tax rows are rebuilt from the original invoice tax evidence again, ensuring draft evidence cannot silently drift from the source invoice.

This differs intentionally from invoice issue, where a draft invoice refreshes tax using the rate effective at the invoice's actual issue date.

## 11. Original customer/address evidence is preserved

An issued credit note corrects a specific historic invoice. Credit-note issue therefore copies the original invoice's immutable party and address snapshots rather than resnapshotting today's CRM facts.

The issued credit note remains reproducible against the same customer identity/address evidence that appeared on the invoice being corrected.

## 12. Controlled credit-note issue

Issue requires:

```text
finance.credit_note.issue OR finance.manage
AND credit-note lifecycle = draft
AND original invoice lifecycle = issued
AND at least one source-linked credit line
AND cumulative source quantities remain within original quantities
```

Issue atomically locks/revalidates the source, rebuilds historic tax evidence, copies historic party/address snapshots, allocates the tenant credit-note number, changes the document to `issued`, records recipient/issue evidence and appends audit evidence.

Issued credit notes reject ordinary reason/line draft mutation.

## 13. Receivable context after Package 004E

Package 004D originally exposed the pre-cash correction position:

```text
Remaining Gross Before Cash Application
= Invoice Gross - Issued Credit Gross
```

Package 004E now extends that same immutable-fact model into the operational outstanding receivable:

```text
Outstanding Receivable
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
```

Only issued credit notes and unreversed allocations affect that position. Draft credits and reversed allocations do not.

The invoice workspace now presents issued credits, active cash and derived outstanding together. Settlement remains derived independently from the legal invoice lifecycle; see [`37-payment-receipt-allocation.md`](37-payment-receipt-allocation.md).

## 14. Exceptional invoice void

Invoice void is not the normal way to correct price, scope, quantity or tax on a valid issued invoice. Those corrections use a credit note.

Void is reserved for an invalid issued document such as a duplicate or an invoice that should never have been issued.

Void requires:

```text
finance.invoice.void OR finance.manage
AND invoice lifecycle = issued
AND explicit void reason
```

Before void, the application rejects the operation when either condition exists:

- a draft or issued credit note already references the invoice; or
- an unreversed payment allocation exists against the invoice.

A successful void preserves the legal document number, issued lines/tax, customer snapshots and issue evidence while recording the standard void fields.

## 15. Allocation-aware safety and Package 004E

Package 004D introduced the allocation-history guard before payment application services were active. Package 004E now activates the records that participate in that invariant:

```text
active allocation   → invoice void blocked
reversed allocation → allocation no longer blocks void
```

Payment reversal in Package 004E automatically creates reversal evidence for all still-active child allocations before the payment itself is reversed. This keeps the invoice-void guard and cash-correction model consistent.

Credit-note history remains an independent void blocker.

## 16. Audit actions

Package 004D writes:

```text
finance.credit_note.created
finance.credit_note.draft.updated
finance.credit_note.line.added
finance.credit_note.line.removed
finance.credit_note.issued
finance.invoice.voided
```

Audit evidence includes active tenant, actor user/member, correlation ID and project context where the financial document carries one.

## 17. Tenant/security boundary

All invoice and credit-note identity resolution remains tenant-bounded.

A foreign-tenant invoice or credit-note public ID is masked as not found after the actor passes the finance read/mutation authority boundary.

Credit-note authority does not grant invoice-void authority unless `finance.manage` supplies the same-domain fallback or the stronger granular permission is explicitly granted.

## 18. Package 004D validation record

The released Package 004D head proved on MySQL 8.4.11:

```text
15 production migrations applied / 0 pending
344 base tables / 749 foreign keys / 429 CHECK constraints
zero generated Kysely drift
18 integration files / 82 real-MySQL tests passed
finance/credit-notes.integration.test.ts: 5/5 passed
finance/invoices.integration.test.ts: 5/5 passed
organisation-bootstrap.integration.test.ts: 4/4 passed
svelte-check: 0 errors / 0 warnings
```

Those figures remain the historical Package 004D release proof; current repository validation is recorded in the root/application READMEs and handoff manifest.

## 19. Deliberate exclusions after Package 004E

Package 004E now supplies the payment receipt, payment allocation, allocation reversal, payment reversal and derived outstanding capabilities that were deliberately excluded from 004D.

Still not implemented across the current finance boundary:

- credit-note void/reversal;
- FX conversion / cross-currency allocation;
- refunds / outbound customer payments;
- automated bank-feed/payment-gateway ingestion;
- automated remittance matching;
- customer statements;
- aged receivables / dunning;
- general-ledger posting;
- bank reconciliation;
- PDF/document rendering;
- production outbound credit-note delivery.

The next reporting boundary is **customer statements and aged receivables**, deriving account positions from immutable issued documents, issued corrections, active allocations and invoice due dates rather than editable balance fields.
