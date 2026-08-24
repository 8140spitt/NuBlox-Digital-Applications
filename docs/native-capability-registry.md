# Native capability registry

## Purpose

NuBlox has 19 stable native capability domains defined by `docs/construction-and-built-environment.md`. Those domains are product-architecture boundaries, not 19 disconnected applications or permanent navigation entries.

The executable registry lives at:

`app/src/lib/navigation/capability-registry.ts`

It is the code-level mapping between the governing architecture and the application surface.

## Registry contract

Every native domain records:

- the stable domain number and machine key;
- the canonical domain name and concise scope description;
- current implementation maturity;
- a short evidence-based maturity note;
- the permission namespaces owned or targeted by the domain;
- current application routes that represent delivered native capability.

The registry contains exactly 19 domains and preserves the order in the governing architecture.

## Maturity semantics

### `operational`

A substantive native horizontal or business core is active with canonical records/services and usable application surfaces. This does not mean every bullet in the governing domain scope is complete.

### `partial`

Meaningful native capability exists, but material parts of the governing domain scope remain to be delivered.

### `planned`

The domain remains a required NuBlox product boundary but does not yet have a dedicated live native workspace representing that domain.

Maturity is product metadata. It is not calculated from a user's permissions.

## Permission and route resolution

The app shell resolves registry routes against the authenticated member's effective permission keys.

A capability may therefore be globally `operational` or `partial` while exposing no route to a particular member. This is intentional: product maturity is not an authorisation decision.

Member-safe horizontal utilities such as enterprise search and personal contexts remain available without fabricating a broad permission. Their underlying data remains server-authoritative and permission-filtered.

Planned permission namespaces are allowed in the registry even before corresponding permissions are seeded. They document the intended authority boundary and must be reconciled when that domain is implemented.

## User experience

`/capabilities` renders the registry as the **Native capability map**. It shows all 19 domains and their maturity, but only shows workspace links that the current member may access.

The capability map is discoverable from `/more`. It is deliberately not used to create 19 sidebar modules.

## Governance

When capability delivery materially changes:

1. update the registry maturity and route/permission mappings in the same change;
2. keep the governing domain name and number aligned with `construction-and-built-environment.md`;
3. do not mark a domain `operational` merely because a screen exists;
4. keep primary navigation task-oriented and permission-filtered rather than deriving it mechanically from the 19 domains;
5. extend unit and browser evidence whenever registry behaviour changes.

The registry unit test enforces domain count/order, unique keys, planned-route boundaries, permission filtering and maturity summary invariants.
