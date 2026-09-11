# F05 — Product, Service & Innovation Management implementation evidence

Issue: #140  
PR: #141

## Canonical function coverage

| Sub-function | Native implementation | Evidence boundary |
| --- | --- | --- |
| F05.01 Portfolio strategy | `product_service_portfolios`, `product_service_offerings`, ProductServiceService and `/product-service` | Links F01 objectives/KPIs and F03 evidence; does not duplicate strategy or performance truth |
| F05.02 Market/customer needs | `product_service_needs` with source-domain provenance | Reuses CRM/market/operational source identifiers rather than duplicating customer masters |
| F05.03 Product/service ideation | `product_service_ideas`, risk-aware triage scoring and attributable decision evidence | Keeps the innovation funnel inside F05 while preserving source provenance |
| F05.04 Business case development | versioned `product_service_business_cases`, assumptions/scenarios, approval and predecessor supersession | Expected initiative economics only; Finance remains authoritative for posted actuals |
| F05.05 Product/service design | `product_service_designs`, `product_service_design_reviews`, review-gated approval and supersession | References controlled D6 evidence and approved F05 business cases |
| F05.06 Development | `product_service_development_plans`, approved-design prerequisite and completion evidence | `project_public_id` links D5 execution rather than creating a competing project plan |
| F05.07 Launch management | `product_service_launch_plans`, completed-development prerequisite, readiness evidence, F02 decision gate and launch state | References governance/readiness evidence and updates the F05 offering lifecycle only |
| F05.08 Lifecycle management | `product_service_lifecycle_reviews` | Consumes F03/customer evidence references for continue/improve/reposition/invest/retire decisions |
| F05.09 Product retirement | `product_service_retirement_plans`, F02 decision prerequisite and controlled completion | Captures customer/operations/finance/data transition intent without replacing those domains' systems of record |
| F05.10 Innovation management | `product_service_innovation_experiments`, explicit hypothesis/method/measure and validated/invalidated/inconclusive closure | Converts learning into governed F05 evidence without inventing parallel strategy or project truth |

## Governed lifecycle thread

`F01 strategy / CRM or operational signal → F05 portfolio → need → idea → risk-aware triage → versioned business case → design → design review/approval → development → launch readiness → F02 launch decision → go-live → F03/customer lifecycle evidence → retirement recommendation → F02 retirement decision → controlled retirement → retained innovation learning`

The lifecycle service enforces the important decision prerequisites rather than treating stages as free-form statuses:

- design may reference only an approved business case;
- design approval requires review evidence and is blocked by a failed review;
- development requires an approved design;
- a linked development plan must be completed before launch planning;
- launch approval requires readiness evidence and an F02 governance decision reference;
- lifecycle reviews carry F03/customer evidence references and an explicit recommendation;
- retirement linked to a lifecycle review requires that review to recommend retirement;
- retirement approval requires an F02 governance decision reference;
- innovation experiments must link to at least one portfolio, idea or offering and close with an explicit outcome and learning summary.

## Security and attribution

F05 has an independent fail-closed permission family:

- `product_service.view`
- `product_service.manage`
- `product_service.approve`

Standard-role reconciliation includes the F05 permission template. Every service action validates the active organisation member and writes attributable audit/outbox evidence tagged with `function: 'F05'` and the relevant sub-function.

## Database evidence

The authoritative migration stream now includes:

- `20260911201000_product_service_innovation.sql`
- `20260911202500_product_service_permissions.sql`
- `20260911203500_product_service_lifecycle.sql`

A clean MySQL 8.4 migration run measured the post-F05 schema at:

- **521 application tables**
- **1,391 foreign keys**
- **836 CHECK constraints**

The Complete System Validation schema guard is pinned to those measured counts. Product/service tables are isolated into dedicated Kysely code generation and intersected into the application database schema.

## Automated proof

Real-MySQL integration coverage includes:

- F05.01–F05.04: portfolio, offering, attributable need, idea, risk-aware scoring, business-case versioning, approval/supersession, audit evidence, permission denial and tenant-boundary denial;
- F05.05–F05.10: approved-business-case design, design-review gate, approved-design development, completion, launch governance negative/positive paths, go-live, lifecycle review, retirement governance negative/positive paths, controlled retirement and innovation experiment closure.

The product/service command centre is exposed at `/product-service` under the independent F05 permission family. Server actions exist for the full F05.01–F05.10 lifecycle. Browser E2E and final UI lifecycle controls remain part of the PR closure gate and must pass before merge.

## Closure status

This document records implementation evidence; it is not a closure declaration. PR #141 must remain unmerged until:

1. the F05.05–F05.10 user interface is fully operational rather than placeholder-only;
2. product/service browser E2E is committed and passing;
3. capability-map and SAP benchmark evidence are updated without overstating unrelated gaps;
4. all PR review findings are resolved;
5. an owner-authored exact head passes Complete System Validation;
6. the PR is merged, merged-main validation passes, issue #140 is closed and the feature branch is deleted.
