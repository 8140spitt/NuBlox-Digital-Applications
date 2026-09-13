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

| Ref | Sub-function | V2 outcome |
| --- | --- | --- |
| F01.01 | Vision & purpose | Define the enduring purpose, desired future state and strategic horizon. |
| F01.02 | Environmental analysis | Maintain evidence-led internal and external factors, assumptions and implications. |
| F01.03 | Strategic planning | Evaluate choices and establish accountable strategic themes and objectives. |
| F01.04 | Business planning | Translate strategy into plans, investment, resources and initiatives. |
| F01.05 | Operating model | Define current-to-target capabilities, organisation, process, information, technology and ecosystem changes. |
| F01.06 | Goal & KPI management | Define measures, targets, authoritative actuals and corrective actions. |
| F01.07 | Strategic review | Review evidence and performance, record decisions and govern corrective action. |
| F01.08 | Scenario & foresight planning | Test assumptions and strategic resilience against alternative futures. |

## 2. Workspace architecture

The F01 landing page is for orientation and prioritisation. It shows the current strategy cycle, material progress across F01.01–F01.08, controlled strategy versions and the next meaningful action.

A strategy cycle is the persistent record context. It carries identity, horizon, version and lifecycle while users move through the eight sub-functions.

Focused create, amend, approve, review and revision actions use dedicated transaction surfaces. F01 must not become an everything-on-one-page command centre.

F01.02 and F01.03 are connected workspaces rather than disconnected screens. Environmental analysis is the governed source of evidence, factors and assumptions. Strategic planning consumes those records to form options, decisions, themes and objectives.

## 3. Canonical records

The following existing organisation-owned records remain canonical because their ownership, versioning and lifecycle semantics remain useful:

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

The legacy free-text `strategy_environment_factors.evidence_reference` remains physically present for migration compatibility but is not the V2 source-of-truth relationship for newly created environmental factors.

## 4. Strategy lifecycle

The current canonical strategy-version lifecycle is:

```text
Draft → Approved → Superseded
```

Draft strategy may be developed by authorised strategy managers. Approval is an explicit governed transition, not a generic status edit. Approved strategy is immutable enterprise evidence. Material changes require a controlled revision or new strategy cycle. Superseded versions remain preserved for historical and audit purposes.

All F01.02/F01.03 mutations re-check the framework lifecycle inside the database transaction. A client-visible button or an earlier permission check is never sufficient to make an approved strategy mutable.

## 5. Authority model

F01 uses the common effective-permission model:

- `strategy.view` — access F01 strategy information;
- `strategy.manage` — create and develop strategy records;
- `strategy.approve` — exercise controlled strategy approval authority.

Effective permission evaluation honours active role grants, member-specific allows/denies and access windows. A member deny overrides a role grant. Client-side visibility never replaces server-side authorisation.

## 6. Mutation and evidence standard

Business mutations use semantic HTML forms and named SvelteKit server actions with progressive enhancement. The server remains authoritative for authentication, tenant context, permission, validation and lifecycle rules.

Each material strategy mutation appends immutable audit evidence and an outbox event in the same database transaction as the business change.

Current V2 action keys include:

- `strategy.framework.create`;
- `strategy.evidence.create`;
- `strategy.environment-factor.create`;
- `strategy.assumption.create`;
- `strategy.option.create`;
- `strategy.option.decide`;
- `strategy.theme.create`;
- `strategy.objective.create`.

All actions are attributed to organisation, domain user and organisation member, with F01 sub-function metadata.

## 7. F01.02 evidence standard

Environmental analysis is governed by the following rules:

1. A new environmental factor must link to at least one structured evidence item.
2. Evidence records identify a durable source/reference, observation date and reliability score.
3. Environmental factors state both the analysis and the strategic implication; these are not the same field.
4. Likelihood, impact and confidence are explicit 1–5 judgements so materiality and uncertainty remain visible.
5. Assumptions are first-class records, not prose hidden inside an option or scenario. They carry confidence, review date and validation state.
6. Evidence remains evidence; the strategic implication belongs to the factor, not the source record.

This supports challenge, replacement of stale evidence and later strategic review without rewriting historical sources.

## 8. F01.03 choice and objective standard

Strategic planning is governed by the following rules:

1. A new strategic option must trace to at least one environmental factor or assumption.
2. Proposed options remain distinct from decisions. Selection or rejection is an explicit mutation with attributable rationale.
3. Rejected alternatives remain preserved as decision evidence.
4. Strategic themes are first-class outcome groupings rather than labels embedded in objective text.
5. A new objective must derive from at least one **selected** strategic option and must have a primary strategic theme.
6. Objective target dates must fall within the parent strategy horizon.
7. Objective hierarchy/cascade is explicit through a parent-objective relationship; it is not inferred from naming conventions.
8. Option, theme and objective lineage remains queryable so later F01.04–F01.08 records can inherit the same strategic context.

The V2 target is therefore not merely “record objectives”. It is to preserve **why the organisation chose those objectives**.

## 9. Cross-functional digital thread

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

The design target is drill-through from a strategic objective to its decision lineage, initiatives, funding, accountable people, delivery records, KPIs, authoritative actuals, risks, decisions and corrective actions.

## 10. Remaining V2 design gaps before F01 can be called World-Class complete

F01.02/F01.03 resolves the earlier gaps around strategy-wide assumptions, structured environmental evidence, first-class themes, objective lineage and objective hierarchy. The remaining major checkpoints are:

- explicit F02 governance decision/approval relationships and approval prerequisites;
- explicit F20 strategic risk/control relationships;
- richer F14 investment, budget and forecast links;
- F15 workforce/capacity links;
- F27 portfolio/programme/project handoff semantics;
- controlled revision workflow and approved-version carry-forward semantics for the new V2 traceability records;
- source-backed KPI actuals with drill-through;
- review decisions and corrective-action accountability;
- scenario comparison and sensitivity analysis;
- explicit assumption validation/challenge transactions and evidence retirement/replacement workflows;
- richer option evaluation methods where organisations need weighted criteria, investment appraisal or scenario-specific scoring.

These gaps are intentional design checkpoints, not permission to recreate V1 unchanged.

## 11. Delivered V2 slices

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

It does **not** claim all F01.01–F01.08 workflows are complete.

## 12. Completion test

F01 is not World-Class complete until an authorised executive or strategy practitioner can move from direction to evidence, choices, funded execution, operating-model consequences, performance, review and foresight without losing record context or traceability, and can drill from strategic outcome to authoritative downstream business evidence.
