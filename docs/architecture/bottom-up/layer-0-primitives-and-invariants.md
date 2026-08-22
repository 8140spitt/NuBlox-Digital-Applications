# Layer 0 — Primitives and Invariants

**Status:** Governing foundation

Layer 0 defines the smallest reusable semantics in NuBlox. Higher layers may combine them but must not reinterpret them inconsistently.

## Business primitives

NuBlox standardises the semantics of:

- internal identity and stable public identity;
- tenant/organisation scope;
- project/programme context;
- actor/member attribution;
- business reference and numbering scheme;
- name, description and controlled classification;
- status and lifecycle state;
- version/revision and sequence;
- reason, note and attributable evidence;
- date, local business date, timestamp, timezone and accounting period;
- money, currency, rate, tax, quantity, unit and rounding basis;
- location, spatial reference and asset/location classification;
- priority, due date and completion date;
- checksum, correlation ID and idempotency key;
- active/inactive/archive semantics;
- source, provenance and external reference.

## Non-negotiable invariants

1. **Stable identity:** a real business record keeps identity across ordinary state changes.
2. **Explicit ownership:** every tenant-owned root record has an authoritative owning organisation.
3. **Project sharing does not erase tenant ownership.**
4. **No identifier is authority:** possession of a public or internal ID never proves access.
5. **Normalised transactional truth:** 3NF is the default; duplication requires semantic justification.
6. **Historical facts are immutable or additively corrected:** issued, approved, posted, executed and certified facts are not silently rewritten.
7. **Money uses fixed precision** and records currency explicitly.
8. **Business dates are not timestamps:** date-only concepts remain date-only; instants are UTC with timezone context for presentation.
9. **Status is explicit:** material lifecycle state is not inferred from deletion or unrelated columns.
10. **Required absence is explicit:** nullable/optional values have domain meaning; missing data is not overloaded with unrelated states.
11. **Relationships are first-class:** many-to-many business relationships use explicit relational structures rather than comma-separated values or hidden JSON arrays.
12. **JSON does not replace stable relational concepts.**
13. **Reference data is versionable:** external standards/classifications are overlays, not irreversible schema assumptions.
14. **Every material mutation is attributable** to actor/context and produces appropriate evidence.
15. **Retries are safe where they can occur:** external and asynchronous mutation boundaries define idempotency.
16. **Corrections preserve provenance:** reversal, supersession, void, addendum or new revision is chosen deliberately.
17. **Cross-domain side effects are explicit:** no hidden write coupling.
18. **Security is server-authoritative:** client/UI state never grants access.
19. **Derived values do not become parallel authority** unless a controlled snapshot/read model is explicitly required.
20. **Database constraints and domain services reinforce each other:** neither is used as an excuse to omit the other.

## Schema policy

Committed MySQL migrations are the implemented schema authority. New schema must prefer:

- foreign keys for strong referential rules;
- CHECK constraints for locally enforceable invariants;
- tenant-scoped unique constraints for business references;
- explicit associative tables for relationships;
- immutable evidence tables for material historical actions;
- indexes beginning with common tenant/context predicates where appropriate.

Deliberate denormalisation requires an ADR identifying the normalised source, measured problem, consistency mechanism, rebuild behaviour and rollback strategy.

## Primitive reuse rule

A domain must not create a second meaning for a shared primitive. For example, “organisation”, “project”, “currency”, “document revision”, “member”, “asset” and “permission” must remain interoperable concepts across the platform.