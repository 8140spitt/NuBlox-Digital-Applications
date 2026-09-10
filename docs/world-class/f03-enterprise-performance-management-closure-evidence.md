# F03 — Enterprise Performance Management Closure Evidence

**Issue:** #136  
**Pull request:** #137  
**Status:** Merge candidate — closure is not complete until exact-head validation, merge, merged-`main` validation, issue closure and repository hygiene are all complete.

## Delivered business capability

F03 is implemented as one governed enterprise performance thread rather than a dashboard-only reporting feature:

`Approved F01 KPI → F03 performance framework → reporting period → authoritative KPI observation → governed performance pack → variance/root cause → corrective action → executive review → benchmark comparison → benefit measurement → audit/outbox evidence`

| Sub-function | Native implementation evidence |
| --- | --- |
| F03.01 — Performance framework | Versioned `strategy_performance_frameworks` with approved F01 KPI composition, cadence, scope, effective dates, owner, approval and controlled revision. |
| F03.02 — Performance reporting | Governed periods and versioned packs snapshot canonical `strategy_kpi_observations` within the reporting period; no duplicate KPI truth is created. |
| F03.03 — Variance management | Material variance cases carry cause category, root-cause evidence, impact, accountable owner, corrective actions, completion evidence and controlled closure. |
| F03.04 — Management review | Executive performance reviews reference approved packs and may link to F02 governance meeting/decision public IDs without duplicating governance records. |
| F03.05 — Benchmarking | Internal, external, peer, industry and target benchmarks retain provenance and comparable periods; comparisons require an observation inside the benchmark period. |
| F03.06 — Benefits realisation | Benefit register and measurements retain baseline, target, realised value, confidence, evidence and canonical source references; achievement respects target direction. |

## World-class control properties

- **Canonical facts:** F03 composes approved F01 KPI definitions and KPI observations. Performance packs snapshot those facts for reporting evidence instead of creating a second KPI ledger.
- **Version integrity:** an approved F03 framework may continue reporting against the exact F01 KPI version it approved after that KPI is superseded; new framework revisions can deliberately adopt newer KPI versions.
- **Period integrity:** pack construction accepts only observations whose `observed_on` lies within the governed reporting period.
- **Exact decimal control:** KPI variance, assessment, confidence and benefit-target comparisons use fixed-scale integer arithmetic over DECIMAL(24,8) values rather than JavaScript floating-point comparison.
- **Comparable benchmarking:** benchmark results require the same KPI and an observation inside the benchmark period.
- **Directional benefits:** benefits with reducing targets are achieved by reaching or going below target; increasing targets require reaching or exceeding target.
- **Tenant isolation and authority:** service commands require an active organisation actor and fail-closed strategy permissions; all repository reads/writes remain organisation-scoped.
- **Evidence:** F03 commands append audit events and transactional outbox events with function/sub-function metadata.
- **Digital thread:** project, governance, finance and other source-domain references are links to canonical records, not duplicated domain truth.

## Executable proof

- Authoritative MySQL migration: `database/migrations/20260910122500_enterprise_performance_management.sql`.
- Database-derived Kysely types are committed in `app/src/lib/server/db/generated/database.d.ts` and `strategy.d.ts`.
- Domain repository: `app/src/lib/server/strategy/enterprise-performance-repository.ts`.
- Domain service: `app/src/lib/server/strategy/enterprise-performance-service.ts`.
- Real-MySQL continuous-thread integration test: `app/src/lib/server/strategy/enterprise-performance.integration.test.ts`.
- Operator workspace: `/performance` via `app/src/routes/(app)/performance/`.
- Browser proof: `app/e2e/enterprise-performance.e2e.ts`.

## Release gate

F03 may be declared complete only when all of the following are true:

1. PR #137 exact-head **Complete System Validation** is green, including migration replay, generated-type drift, real-MySQL integration, type checking, unit/component tests, production build and Playwright.
2. All substantive PR review threads are resolved against the validated head.
3. PR #137 is merged to `main`.
4. **Complete System Validation** is green for the merged `main` commit.
5. Issue #136 is closed with the merge and validation evidence.
6. The feature branch is removed and the repository has no residual F03 pull request or temporary F03 maintenance workflow/script.

Until those conditions are satisfied this document records a merge candidate, not a completed release.
