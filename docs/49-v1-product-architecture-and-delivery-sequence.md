# 49 — V1 Product Architecture and Delivery Sequence

**Status:** Historical implementation contract — superseded as the governing roadmap on 21 August 2026.  
**Current authority:** `57-world-class-native-erp-architecture.md` and the re-baselined `13-delivery-roadmap.md`.

## 1. Historical purpose

This document originally rebalanced NuBlox from a finance-led implementation into a broader V1 Business OS + Built Environment OS and established a dependency-led slice sequence.

That decision was successful: the sequence activated the platform experience, workforce/time/scheduling, project information, procurement/commercial control, site/quality/safety, assets/facilities/maintenance and portal/cross-organisation collaboration. Subsequent contextual-workspace work improved the application shell and business navigation.

The detailed implementation records remain in the associated slice documents (`50`–`56`) and source history.

## 2. Why this sequence is no longer the programme authority

NuBlox has now been redefined as a **world-class native ERP and operating platform for construction and the built environment**.

The old sequence assumed that some enterprise capabilities could remain outside the product, be deferred indefinitely, or be addressed primarily through integrations. That assumption is no longer valid.

From 21 August 2026:

- full native finance/accounting is part of the target product;
- native accounts payable and procure-to-pay are required;
- native HCM/payroll is part of the target product;
- native materials, inventory, warehouse and logistics are part of the target product;
- native production/fabrication capability is required for relevant built-environment businesses;
- native design/BIM/CDE capability is part of the target product;
- native property/real-estate/facilities/service depth is part of the target product;
- sustainability, enterprise planning, treasury, consolidation, analytics and master-data governance are part of the target product;
- APIs and integrations exist for interoperability and exchange, not as substitutes for missing core modules.

The complete capability model and SAP benchmark crosswalk are defined in `57-world-class-native-erp-architecture.md`.

## 3. Historical slice outcomes retained

The work delivered under the former sequence remains valid and forms the current foundation:

1. **Platform experience foundation** — application shell, permission-driven navigation and design-system baseline.
2. **People, time and schedule activation** — workforce/time/scheduling operational foundations.
3. **Documents and project information** — document/revision/information workflows.
4. **Procurement and project commercial control** — purchasing/procurement and project cost/change foundations.
5. **Site, quality and safety** — controlled field, inspection, quality and safety workflows.
6. **Assets, facilities and maintenance** — asset/maintenance/facilities operational foundations.
7. **Portal and cross-organisation collaboration** — controlled external project participation.
8. **Context-first UX refinement** — business-area navigation and persistent contextual workspaces.

These capabilities must be deepened and connected; they must not be rebuilt as duplicate modules.

## 4. Cross-cutting invariants preserved

The engineering contract established by this document remains mandatory:

1. tenant isolation;
2. server-side authorisation;
3. project-scope enforcement;
4. controlled public identifiers;
5. material-action auditability;
6. immutable/controlled issued, approved, executed and financial evidence;
7. relational integrity in MySQL/InnoDB;
8. transaction/concurrency control;
9. responsive operation;
10. WCAG 2.2 AA target;
11. no duplicate domain models;
12. permanent green release gate covering migrations, generated types, integration tests, diagnostics, build and browser acceptance.

## 5. Replacement delivery model

Future delivery is gap-driven across the native ERP capability waves in `13-delivery-roadmap.md`:

- Wave A — enterprise and accounting completeness;
- Wave B — supply chain, materials and cost integration;
- Wave C — enterprise project and commercial controls;
- Wave D — people, HCM and payroll;
- Wave E — design, engineering, BIM and information lifecycle;
- Wave F — production, logistics and merchant operations;
- Wave G — property, assets, facilities and service depth;
- Wave H — sustainability, enterprise planning and intelligence.

A capability may be pulled forward when it completes a valuable end-to-end workflow and its dependencies are ready.

## 6. Immediate implication

The previously proposed standalone API/webhooks slice is no longer automatically the next major product boundary.

The recommended next native ERP boundary is **Wave A: enterprise and accounting completeness**, beginning with accounts payable/procure-to-pay and the links among suppliers, procurement commitments, supplier invoices, tax, ledger, bank/cash and payments.

API/webhook capabilities remain important platform work and will be delivered in support of native NuBlox business processes.
