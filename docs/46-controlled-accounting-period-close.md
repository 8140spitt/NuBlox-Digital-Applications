# Package 004M — Controlled Accounting Periods and Close Governance

Status: executable application boundary pending final documentation-synchronised release gate.

## Purpose

Package 004M adds tenant financial-year and accounting-period governance to the source-derived accounting evidence introduced by Package 004L.

Period governance controls **when new accounting evidence may be posted, reversed or exported**. It never rewrites NuBlox operational finance events and it never mutates already-posted journal history.

## Persistence model

Package 004M adds three tenant-scoped tables:

```text
accounting_financial_years
accounting_periods
accounting_period_status_events
```

### `accounting_financial_years`

- tenant-owned financial-year code and name;
- inclusive start/end dates;
- creating member evidence;
- financial years cannot overlap within one organisation.

### `accounting_periods`

- belongs to one exact financial year;
- period number, name and inclusive start/end dates;
- period must be fully contained by its financial year;
- periods cannot overlap within one organisation;
- lifecycle status is one of:

```text
open
soft_closed
hard_closed
```

### `accounting_period_status_events`

Every status transition creates additive evidence containing:

- exact period;
- previous status;
- new status;
- required reason;
- acting member;
- transition timestamp.

The event history is retained even when a period is later reopened.

## Lifecycle

```text
open
  ↓ reasoned soft close
soft_closed
  ↓ export completeness gate + reasoned hard close
hard_closed

soft_closed ── reasoned reopen ──→ open
hard_closed ── reasoned reopen ──→ open
```

Direct `open -> hard_closed` is not permitted.

## Accounting-date enforcement

### Journal posting

A source-derived journal may be posted only when its selected accounting date belongs to **exactly one configured open accounting period**.

If no configured period contains the date, posting is rejected.

If the period is soft-closed or hard-closed, posting is rejected.

### Journal reversal

A journal reversal is itself new accounting evidence. Its reversal accounting date must therefore belong to an open accounting period.

The original journal remains immutable.

### Accounting export

An export period must match one configured accounting period **exactly** by start and end date.

An open period cannot be exported. Export is available only when the matching period is soft-closed or hard-closed.

### Export reversal

An export attached to a hard-closed period cannot be reversed while that period remains hard-closed.

The period must first be explicitly reopened. Export reversal then remains additive evidence under the existing Package 004L model.

## Hard-close completeness gate

A soft-closed period can be hard-closed only when every accounting journal dated inside the period has active accounting-export evidence.

```text
soft_closed period
       ↓
all journals exported?
   ├─ no  → hard close blocked
   └─ yes → hard close permitted
```

Reversed export evidence is not active evidence for this gate.

## Concurrency

Package 004M uses the tenant organisation row as the accounting governance mutex before period mutation and accounting posting/export decisions.

Period and journal/export eligibility reads use locking reads where mutation decisions are made. This preserves Package 004L's protection against stale MySQL `REPEATABLE READ` snapshots after a competing transaction commits.

## Permissions

Package 004M adds:

```text
finance.accounting.period.configure
finance.accounting.period.close
finance.accounting.period.reopen
```

All three use `finance.manage` only as the same-domain fallback.

Explicit granular member deny remains stronger than the umbrella.

### Standard role defaults

Owner / Administrator:

```text
✓ configure financial years and periods
✓ soft close / hard close
✓ reopen
```

Finance/Commercial:

```text
✓ finance.view
✓ finance.accounting.view
✕ period configure
✕ period close
✕ period reopen
✕ finance.manage
```

Finance/Commercial can therefore inspect period governance without receiving close authority by default.

Existing organisations receive Owner/Administrator grants through the Package 004M migration. Future organisations receive the equivalent persisted grants from `OrganisationBootstrapService`; integration coverage verifies parity and explicit-deny precedence.

## Application surface

```text
/finance/accounting/periods
```

The workspace provides:

- financial-year creation;
- accounting-period creation;
- current period status;
- count of journals missing active export evidence;
- soft close;
- hard close;
- reasoned reopen;
- recent additive transition history.

The existing `/finance/accounting` posting/export service consumes the period rules directly, so period governance is enforced server-side rather than being a UI-only warning.

## Audit actions

```text
finance.accounting.year.created
finance.accounting.period.created
finance.accounting.period.soft_closed
finance.accounting.period.hard_closed
finance.accounting.period.reopened
```

## Deliberate exclusions

Package 004M does not implement:

- automatic monthly period generation;
- year-end closing journals;
- retained-earnings transfer;
- trial balance, profit-and-loss or balance-sheet presentation;
- statutory financial statements;
- consolidation;
- purchase-ledger/AP expansion;
- bank reconciliation;
- FX revaluation or translation;
- provider-specific accounting API period locks.

Those are later accounting boundaries and must consume the immutable journal/period evidence rather than bypass it.

## Release contract

Candidate schema:

```text
24 production migrations
381 base tables
848 foreign keys
492 CHECK constraints
```

The exact integration-test totals and final release SHA are recorded after the documentation-synchronised PR head passes the complete MySQL/Kysely/Svelte gate.
