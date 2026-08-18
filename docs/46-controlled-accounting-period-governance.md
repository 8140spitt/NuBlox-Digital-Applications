# Package 004M — Controlled Accounting Periods and Close Governance

## Purpose

Package 004M introduces tenant-scoped financial years and accounting periods as a governance boundary around accounting evidence. It does not change operational finance facts and does not rewrite journals already posted by Package 004L.

## Governing rule

**Period governance constrains when new accounting evidence may be dated. It must never rewrite operational source events or existing journal history.**

## State model

Accounting periods have three explicit states:

- `open` — routine posting, reversal and export evidence may be created.
- `soft_closed` — routine source posting is blocked; controlled correction/reversal evidence remains eligible.
- `hard_closed` — no new accounting evidence may be dated into the period until an authorised reopen is recorded.

State changes are serialized under the organisation accounting mutex and recorded additively in `accounting_period_state_events`. Reopening a closed period additionally creates immutable `accounting_period_reopen_authorities` evidence.

Allowed transitions are:

- `open -> soft_closed`
- `open -> hard_closed`
- `soft_closed -> hard_closed`
- `soft_closed -> open` with reopen authority
- `hard_closed -> open` with reopen authority

Direct `hard_closed -> soft_closed` transitions are deliberately excluded. A hard close must be explicitly reopened before any later soft close.

## Data model

### `accounting_financial_years`

Tenant financial-year envelope with immutable start/end dates and creator evidence. Financial years for one organisation must not overlap.

### `accounting_periods`

Period number, date range, current state and monotonic `state_version`. Periods must be contained by their financial year and must not overlap another period in the same organisation.

### `accounting_period_state_events`

Append-only state transition evidence containing from/to state, state version, actor, timestamp and mandatory reason.

### `accounting_period_reopen_authorities`

Append-only strong-authority evidence for a transition from `soft_closed` or `hard_closed` back to `open`.

## Permissions

Package 004M adds:

- `finance.accounting.period.view`
- `finance.accounting.period.configure`
- `finance.accounting.period.soft-close`
- `finance.accounting.period.hard-close`
- `finance.accounting.period.reopen`

Existing active Owner and Administrator roles receive all five permissions. Existing Finance/Commercial roles receive view only. Future-tenant bootstrap parity must preserve exactly the same split before Package 004M is released.

## Service boundary

`AccountingPeriodService` provides:

- financial-year creation;
- accounting-period creation;
- tenant-scoped period listing;
- serialized state transitions;
- additive reopen authority evidence.

`assertAccountingDateEligible(...)` is the shared enforcement primitive for accounting evidence writers. The integration step must call it from Package 004L posting, reversal and export paths while holding the same organisation accounting mutex.

## Eligibility policy

| Period state | Routine posting | Reversal/correction | Export evidence |
| --- | --- | --- | --- |
| `open` | allowed | allowed | allowed |
| `soft_closed` | blocked | allowed | allowed |
| `hard_closed` | blocked | blocked | blocked |

A date that belongs to no configured accounting period is ineligible once Package 004M enforcement is enabled.

## Concurrency

Configuration and transitions lock the organisation first, then relevant financial-year/period rows. Accounting evidence writers must preserve the same lock hierarchy: organisation mutex first, period lookup second, then Package 004L source/journal/export locks. This prevents stale REPEATABLE READ decisions and avoids introducing an inverted lock order.

## Audit actions

- `finance.accounting.financial-year.created`
- `finance.accounting.period.created`
- `finance.accounting.period.soft_closed`
- `finance.accounting.period.hard_closed`
- `finance.accounting.period.reopened`

## Deliberate exclusions

Package 004M does not yet introduce:

- automatic period generation;
- accounting period UI/routes;
- trial balance, P&L or balance-sheet presentation;
- year-end journals;
- bank reconciliation;
- accounts payable expansion;
- FX revaluation/translation;
- provider-specific accounting integrations.

## Release gate remaining

The schema/service foundation is not a complete release until all of the following are true:

1. Package 004L posting, reversal and export paths call the period eligibility guard.
2. Future-tenant bootstrap grants match migration grants.
3. Integration coverage proves open/soft-close/hard-close/reopen behavior and tenant isolation.
4. Real-MySQL concurrency coverage proves a competing close cannot race a posting decision.
5. Generated Kysely accounting types reproduce with zero drift.
6. `pnpm check`, integration tests and database migration validation are green.
