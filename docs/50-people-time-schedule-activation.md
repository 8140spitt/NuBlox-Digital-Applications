# V1 Slice 2 — People, Time and Schedule Activation

## Status

Implemented as the second product-activation slice defined by `docs/49-v1-product-architecture-and-delivery-sequence.md`.

This slice activates the existing Package 006 workforce/time/scheduling schema. It does **not** introduce a duplicate workforce, task, calendar or time model.

## Product boundary

The runtime product surface adds three connected workspaces:

- **People** — workforce identity, engagement, competency evidence and project staffing;
- **Schedule** — appointments, visits, shifts, inspections, work sessions and other planned work;
- **Time** — self-scoped timesheet periods, project/schedule-linked time entry, submission and independent approval.

Package 006 does not contain a generic cross-module `tasks` table. For this activation, actionable assigned work uses the existing `schedule_events` row with event type `work_session`, plus `schedule_event_workers` for worker assignment. A future generic task capability must remain a separate platform boundary rather than silently becoming a second scheduling model.

## Core lifecycle

The activated vertical slice is:

1. an active organisation member is linked to one tenant-scoped `workers` record;
2. the worker receives a controlled engagement and optional competency evidence;
3. an authorised manager assigns the worker to an organisation-owned project using `project_resource_assignments`;
4. project-linked scheduled work requires that prior resource assignment;
5. non-manager workers see only schedule events assigned to their own worker identity;
6. the worker creates and edits only their own draft/rejected/reopened timesheets;
7. project time requires active project staffing for the work date;
8. schedule-linked time requires that the schedule event is assigned to the same worker;
9. submission locks ordinary entry editing and appends both lifecycle and audit evidence;
10. approval/rejection requires `timesheet.approve` and cannot be performed by the worker on their own sheet;
11. approval snapshots the effective standard hourly cost rate into `timesheet_entry_cost_snapshots`;
12. later cost-rate changes do not recalculate approved historical snapshots.

## Permissions

The activation adds:

- `workforce.view`
- `workforce.manage`
- `workforce.competency.manage`
- `workforce.credential.manage`
- `workforce.cost_rate.view`
- `workforce.cost_rate.manage`
- `workforce.assignment.manage`
- `schedule.view`
- `schedule.manage`
- `timesheet.view`
- `timesheet.manage`
- `timesheet.submit`
- `timesheet.approve`

Existing standard roles receive data-migration defaults. Newly bootstrapped organisations receive the same defaults through `ensureWorkforceStandardRoleDefaults` immediately after their standard roles are created.

Navigation is a projection of these effective permissions. Server-side service/route checks remain authoritative.

## Deliberately deferred boundaries

The following Package 006 schema remains available but is not fully activated by this slice:

- credential create/verification UI;
- workforce cost-rate management UI;
- reusable work-calendar administration;
- worker unavailability/leave workflows;
- attendance/check-in workflows;
- timesheet correction/reopen policy;
- day-based labour costing, which requires an explicit day-duration policy;
- generic cross-module task management.

The permission catalogue includes credential and cost-rate capabilities because those are established Package 006 security boundaries, but the first product UI does not expose privileged mutation controls for them.

## Cross-cutting invariants

- Tenant keys are mandatory on every workforce/schedule/time lookup and mutation.
- Organisation membership and workforce identity remain different concepts.
- CRM people records are not automatically workers.
- A project resource assignment never replaces project membership or project permission checks.
- Schedule visibility for ordinary workers is assignment-scoped.
- Timesheet mutation is worker-self-scoped even when a role has broad read permissions.
- Self-approval is forbidden.
- Submitted and approved timesheets are immutable through ordinary entry APIs.
- Cost snapshots are historical evidence and are not recalculated when live rates change.
- All lifecycle and key creation operations append audit evidence.
- UTC instants are stored for schedule events; local schedule input requires an explicit IANA timezone.
- Invalid daylight-saving local times are rejected rather than silently shifted.

## Acceptance contract

The slice is complete only when the permanent Complete System Validation gate proves:

- permission migration applies cleanly with no schema-count regression;
- Kysely generated types remain drift-free;
- real-MySQL integration tests exercise staffing, schedule scope, time-entry scope, submission, self-approval denial, independent approval, cost snapshots and tenant isolation;
- Svelte diagnostics remain zero-error/zero-warning;
- production build succeeds;
- browser acceptance proves unauthenticated protection, read-only non-mutation, permission-aware navigation, and the real owner flow:
  `project → project staffing → scheduled work session → project/schedule-linked time → submission`.

## Next slice

After this slice is green and merged, the V1 sequence continues with **Documents and Information**, activating the existing Package 007 information-management baseline rather than extending finance further.
