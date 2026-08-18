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
```

`finance.manage` is the same-domain umbrella for released finance granular keys. Package 004N adds no permission.

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

Owner / Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions.

Finance/Commercial receives ordinary billing, receivable, collections and delegated finance visibility. Its accounting default remains:

```text
finance.accounting.view
```

It does **not** receive accounting configure/post/reverse/export or accounting-period governance permissions by default.

## 6. Controlled account provisioning

Better Auth signup remains fail-closed. Exactly one provisioning intent must validate: an existing-organisation invitation or a self-service organisation-bootstrap intent.

Authentication alone is not tenant authority.

Existing-tenant migration grants and future `OrganisationBootstrapService` role grants remain aligned at persisted role-permission-row level.

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

Package 004L established the accounting read boundary and Packages 004M–004N reuse it:

```text
active membership
AND finance.view
AND (finance.accounting.view OR finance.manage)
AND same-tenant accounting scope
```

An explicit member deny on `finance.accounting.view` blocks accounting journals, period governance views and Package 004N financial reports even if the member otherwise has `finance.manage`.

Finance/Commercial receives `finance.accounting.view`, so it can inspect accounting evidence and reports without acquiring mutation authority.

## 10. Accounting posting / reversal / export authority

Configuration requires `finance.accounting.configure` or `finance.manage`.

Posting requires `finance.accounting.post` or `finance.manage`, a supported immutable source event, required active mappings, a balanced deterministic journal candidate and no active journal for the same source type/public ID.

Journal correction requires `finance.accounting.reverse` or `finance.manage` and creates a new reversal journal; the original remains immutable.

Export requires `finance.accounting.export` or `finance.manage`. Export evidence stores exact journal membership, period, row count and SHA-256 content checksum. Export reversal requires `finance.accounting.export.reverse` or `finance.manage` and is additive.

No ordinary accounting route accepts arbitrary freehand debit/credit lines.

## 11. Accounting period governance authority

The period workspace uses the accounting read boundary above.

Configuration:

```text
finance.accounting.period.configure OR finance.manage
```

Close:

```text
finance.accounting.period.close OR finance.manage
AND explicit reason
```

Reopen:

```text
finance.accounting.period.reopen OR finance.manage
AND explicit reason
```

Lifecycle:

```text
open -> soft_closed -> hard_closed
 ^                         |
 +------- reasoned reopen--+
```

Posting and reversal require an open period. Export requires an exactly matching soft/hard-closed period. Hard close requires active export evidence for every journal in the period. Hard-closed export evidence cannot be reversed until explicit reopen.

Package 004M integration coverage proves an explicit member deny on `finance.accounting.period.close` overrides Owner role authority and the `finance.manage` fallback.

## 12. Package 004N financial-reporting authority

Package 004N is read-only and introduces no permission.

```text
/finance/accounting/reports
```

The route requires:

```text
active membership
AND finance.view
AND (finance.accounting.view OR finance.manage)
AND selected period belongs to active tenant
AND selected journal/account rows belong to active tenant
```

The reporting service does not call accounting mutation permissions and cannot create, reverse, export or close accounting evidence.

Foreign accounting-period public IDs are returned as unavailable rather than disclosing another tenant's period identity.

## 13. Package 004N reporting invariants

Reports are tenant-, period- and currency-specific.

```text
opening balance = journal net before period start
period movement = debit / credit movement inside selected period
closing balance = journal net through period end
```

Trial-balance equality is derived independently for opening, period movement and closing balances.

P&L derives from revenue/expense account types. Balance-sheet presentation derives from asset/liability/equity account types plus explicit cumulative unclosed earnings until a later year-end closing-journal boundary exists.

Reversal journals remain separate evidence and enter reports at their own accounting date. Earlier periods therefore remain historically unchanged.

No report snapshot or editable report balance is persisted.

## 14. Cross-domain separation

```text
commercial.manage cannot post accounting journals
contract.manage cannot close accounting periods
finance.accounting.* cannot mutate contracts or quotations
finance.accounting.period.* does not imply accounting post/reverse/export authority
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
- Accounting periods, journals and reports remain tenant scoped.
- Package 004N never aggregates currencies implicitly.

## 16. Package 004N release testing requirements

The real-MySQL release gate covers:

- authentication and tenant resolution;
- explicit deny precedence and umbrella behavior;
- organisation bootstrap parity;
- existing CRM/commercial/project/contract/finance regression suites;
- source-derived balanced journals and additive reversal;
- accounting posting concurrency;
- accounting-period governance and close/reopen enforcement;
- trial-balance opening/period/closing equality;
- period and financial-year-to-date P&L;
- balance-sheet equality using explicit unclosed earnings;
- GBP/EUR currency isolation;
- historical reversal timing;
- explicit `finance.accounting.view` deny precedence over `finance.manage`;
- foreign-period tenant masking;
- zero generated Kysely drift across all three schema outputs;
- Svelte/TypeScript diagnostics.

Package 004N release target:

```text
24 production migrations applied / 0 pending
381 tables / 848 foreign keys / 492 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts + accounting.d.ts
38 integration files / 154 real-MySQL tests
accounting reporting: 4 / 4
accounting periods: 6 / 6
accounting period bootstrap + explicit deny: 1 / 1
accounting core: 5 / 5
accounting concurrency: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The exact documentation-synchronised PR head must reproduce this complete gate before merge.
