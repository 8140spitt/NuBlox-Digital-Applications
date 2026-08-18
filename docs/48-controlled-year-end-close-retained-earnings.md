# Package 004O — Controlled Year-End Close and Retained Earnings

## Purpose

Package 004O introduces a controlled year-end accounting boundary after period governance and derived financial reporting are stable.

The close consumes immutable journals and governed financial-year/period evidence. It creates new balanced accounting evidence and never rewrites operational finance events, prior journal entries, accounting-period history or previously rendered reports.

## Preconditions

A year-end close may be prepared only when:

- the financial year belongs to the acting tenant;
- the financial year has accounting periods covering its intended accounting range;
- every accounting period in that financial year is hard closed;
- there is at least one journal movement for the selected currency;
- the chart of accounts has an active `retained_earnings` semantic mapping to an equity account;
- there is no active authorised year-end close for the same financial year and currency.

A close preparation is not authority to post. Preparation and authorisation are separate actions and the authorising member must differ from the preparing member.

## Evidence model

`accounting_year_end_close_preparations` stores immutable derived close evidence:

- financial year and currency;
- revenue total;
- expense total;
- profit or loss;
- balanced closing debit/credit totals;
- SHA-256 source fingerprint;
- preparer, timestamp and reason.

Multiple preparations are allowed as additive versions. A stale preparation must be rejected at authorisation when its fingerprint no longer matches the governed source evidence.

`accounting_year_end_closes` stores the separately authorised close transaction and exact linkage to the generated accounting journal.

`accounting_year_end_close_reversals` stores additive correction provenance and links the close to its reversal journal. Neither the close record nor original journal is deleted or edited to correct history.

## Closing journal

The generated `year_end_close` journal must:

- use the financial-year end date as its accounting date;
- debit each revenue account for its year-end credit balance;
- credit each expense account for its year-end debit balance;
- post the resulting profit to retained earnings as a credit, or the resulting loss as a debit;
- remain balanced by construction;
- use only immutable journal-derived balances;
- carry exact year-end preparation provenance and fingerprint evidence.

The retained-earnings semantic mapping is an equity account and is tenant controlled.

## Period interaction

Year-end authorisation is an explicit exception to ordinary hard-closed-period posting because all periods must already be hard closed before the close can be authorised. The exception is restricted to the controlled `year_end_close` source type and the financial-year end date.

Ordinary source posting and ordinary journal reversal remain blocked by hard-close governance.

To correct a completed year-end close:

1. create an additive reversal of the closing journal under `finance.accounting.year_end.reverse`;
2. retain the original close and reversal evidence;
3. reopen the required accounting period(s) through Package 004M governance;
4. post additive correction evidence;
5. hard close the affected periods again;
6. prepare and separately authorise a new year-end close cycle.

## Permissions

Package 004O adds:

- `finance.accounting.year_end.prepare`
- `finance.accounting.year_end.authorise`
- `finance.accounting.year_end.reverse`

Owner and Administrator receive the mutation permissions by default. Accounting read authority remains governed by `finance.view` plus `finance.accounting.view`/`finance.manage` and retains explicit-deny precedence.

## Concurrency and lock order

Year-end prepare/authorise/reverse operations must follow the accounting mutation hierarchy:

1. active tenant/member authority;
2. organisation accounting mutex;
3. financial-year and period rows;
4. active year-end close/reversal evidence;
5. source journals and lines;
6. journal-number allocation;
7. new close/journal evidence.

The source fingerprint is re-derived under the transaction before authorisation. Concurrent posting/reopen/close operations therefore serialize on the organisation mutex and cannot make a previously checked preparation silently stale.

## Reporting integration

Package 004N currently reports cumulative revenue less cumulative expenses as unclosed earnings. After an active authorised Package 004O close journal takes effect, those revenue/expense accounts are zeroed by the closing journal and the value is represented by the retained-earnings equity account.

Reporting must continue to derive from journal lines rather than introducing persisted report balances.

## Deliberate exclusions

Package 004O does not introduce:

- statutory filing or statutory financial-statement presentation;
- dividends or reserves allocation;
- consolidation;
- cash-flow statements;
- budgets or forecasts;
- FX translation/revaluation;
- bank reconciliation;
- purchase-ledger/AP expansion;
- provider-specific accounting integrations.

## Release gate

Before release the package must include:

- migration validation on MySQL 8.4;
- generated accounting Kysely types with zero drift;
- year-end preparation/authorisation/reversal service coverage;
- separate-preparer/authoriser enforcement tests;
- all-periods-hard-closed tests;
- stale-fingerprint rejection tests;
- active-close idempotency and reversal/re-close tests;
- concurrent year-end-authorise versus period-reopen/post tests;
- bootstrap permission parity;
- Package 004N retained-earnings reporting integration;
- protected year-end close workspace;
- `svelte-check` with zero errors and zero warnings.
