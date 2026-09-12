# F05 — Product, Service & Innovation Management delivery plan

Issue: #140

## Outcome

Create, launch, improve and retire products/services through one governed lifecycle that preserves strategy, customer need, design, investment, delivery, launch, live performance and retirement evidence.

## Canonical scope

- F05.01 — Portfolio strategy
- F05.02 — Market/customer needs
- F05.03 — Product/service ideation
- F05.04 — Business case development
- F05.05 — Product/service design
- F05.06 — Development
- F05.07 — Launch management
- F05.08 — Lifecycle management
- F05.09 — Product retirement
- F05.10 — Innovation management

## Architectural boundaries

1. F01 remains authoritative for enterprise strategy, objectives and strategic KPIs. F05 portfolio theses and initiatives link to F01 records rather than recreating strategy.
2. F02 remains authoritative for governance bodies, delegated authority and governed decisions. F05 stage gates and major lifecycle/retirement decisions reference F02 evidence.
3. F03 remains authoritative for enterprise performance and benefits-realisation evidence. F05 uses F03 benefit/performance evidence for investment, lifecycle and retirement decisions.
4. CRM remains authoritative for customers, organisations, contacts and commercial relationship facts. F05 owns need/insight semantics and source references, not duplicate customer masters.
5. Finance remains authoritative for posted actuals, accounting and tax. F05 business cases own initiative-specific assumptions, scenarios, expected costs/value and decision evidence only.
6. D6 Information/Document Management remains authoritative for files and controlled documents. F05 owns requirements/design/release/retirement index semantics and references canonical documents.
7. D5 Project & Portfolio Management remains authoritative for execution projects/programmes. F05 development and launch records may link to D5 delivery rather than duplicating project schedules.
8. D11 Manufacturing/MRP and D10 Inventory/Logistics remain authoritative for production, material and stock execution. F05 owns product/service lifecycle intent, readiness and release semantics.
9. D17 Customer/Field Service remains authoritative for service cases, aftercare and operational service evidence. F05 lifecycle management consumes those signals for improvement/retirement decisions.
10. Workforce remains authoritative for people/employment truth. F05 records accountable members and readiness responsibilities only.

## Tranche A — F05.01 to F05.04

### Proposed canonical records

- `product_service_portfolios`
- `product_service_portfolio_items`
- `product_service_needs`
- `product_service_ideas`
- `product_service_idea_scores`
- `product_service_business_cases`
- `product_service_business_case_scenarios`
- `product_service_business_case_assumptions`

### Required behaviour

- governed product/service portfolio with portfolio code/title, category, strategic thesis, accountable owner, priority model, lifecycle status and F01 references;
- portfolio items representing products, services and governed innovation initiatives without duplicating manufacturing/service execution records;
- attributable market/customer/operational needs with source provenance, CRM references, evidence references, importance, urgency and lifecycle state;
- idea funnel with source need, hypothesis, proposed value, owner, stage, duplicate/related-idea reference and triage evidence;
- repeatable scoring dimensions for desirability, viability, feasibility, strategic fit, risk and confidence;
- versioned business cases with currency, expected cost/value, benefit, risk, recommendation, F01/F03 links and approval/supersession semantics;
- scenario and assumption records with source provenance and confidence;
- organisation scope, fail-closed permissions, audit and outbox evidence.

### Proof

- real-MySQL integration tests for tenant isolation, portfolio ownership, need provenance, idea triage, scoring, business-case versioning and failure paths;
- browser E2E from portfolio/item creation through need → idea → business case in the Product, Service & Innovation command centre.

## Tranche B — F05.05 to F05.07

### Proposed canonical records

- `product_service_requirements`
- `product_service_design_baselines`
- `product_service_design_items`
- `product_service_development_releases`
- `product_service_release_requirements`
- `product_service_stage_gates`
- `product_service_launch_plans`
- `product_service_launch_readiness_items`

### Required behaviour

- controlled requirement statements linked to needs, acceptance criteria, priority, source and D6 evidence;
- versioned design baselines with document/model references and supersession semantics;
- development/release increments with release intent, linked requirements, D5 execution references and D10/D11 operational references where applicable;
- explicit F02-linked stage gates for investment/design/release/launch decisions;
- launch plan and readiness controls across commercial, operations, supply chain, service/support, training, information/data, quality/compliance and communications;
- release and launch evidence frozen at approved/go-live states.

## Tranche C — F05.08 to F05.10

### Proposed canonical records

- `product_service_lifecycle_reviews`
- `product_service_improvements`
- `product_service_retirement_plans`
- `product_service_retirement_impacts`
- `innovation_experiments`
- `innovation_experiment_observations`
- `innovation_investment_decisions`

### Required behaviour

- periodic lifecycle reviews that consume F03 performance/benefit evidence, CRM/customer insight and D17 service evidence;
- controlled improvement backlog with source signal, priority, decision and release linkage;
- retirement/deprecation plan with F02 decision reference, customer/contract/inventory/service/data/document impacts, transition milestones and closure evidence;
- innovation experiments with explicit hypotheses, measures, constraints, learning and outcome;
- investment/stop/pivot/scale decisions that convert validated experiments into governed portfolio items/ideas/business cases;
- complete need → idea → business case → design → release → launch → lifecycle → retirement digital thread.

## UX

Create a dedicated **Product, Service & Innovation** command centre, distinct from Strategy, CRM, Projects, Manufacturing and Service but linked to their canonical records.

The workspace should expose:

- portfolio health and lifecycle distribution;
- needs/insights register;
- idea and innovation funnel;
- business cases and investment gates;
- requirements/design baselines;
- development/release readiness;
- launch plans/readiness;
- live lifecycle reviews and improvement backlog;
- retirement plans and impacts;
- innovation experiments and learning;
- source evidence and digital-thread drill-through.

## Continuous enterprise thread

`Strategy / customer need / operational problem → Portfolio thesis → Need → Idea → Triage / scoring → Business case → F02 governed stage gate → Requirement / design baseline → Development / release → Launch readiness → Go-live → F03/D17 lifecycle evidence → Improvement / innovation → Retirement decision → Controlled withdrawal / retained knowledge`

## Closure gate

F05 is complete only when all ten sub-functions have canonical records/services and working UX, authoritative cross-domain reuse is proven, permissions/audit/outbox are fail-closed and attributable, real-MySQL and browser E2E pass, capability/SAP benchmark evidence is updated, exact-head Complete System Validation is green, merged-main Complete System Validation is green, issue #140 is closed, the feature branch is deleted and no residual PR/branch remains.
