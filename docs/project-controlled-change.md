# Controlled project change

## Purpose

NuBlox treats project change as a governed cross-domain process, not as a synonym for a commercial variation.

The canonical progression is:

```text
Project change event
    ↓
Impact assessment
    ├── Scope / WBS
    ├── Programme / activities
    ├── Cost / cost codes
    ├── Contract
    └── Information
    ↓
Decision
    ↓
Downstream implementation
    ↓
Implementation evidence
    ↓
Closure
```

The existing `project_change_events` record remains the neutral change identity. This slice does not create a competing change master.

## Canonical boundary

A change event records that something changed or may need to change. It does not itself become:

- a revised WBS or programme activity;
- a budget adjustment;
- a commercial variation;
- a contract amendment;
- a document revision;
- an instruction;
- a Work Kernel action.

Those records remain authoritative in their own domains. Project change control links the evidence and governs the decision that allows those domains to be updated.

Existing strong relationships are reused:

- `change_event_information_links` for exact information versions;
- `commercial_variation_change_events` for commercial treatment;
- Package 009 variation-to-contract-amendment / PO-version evidence for contractual and procurement implementation.

## Impact assessment

`project_change_assessments` is versioned. A draft can be maintained; once submitted it is historical evidence. A later reassessment creates a new version and supersedes the previous submitted assessment rather than rewriting it.

Each assessment records an impact position across five domains:

| Domain | Canonical linkage | Assessment purpose |
| --- | --- | --- |
| Scope | WBS nodes | Identify affected project scope/work breakdown |
| Programme | Project-plan activities | Identify schedule/activity impact |
| Cost | Project cost codes | Classify estimated cost exposure |
| Contract | Project-linked contracts | Identify contractual notice/amendment impact |
| Information | Existing change-event information links | Identify drawing/model/specification/review impact |

Each domain is classified as `none`, `potential` or `confirmed` and may carry a narrative assessment. Cost and time deltas are estimates at the change-control boundary; they do not overwrite authoritative budgets, forecasts or schedule dates.

## Decision evidence

Submitted assessments are decided separately from assessment preparation.

Supported decisions are:

- accepted;
- accepted with conditions;
- rejected;
- deferred.

`project_change_decisions` is additive immutable evidence. A deferred decision does not destroy the submitted assessment; the change remains under review and may be reassessed before another decision.

Acceptance means the proposed change is authorised for downstream implementation. It does **not** mean that the programme, budget, contract or information records have already been changed.

## Implementation

Implementation is recorded only after an accepted decision.

The implementation record states what downstream controls were actually updated. It is deliberately separate from the source-domain records themselves.

Examples:

```text
Accepted change
├── programme activity revised / new baseline captured
├── budget adjustment approved
├── client commercial variation agreed
├── contract amendment executed
├── supplier order version issued
└── revised information issued
```

The project change is then marked `implemented`. Closure is a further controlled step.

Rejected changes can also be closed, preserving their assessment and decision history.

## Lifecycle

```text
identified
    ↓
under_review
    ├── deferred → under_review / reassessment
    ├── rejected → closed
    └── accepted → implemented → closed

identified / under_review → cancelled
```

A change cannot be implemented without accepted decision evidence. A change cannot be closed directly from `identified`, `under_review` or `accepted`.

## Permissions and segregation of duties

Project change authority is server-authoritative:

- `project.change.view`
- `project.change.manage`
- `project.change.assess`
- `project.change.approve`
- `project.change.implement`
- `project.change.close`

`project.manage` remains the umbrella authority for project owners/administrators where appropriate.

The model intentionally separates assessment and approval permissions so organisations can implement segregation of duties. Standard-role defaults are bootstrap policy, not a substitute for permission checks.

## Audit and events

Material transitions write audit and outbox evidence transactionally:

- `project.change.raised`
- `project.change.assessment_saved`
- `project.change.assessment_submitted`
- `project.change.decided`
- `project.change.implemented`
- `project.change.closed`
- `project.change.cancelled`

The aggregate remains the immutable public ID of the canonical `project_change_events` record.

## Product experience

The project Change workspace is designed as one control surface rather than five disconnected modules. Users can see:

- the change register and current lifecycle state;
- the latest cross-domain impact position;
- exact WBS/activity/cost-code/contract context;
- existing information and commercial-variation evidence counts;
- the current authoritative decision;
- implementation and closure evidence.

This completes the Project Controls backbone required before deeper design/CDE, field production and supply-chain workflows: later domains can raise/link change events without inventing their own competing change process.
