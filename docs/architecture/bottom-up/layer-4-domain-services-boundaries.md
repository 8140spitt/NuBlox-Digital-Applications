# Layer 4 — Domain Services and Boundaries

**Status:** Governing application architecture

Layer 4 assigns ownership of invariants and transactions. The modular monolith is organised around explicit domain boundaries, not route folders or database-table convenience.

## Domain ownership

A domain owns:

- its canonical records or specialised records;
- lifecycle/state rules;
- domain invariants;
- commands and queries;
- permission checks specific to its mutations;
- audit/domain event production;
- correction semantics;
- reporting semantics for facts it owns.

## Service rule

Routes, form actions, API handlers, background jobs and UI components call domain/application services. They do not implement independent business rules.

Domain A must not mutate Domain B's authoritative tables directly merely because both are in the same database. Cross-domain change is coordinated through explicit service calls and/or durable events.

## Transaction boundaries

A transaction should contain the smallest coherent set of writes required to preserve one business invariant.

Where a command changes several records inside one owning domain, those changes may be atomic. Where a process crosses domains, prefer explicit orchestration and event/outbox semantics over giant implicit transactions unless a real invariant requires atomicity.

## Dependency direction

Preferred direction:

```text
route/API/job
→ application/domain service
→ repository/query abstraction
→ MySQL
```

Cross-cutting facilities such as authentication context, permission resolution, audit, outbox, document storage and observability are invoked through explicit platform boundaries.

## Domain contract

Each material domain command documents:

- input intent;
- actor/context requirement;
- canonical records affected;
- permission;
- preconditions/invariants;
- transaction boundary;
- resulting state;
- returned result;
- audit/event output;
- idempotency/correlation behavior;
- expected failure classes.

## Query rule

Queries may compose read-only data across domains through explicit application/query services, but must preserve tenant/permission scope and must not turn a reporting join into ownership ambiguity.

Read models, caches and search indexes are derivative. They can be rebuilt from authoritative records or have an explicit provenance contract.

## Shared kernels

Shared concepts are permitted only where semantics truly are cross-domain. Current examples include:

- identity/tenant context;
- permission resolution;
- Work Kernel execution semantics;
- event/outbox infrastructure;
- audit/provenance primitives;
- common money/time/reference primitives.

A “generic framework” is not a reason to erase meaningful domain concepts.