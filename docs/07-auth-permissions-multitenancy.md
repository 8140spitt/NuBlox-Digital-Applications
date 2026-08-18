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

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

For a granular permission with a same-domain umbrella, the umbrella is consulted only when the granular key has no explicit member/role decision. Explicit granular deny cannot be bypassed.

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
finance.accounting.period.configure
finance.accounting.period.close
finance.accounting.period.reopen
finance.accounting.year_end.prepare
finance.accounting.year_end.authorise
finance.accounting.year_end.reverse
```

`finance.manage` is the same-domain umbrella for released finance granular keys. Package 004N reporting adds no additional permission.

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

Owner / Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus the complete released accounting permission family for both existing and future organisations.

Finance/Commercial receives ordinary billing, receivable, collections and delegated finance visibility. Its accounting default remains:

```text
finance.accounting.view
```

It does **not** receive accounting configure/post/reverse/export, period-governance or year-end-close mutation permissions by default.

## 6. Controlled account provisioning

Better Auth signup remains fail-closed. Exactly one provisioning intent must validate: an existing-organisation invitation or a self-service organisation-bootstrap intent.

Authentication alone is not tenant authority.

Existing-tenant migration grants and future `OrganisationBootstrapService` role grants remain aligned at persisted role-permission-row level. Package 004O integration coverage verifies year-end permissions remain in that parity contract.

## 7. Finance read and mutation boundary

Normal finance reads require active NuBlox user, active organisation membership, `finance.view` and same-tenant record scope.

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

Accounting journal posting is downstream evidence. It does not become the authority for operational invoice outstanding.

## 9. Accounting read authority

Packages 004L–004O use the accounting read boundary:

```text
active membership
AND finance.view
AND (finance.accounting.view OR finance.manage)
AND same-tenant accounting scope
```

An explicit member deny on `finance.accounting.view` blocks accounting journals, period governance views, financial reports and year-end workspaces even if the member otherwise has `finance.manage`.

Finance/Commercial receives `finance.accounting.view`, so it can inspect accounting evidence and reports without acquiring mutation authority.

## 10. Accounting posting / reversal / export authority

Configuration requires `finance.accounting.configure` or `finance.manage`.

Posting requires `finance.accounting.post` or `finance.manage`, a supported immutable source event, required active mappings, a balanced deterministic journal candidate and no active journal for the same source type/public ID.

Journal correction requires `finance.accounting.reverse` or `finance.manage` and creates a new reversal journal; the original remains immutable.

Export requires `finance.accounting.export` or `finance.manage`. Export evidence stores exact journal membership, period, row count and SHA-256 content checksum. Export reversal requires `finance.accounting.export.reverse` or `finance.manage` and is additive.

No ordinary accounting route accepts arbitrary freehand debit/credit lines.

## 11. Accounting period governance authority

The period workspace uses the accounting read boundary above.

```text
configure: finance.accounting.period.configure OR finance.manage
close:     finance.accounting.period.close OR finance.manage
reopen:    finance.accounting.period.reopen OR finance.manage
```

Close/reopen mutations require an explicit reason.

Lifecycle:

```text
open -> soft_closed -> hard_closed
 ^                         |
 +------- reasoned reopen--+
```

Posting and reversal require an open period. Export requires an exactly matching soft/hard-closed period. Hard close requires active export evidence for every journal in the period. Hard-closed export evidence cannot be reversed until explicit reopen.

Package 004M integration coverage proves an explicit member deny on `finance.accounting.period.close` overrides Owner role authority and the `finance.manage` fallback.

## 12. Financial-reporting authority

Package 004N is read-only and introduces no permission.

```text
/finance/accounting/reports
```

The route requires active membership, finance/accounting read authority, same-tenant period scope and same-tenant journal/account scope.

Foreign accounting-period public IDs are returned as unavailable rather than disclosing another tenant's period identity.

Reports are tenant-, period- and currency-specific. Controlled Package 004O year-end close/reversal journals remain in trial-balance and balance-sheet accounting evidence. The year-end reporting bridge excludes those closing mechanics only from operating P&L aggregation so closing revenue/expense accounts does not erase historical operating performance.

No report snapshot or editable report balance is persisted.

## 13. Year-end close authority

Protected workspace:

```text
/finance/accounting/year-end
```

Preparation requires:

```text
finance.accounting.year_end.prepare OR finance.manage
```

Authorisation requires:

```text
finance.accounting.year_end.authorise OR finance.manage
AND authorising member != preparing member
```

Reversal requires:

```text
finance.accounting.year_end.reverse OR finance.manage
```

A year-end preparation additionally requires:

- financial year belongs to the active tenant;
- configured periods cover the complete financial year without gaps;
- every period is `hard_closed`;
- selected currency has revenue/expense journal movement;
- `retained_earnings` maps to an active equity account;
- no active authorised close exists for the same financial year and currency.

Preparation stores immutable source totals and a SHA-256 fingerprint. Authorisation acquires the organisation accounting mutex, re-derives the fingerprint from locked period/journal evidence and rejects stale preparation evidence.

The generated `year_end_close` journal is dated at the financial-year end, closes revenue and expense balances and transfers profit/loss to retained earnings. Correction creates an additive reversal journal plus `accounting_year_end_close_reversals` provenance; prior journals, period history, preparations and closes are never rewritten.

Concurrent authorisations serialize on the organisation accounting mutex. Integration coverage requires exactly one concurrent winner for a shared preparation.

An explicit member deny on a year-end granular key remains stronger than Owner role grants and the `finance.manage` fallback.

## 14. Cross-domain separation

```text
commercial.manage cannot post accounting journals
contract.manage cannot close accounting periods
finance.accounting.* cannot mutate contracts or quotations
finance.accounting.period.* does not imply accounting post/reverse/export authority
finance.accounting.year_end.* does not imply ordinary source posting authority
finance.accounting.view does not imply any accounting mutation authority
finance.accounting.view/reporting does not imply HMRC submission authority
finance.tax_relief.* does not imply accounting-posting authority
```

## 15. Tenant isolation

- Trusted tenant context comes from authenticated active membership.
- Tenant-owned queries include active `organisation_id`.
- Public/surrogate IDs are never proof of access.
- Foreign tenant identities are masked where appropriate.
- Project contextual roles never grant application permission.
- Reports, exports and generated files preserve tenant boundaries.
- Accounting periods, journals, year-end evidence and reports remain tenant scoped.
- Currencies are never combined implicitly.

## 16. Package 004O release testing requirements

The real-MySQL release gate covers:

- authentication and tenant resolution;
- explicit deny precedence and umbrella behavior;
- organisation bootstrap parity;
- existing CRM/commercial/project/contract/finance regression suites;
- source-derived balanced journals and additive reversal;
- accounting posting concurrency;
- accounting-period governance and close/reopen enforcement;
- trial-balance opening/period/closing equality;
- period and financial-year-to-date operating P&L;
- balance-sheet equality before/after retained-earnings close and reversal;
- complete hard-closed financial-year prerequisite;
- retained-earnings equity mapping prerequisite;
- immutable preparation fingerprint and stale-source revalidation;
- preparer/authoriser separation;
- concurrent year-end authorisation serialization;
- additive year-end close reversal;
- year-end bootstrap parity and explicit granular deny precedence;
- zero generated Kysely drift across all three schema outputs;
- Svelte/TypeScript diagnostics.

Package 004O release target:

```text
25 production migrations applied / 0 pending
384 tables / 857 foreign keys / 495 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts + accounting.d.ts
40 integration files / 158 real-MySQL tests
accounting year-end: 3 / 3
accounting year-end bootstrap + explicit deny: 1 / 1
accounting reporting: 4 / 4
accounting periods: 6 / 6
accounting period bootstrap + explicit deny: 1 / 1
accounting core: 5 / 5
accounting concurrency: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The exact documentation-synchronised PR head must reproduce this complete gate before merge.
