# F04 — Corporate Development & M&A delivery plan

Issue: #138

## Outcome

Identify, evaluate, execute and integrate acquisitions, divestitures and strategic partnerships through one governed corporate-development control thread.

## Canonical scope

- F04.01 — Opportunity identification
- F04.02 — Valuation
- F04.03 — Due diligence
- F04.04 — Transaction management
- F04.05 — Integration
- F04.06 — Divestiture
- F04.07 — Strategic partnerships

## Architectural boundaries

1. F01 remains authoritative for enterprise strategy, objectives and strategic KPIs. F04 links opportunities and investment theses to those records; it does not recreate them.
2. F02 remains authoritative for governance bodies, delegated authority and governed decisions. F04 transaction gates reference F02 decisions where approval is required.
3. F03 remains authoritative for enterprise performance and benefits-realisation evidence. F04 links expected synergies and outcomes to F03 rather than creating a parallel KPI/benefits system.
4. CRM remains authoritative for canonical organisations/contacts and commercial relationship facts. F04 may reference a target/partner source record and snapshot deal-specific names where necessary for transaction evidence.
5. Finance remains authoritative for posted financial actuals, accounting and tax facts. F04 valuation owns deal assumptions, methods, scenarios and investment-case outputs only.
6. D6 document management remains authoritative for files/evidence. F04 due diligence owns request/finding/index semantics and references canonical documents rather than storing duplicate files.
7. D5 remains authoritative for project/programme delivery identity and state. F04 integration owns transaction integration intent/workstreams and links delivery execution to D5.
8. Workforce/HR remains authoritative for people/employment truth. F04 diligence/integration records deal-specific workforce findings and source references only.

## Tranche A — F04.01 + F04.02

### Proposed canonical records

- `corporate_development_opportunities`
- `corporate_development_opportunity_stage_history`
- `corporate_development_valuations`
- `corporate_development_valuation_scenarios`
- `corporate_development_valuation_assumptions`

### Required behaviour

- governed opportunity pipeline with unique public ID/code, deal type, target/partner, thesis, strategic rationale, accountable owner, source provenance, priority, stage, status and key dates;
- controlled stage transitions with attributable history and correction semantics;
- optional F01 strategy/objective/KPI references and F03 performance evidence references;
- versioned valuation cases per opportunity;
- valuation method, currency, valuation date, enterprise/equity value ranges and recommendation;
- scenario modelling for base/upside/downside and other governed scenarios;
- typed assumptions with units, values, sources, confidence and rationale;
- sensitivity-ready inputs without duplicating Finance actuals;
- approval/freeze lifecycle for valuation versions;
- organisation scope, fail-closed permissions, audit and outbox evidence.

### Proof

- real-MySQL integration tests for tenant isolation, lifecycle, stage history, valuation versioning, assumptions/scenarios, source linkage and failure paths;
- browser E2E from opportunity creation through a governed valuation case in the Corporate Development command centre.

## Tranche B — F04.03 + F04.04

### Proposed canonical records

- `corporate_development_diligence_workstreams`
- `corporate_development_diligence_requests`
- `corporate_development_diligence_findings`
- `corporate_development_transactions`
- `corporate_development_transaction_terms`
- `corporate_development_transaction_milestones`
- `corporate_development_transaction_conditions`

### Required behaviour

- diligence workstreams across finance/tax, legal/commercial, compliance/QHSE, workforce, technology/data and operational domains;
- requests with owner, due date, materiality, status, evidence/document references and response provenance;
- findings/risks with severity, impact, recommendation, resolution and transaction implication;
- information-room index semantics that reference D6 document truth;
- transaction record with structure, consideration, key terms, milestones, conditions precedent/subsequent and closing evidence;
- F02 decision/meeting/DoA references for governed gates;
- complete opportunity → valuation → diligence → finding → approval → transaction drill-through.

## Tranche C — F04.05 + F04.06 + F04.07

### Proposed canonical records

- `corporate_development_integration_plans`
- `corporate_development_integration_workstreams`
- `corporate_development_divestiture_plans`
- `corporate_development_separation_obligations`
- `corporate_development_partnerships`
- `corporate_development_partnership_commitments`
- `corporate_development_partnership_reviews`

### Required behaviour

- integration plans with Day 1/Day 100/end-state outcomes, accountable workstreams, dependencies, milestones and D5 delivery references;
- synergy/benefit references into F03 with no duplicate benefit truth;
- divestiture perimeter, carve-out/separation plan, TSA/transition obligations, buyer/recipient references and completion evidence;
- strategic partnership objectives, structure, governance, commitments, economics/source references, review cadence and renewal/termination lifecycle;
- cross-domain evidence and attributable closure.

## UX

Create a dedicated **Corporate Development** command centre, distinct from Strategy, Governance and Enterprise Performance but linked to their canonical records.

The workspace should expose:

- pipeline and stage funnel;
- opportunity/investment thesis workspace;
- valuation cases and scenarios;
- diligence workstreams, requests and material findings;
- transaction gates, conditions and approvals;
- integration/divestiture control views;
- strategic partnership register/reviews;
- source evidence and digital-thread drill-through.

## Continuous enterprise thread

`Strategy / market signal → Opportunity → Valuation / business case → Due diligence → Finding / risk → F02 governed approval → Transaction / conditions → Close → Integration or divestiture → F03 benefit/performance evidence → Review / closure`

## Closure gate

F04 is complete only when all seven sub-functions have canonical records/services and working UX, authoritative cross-domain reuse is proven, permissions/audit/outbox are fail-closed and attributable, real-MySQL and browser E2E pass, capability/SAP benchmark evidence is updated, exact-head Complete System Validation is green, merged-main Complete System Validation is green, issue #138 is closed, the feature branch is deleted and no residual PR/branch remains.