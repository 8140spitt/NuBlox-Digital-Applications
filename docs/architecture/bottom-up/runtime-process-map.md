# Runtime Process Map

**Status:** Implementation trace reference  
**Date:** 2026-08-27  
**Purpose:** map major NuBlox process chains to live route handlers, domain services, repositories, core tables and tests.

This document complements the governing bottom-up architecture by showing how current code executes in practice.

## 1. Runtime backbone

Common request path used by all chains:

1. Request enters SvelteKit handle in `app/src/hooks.server.ts`.
2. Correlation ID, actor and tenant context are resolved in `app/src/lib/server/request-context.ts` and `app/src/lib/server/auth/session.ts`.
3. Route load/actions run with resolved `locals` and call domain services.
4. Services enforce permissions/tenant scope and execute transactional writes via repositories.
5. Kysely + MySQL runtime is provided by `app/src/lib/server/db/database.ts`.

Authorisation and composition anchors:

- `app/src/lib/server/capabilities/permission-service.ts`
- `app/src/lib/server/organisations/membership-repository.ts`
- `app/src/routes/(app)/+layout.server.ts`

## 2. Lead-to-cash

### 2.1 Process stages (implemented)

1. CRM customer/contact and opportunity creation
2. Opportunity -> estimate
3. Estimate finalisation -> quotation
4. Quotation issue and accepted response
5. Accepted quotation -> contract formation
6. Contract execution/mobilisation to project
7. Invoice issue
8. Payment receipt and invoice allocation

### 2.2 Route handlers

- CRM opportunity workflow: `app/src/routes/(app)/crm/opportunities/[opportunityPublicId]/+page.server.ts`
- Estimate portfolio/create: `app/src/routes/(app)/commercial/estimates/+page.server.ts`
- Contract formation from accepted quotation: `app/src/routes/(app)/contracts/new/+page.server.ts`
- Invoice portfolio/create: `app/src/routes/(app)/finance/invoices/+page.server.ts`
- Payment portfolio/create: `app/src/routes/(app)/finance/payments/+page.server.ts`

### 2.3 Primary services

- `app/src/lib/server/crm/crm-opportunity-service.ts`
- `app/src/lib/server/commercial/commercial-service.ts`
- `app/src/lib/server/commercial/commercial-lifecycle-service.ts`
- `app/src/lib/server/contracts/contract-service.ts`
- `app/src/lib/server/finance/invoice-service.ts`
- `app/src/lib/server/finance/payment-control-service.ts`

### 2.4 Repositories and representative tables

- CRM repository: `app/src/lib/server/crm/crm-opportunity-repository.ts`
  - `opportunities`, `opportunity_parties`, `crm_activities`, `crm_activity_parties`, `crm_pipelines`, `crm_pipeline_stages`
- Commercial repository: `app/src/lib/server/commercial/commercial-repository.ts`
  - `estimates`, `estimate_versions`, `estimate_items`, `quotations`, `quotation_versions`, `quotation_items`, `quotation_responses`, `quotation_issue_events`
- Contract and lifecycle service writes: `app/src/lib/server/commercial/commercial-lifecycle-service.ts`
  - `contracts`, `contract_versions`, `contract_version_parties`, `contract_version_value_components`
- Invoice and payment services:
  - `financial_documents`, `invoices`, `financial_document_items`, `financial_document_item_taxes`, `financial_document_issue_events`
  - `payments`, `payment_allocations`, `payment_reversals`, `payment_allocation_reversals`

### 2.5 Test coverage evidence

- End-to-end chain: `app/e2e/ui-crm-commercial.e2e.ts`
- Integration chain:
  - `app/src/lib/server/commercial/commercial-lifecycle.integration.test.ts`
  - `app/src/lib/server/commercial/estimates-quotations.integration.test.ts`
  - `app/src/lib/server/contracts/contract-formation.integration.test.ts`
  - `app/src/lib/server/finance/invoices.integration.test.ts`
  - `app/src/lib/server/finance/payment-allocation.integration.test.ts`

### 2.6 Current completeness signal

- **Status:** operational core
- **Gaps to keep tracking:** deeper receivables/collections automation beyond allocation workflow; broader SoD scenarios across quote/contract/invoice transitions.

## 3. Procure-to-pay

### 3.1 Process stages (implemented)

1. Procurement package creation
2. RFQ creation and issue
3. Purchase order draft -> approve -> issue
4. Receipt confirmation
5. Commercial cost classification and commitment linkage
6. Supplier application/valuation for payable control

### 3.2 Route handlers

- Procurement workspace and actions: `app/src/routes/(app)/purchasing/+page.server.ts`
- Project commercial control + valuations: `app/src/routes/(app)/commercial/cost-control/+page.server.ts`

### 3.3 Primary services

- `app/src/lib/server/procurement/procurement-service.ts`
- `app/src/lib/server/commercial/project-commercial-control-service.ts`
- `app/src/lib/server/commercial/commercial-valuation-service.ts`

### 3.4 Repositories and representative tables

- Procurement repository: `app/src/lib/server/procurement/procurement-repository.ts`
  - `procurement_packages`, `procurement_package_items`, `rfqs`, `rfq_versions`, `purchase_orders`, `purchase_order_versions`, `purchase_order_items`, `receipts`
  - supplier side joins through `parties`, `party_organisations`, `party_role_assignments`, `party_role_types`
- Commercial control repository/service:
  - `project_cost_codes`, `project_budgets`, `project_budget_versions`, `project_budget_lines`
  - `commercial_variations`, `commercial_variation_versions`, `commercial_variation_decisions`
  - valuation records and related commercial evidence tables

### 3.5 Test coverage evidence

- End-to-end chain: `app/e2e/procurement-commercial-control.e2e.ts`
- Integration chain: `app/src/lib/server/procurement/procurement-commercial-control.integration.test.ts`

### 3.6 Current completeness signal

- **Status:** operational to assessed valuation boundary
- **Gaps to keep tracking:** fuller accounts-payable settlement chain in same process thread (payable document posting/payment run coupling).

## 4. Project-to-profit

### 4.1 Process stages (implemented)

1. Cost code structure and baseline budget
2. Budget approval
3. Commitment ingestion from issued POs
4. Cost classification and change exposure
5. Reporting period management
6. Forecast creation, line updates, cash-flow plan, approval/lock
7. Portfolio-level project financial position reporting

### 4.2 Route handlers

- Cost control and variation actions: `app/src/routes/(app)/commercial/cost-control/+page.server.ts`
- Project financial control workspace/actions: `app/src/routes/(app)/projects/[projectPublicId]/financials/+page.server.ts`

### 4.3 Primary services

- `app/src/lib/server/commercial/project-commercial-control-service.ts`
- `app/src/lib/server/commercial/project-financial-control-service.ts`

### 4.4 Repositories and representative tables

- Financial control repository: `app/src/lib/server/commercial/project-financial-control-repository.ts`
  - `project_cost_codes`, `project_budgets`, `project_budget_versions`, `project_budget_lines`
  - `project_budget_adjustments`, `project_budget_adjustment_items`
  - `commercial_reporting_periods`, `commercial_forecasts`, `commercial_forecast_lines`, `commercial_forecast_cash_flow_lines`
  - commitment/actual signals from `purchase_orders`, `purchase_order_versions`, `purchase_order_items`, receipt facts and direct costs

### 4.5 Test coverage evidence

- End-to-end: `app/e2e/project-financial-control.e2e.ts`
- Integration: `app/src/lib/server/commercial/project-financial-control.integration.test.ts`
- Adjacent progression coverage:
  - `app/e2e/project-progress-earned-value.e2e.ts`
  - `app/e2e/project-plan.e2e.ts`
  - `app/e2e/project-resource-capacity.e2e.ts`

### 4.6 Current completeness signal

- **Status:** strong operational forecasting and control core
- **Gaps to keep tracking:** broader period-close and accounting-posting integration checkpoints for full project-to-ledger closure trace.

## 5. Asset-to-maintain

### 5.1 Process stages (implemented)

1. Facility/building/level/space setup
2. Asset type and asset registration
3. Reactive maintenance request -> work order
4. Assignment/completion and service event capture
5. Planned maintenance creation and generated work orders
6. Compliance requirement assignment and compliance event record

### 5.2 Route handlers

- Assets workspace/actions: `app/src/routes/(app)/assets/+page.server.ts`

### 5.3 Primary services

- `app/src/lib/server/assets/assets-maintenance-service.ts`

### 5.4 Repositories and representative tables

- Assets maintenance repository: `app/src/lib/server/assets/assets-maintenance-repository.ts`
  - `facilities`, `facility_buildings`, `building_levels`, `facility_spaces`
  - `asset_types`, `assets`
  - `maintenance_requests`, `maintenance_plans`, `maintenance_plan_tasks`, `work_orders`, `service_events`
  - `compliance_requirements`, `compliance_assignments`, `compliance_events`
  - project association through `facility_project_links`

### 5.5 Test coverage evidence

- End-to-end chain: `app/e2e/assets-maintenance.e2e.ts`
- Integration chain: `app/src/lib/server/assets/assets-maintenance.integration.test.ts`

### 5.6 Current completeness signal

- **Status:** operational maintenance and compliance core
- **Gaps to keep tracking:** deeper lease/occupancy and advanced FM/dispatch billing workflows.

## 6. Cross-chain characteristics

Common implementation traits across all four chains:

- Server-authoritative authorisation with tenant and project scope checks.
- Domain services as mutation owners; routes mostly orchestrate input/error/redirect behavior.
- Repository-centered SQL with explicit joins and organisation scoping.
- Audit event generation as part of material workflow transitions.
- E2E tests validate user-facing process continuity; integration tests validate service-level invariants.

## 7. Suggested upkeep rule

When a process stage changes, update this file in the same pull request as code and tests:

1. add/remove stage in the chain section,
2. update route/service/repository references,
3. update representative tables list,
4. add the validating test reference.
