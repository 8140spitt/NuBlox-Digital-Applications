# UX Friction Remediation Plan

**Status:** Implementation improvement backlog  
**Date:** 2026-08-27  
**Goal:** reduce perceived clunkiness in high-frequency workflows while preserving server-authoritative domain controls.

## 1. Where clunkiness is coming from

### 1.1 Full-page round trips after most actions

Representative route patterns currently redirect after actions:

- `app/src/routes/(app)/assets/+page.server.ts`
- `app/src/routes/(app)/purchasing/+page.server.ts`
- `app/src/routes/(app)/commercial/cost-control/+page.server.ts`

This gives strong consistency but creates heavy interaction cost for users who perform many micro-actions.

### 1.2 Dense multi-form workspaces

Large pages with many server forms increase cognitive load and reset context on each submit.

- `app/src/routes/(app)/assets/+page.svelte` (large, many POST forms)
- `app/src/routes/(app)/projects/[projectPublicId]/financials/+page.svelte` (many POST forms)
- `app/src/routes/(app)/commercial/cost-control/+page.svelte`
- `app/src/routes/(app)/purchasing/+page.svelte`

### 1.3 No progressive enhancement on app workspaces

Current app route components do not use enhanced form behavior, so interactions rely on full navigation/reload cycles.

### 1.4 Expensive shared layout work on most page loads

App layout currently resolves permissions, notifications and optional project workspace context on load:

- `app/src/routes/(app)/+layout.server.ts`

This is functionally correct but contributes to latency on repeated intra-app interactions.

### 1.5 N+1 query pattern in workspace load

Procurement workspace currently resolves latest RFQ version inside a loop:

- `app/src/routes/(app)/purchasing/+page.server.ts`

This is likely to become visibly slower as data volume grows.

## 2. Highest-impact improvements (priority order)

## P1 — Introduce progressive form enhancement for high-frequency actions

Target first:

1. `app/src/routes/(app)/purchasing/+page.svelte`
2. `app/src/routes/(app)/commercial/cost-control/+page.svelte`
3. `app/src/routes/(app)/projects/[projectPublicId]/financials/+page.svelte`

Approach:

- Convert critical forms to enhanced submissions.
- Keep server actions authoritative.
- On success, invalidate only relevant data slices rather than hard redirects where possible.
- Add inline pending/success/error micro-feedback per form.

Outcome expected:

- Faster perceived interactions.
- Reduced viewport jumps.
- Better continuity in data-entry sequences.

## P2 — Break monolithic pages into task-focused components

Target first:

1. `app/src/routes/(app)/assets/+page.svelte`
2. `app/src/routes/(app)/projects/[projectPublicId]/financials/+page.svelte`

Approach:

- Split each large page by process phase (for example setup, execution, review).
- Move each phase into standalone components with local state and lightweight status messages.
- Preserve single source of truth in services and actions.

Outcome expected:

- Lower cognitive load.
- Easier maintainability.
- Safer incremental UX iteration.

## P3 — Remove avoidable repeated layout work

Target:

- `app/src/routes/(app)/+layout.server.ts`

Approach:

- Keep auth/tenant checks as-is.
- Add short-lived cache for allowed permission keys by actor/member context.
- Defer optional project-context workspace load unless route requires it.
- Consider lazy notifications fetch after initial paint for non-critical views.

Outcome expected:

- Improved navigation responsiveness across the app shell.

## P4 — Eliminate N+1 and sequential query patterns

Target first:

- `app/src/routes/(app)/purchasing/+page.server.ts`

Approach:

- Replace per-row latest RFQ version lookup with batched repository query.
- Introduce repository method that returns latest version keyed by RFQ ID in one round trip.

Outcome expected:

- Better scalability under larger procurement datasets.

## 3. Delivery plan

### Sprint A (quick wins, 1-2 weeks)

1. Implement progressive enhancement and inline feedback for purchasing create/approve/issue flows.
2. Remove procurement N+1 latest-version lookup.
3. Add telemetry for action latency and failed actions by route.

### Sprint B (2-3 weeks)

1. Progressive enhancement for cost-control and financials key actions.
2. Component split for financials form-heavy sections.
3. Tune layout-level data loading and caching strategy.

### Sprint C (3-5 weeks)

1. Assets workspace decomposition into phase components.
2. Introduce context-preserving side panels/modals for repetitive sub-actions.
3. Add UX regression e2e checks for interaction continuity.

## 4. Measurement (to prove improvement)

Track before/after per workflow:

1. Median time from submit click to visible success state.
2. Number of full page navigations per completed workflow.
3. User task completion time for core scenarios:
   - procurement package -> RFQ -> PO issue
   - cost code -> budget -> variation decision
   - forecast create -> line update -> approve
4. Error recovery rate without leaving current page context.

## 5. Guardrails

1. Do not move business rules client-side.
2. Keep tenancy/permission checks in server actions/services.
3. Keep audit/event semantics unchanged.
4. Add tests for enhanced interaction parity with current server behavior.
