# F03 — Enterprise Performance Management delivery plan

**Status:** Active delivery plan  
**Tracking issue:** #136  
**Canonical function:** F03 — Enterprise Performance Management

## Outcome

NuBlox must allow a sophisticated enterprise to measure performance, explain material variance, govern corrective decisions, compare performance against relevant benchmarks and prove whether strategic/programme benefits were actually realised.

F03 is a management-control capability, not a duplicate KPI or accounting subsystem. It consumes authoritative records from F01 strategy/KPI management, Finance and operational domains, and D5 project/portfolio management, then governs the enterprise performance loop in D8/D19.

## Canonical sub-functions

| ID | Sub-function | Primary composition |
| --- | --- | --- |
| F03.01 | Performance framework | D8, D19 |
| F03.02 | Performance reporting | D8, D19 |
| F03.03 | Variance management | D8, D19 |
| F03.04 | Management review | D8, D19 |
| F03.05 | Benchmarking | D8, D19 |
| F03.06 | Benefits realisation | D8, D5, D19 |

## Architectural boundaries

1. **F01 remains authoritative for strategic objectives, KPI definitions and governed targets.** F03 references those records; it does not fork them.
2. **Finance and operational domains remain authoritative for actual transactions and operational facts.** F03 resolves, snapshots where auditably necessary, and drills through to sources.
3. **D5 remains authoritative for programme/project/portfolio identity and delivery state.** F03 owns benefits hypotheses, measurement and realisation evidence linked to those records.
4. **F02 remains authoritative for corporate governance bodies, delegation of authority and governed decisions.** F03 management reviews can invoke F02 decision authority when escalation/approval is required.
5. F03 corrective actions may use shared work/action infrastructure, but performance variance/root-cause state remains owned by the F03 service.

## Continuous enterprise thread

`Objective / canonical KPI → Performance framework → Reporting period → Authoritative actual → Performance pack → Material variance → Root cause → Corrective action → Management review → Governed decision (when required) → Benchmark comparison → Benefit realisation → Evidence / closure`

## Tranche A — Performance framework and reporting

Deliver F03.01 and F03.02.

### Canonical records

- `performance_framework`
- `performance_framework_version`
- `performance_framework_metric`
- `performance_reporting_period`
- `performance_pack`
- `performance_pack_metric`

### Required behaviours

- versioned framework with draft/approved/superseded lifecycle;
- reporting cadence and organisation scope;
- accountable owner;
- KPI composition by canonical public/source ID rather than copied KPI truth;
- governed reporting periods;
- performance-pack generation/freeze semantics;
- authoritative actual resolution with source provenance;
- target/actual/forecast/status presentation;
- threshold evaluation with direction-aware KPI semantics;
- attributable management commentary;
- source drill-through;
- fail-closed organisation permissions;
- audit/outbox evidence.

### Proof

- real-MySQL integration tests for lifecycle, tenant isolation, source resolution and failure paths;
- browser E2E from framework creation through approved performance pack with canonical actual drill-through.

## Tranche B — Variance and management review

Deliver F03.03 and F03.04.

### Canonical records

- `performance_variance`
- `performance_variance_analysis`
- `performance_corrective_action`
- `performance_review`
- `performance_review_item`

### Required behaviours

- material variance detection using approved framework thresholds;
- favourable/adverse direction and amount/percentage variance;
- cause category, root-cause narrative, impact and accountable owner;
- corrective action with due date, evidence and closure state;
- management-review lifecycle and immutable review snapshot;
- escalation to F02 governance decision where delegated authority/approval is required;
- decision/action references without duplicating F02 truth;
- full drill-through KPI → source actual → variance → root cause → action → review/decision.

## Tranche C — Benchmarking and benefits realisation

Deliver F03.05 and F03.06.

### Canonical records

- `performance_benchmark`
- `performance_benchmark_observation`
- `performance_benchmark_comparison`
- `benefit`
- `benefit_measure`
- `benefit_realisation_observation`
- `benefit_review`

### Required behaviours

- internal/external benchmark type and provenance;
- comparable scope, period, unit and KPI linkage;
- gap calculation and management interpretation;
- benefit definition linked to canonical D5 initiative/programme/project or other source record;
- baseline, target, expected date, owner and measurement method;
- realised value observations with evidence/provenance;
- confidence/status and variance to benefit target;
- corrective review/actions for off-track benefits;
- portfolio/project → benefit → KPI → source evidence digital thread.

## UX operating surface

Create a dedicated **Enterprise Performance** workspace that is deliberately distinct from the F01 Strategy workspace while linking back to canonical F01 records.

The workspace should expose:

- current performance framework and reporting cadence;
- period selector and governed performance packs;
- KPI status board with source provenance;
- material variance inbox;
- corrective actions and management review queue;
- benchmark comparisons;
- benefits register and realisation dashboard;
- evidence/drill-through on every material claim.

## World-class acceptance gate

F03 can close only when:

1. all F03.01–F03.06 capabilities are implemented as native NuBlox records/services;
2. F01 KPI/target truth is reused rather than copied;
3. authoritative finance/operational actuals have source provenance and drill-through;
4. variance/root-cause/corrective-action lifecycle is explicit and attributable;
5. management review integrates with F02 decision authority where required;
6. benchmarking is provenance-aware and comparison-safe;
7. benefits realisation links to D5 delivery truth and measurable evidence;
8. organisation scope, permissions, audit and outbox semantics fail closed;
9. real-MySQL and browser E2E prove the complete enterprise performance thread;
10. function-capability and SAP benchmark evidence are updated;
11. Complete System Validation is green on the exact PR head and again on merged `main`.

Do not begin F04 delivery until these gates are met or an explicit programme decision records an intentional deferral.
