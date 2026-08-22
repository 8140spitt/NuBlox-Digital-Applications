# Construction and the Built Environment

**Status:** Governing domain model  
**Effective:** 22 August 2026  
**Scope:** NuBlox Digital Applications  
**Purpose:** define the complete Construction and Built Environment operating model that NuBlox must support natively, and provide one authoritative sector reference for product, data, workflow and capability design.

This document supersedes the overlapping product authority previously split between `57-world-class-native-erp-architecture.md` and `built-environment-erp-capability-blueprint.md`.

## 1. Product decision

NuBlox is a **world-class, natively engineered ERP and operating platform for construction and the built environment**.

It is not a generic ERP with construction screens attached, and it is not a project-management application with accounting bolted on. It must operate both:

1. the **enterprise** — customers, suppliers, finance, people, payroll, procurement, materials, inventory, logistics, manufacturing, property, assets, service, governance and reporting; and
2. the **built environment lifecycle** — development, planning, design, engineering, estimating, contracting, project delivery, commercial control, site operations, quality, safety, commissioning, handover, operation, maintenance, refurbishment and disposal.

The canonical enterprise lifecycle remains:

**Market → Lead → Opportunity → Bid → Estimate → Proposal → Quote → Contract → Design → Plan → Procure → Produce → Construct → Control → Invoice → Account → Handover → Operate → Maintain → Refurbish → Dispose**

NuBlox owns the canonical business records, lifecycle state, permissions, workflow, audit evidence and reporting for material native processes. External systems are interoperability boundaries and benchmarks, not substitutes for missing core capability.

## 2. What “Construction and the Built Environment” includes

The product boundary is the creation, alteration, operation and retirement of built assets and the enterprises that finance, design, deliver, supply, regulate, own, occupy and maintain them.

### 2.1 Built-asset classes

NuBlox must support, without separate product forks:

- residential buildings and housing portfolios;
- commercial offices, retail, hospitality and mixed-use property;
- education, healthcare, care, civic and public buildings;
- industrial, manufacturing, laboratory, logistics and warehouse facilities;
- data centres and other mission-critical facilities;
- transport infrastructure including roads, rail, bridges, tunnels, airports and ports;
- water, wastewater, drainage and flood infrastructure;
- energy, utility and telecommunications infrastructure;
- public realm, landscape, parks and urban infrastructure;
- land, development sites and estates;
- existing buildings, heritage assets and conservation work;
- temporary works and temporary facilities where they require controlled engineering records;
- plant, equipment, fleet and movable assets used to create or operate the built environment;
- prefabricated, modular and manufactured building systems and components.

### 2.2 Organisation archetypes

The same platform must support:

- developers, investors and asset owners;
- clients and programme sponsors;
- main contractors and construction managers;
- specialist contractors, subcontractors and trades;
- architects and multidisciplinary design practices;
- civil, structural, geotechnical, building-services, fire and specialist engineering consultancies;
- quantity surveyors, cost consultants and commercial-management practices;
- project managers, programme managers and employer/client representatives;
- building surveyors, land surveyors, geomatics and geospatial practices;
- planning, development and property consultancies;
- building control, inspection and regulator-facing functions;
- manufacturers, fabricators, off-site constructors and product suppliers;
- builders’ merchants, distributors and logistics organisations;
- plant, lifting, access, fleet and equipment providers;
- utilities and infrastructure operators;
- landlords, property managers, estates and facilities organisations;
- maintenance, service, warranty and aftercare organisations;
- sustainability, carbon, energy and environmental specialists;
- sole traders and small firms through to multi-entity international groups.

### 2.3 Professional and trade coverage

The NuBlox career taxonomy remains a configuration and experience layer covering the sector’s professional, technical, managerial and trade roles. Careers do not define separate databases or applications.

A career is not an organisation role, a project role or a permission.

**Career ≠ Organisation Role ≠ Project Role ≠ Permission**

Professional workspaces are composed from the same canonical capabilities and records.

## 3. Whole-life operating lifecycle

NuBlox must support a continuous information and commercial thread across the complete asset lifecycle.

| Lifecycle phase | Required operating scope |
| --- | --- |
| Strategy and market | portfolio strategy, market intelligence, investment objectives, customer/account development, pipeline and opportunities |
| Feasibility and acquisition | business case, site/asset appraisal, surveys, constraints, land/property interests, option analysis, funding and development appraisal |
| Brief and definition | client requirements, project brief, outcomes, scope, governance, procurement strategy, information requirements, cost and carbon targets |
| Design and engineering | concept, spatial coordination, technical design, specifications, calculations, models, approvals, design responsibility and change control |
| Estimate and tender | measurement, take-off, resource build-up, risk, preliminaries, supplier/subcontract enquiries, tender analysis, bid governance, proposal and quotation |
| Contract and mobilisation | appointments, main contracts, subcontracts, obligations, notices, insurance/bond evidence, mobilisation, project baseline and controls |
| Procure and produce | procurement packages, sourcing, purchase/subcontract orders, material planning, fabrication, production, quality, logistics and delivery |
| Construct and install | site establishment, work packages, labour/plant/material control, temporary works, permits, daily records, progress and field evidence |
| Control and assure | schedule, cost, change, risk, quality, safety, environmental, information, commercial and regulatory control |
| Test and commission | inspections, testing, witnessing, commissioning, balancing, certification, defects and readiness |
| Handover and close | asset information, manuals, certificates, training, completion, defects, final account, project close and lessons learned |
| Operate and service | occupancy, service desk, asset operation, utilities, service contracts, customer service, compliance and performance |
| Maintain and inspect | planned, preventive, predictive and reactive maintenance, statutory inspections, spares, condition and lifecycle cost |
| Renew and refurbish | retrofit, adaptation, repair, replacement, decarbonisation, refurbishment and major lifecycle interventions |
| Decommission and dispose | decommissioning, demolition, reuse, recovery, disposal, land/asset release and retained historical evidence |

The RIBA Plan of Work 2020 stages 0–7 are a supported design-and-construction lifecycle overlay, not the sole NuBlox lifecycle. NuBlox must also cover pre-project enterprise activity, infrastructure delivery patterns and the full operational life of assets.

## 4. Orthogonal architecture dimensions

NuBlox must not collapse different taxonomies into one hierarchy. The following dimensions are related but distinct:

1. **Enterprise functions** — what an organisation does. The machine-readable taxonomy currently contains 29 functions, 353 sub-functions and 1,510 source activities.
2. **Native capability domains** — what product capability NuBlox must own. NuBlox uses the 19 domains in section 7.
3. **Lifecycle stage** — when work occurs in an enterprise, project or asset lifecycle.
4. **Organisation role** — authority held in an organisation.
5. **Project role** — responsibility held on a project or programme.
6. **Career / profession / trade** — professional context and capability composition.
7. **Permission** — an explicit server-authoritative action entitlement.
8. **Asset/location classification** — what physical or spatial object work concerns.
9. **Work breakdown / cost classification** — how scope, cost, schedule, resources and responsibility are decomposed.
10. **Jurisdiction and regulatory overlay** — which legal, tax, safety and statutory rules apply.

Mappings between these dimensions must be explicit, versioned and governed. They must not be inferred merely because names appear similar.

## 5. Canonical enterprise and built-asset model

NuBlox uses one canonical record for a real business concept and reuses it across domains.

### 5.1 Party and organisation

Canonical concepts include:

- party;
- organisation and person;
- legal entity, group, division, branch and operating unit;
- customer, prospect, supplier, subcontractor, consultant and project-participant relationships;
- contact methods and addresses;
- organisation ownership and hierarchy;
- membership, team and delegated authority.

One organisation may simultaneously be a customer, supplier, subcontractor, consultant and project participant. Those are relationships, not duplicate organisation records.

### 5.2 People and workforce

Canonical concepts include:

- person;
- worker, employee, contingent worker and subcontract labour relationship;
- employment/engagement terms;
- position, team and reporting line;
- career/profile;
- skills, competency, qualification, card, licence and training evidence;
- availability, shift, time, absence and allocation;
- compensation, payroll and expense records.

### 5.3 Portfolio, project and work

Canonical concepts include:

- portfolio, programme, project and job;
- site, phase, zone and work area;
- WBS, work package, task/activity and milestone;
- schedule, dependency, baseline and progress measure;
- project participant, responsibility and governance body;
- risk, issue, decision, action and change;
- budget, forecast, commitment, actual and earned/progress measure.

### 5.4 Property, space, system and asset

A common physical hierarchy must be able to represent:

**estate / network → site → property / facility → building / infrastructure entity → zone / level / space / segment → system → asset / component → maintainable item**

The hierarchy must remain flexible enough for buildings, infrastructure and linear/network assets.

Canonical concepts include:

- land and property interest;
- property/building/space;
- infrastructure entity and linear reference;
- system and subsystem;
- asset, component and maintainable item;
- plant, equipment, vehicle and tool;
- meter, sensor and condition point;
- warranty, service history and lifecycle status.

### 5.5 Products, materials and production

Canonical concepts include:

- product/material/service master;
- specification and technical attributes;
- unit of measure, variant and substitution;
- manufacturer and supplier relationships;
- catalogue and price/rate;
- BOM/assembly;
- batch, lot and serial traceability;
- inventory and stock position;
- production/fabrication order.

### 5.6 Information and design

Canonical concepts include:

- information requirement;
- document, drawing, model and information container;
- revision, status, suitability and issue purpose;
- transmittal and distribution;
- specification and schedule;
- RFI, technical query, submittal and response;
- design review, comment, coordination issue and clash/issue record;
- calculation and technical evidence;
- asset information requirement and handover deliverable.

### 5.7 Contract and commercial

Canonical concepts include:

- opportunity, bid and estimate;
- proposal and quotation;
- appointment, contract, subcontract and framework;
- clause, obligation, notice and key date;
- package, tender and bid return;
- change, variation, compensation event and instruction;
- valuation, application, assessment and certificate;
- claim and entitlement evidence;
- retention, bond, guarantee and insurance evidence;
- final-account record.

Contract-form families such as NEC, JCT, FIDIC and organisation-specific forms must be implemented through configurable contract semantics and templates. Product architecture must not hard-code one contract family as the universal workflow.

### 5.8 Finance and transaction chain

Canonical concepts include:

- chart of accounts and financial dimensions;
- cost code, cost centre and profit centre;
- budget and forecast;
- requisition, purchase order, subcontract order and commitment;
- receipt, invoice, credit note and payment;
- journal and accounting period;
- customer receivable and supplier payable evidence;
- fixed asset and depreciation record;
- tax/VAT and statutory reporting evidence.

Operational source events must flow into commercial and accounting consequences without re-keying the same business fact.

## 6. Project control structures

Construction requires multiple linked breakdown structures. NuBlox must support them without pretending they are interchangeable.

- **WBS** — scope/work breakdown.
- **CBS** — cost breakdown.
- **OBS** — organisational responsibility.
- **RBS** — resource breakdown.
- **PBS / asset breakdown** — product or physical asset decomposition.
- **Schedule/activity hierarchy** — time and dependency structure.
- **Location breakdown** — site, zone, level, area, chainage/segment or space.
- **Document/information classification** — information containers and deliverables.
- **Contract/procurement package structure** — buying and commercial responsibility.

Mappings between these structures must support cost loading, schedule integration, earned/progress measurement, procurement status, resource planning and handover traceability.

## 7. The 19 native NuBlox capability domains

These are the stable product capability boundaries. They are not intended to become 19 disconnected applications or navigation items.

### Domain 1 — Enterprise, identity and master data

Native scope:

- groups, legal entities, operating units, branches, offices and teams;
- users, identities, memberships and invitations;
- careers, organisation roles, project roles and permissions as distinct concepts;
- delegated authority, approval limits and segregation of duties;
- party/customer/supplier/person master governance;
- numbering, currencies, units, calendars, tax and regional settings;
- master-data stewardship, merge/deduplication and controlled change;
- audit, retention, archive and legal-hold foundations.

### Domain 2 — CRM, business development and customer management

Native scope:

- organisations, contacts and relationship networks;
- leads, opportunities and pipelines;
- activities, communications and account plans;
- frameworks and key accounts;
- customer segmentation and qualification;
- bid/no-bid governance;
- customer service and relationship history;
- pipeline forecasting and business-development analytics.

### Domain 3 — Estimating, bidding, tendering, proposals and sales

Native scope:

- enquiries and invitations to tender;
- take-off and measurement foundations;
- estimate structures, assemblies, resources and rates;
- labour, plant, material and subcontract build-ups;
- preliminaries, overheads, risk, contingency and margin;
- supplier/subcontract quotation requests and comparison;
- tender adjudication and approval gates;
- proposals, quotations, revisions and commercial terms;
- acceptance and controlled conversion to contract/project;
- sales orders, merchant/trade-counter patterns where applicable.

### Domain 4 — Contracts, commercial management and revenue

Native scope:

- appointments, customer contracts, subcontracts and frameworks;
- obligations, notices, key dates and correspondence;
- amendments and supplemental agreements;
- changes, variations and compensation events;
- claims, entitlement and loss/expense evidence;
- applications, valuations, assessments and certificates;
- retention, withholding, bonds, guarantees and insurance;
- contract revenue and commercial exposure;
- final accounts and contract profitability.

### Domain 5 — Portfolio, programme and project management

Native scope:

- portfolios, programmes, projects and jobs;
- business case, charter, objectives and governance;
- WBS, milestones, dependencies, critical path and baselines;
- resource loading, capacity and project calendars;
- risk, issue, decision and action registers;
- change control;
- progress measurement and project controls;
- project budgets, forecasts and performance;
- closeout, lessons learned and archive.

### Domain 6 — Design, engineering, BIM and information management

Native scope:

- briefs, requirements and information requirements;
- surveys and design inputs;
- design responsibility and deliverable matrices;
- documents, drawings, specifications, schedules and models;
- revisions, status, suitability, issue and transmittal control;
- common-data-environment workflow;
- RFIs, technical queries, submittals and approvals;
- design reviews, comments and coordination issues;
- calculations and technical evidence;
- BIM/openBIM metadata and asset information;
- model/object viewing and markup foundations;
- design change impact and controlled approvals;
- commissioning/handover information requirements.

### Domain 7 — Finance and statutory accounting

Native scope:

- chart of accounts and dimensions;
- double-entry general ledger;
- receivables and payables;
- customer and supplier invoices/credit notes;
- receipts, payments and allocations;
- bank accounts and reconciliation;
- journals, recurring journals, accruals and prepayments;
- VAT/tax controls and return data;
- fixed-asset accounting and depreciation;
- foreign currency and revaluation;
- intercompany accounting;
- period and year-end close;
- trial balance, P&L, balance sheet and cash-flow foundations;
- controlled correction and immutable audit evidence;
- regional statutory reporting foundations.

### Domain 8 — Management accounting, planning, treasury and enterprise performance

Native scope:

- project/job costing;
- cost centres, profit centres and responsibility accounting;
- budgets, cost plans and rolling forecasts;
- scenario planning;
- cash-flow and liquidity forecasting;
- treasury and financial risk;
- profitability and margin analysis;
- consolidation and eliminations;
- KPI frameworks, management packs and strategic planning.

### Domain 9 — Procurement, subcontracting and supplier management

Native scope:

- supplier onboarding, qualification and approved lists;
- procurement planning and packages;
- requisitions and approvals;
- RFQ/RFP and tender comparison;
- purchasing contracts and frameworks;
- purchase orders and subcontract orders;
- change orders and commitments;
- service procurement;
- goods/service receipt;
- supplier invoice matching and verification;
- supplier performance, risk and dispute management;
- spend and commitment analytics.

### Domain 10 — Materials, inventory, warehouse, distribution and logistics

Native scope:

- material/product master and catalogues;
- demand and material requirements;
- inventory by organisation, site, store, warehouse and bin;
- reservations, issues, returns and transfers;
- batch/serial/lot traceability;
- goods receipt and inspection;
- stock counts and controlled adjustments;
- warehouse put-away, pick, pack and dispatch;
- delivery planning and tracking;
- site logistics and call-off;
- merchant/distributor branch stock;
- import/export and trade-document foundations where required.

### Domain 11 — Production, fabrication and prefabrication

Native scope:

- bills of material and configurable assemblies;
- routings and work centres;
- production/MRP planning;
- production and fabrication orders;
- capacity planning and levelling;
- shop-floor progress;
- quality and traceability;
- off-site and modular manufacture;
- project-linked make-to-order production;
- waste, scrap and production costing.

### Domain 12 — People, HCM, workforce and payroll

Native scope:

- people and employment/engagement records;
- recruitment, onboarding and offboarding;
- positions, organisation structures and teams;
- contracts, terms and compensation;
- competencies, skills, qualifications, licences, cards and training;
- CPD and expiry management;
- performance and development;
- attendance, leave and absence;
- timesheets and approval;
- workforce planning, rostering and multi-resource scheduling;
- expenses and travel;
- native payroll calculation and outputs;
- regional payroll/statutory configuration;
- contingent and subcontract workforce.

### Domain 13 — Site, field and construction operations

Native scope:

- site, zone and work-area control;
- mobilisation and access;
- daily diaries and progress records;
- work packages, task allocation and production tracking;
- labour, plant, material and delivery records;
- temporary works registers and engineering evidence;
- permits, isolations and work controls;
- photos, geotagged evidence and field forms;
- instructions, constraints and actions;
- mobile/offline-first workflows;
- completion, snagging and handover readiness.

### Domain 14 — Quality, health, safety, environment and compliance

Native scope:

- quality plans and inspection/test plans;
- inspection and test records;
- NCRs, defects, snags and corrective/preventive actions;
- audits and assurance;
- RAMS and permit evidence;
- hazards, observations, incidents and investigations;
- risk assessments and method statements;
- statutory inspections and compliance registers;
- environmental aspects, impacts, waste and pollution events;
- competency/compliance gates;
- governance, risk and regulatory evidence;
- building-safety and golden-thread information where jurisdictionally applicable.

### Domain 15 — Plant, fleet, equipment and enterprise asset management

Native scope:

- asset hierarchy and technical objects;
- plant, equipment, tools and fleet;
- ownership, hire, allocation and location;
- inspections, servicing and certification;
- meters, usage and condition;
- preventive, predictive and reactive maintenance;
- work orders and maintenance plans;
- spares and maintenance inventory;
- downtime, utilisation and availability;
- lifecycle cost, warranty and replacement planning.

### Domain 16 — Property, real estate, estates and facilities

Native scope:

- land/property/building/space hierarchy;
- ownership, occupation and interests;
- leases, licences, rents and service charges;
- valuations and development/property records;
- space and occupancy management;
- facilities helpdesk and service requests;
- planned and reactive maintenance;
- statutory compliance schedules;
- contractor and service-provider management;
- utilities, meters and consumption;
- cleaning, security and soft-FM service management;
- estate budgets and lifecycle plans.

### Domain 17 — Service, maintenance, warranty and aftercare

Native scope:

- service contracts and entitlements;
- customer service cases and requests;
- defects-liability/aftercare periods;
- warranty claims;
- field-service planning, scheduling and dispatch;
- operative/engineer mobile work;
- parts and materials consumption;
- service quotes and billing;
- SLA measurement;
- installed-base and customer-asset history.

### Domain 18 — Sustainability, carbon and environmental performance

Native scope:

- organisation, portfolio, project and asset carbon structures;
- embodied, operational and user carbon data;
- energy and utilities;
- waste, recovery, reuse and circularity;
- material provenance and environmental attributes;
- sustainability targets, budgets and performance;
- environmental compliance evidence;
- social value and responsible procurement;
- climate and resilience risks;
- whole-life cost/carbon linkage;
- sustainability reporting data.

### Domain 19 — Data, workflow, analytics, search and intelligence

Native scope:

- enterprise search and discovery;
- configurable workflow and approvals;
- Work Kernel action/assignment/decision semantics;
- notifications and action centre;
- durable event/outbox and automation;
- document/report generation;
- operational and financial reporting;
- dashboards and drill-through analytics;
- governed metrics and semantic models;
- forecasting, anomaly detection and scenario support;
- master-data quality controls;
- APIs, webhooks, import/export and integration adapters;
- AI assistance with provenance, permission and human-control boundaries;
- observability, audit and platform administration.

## 8. Built-environment specialist overlays

The 19 domains are enterprise capability boundaries. The following overlays define the sector depth those domains must achieve.

### 8.1 Architecture and design

- briefing and option development;
- planning/design-stage outputs;
- architectural drawings, models, schedules and specifications;
- design reviews and approvals;
- design responsibility and consultant appointments;
- coordination, change, technical queries and construction-stage support;
- inclusive design, security and design-for-use outcomes where required.

### 8.2 Civil, structural, geotechnical and infrastructure engineering

- surveys, investigations and constraints;
- calculations, design checks and technical approvals;
- alignment, chainage and linear/network assets;
- structures, earthworks, drainage and utilities;
- inspection, testing and as-built evidence;
- temporary works and design-category controls;
- interface management across packages and disciplines.

### 8.3 Building services and specialist engineering

- systems/equipment schedules;
- MEP design and coordination;
- installation work packages;
- device/equipment metadata;
- testing, balancing, commissioning and witnessing;
- controls/BMS integration evidence;
- fire/life-safety systems and specialist certifications;
- handover into maintainable operational assets.

### 8.4 Surveying, cost and commercial management

- feasibility and development appraisal;
- cost plans and estimates;
- measurement, BoQ and quantified schedules;
- tendering and procurement analysis;
- contracts and subcontracts;
- variations/compensation events;
- applications, valuations, certificates and retention;
- commitments, accruals, actuals and forecast;
- CVR/project profitability and final account;
- whole-life cost and maintenance cost planning.

### 8.5 Planning, property, land and development

- site/land/property records;
- ownership, interests and constraints;
- planning/appraisal evidence;
- surveys and valuations;
- development feasibility and option comparison;
- consents, obligations and planning conditions;
- property transactions and estate strategy interfaces.

### 8.6 Main contracting and construction management

- mobilisation and project governance;
- packages, programme and procurement;
- project/site controls;
- subcontract management;
- design coordination;
- cost, change, risk and progress;
- site logistics and production;
- quality, safety and environmental assurance;
- commissioning, handover and closeout.

### 8.7 Specialist contractors and trades

- enquiries, estimating and quotations;
- labour/crew planning;
- plant, tools and materials;
- work packs and job sheets;
- permits and competence checks;
- installation evidence and inspections;
- variations and dayworks;
- testing/certification;
- service, warranty and maintenance continuity.

### 8.8 Manufacturing, DfMA and off-site construction

- design-for-manufacture data;
- configured products and assemblies;
- BOM, routing, production and capacity;
- quality/traceability;
- project-linked manufacture;
- logistics sequencing and delivery;
- site installation and commissioning connection;
- as-manufactured information passed to asset records.

### 8.9 Merchants, distributors and product suppliers

- product catalogues and technical data;
- customer pricing and sales orders;
- branch/warehouse stock;
- procurement and replenishment;
- pick/pack/dispatch and delivery;
- returns and substitutions;
- product traceability and environmental data;
- project/order linkage.

### 8.10 Plant, lifting, access and temporary equipment

- plant/fleet register;
- hire and allocation;
- operator competence;
- pre-use and statutory inspection;
- lifting/access plans and evidence where relevant;
- utilisation, hours and fuel/energy;
- defects, maintenance and certification;
- cost capture to project/work package.

### 8.11 Infrastructure, utilities and network operators

- linear/network asset models;
- work locations and geospatial referencing;
- outages/isolations and permits;
- field work orders and mobile crews;
- excavation, installation, repair and reinstatement;
- materials and logistics;
- inspections, tests and as-builts;
- long-term asset maintenance and condition.

### 8.12 Property, estates and facilities management

- estate/property/building/space hierarchy;
- occupancy, lease and service-charge data;
- helpdesk and service requests;
- PPM, reactive maintenance and compliance;
- contractor/SLA management;
- asset history, warranties and manuals;
- energy/utilities and performance;
- lifecycle renewal and capital planning.

### 8.13 Energy, retrofit and decarbonisation

- baseline asset condition and energy data;
- retrofit assessments and option appraisal;
- measures, specifications and installation records;
- cost/carbon comparison;
- grants/funding evidence where relevant;
- commissioning and performance verification;
- post-intervention operational monitoring.

### 8.14 Regulation, building control and assurance

- case/application records;
- dutyholder and competence evidence;
- plan/evidence review;
- inspections and findings;
- controlled changes;
- notices, mandatory occurrences and decisions where applicable;
- certificates and completion evidence;
- secure, versioned, attributable regulatory records.

### 8.15 Heritage, conservation and existing buildings

- significance and condition information;
- measured and condition surveys;
- defects and pathology;
- repair/conservation specifications;
- interventions and approvals;
- retained historical evidence;
- material provenance and replacement history;
- long-term maintenance planning.

## 9. End-to-end process contract

NuBlox is complete only when cross-domain processes work as one governed chain.

### 9.1 Market-to-contract

**Account → Lead → Opportunity → Bid decision → Estimate → Tender/Proposal → Quotation → Approval → Acceptance → Contract/Appointment → Project mobilisation**

No manual recreation of the customer, estimate, commercial scope or accepted price should be required at conversion boundaries.

### 9.2 Estimate-to-project-control

**Estimate resource/cost structure → approved budget/cost plan → project CBS/WBS mapping → procurement/work packages → commitments → actuals → forecast → margin/performance**

Estimate data must remain traceable to project control without forcing the project to inherit an unsuitable estimate structure unchanged.

### 9.3 Design-to-approved-information

**Requirement → deliverable → authoring → review → coordination → approval/status → issue/transmittal → construction use → verified/as-built state → handover/asset information**

### 9.4 Procure-to-pay

**Need/requisition → approval → sourcing/RFQ → comparison → award → PO/subcontract → receipt/progress evidence → supplier invoice → match/verification → approval → payment → accounting**

### 9.5 Plan-to-perform

**Scope/WBS → schedule → resource plan → work package → assignment → field execution → progress/evidence → completion → forecast update**

### 9.6 Change-to-commercial-position

**Event/instruction → change record → entitlement/impact → estimate → approval/status → contract/budget/commitment/schedule update → valuation/revenue/cost forecast → final-account history**

The original baseline and prior approved states remain auditable.

### 9.7 Valuation-to-cash

**Progress/entitlement → application/valuation → assessment/certificate → invoice → receivable → collection → receipt/allocation → accounting → cash/reporting**

### 9.8 Supplier-progress-to-payment

**Subcontract progress → valuation/application → assessment → withholding/pay-less where applicable → approved liability → supplier invoice/payment evidence → ledger**

### 9.9 Incident/defect/NCR-to-resolution

**Observation/event → triage → accountable action → investigation/cause → corrective work → verification → closure → lessons/trend reporting**

Domain state remains authoritative; Work Kernel tasks provide common execution semantics.

### 9.10 Commissioning-to-operation

**System/asset requirement → inspection/test → commissioning → defect/retest → certification → asset information → training/manuals → handover acceptance → maintenance/service plan → operational history**

### 9.11 Service-request-to-resolution

**Request/case → entitlement/SLA → triage → work order → scheduling → engineer/operative → parts/time/evidence → completion → customer acceptance → billing/accounting where applicable**

### 9.12 Asset-to-retirement

**Acquire/create → commission → operate → inspect → maintain → renew → assess end-of-life → decommission → reuse/recycle/dispose → retain historical evidence**

### 9.13 Hire-to-retire

**Recruit/engage → onboard → verify competence → allocate → time/attendance → develop → compensate/payroll → change terms → offboard → retain statutory evidence**

### 9.14 Record-to-report

**Operational event → controlled accounting recognition → period control → reconciliation → management/statutory reporting → close → correction by additive evidence**

## 10. Commercial and project-control model

Construction commercial control must connect operational reality to financial consequence.

NuBlox must support:

- baseline estimate and approved budget;
- cost plan and cost-code structures;
- procurement packages and commitments;
- subcontract and supplier liabilities;
- labour, plant, material and other actual cost;
- accruals and expected cost;
- change/variation and risk allowances;
- forecast cost to complete and estimate at completion;
- earned/progress measures;
- revenue, applications, valuations and certifications;
- retention and withholding;
- cash flow;
- margin and CVR/project profitability;
- final account;
- traceability from commercial position to source evidence.

The same monetary amount must not be copied into multiple mutable “current balance” records simply because different screens need it. Derived positions should be calculated from authoritative source records or maintained through explicitly controlled accounting/commercial ledgers.

## 11. Information management, BIM and digital engineering

NuBlox must support information management as a governed business process, not merely file storage.

### 11.1 Information requirements

Support:

- organisational information requirements;
- project information requirements;
- asset information requirements;
- exchange/delivery requirements;
- responsibility and information-delivery plans;
- deliverable schedules and acceptance criteria.

### 11.2 Common data environment semantics

Information containers require:

- stable identity;
- revision/version;
- status/suitability;
- author/owner/originator;
- classification;
- project/location/system/asset relationships;
- workflow state;
- issue/transmittal history;
- permissions and distribution;
- review/approval evidence;
- retention and supersession semantics.

A binary object store is infrastructure; NuBlox owns the information-container lifecycle.

### 11.3 OpenBIM and exchange

NuBlox must support open, vendor-neutral exchange where appropriate, including:

- IFC for building and infrastructure model/data exchange;
- BCF-style issue exchange where useful;
- COBie or equivalent structured handover exchange where contractually required;
- APIs/webhooks for controlled information exchange;
- GIS/geospatial exchange for sites, infrastructure and networks.

The current official IFC 4.3 line is particularly important because it extends standardised IFC coverage beyond buildings into infrastructure such as roads, railways, bridges, waterways and ports.

### 11.4 Classification

NuBlox must permit recognised classification systems without using classification codes as primary business identifiers.

UK-first built-environment deployments should support current Uniclass tables for complexes, entities, activities, spaces/locations, elements/functions, systems, products, tools/equipment, project management, forms of information and roles where relevant.

Uniclass is a living classification and must be versioned as reference data rather than copied into irreversible schema design.

## 12. Quality, safety, environment and building safety

### 12.1 Quality

Support:

- project/organisation quality plans;
- ITPs and hold/witness points;
- inspection and test records;
- material/product inspection;
- NCRs and corrective/preventive actions;
- defects/snags;
- calibration and test-equipment evidence;
- audit and assurance;
- completion certification.

### 12.2 Health and safety

Support:

- roles/dutyholder evidence;
- competence and appointment evidence;
- hazards and risk assessments;
- RAMS references and approval/briefing evidence;
- permits, isolations and controlled work;
- inductions and toolbox briefings;
- observations, near misses and incidents;
- investigation, cause and actions;
- occupational health/safety evidence where appropriate;
- statutory reporting data and jurisdictional configuration.

### 12.3 Building safety and golden thread

Where the legal regime applies, NuBlox must be capable of maintaining secure digital, attributable and version-controlled building information across design, construction and occupation.

For England’s higher-risk building regime this includes support for dutyholder evidence, controlled change, building-control application evidence, completion evidence, mandatory occurrence information, building-safety records and the ongoing golden thread.

The product must not assume every building or jurisdiction is subject to England’s higher-risk regime. It is a regulatory overlay selected by asset, work type and jurisdiction.

## 13. Supply chain, materials and construction logistics

Construction supply-chain control must connect procurement, design, programme, site and finance.

NuBlox must support:

- supplier/subcontractor prequalification and compliance;
- approved supplier and product status;
- long-lead and critical item tracking;
- procurement schedules linked to design release and programme need dates;
- materials/submittal approval before purchasing where required;
- off-site manufacture and inspection;
- logistics slots, delivery bookings and call-offs;
- goods receipt, quarantine and inspection;
- site stores and controlled material issue;
- returns, waste and surplus;
- product/serial/batch traceability where relevant;
- substitution/change control;
- environmental/product attributes and provenance.

## 14. Workforce, competency and resource management

Construction work frequently depends on demonstrable competence as well as availability.

NuBlox must support resource decisions using:

- role and project responsibility;
- skill/competence;
- qualifications, licences, cards and expiry;
- training/briefing status;
- location and travel constraints;
- shift/calendar and availability;
- employment/engagement restrictions;
- cost/rate;
- project/site access requirements;
- fatigue/working-time rules where jurisdictionally required.

A resource being available is not sufficient if the person lacks required competence or authorisation.

## 15. Plant, assets, facilities and operational digital thread

Built assets must not lose their history at project handover.

### 15.1 Asset information continuity

Design and construction information must be capable of transitioning into an operational asset record containing:

- stable asset identity;
- classification and system/location context;
- manufacturer/model/serial data;
- commissioning and acceptance evidence;
- warranty;
- maintenance strategy and task plans;
- manuals and certificates;
- spare/consumable information;
- meter/condition data;
- service history;
- defects and modifications;
- lifecycle cost and replacement history.

### 15.2 Asset management principles

NuBlox must support asset management as an organisational value discipline, not just a maintenance list. Asset strategies, risk, performance, cost, assurance, sustainability and lifecycle decisions must be linkable from portfolio objectives through to individual assets.

### 15.3 Digital twin and live operational data

Sensor, BMS, SCADA, IoT and other live data may be integrated where useful. Such telemetry does not create a separate system of record for asset identity, responsibility, maintenance or compliance.

## 16. Sustainability, carbon, circularity and social value

Sustainability must connect to design, procurement, construction and operation rather than exist as a reporting-only module.

NuBlox must support:

- carbon baselines, budgets, targets and forecasts;
- embodied carbon by material/product/system/asset/work package;
- operational energy and carbon;
- user-related carbon where required by the chosen methodology;
- whole-life carbon assessment;
- waste streams and recovery routes;
- reuse and circular-economy evidence;
- environmental product declarations and material provenance;
- responsible procurement and supplier evidence;
- biodiversity/environmental measures where required;
- social-value commitments, evidence and outcomes;
- climate risk and resilience;
- cost-carbon option comparison;
- auditability of factors, sources, assumptions and assessment versions.

RICS Whole Life Carbon Assessment 2nd edition is a supported baseline for consistent whole-life carbon structures across buildings and infrastructure. Methodologies must be versioned reference/configuration data because standards and regional requirements evolve.

## 17. Work Kernel and controlled execution

The Work Kernel provides shared execution semantics across all domains for:

- actions;
- tasks;
- approvals;
- reviews;
- decisions;
- acknowledgements;
- assignments;
- due dates and priority;
- lifecycle evidence;
- durable business-event publication.

It does **not** replace domain state.

Examples:

- completing an NCR corrective-action task does not itself close the NCR;
- approving a supplier-invoice work item does not itself post accounting evidence unless the AP domain transition succeeds;
- completing a commissioning action does not itself mark an asset operational unless commissioning/handover acceptance rules pass.

This distinction prevents every domain building a separate task engine while preserving domain-specific controls.

## 18. Collaboration and multi-organisation projects

Built-environment projects routinely involve many legal organisations.

NuBlox must support controlled collaboration without weakening tenant isolation.

Principles:

- every record has an authoritative owning organisation/context;
- project participation is explicit;
- invitations and acceptance establish collaboration relationships;
- shared access is scoped to specific projects, packages, records or workflows;
- external participants do not gain implicit tenant membership;
- cross-organisation assignments require validated participant scope;
- the source organisation retains control over its private commercial/financial information;
- evidence of external submissions, responses and approvals is attributable.

## 19. Security, authorisation and audit

All material operations are server-authoritative.

Effective permission precedence remains:

**explicit member deny → explicit member allow → active role grant → default deny**

Umbrella permissions do not cross domains.

Material business actions require appropriate combinations of:

- authenticated identity;
- organisation membership;
- tenant scope;
- project/record participation;
- granular permission;
- workflow state;
- delegated authority/value limit where relevant;
- segregation-of-duties rule;
- competence/dutyholder rule where relevant;
- attributable audit evidence.

UI visibility is never the security authority.

## 20. Standards and interoperability baseline

NuBlox supports recognised standards as governed overlays and exchange formats. Standards do not replace NuBlox’s canonical domain model.

| Standard / framework | NuBlox treatment |
| --- | --- |
| RIBA Plan of Work 2020 | supported 0–7 building project-stage overlay; projects may use alternative lifecycle/stage frameworks |
| ISO 19650 / UK IMI Framework | information-management responsibilities, requirements, delivery planning and CDE process baseline |
| Uniclass | versioned built-environment classification/reference data; current tables are not hard-coded schema enums |
| IFC 4.3 / ISO 16739-1:2024 | openBIM exchange for buildings and infrastructure; vendor-neutral interoperability |
| RICS NRM | estimating, measurement, cost planning and maintenance-cost reference structures where applicable |
| RICS Whole Life Carbon Assessment | whole-life carbon assessment/reference methodology for buildings and infrastructure |
| ISO 55000:2024 family | asset-management principles, value, alignment, assurance, adaptability and sustainability |
| CDM 2015 | UK construction design/management safety-duty overlay where applicable |
| Building Safety Act / BSR guidance | England-specific higher-risk building, dutyholder, controlled-change and golden-thread overlay |
| WCAG 2.2 AA | accessibility target for NuBlox user experiences |

Other regional and sector standards must be incorporated through versioned reference data, configurable workflows and jurisdiction packs rather than forks of the core data model.

## 21. Regionalisation and jurisdiction packs

NuBlox is UK-first but must be globally extensible.

Regional configuration may control:

- tax/VAT/GST and invoice rules;
- payroll, labour and statutory reporting;
- accounting/reporting standards;
- currency and fiscal calendars;
- health and safety duties;
- building control and permitting;
- environmental reporting;
- procurement/statutory notices;
- contract terminology;
- measurement/classification standards;
- privacy, retention and data residency;
- e-invoicing and statutory digital submission formats.

Core business identities and relationships must remain stable across jurisdictions.

## 22. Data, analytics and KPI model

NuBlox reporting must derive from governed operational and accounting semantics.

Cross-sector measures include:

- pipeline, win rate and order book;
- estimate accuracy and tender margin;
- schedule variance and milestone performance;
- budget, commitment, actual, forecast and margin;
- change exposure and recovery;
- procurement lead time and supplier performance;
- productivity and resource utilisation;
- defects, NCRs and quality trend;
- safety leading/lagging indicators;
- asset availability, reliability, downtime and maintenance compliance;
- space/occupancy and service performance;
- energy, carbon, waste and circularity;
- cash, working capital and liquidity;
- customer/service SLA performance;
- information-delivery and approval performance.

Metrics require a governed definition, grain, units, time basis and security scope. Dashboard labels must not become ungoverned alternative definitions of business measures.

## 23. AI and automation

AI may assist users with retrieval, summarisation, classification, drafting, forecasting, anomaly detection and decision support, but it must operate inside NuBlox controls.

Consequential actions require:

- permission-scoped context;
- provenance/source links;
- model/provider abstraction where appropriate;
- deterministic validation for structured outputs;
- explicit confidence/uncertainty handling;
- human approval when policy requires it;
- audit evidence;
- no silent mutation of authoritative records.

Automation must use domain services and Work Kernel/event semantics rather than bypassing business invariants through direct database writes.

## 24. Capability completeness gate

A capability is **not complete** because a table, API or screen exists.

Every material capability must be assessed against the following gate:

1. **Canonical records** — authoritative entities and relationships exist.
2. **Lifecycle/state** — valid states and transitions are explicit.
3. **Permissions** — granular server-side actions exist.
4. **Segregation of duties** — conflicting authorities are controlled where required.
5. **Work execution** — actions, assignments, approvals and evidence are usable.
6. **Audit/correction** — material change is attributable; correction does not erase history.
7. **Commercial/financial consequence** — relevant costs, revenues, commitments or accounting effects are connected.
8. **Information consequence** — required documents/models/evidence are linked and controlled.
9. **Reporting/KPIs** — operational and management visibility exists.
10. **Interoperability** — import/export/API/open-standard boundaries are defined where needed.
11. **Regionalisation** — jurisdictional rules are configurable rather than hard-coded assumptions.
12. **Accessibility/mobile usability** — the workflow is usable in the context where the work occurs.
13. **End-to-end validation** — real process tests prove adjacent-domain integration.
14. **Security/tenancy** — tenant and project boundaries are proven server-side.
15. **Performance/operability** — scale, observability and recovery behaviour are acceptable.

The programme definition of “world-class” is this completeness across the full operating model, not the number of named modules.

## 25. Machine-readable enterprise taxonomy

`docs/architecture/taxonomy/` remains the canonical enterprise-function dataset:

**L1 Function → L2 Sub-function → L3 Activity → future L4 Task / Procedure**

Current baseline:

- 29 enterprise functions;
- 353 sub-functions;
- 1,510 source activities;
- 18-stage generic activity lifecycle.

That taxonomy answers **what work an enterprise performs**.

This document answers **what Construction and Built Environment capability NuBlox must own and how the sector operates**.

Future mapping should explicitly connect enterprise activities to:

- lifecycle stages;
- the 19 capability domains;
- canonical data objects;
- responsible roles;
- required permissions;
- Work Kernel patterns;
- controls/risks;
- evidence;
- KPIs and outcomes.

## 26. Architecture invariants

Every future NuBlox design must preserve these rules:

- Native core capability before dependency on another ERP/operational product.
- One canonical business concept, reused across domains.
- Normalised relational authority for critical business state by default.
- Committed MySQL migrations are the implemented schema authority.
- Career, organisation role, project role and permission remain distinct.
- Tenant and project scope are explicit and server-enforced.
- Domain state remains authoritative even when Work Kernel provides common execution.
- Material actions are attributable and auditable.
- Corrections preserve history rather than silently rewriting evidence.
- Files/models are controlled information records, not loose attachments.
- Commercial, operational and financial consequences are integrated.
- Classification systems and standards are versioned overlays, not primary identifiers.
- External integrations exchange data without taking ownership of NuBlox process semantics.
- Mobile and field workflows are first-class.
- AI does not bypass permissions, evidence or human accountability.

## 27. Current standards reference set

The detailed source register is maintained in `17-sources-and-standards.md`.

Key current references verified for this governing model include:

- RIBA Plan of Work 2020: https://www.architecture.com/knowledge-and-resources/resources-landing-page/riba-plan-of-work
- UK information-management / ISO 19650 implementation framework: https://www.ukbimframework.org/
- NBS Uniclass: https://www.thenbs.com/our-tools/uniclass
- Current Uniclass downloads: https://uniclass.thenbs.com/download
- buildingSMART IFC: https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/
- RICS New Rules of Measurement: https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/nrm
- RICS Whole Life Carbon Assessment: https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/whole-life-carbon-assessment
- ISO 55000 asset-management family: https://www.iso.org/
- HSE CDM 2015: https://www.hse.gov.uk/construction/cdm/2015/
- Building Safety Regulator golden-thread guidance: https://www.gov.uk/guidance/keeping-information-about-a-higher-risk-building-the-golden-thread
- Building Safety Regulator design/construction collection: https://www.gov.uk/government/collections/design-and-construction-of-higher-risk-buildings

Standards and regulatory guidance evolve. At implementation time, jurisdiction packs and reference-data releases must be revalidated against the then-current authoritative source.