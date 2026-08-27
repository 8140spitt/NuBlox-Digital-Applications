# Journey A Runtime Trace

**Status:** Non-governing implementation trace  
**Recovered:** 27 August 2026  
**Purpose:** preserve the useful code-trace evidence from the former `docs/ux-friction-remediation` branch while aligning it to the World-Class Journey A definition.

This document is an implementation aid, not product or architecture authority. The governing Journey A definition is [`../../world-class/08-reference-journeys.md`](../../world-class/08-reference-journeys.md), and current maturity is governed by [`../../world-class/10-capability-control-matrix.md`](../../world-class/10-capability-control-matrix.md).

## Journey A

```text
Customer
→ Opportunity
→ Estimate
→ Quotation
→ Contract
→ Project mobilisation
→ Plan / resource / progress
→ Procurement / cost / change
→ Valuation
→ Invoice / receivable / cash
→ Accounting / profitability
```

The current runtime already contains substantial parts of this chain. The purpose of the golden Journey A browser proof is to connect them into one continuous, evidence-led transaction thread rather than prove each workspace independently.

## 1. CRM customer and opportunity

### Customer organisation / contact

Workspace:

- `/crm`

Route/action:

- `app/src/routes/(app)/crm/+page.server.ts`

Primary services:

- `app/src/lib/server/crm/crm-organisation-onboarding-service.ts`
- `app/src/lib/server/crm/crm-service.ts`

### Opportunity

Workspace:

- `/crm/opportunities`

Route/action:

- `app/src/routes/(app)/crm/opportunities/+page.server.ts`

Primary services:

- `app/src/lib/server/crm/crm-opportunity-client-service.ts`
- `app/src/lib/server/crm/crm-opportunity-service.ts`
- `app/src/lib/server/crm/crm-opportunity-repository.ts`

## 2. Opportunity → estimate → quotation

Estimate entry points:

- `app/src/routes/(app)/crm/opportunities/[opportunityPublicId]/+page.server.ts`
- `app/src/routes/(app)/commercial/estimates/+page.server.ts`

Primary lifecycle service:

- `app/src/lib/server/commercial/commercial-lifecycle-service.ts`

Estimate/quotation service:

- `app/src/lib/server/commercial/commercial-service.ts`

Quotation workspace:

- `app/src/routes/(app)/commercial/quotations/[quotationPublicId]/+page.server.ts`

Key quotation actions include draft maintenance, lines, tax, issue and customer response. An accepted quotation is the normal source for contract formation.

## 3. Accepted quotation → contract → project

Contract formation route:

- `app/src/routes/(app)/contracts/new/+page.server.ts`

Contract lifecycle route:

- `app/src/routes/(app)/contracts/[contractPublicId]/+page.server.ts`

Primary services:

- `app/src/lib/server/commercial/commercial-lifecycle-service.ts`
- `app/src/lib/server/contracts/contract-service.ts`
- `app/src/lib/server/contracts/contract-common.ts`

Project mobilisation routes:

- `app/src/routes/(app)/contracts/[contractPublicId]/mobilise/+page.server.ts`
- mobilisation action in `app/src/routes/(app)/contracts/[contractPublicId]/+page.server.ts`

Mobilisation service:

- `app/src/lib/server/commercial/commercial-lifecycle-service.ts`

Project workspace authority:

- `app/src/lib/server/projects/project-workspace-service.ts`

Normal progression is therefore:

```text
Accepted quotation
→ contract formation
→ issue
→ execution
→ mobilisation
→ project workspace
```

## 4. Project controls runtime

### Portfolio / programme / project hierarchy

- route: `app/src/routes/(app)/projects/+page.server.ts`
- service: `app/src/lib/server/projects/project-hierarchy-service.ts`

### Project plan and baseline

- route: `app/src/routes/(app)/projects/[projectPublicId]/plan/+page.server.ts`
- service: `app/src/lib/server/projects/project-plan-service.ts`

### Resource loading and capacity

- route: `app/src/routes/(app)/projects/[projectPublicId]/resources/+page.server.ts`
- service: `app/src/lib/server/projects/project-resource-capacity-service.ts`

### Progress and earned value

- route: `app/src/routes/(app)/projects/[projectPublicId]/progress/+page.server.ts`
- service: `app/src/lib/server/projects/project-progress-service.ts`

### Risk / issue / decision / action

- route: `app/src/routes/(app)/projects/[projectPublicId]/rida/+page.server.ts`
- service: `app/src/lib/server/projects/project-rida-service.ts`

### Controlled project change

- route: `app/src/routes/(app)/projects/[projectPublicId]/changes/+page.server.ts`
- service: `app/src/lib/server/projects/project-change-service.ts`

### Project financial control

- route: `app/src/routes/(app)/projects/[projectPublicId]/financials/+page.server.ts`
- service: `app/src/lib/server/commercial/project-financial-control-service.ts`

## 5. Project delivery / commercial runtime

These workspaces are project-scoped through selected project/query/context rather than living under the project route folder.

| Capability | Route | Primary service |
| --- | --- | --- |
| Controlled information | `app/src/routes/(app)/documents/+page.server.ts` | `app/src/lib/server/information/information-service.ts` |
| Procurement | `app/src/routes/(app)/purchasing/+page.server.ts` | `app/src/lib/server/procurement/procurement-service.ts` |
| Cost control / variations | `app/src/routes/(app)/commercial/cost-control/+page.server.ts` | `app/src/lib/server/commercial/project-commercial-control-service.ts` |
| Valuations | `app/src/routes/(app)/commercial/valuations/+page.server.ts` | `app/src/lib/server/commercial/commercial-valuation-service.ts` |
| Site / quality / safety | `app/src/routes/(app)/site/+page.server.ts` | `app/src/lib/server/site/site-quality-safety-service.ts` |
| Assets / maintenance | `app/src/routes/(app)/assets/+page.server.ts` | `app/src/lib/server/assets/assets-maintenance-service.ts` |

Project-context navigation is composed through:

- `app/src/lib/navigation/app-navigation.ts`
- `app/src/routes/(app)/+layout.server.ts`

## 6. Receivables, cash and accounting

The later Journey A stages are represented by the finance runtime:

- invoices: `app/src/routes/(app)/finance/invoices/`
- payments: `app/src/routes/(app)/finance/payments/`
- receivables: `app/src/routes/(app)/finance/receivables/`
- accounting: `app/src/routes/(app)/finance/accounting/`

Primary service evidence includes:

- `app/src/lib/server/finance/invoice-service.ts`
- `app/src/lib/server/finance/payment-service.ts`
- `app/src/lib/server/finance/payment-control-service.ts`
- `app/src/lib/server/finance/receivable-position-service.ts`
- `app/src/lib/server/finance/accounting-service.ts`
- `app/src/lib/server/finance/accounting-source-service.ts`

The Journey A proof must demonstrate that these are consequences of the same customer/commercial/project thread rather than independent finance demonstrations.

## 7. Existing executable evidence

Primary commercial/browser chain:

- `app/e2e/ui-crm-commercial.e2e.ts`

Golden reference context:

- `app/e2e/golden-reference-enterprise.e2e.ts`

Project-focused browser suites:

- `app/e2e/project-hierarchy.e2e.ts`
- `app/e2e/project-plan.e2e.ts`
- `app/e2e/project-resource-capacity.e2e.ts`
- `app/e2e/project-progress-earned-value.e2e.ts`
- `app/e2e/project-rida.e2e.ts`
- `app/e2e/project-change.e2e.ts`
- `app/e2e/project-financial-control.e2e.ts`
- `app/e2e/procurement-commercial-control.e2e.ts`
- `app/e2e/documents-project-information.e2e.ts`
- `app/e2e/site-quality-safety.e2e.ts`
- `app/e2e/assets-maintenance.e2e.ts`

Representative real-MySQL integration proof:

- `app/src/lib/server/commercial/commercial-lifecycle.integration.test.ts`
- `app/src/lib/server/contracts/contract-formation.integration.test.ts`
- `app/src/lib/server/projects/project-workspace.integration.test.ts`
- `app/src/lib/server/projects/project-plan.integration.test.ts`
- `app/src/lib/server/projects/project-resource-capacity.integration.test.ts`
- `app/src/lib/server/projects/project-progress.integration.test.ts`
- `app/src/lib/server/projects/project-rida.integration.test.ts`
- `app/src/lib/server/projects/project-change.integration.test.ts`
- `app/src/lib/server/commercial/project-financial-control.integration.test.ts`

## 8. Gap this trace exposes

The repository has many strong component proofs, but the World-Class target requires one continuous browser-level proof that starts from the golden reference customer/opportunity and ends in governed accounting and profitability consequences.

This document should therefore be used to build the Journey A E2E test, not as a substitute for that test.
