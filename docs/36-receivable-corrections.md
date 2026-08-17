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

Payment receipt and allocation remain a separate next boundary.

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

### Standard-role defaults

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

Manager / Member/Professional / Field Worker / Read Only
    no automatic finance grants
```

Invoice void is intentionally stronger than ordinary credit-note preparation/issue because it changes the lifecycle of an already-issued legal document rather than adding a correcting document.

## 4. Existing normalised data model

No new correction business tables are introduced.

Package 004D uses the existing structures:

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

The shared financial-document supertype already supports:

```text
document_kind    = invoice | credit_note
lifecycle_status = draft | issued | void
```

and explicit void evidence:

```text
voided_by_member_id
voided_at
void_reason
```

## 5. Credit-note source boundary

A credit note may be created only from an invoice that:

- belongs to the active tenant;
- is `issued`;
- has a legal invoice number;
- still has positive remaining creditable value after issued credit notes.

The credit-note header copies the source invoice context:

```text
customer_party_id
billing_contact_party_id
project_id
contract_id
currency_code
```

The subtype retains:

```text
credit_notes.original_invoice_document_id
credit_notes.reason
```

Credit-note creation itself does not require `contract.view`: the source is the tenant-owned issued invoice, not a fresh contract traversal.

## 6. Draft identity and legal numbering

A new correction remains:

```text
document_kind = credit_note
lifecycle_status = draft
document_number = NULL
```

Draft creation therefore consumes no legal credit-note number.

The first tenant-local issue format is:

```text
CN-000001
CN-000002
...
```

Number allocation occurs only inside the issue transaction, under the same tenant-serialisation principle used for invoice issue. The existing unique financial-document key remains the database duplicate guard.

## 7. Exact source-line provenance

Every credit-note line must identify exactly one original invoice line through:

```text
credit_note_item_sources.credit_note_document_id
credit_note_item_sources.credit_note_item_id
credit_note_item_sources.original_invoice_document_id
credit_note_item_sources.original_invoice_item_id
```

The application does not accept free-form correction lines disconnected from invoice evidence in this slice.

A draft may credit part or all of the original line quantity. The copied credit line retains the original line's:

- sales item type;
- optional catalogue item;
- optional unit of measure;
- description;
- unit rate;
- quotation-item provenance where present.

The user supplies only the quantity being credited.

## 8. Positive credit magnitudes

Credit-note line values are stored as **positive magnitudes**.

For example:

```text
Original invoice line
2.000000 × £100.0000 = £200.0000 net

Partial credit note
1.000000 × £100.0000 = £100.0000 net credit magnitude
```

The accounting/receivable sign comes from:

```text
document_kind = credit_note
```

not from negative quantities or negative unit rates.

This preserves one arithmetic convention across invoice and credit-note line tables.

## 9. Over-credit prevention

The application derives already-credited quantity from **issued** credit-note lines linked to the exact source invoice item.

Draft preparation rejects a quantity greater than the currently available source quantity.

Because two users may prepare competing drafts, issue performs the authoritative revalidation:

1. lock the original invoice document;
2. resolve issued credited quantity for every source item;
3. add the current draft credit quantity;
4. reject issue if the total would exceed the original invoice quantity.

All credit-note issue transactions therefore serialise through the same original invoice row before committing a new issued correction.

A fully credited invoice remains visible as history but is no longer eligible for another credit-note draft through the standard portfolio flow.

## 10. Original tax evidence is preserved

Credit-note tax does **not** use today's tax rate.

For each source-linked correction line, Package 004D copies the original invoice line's stored tax evidence:

```text
tax_category_id
applied_rate_percent
```

and recomputes the credit magnitude using the corrected quantity at that original applied percentage.

Conceptually:

```text
Credit taxable amount
= credited quantity × original invoice unit rate

Credit tax
= credit taxable amount × original invoice applied rate
```

At issue the tax rows are rebuilt from the original invoice tax snapshots again, ensuring draft evidence cannot silently drift from the source invoice.

This is intentionally different from **invoice** issue, where a draft invoice refreshes tax using the rate effective at the invoice's actual issue date.

## 11. Original customer/address evidence is preserved

An issued credit note is a correction to a specific historic invoice.

Therefore credit-note issue copies the original invoice's immutable:

```text
financial_document_party_snapshots
financial_document_party_snapshot_addresses
```

rather than resnapshotting today's CRM party facts.

The issued credit note remains reproducible against the same customer identity/address evidence that appeared on the invoice being corrected.

Recipient evidence defaults from the original invoice's latest issue recipient where available, with the copied snapshot as fallback.

## 12. Controlled credit-note issue

Issue requires:

```text
finance.credit_note.issue OR finance.manage
AND credit-note lifecycle = draft
AND original invoice lifecycle = issued
AND at least one source-linked credit line
AND cumulative source quantities remain within original quantities
```

Issue atomically:

1. locks the original invoice;
2. revalidates source quantities;
3. rebuilds tax from original invoice applied-rate evidence;
4. copies original invoice party/address snapshots;
5. serialises tenant credit-note numbering;
6. changes the document to `issued`;
7. creates issue evidence;
8. creates recipient evidence;
9. appends audit evidence.

Issued credit notes reject ordinary reason/line draft mutation.

Production outbound credit-note delivery is not claimed; delivery channel remains evidence of the selected mechanism.

## 13. Remaining receivable context

For an issued invoice, the correction portfolio derives:

```text
Issued Credit Gross
= Sum(gross values of issued credit notes against that invoice)

Remaining Gross Before Cash Application
= Invoice Gross - Issued Credit Gross
```

This is a pre-payment receivable control, not yet the final customer outstanding balance.

Once payment allocation is activated, authoritative outstanding receivable must also consider unreversed allocations.

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

This prevents a void from silently bypassing correction or cash-application history.

A successful void preserves the legal document number and writes:

```text
lifecycle_status = void
voided_by_member_id
voided_at
void_reason
```

The issued invoice lines, tax, customer snapshots and issue evidence remain preserved.

## 15. Allocation-aware safety before allocation UI exists

Package 004D deliberately checks the existing Package 004 payment-allocation relations even though payment receipt/allocation application services are not yet activated.

An allocation is considered active unless a corresponding `payment_allocation_reversals` row exists.

Therefore:

```text
active allocation   → invoice void blocked
reversed allocation → invoice may be voided if all other void rules pass
```

This prevents future payment activation from invalidating the correction invariant introduced here.

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

## 18. Validation contract

The Package 004D real-MySQL suite proves:

- tenant-owned issued-invoice eligibility;
- legally unnumbered credit-note drafts;
- source invoice/item provenance;
- partial source quantities;
- positive credit magnitudes;
- original applied tax-rate preservation despite a different current tenant rate;
- explicit granular deny precedence;
- issue-only `CN-xxxxxx` numbering;
- original invoice customer/address snapshot copying;
- immutable issued credit notes;
- over-credit rejection;
- fully credited invoice remaining-value derivation;
- Finance/Commercial inability to void by default;
- Owner/Administrator invoice-void authority;
- credit-history blocking of invoice void;
- active-allocation blocking of invoice void;
- reversed-allocation compatibility with invoice void;
- foreign-tenant invoice/credit-note masking;
- bootstrap standard-role parity;
- Svelte/TypeScript diagnostics.

The executable Package 004D head proved on MySQL 8.4.11:

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

The final documentation-synchronised PR head must prove the same complete gate before merge.

## 19. Deliberate exclusions / next boundary

Not claimed implemented by Package 004D:

- credit-note void/reversal;
- payment receipt application service/UI;
- payment allocation application service/UI;
- payment reversal application service/UI;
- allocation-reversal application service/UI;
- final outstanding-balance service;
- customer statements;
- aged receivables / dunning;
- general-ledger posting;
- bank reconciliation;
- PDF/document rendering;
- production outbound credit-note delivery.

The next Package 004 finance boundary is **payment receipt and controlled payment allocation**, followed by derived outstanding balances and receivables reporting.
