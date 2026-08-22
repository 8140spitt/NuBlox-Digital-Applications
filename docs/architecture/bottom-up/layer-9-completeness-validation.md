# Layer 9 — Completeness and Validation

**Status:** Governing definition of architectural completion

Layer 9 proves that a claimed capability is connected all the way down to authoritative implementation.

## Capability completeness gate

A material capability is not complete until all applicable items exist and are validated:

1. **Canonical records** — no competing business identity.
2. **Relationships and ownership** — tenant/project/party/asset context explicit.
3. **Data invariants** — schema and service rules defined.
4. **Lifecycle/state machine** — valid transitions and terminal/correction states.
5. **Permissions** — granular actions, scope and default-deny behaviour.
6. **Segregation/delegation** — material authority controls where required.
7. **Domain service boundary** — one authoritative mutation path.
8. **Work/approval model** — accountable actions where human execution is required.
9. **Audit/events/outbox** — attributable evidence and reliable downstream facts.
10. **Correction semantics** — edit/version/supersede/void/reversal/reopen explicit.
11. **Commercial/financial consequence** — linked where the process changes value, cost, commitment, revenue, cash or accounting.
12. **Reporting/KPIs** — derived from authoritative facts with defined semantics.
13. **Interoperability** — import/export/API/event contracts where externally relevant.
14. **Experience** — usable, accessible, context-aware web/mobile surface.
15. **Validation** — migrations, integration tests, unit tests, type/check/build and browser acceptance as applicable.

## Traceability chain

For any user-visible action, we should be able to trace:

```text
workspace action
→ domain command
→ permission + scope + policy
→ lifecycle transition
→ canonical records/relationships
→ transaction + constraints
→ audit/domain/outbox evidence
→ process consequences
→ reporting/search projection
→ automated tests
```

For any database record, we should be able to trace upward to the business concept/process/capability that justifies it.

## Change-design checklist

A proposed feature is rejected or redesigned when it:

- starts from a screen without canonical-record analysis;
- creates duplicate party/project/asset/contract/finance identities;
- uses a project role or career as implicit permission;
- puts stable relational business concepts into opaque JSON without justification;
- mutates another domain's authoritative data directly;
- overwrites issued/approved/posted history;
- creates a mutable cached balance as a second authority;
- omits rejection/correction/concurrency behaviour;
- claims capability because a route exists without end-to-end controls/tests.

## Implementation authority

Committed MySQL migrations are the implemented schema authority. Generated Kysely types are derivative. Domain services and tests establish runtime invariant behaviour.

Architecture documentation must be updated when the intended invariant changes; SQL/code/tests must be updated when implementation changes. Temporary delivery status belongs in GitHub, not in governing architecture.

## Release validation

The exact command set evolves with the repository, but the release gate should cover at least:

- clean migration application and zero pending migrations;
- generated database-type drift check;
- lint/format;
- integration tests against real MySQL for persistence/security-critical behaviour;
- Svelte/TypeScript diagnostics;
- unit tests;
- production build;
- Playwright/browser acceptance for material user journeys.

Counts of tables, constraints or tests are observations of a particular baseline, not permanent architecture invariants.