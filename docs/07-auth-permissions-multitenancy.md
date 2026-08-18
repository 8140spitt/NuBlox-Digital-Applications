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

Owner and Administrator receive broad project, CRM, commercial, contract and finance umbrellas plus released granular permissions. For Packages 004L–004M they receive the six accounting permissions plus the three accounting-period governance permissions explicitly.

### Finance/Commercial

Finance/Commercial receives ordinary billing, invoice, credit-note, payment/allocation, collections, credit-control administration and delegated bad-debt/tax-evidence responsibilities.

Its accounting default remains:

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
finance.accounting.period.configure
finance.accounting.period.close
finance.accounting.period.reopen
```

This keeps operational finance visibility distinct from stronger accounting configuration, posting, correction, export and period-close authority.

### Other roles

```text
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

## 6. Controlled account provisioning

Better Auth signup remains fail-closed. Exactly one provisioning intent must validate: an existing-organisation invitation or a self-service organisation-bootstrap intent.

Authentication alone is not tenant authority.

Forward-migration role grants for existing organisations and `OrganisationBootstrapService` defaults for future organisations remain aligned at persisted role-permission-row level.

Packages 004L–004M parity is:

```text
Owner / Administrator
    → accounting view
    → configure
    → post
    → journal reverse
    → export
    → export reverse
    → period configure
    → period close
    → period reopen

Finance/Commercial
    → accounting view only
```

Real-MySQL bootstrap coverage verifies this split. Package 004M also verifies that an explicit member deny on `finance.accounting.period.close` overrides the Owner role and `finance.manage` until that explicit deny is removed.

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

## 9. Credit-control commitment gates

Accepted quotation conversion and contract execution use:

```text
Projected Exposure
= Current Receivable
+ Proposed Commitment
```

An active hold or projected exposure above an enabled currency limit blocks new commitment unless a separately authorised, reasoned override is recorded in the same business transaction.

## 10. Bad debt and VAT-relief separation

Package 004J separates bad-debt assessment/recommendation from stronger write-off recognition. Active write-offs reduce receivable; recommendations and later recoveries do not.

Package 004K VAT relief starts only from an active write-off marked `separate_tax_adjustment_required`. Claim preparation, authorisation, repayment and VAT-return posting/reversal use distinct permissions and additive evidence.

## 11. Package 004L accounting viewing authority

```text
active membership
AND finance.view
AND (finance.accounting.view OR finance.manage)
AND same-tenant accounting scope
```

Finance/Commercial receives this read key by default but no accounting mutation keys.

## 12. Package 004L configuration / posting / reversal / export

Configuration requires `finance.accounting.configure` or `finance.manage`.

Posting requires `finance.accounting.post` or `finance.manage`, a supported immutable source event, required active mappings, a balanced deterministic journal candidate and no active journal for the same source type/public ID.

No ordinary route accepts arbitrary freehand debit/credit lines.

Journal correction requires `finance.accounting.reverse` or `finance.manage` and creates a new `journal_reversal` entry; the original remains immutable.

Export requires `finance.accounting.export` or `finance.manage`. Export evidence stores exact journal membership, period, row count and SHA-256 content checksum. Export reversal requires `finance.accounting.export.reverse` or `finance.manage` and creates additive reversal evidence.

Accounting posting uses an organisation accounting mutex plus locking/current source and sequence reads so a transaction that waited under MySQL `REPEATABLE READ` sees the newly committed journal rather than an older snapshot.

## 13. Package 004M accounting-period viewing authority

The period workspace is part of the accounting read boundary:

```text
active membership
AND finance.view
AND (finance.accounting.view OR finance.manage)
AND same-tenant accounting scope
```

Finance/Commercial can therefore inspect financial years, periods, statuses, unexported-journal counts and transition history without acquiring close authority.

## 14. Package 004M period configuration authority

```text
finance.accounting.period.configure OR finance.manage
AND active membership
AND same tenant
```

Configuration creates financial-year and accounting-period facts.

Business rules:

- financial years cannot overlap within one tenant;
- accounting periods cannot overlap within one tenant;
- a period must be fully contained within its financial year;
- new periods begin `open`.

## 15. Package 004M close authority

```text
finance.accounting.period.close OR finance.manage
AND active membership
AND same-tenant period
AND explicit reason
```

Lifecycle:

```text
open -> soft_closed -> hard_closed
```

Direct `open -> hard_closed` is rejected.

Hard close additionally requires every journal whose accounting date is inside the period to have active export evidence.

Every successful close creates an immutable `accounting_period_status_events` row plus audit evidence.

## 16. Package 004M reopen authority

```text
finance.accounting.period.reopen OR finance.manage
AND active membership
AND same-tenant closed period
AND explicit reason
```

A soft-closed or hard-closed period may be reopened to `open`. The prior transition history remains intact.

An export linked to a hard-closed period cannot be reversed through `finance.accounting.export.reverse` while the period is hard closed. The stronger period reopen decision must occur first.

## 17. Package 004M accounting-date enforcement

Period governance is enforced inside server-domain accounting operations, not only in the UI.

```text
journal posting date
    → exactly one configured open period

journal reversal date
    → exactly one configured open period

accounting export range
    → exactly one configured period with exact start/end
    → period must be soft_closed or hard_closed
```

Period state constrains **new accounting evidence**. It never rewrites the operational source event or a posted journal.

## 18. Cross-domain separation

```text
commercial.manage cannot post accounting journals
contract.manage cannot close accounting periods
finance.accounting.* cannot mutate contracts or quotations
finance.accounting.period.* does not imply accounting post/reverse/export authority
finance.accounting.* does not imply HMRC submission authority
finance.tax_relief.* does not imply accounting-posting authority
```

## 19. Tenant isolation

- Trusted tenant context comes from authenticated active membership.
- Tenant-owned queries include active `organisation_id`.
- Public/surrogate IDs are never proof of access.
- Foreign tenant identities are masked where appropriate.
- Project contextual roles never grant application permission.
- Reports, exports and generated files preserve tenant boundaries.
- Accounting periods, journals and exports remain tenant scoped.

## 20. Package 004M release testing requirements

The real-MySQL release gate covers:

- authentication and tenant resolution;
- explicit deny precedence and umbrella behavior;
- organisation bootstrap parity;
- existing CRM/commercial/project/contract/finance regression suites;
- chart-of-accounts and semantic mapping type rules;
- source-derived balanced accounting journals and additive reversal;
- accounting posting concurrency;
- financial-year and accounting-period non-overlap;
- period containment inside financial year;
- open-period posting and reversal enforcement;
- exact closed-period export enforcement;
- hard-close export completeness;
- hard-closed export-reversal guard and reasoned reopen;
- additive period transition evidence;
- Finance/Commercial read-only period authority;
- Owner/Admin bootstrap period grants;
- explicit granular period-close deny precedence over `finance.manage`;
- zero generated Kysely drift across all three schema outputs;
- Svelte/TypeScript diagnostics.

Package 004M release target:

```text
24 production migrations applied / 0 pending
381 tables / 848 foreign keys / 492 CHECK constraints
zero generated Kysely drift across database.d.ts + collections.d.ts + accounting.d.ts
37 integration files / 150 real-MySQL tests
accounting periods: 6 / 6
accounting period bootstrap + explicit deny: 1 / 1
accounting core: 5 / 5
accounting concurrency: 1 / 1
svelte-check: 0 errors / 0 warnings
```

The exact documentation-synchronised PR head must reproduce this complete gate before merge.
