# 07 — Authentication, Permissions and Multi-tenancy

## 1. Governing security model

NuBlox combines authentication, active tenant membership, organisation RBAC, member overrides, project scope, tenant-record scope and lifecycle/business policy.

> **Career ≠ Organisation Role ≠ Project Role ≠ Permission.**

Careers and job titles configure professional context and feature relevance. They never grant application authority automatically.

## 2. Trust chain

```text
Better Auth identity
        ↓
auth_user_links
        ↓
active NuBlox user
        ↓
active organisation membership
        ↓
organisation roles + member overrides
        ↓
project membership scope where required
        ↓
tenant-record + lifecycle/business policy
```

The selected-organisation cookie is a selection hint only. Active membership is revalidated before trusted tenant context is constructed.

## 3. Permission precedence

Within one permission key:

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

For a granular permission with a same-domain umbrella:

```text
granular member deny
    > granular member allow / role grant
    > same-domain umbrella fallback
    > default deny
```

The umbrella is consulted only when the granular key has no explicit member/role decision. Explicit granular deny cannot be bypassed.

Permission umbrellas never cross domains:

```text
commercial.manage ≠ contract authority
contract.manage   ≠ finance authority
finance.manage    ≠ commercial or contract authority
```

## 4. Current finance permission catalogue

```text
finance.view
finance.manage
finance.billing.manage
finance.invoice.create
finance.invoice.draft.manage
finance.invoice.issue
finance.invoice.void
finance.credit_note.create
finance.credit_note.draft.manage
finance.credit_note.issue
finance.payment.create
finance.payment.allocate
finance.payment.allocation.reverse
finance.payment.reverse
finance.collections.view
finance.collections.case.manage
finance.collections.action.record
finance.collections.promise.manage
finance.collections.dispute.manage
finance.collections.policy.manage
finance.collections.reminder.generate
finance.collections.reminder.dispatch
finance.credit_control.view
finance.credit_control.policy.manage
finance.credit_control.hold.manage
finance.credit_control.override
finance.bad_debt.view
finance.bad_debt.case.manage
finance.bad_debt.recommend
finance.bad_debt.write_off.authorise
finance.bad_debt.write_off.reverse
finance.bad_debt.recovery.record
finance.bad_debt.recovery.reverse
finance.tax_relief.view
finance.tax_relief.prepare
finance.tax_relief.authorise
finance.tax_relief.reverse
finance.tax_relief.repayment.record
finance.tax_relief.repayment.reverse
finance.tax_relief.post
finance.tax_relief.post.reverse
finance.accounting.view
finance.accounting.configure
finance.accounting.post
finance.accounting.reverse
finance.accounting.export
finance.accounting.export.reverse
```

`finance.manage` is the same-domain umbrella for released finance granular keys. It never grants commercial or contract authority.

## 5. Standard organisation roles

Every organisation receives:

```text
Owner
Administrator
Manager
Finance/Commercial
Member/Professional
Field Worker
Read Only
```

The founding member receives Owner only.

### Owner / Administrator

Owner and Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions.

For Package 004L they receive all six `finance.accounting.*` permissions explicitly.

### Finance/Commercial

Finance/Commercial receives ordinary billing, invoice, credit-note, payment/allocation, collections, credit-control administration and delegated bad-debt/tax-evidence responsibilities.

Package 004L adds only:

```text
finance.accounting.view
```

It deliberately does **not** receive by default:

```text
finance.manage
finance.invoice.void
finance.credit_control.override
finance.bad_debt.write_off.authorise
finance.bad_debt.write_off.reverse
finance.tax_relief.authorise
finance.tax_relief.reverse
finance.tax_relief.repayment.record
finance.tax_relief.repayment.reverse
finance.tax_relief.post
finance.tax_relief.post.reverse
finance.accounting.configure
finance.accounting.post
finance.accounting.reverse
finance.accounting.export
finance.accounting.export.reverse
```

This keeps operational finance visibility distinct from stronger accounting configuration, posting, correction and export authority.

### Other roles

```text
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

## 6. Controlled account provisioning

Better Auth signup remains fail-closed. Exactly one provisioning intent must validate:

1. an existing-organisation invitation; or
2. a self-service organisation-bootstrap intent.

Authentication alone is not tenant authority.

Forward-migration role grants for existing organisations and `OrganisationBootstrapService` defaults for future organisations must remain aligned at persisted role-permission-row level.

Package 004L parity is:

```text
Owner / Administrator
    → accounting view
    → configure
    → post
    → journal reverse
    → export
    → export reverse

Finance/Commercial
    → accounting view only
```

A dedicated real-MySQL integration test verifies this split for newly created organisations.

## 7. Finance read and mutation boundary

Normal finance reads require:

```text
active NuBlox user
AND active organisation membership
AND finance.view
AND finance record organisation_id = active tenant
```

Finance mutations require the granular finance permission or `finance.manage` fallback plus record/lifecycle/business policy.

Foreign finance public IDs are tenant-masked where disclosure would leak another tenant's record identity.

## 8. Authoritative receivable model

NuBlox does not persist a second editable customer balance for reporting, collections, credit control, bad debt, VAT relief or accounting.

```text
Invoice Outstanding
= Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
− Active Write-offs
```

Customer/currency receivable is the sum of positive issued-invoice positions. Voided invoices contribute no exposure. Unallocated cash does not reduce customer receivable until allocated.

Accounting journal posting is downstream evidence. It does not become the authority for operational invoice outstanding.

## 9. Credit-control commitment gates

Accepted quotation conversion and contract execution use the Package 004I finance decision:

```text
Projected Exposure
= Current Receivable
+ Proposed Commitment
```

An active hold or projected exposure above an enabled currency limit blocks new commitment unless a separately authorised, reasoned override is recorded in the same business transaction.

Credit control and invoice mutations use a customer-first lock hierarchy plus current/locking receivable reads.

## 10. Bad debt and VAT-relief separation

Package 004J separates bad-debt assessment/recommendation from stronger write-off recognition. Active write-offs reduce receivable; recommendations and later recoveries do not.

Package 004K VAT relief starts only from an active write-off marked `separate_tax_adjustment_required`. Claim preparation, authorisation, repayment and VAT-return posting/reversal use distinct permissions and additive evidence.

VAT-relief evidence is downstream tax evidence and does not create a second customer receivable.

## 11. Package 004L accounting viewing authority

```text
active membership
AND finance.view
AND (finance.accounting.view OR finance.manage)
AND same-tenant accounting scope
```

Finance/Commercial receives this read key by default but no accounting mutation keys.

## 12. Package 004L configuration authority

```text
finance.accounting.configure OR finance.manage
AND active membership
AND same-tenant accounting account/mapping scope
```

Configuration covers tenant chart-of-accounts records and semantic account mappings. Mapping changes affect future derived candidates only; historical journal lines keep their exact account foreign keys.

Expected mapping account types are enforced by service policy.

## 13. Package 004L posting authority

```text
finance.accounting.post OR finance.manage
AND exact supported immutable source event
AND required semantic mappings active
AND balanced deterministic journal candidate
AND no active journal for the same source type/public ID
```

Supported sources are derived from released invoice, credit-note, payment/allocation, bad-debt and VAT-relief facts.

No ordinary route accepts arbitrary freehand debit/credit lines.

### Posting serialization

Accounting posting uses:

```text
organisation accounting mutex
        ↓
locking/current source resolution
        ↓
locking/current active-journal check
        ↓
locking/current journal-number sequence
        ↓
insert exact journal + lines
```

The current reads are intentional under MySQL `REPEATABLE READ`: a transaction that waited behind a competing poster must see the journal committed while it waited rather than reuse its older consistent snapshot.

At most one active non-reversed journal exists for one source type/public ID. A competing attempt rejects with a domain validation error.

## 14. Package 004L journal reversal authority

```text
finance.accounting.reverse OR finance.manage
AND same-tenant active journal
AND explicit reason
```

Correction creates a new `journal_reversal` journal with debit/credit sides inverted and a one-to-one reversal link. The original journal remains immutable.

After reversal, the original operational source can be reposted under current mappings while preserving the complete history.

## 15. Package 004L export authority

```text
finance.accounting.export OR finance.manage
AND selected accounting period contains unexported journals
AND explicit reason
```

The first format is provider-neutral `generic_csv`.

Export evidence stores exact journal membership, period, row count and SHA-256 content checksum. Download regenerates content from persisted links and refuses delivery if the checksum differs.

Export reversal requires `finance.accounting.export.reverse` or `finance.manage` and creates additive reversal evidence. It does not delete the original export batch.

## 16. Cross-domain separation

```text
commercial.manage cannot post accounting journals
contract.manage cannot post accounting journals
finance.accounting.* cannot mutate contracts or quotations
finance.accounting.* does not imply HMRC submission authority
finance.tax_relief.* does not imply accounting-posting authority
```

Operational source authority and downstream accounting authority remain distinct.

## 17. Tenant isolation

- Trusted tenant context comes from authenticated active membership.
- Tenant-owned queries include active `organisation_id`.
- Public/surrogate IDs are never proof of access.
- Foreign tenant identities are masked where appropriate.
- Project contextual roles never grant application permission.
- Reports, exports and generated files preserve tenant boundaries.
- Accounting exports contain only journals from the active tenant.

## 18. Package 004L release testing requirements

The real-MySQL release gate covers:

- authentication and tenant resolution;
- explicit deny precedence and umbrella behavior;
- organisation bootstrap parity;
- existing CRM/commercial/project/contract/finance regression suites;
- chart-of-accounts and semantic mapping type rules;
- Finance/Commercial view-only accounting authority;
- explicit accounting-post deny precedence over `finance.manage`;
- issued-invoice net/VAT/gross journal derivation;
- exact debit/credit balance persistence;
- one active journal per source event;
- concurrent duplicate-source serialization and domain rejection;
- additive journal reversal and repost;
- generic CSV checksum regeneration;
- active-export duplicate prevention and additive export reversal;
- foreign-tenant accounting identity masking;
- zero generated Kysely drift across all three schema outputs;
- Svelte/TypeScript diagnostics.

Validated executable Package 004L contract:

```text
23 production migrations applied / 0 pending
378 tables / 841 foreign keys / 485 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts + accounting.d.ts
35 integration files / 143 real-MySQL tests
accounting core: 5 / 5
accounting concurrency: 1 / 1
accounting bootstrap parity: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The final documentation-synchronised PR head must reproduce this complete gate before merge.
