# 57 — World-Class Native ERP Architecture

**Status:** Governing product architecture  
**Effective:** 21 August 2026  
**Supersedes as roadmap authority:** the remaining slice sequence in `49-v1-product-architecture-and-delivery-sequence.md` and the ecosystem/integration-led expansion model in `13-delivery-roadmap.md`  
**Purpose:** define the complete native ERP capability target for construction and the built environment.

## 1. Product decision

NuBlox is a **world-class, natively engineered ERP and operating platform for construction and the built environment**.

This decision changes the programme boundary in four important ways:

1. SAP and other enterprise products are benchmarks, not dependencies.
2. Core ERP capability must be implemented natively inside NuBlox rather than delegated to another product.
3. Construction and built-environment depth is not an add-on to generic ERP; it is part of the canonical domain model.
4. Delivery is governed by capability completeness and end-to-end business processes rather than by a fixed historical list of V1 slices.

The target enterprise lifecycle is:

**Market → Lead → Opportunity → Bid → Estimate → Proposal → Quote → Contract → Design → Plan → Procure → Produce → Construct → Control → Invoice → Account → Handover → Operate → Maintain → Refurbish → Dispose**

Horizontal enterprise processes run through that lifecycle:

- record-to-report;
- order-to-cash;
- procure-to-pay;
- plan-to-perform;
- hire-to-retire;
- source-to-contract;
- project-to-profit;
- asset-to-retirement;
- property-to-service;
- issue-to-resolution;
- data-to-decision.

## 2. Sector coverage

The National Careers Service construction and built-environment taxonomy contains 84 profiles and explicitly spans physical trades, environmental sustainability, property maintenance, civil engineering and roles from entry level through senior management.

NuBlox therefore cannot be designed only for a main-contractor project office. Its native model must support the operating patterns of:

- developers and asset owners;
- main contractors and construction managers;
- specialist contractors and trades;
- architects and design practices;
- engineering consultancies;
- quantity surveying and commercial practices;
- building control and compliance functions;
- infrastructure and utility delivery;
- building-product manufacturers and prefabricators;
- builders' merchants and distributors;
- plant, fleet and equipment operators;
- property, estates and facilities organisations;
- maintenance and service organisations;
- environmental, energy and sustainability professionals;
- surveying, planning, geospatial and land/property professionals.

The 84 careers remain configuration/composition targets. They do not become 84 independent applications.

## 3. Native-first architecture rule

A material business process may use external transport or infrastructure, but NuBlox must own the process semantics, canonical records, permissions, workflow state, audit evidence and reporting.

### 3.1 Permitted external boundaries

Examples include:

- banking rails and statement feeds;
- card/payment acquiring;
- statutory authority submission endpoints;
- email/SMS transport;
- identity federation;
- geospatial base-map or satellite imagery services;
- object storage and infrastructure services;
- standards-based exchange with customers and supply chains;
- migration from or coexistence with customer legacy systems.

### 3.2 Prohibited product dependency pattern

NuBlox must not say that a customer needs a separate product because NuBlox lacks a core module.

Therefore:

- external accounting software cannot be the statutory ledger of record for a complete NuBlox deployment;
- external payroll software cannot be required to calculate and control payroll;
- external CRM cannot be required for business development;
- external procurement or inventory software cannot be required for source-to-pay or stock control;
- external project software cannot be required for core project/programme management;
- external CDE/BIM software cannot be required for NuBlox information-management workflows;
- external FM/EAM software cannot be required for property, asset or maintenance operations.

Interoperability remains valuable, but it is optional connectivity rather than a substitute for native capability.

## 4. Canonical enterprise model

NuBlox must prevent the duplication common in module-centric ERP.

Canonical entities include, at minimum:

- Party / organisation / person;
- enterprise legal entity and operating unit;
- customer and supplier relationships;
- worker / employee / contingent resource;
- project / programme / portfolio;
- site / property / building / space;
- contract / appointment / subcontract;
- product / material / service / catalogue item;
- asset / component / plant / vehicle;
- cost code / account / cost centre / profit centre;
- document / model / information container;
- schedule / activity / work package;
- commercial change / valuation / claim;
- order / commitment / receipt / invoice / payment;
- work order / service request / inspection;
- risk / issue / action / compliance obligation.

A business role is a relationship to a canonical entity, not a duplicate record. For example, one party may simultaneously be a prospect, customer, supplier, subcontractor and project participant.

## 5. World-class ERP capability domains

### Domain 1 — Enterprise, identity and master data

Native capability target:

- legal entities, groups, divisions, offices, branches and operating units;
- organisation hierarchy and intercompany relationships;
- users, identities, memberships, roles and segregation of duties;
- master-data governance and stewardship;
- configurable numbering/reference schemes;
- currencies, units, calendars, fiscal periods and regional settings;
- customer, supplier, person, material, asset and property master governance;
- approvals, delegated authorities and policy controls;
- audit, retention, archive and legal-hold foundations.

### Domain 2 — CRM, business development and customer management

Native capability target:

- organisations, contacts and relationship networks;
- leads, opportunities and pipelines;
- activities, communications and account plans;
- customer segmentation and qualification;
- framework and key-account management;
- bid/no-bid governance;
- customer service history;
- campaigns and business-development analytics where relevant.

### Domain 3 — Estimating, bidding, tendering, proposals and sales

Native capability target:

- enquiries and invitations to tender;
- estimate structures, assemblies, resources and rates;
- quantity take-off and measurement foundations;
- labour, plant, material and subcontract build-ups;
- preliminaries, overhead, risk, contingency and margin;
- supplier/subcontract quotations and comparison;
- bid reviews and approval gates;
- proposals, quotations and revisions;
- pricing, discounts and commercial terms;
- acceptance, award and controlled conversion to contract/project;
- sales orders for product/service businesses;
- trade-counter/POS capability for merchant use cases.

### Domain 4 — Contracts, commercial management and revenue

Native capability target:

- customer contracts, appointments, subcontracts and frameworks;
- contract clauses, obligations, notices and key dates;
- contract amendments and supplements;
- compensation events/change/variations;
- claims, loss-and-expense and entitlement evidence;
- applications, valuations, assessments and certificates;
- retention, bonds, guarantees and insurance evidence;
- revenue recognition inputs and contract assets/liabilities;
- final-account workflow;
- subcontract payment and pay-less/withholding controls where applicable;
- contract profitability and exposure.

### Domain 5 — Portfolio, programme and project management

Native capability target:

- portfolios, programmes, projects and jobs;
- project charters, objectives and governance;
- WBS, activities, milestones and dependencies;
- critical path and schedule baselines;
- resource loading and capacity;
- project budgets, forecasts and earned/progress measures;
- risk, issue, decision and action registers;
- project change control;
- progress measurement and project controls;
- project close, lessons learned and archive;
- capital-project and customer-project accounting linkage.

### Domain 6 — Design, engineering, BIM and information management

Native capability target:

- design briefs, requirements and deliverables;
- design responsibility matrices;
- document and model registers;
- revisions, suitability/status, issue and transmittals;
- common-data-environment workflow;
- RFIs, technical queries, submittals and approvals;
- design reviews, comments, coordination and clash/issue records;
- model/object metadata and built-asset information requirements;
- specifications and technical schedules;
- drawing/model viewing and markup foundations;
- BIM information containers and open-standard exchange;
- design change impact and approvals;
- commissioning/handover information requirements;
- engineering calculations/technical records where a NuBlox professional capability requires them.

The long-term target is native design/BIM capability appropriate to built-environment workflows, not a permanent dependency on another CDE or BIM management system.

### Domain 7 — Finance and statutory accounting

Native capability target:

- chart of accounts and dimensions;
- double-entry general ledger;
- journals, recurring journals, accruals and prepayments;
- accounts receivable and credit control;
- accounts payable and supplier ledgers;
- customer and supplier invoices/credit notes;
- payment receipts, payment runs and allocation;
- bank accounts, bank reconciliation and cash books;
- VAT/tax calculation, control accounts and returns data;
- fixed-asset accounting and depreciation;
- foreign currency and revaluation;
- intercompany accounting;
- period close and year-end close;
- trial balance, P&L, balance sheet and cash-flow reporting;
- audit trail and controlled corrections;
- statutory reporting foundations and regional localisation.

### Domain 8 — Management accounting, planning, treasury and enterprise performance

Native capability target:

- cost centres, profit centres and responsibility accounting;
- project/job costing;
- activity and resource costing;
- budgets and rolling forecasts;
- scenario planning;
- cash-flow and liquidity forecasting;
- treasury and financial risk;
- profitability analysis;
- group consolidation and eliminations;
- KPI frameworks and management packs;
- strategic planning and enterprise performance management.

### Domain 9 — Procurement, subcontracting and supplier management

Native capability target:

- supplier onboarding, qualification and lifecycle;
- prequalification, compliance and approved supplier lists;
- procurement planning and packages;
- requisitions and approvals;
- RFQs/RFPs and tender comparison;
- purchasing contracts and frameworks;
- purchase orders and subcontract orders;
- change orders and commitments;
- service procurement;
- goods/service receipt;
- invoice matching and verification;
- supplier performance, risk and disputes;
- payment linkage and spend analytics.

### Domain 10 — Materials, inventory, warehouse, distribution and logistics

Native capability target:

- material/product master;
- units, variants, catalogues and substitutions;
- demand planning and material requirements;
- inventory by organisation/site/store/bin;
- reservations, issues, returns and transfers;
- batch/serial/lot controls where applicable;
- goods receipt and inspection;
- stock counts and adjustments;
- warehouse operations;
- delivery planning, picking, packing and dispatch;
- transport planning and delivery tracking;
- site logistics and material call-off;
- merchant distribution and branch stock;
- import/export and trade documentation where required.

### Domain 11 — Production, fabrication and prefabrication

Native capability target for manufacturers, fabricators and off-site construction:

- bills of material;
- routings and work centres;
- production planning and MRP;
- production/work orders;
- capacity planning and levelling;
- shop-floor control;
- quality checks and traceability;
- prefabricated assemblies and configuration;
- make-to-order/project-linked manufacturing;
- waste/scrap and production costing.

### Domain 12 — People, HCM, workforce and payroll

Native capability target:

- people and employment records;
- recruitment and applicant tracking;
- onboarding/offboarding;
- organisation structure and positions;
- contracts, terms and compensation;
- competencies, skills, qualifications and cards;
- training, CPD and expiry management;
- performance and development;
- attendance, leave and absence;
- timesheets and time approval;
- workforce planning, rostering and multi-resource scheduling;
- expenses and travel;
- payroll calculation, deductions, benefits and payment outputs;
- statutory payroll reporting data and regional configuration;
- contingent labour and subcontract workforce records.

### Domain 13 — Site, field and construction operations

Native capability target:

- sites, zones and work areas;
- daily diaries and progress records;
- labour, plant, material and delivery records;
- work packages and production tracking;
- permits and access controls;
- temporary works records;
- inspections and test plans;
- photos, evidence and geotagged records;
- site instructions and actions;
- mobile/offline field workflows;
- completion, snagging and handover readiness.

### Domain 14 — Quality, health, safety, environment and compliance

Native capability target:

- quality plans and ITPs;
- inspection/test records;
- NCRs, defects and corrective/preventive action;
- audits and assurance;
- RAMS and permit evidence;
- hazards, observations, incidents and investigations;
- risk assessments and method statements;
- statutory inspections and compliance registers;
- environmental aspects/impacts;
- waste, pollution and environmental events;
- competency/compliance gates;
- governance, risk and compliance controls;
- building-safety/golden-thread evidence where applicable.

### Domain 15 — Plant, fleet, equipment and enterprise asset management

Native capability target:

- asset hierarchy and technical objects;
- plant/equipment register;
- vehicle/fleet management;
- ownership, hire and allocation;
- inspections, servicing and certification;
- meters, usage and condition;
- preventive/predictive/reactive maintenance;
- work orders and maintenance plans;
- spares and maintenance inventory;
- downtime and utilisation;
- lifecycle cost and replacement planning;
- warranties and asset history.

### Domain 16 — Property, real estate, estates and facilities

Native capability target:

- land/property/building/space hierarchy;
- ownership and occupation;
- leases, licences, rents and service charges;
- property valuation and development records;
- space and occupancy management;
- facilities helpdesk/service requests;
- planned and reactive maintenance;
- statutory compliance schedules;
- contractor management;
- utilities and meter records;
- cleaning/security/soft-FM service management;
- estate budgets and lifecycle plans.

### Domain 17 — Service, maintenance, warranty and aftercare

Native capability target:

- service contracts and entitlements;
- customer service cases;
- defects-liability/aftercare periods;
- warranty claims;
- field-service planning and dispatch;
- engineer/operative mobile work;
- parts and materials consumption;
- service quotations and billing;
- SLA measurement;
- installed-base history and customer asset records.

### Domain 18 — Sustainability, carbon and environmental performance

Native capability target:

- organisational and project carbon data;
- embodied and operational carbon structures;
- energy and utilities;
- waste and circularity;
- material provenance and environmental attributes;
- sustainability targets and performance;
- environmental compliance evidence;
- social-value and responsible-procurement records;
- climate and resilience risks;
- sustainability reporting data.

### Domain 19 — Data, workflow, analytics, search and intelligence

Native capability target:

- enterprise search and discovery;
- configurable workflows and approvals;
- notifications and action centre;
- event/outbox and automation engine;
- document/report generation;
- operational and financial reporting;
- dashboards and drill-through analytics;
- BI semantic layer and governed metrics;
- forecasting and anomaly detection;
- master-data quality controls;
- API/webhooks for interoperability;
- AI assistance with provenance, permission and human-control boundaries;
- audit, observability and administration.

## 6. SAP benchmark crosswalk

The SAP module list supplied for benchmarking contains 64 named modules. NuBlox does not need to reproduce SAP's product naming or technical architecture, but materially relevant business capability must be represented natively.

| SAP benchmark | NuBlox native treatment |
| --- | --- |
| APO | Demand, supply, production, material and resource planning across Domains 5, 10 and 11 |
| BI | Domain 19 governed analytics and semantic reporting |
| BPC | Domain 8 budgeting, planning, forecasting and consolidation |
| Cash Management | Domains 7–8 banking, liquidity and cash forecasting |
| Convergent Charging | Native charging/rating patterns within sales, service and utilities where required |
| CO | Domain 8 management accounting, cost/profit centres and profitability |
| CRM | Domain 2 |
| Customer Service | Domain 17 |
| Data Services | Domain 19 import, transformation, data quality and governed exchange |
| EHS | Domain 14 |
| EAM | Domain 15 |
| Event Management | Domain 19 business events/automation plus logistics event tracking |
| Extended Financial Management | Domains 7–8 |
| EWM | Domain 10 warehouse operations |
| RE-FX | Domain 16 leases/property/facilities |
| FI | Domain 7 |
| Funds Management | Domain 8 budget/fund controls where applicable |
| GTS | Domain 10 trade/import/export controls where applicable |
| GRC | Domains 1 and 14 governance/risk/compliance |
| HCM | Domain 12 |
| Incentive and Commission Management | Domain 12 compensation plus sales incentive rules where required |
| IBP | Domains 8, 10 and 11 integrated planning |
| IPPE | Domains 6 and 11 engineering/configuration structures |
| Library / Documentation | Domain 6 controlled information and Domain 19 knowledge/documentation |
| MDG | Domain 1 master-data governance |
| MDG-M | Domain 1/10 material master governance |
| MDG-S | Domain 1/9 supplier master governance |
| MM | Domains 9–10 |
| MRS | Domains 5 and 12 resource scheduling |
| NetWeaver | Not copied as a product; equivalent platform/integration/runtime concerns live in Domain 19 and the NuBlox platform kernel |
| Oil & Gas | Industry-specific concepts are represented through project, asset, engineering, HSE and supply-chain capabilities when NuBlox serves energy/infrastructure construction |
| PM | Domain 15 |
| POS | Domain 3 merchant/trade-counter sales capability |
| PPM | Domain 5 |
| Predictive Analytics | Domain 19 |
| Process Integration | Domain 19 APIs/events/interoperability; not a substitute for native modules |
| PLM | Domains 6, 10 and 11 product/design lifecycle capability |
| PP | Domain 11 |
| PS | Domain 5 with construction-commercial depth in Domains 4, 6, 9 and 13 |
| QM | Domain 14 and production quality in Domain 11 |
| RE | Domain 16 |
| RTOM | Native pricing/offer decision capability in Domains 2–3 where business value justifies it |
| Retail | Merchant/distribution/POS capabilities across Domains 3 and 10 rather than a separate generic retail product |
| S/4HANA Finance | Domains 7–8 |
| S/4HANA Supply Chain | Domains 9–11 |
| SD | Domains 2–4 and 10 for delivery/distribution |
| Service Parts Planning | Domains 10, 15 and 17 |
| Solution Manager | Domain 19 administration, observability, lifecycle and release operations; engineering delivery remains part of the NuBlox development platform |
| SEM | Domain 8 strategic enterprise performance |
| SEM-IP | Domain 8 integrated planning |
| Supplier Lifecycle Management | Domain 9 |
| SRM | Domain 9 |
| SCM | Domains 9–11 |
| TDMS | Domain 19 controlled data migration/test-data tooling |
| Time and Attendance | Domain 12 |
| Trade Promotion Management | Domain 2/3 commercial promotion capability where merchant/product organisations require it |
| Transportation Management | Domain 10 |
| Treasury and Risk Management | Domain 8 |
| Travel Management | Domain 12 expenses/travel |
| UX | Cross-cutting NuBlox experience architecture, accessibility and context-first workspaces |
| Variant Configuration | Domains 3, 10 and 11 product/service configuration |
| Vehicle Management System | Domain 15 fleet/vehicle lifecycle |
| Warehouse Management | Domain 10 |
| Xapps / Cross-Applications | Cross-domain workflow and intelligence in Domain 19; NuBlox remains one coherent native product |

This crosswalk is a minimum parity check, not the NuBlox product structure.

## 7. Construction and built-environment superiority test

Generic ERP parity is insufficient. NuBlox must provide first-class domain relationships that a generic ERP usually requires configuration or specialist products to represent.

At minimum, the following chain must be natively traceable:

**Opportunity → Tender → Estimate → Quote/Proposal → Contract → Project → WBS/Programme → Procurement Package → Subcontract/PO → Instruction/Change → Forecast → Valuation/Application → Invoice/Payment → Final Account → Handover → Asset → Maintenance/Service**

The system should be able to explain financial, programme, contractual, procurement and operational consequences of a material business event without forcing the user to re-enter the event in separate modules.

### Example: instructed change

A controlled instruction/change event may create or update linked evidence for:

- contract entitlement;
- estimate and cost build-up;
- budget/forecast;
- programme effect;
- procurement/subcontract exposure;
- client valuation;
- subcontract valuation;
- revenue and margin forecast;
- risk and action registers;
- audit and approvals.

The links are explicit and controlled; downstream financial postings occur only when the relevant accounting event is valid and approved.

## 8. UX operating model

World-class breadth must not recreate module-hopping.

### 8.1 Global navigation represents business areas

Target business-area workspaces include:

- Home / My Work;
- Customers & Sales;
- Projects & Programmes;
- Commercial & Contracts;
- Finance;
- Supply Chain;
- People;
- Design & Information;
- Site / Quality / HSE;
- Materials & Logistics;
- Plant & Assets;
- Property & Facilities;
- Service;
- Reporting & Planning;
- Administration.

The exact shell may progressively expose these as capabilities become active.

### 8.2 Context represents the business object

Opening a customer, project, supplier, employee, asset or property creates a contextual workspace over the same native domain services.

Examples:

**Customer:** Overview · Contacts · Opportunities · Estimates · Quotations · Contracts · Projects · Invoices · Service · Documents

**Project:** Overview · Team · Programme · Design · Documents · Procurement · Commercial · Site · Quality · Safety · Plant · Finance · Handover

**Supplier:** Overview · Contacts · Qualification · RFQs · Contracts · Orders · Deliveries · Invoices · Performance · Compliance

**Asset:** Overview · Technical data · Location · Documents · Inspections · Maintenance · Work orders · Parts · Costs · Compliance · History

The user should navigate by intent and context, not by knowing the internal module/table that owns a record.

## 9. Capability maturity model

Each domain capability is tracked at one of five maturity levels:

- **L0 — absent:** no reliable native capability;
- **L1 — foundation:** schema/service primitives exist but do not complete the business process;
- **L2 — operational:** principal transactional workflow works with permissions/audit/tests;
- **L3 — enterprise:** controls, reporting, scale, exceptions and cross-domain consequences are mature;
- **L4 — world-class:** domain depth, automation, UX and decision support meet or exceed leading specialist/ERP benchmarks.

A route or table alone does not raise maturity.

## 10. Current-state positioning at August 2026

The existing implementation is valuable and remains the foundation. It already provides L1/L2 capability in substantial areas including:

- identity, organisations, tenancy, permissions and audit;
- CRM parties, contacts, opportunities and activities;
- estimates, quotations and quotation-to-project conversion;
- contracts and amendments;
- projects and project teams;
- accounts receivable, credit notes, payments, collections and credit control;
- accounting posting, periods, trial balance/reporting and year-end controls;
- workforce/time/scheduling foundations;
- documents/project information;
- procurement and project commercial-control foundations;
- site/quality/safety foundations;
- assets/facilities/maintenance foundations;
- portal/cross-organisation collaboration;
- contextual navigation/workspace foundations.

These capabilities are not discarded. They are progressively deepened and connected into the complete ERP model.

## 11. Gap-driven implementation sequence

The historical V1 slices are no longer the governing sequence. From this point, delivery is selected from the capability map according to dependency and enterprise value while preserving a green system.

### Wave A — Enterprise and accounting completeness

Priority gaps:

- enterprise/master-data governance;
- complete chart-of-accounts and financial dimensions;
- native accounts payable;
- supplier invoice capture/approval/matching;
- payment runs;
- bank/cash management and reconciliation;
- fixed assets;
- accruals/prepayments and recurring journals;
- tax/VAT return controls;
- stronger financial statements and localisation foundations;
- intercompany foundations.

Exit: NuBlox can operate a controlled record-to-report and procure-to-pay finance core without another accounting product.

### Wave B — Supply chain, materials and cost integration

Priority gaps:

- requisitions and procurement planning;
- supplier lifecycle/prequalification;
- purchasing contracts and deeper subcontract management;
- goods/service receipt and three-way matching;
- material master;
- inventory/stores/warehouse;
- site material call-off and delivery logistics;
- project commitment-to-actual integration.

Exit: purchasing, stock/material movement and financial consequences are one controlled chain.

### Wave C — Enterprise project and commercial controls

Priority gaps:

- WBS/programme/critical-path depth;
- resource/capacity planning;
- project controls and progress measurement;
- estimating/tender depth including take-off/resource build-up;
- contract obligations/notices/claims;
- applications/certification/retention/final accounts;
- integrated cost-value reconciliation, forecast and profitability.

Exit: a complex contractor/consultant project can be planned, commercially controlled and financially reported end to end.

### Wave D — People, HCM and payroll

Priority gaps:

- employment/position model;
- recruitment/onboarding;
- competencies/training/expiry;
- leave/absence;
- expenses/travel;
- workforce planning;
- payroll engine and statutory reporting data.

Exit: hire-to-retire and pay processes are native.

### Wave E — Design, BIM and information lifecycle

Priority gaps:

- design responsibility/deliverables;
- CDE workflow depth;
- model/document coordination;
- technical review/markup/issue management;
- asset-information requirements and handover;
- native BIM information/model capability appropriate to NuBlox workflows.

Exit: design-to-handover information can be managed without requiring another CDE as the system of record.

### Wave F — Production, logistics and merchant operations

Priority gaps:

- BOM/routing/work centres;
- MRP/production orders/capacity;
- warehouse/distribution depth;
- transport planning;
- configurable products;
- trade counter/POS;
- branch/catalogue/pricing capability.

Exit: fabricators, product businesses and merchants can operate natively.

### Wave G — Property, asset, facilities and service depth

Priority gaps:

- real-estate/lease/space management;
- advanced EAM and maintenance planning;
- fleet/vehicle lifecycle;
- service contracts/SLAs/field service;
- warranty/aftercare;
- utility/meter and lifecycle-cost controls.

Exit: construction handover can continue seamlessly into operation, maintenance and service.

### Wave H — Sustainability, enterprise planning and intelligence

Priority gaps:

- carbon/energy/waste/material sustainability;
- enterprise budgets/rolling forecasts;
- treasury/liquidity;
- consolidation;
- governed BI semantic layer;
- configurable workflow/automation;
- intelligent assistance and predictive capability.

Exit: management can plan, control and optimise the enterprise from governed NuBlox data.

Waves are dependency groups, not waterfall phases. A vertical customer workflow may pull a capability forward when its dependencies and controls are satisfied.

## 12. World-class implementation gate

Every new capability must answer:

1. What canonical business entity/event does it own?
2. How does it reuse existing NuBlox master data rather than duplicate it?
3. What permissions and segregation-of-duties controls apply?
4. What lifecycle states and immutable evidence are required?
5. What audit evidence is produced?
6. What financial, project, commercial, supply-chain, workforce or asset consequences can it create?
7. What concurrency/idempotency controls prevent invalid state?
8. What reports and decisions depend on the data?
9. How is the workflow usable in the user's real business context?
10. What proves it is native rather than a thin redirect to another product?
11. Which SAP/ERP benchmark capability does it cover or exceed?
12. Which built-environment careers/workflows benefit from it?
13. What automated tests prove happy path, denial, lifecycle and tenant isolation?

## 13. Release quality invariants

The existing NuBlox engineering invariants remain mandatory:

- tenant isolation;
- server-side authorisation;
- project/organisation scope enforcement;
- controlled public identifiers;
- complete auditability of material writes;
- immutable/controlled financial and contractual evidence;
- relational integrity and transactions;
- concurrency safety;
- WCAG 2.2 AA target;
- responsive/mobile operation;
- no duplicate domain models;
- forward-only migrations;
- generated database types must match migrations;
- real-MySQL integration coverage;
- clean diagnostics, lint and production build;
- browser acceptance for principal workflows.

World-class breadth does not justify weakening any security or accounting invariant.

## 14. Benchmark sources

The capability benchmark was re-baselined on 21 August 2026 using:

- UK National Careers Service — Construction and the built environment sector and its 84 career profiles;
- the supplied Uneecops 2025 A–Z list of 64 SAP modules and its functional-module descriptions;
- current SAP S/4HANA Cloud capability areas, including finance, asset management, professional services/projects, sales, service, sourcing/procurement, supply chain, transportation, warehouse management, manufacturing/product engineering and human resources.

Benchmark names are used only to test coverage. NuBlox's architecture remains domain-led and native to the construction and built-environment industry.

## 15. Immediate programme decision

Before starting the previously proposed API/webhooks slice as the next major product boundary, NuBlox will use this architecture to select the highest-value native ERP gap.

The initial recommendation is **Wave A: native enterprise and accounting completeness**, beginning with the missing procure-to-pay/accounts-payable chain and its direct links to procurement, commitments, supplier records, tax, ledger and cash.

APIs/webhooks remain a platform capability in Domain 19 and will be delivered when they support native NuBlox processes; they no longer define the next product slice by themselves.
