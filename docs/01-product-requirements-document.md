# 01 — Product Requirements Document

## 1. Purpose

This document defines the governing product scope for NuBlox. It is intended to be specific enough for solution design, estimation, backlog creation and delivery planning while preserving a single coherent enterprise architecture.

The detailed capability architecture is defined in `construction-and-built-environment.md`.

## 2. Product proposition

NuBlox is a **world-class native ERP and operating platform for construction and the built environment**.

It combines enterprise resource planning with the complete built-environment lifecycle in one canonical data model. Professional workspaces are composed from reusable native capabilities. Users can belong to multiple organisations, hold multiple careers and participate in multiple projects.

NuBlox is not designed around a requirement for customers to buy additional core ERP or operational products. External systems may exchange data with NuBlox, but they must not be necessary to complete a material NuBlox business process because a native module is absent.

## 3. Product actors

### Internal organisation actors

- Organisation owner / director
- Organisation administrator
- Finance director / accountant / finance administrator
- Commercial director / quantity surveyor / estimator
- Project / programme / contracts manager
- Design / engineering professional
- Procurement / supply-chain professional
- HR / payroll / workforce administrator
- Property / facilities / asset manager
- Site / quality / HSE manager
- Professional / technical worker
- Trade / field worker
- Warehouse / logistics / production worker
- Service / maintenance operative
- Read-only / auditor

### External actors

- Client / developer / asset owner
- Consultant
- Contractor / subcontractor
- Supplier / manufacturer / merchant
- Inspector / regulator-facing participant
- Customer / end client
- Tenant / occupier / service recipient where applicable
- Portal-only project or supply-chain participant

## 4. Platform and ERP domains

### 4.1 Enterprise, identity and master-data kernel

Must provide:

- secure authentication and account lifecycle;
- legal entities, organisations, groups and operating units;
- memberships and invitations;
- offices, locations, teams and organisation hierarchy;
- careers and professional profiles;
- capabilities, roles, permissions and segregation of duties;
- project memberships and cross-organisation participation;
- delegated authorities and approval limits;
- audit event infrastructure;
- configurable reference/master data;
- master-data stewardship and duplicate prevention;
- calendars, currencies, units, fiscal settings and regional configuration.

### 4.2 Customer, sales and commercial ERP

Must support natively:

- CRM organisations and people;
- leads and opportunities;
- account plans and activity history;
- bids/tenders and bid/no-bid governance;
- estimates, measurement/take-off foundations and resource build-ups;
- proposals and quotations;
- pricing, discounts and terms;
- sales orders where applicable;
- customer contracts and appointments;
- subcontract and commercial-contract administration;
- variations/change, claims, valuations, applications, certification, retention and final accounts;
- trade-counter/POS patterns for merchant organisations where applicable.

### 4.3 Finance, accounting, planning and control ERP

Must support natively:

- chart of accounts and financial dimensions;
- double-entry general ledger;
- accounts receivable;
- accounts payable;
- customer and supplier invoicing/credit notes;
- receipt and payment processing;
- bank/cash management and reconciliation;
- accruals, prepayments and recurring journals;
- fixed-asset accounting;
- tax/VAT controls and reporting data;
- foreign currency and intercompany foundations;
- accounting periods and year-end close;
- trial balance and statutory financial statement foundations;
- project/job costing;
- cost/profit centres;
- budgets, rolling forecasts and scenarios;
- cash-flow/liquidity forecasting;
- treasury and financial risk;
- consolidation and enterprise-performance reporting.

A complete NuBlox deployment must not require an external accounting ledger as its system of record.

### 4.4 Procurement, supplier, materials, inventory and logistics ERP

Must support natively:

- supplier onboarding, qualification and lifecycle;
- requisitions and approvals;
- procurement packages and plans;
- RFQs/RFPs and tender comparison;
- purchasing contracts/frameworks;
- purchase orders and subcontract orders;
- commitments and order changes;
- goods/service receipt;
- supplier-invoice matching/verification;
- supplier performance and compliance;
- material/product master;
- inventory, stores, warehouses and bins;
- reservations, issues, returns and transfers;
- stock counts and adjustments;
- site material call-off;
- picking, packing, dispatch and delivery;
- transport/logistics planning;
- merchant catalogue/branch stock/distribution patterns.

### 4.5 Production, fabrication and prefabrication ERP

For relevant built-environment manufacturers/fabricators, must support natively:

- bills of material;
- routings and work centres;
- production planning and MRP;
- production/work orders;
- capacity planning;
- shop-floor control;
- quality/traceability;
- configurable assemblies/products;
- project-linked make-to-order production;
- production costing, waste and scrap.

### 4.6 People, workforce, HCM and payroll ERP

Must support natively:

- people and employment records;
- organisation structure and positions;
- recruitment and onboarding;
- contracts, terms and compensation;
- competencies, skills, qualifications, cards and training;
- CPD and expiry management;
- attendance, leave and absence;
- timesheets and approvals;
- workforce/resource planning and rostering;
- multi-resource scheduling;
- expenses and travel;
- performance/development records;
- payroll calculation, deductions, benefits and payment outputs;
- statutory payroll reporting data and regional payroll configuration;
- contingent labour/workforce records.

### 4.7 Projects, programmes and built-environment delivery

Shared project capabilities must support natively:

- portfolios, programmes, projects and jobs;
- project participants and governance;
- WBS, programme, milestones, dependencies and baselines;
- resource/capacity planning;
- project risks, issues, actions and decisions;
- sites/location hierarchy;
- project budgets, commitments, actuals and forecasts;
- progress measurement and project controls;
- design and information-management workflows;
- document registers and revisions;
- RFIs, submittals and instructions;
- design review/coordination issues;
- BIM/model information and controlled CDE workflows;
- procurement packages;
- site diary, labour, plant, materials and deliveries;
- inspections, ITPs and test evidence;
- quality/NCR/defects;
- safety/HSE records, permits and RAMS evidence;
- commissioning and handover;
- project close and lessons learned.

### 4.8 Plant, assets, property, facilities and service ERP

Must support natively:

- asset hierarchy and technical records;
- plant, equipment and fleet;
- ownership, hire, allocation, utilisation and downtime;
- preventive/predictive/reactive maintenance;
- work orders, inspections and certification;
- spares and maintenance inventory;
- asset lifecycle cost and replacement planning;
- property, land, building and space hierarchy;
- ownership/occupation;
- leases, licences, rents and service charges;
- space and occupancy management;
- facilities helpdesk/service requests;
- PPM/reactive FM;
- statutory-compliance schedules;
- utilities/meters;
- service contracts, SLAs, field service and dispatch;
- warranty, defects-liability and aftercare.

### 4.9 Sustainability, governance and compliance

Must support natively:

- quality management;
- health and safety;
- environment and waste;
- audits and assurance;
- compliance obligations and statutory inspections;
- governance, enterprise risk and controls;
- building-safety/golden-thread evidence where applicable;
- organisational/project carbon data;
- embodied/operational carbon;
- energy and utilities;
- responsible procurement, material provenance and sustainability attributes;
- social-value and sustainability performance reporting data.

### 4.10 Collaboration / NuBlox Network

A project or supply-chain process may contain participants from several organisations. NuBlox must preserve each organisation's ownership/confidentiality boundary while permitting explicitly shared records.

The design must support:

- invitations between organisations;
- project/supply-chain roles;
- scoped sharing;
- external portal users;
- record visibility rules;
- controlled external responses;
- audit of sharing and access changes.

### 4.11 Reporting, workflow, automation and intelligence

Must support natively:

- global and contextual search;
- action centre and notifications;
- configurable approvals/workflows;
- business event/outbox automation;
- operational and financial reporting;
- dashboards and drill-through analytics;
- governed KPI/BI semantic definitions;
- document/report generation;
- forecasting and anomaly detection;
- APIs/webhooks for interoperability;
- AI assistance where permissions, provenance and human-control rules are satisfied.

## 5. Built-environment lifecycle

The canonical lifecycle is:

**Market → Lead → Opportunity → Bid → Estimate → Proposal → Quote → Contract → Design → Plan → Procure → Produce → Construct → Control → Invoice → Account → Handover → Operate → Maintain → Refurbish → Dispose**

Not every organisation or profession participates in every stage, but NuBlox must preserve continuity when work crosses stages.

## 6. Canonical hierarchy and master-data principle

The data model should support, where applicable:

**Enterprise Group → Legal Entity → Operating Unit → Portfolio → Programme → Project → Site → Property/Building/Structure → Level → Space/Zone → System → Asset → Component**

This hierarchy must not be mandatory for a simple trade job.

The same real-world entity must not be duplicated simply because another module uses it. A CRM organisation, quotation customer, project client, invoice customer or service customer remains one canonical party with different relationships and context.

## 7. Core user journeys

### Journey A — Sole-trade business

1. Create/qualify customer and opportunity.
2. Survey site.
3. Produce estimate/quotation.
4. Customer accepts and contract/job is formed.
5. Procure/reserve materials.
6. Schedule operative and plant.
7. Complete work and capture evidence/tests.
8. Consume stock/materials and time.
9. Invoice and receive payment.
10. Post accounting consequences.
11. Retain installed asset/service history.

### Journey B — Consultant project

1. Create client and opportunity.
2. Prepare fee estimate/proposal.
3. Form appointment/contract.
4. Create project/programme and assign team.
5. Invite external project participants.
6. Produce/review controlled design information and models.
7. Manage RFIs, instructions, change and decisions.
8. Record time, expenses, WIP, fees and forecasts.
9. Issue reports/certificates/invoices.
10. Close, account and archive project.

### Journey C — Contractor project

1. Tender, estimate and win contract.
2. Create project/WBS/programme/budget.
3. Create work/procurement packages.
4. Procure suppliers/subcontractors and materials.
5. Manage design, programme, labour, plant, logistics and site operations.
6. Record quality, safety, progress and evidence.
7. Manage instructions, variations, claims and commercial exposure.
8. Value client work and subcontract liabilities.
9. Forecast cost, revenue, cash and margin.
10. Account, commission and hand over.
11. Continue defects/aftercare where contracted.

### Journey D — Facilities/property operation

1. Register/acquire property/building/space.
2. Establish asset register and compliance requirements.
3. Configure PPM/statutory schedules and service contracts.
4. Receive/react to service requests.
5. Assign internal/external resources and parts.
6. Capture service/inspection evidence and cost.
7. Invoice/recharge where applicable.
8. Update asset/property history, budgets and next due dates.
9. Plan lifecycle replacement/refurbishment.

### Journey E — Merchant/manufacturer/fabricator

1. Maintain product/material/configuration catalogue.
2. Forecast demand or accept project/customer order.
3. Plan procurement/production/capacity.
4. Receive and control materials/stock.
5. Manufacture/fabricate/pick goods.
6. Inspect/trace quality.
7. Dispatch/deliver to branch/site/customer.
8. Invoice/account for revenue, cost and inventory.

## 8. Product scope prioritisation

Scope is no longer divided into “core product” versus permanent external-product dependencies.

Capabilities are prioritised by:

1. enterprise dependency;
2. construction/built-environment customer value;
3. end-to-end process completeness;
4. risk/control importance;
5. reuse across the 84-career taxonomy;
6. current implementation maturity;
7. ability to preserve one canonical data model.

The gap-driven waves in `construction-and-built-environment.md` govern sequencing.

## 9. Professional capability packs

Career/professional packs configure the shared ERP rather than fork it.

The first architecture validations remain:

1. **Quantity Surveyor** — estimating, tendering, contracts, commercial/project controls and reporting.
2. **Electrician** — field/trade job management, materials, testing, assets, maintenance and service.
3. **Facilities Manager** — property, assets, PPM/reactive work, contractors, compliance and lifecycle planning.

The broader programme must map all 84 sector careers to shared capabilities without requiring separate application architectures.

## 10. Product constraints

- Svelte 5 and SvelteKit remain the application baseline.
- MySQL remains the system-of-record relational database.
- Server-side authorisation is mandatory.
- Binary/model files may use controlled object/file storage, with authoritative metadata, integrity and lifecycle references in MySQL.
- Public/external identifiers must not expose sensitive sequential internal IDs without review.
- All tenant-owned records must have explicit tenancy ownership or be explicitly global/reference data.
- Native product capability may use infrastructure libraries/services, but core business semantics and system-of-record ownership remain in NuBlox.

## 11. AI scope principle

AI is a horizontal governed capability, not a separate product silo and not an authority bypass.

Potential uses include:

- summarising correspondence and project evidence;
- extracting structured data from controlled information;
- drafting estimates, proposals, reports or communications from governed records;
- comparing tender returns;
- identifying overdue actions, risks or anomalous data;
- forecasting cost, cash, resource, maintenance or service outcomes.

AI outputs must preserve source references, tenant/project permissions, audit/provenance and human approval for consequential actions.

## 12. Programme-level acceptance

The product architecture is acceptable only when:

- tenant isolation is independently tested;
- permissions cannot be bypassed through direct endpoint access;
- segregation-of-duties controls exist for material financial/enterprise processes;
- audit records capture material actions;
- canonical master data is reused across domains;
- the complete 84-career taxonomy can be represented without parallel app structures;
- every materially relevant SAP/enterprise benchmark capability has a native NuBlox treatment or explicit native implementation boundary;
- a complete deployment can operate its core ERP/business processes without requiring another ERP product;
- automated tests cover critical business, accounting, lifecycle and security paths;
- world-class capability maturity is measured domain by domain rather than by route count;
- critical request boundaries fail closed with deterministic 4xx responses for malformed input, unauthenticated access and tenant-scope violations;
- correlation and audit trace identifiers are normalised server-side and cannot be used to inject unbounded or unsafe header/log values;
- operational-to-financial lineage is provable for material processes (source operational event -> commercial consequence -> accounting evidence) without manual re-keying;
- privileged flows are protected by segregation-of-duties test scenarios that include adversarial direct-endpoint attempts and tampered tenant-selection cookies.
