# Record Lifecycles and State Machines

**Status:** Canonical lifecycle architecture  
**Canonical execution architecture:** [`architecture/bottom-up/layer-3-state-work-events-evidence.md`](architecture/bottom-up/layer-3-state-work-events-evidence.md)

NuBlox uses a shared lifecycle kernel, while each owning business domain remains authoritative for the states, transitions and business invariants of its records. There is no single universal state machine that is copied mechanically across F01-F29.

## Platform lifecycle model

A lifecycle-managed object is governed by a versioned lifecycle template containing:

- lifecycle template identity and version;
- Basic or Advanced lifecycle mode;
- phases/states;
- permitted transitions and gates;
- edit, delete and revise capability by phase;
- permission required for material transitions;
- optional role-based phase access rules;
- optional workflow/process hooks; and
- immutable evidence of every material transition.

Basic lifecycles should be used for straightforward state machines. Advanced lifecycles are used only where the phase must alter role access or invoke a workflow/process. This avoids attaching heavyweight workflow semantics to ordinary operational records.

## Phase-scoped access

Advanced lifecycle phases may grant additional permissions to lifecycle roles for the duration of the phase. These phase grants are contextual and expire when the object leaves the phase.

Phase access is additive only. It never overrides NuBlox's central authority model, tenant boundary, explicit member deny, security restriction or other absolute platform control. Central deny semantics remain authoritative.

This lets NuBlox express behaviour such as:

- an author may modify a Draft record;
- an approver may review and approve while the record is In Review;
- a published record may be read and revised but not directly edited; and
- deletion may be available only to specifically authorised roles even where the lifecycle permits governed deletion.

## State is not workflow

Lifecycle state describes the maturity or operational condition of the business object. Workflow is an optional mechanism used to coordinate work needed to reach another state. A lifecycle transition can therefore exist without a workflow, while an Advanced lifecycle transition can optionally invoke one.

## Version control is separate from lifecycle

Governed record versioning and lifecycle state are separate concerns. Major/minor version control follows the NuBlox governed-versioning model, while lifecycle state describes what the current business object is doing.

Example:

`1.0 Published / In progress` -> controlled amendment -> `1.1 Draft / In progress` -> approval -> `2.0 Published / In progress`.

Published major versions remain immutable evidence. Superseded or historical status is a version-history outcome, not a user-facing next workflow step.

## Transition contract

Every material transition must define source state, target state, authority, tenant/project scope, required evidence, invariants, side effects, emitted evidence/events, idempotency and correction behaviour.

Approved/issued/executed/posted facts are corrected through controlled revision, supersession, void, reversal, addendum or audited reopen semantics as appropriate; they are not silently overwritten.

Deletion is orthogonal to lifecycle maturity. Where domain policy permits governed deletion of an approved business object, the operation must be explicitly authorised, impact-aware, transactional, cascade only through records owned by that domain, and retain published version snapshots and audit evidence.

The Work Kernel supplies shared task/action/approval execution semantics. The Lifecycle Kernel supplies common lifecycle mechanics. Neither replaces domain lifecycle authority.

## Lifecycle administration

Tenant administrators with `lifecycle.view`, `lifecycle.manage` and `lifecycle.publish` authority use the V2 Lifecycle administration workspace at `/{tenant}/app/lifecycle`.

Lifecycle definitions are governed business configuration, not mutable application constants:

- a new template begins as a working minor version (`0.1`);
- meaningful changes advance the working minor version;
- publishing produces an immutable major version (`1.0`, `2.0`, ...);
- changing a published template creates a controlled draft revision;
- publication of the successor makes the previous major historical/superseded;
- object-type bindings point only to published versions;
- Advanced lifecycle roles are mapped to existing tenant organisation roles rather than creating a second identity or RBAC model; and
- phase-scoped grants are evaluated only after explicit member denies, so a lifecycle can add contextual authority but cannot defeat an absolute deny.

F01 is the first runtime consumer. Each F01 object type resolves an active tenant binding such as `F01.framework`; if no published tenant binding exists, the code-backed F01 reference template remains the safe fallback. This allows controlled adoption without changing the semantics of existing tenants.

