# 57 — Built Environment ERP Capability Blueprint

**Status:** Governing product blueprint  
**Baseline:** `main` at `4ee3446ded483b79f6464539ece35090f196449f`  
**Scope:** NuBlox Digital Applications  
**Purpose:** Define the minimum enterprise capability breadth and built-environment depth that NuBlox must achieve, and govern the development sequence after completed V1 Slices 1–7.

> This document supersedes `49-v1-product-architecture-and-delivery-sequence.md` for **future product sequencing**. It does not invalidate the implementation records for completed slices.

## 1. Product mission

NuBlox is a **Built Environment Enterprise Resource Planning platform and Business Operating System**.

It must be capable of operating an organisation end to end while also supporting the full lifecycle of the built environment:

**Win work → plan → design → procure → manufacture/fabricate where applicable → construct/install → commercially control → test/commission → hand over → operate → maintain → renew/dispose.**

NuBlox must therefore satisfy two simultaneous coverage baselines:

1. **SAP-class ERP breadth** — the enterprise capabilities expected from a mature integrated ERP suite;
2. **construction and built-environment depth** — specialist capabilities required by the National Careers Service construction and built-environment sector and NuBlox's canonical 84-career taxonomy.

The product is not intended to be a copy of SAP. SAP terminology is used as a **coverage benchmark**, not as NuBlox's information architecture or user-facing product language.

## 2. External coverage baselines

### 2.1 National Careers Service — construction and the built environment

The National Careers Service describes the sector as spanning physical trades plus environmental sustainability, property maintenance and civil engineering. NuBlox already maintains a canonical 84-career taxonomy across 16 professional domains in `03-career-taxonomy.md` and a career-to-capability planning matrix in `04-career-capability-matrix.md`.

Sources:

- https://nationalcareers.service.gov.uk/explore-careers/job-sector/construction-and-the-built-environment
- `03-career-taxonomy.md`
- `04-career-capability-matrix.md`

### 2.2 SAP-class ERP breadth

SAP S/4HANA currently groups its ERP digital core around major lines of business including:

- Asset Management;
- Finance;
- Human Resources;
- Manufacturing;
- R&D / Engineering;
- Sales;
- Service;
- Sourcing and Procurement;
- Supply Chain.

SAP learning material also places portfolio/project management and project-system capabilities in the enterprise digital core.

Primary references:

- https://help.sap.com/docs/SAP_S4HANA_CLOUD_PE/00749a25a67e4f919f50aac370e17645/subsection-im6
- https://learning.sap.com/courses/business-processes-in-sap-s-4hana-portfolio-and-project-management/introduction-to-sap-s-4hana

The Uneecops SAP module list is retained as a broader **coverage checklist** because it exposes functional, technical, planning, logistics and industry-specific areas that should be considered when assessing ERP completeness:

- https://www.uneecops.com/blog/sap-modules-list/

That list mixes business modules, technical platform products, legacy product names and industry solutions. NuBlox must provide **equivalent business capability coverage where relevant**, not mirror SAP product packaging one-for-one.

## 3. Governing product principles

1. **One enterprise model:** finance, projects, customers, suppliers, people, assets, materials and work must share canonical records rather than becoming separate mini-applications.
2. **Context first:** users work from the object they are managing — organisation, customer, supplier, project, site, property, asset, work order — and move through its related processes without losing context.
3. **Built-environment lifecycle first:** simple trade jobs and major capital programmes use the same core primitives at different levels of complexity.
4. **SAP-class breadth is the ERP floor:** absence of a construction-specific use case is not sufficient reason to omit a normal enterprise capability such as AP, inventory, treasury, HR, warehouse or reporting.
5. **Sector depth is the differentiator:** project information, commercial control, field operations, plant, quality, safety, commissioning, handover, property and asset operations must be deeper than generic horizontal ERP.
6. **Career packs compose capabilities:** a Quantity Surveyor, Electrician, Facilities Manager, Architect or Site Manager receives a tailored operating surface without forking the domain model.
7. **Relational authority:** critical business state remains relational, tenant-scoped and auditable.
8. **Integrated financial consequences:** procurement, labour, plant, materials, changes, valuations, work orders and contracts must flow into financial and commercial position without duplicate entry.
9. **No hidden implementation identifiers:** users select recognisable business records; internal IDs remain implementation details.
10. **Progressive complexity:** a sole trader must not be forced through enterprise fields that only a tier-one contractor, consultant or asset owner needs.

## 4. Target NuBlox enterprise capability architecture

NuBlox will organise capabilities into 24 enterprise domains. These are capability boundaries, not necessarily 24 sidebar items.

| ID | NuBlox capability domain | Required scope |
|---|---|---|
| E01 | Identity, organisation & access | Identity, MFA/SSO readiness, organisations, memberships, offices, teams, roles, permissions, project scope, delegated administration. |
| E02 | Master data & reference governance | Canonical parties, suppliers, customers, products/materials, assets, locations, units, tax, classifications, numbering, deduplication, merge and change governance. |
| E03 | CRM, work winning & account management | Leads, opportunities, customers, contacts, activities, bid/no-bid, frameworks, pipeline, account plans. |
| E04 | Estimating, CPQ, tenders & sales | Take-off, estimates, resource build-ups, proposals, quotations, tender submissions, sales orders, acceptance and conversion. |
| E05 | Contracts, appointments & obligations | Customer/supplier/subcontract/consultant contracts, amendments, notices, obligations, key dates, correspondence and claims foundations. |
| E06 | Project, programme & portfolio management | Projects/jobs, WBS, stages, milestones, programme, dependencies, portfolio, risk, resources, progress and project controls. |
| E07 | Commercial management & controlling | Cost codes, budgets, cost plans, commitments, actuals, variations/change, valuations/applications, forecasts, CVR, profitability and final account. |
| E08 | Finance, accounting & tax | GL, AR, AP, journals, tax, fixed-asset accounting, periods, consolidation foundations, statutory/management reporting. |
| E09 | Treasury, cash & financial risk | Bank accounts, reconciliation, cash position, cash forecasting, liquidity, payment runs, treasury controls and financial risk foundations. |
| E10 | Procurement & supplier management | Supplier lifecycle, qualification, sourcing, RFQ/tendering, comparisons, requisitions, POs/subcontracts, approvals, receipts and supplier performance. |
| E11 | Materials, inventory & stores | Material master, catalogue, stock, reservations, issues/returns, goods receipt, transfers, stocktaking, valuation and project/site stores. |
| E12 | Warehouse & logistics execution | Warehouse locations, put-away, pick/pack, dispatch, delivery notes, inbound/outbound logistics and traceability. |
| E13 | Transportation, fleet & mobile logistics | Vehicles, transport planning, deliveries, routes, fleet, drivers, movement evidence and project logistics. |
| E14 | Supply-chain planning | Demand, supply, procurement forecasts, material requirements, capacity, long-lead items, supply risk and integrated planning. |
| E15 | Manufacturing, fabrication & production | BOM, routings, work centres, production/fabrication orders, capacity, shop-floor progress, QC, material consumption and manufactured assemblies. |
| E16 | People, HCM, competence & expenses | Workforce, employment/engagement, onboarding, competencies, qualifications, training, attendance, leave, time, expenses, payroll integration and utilisation. |
| E17 | Service & field service management | Service requests, callouts, job/work orders, dispatch, SLA, engineer allocation, parts, service history, customer service and recurring service. |
| E18 | Asset, plant, fleet & maintenance management | Enterprise assets, plant/tools, inspections, utilisation, defects, PPM, reactive maintenance, service history, warranty and lifecycle cost. |
| E19 | Quality, testing & certification | Quality plans, ITPs, inspections, NCRs, defects/snags, tests, commissioning evidence, calibration and controlled certification. |
| E20 | Environment, health, safety & sustainability | RAMS references, permits, inductions, toolbox talks, incidents, observations, environmental controls, waste, energy, carbon and sustainability evidence. |
| E21 | Design, engineering, information & PLM | Briefs, surveys, drawings, models/BIM, calculations, specifications, revisions, CDE/document control, RFIs, submittals, instructions, design responsibility and product/asset information. |
| E22 | Property, real estate, facilities & occupancy | Estates, property, buildings, leases/licences, tenants/occupiers, spaces, service charges foundations, facilities, compliance and workplace operations. |
| E23 | Governance, risk, compliance & regulatory casework | Enterprise controls, approval policy, segregation of duties, audit, regulatory evidence, building control/inspection casework, certificates and compliance obligations. |
| E24 | Data, analytics, planning, integration & platform | BI, dashboards, planning, consolidation, predictive analytics, search, APIs, webhooks, ETL/import/export, integration adapters, automation, platform administration, observability and extension framework. |

## 5. Built-environment specialist overlays

The enterprise domains above are necessary but not sufficient. NuBlox must provide specialist overlays for the construction/property lifecycle and the 16 professional domains in `03-career-taxonomy.md`.

### 5.1 Architecture, design and engineering

- briefs, surveys and design stages;
- drawings, models/BIM and federated information references;
- calculations and technical submissions;
- design responsibility matrix;
- design reviews, comments and approvals;
- specifications, schedules and change history;
- technical queries and construction-stage design support;
- fire, building services, structural, civil and specialist engineering evidence.

### 5.2 Surveying, property and land

- measured/condition surveys;
- property/site/land records;
- valuations and appraisal;
- dilapidations and defect schedules;
- land/site constraints;
- instructions and professional reports;
- development appraisal and feasibility;
- geospatial links and survey outputs.

### 5.3 Construction commercial management

- cost plans and elemental/project cost structures;
- measurement and BoQ foundations;
- tender packages and tender analysis;
- subcontract procurement;
- applications for payment, valuations and certificates;
- variations, compensation events and change control;
- commitments, accruals, actual cost and forecast;
- CVR, margin, cash and earned-value style reporting;
- final accounts.

### 5.4 Site delivery and trade operations

- daily diaries;
- task/work-pack allocation;
- labour, plant and material records;
- deliveries and logistics;
- permits and checks;
- inspections and quality evidence;
- photos and progress;
- trade job sheets;
- snagging and completion records;
- mobile-first operation and poor-connectivity resilience.

### 5.5 Plant, lifting and specialist operations

- plant register and allocation;
- pre-use checks;
- utilisation/hours;
- defects and maintenance;
- lifting/access records;
- scaffold registers/inspection;
- operator competence;
- hired plant and cost capture.

### 5.6 Building services, testing and commissioning

- systems/equipment schedules;
- installation work packs;
- circuit/line/device records where applicable;
- test and commissioning sheets;
- defects and retests;
- service/maintenance continuity;
- certification evidence;
- handover into operational asset records.

### 5.7 Facilities, property and asset operations

- property/building/space/system/asset hierarchy;
- PPM and statutory schedules;
- reactive maintenance;
- SLA/contractor management;
- asset history, warranties and manuals;
- compliance inspections;
- occupancy and facilities operations;
- lifecycle planning and renewal.

### 5.8 Utilities, infrastructure and field networks

- linear/network assets;
- field work orders;
- excavation/installation/repair records;
- materials and reinstatement;
- tests and as-builts;
- mobile workforce, plant and logistics;
- network/location evidence.

### 5.9 Energy, retrofit and sustainability

- building/property energy data;
- surveys and assessments;
- retrofit measures;
- energy/carbon baselines;
- installed technology/equipment;
- waste and environmental evidence;
- performance verification;
- maintenance continuity.

### 5.10 Regulation, inspection and compliance

- applications/cases;
- plan/evidence review;
- inspections;
- notices and defects;
- decisions and certificates;
- immutable regulatory evidence;
- controlled external collaboration.

## 6. SAP coverage contract

Every SAP area in the reference list must map to either a native NuBlox domain, a platform capability or an explicit industry extension. `Not applicable` is not an acceptable unreviewed state.

| # | SAP reference capability | NuBlox equivalent / target |
|---:|---|---|
| 1 | Advanced Planning & Optimization (APO) | E14 Supply-chain planning + E06 programme/resource planning. |
| 2 | Business Intelligence (BI) | E24 analytics, dashboards, semantic reporting and governed export. |
| 3 | Business Planning and Consolidation (BPC) | E24 planning + E08 finance/consolidation foundations. |
| 4 | Cash Management (CM) | E09 cash position, forecasting, banking and liquidity. |
| 5 | Convergent Charging (CC) | E08/E17 configurable recurring, usage and service billing where required. |
| 6 | Controlling (CO) | E07 commercial/management controlling, cost centres, project profitability and internal reporting. |
| 7 | Customer Relationship Management (CRM) | E03 CRM/account management. |
| 8 | Customer Service (CS) | E17 customer/field service management. |
| 9 | Data Services (DS) | E24 ETL, import/export, integration and data-quality tooling. |
| 10 | Environment, Health & Safety (EHS) | E20 EHS/sustainability. |
| 11 | Enterprise Asset Management (EAM) | E18 asset/plant/fleet maintenance + E22 facilities. |
| 12 | Event Management (EM) | E24 event/outbox/notification automation and monitored business events. |
| 13 | Extended Financial Management (EFM) | E08/E09 advanced finance, controls and reporting. |
| 14 | Extended Warehouse Management (EWM) | E12 warehouse/logistics execution. |
| 15 | Flexible Real Estate Management (RE-FX) | E22 real estate, lease/occupancy and facilities. |
| 16 | Financial Accounting (FI) | E08 accounting and tax. |
| 17 | Funds Management (FM) | E08/E07 budget/fund controls; public-sector style fund accounting as an extension. |
| 18 | Global Trade Services (GTS) | E23 trade/compliance controls + E12/E13 logistics; extension for cross-border trade. |
| 19 | Governance, Risk & Compliance (GRC) | E23 enterprise GRC, SoD, approvals, audit and regulatory evidence. |
| 20 | Human Capital Management (HCM) | E16 HCM, workforce, competence, time, expenses and payroll integration. |
| 21 | Incentive & Commission Management (ICM) | E16/E04 commission/incentive calculation extension. |
| 22 | Integrated Business Planning (IBP) | E14 integrated demand/supply/capacity planning + E24 scenario planning. |
| 23 | Integrated Product & Process Engineering (IPPE) | E21 engineering/PLM + E15 BOM/routing/fabrication. |
| 24 | Library / Documentation | E21 controlled information/document management + platform knowledge/help. |
| 25 | Master Data Governance (MDG) | E02 enterprise master-data governance. |
| 26 | MDG for Material Data (MDG-M) | E02 + E11 governed materials/products. |
| 27 | MDG for Supplier Data (MDG-S) | E02 + E10 governed supplier master/lifecycle. |
| 28 | Materials Management (MM) | E10 procurement + E11 inventory/materials. |
| 29 | Multi-Resource Scheduling (MRS) | E06/E16/E17/E18 scheduling people, plant, assets and service resources. |
| 30 | NetWeaver | E24 application/integration/platform foundation; not a user-facing module. |
| 31 | Oil & Gas | Utilities/energy/infrastructure industry extension using E13/E18/E20/E21. |
| 32 | Plant Maintenance (PM) | E18 planned/reactive maintenance. |
| 33 | Point of Sale (POS) | Builders' merchant/branch-sales extension using E04/E11/E12/E08. |
| 34 | Portfolio & Project Management (PPM) | E06 portfolio/programme/project controls. |
| 35 | Predictive Analytics | E24 forecasting, anomaly/risk prediction and governed AI/analytics. |
| 36 | Process Integration (PI) | E24 API, webhooks, integration orchestration and adapters. |
| 37 | Product Lifecycle Management (PLM) | E21 design/engineering/PLM and controlled product/asset information. |
| 38 | Production Planning (PP) | E15 production/fabrication + E14 capacity/material planning. |
| 39 | Project System (PS) | E06 project/WBS/programme + E07 project commercial control. |
| 40 | Quality Management (QM) | E19 quality, testing, NCR and certification. |
| 41 | Real Estate Management (RE) | E22 property/estate/occupancy. |
| 42 | Real-Time Offer Management (RTOM) | E04 CPQ/offer/proposal/pricing rules and customer targeting extension. |
| 43 | Retail | Builders' merchant/distribution extension across E03/E04/E11/E12/E08. |
| 44 | S/4HANA Finance | E08/E09 integrated finance and treasury. |
| 45 | S/4HANA Supply Chain | E10–E15 integrated procurement/materials/logistics/planning/production. |
| 46 | Sales & Distribution (SD) | E03/E04 sales/order-to-cash + E12 delivery. |
| 47 | Service Parts Planning (SPP) | E11/E14/E17 service-parts inventory and planning. |
| 48 | Solution Manager (SolMan) | E24 platform administration, release/change observability and operations. |
| 49 | Strategic Enterprise Management (SEM) | E24 executive planning/analytics + E08/E07 enterprise performance. |
| 50 | SEM Integrated Planning (SEM-IP) | E24 planning/scenarios + E07/E08 budgets/forecasting. |
| 51 | Supplier Lifecycle Management (SLC) | E10 qualification, onboarding, performance and risk. |
| 52 | Supplier Relationship Management (SRM) | E10 strategic/operational supplier relationships and sourcing. |
| 53 | Supply Chain Management (SCM) | E10–E15 complete supply-chain domain. |
| 54 | Test Data Migration Server (TDMS) | E24 controlled migration, test-data management, masking and environment tooling. |
| 55 | Time & Attendance Management (TAM) | E16 time, attendance, leave and approvals. |
| 56 | Trade Promotion Management (TPM) | Merchant/distribution promotion/pricing extension under E04. |
| 57 | Transportation Management (TM) | E13 transportation/project logistics. |
| 58 | Treasury & Risk Management (TRM) | E09 treasury, liquidity and financial-risk controls. |
| 59 | Travel Management | E16 expenses/travel and approval workflows. |
| 60 | User Experience (UX) | E24 shared design system, accessibility, responsive/mobile and task-first UX. |
| 61 | Variant Configuration (VC) | E04/E15 configurable products/assemblies/options for fabrication and productised services. |
| 62 | Vehicle Management System (VMS) | E13/E18 fleet/vehicles, utilisation, maintenance and lifecycle. |
| 63 | Warehouse Management (WM) | E12 warehouse/stores. |
| 64 | Xapps / Cross-Applications | E24 extension framework and cross-domain applications. |

### 6.1 SAP main functional modules — mandatory first-class equivalents

The Uneecops source calls out ten principal functional modules. NuBlox must treat all ten as first-class capability areas:

1. Financial Accounting → E08;
2. Production Planning → E15/E14;
3. Materials Management → E10/E11;
4. Controlling → E07;
5. Sales & Distribution → E03/E04/E12;
6. Financial Supply Chain Management → E08/E09;
7. Logistics Execution → E12/E13;
8. Project System → E06/E07;
9. Plant Maintenance → E18;
10. Quality Management → E19.

## 7. Current NuBlox position at the baseline

### 7.1 Strong/activated foundations

The current runtime already has meaningful production depth in:

- identity, organisations, membership, RBAC and project scope;
- CRM parties, contacts, opportunities and activities;
- estimates and quotations;
- contract formation/amendments;
- project workspace and team administration;
- accounts receivable, credit notes, payments, collections and credit control;
- GL-style accounting posting, periods, trial-balance reporting and year-end close;
- procurement packages/RFQs/purchase orders and project commitments;
- project cost codes, budgets, change and valuations;
- workforce/time/schedule foundations;
- documents, revisions, RFIs, submittals and instructions;
- site diary/field, quality and safety foundations;
- assets/facilities/maintenance foundations;
- portal/cross-organisation collaboration foundations;
- audit and tenant-safe server-side authorisation;
- context-first application shell.

### 7.2 Material ERP gaps

These are now explicit programme gaps, not optional ideas:

- accounts payable and supplier-invoice lifecycle;
- payment runs and bank reconciliation;
- treasury/cash/liquidity management;
- fixed-asset accounting distinct from operational asset register;
- mature management controlling/profitability/cost-centre model;
- materials master, inventory, stock movement and project/site stores;
- goods receipt/service entry and three-way-match foundations;
- warehouse management;
- transport/fleet/project logistics;
- integrated demand/supply/material/capacity planning;
- manufacturing/fabrication, BOMs, routings and work centres;
- richer sales-order/order-to-cash workflow beyond quotation/project conversion;
- service/field-service management as a first-class business process;
- broader supplier lifecycle/qualification/performance;
- complete HCM lifecycle, training, leave, expenses and payroll integration;
- portfolio/programme/WBS and critical-path/project-controls depth;
- real-estate/lease/occupancy/estate management;
- enterprise master-data governance;
- GRC/segregation-of-duties/policy control;
- enterprise planning/consolidation/BI dashboards;
- transportation, service-parts and branch/merchant scenarios;
- durable API/integration/automation platform;
- mature sustainability/carbon/environmental reporting.

Repository searches at this baseline show no implemented runtime surface for inventory/warehouse, manufacturing/BOM/work-centre, real-estate/lease/occupancy or treasury/bank-reconciliation capability. These become explicit roadmap items.

## 8. Rebased delivery programme after completed Slices 1–7

Completed implementation slices remain valid. Future development is rebased to close the ERP backbone before deep feature detours.

### Slice 8 — Enterprise Master Data & Organisation Network

Deliver:

- governed customer/supplier/organisation relationships;
- master-data status, duplicate detection and controlled merge;
- material/product/service master foundations;
- location/reference-data governance;
- supplier/customer onboarding state;
- complete the invite-first organisation-network pattern only as part of this canonical master-data boundary.

Exit: every external party and core master record has a durable governed identity; no workflow depends on users exchanging internal IDs.

### Slice 9 — Procure-to-Pay & Accounts Payable

Deliver:

- requisitions;
- PO/subcontract approval chain;
- goods/service receipt;
- supplier invoices/credit notes;
- matching and exceptions;
- AP ageing;
- payment proposals/runs;
- accounting integration and audit.

Exit: purchasing can flow from requirement through receipt, supplier liability and payment.

### Slice 10 — Materials, Inventory, Stores & Warehouse

Deliver:

- material catalogue/master;
- stock locations/site stores;
- receipts/issues/returns/transfers;
- reservations and project allocation;
- stock counts and adjustments;
- valuation/accounting interface;
- warehouse location/pick/dispatch foundations.

Exit: physical materials are visible from purchase through storage, issue, return and cost.

### Slice 11 — Project, Programme, Portfolio & Resource Controls

Deliver:

- WBS/work packages;
- programmes, dependencies and milestones;
- progress and baseline/reforecast;
- project/portfolio risk and key dates;
- labour/plant/resource demand;
- multi-resource scheduling;
- portfolio reporting.

Exit: NuBlox can control a project/programme rather than merely store project records.

### Slice 12 — Sales Orders, Customer Service & Field Service

Deliver:

- quotation/proposal to sales/service order;
- service requests/callouts;
- field dispatch;
- SLAs;
- engineer/operative allocation;
- service parts/materials;
- completion evidence;
- billing/contract linkage;
- customer service history.

Exit: trade contractors, service firms and facilities teams can run repeatable customer/service operations end to end.

### Slice 13 — Finance, Treasury & Management Controlling

Deliver:

- AP/AR/GL convergence;
- bank accounts and reconciliation;
- cash forecasting/liquidity;
- payment controls;
- fixed-asset accounting foundations;
- cost centres/profit centres where required;
- project/department profitability;
- management reporting and cashflow.

Exit: finance is an enterprise control system, not only an AR/accounting subledger.

### Slice 14 — HCM, Competence, Time, Attendance & Expenses

Deliver:

- workforce lifecycle;
- onboarding/offboarding;
- qualifications/competence/training;
- attendance/leave;
- approved timesheets;
- expenses/travel;
- payroll interface;
- utilisation/resource reporting.

Exit: labour capacity, competence, time and cost are integrated with projects and operations.

### Slice 15 — Design, Engineering, BIM/CDE & PLM

Deliver:

- design stages and responsibilities;
- drawing/model/specification registers;
- design review/approval workflows;
- calculations/technical records;
- controlled transmittals/issue sets;
- BIM/model metadata and links;
- product/asset information continuity;
- design change and construction-query traceability.

Exit: professional design teams can run controlled technical information through design and construction.

### Slice 16 — Construction Operations, Logistics, Plant & Deliveries

Deliver:

- work packs;
- labour/plant/material daily records;
- delivery/logistics planning;
- vehicle/fleet foundations;
- plant hire/utilisation;
- pre-use checks/defects;
- project logistics and material movement;
- mobile field capture.

Exit: physical delivery can be planned and evidenced at site level.

### Slice 17 — EHS, Quality, Regulatory & Compliance Depth

Deliver:

- RAMS acknowledgement;
- permits;
- inductions/toolbox talks;
- incidents/near misses;
- environmental/waste controls;
- ITPs/test plans;
- NCR and defect workflows;
- controlled signatures/attestations;
- regulatory case/certificate patterns;
- enterprise GRC policy foundations.

Exit: safety/quality/compliance evidence supports both project teams and regulator-facing workflows.

### Slice 18 — Commissioning, Handover & Asset Information Continuity

Deliver:

- commissioning systems/packages;
- test packs;
- defects/retests;
- O&M/manual/warranty linkage;
- asset data validation;
- handover dossiers;
- project-to-operational asset transfer;
- soft-landings/service continuity foundations.

Exit: project information becomes usable operational asset information without rekeying.

### Slice 19 — Real Estate, Property, Facilities & Occupancy

Deliver:

- estate/property/building/space hierarchy;
- ownership/management relationships;
- leases/licences/occupancy foundations;
- facilities service contracts;
- compliance schedules;
- workplace/space records;
- property cost and asset linkage.

Exit: owners/managers can manage built assets as property and operational estates, not only maintenance assets.

### Slice 20 — Supply Chain Planning, Manufacturing & Fabrication

Deliver:

- demand/material planning;
- BOM/assemblies;
- work centres/routings;
- production/fabrication orders;
- capacity planning;
- material consumption;
- fabrication quality;
- merchant/manufacturer inventory interfaces.

Exit: builders' merchants, fabricators and specialist manufacturers in the sector can operate natively.

### Slice 21 — Enterprise Reporting, Planning, MDG & GRC

Deliver:

- cross-domain BI;
- executive/operational dashboards;
- planning/forecast scenarios;
- master-data stewardship;
- approval-policy engine;
- segregation-of-duties reporting;
- audit/compliance dashboards;
- scheduled reports and governed exports.

Exit: enterprise management can plan and govern across the integrated data model.

### Slice 22 — APIs, Integrations, Automation & Platform Operations

Deliver:

- versioned API;
- service accounts/API keys/scopes;
- webhook subscriptions and signed delivery;
- integration outbox/retry/dead-letter handling;
- import/export/ETL framework;
- accounting/payment/e-sign/email/calendar adapters;
- observability and integration audit;
- automation engine foundations.

Exit: NuBlox is an extensible enterprise platform rather than a closed application.

### Slice 23 — Professional Capability Packs

Initial packs remain:

- Quantity Surveyor;
- Electrician;
- Facilities Manager.

Then expand packs by the 16 professional domains and 84-career matrix.

A pack may configure navigation, dashboard, templates, workflow presets, calculations, reports and default permissions. It must not fork domain data.

## 9. Cross-domain canonical records

The following records must become enterprise-wide canonical anchors:

### Organisation / Party

- customer;
- prospect;
- supplier;
- subcontractor;
- consultant;
- regulator/authority;
- tenant/occupier;
- delivery partner.

One party may hold several relationship roles without duplicate master records.

### Person

- CRM contact;
- organisation member;
- worker;
- external collaborator;
- competent/qualified person;
- approver/inspector.

Relationships are explicit; identity and workforce records remain separate where required.

### Project / Job / Programme

- commercial source;
- customer/contract;
- WBS/work packages;
- programme;
- team/participants;
- documents/information;
- procurement/materials;
- labour/plant;
- commercial/finance;
- site/HSEQ;
- commissioning/handover;
- asset outputs.

### Property / Location

Target hierarchy where relevant:

**Portfolio/Estate → Development → Project → Site → Property/Building/Structure → Level → Space/Zone → System → Asset → Component**

Simple jobs may use only address/site + asset.

### Material / Product / Service

A governed master must support:

- purchased materials;
- stocked items;
- fabricated components;
- plant/service parts;
- supplier catalogue items;
- sold products/services;
- estimate/quotation resources.

### Asset / Equipment

Operational asset, project-installed equipment, plant/tool and finance fixed asset must be linked where appropriate but must not be conflated into one table merely because they share the word `asset`.

## 10. End-to-end reference journeys

### 10.1 Contractor / subcontractor

**Opportunity → Estimate → Tender/Quote → Contract → Project/WBS → Procurement → Materials/Plant/Labour → Site progress → Change/Valuation → Supplier invoices → Customer application/invoice → Commission/Handover → Final account → Defects/maintenance.**

### 10.2 Consultant / designer

**Lead → Fee proposal → Appointment → Project → Team/resource plan → Design information → Reviews/RFIs → Time/cost → Instructions/change → Site inspection → Certificates/reports → Handover/archive.**

### 10.3 Trade/service contractor

**Customer → Request/Opportunity → Survey → Quote → Service/Sales order → Schedule → Worker/material/vehicle → Job evidence/tests → Asset/service history → Invoice → Recurring maintenance.**

### 10.4 Asset owner / facilities manager

**Estate/property → Building/space/system/asset → Compliance/PPM plan → Work order → Contractor/operative → Materials/parts → Inspection/service evidence → Cost/invoice → Asset history → lifecycle/renewal.**

### 10.5 Merchant / fabricator

**Customer demand → Quote/order → material/product master → stock/procurement or BOM/production → warehouse → dispatch/transport → invoice → return/service/warranty.**

### 10.6 Regulator / inspector-facing workflow

**Application/case → documents/evidence → review → inspection → issue/notices → response/remediation → decision/certificate → immutable audit/archive.**

## 11. Product sequencing rules

From this blueprint onward:

1. The capability roadmap outranks isolated UI anomalies unless the anomaly blocks safe operation.
2. A new feature must identify its canonical domain and downstream financial/operational consequences before implementation.
3. No feature creates a new customer/supplier/person/project/location/material/asset identity if a canonical record already exists.
4. Every slice must complete a usable vertical business flow; schema-only or screen-only completion is insufficient.
5. Cross-domain integration is part of the slice, not deferred indefinitely.
6. Temporary CI or workflow machinery must not become a development strategy.
7. One product branch → one PR → implementation → tests → permanent validation → merge.
8. SAP-reference coverage is reviewed at the end of every major release wave.
9. Career/capability coverage is reviewed against all 16 professional domains, not only the first three packs.
10. NuBlox terminology remains construction/built-environment oriented even when the underlying capability corresponds to SAP.

## 12. Definition of Done for an enterprise capability

A capability is `Implemented` only when all applicable conditions are met:

- canonical relational model exists;
- tenant and project/property boundaries are explicit;
- lifecycle states/invariants are documented;
- permissions are granular and server-enforced;
- material writes are audited;
- concurrency-sensitive transitions are transactional;
- upstream and downstream links are implemented;
- financial/commercial consequences are integrated where applicable;
- responsive task-first UI exists;
- register/search/filter/export behavior exists where appropriate;
- positive, denial, tenant-isolation and lifecycle integration tests exist;
- browser acceptance proves the primary workflow;
- no generated-type drift;
- permanent Complete System Validation is green;
- documentation states deliberate exclusions and next dependency.

`Partial` means the capability must remain on the gap register even if one or more screens exist.

## 13. Product completion gates

### Gate A — Integrated ERP backbone

NuBlox cannot claim broad ERP parity until the following are operational:

- FI-style finance including AP/AR/GL and banking;
- CO-style management controlling;
- MM-style procurement/materials/inventory;
- SD-style sales/order-to-cash;
- PS/PPM-style project/programme/WBS;
- PM/EAM-style maintenance;
- QM-style quality;
- HCM/time/competence;
- logistics/warehouse;
- reporting/BI;
- master-data governance;
- integration platform.

### Gate B — Built-environment operating system

NuBlox cannot claim sector completeness until the following are also integrated:

- design/BIM/CDE/information management;
- construction commercial management;
- site/field operations;
- plant/logistics/deliveries;
- EHS/quality/compliance;
- commissioning/handover;
- property/facilities/real-estate operations;
- asset lifecycle;
- utility/network and mobile-field patterns;
- energy/sustainability evidence;
- professional capability packs spanning the sector taxonomy.

### Gate C — World-class platform

World-class requires more than feature count:

- fast contextual UX;
- excellent mobile workflows;
- enterprise search;
- configurable workflows/templates;
- real-time reporting;
- safe collaboration across organisations;
- resilient integrations;
- excellent import/migration tooling;
- observable/auditable automation;
- accessibility;
- performance and reliability;
- secure defaults;
- explainable, permission-scoped AI assistance where it provides genuine value.

## 14. Immediate next decision

The next development slice should be **Slice 8 — Enterprise Master Data & Organisation Network**, because it resolves the organisation-linking problem in the correct architectural place while establishing master-data governance needed by supplier lifecycle, AP, inventory, service, projects, property and collaboration.

The existing draft collaboration-onboarding work should be treated as input to Slice 8 rather than allowed to define the architecture by itself.

After Slice 8, the default sequence is **Slice 9 Procure-to-Pay & Accounts Payable → Slice 10 Materials/Inventory/Warehouse → Slice 11 Project/Programme/Portfolio Controls**, unless a documented dependency review shows a stronger ordering.
