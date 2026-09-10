# 12 — Enterprise Function → Native NuBlox Capability Map

**Status:** Governing operating-model crosswalk  
**Effective:** 6 September 2026  
**Scope:** all 29 enterprise functions and all 353 L2 sub-functions in the canonical enterprise taxonomy.

## Purpose

This map answers:

> **How does a sophisticated organisation carry out each enterprise function and sub-function using the one native NuBlox product?**

NuBlox does **not** implement 29 departmental modules. The 29-function taxonomy describes work the organisation performs; the 19 native capability domains describe where NuBlox owns records, rules, transactions and controls. A business function composes several domains through contextual workspaces.

```text
Enterprise function / sub-function
  → business outcome / value stream
  → contextual workspace/toolset
  → native domain-owned commands and canonical records
  → permissions / workflow / evidence
  → reporting, accounting and digital-thread consequences
```

**This is a target operating map, not a claim that all 353 sub-functions are already fully implemented.** Current delivery maturity remains governed by the executable capability registry and World-Class evidence.

## Native domain legend

| Code | Native NuBlox domain | Current maturity |
| --- | --- | --- |
| D1 | Enterprise, identity & master data | Operational |
| D2 | CRM, business development & customer management | Operational |
| D3 | Estimating, bidding, tendering, proposals & sales | Partial |
| D4 | Contracts, commercial management & revenue | Partial |
| D5 | Portfolio, programme & project management | Partial |
| D6 | Design, engineering, BIM & information management | Partial |
| D7 | Finance & statutory accounting | Partial |
| D8 | Management accounting, planning, treasury & enterprise performance | Partial |
| D9 | Procurement, subcontracting & supplier management | Partial |
| D10 | Materials, inventory, warehouse, distribution & logistics | Planned |
| D11 | Production, fabrication & prefabrication | Planned |
| D12 | People, HCM, workforce & payroll | Partial |
| D13 | Site, field & construction operations | Partial |
| D14 | Quality, health, safety, environment & compliance | Partial |
| D15 | Plant, fleet, equipment & enterprise asset management | Partial |
| D16 | Property, real estate, estates & facilities | Partial |
| D17 | Service, maintenance, warranty & aftercare | Partial |
| D18 | Sustainability, carbon & environmental performance | Planned |
| D19 | Data, workflow, analytics, search & intelligence | Operational |

## Whole-enterprise function map

| Function | Business outcome | Native domains | Value streams | NuBlox operating surface |
| --- | --- | --- | --- | --- |
| **F01 — Strategy & Enterprise Planning** | Set direction, translate strategy into funded plans and measure/correct performance. | D8, D19, D1 | VS3, VS8 | Strategy & performance workspace; objectives/KPIs; plans, scenarios, budgets, reviews and governed actions |
| **F02 — Corporate Governance** | Govern the enterprise through explicit authority, policy, decisions, ethics and accountable actions. | D1, D19, D14 | VS3, VS9 | Organisation governance; decision/approval Work Kernel; policies, committees, audit trail and assurance evidence |
| **F03 — Enterprise Performance Management** | Measure enterprise performance, explain variance and drive corrective decisions. | D8, D19, D5 | VS3, VS8 | Enterprise performance, KPI/management reporting, variance/action workflows and benefits tracking |
| **F04 — Corporate Development & M&A** | Identify, evaluate, execute and integrate acquisitions, divestitures and strategic partnerships. | D8, D4, D1, D19 | VS3, VS8 | Native `/corporate-development` control thread: governed opportunity pipeline; versioned valuation and assumptions; due-diligence workstreams/requests/findings with evidence references; transactions/terms/milestones/conditions with F02 approval gates; integration and divestiture plans; strategic partnerships, commitments and reviews; F03 benefit/performance linkage. |
| **F05 — Product, Service & Innovation Management** | Create, launch, improve and retire products/services with controlled lifecycle evidence. | D6, D11, D10, D17, D19, D8 | VS3, VS6, VS7 | Product/service portfolio; requirements/design information; product/BOM/production; service lifecycle; innovation pipeline |
| **F06 — Marketing & Brand** | Understand markets, build brand/demand and convert engagement into qualified customer opportunities. | D2, D19, D6 | VS1, VS3 | CRM marketing audiences/leads; campaigns/content; events; brand assets and marketing analytics |
| **F07 — Sales & Commercial Management** | Develop accounts, win profitable work and convert sales commitments into governed contracts/revenue. | D2, D3, D4, D8, D19 | VS1, VS8 | CRM accounts/opportunities; estimates/tenders/quotes; contracts; sales forecasts/performance |
| **F08 — Customer Service, Experience & Success** | Onboard, support, retain and recover customer value through controlled service and experience processes. | D2, D17, D4, D19, D10, D7 | VS1, VS7, VS9 | Customer/account workspace; cases/service requests; returns/warranty; knowledge/SLA; credits/refunds |
| **F09 — Procurement & Supplier Management** | Source and manage suppliers, place controlled commitments and preserve procurement-to-payment traceability. | D9, D10, D7, D14, D19, D4 | VS2, VS8, VS9 | Supplier and procurement workspace; sourcing/RFQ; contracts/orders; supplier risk/performance; AP handoff |
| **F10 — Demand, Supply Chain & Logistics** | Plan and move materials reliably from demand through stock, logistics and delivery. | D10, D9, D11, D19, D14 | VS2, VS6, VS8 | Demand/material planning; inventory/warehouse; transport/distribution; import/export; supply-chain analytics |
| **F11 — Manufacturing / Production Operations** | Plan, execute and control manufacturing/fabrication with material, labour, quality and cost traceability. | D11, D10, D12, D14, D15, D19, D8 | VS6, VS4, VS8, VS9 | Production planning/scheduling; material staging; fabrication execution; quality; equipment/capacity; production analytics |
| **F12 — Service Delivery & Field Operations** | Plan, dispatch, execute and evidence professional/field services through acceptance and commercial consequence. | D17, D13, D12, D15, D4, D7, D19 | VS7, VS5, VS8, VS9 | Service/work-order workspace; scheduling/dispatch; field execution; acceptance; service quality/performance; billing consequence |
| **F13 — Quality Management** | Plan, assure, control and continuously improve quality with attributable evidence. | D14, D19, D6, D9, D10, D11, D13 | VS9, VS6, VS2, VS4 | Quality plans/ITPs; inspections/tests; NCR/CAPA; supplier quality; controlled quality records and analytics |
| **F14 — Finance, Accounting, Treasury & Tax** | Control cash and accounting consequences, close books and produce traceable statutory/management reporting. | D7, D8, D19 | VS8, VS1, VS2, VS3 | Finance/accounting; AP/AR/payments; ledger/periods/reporting; budgets/forecasts/treasury/performance |
| **F15 — Human Resources / Human Capital** | Plan, acquire, develop, deploy, pay and retain a competent workforce with cost and authority traceability. | D12, D1, D7, D19, D5 | VS5, VS8, VS4 | People/workforce; job/organisation architecture; recruitment/employment; time/payroll; competence/performance/learning analytics |
| **F16 — Information Technology** | Govern and operate technology services, platforms, assets and changes reliably. | D19, D1, D17, D15, D9, D14 | VS3, VS9 | Platform/service-management workspace; identity; service desk/change/release; technology assets/vendors; observability and resilience |
| **F17 — Data, Analytics & AI** | Govern data and intelligence from source through trusted analytics and AI. | D19, D1, D14 | VS3, VS8, VS9 | Data governance/catalogue; master/reference data; data platform/integration; BI/analytics; AI/model governance |
| **F18 — Cybersecurity & Information Security** | Prevent, detect, respond to and assure information-security risks. | D1, D19, D14, D17, D9 | VS9, VS3 | Identity/access; security policy/control; vulnerability/monitoring/incidents; third-party security; evidence/assurance |
| **F19 — Legal & Corporate Secretariat** | Manage legal obligations, agreements, corporate secretariat and disputes with controlled evidence. | D4, D1, D6, D14, D19, D9, D12 | VS9, VS1, VS2 | Legal matter/obligation workspace; contracts/repository; corporate records; legal evidence/holds; spend and regulatory actions |
| **F20 — Risk, Compliance, Internal Control & Audit** | Identify risk, operate/test controls, manage compliance and deliver independent assurance. | D14, D19, D1, D6 | VS9, VS3, VS8 | Enterprise risk/control/audit workspace; issues/actions; evidence; assurance reporting and audit trail |
| **F21 — Privacy & Information Governance** | Govern personal information, privacy obligations, rights and retention. | D1, D14, D19, D6 | VS9 | Privacy register; processing/PIA; consent/rights; retention; incidents/transfers; privacy evidence and assurance |
| **F22 — Property, Facilities & Physical Assets** | Acquire, create, operate, maintain, optimise and dispose of property and physical assets. | D16, D15, D17, D5, D6, D9, D7, D18, D19 | VS6, VS7, VS8, VS2 | Property/facility/asset workspaces; capital/project delivery; maintenance; space/leases/utilities; asset accounting and analytics |
| **F23 — Health, Safety, Environment & Sustainability** | Protect people/environment, comply with obligations and improve sustainability performance. | D14, D18, D13, D15, D9, D19, D12 | VS9, VS6, VS7, VS2 | H&S/environment workspace; hazards/permits/incidents; inspections; occupational health; carbon/energy/waste/ESG |
| **F24 — Business Continuity, Crisis & Physical Security** | Prepare for disruption, coordinate crises and protect people, sites and critical operations. | D14, D1, D17, D16, D19, D12 | VS9, VS3 | Continuity/risk workspace; crisis actions/communications; emergency/security/visitor management; recovery evidence |
| **F25 — Communications, Public Affairs & Investor Relations** | Manage corporate narrative, stakeholders, reputation, public affairs and investor communications. | D2, D19, D8, D6, D1 | VS3, VS1, VS9 | Stakeholder/communications workspace; content/approvals; reputation/public affairs; investor/annual reporting and engagement |
| **F26 — Knowledge, Document & Records Management** | Create, control, retain, find and reuse trusted organisational knowledge and records. | D6, D19, D1, D14 | VS9, VS3, VS6 | Controlled information/CDE; knowledge base; records/retention; enterprise search; lessons learned |
| **F27 — Portfolio, Programme & Project Management** | Select, plan, resource, execute, control and close portfolios/programmes/projects predictably. | D5, D4, D8, D7, D9, D12, D13, D14, D19 | VS4, VS8, VS2, VS5, VS9 | Portfolio/programme/project workspaces; WBS/schedule/resources; commercial/cost; procurement/site/QHSE; reporting |
| **F28 — Change & Transformation Management** | Move the organisation from current to target state and realise measurable benefits. | D5, D12, D19, D1, D8 | VS3, VS4, VS5 | Transformation portfolio; change impacts/actions; stakeholder/comms; training/readiness; adoption and benefit tracking |
| **F29 — Business Process & Continuous Improvement** | Design, govern, automate and continuously improve enterprise processes. | D19, D1, D14, D5, D6 | VS3, VS9 | Process architecture/modelling; workflow automation; SOPs; ownership/compliance; performance and improvement backlog |

## Complete 353-sub-function map

The detailed crosswalk is split into four governed shards aligned to the canonical taxonomy:

- [`../architecture/function-capability-map/map-f01-f08.md`](../architecture/function-capability-map/map-f01-f08.md)
- [`../architecture/function-capability-map/map-f09-f15.md`](../architecture/function-capability-map/map-f09-f15.md)
- [`../architecture/function-capability-map/map-f16-f22.md`](../architecture/function-capability-map/map-f16-f22.md)
- [`../architecture/function-capability-map/map-f23-f29.md`](../architecture/function-capability-map/map-f23-f29.md)

Every canonical L2 sub-function appears exactly once. Domain order indicates primary ownership first and supporting native domains after it.

## How a sophisticated business experiences this

A user does not navigate by department-module. NuBlox composes context around the thing being managed — organisation, customer, supplier, opportunity, contract, project, site, property, asset, work order or information container — while every mutation resolves to one authoritative domain command.

For example, **F27 Project Management** is experienced as one project context but composes D5 project controls, D4 commercial, D7/D8 finance, D9 procurement, D12 workforce, D13 site, D14 QHSE and D19 analytics. **F14 Finance** composes D7 statutory accounting, D8 management accounting/treasury/performance and D19 reporting/workflow. **F22 Property/Assets** composes D16 property/facilities, D15 EAM, D17 maintenance, D5 capital projects, D7 finance, D18 sustainability and D19 analytics.

## Completeness rule

A mapping is not delivery proof. A sub-function is World-Class complete only when applicable evidence exists for canonical records, owner service/command, lifecycle and corrections, permissions/SoD, workflow/evidence, value-stream integration, KPI/reporting drill-through, interoperability, scope boundaries and automated database/browser proof.

## Relationship to job architecture

```text
Enterprise Function → Functional Role → Job Profile → Organisation Position → Person

Enterprise Function/Sub-function → Value Stream → Native Domains → Workspace → Permissions/Controls → Records/Transactions/Evidence
```

The two chains are deliberately connected but not conflated: job profiles do not become permissions, and enterprise functions do not become software modules.

## Governing sources

- `docs/architecture/taxonomy/`
- `docs/architecture/job-architecture/`
- `docs/architecture/bottom-up/layer-6-capability-domains.md`
- `app/src/lib/navigation/capability-registry.ts`
- `docs/world-class/03-enterprise-value-streams.md`
- `docs/world-class/10-capability-control-matrix.md`
- `docs/world-class/11-sap-benchmark-coverage.md`
