# 17 — Business Object, Lifecycle & Workflow Registry V2

**Status:** Governing V2 platform catalogue  
**Effective:** 14 September 2026  
**Scope:** canonical business-object starter definitions across enterprise functions F01–F29.

## Purpose

NuBlox separates three concepts that must not be conflated:

```text
Business object
  → Lifecycle
  → Workflow
```

A **business object** is the canonical enterprise thing being governed, such as a strategy cycle, opportunity, contract, supplier, purchase order, invoice, project, document, risk, employee, asset or process.

A **lifecycle** defines the legal business states that object may occupy and the controlled transitions between those states.

A **workflow** defines the human and system work used to review, approve, execute, resolve, escalate, revise or close a business-object transition.

The object registry is not a second transaction model. Installed starter packs create tenant-owned drafts in the existing lifecycle and workflow administration tables and remain subject to the existing publish, activation, versioning, permission, evidence and runtime controls.

## Governing source

The executable registry is:

- `appv2/src/lib/platform/object-template-registry.ts`

Installation into tenant-owned lifecycle and workflow drafts is governed by:

- `appv2/src/lib/server/platform/object-template-library-service.ts`

The administrator surface is:

- `/{tenant}/app/lifecycle/registry`

The catalogue is organised by the canonical F01–F29 enterprise-function taxonomy while object ownership remains aligned to the native NuBlox domain model. A function may use objects owned by several native domains; this does not create duplicate departmental records.

## Lifecycle patterns

The initial registry standardises recurring lifecycle shapes rather than inventing unrelated state vocabularies for every object:

| Pattern | Intent |
| --- | --- |
| `GOV` | governed definitions and approved evidence |
| `MASTER` | master/reference records |
| `PLAN` | planned and approved activity |
| `TXN` | controlled transactions |
| `CASE` | cases, requests, enquiries and investigations |
| `RISK` | risks and treatment/monitoring records |
| `WORK` | operational work and acceptance |
| `DOC` | controlled information and records |
| `PROJECT` | delivery objects with approval and handover gates |
| `ASSET` | long-lived physical or digital assets |
| `EVENT` | immutable transactional/evidential facts |

Each object may later evolve beyond its starter pattern through normal controlled template revision. The pattern is a safe starting point, not an architectural restriction.

## Workflow families

Starter workflows use reusable workflow families:

- approval;
- review;
- controlled revision;
- case resolution;
- execution;
- exception/escalation;
- periodic review;
- closure;
- qualification/activation;
- stage-gate review.

Installed workflows contain real multi-step nodes and participant roles rather than an empty Start → End example. They are created as drafts so administrators can adapt participants, deadlines, conditions, routing and event bindings before publication.

## Initial cross-enterprise starter pack

The registry highlights the first 18 object types intended to demonstrate the NuBlox enterprise digital thread:

1. Strategy cycle / framework — `strategy.strategy-cycle`
2. Governance decision — `governance.decision`
3. Sales opportunity — `sales.opportunity`
4. Contract / agreement — `commercial.contract`
5. Supplier — `procurement.supplier`
6. Purchase requisition — `procurement.requisition`
7. Purchase order — `procurement.purchase-order`
8. Supplier invoice — `finance.supplier-invoice`
9. Material / item master — `supply.material`
10. Project — `project.project`
11. Project change request — `project.change-request`
12. Controlled document — `information.document`
13. Non-conformance report — `quality.non-conformance`
14. Enterprise / operational risk — `risk.risk`
15. Employment / engagement — `people.employment`
16. Physical asset — `asset.physical-asset`
17. Maintenance work order — `maintenance.work-order`
18. Enterprise process — `process.process`

These are highlighted, but the registry itself contains canonical starter objects across all 29 enterprise functions.

## Installation rule

Installing a starter pack:

1. checks `lifecycle.manage` and `workflow.manage` authority;
2. creates the lifecycle template as a tenant-owned **draft** if that registry lineage does not already exist;
3. creates the associated workflow templates as tenant-owned **drafts** if their lineages do not already exist;
4. creates lifecycle phases and transitions from the registry definition;
5. links lifecycle transitions to matching starter workflow keys where the object defines that workflow family;
6. creates useful workflow roles and multi-step workflow graphs;
7. appends governed version evidence;
8. appends platform audit/outbox evidence for installation;
9. does **not** publish or activate the templates automatically.

The operation is lineage-idempotent. Re-selecting an already installed object does not create duplicate template lineages.

## Publish and runtime rule

Starter installation is intentionally separate from activation.

An administrator must review and, where required, adapt:

- lifecycle states and transitions;
- participant-role mappings;
- workflow participants;
- deadlines and escalation;
- conditional routing;
- permissions and segregation of duties;
- business-event bindings.

Only after the normal publish controls are satisfied does a lifecycle become the active lifecycle binding for an object type, or a workflow become available for runtime event binding.

## Completeness rule

Presence in the registry is not proof that the underlying business function is complete. The registry defines an initial governed object/lifecycle/workflow model. World-Class completion remains governed by the F01–F29 capability map, the native-domain control matrix, value-stream continuity, reporting/drill-through, interoperability, control evidence and automated proof.
