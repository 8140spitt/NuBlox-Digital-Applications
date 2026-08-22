# Layer 3 — State, Work, Events and Evidence

**Status:** Governing execution semantics

Layer 3 defines how authoritative business records change without losing history or accountability.

## Domain state machines

Material records have explicit server-enforced state transitions. Every transition defines:

- command/intent;
- allowed source state(s);
- resulting state;
- required permission;
- tenant/project/record scope;
- required fields and evidence;
- segregation/delegation rules;
- invariant checks;
- transactional side effects;
- emitted domain/audit/outbox events;
- notifications/work items where required;
- idempotency behavior;
- correction/reversal behavior.

State must not be inferred from unrelated data when it materially controls business behaviour.

## Correction patterns

Use the pattern appropriate to the semantic fact:

- **draft edit** — mutable because no material external/approved fact exists yet;
- **new revision/version** — preserves a prior issued/reviewed information state;
- **supersession** — a new authoritative version replaces use of an earlier one while preserving history;
- **void/cancel** — terminates a record without pretending it never existed;
- **reversal** — additive compensating evidence for financial/accounting or equivalent posted facts;
- **addendum/amendment** — preserves executed/approved baseline and records change explicitly;
- **reopen** — explicit audited transition when business policy permits it.

## Work Kernel

The Work Kernel provides shared execution semantics for:

- action;
- task;
- approval;
- review;
- decision;
- acknowledgement;
- assignment;
- priority and due date;
- open/in-progress/blocked/completed/cancelled lifecycle;
- attributable decision evidence.

A domain record remains authoritative for its business lifecycle. Completing a work item does not automatically close the source NCR, change, RFI, maintenance order or other domain record unless the owning domain service explicitly performs that transition.

See [`../../work-kernel-foundation.md`](../../work-kernel-foundation.md) for the current implementation foundation.

## Four evidence channels

NuBlox distinguishes:

1. **domain record/history** — authoritative business state and domain-specific evidence;
2. **audit event** — who performed a material action in what context;
3. **domain/business event** — a meaningful fact used by other internal processes;
4. **outbox/delivery event** — durable transactional handoff to asynchronous automation/integration.

Notifications are delivery/user-experience artefacts; they are not authoritative business evidence.

## Event rule

A material state mutation and its transactional event/outbox evidence must commit atomically where downstream delivery depends on that fact.

Consumers must assume at-least-once delivery and use stable event identity/idempotency.

## Evidence quality

Material evidence records should preserve, as applicable:

- actor/member/organisation;
- timestamp and business date;
- source and target state;
- reason;
- linked record/version;
- correlation ID;
- checksum or immutable content identity;
- approval/decision result;
- project/location context;
- correction/reversal provenance.

Audit data must not become an uncontrolled duplicate full-record database.