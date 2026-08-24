# Project resource loading and capacity

## Purpose

This slice continues Section 2 of the NuBlox delivery programme by connecting the governed Project Plan to the canonical workforce model without collapsing workforce scheduling into project-controls scheduling.

The governing distinction is:

> **Project resource assignment is the staffing decision; activity resource loading is planned demand; capacity is derived supply.**

No editable capacity balance is introduced.

## Canonical boundaries

NuBlox already owns the relevant supply-side records in the workforce domain:

- `workers` identify workforce resources;
- `work_calendars` and `work_calendar_weekdays` define reusable working patterns;
- `worker_calendar_assignments` effective-date the applicable worker calendar;
- `worker_unavailability` records leave/training/other unavailable periods;
- `project_resource_assignments` records the decision to staff a worker to a project, including assignment dates and optional planned allocation percentage.

Project controls already owns:

- `project_wbs_nodes`;
- `project_plan_activities` and milestones;
- dependency networks;
- immutable schedule baselines.

This slice adds one new business fact:

- `project_activity_resource_allocations` records planned effort from an existing project resource assignment against a non-milestone Project Plan activity.

The new row must reference the same project, owning organisation and worker as the canonical project resource assignment. A resource therefore cannot be loaded directly onto an activity unless it has first been staffed to the project.

## Authority model

Resource-capacity access remains subordinate to the project boundary:

- active organisation membership is required;
- active project membership is required;
- `project.view` must allow the project;
- `project.resource.view` allows read access;
- `project.resource.manage` allows load/remove actions, with `project.manage` as the established management umbrella;
- explicit granular denies remain authoritative through `PermissionService`;
- mutation is restricted to the project owning organisation.

The capacity view exposes owner-organisation workforce facts. External participant organisations are therefore deliberately contained: project collaboration does not grant visibility into another organisation's workforce calendars, unavailability or capacity.

## Planned-effort semantics

A resource load records:

- project-plan activity;
- canonical project resource assignment;
- worker identity inherited from that assignment;
- planned effort in integer minutes;
- load start and finish dates;
- optional planning note;
- actor/time evidence.

Load dates must remain inside both:

1. the activity planned start/finish; and
2. the worker's project resource-assignment period.

Milestones cannot receive resource effort because they are zero-duration control points.

Only one active load is allowed per worker/project-assignment/activity combination through the service boundary. Corrections do not overwrite or delete history: the active row is marked `removed` with removing member/time evidence, after which a corrected allocation may be created.

## Capacity derivation

For each selected day and project resource, NuBlox derives:

```text
gross worker capacity
- overlapping unavailable minutes
= available worker capacity

available worker capacity
× project planned allocation percentage
= project capacity

project capacity
- phased activity planned effort
= capacity variance
```

A null project allocation percentage means the project assignment does not impose a percentage cap and is treated as 100% of available worker capacity.

Planned effort is uniformly phased across calendar working days inside the load window. If a worker has no configured calendar, demand can still be represented but capacity is reported as **not configured** rather than pretending the worker has zero true capacity.

Unavailability overlap is unioned before subtraction so overlapping absence records cannot double-reduce capacity.

## Utilisation and overload

The workspace derives:

- total project capacity minutes;
- planned load minutes;
- variance;
- worker utilisation percentage where capacity is configured;
- overloaded worker-days where planned load exceeds project capacity;
- resource count with missing calendar configuration.

These values are projections over canonical source records and are not stored as independently editable balances.

## UX

`/projects/[projectPublicId]/resources` provides a project-context resource workspace with:

- period filtering;
- project resource-pool visibility;
- controlled activity load creation/removal;
- current activity-resource load list;
- per-worker utilisation summary;
- per-day drill-through for gross capacity, unavailable time, project capacity, planned load and variance;
- explicit overload and missing-calendar indicators.

The existing `/schedule` workspace remains the operational workforce scheduling surface for shifts, visits and scheduled work. Resource capacity is not a replacement for `schedule_events`.

## Audit and correction evidence

Material mutations append canonical audit evidence:

- `project.resource_allocation.created`;
- `project.resource_allocation.removed`.

The source allocation row also retains `created_by_member_id`, `created_at`, `removed_by_member_id` and `removed_at`.

## Reporting and integration boundary

The derived capacity projection is intentionally query-time in this slice. Materialised utilisation/reporting projections require a later reporting architecture decision; consumers must not write back derived balances.

Activity resource allocations are canonical project-controls records and can later participate in governed events, earned-value/progress measurement, labour forecasting and resource-levelling services without changing the workforce scheduling truth.

## Acceptance proof

The real-MySQL integration test demonstrates:

- project resource assignment as a mandatory prerequisite;
- activity effort loading;
- calendar-derived capacity;
- unavailability subtraction;
- project allocation percentage limiting available capacity;
- overload/utilisation calculations;
- explicit missing-calendar state;
- owner read/write versus member read-only authority;
- external participant containment;
- activity/project-assignment date invariants;
- duplicate-active-load rejection;
- additive removal and corrected replacement loading;
- audit evidence.

Playwright acceptance covers the browser path from creating a project plan activity and staffing a project resource through to loading effort and inspecting the capacity workspace.
