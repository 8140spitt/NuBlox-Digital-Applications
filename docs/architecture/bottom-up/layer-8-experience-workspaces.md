# Layer 8 — Experience and Workspace Composition

**Status:** Governing experience architecture

Layer 8 turns lower-layer capability into usable product surfaces. UI composition is intentionally late in the architecture.

## Context-first principle

Users primarily work in the context of real records:

- organisation;
- customer/supplier/party;
- opportunity/bid;
- project/programme;
- contract;
- site/location;
- property/building/space;
- asset/system;
- work order/service case;
- document/model/information container.

A workspace composes relevant commands, related records, work items, evidence and analytics without duplicating their underlying authority.

## Workspace rules

1. UI state is not business authority.
2. Hidden controls do not replace permission checks.
3. One action maps to an explicit domain command.
4. The user sees business identifiers/names, not internal implementation IDs.
5. State transitions expose reason/evidence requirements clearly.
6. Corrections use domain-defined revision/void/reversal semantics.
7. Cross-domain summaries link to authoritative source records.
8. Career and project role tune relevance/terminology, not permission.
9. Progressive complexity hides irrelevant enterprise detail without deleting it from the model.
10. Accessibility target remains WCAG 2.2 AA.

## Shared experience surfaces

Horizontal surfaces include:

- command centre/home;
- My Work/action centre;
- global search;
- notifications;
- approvals/reviews;
- recent activity/evidence;
- contextual reporting;
- administration/master-data governance.

## Construction experience

Field/site workflows are mobile-first and resilient to constrained connectivity where business risk requires it. Capture should minimise duplicate typing through context, defaults, scanning/location/photo evidence and reusable records while preserving server-side validation.

## Navigation

Navigation groups work by recognisable business context and responsibility, not by exposing internal service/database boundaries. A route may compose multiple capability domains but each mutation still resolves to one authoritative command boundary.

## Derived views

Dashboards, kanban boards, timelines, Gantt views, maps, BIM viewers and analytical cards are projections over lower-layer facts. Their visual representation never becomes a parallel transactional source of truth.