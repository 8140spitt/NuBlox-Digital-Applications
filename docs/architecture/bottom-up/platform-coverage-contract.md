# NuBlox Complete Platform Coverage Contract

**Status:** Governing Layer 6 target-state coverage contract  
**Effective:** 27 August 2026  
**Purpose:** define the complete software-category breadth NuBlox must ultimately provide natively as one enterprise operating system, without conflating target-state coverage with current implementation maturity.

## 0. Authority boundary

This document answers:

> **What materially relevant market-category capability must the complete NuBlox operating system ultimately own?**

It does **not** assert that every capability described here is implemented today and it does not sequence delivery.

The governing authorities are deliberately separated:

| Concern | Authority |
| --- | --- |
| Product ambition, value streams and delivery priorities | [`../../world-class/README.md`](../../world-class/README.md) |
| Current 19-domain World-Class maturity and governing gaps | [`../../world-class/10-capability-control-matrix.md`](../../world-class/10-capability-control-matrix.md) |
| Golden reference journeys | [`../../world-class/08-reference-journeys.md`](../../world-class/08-reference-journeys.md) |
| Bottom-up engineering method and invariants | [`README.md`](README.md) and Layers 0–9 |
| Enterprise work taxonomy | [`../taxonomy/README.md`](../taxonomy/README.md) |
| SAP outside-in enterprise benchmark | [`../../world-class/11-sap-benchmark-coverage.md`](../../world-class/11-sap-benchmark-coverage.md) |
| Implemented schema and runtime truth | committed migrations, domain services, tests and CI |

**Coverage contract ≠ implementation claim ≠ delivery backlog.**

A category may appear in this target-state contract while its owning NuBlox domain is still `partial` or `planned`. Current-state language must always follow executable repository evidence and the World-Class Capability Control Matrix.

## 1. Product invariant — one complete product

**Target-state invariant:** NuBlox is one complete enterprise operating system, engineered particularly deeply for organisations that create, deliver, own and operate the built environment.

Customers should not have to assemble the intended NuBlox product by purchasing separate ERP, PLM, PDM, BIM, CDE, project-controls, finance, HR, supply-chain, asset-management or facilities modules. Those are market/category labels used to test capability breadth. They are not separate NuBlox products and they are not architectural authorities.

At category-complete target state:

- no core NuBlox capability requires purchase of a separate NuBlox module;
- no materially relevant native business process is deliberately absent because a module was not selected;
- another ERP, PLM, PDM, CDE, PMIS, EAM, CMMS, IWMS or equivalent product is not required merely to fill a planned NuBlox core-capability gap;
- external products may exchange data, provide infrastructure, statutory rails, specialist authoring or specialist algorithms, but NuBlox owns the canonical business records, state, permissions, workflow, evidence and reporting for its native process;
- capability is hidden, surfaced or simplified by context and permissions rather than by creating contradictory product editions or duplicate records.

**Target product principle: complete by default; adaptive by context.**

This is a target-state product contract. Until the completeness gates in this document are met, current capability must be described using the repository maturity evidence rather than this target wording.

## 2. What “out of the box” means at target state

At target state, “out of the box” means the product contains the native capability and default process foundations. It does not mean every user sees every function or that every industry variant is enabled identically.

The application experience is composed using:

- organisation context;
- legal entity and operating-unit context;
- career/professional context;
- organisation role;
- project role;
- explicit permissions and delegated authority;
- project, contract, site, property and asset context;
- jurisdiction/localisation;
- scale and operating-pattern configuration.

The governing distinction remains:

**Career ≠ Organisation Role ≠ Project Role ≠ Permission.**

Product availability is also distinct from user authority:

**Capability included ≠ Capability visible ≠ Capability authorised for this user.**

## 3. World-class category convergence

NuBlox must meet the materially relevant capability expectations represented by the following software categories while implementing them through the 19 native NuBlox capability domains and the lower bottom-up layers.

| Market/category label | NuBlox native treatment | Primary native domains |
| --- | --- | --- |
| ERP — Enterprise Resource Planning | integrated enterprise operations, finance, procurement, projects, workforce, supply chain, assets, service and reporting on one canonical model | 1–19 |
| EPM/CPM — Enterprise/Corporate Performance Management | budgets, forecasts, scenarios, cash, profitability, consolidation, KPI frameworks and management reporting | 7, 8, 19 |
| CRM/CX | parties, contacts, leads, opportunities, account management, communications, pipeline and customer history | 2, 3, 17 |
| CPQ / estimating / tendering | measurement, take-off, assemblies, resource build-ups, rates, risk, margin, proposals, quotations and tender submissions | 3, 4 |
| CLM — Contract Lifecycle Management | appointments, contracts, subcontracts, clauses, obligations, notices, change, claims, valuations, certification and final account | 4, 9 |
| PPM/EPPM — Portfolio, Programme and Project Management | portfolio selection, programmes, WBS, CPM scheduling, baselines, resources, progress, risk, change, earned/progress measures and close | 5, 8, 19 |
| PMIS — Project Management Information System | project controls, correspondence, information, commercial position, field records, dashboards and governed project evidence | 4, 5, 6, 13, 14, 19 |
| PLM — Product Lifecycle Management | requirements, product/system definition, configuration, engineering change, BOM/assembly structures, manufacture, commissioning, service and end-of-life digital thread | 6, 10, 11, 15, 17, 19 |
| PDM — Product Data Management | controlled product/design data, classifications, specifications, drawings/models, revisions, configurations, effectivity, BOMs and engineering change evidence | 6, 11, 19 |
| Requirements/configuration/change management | requirements baselines, traceability, configuration items, controlled changes, approvals, effectivity and verification | 4, 5, 6, 19 |
| CDE — Common Data Environment | controlled project information, containers, revisions, suitability/status, transmittals, reviews, approvals, issue and immutable collaboration evidence | 6, 19 |
| EDMS/DMS — Electronic Document/Document Management | enterprise and project documents, records, versions, metadata, retention, search, issue, access and legal/audit evidence | 1, 6, 19 |
| BIM/VDC | model/object information, federation, coordination, issues, quantities, construction planning, asset information and openBIM exchange | 5, 6, 13, 15, 16, 19 |
| CAD/engineering authoring workflow | governed 2D/3D authoring/markup/coordination foundations, parametric object/product information, engineering records and discipline calculations where native professional workflow requires them | 6, 19 |
| SCM — Supply Chain Management | demand/supply planning, sourcing, procurement, materials, logistics, production, delivery and supply risk | 9, 10, 11, 19 |
| SRM — Supplier Relationship Management | onboarding, qualification, approved lists, sourcing, compliance, performance, risk, disputes and supplier collaboration | 9, 14, 19 |
| MRP — Material Requirements Planning | demand, BOM/material requirement explosion, supply proposals, capacity and long-lead planning | 10, 11 |
| WMS — Warehouse Management | stores/bins, receipts, put-away, reservations, picking, packing, transfers, counts, traceability and dispatch | 10 |
| TMS — Transportation Management | transport planning, routes, loads, deliveries, movement evidence, fleet linkage and project/site logistics | 10, 15 |
| MES/MOM — Manufacturing Execution/Operations Management | production orders, routings, work centres, shop-floor execution, consumption, traceability, quality and production costing | 11, 14 |
| HCM/HRIS | people, employment, organisation structures, recruitment, onboarding, performance, learning, competence and employee records | 12 |
| WFM — Workforce Management | time, attendance, leave, rostering, resource planning, skills, mobilisation, multi-resource scheduling and utilisation | 5, 12, 13 |
| Payroll | gross-to-net calculation, deductions, benefits, approvals, payment outputs, statutory reporting data and localisation | 7, 12 |
| QMS — Quality Management System | quality plans, ITPs, inspections, tests, NCRs, defects, CAPA, audit, calibration, certification and quality evidence | 11, 13, 14 |
| EHS/HSE | hazards, RAMS, permits, observations, incidents, investigations, environmental controls, competence gates and assurance | 12, 13, 14 |
| GRC — Governance, Risk and Compliance | controls, policy, delegated authority, segregation of duties, risk, obligations, audit, assurance and regulatory evidence | 1, 7, 14, 19 |
| EAM — Enterprise Asset Management | asset hierarchy, technical objects, lifecycle, work, maintenance, inspections, spares, cost, warranty, condition and history | 15, 17 |
| CMMS — Computerised Maintenance Management | maintenance plans, schedules, work orders, labour, parts, meters, inspections, defects, completion and maintenance history | 15, 17 |
| APM/RCM — Asset Performance/Reliability Management | condition, failure modes, reliability strategy, health, predictive/condition-based maintenance, availability and lifecycle decisions | 15, 18, 19 |
| AIP — Asset Investment Planning | condition/risk/cost-based renewal, replacement, capital scenarios and lifecycle investment prioritisation | 8, 15, 16, 18, 19 |
| IWMS/CAFM — Integrated Workplace/Facilities Management | property/building/space hierarchy, occupancy, service desk, PPM, soft FM, compliance, contractors, utilities and workplace operations | 16, 17, 18 |
| CRE/real-estate management | ownership, acquisition/disposal, leases, licences, rents, service charges, valuation, occupancy and property performance | 8, 16 |
| FSM — Field Service Management | requests/cases, entitlement, scheduling, dispatch, mobile work, parts, completion, SLA, billing and customer asset history | 12, 15, 17 |
| GIS / geospatial information | sites, land, coordinates, networks, linear assets, spatial relationships, maps, location intelligence and geospatial evidence | 5, 6, 13, 15, 16, 19 |
| Reality capture / surveying | survey observations, point clouds/images, condition evidence, progress capture, georeferencing and controlled derived outputs | 5, 6, 13, 14, 19 |
| Digital twin | governed linkage between spatial/engineering definition, installed asset configuration, condition, telemetry, work, cost and lifecycle history | 6, 15, 16, 17, 18, 19 |
| Sustainability / carbon / ESG data | embodied/operational carbon, energy, water, waste, provenance, circularity, targets, evidence and performance reporting | 10, 11, 14, 16, 18, 19 |
| BI / analytics / data platform | governed metrics, dashboards, drill-through, semantic reporting, forecasting, anomaly detection and enterprise search | 19 plus source domains |
| BPM / workflow / case management | configurable controlled processes, approvals, assignments, SLAs, cases, decisions, events and escalations built on domain state and the Work Kernel | 1, 19 plus owner domains |
| Collaboration / extranet / portal | controlled cross-organisation participation without weakening tenant ownership, permissions, contractual evidence or data provenance | 1, 5, 6, 9, 13, 17, 19 |
| Integration / API / event platform | versioned APIs, webhooks, import/export, transactional outbox, idempotency, adapters and governed external exchange | 19 plus owner domains |
| Knowledge/search/AI assistance | permission-aware retrieval, provenance, summarisation, decision support, automation and agents operating through authorised domain commands | 19 plus owner domains |

These labels are a **coverage contract**, not a navigation design, licence catalogue, delivery sequence or claim of current implementation completeness.

## 4. The NuBlox digital thread

World-class integration is not achieved by putting many modules behind one login. NuBlox must maintain traceable continuity between the records that describe an enterprise outcome and, where applicable, a built outcome across its complete life.

A representative built-environment digital thread is:

```text
Market need / opportunity
→ client requirement
→ project requirement
→ estimate / cost plan
→ design requirement
→ system / product / asset definition
→ drawing / model / specification / configuration
→ quantity / BOM / BoQ / work package
→ procurement or production requirement
→ supplier / material / fabricated component
→ delivery / installation
→ inspection / test / commissioning
→ handed-over installed asset
→ operational condition / telemetry
→ maintenance / service / change
→ refurbishment / replacement
→ decommissioning / disposal
```

The operating system must also preserve enterprise consequence threads such as:

```text
Operational transaction
→ authority / approval
→ commercial or workforce consequence
→ accounting consequence
→ cash / liability / asset position
→ management reporting
→ enterprise performance / forecast
```

These threads must preserve related dimensions including:

- organisation, legal entity and accountable actor;
- project/programme and location;
- customer/supplier/contract/obligation;
- cost, commitment, revenue, payroll and accounting consequence;
- schedule/activity/work package;
- risk, quality, safety and compliance evidence;
- document/model revision and configuration;
- material/product provenance;
- carbon/environmental consequence;
- asset/system/component history;
- decisions, approvals and audit events.

NuBlox should prefer explicit relational provenance over duplicated records or ungoverned file references.

## 5. PLM and PDM for the built environment

PLM/PDM semantics are first-class because construction increasingly combines engineered products, manufactured assemblies, building systems, off-site fabrication and long-lived installed assets.

### PDM minimum native semantics

NuBlox must support controlled:

- requirements and technical attributes;
- product/system/assembly/component definitions;
- classification and catalogue structures;
- documents, drawings, specifications and models;
- revisions and versions;
- configuration baselines and alternatives;
- bills of material and assembly structures;
- approved manufacturer/product information;
- engineering change requests/orders or equivalent controlled change;
- effectivity/applicability where required;
- provenance, approvals and released status;
- relationship to procurement, production and installed assets.

### PLM minimum native semantics

NuBlox must extend the thread through:

- concept and requirements;
- design and engineering;
- cost and manufacturability/procurability;
- supplier/product approval;
- production/fabrication;
- site delivery and installation;
- testing and commissioning;
- handover/as-built configuration;
- warranty/service;
- maintenance and modification;
- replacement, reuse and end of life.

A building product, engineered assembly and installed asset must not become unrelated records merely because different teams work on them at different lifecycle stages.

## 6. Enterprise ERP standard

Construction depth does not reduce the requirement for credible non-construction enterprise capability.

A world-class NuBlox deployment must ultimately be capable of operating material enterprise functions including:

- legal entities, organisation structures, master data, delegated authority and SoD;
- customer, sales and service operations;
- complete source-to-pay and supplier lifecycle;
- financial accounting, AP/AR, cash/bank, tax, fixed assets, currency, intercompany and period/year-end close;
- management accounting, planning, forecasting, treasury, consolidation and enterprise performance;
- people, employment, competence, time, expenses, payroll and workforce planning;
- materials, inventory, warehouses, logistics and relevant production/fabrication;
- risk, compliance, assurance, records and governance;
- enterprise data, workflow, reporting, analytics, integration and automation.

The 29-function enterprise taxonomy defines the broader operating-model coverage catalogue. The nine enterprise value streams define how delivery should prove integrated outcomes. Neither dimension is replaced by market-product labels in this contract.

## 7. Project controls and construction-management standard

World-class project delivery requires more than tasks and Gantt charts. NuBlox must natively support, as applicable:

- enterprise portfolio and capital planning;
- WBS/OBS/CBS/RBS and controlled coding structures;
- CPM scheduling, calendars, logic, constraints and baselines;
- resource and capacity planning;
- progress and production measurement;
- cost plans, budgets, commitments, actuals, accruals and forecasts;
- earned/progress performance measures;
- risk registers, qualitative and quantitative analysis foundations;
- change and contingency;
- cash flow and funding;
- contract administration and contractual communications;
- field/short-interval/lean planning;
- project information, CDE and model coordination;
- commercial position and final account;
- portfolio/programme/project reporting with drill-through to authoritative evidence.

## 8. Asset, property and operational standard

The product does not stop at handover. NuBlox must carry the same governed asset thread into operation.

Native target includes:

- asset/system/location hierarchies;
- installed configuration and commissioning evidence;
- maintenance strategies/plans;
- preventive, predictive, condition-based and reactive work;
- meters, readings, telemetry and condition;
- inspections and statutory compliance;
- failure modes, defects and reliability;
- work orders, labour, parts and contractors;
- spares/MRO inventory;
- warranties and service contracts;
- uptime, downtime, availability and lifecycle cost;
- asset health/performance;
- capital renewal and replacement planning;
- property, lease, space, occupancy and FM services;
- refurbishment, adaptation and decommissioning.

## 9. World-class benchmark rule

NuBlox does not copy another vendor's packaging, terminology, data model or architecture. Market leaders are outside-in challenge sources used to expose missing business capability, control depth, usability and interoperability expectations.

Representative benchmark families include:

- **SAP Cloud ERP / S/4HANA** — integrated enterprise ERP, finance, source-to-pay, HCM, planning, supply chain and enterprise operations;
- **Oracle Fusion Cloud ERP / SCM / HCM** — enterprise finance, procurement, supply chain, people and performance breadth;
- **Microsoft Dynamics 365** — finance, supply chain, sales, service, field service and enterprise productivity expectations;
- **Siemens Teamcenter** — PLM/PDM, configuration and the product digital thread;
- **Oracle Primavera Cloud / Unifier / Aconex** — project controls, capital/project lifecycle, commercial control and CDE collaboration;
- **Autodesk Construction Cloud** — BIM/CDE, take-off and construction information workflows;
- **IBM Maximo** — EAM, reliability, maintenance, asset performance and facilities;
- **Esri ArcGIS** — geospatial, GIS/BIM and built-environment digital-twin context.

The maintained SAP benchmark interpretation is [`../../world-class/11-sap-benchmark-coverage.md`](../../world-class/11-sap-benchmark-coverage.md). Equivalent benchmark registers may be maintained for other families where they materially improve coverage assurance.

A benchmark identifies questions, not architecture:

1. What mature business outcome or control would NuBlox otherwise overlook?
2. Which of the 19 native domains owns the required semantics?
3. Which value stream and golden journey proves the outcome?
4. Does NuBlox provide materially equivalent or better enterprise capability?
5. Where the work concerns the built environment, does NuBlox also provide deeper sector-specific capability and digital-thread continuity?

If the answer exposes a material gap, that gap becomes a NuBlox capability requirement. Vendor module names do not become NuBlox modules, database schemas or delivery slices.

## 10. Category-completeness gate

A category label may be claimed as **currently complete** only when its material capabilities trace downward through the bottom-up architecture and upward through a proven end-to-end outcome.

For every claimed category, verify:

1. canonical records and relationships;
2. lifecycle/configuration semantics;
3. ownership and transaction boundaries;
4. tenant/project/record scope;
5. permissions, delegated authority and SoD;
6. work, approval and decision semantics;
7. audit, provenance and correction/reversal model;
8. end-to-end value-stream integration;
9. financial/commercial consequences where applicable;
10. workforce, supply-chain or asset consequences where applicable;
11. information/document/model consequences where applicable;
12. reporting, KPIs, exceptions and drill-through;
13. external interchange, APIs/events and relevant open standards;
14. usable contextual experience, including mobile/field behaviour where required;
15. automated database/service/browser validation;
16. reference-journey evidence where the category participates in Journey A, B or C;
17. evidence that the capability works with the common digital thread rather than as an isolated mini-application;
18. a World-Class maturity assessment consistent with [`../../world-class/10-capability-control-matrix.md`](../../world-class/10-capability-control-matrix.md).

A market/category claim should not be described as fully delivered while its material owner domains remain `planned`, while critical value-stream links are absent, or while the evidence supports only W0–W3 maturity.

**W4 is the normal threshold for an unqualified “world-class/category-complete” claim.**

The Layer 9 completeness gate remains the final product-wide engineering definition of done.

## 11. Product promise

The target customer proposition is deliberately simple:

> **NuBlox is being engineered to provide the complete native digital capability required to run the enterprise, deliver projects and programmes, and manage built assets through their whole life — in one governed operating system.**

Current product claims must remain evidence-led. Until a capability satisfies the relevant completeness gate, describe it using the current maturity in the capability registry and World-Class Capability Control Matrix.

The complexity belongs inside NuBlox's architecture, not in the customer's purchasing decision.