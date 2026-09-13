# 15 — F01 Strategy & Enterprise Planning V2

**Status:** Governing F01 V2 product and domain architecture  
**Effective:** 13 September 2026  
**Scope:** F01.01–F01.08 in NuBlox V2.

## Purpose

F01 turns enterprise direction into governed, funded and measurable outcomes. It is one management system, not eight disconnected applications.

```text
Direction
  → environmental evidence
  → strategic choices
  → objectives
  → business plan / resource envelope
  → initiatives
  → target operating model
  → goals / KPIs / authoritative actuals
  → strategic review / decisions / corrective action
  → scenarios / foresight
  → controlled revision
```

The historical V1 F01 implementation is evidence and a source of reusable domain logic. Its prior completion status does not make it the V2 product design and does not constrain V2 information architecture or workflow design.

## 1. Canonical sub-functions

| Ref | Sub-function | V2 outcome |
| --- | --- | --- |
| F01.01 | Vision & purpose | Define the enduring purpose, desired future state and strategic horizon. |
| F01.02 | Environmental analysis | Maintain evidence-led internal and external factors, assumptions and implications. |
| F01.03 | Strategic planning | Evaluate choices and establish accountable strategic objectives. |
| F01.04 | Business planning | Translate strategy into plans, investment, resources and initiatives. |
| F01.05 | Operating model | Define current-to-target capabilities, organisation, process, information, technology and ecosystem changes. |
| F01.06 | Goal & KPI management | Define measures, targets, authoritative actuals and corrective actions. |
| F01.07 | Strategic review | Review evidence and performance, record decisions and govern corrective action. |
| F01.08 | Scenario & foresight planning | Test assumptions and strategic resilience against alternative futures. |

## 2. Workspace architecture

The F01 landing page is for orientation and prioritisation. It shows the current strategy cycle, material progress across F01.01–F01.08, controlled strategy versions and the next meaningful action.

A strategy cycle is the persistent record context. It carries identity, horizon, version and lifecycle while users move through the eight sub-functions.

Focused create, amend, approve, review and revision actions must use dedicated transaction surfaces. F01 must not become an everything-on-one-page command centre.

## 3. Canonical records retained from the existing domain model

The following existing organisation-owned records are retained initially because their ownership, versioning and lifecycle semantics remain useful:

- `strategy_frameworks`;
- `strategy_environment_factors`;
- `strategy_options`;
- `strategy_objectives`;
- `strategy_business_plans`;
- `strategy_initiatives` and initiative milestones/dependencies;
- `strategy_operating_model_components` and accountabilities;
- `strategy_kpis`, observations and corrective actions;
- `strategy_reviews` and review KPI snapshots;
- `strategy_scenarios`, assumptions and KPI projections.

Retention of these records is not a decision to preserve old UI, service or workflow design. Each record and relationship remains subject to V2 review as the corresponding sub-function is built.

## 4. Strategy lifecycle

The current canonical strategy-version lifecycle is:

```text
Draft → Approved → Superseded
```

Draft strategy may be developed by authorised strategy managers. Approval is an explicit governed transition, not a generic status edit. Approved strategy is immutable enterprise evidence. Material changes require a controlled revision or new strategy cycle. Superseded versions remain preserved for historical and audit purposes.

## 5. Authority model

F01 uses the common effective-permission model from the first V2 slice:

- `strategy.view` — access F01 strategy information;
- `strategy.manage` — create and develop strategy records;
- `strategy.approve` — exercise controlled strategy approval authority.

Effective permission evaluation honours active role grants, member-specific allows/denies and access windows. A member deny overrides a role grant. Client-side visibility never replaces server-side authorisation.

## 6. Mutation and evidence standard

Business mutations use semantic HTML forms and named SvelteKit server actions with progressive enhancement. The server remains authoritative for authentication, tenant context, permission, validation and lifecycle rules.

Each material strategy mutation must append immutable audit evidence and an outbox event in the same database transaction as the business change.

The initial V2 action is `strategy.framework.create`, attributed to the organisation, domain user and organisation member, with F01 metadata.

## 7. Cross-functional digital thread

F01 owns strategic intent and planning records but must not copy records owned elsewhere.

Target integration boundaries include:

- **F02 Corporate Governance** — authority, formal decisions and approvals;
- **F03 Enterprise Performance Management** — enterprise performance frameworks and performance interpretation;
- **F14 Finance** — budgets, forecasts and authoritative financial actuals;
- **F15 Human Capital** — workforce and capacity consequences;
- **F20 Risk, Compliance, Internal Control & Audit** — strategic risks, controls and assurance;
- **F27 Portfolio, Programme & Project Management** — governed delivery of strategic initiatives;
- **F28 Change & Transformation** — managed organisational change and benefits realisation;
- **F29 Business Process & Continuous Improvement** — operating-model and process improvement.

The design target is drill-through from a strategic objective to its initiatives, funding, accountable people, delivery records, KPIs, authoritative actuals, risks, decisions and corrective actions.

## 8. Known V2 design gaps to resolve before F01 can be called World-Class complete

The inherited model does not yet prove every target capability. V2 must explicitly assess and, where needed, introduce:

- first-class strategic themes and objective hierarchy/cascade;
- a strategy-wide assumption register beyond scenario-specific assumptions;
- structured evidence relationships rather than free-text evidence references;
- explicit F02 governance decision/approval relationships;
- explicit F20 strategic risk/control relationships;
- richer F14 investment, budget and forecast links;
- F15 workforce/capacity links;
- F27 portfolio/programme/project handoff semantics;
- controlled revision workflow and approval prerequisites;
- source-backed KPI actuals with drill-through;
- review decisions and corrective-action accountability;
- scenario comparison and sensitivity analysis.

These gaps are intentional design checkpoints, not permission to recreate V1 unchanged.

## 9. Initial V2 slice

The first V2 F01 slice establishes:

- tenant-scoped F01 routes;
- effective server-side strategy permissions;
- F01 landing workspace and no-strategy state;
- a focused create-strategy form using a named server action and progressive enhancement;
- transactional audit/outbox evidence for strategy creation;
- a governed strategy record workspace;
- visible F01 activation in the enterprise-function directory;
- route-contract regression tests.

It does **not** claim all F01.01–F01.08 workflows are complete. Subsequent slices will build those sub-functions against this architecture, improving shared design-system patterns before adding one-off UI.

## 10. Completion test

F01 is not World-Class complete until an authorised executive or strategy practitioner can move from direction to evidence, choices, funded execution, operating-model consequences, performance, review and foresight without losing record context or traceability, and can drill from strategic outcome to authoritative downstream business evidence.
