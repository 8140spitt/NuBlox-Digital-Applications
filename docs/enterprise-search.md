# NuBlox enterprise search

## Purpose

Enterprise search is the governed cross-domain record finder for the NuBlox operating system. It is not a second record store and it does not weaken the authority boundaries of source capabilities.

The first production slice searches three canonical record families:

- projects;
- controlled information containers/documents;
- Work Kernel items.

The search workspace is available at `/search` and is discoverable from the More workspace directory.

## Authority model

Search uses a two-stage security boundary.

1. Candidate queries are tenant/member scoped at source. Project and document candidates require an active project organisation plus active project membership. Work candidates must belong to the active organisation and be created by or directly assigned to the active member.
2. Every candidate is then re-evaluated through `PermissionService` before it can be returned to the user.

Permission mapping:

| Record family | Permission check | Scope |
| --- | --- | --- |
| Project | `project.view` | Project |
| Controlled information | `information.view` | Project |
| Work Kernel | `work.view` with `work.manage` umbrella semantics | Project when present, otherwise organisation |

This deliberately preserves `Career ≠ Organisation Role ≠ Project Role ≠ Permission` and prevents search from becoming a metadata side-channel.

## Canonical-source rule

No search-index table is introduced in this slice. Queries read canonical domain tables directly and return lightweight search projections. This keeps correctness ahead of indexing complexity while NuBlox is still expanding its canonical domain model.

A later indexing package may consume durable domain/outbox events to build a materialised search index when scale requires it. That index must remain reconstructable from canonical records, retain provenance, and apply the same effective permission checks at query time.

## Query behaviour

- minimum meaningful query length: 2 characters;
- maximum query length: 120 characters;
- case-insensitive substring matching;
- result limit: 30 by default, hard maximum 50;
- exact reference/title and prefix matches rank ahead of general substring matches;
- search URLs are shareable and bookmarkable through `?q=`.

## Result destinations

- projects open their canonical project workspace;
- documents open the controlled-information workspace with project context;
- Work Kernel items open My Work until a dedicated Work Kernel item detail route exists.

## Validation

`enterprise-search.integration.test.ts` provides real-MySQL evidence that:

- project, document and Work Kernel records are returned from one query;
- records from another organisation are not exposed;
- an explicit `information.view` deny removes document results without suppressing independently authorised project/work results.

`enterprise-search.e2e.ts` proves the search workspace is discoverable from More, accepts a query, and presents the authorised empty-result state through the application shell.

## Follow-on scope

The same search contract can be extended to other canonical record families as their authority boundaries stabilise, including organisations/contacts, opportunities, contracts, procurement, site/quality/safety, finance, workforce, assets/facilities and property records.

The next UX integration step is to point the existing topbar Search control at this enterprise search service so workspace navigation and governed record search share one command surface.
