# 15 — F01 Strategy & Enterprise Planning V2

**Status:** Governing F01 V2 product and domain architecture  
**Effective:** 13 September 2026  
**Scope:** F01.01–F01.08 in NuBlox V2.

## Purpose

F01 turns enterprise direction into governed, funded and measurable outcomes. It is one management system, not eight disconnected applications.

```text
Direction
  → environmental evidence
  → strategic factors and implications
  → assumptions
  → strategic choices
  → themes and objectives
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

| Ref    | Sub-function                  | V2 outcome                                                                                                   |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| F01.01 | Vision & purpose              | Define the enduring purpose, desired future state and strategic horizon.                                     |
| F01.02 | Environmental analysis        | Maintain evidence-led internal and external factors, assumptions and implications.                           |
| F01.03 | Strategic planning            | Evaluate choices and establish accountable strategic themes and objectives.                                  |
| F01.04 | Business planning             | Translate strategy into plans, investment, resources and initiatives.                                        |
| F01.05 | Operating model               | Define current-to-target capabilities, organisation, process, information, technology and ecosystem changes. |
| F01.06 | Goal & KPI management         | Define measures, targets, authoritative actuals and corrective actions.                                      |
| F01.07 | Strategic review              | Review evidence and performance, record decisions and govern corrective action.                              |
| F01.08 | Scenario & foresight planning | Test assumptions and strategic resilience against alternative futures.                                       |

## 2. Workspace architecture

The F01 landing page is for orientation and prioritisation. It shows the current strategy cycle, material progress across F01.01–F01.08, controlled strategy versions and the next meaningful action.

A strategy cycle is the persistent record context. It carries identity, horizon, version and lifecycle while users move through the eight sub-functions.

Focused create, amend, approve, review and revision actions use dedicated transaction surfaces. F01 must not become an everything-on-one-page command centre.

The strategy-cycle route now provides persistent local navigation across the implemented F01 workspaces so record context is not lost while moving from environmental analysis to strategic planning, business planning, performance and review.

## 3. Canonical records

The following organisation-owned records remain canonical because their ownership, versioning and lifecycle semantics remain useful:

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

V2 F01.02/F01.03 adds first-class records and relationships required for evidence-to-choice traceability:

- `strategy_evidence_items` — structured, attributable evidence sources with observation/publication dates and reliability scoring;
- `strategy_environment_factor_evidence_links` — explicit factor-to-evidence relationships;
- `strategy_assumptions` — strategy-wide assumptions with confidence, review dates and validation state;
- `strategy_option_factor_links` — environmental drivers for strategic options;
- `strategy_option_assumption_links` — assumption dependencies/tests for strategic options;
- `strategy_themes` — first-class strategic outcome themes;
- `strategy_objective_option_links` — decision lineage from selected options to objectives;
- `strategy_objective_theme_links` — primary/secondary theme relationships;
- `strategy_objectives.parent_strategy_objective_id` — controlled objective hierarchy/cascade;
- `strategy_environment_factors.implication_text` and `confidence_score` — explicit strategic consequence and confidence.

V2 F01.04/F01.06/F01.07 adds execution and management-loop traceability:

- `strategy_business_plan_objective_links` — explicit primary/supporting objective scope for each business plan;
- `strategy_initiative_resource_requirements` — quantified funding, workforce, capacity, technology, asset, supplier or other execution demand;
- `strategy_initiative_handoffs` — explicit transfer of a planning request to the business function that must own the canonical downstream record;
- `strategy_initiative_kpi_links` — explicit initiative contribution to strategic outcome measures;
- `strategy_review_decisions` — structured review decisions/corrective actions linked to the review and optionally to an objective, initiative or KPI.

The legacy free-text `strategy_environment_factors.evidence_reference` remains physically present for migration compatibility but is not the V2 source-of-truth relationship for newly created environmental factors.

## 4. Lifecycle and governance

The canonical strategy-version lifecycle is:

```text
Draft → Approved → Superseded
```

Draft strategy may be developed by authorised strategy managers. Strategy approval is an explicit governed transition and requires at least one active objective retaining selected-option lineage and a primary theme. Objectives created while a strategy is draft remain draft working records. Strategy approval validates their decision lineage and activates draft objectives in the same governed transaction. Approved strategy is immutable enterprise evidence. Material change requires a controlled revision or new strategy cycle.

F01.04 planning begins from an approved strategy. Business plans use:

```text
Draft → Approved → Superseded
```

Business-plan approval requires strategic-objective scope, at least one active initiative, and no identified resource demand left orphaned without an execution handoff. Proposed initiatives are governed as approved execution commitments when their business plan is approved.

KPI definitions use `Draft → Approved → Superseded/Retired`. Actual observations can only be recorded against an approved KPI definition. Strategic reviews use `Draft → Approved`; approval freezes the review as enterprise evidence rather than turning meeting notes into mutable history.

Server-side mutations re-check lifecycle inside the database transaction. A client-visible button or an earlier permission check is never sufficient authority.

## 5. Authority model

F01 uses the common effective-permission model:

- `strategy.view` — access F01 strategy information;
- `strategy.manage` — create and develop strategy/planning/performance/review records;
- `strategy.approve` — exercise controlled strategy, business-plan, KPI and review approval authority.

Effective permission evaluation honours active role grants, member-specific allows/denies and access windows. A member deny overrides a role grant. Client-side visibility never replaces server-side authorisation.

## 6. Mutation and evidence standard

Business mutations use semantic HTML forms and named SvelteKit server actions with progressive enhancement. The server remains authoritative for authentication, tenant context, permission, validation and lifecycle rules.

Each material strategy mutation appends immutable audit evidence and an outbox event in the same database transaction as the business change.

Current V2 action keys include:

- `strategy.framework.create`;
- `strategy.framework.approve`;
- `strategy.evidence.create`;
- `strategy.environment-factor.create`;
- `strategy.assumption.create`;
- `strategy.option.create`;
- `strategy.option.decide`;
- `strategy.theme.create`;
- `strategy.objective.create`;
- `strategy.business-plan.create`;
- `strategy.business-plan.approve`;
- `strategy.initiative.create`;
- `strategy.resource-requirement.create`;
- `strategy.execution-handoff.request`;
- `strategy.kpi.create`;
- `strategy.kpi.approve`;
- `strategy.kpi-observation.record`;
- `strategy.review.create`;
- `strategy.review-decision.create`;
- `strategy.review.approve`.

All actions are attributed to organisation, domain user and organisation member, with F01 sub-function metadata.

## 7. F01.02 evidence standard

Environmental analysis is governed by the following rules:

1. A new environmental factor must link to at least one structured evidence item.
2. Evidence records identify a durable source/reference, observation date and reliability score.
3. Environmental factors state both the analysis and the strategic implication; these are not the same field.
4. Likelihood, impact and confidence are explicit 1–5 judgements so materiality and uncertainty remain visible.
5. Assumptions are first-class records, not prose hidden inside an option or scenario. They carry confidence, review date and validation state.
6. Evidence remains evidence; the strategic implication belongs to the factor, not the source record.

## 8. F01.03 choice and objective standard

Strategic planning is governed by the following rules:

1. A new strategic option must trace to at least one environmental factor or assumption.
2. Proposed options remain distinct from decisions. Selection or rejection is an explicit mutation with attributable rationale.
3. Rejected alternatives remain preserved as decision evidence.
4. Strategic themes are first-class outcome groupings rather than labels embedded in objective text.
5. A new objective must derive from at least one **selected** strategic option and must have a primary strategic theme.
6. Objective target dates must fall within the parent strategy horizon.
7. Objective hierarchy/cascade is explicit through a parent-objective relationship; it is not inferred from naming conventions.
8. Option, theme and objective lineage remains queryable so F01.04–F01.08 records inherit the same strategic context.

## 9. F01.04 business-planning and execution standard

F01.04 does not create shadow Finance, HCM or Project records.

1. Business planning is only opened against an approved strategy version.
2. A business plan must explicitly identify the strategic objectives it serves.
3. Initiative dates must fit inside the plan period and every initiative must contribute to an objective scoped into that plan.
4. Investment and FTE values on an initiative are planning demand, not authoritative budget or workforce commitments.
5. Material resource demand is represented as a quantified requirement with a target enterprise function.
6. A cross-functional handoff is a governed request. It remains `requested` until the receiving function accepts/rejects it and, where applicable, returns its canonical record reference.
7. The downstream function owns the operational record. F01 retains only the link required for strategic traceability.
8. Business-plan approval is blocked when resource requirements remain identified but have never been handed to an authoritative function.

The intended handoff examples are F14 funding/budget, F15 workforce/capacity, F27 portfolio/programme/project delivery, F20 risk, F09 procurement, F16 technology and F28 change.

## 10. F01.06 performance standard

1. A KPI definition belongs to an active strategic objective and starts as draft.
2. Initiative-to-KPI links express execution contribution; they do not change KPI ownership.
3. KPI approval is separately authorised from KPI creation.
4. Actual observations can only be recorded against an approved KPI definition.
5. Manual observations are explicitly attributable evidence and remain distinguishable from canonical source-backed actuals.
6. The target state for financial, workforce, project and other domain measures is authoritative source integration with drill-through rather than re-keying.

## 11. F01.07 strategic-review standard

1. A strategic review requires at least one approved KPI with an actual observation on or before the review date.
2. Review creation freezes the latest available KPI evidence into `strategy_review_kpis`; later observations do not rewrite the historical evidence set.
3. Review decisions are first-class records, not prose embedded in the review summary.
4. Decision types explicitly distinguish continue, accelerate, rephase, pause, stop, revise strategy, revise plan and corrective action.
5. Decisions may link to the objective, initiative or KPI affected and carry an accountable owner and due date.
6. Review approval freezes the review as governed enterprise evidence.

## 12. Cross-functional digital thread

F01 owns strategic intent and orchestration but must not copy records owned elsewhere.

Target integration boundaries include:

- **F02 Corporate Governance** — authority, formal decisions and approvals;
- **F03 Enterprise Performance Management** — enterprise performance frameworks and interpretation;
- **F14 Finance** — budgets, forecasts and authoritative financial actuals;
- **F15 Human Capital** — workforce and capacity commitments/actuals;
- **F20 Risk, Compliance, Internal Control & Audit** — strategic risks, controls and assurance;
- **F27 Portfolio, Programme & Project Management** — governed delivery records for strategic initiatives;
- **F28 Change & Transformation** — managed organisational change and benefits realisation;
- **F29 Business Process & Continuous Improvement** — operating-model and process improvement.

The current F01.04 handoff model establishes the request/traceability boundary without pretending those downstream capabilities are already implemented in V2. Acceptance/rejection and canonical record creation belong to the receiving functions as they are built.

## 13. Remaining V2 design gaps before F01 can be called World-Class complete

The major remaining checkpoints are:

- explicit F02 governance decision/approval relationships beyond the F01 permission gate;
- explicit F20 strategic risk/control relationships;
- receiving-side acceptance/rejection and canonical record creation for F14/F15/F27 and other F01.04 handoffs;
- source-backed KPI actual adapters with drill-through to authoritative records;
- controlled completion/cancellation of structured review decisions and propagation to downstream change records;
- F01.05 operating-model workspace in V2 with initiative-to-target-state traceability;
- F01.08 scenario comparison, sensitivity analysis and assumption stress testing;
- controlled strategy revision and approved-version carry-forward semantics for all new V2 traceability records;
- explicit assumption validation/challenge transactions and evidence retirement/replacement workflows;
- richer option evaluation where organisations need weighted criteria, investment appraisal or scenario-specific scoring;
- benefit-realisation linkage between strategic objectives, initiatives, performance and F28 transformation records.

These gaps are intentional design checkpoints, not permission to recreate V1 unchanged.

## 14. Delivered V2 slices

### Slice 1 — strategy-cycle foundation

- tenant-scoped F01 routes;
- effective server-side strategy permissions;
- F01 landing workspace and no-strategy state;
- focused create-strategy transaction;
- transactional audit/outbox evidence for strategy creation;
- governed strategy record workspace;
- visible F01 activation in the enterprise-function directory;
- route-contract regression tests.

### Slice 2 — F01.02/F01.03 evidence-to-choice

- structured evidence ledger with source and reliability metadata;
- environmental factors that require evidence and explicit implications;
- strategy-wide assumption register;
- evidence/factor/assumption workspaces and focused creation surfaces;
- factor/assumption drivers for strategic options;
- explicit option selection/rejection with rationale;
- first-class strategic themes;
- objective hierarchy/cascade;
- objective creation gated by selected options and a primary theme;
- strategy-horizon validation for objective targets;
- tenant-first routes for environmental analysis and strategic planning;
- transactional audit/outbox evidence for every new F01.02/F01.03 mutation.

### Slice 3 — F01.04/F01.06/F01.07 execution-to-review

- governed strategy approval prerequisite before business planning;
- business plans explicitly scoped to strategic objectives;
- strategic initiatives bound to plan periods and scoped objectives;
- quantified execution resource requirements;
- cross-functional execution handoff requests without shadow downstream records;
- business-plan approval gate preventing orphan resource demand;
- governed KPI definitions with optional initiative contribution links;
- KPI approval and attributable actual observations;
- strategic-review creation with frozen KPI evidence snapshots;
- structured review decisions/corrective actions linked to objective, initiative and/or KPI;
- review approval as immutable enterprise evidence;
- persistent strategy-cycle navigation across implemented F01 workspaces;
- transactional audit/outbox evidence for material F01.04/F01.06/F01.07 mutations.

It does **not** claim all F01.01–F01.08 workflows are complete.

## 15. Completion test

F01 is not World-Class complete until an authorised executive or strategy practitioner can move from direction to evidence, choices, funded execution, operating-model consequences, performance, review and foresight without losing record context or traceability, and can drill from strategic outcome to authoritative downstream business evidence.
