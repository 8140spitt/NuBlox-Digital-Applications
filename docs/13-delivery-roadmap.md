# 13 — Delivery Roadmap

**Status:** Re-baselined 21 August 2026.  
**Governing capability architecture:** `57-world-class-native-erp-architecture.md`.

This is a dependency roadmap, not a calendar estimate.

NuBlox is now governed as a **world-class native ERP for construction and the built environment**. Historical phases and slices remain useful implementation records, but future sequencing is selected from the native ERP capability map rather than from an integration/ecosystem strategy.

## Completed foundation

The implementation already contains substantial operational foundations across:

- identity, organisations, tenancy, permissions and audit;
- CRM, contacts, opportunities and activities;
- estimates, quotations and quotation-to-project conversion;
- contracts and amendments;
- projects and project teams;
- AR, credit notes, receipts/payments, collections and credit control;
- accounting postings, periods, trial balance/reporting and year-end controls;
- workforce/time/scheduling;
- documents/project information;
- procurement and project commercial control;
- site/quality/safety;
- assets/facilities/maintenance;
- portal/cross-organisation collaboration;
- context-first navigation/workspace foundations.

Those capabilities are retained and deepened; they are not replaced by a new parallel architecture.

## Wave A — Enterprise and accounting completeness

Build/deepen:

- enterprise/legal-entity/master-data governance;
- chart of accounts and financial dimensions;
- native accounts payable;
- supplier invoice capture, approval and matching;
- payment runs;
- bank/cash management and reconciliation;
- accruals/prepayments/recurring journals;
- fixed-asset accounting;
- VAT/tax-return controls;
- financial-statement and localisation foundations;
- intercompany foundations.

Exit: controlled **record-to-report** and **procure-to-pay** can operate without another accounting ERP.

## Wave B — Supply chain, materials and cost integration

Build/deepen:

- supplier onboarding, qualification and lifecycle;
- requisitions and approvals;
- procurement planning;
- purchasing contracts/frameworks;
- deeper subcontract management;
- goods/service receipt;
- three-way matching;
- material/product master;
- inventory, stores and warehouse;
- stock reservations/issues/returns/transfers;
- site material call-off and delivery logistics;
- project commitment-to-actual integration.

Exit: purchasing, materials and accounting form one native controlled chain.

## Wave C — Enterprise project and commercial controls

Build/deepen:

- WBS/programme/critical-path planning;
- baselines, progress and project controls;
- capacity/resource planning;
- estimating/tender depth, including take-off and resource build-ups;
- contract obligations, notices and claims;
- applications, valuations, certificates and retention;
- final accounts;
- integrated cost-value reconciliation;
- cost/revenue/cash/margin forecasting;
- project profitability and management reporting.

Exit: a complex built-environment project can be planned, commercially controlled, valued and financially reported end to end.

## Wave D — People, HCM and payroll

Build/deepen:

- employment and position model;
- recruitment and onboarding;
- contracts, compensation and benefits;
- competencies, training, CPD and expiry;
- attendance, leave and absence;
- expenses/travel;
- workforce/resource planning and rostering;
- payroll calculation, deductions and payment outputs;
- statutory payroll reporting data and regional configuration.

Exit: **hire-to-retire** and payroll are native NuBlox processes.

## Wave E — Design, engineering, BIM and information lifecycle

Build/deepen:

- design briefs, requirements and deliverables;
- design responsibility matrices;
- native CDE workflow depth;
- document/model status, issue and coordination;
- review, markup and technical issue management;
- specifications and engineering records;
- model/object metadata;
- asset-information requirements;
- commissioning and handover information;
- native BIM/design capability appropriate to NuBlox workflows and open-standard exchange.

Exit: design-to-handover information can be controlled without another CDE as the system of record.

## Wave F — Production, materials logistics and merchant operations

Build/deepen:

- bills of material;
- routings/work centres;
- MRP and production orders;
- capacity/shop-floor control;
- production quality/traceability;
- configurable products/assemblies;
- warehouse/distribution depth;
- transport planning;
- merchant catalogue/branch operations;
- trade-counter/POS workflows.

Exit: fabricators, off-site manufacturers, merchants and product businesses can operate natively.

## Wave G — Property, assets, facilities and service depth

Build/deepen:

- real-estate/property/space management;
- leases, licences, rents and service charges;
- advanced EAM and maintenance planning;
- plant/fleet/vehicle lifecycle;
- service contracts and SLAs;
- field service and dispatch;
- warranty/aftercare;
- utilities/metering;
- lifecycle cost and replacement planning.

Exit: construction handover continues seamlessly into asset/property operation and service.

## Wave H — Sustainability, enterprise planning and intelligence

Build/deepen:

- carbon, energy, waste and environmental performance;
- material provenance and circularity;
- enterprise budgets, rolling forecasts and scenarios;
- treasury/liquidity;
- group consolidation;
- governed BI semantic layer and management packs;
- configurable workflow/automation;
- predictive and AI-assisted decision support with provenance and human control.

Exit: management can plan, govern and optimise the enterprise from authoritative NuBlox data.

## APIs and interoperability

APIs, webhooks and exchange services remain first-class platform capabilities, but they no longer form a standalone “ecosystem phase” intended to compensate for missing NuBlox functionality.

They are delivered when native processes need secure interoperability, migration, statutory exchange or customer-requested coexistence. See `08-api-integrations.md`.

## Career expansion

The National Careers Service taxonomy of 84 construction and built-environment profiles remains a coverage test throughout all waves.

Expansion order is driven by capability reuse and business value, not alphabetical career order. Career packs configure shared ERP capabilities rather than create parallel applications.

## Workstreams throughout

- product management and industry research;
- UX/service design;
- enterprise/data architecture;
- security/privacy and segregation of duties;
- accounting/tax/payroll controls;
- construction/commercial domain governance;
- data migration/import;
- QA/accessibility;
- DevOps/operations;
- documentation/training;
- benchmark and capability-maturity assessment.

## Delivery rule

A wave is not a waterfall phase. Capabilities may be pulled forward to complete a high-value end-to-end workflow when dependencies are satisfied and the permanent green release gate remains intact.
