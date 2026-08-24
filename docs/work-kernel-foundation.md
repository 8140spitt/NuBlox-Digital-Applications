# 58 — NuBlox Work Kernel Foundation

**Status:** implementation foundation  
**Effective:** 22 August 2026  
**Governing architecture:** `docs/57-world-class-native-erp-architecture.md`  
**Purpose:** establish one cross-domain execution layer for actions, tasks, approvals, reviews, decisions, assignments and business-event delivery.

## 1. Product decision

NuBlox must not implement a separate task/approval engine inside every construction module.

The Work Kernel is the horizontal execution layer beneath project controls, design/CDE, commercial, procurement, site, quality, safety, finance, assets, maintenance and future built-environment domains.

A domain continues to own its business semantics. The Work Kernel owns the common execution semantics:

- accountable work identity;
- assignment;
- due dates and priority;
- open/in-progress/blocked/completed/cancelled lifecycle;
- approval/review decisions;
- attributable lifecycle evidence;
- business-event publication through a durable transactional outbox.

## 2. Existing duplication being consolidated

The current baseline already contains domain-specific execution records including:

- `defect_actions`;
- `ncr_actions`;
- `safety_actions`;
- `work_order_tasks` and work-order assignments;
- multiple domain-specific approval/status-event patterns.

Those records are not deleted by this package. Existing domain tables remain authoritative until each domain is deliberately linked or migrated.

This avoids a flag-day rewrite and preserves released evidence.

## 3. Canonical records

### `work_items`

Represents one unit of accountable work.

Supported kinds:

- `action`;
- `task`;
- `approval`;
- `review`;
- `decision`;
- `acknowledgement`.

The first lifecycle is intentionally small:

```text
open -> in_progress -> completed
  |         |
  |         +-> blocked -> in_progress
  |
  +---------------------> cancelled
```

Domain state does not automatically equal work-item state. For example, completing an NCR corrective-action work item does not itself close the NCR; the NCR domain service remains responsible for its own lifecycle and verification rules.

### `work_item_assignments`

Assignment can target:

- an organisation;
- a team;
- a member.

The schema allows a participant organisation to differ from the owning organisation so future controlled cross-organisation construction collaboration does not require a second task model. Runtime project/portal scope checks remain mandatory before exposing cross-organisation assignments.

### `work_item_decisions`

Stores attributable decisions for approval/review work items. The first decision vocabulary is:

- approved;
- rejected;
- returned;
- acknowledged.

Decision authority and segregation-of-duties checks are domain/service responsibilities. A row in `work_item_decisions` is evidence of a decision, not a substitute for the governing domain transition.

### `work_item_events`

Immutable event evidence records creation, assignment and lifecycle activity with correlation IDs. Material state changes should append an event in the same transaction as the work-item mutation.

### `outbox_events`

Durable event publication queue. The domain mutation and event enqueue can share a `DatabaseExecutor` transaction. Delivery happens later and never determines whether the business transaction committed.

This replaces the previous placeholder-only outbox adapter.

## 4. Source linkage rule

`work_items.source_domain`, `source_type` and `source_public_id` provide provenance/navigation metadata, not relational ownership.

They must **not** become an EAV substitute or the sole integrity mechanism between domains.

When a domain is migrated onto the Work Kernel, its authoritative table should gain an explicit relational link where practical. The source reference remains useful for search, navigation, audit and event payloads.

## 5. Permissions

The Work Kernel introduces:

```text
work.view
work.create
work.assign
work.progress
work.complete
work.approve
work.manage
```

`work.manage` is the same-domain umbrella only. Existing NuBlox permission precedence still applies:

```text
explicit member deny
    > explicit member allow
    > active role grant
    > default deny
```

A granular explicit deny must never be bypassed by `work.manage`.

Project-linked work must additionally pass active project scope checks.

## 6. Transaction boundary

A controlled domain operation that creates or changes work should converge on this pattern:

```text
BEGIN
  mutate authoritative domain record
  create/update canonical work item if required
  append work_item_event
  append audit_event
  enqueue outbox_event
COMMIT
```

The outbox consumer may then materialise:

- in-app notifications;
- email/SMS delivery requests;
- automation triggers;
- search-index updates;
- analytics/event projections;
- external webhooks.

Those consumers must be idempotent.

## 7. Migration strategy

The first domain migrations should be selected for high value and low semantic ambiguity:

1. safety actions;
2. NCR actions;
3. defect actions;
4. maintenance work-order tasks;
5. RFI/submittal/document review actions;
6. procurement and commercial approvals;
7. finance approvals requiring explicit segregation of duties.

For each migration:

- retain historical domain evidence;
- backfill or link only when provenance is unambiguous;
- make new writes transactional across domain + Work Kernel;
- prove explicit-deny and project-scope behaviour;
- add end-to-end integration tests;
- avoid dual mutable status sources.

## 8. Notification centre

The application-shell Notifications control is activated from canonical `outbox_events`; route-specific notification state is not introduced.

The first in-app projection deliberately remains read-only and derives recent notification candidates on demand:

- `work.item.assigned` routes a notification to the directly assigned member;
- `work.item.status_changed` routes relevant activity to the work creator and active direct member assignees;
- `work.item.decision_recorded` routes relevant decision evidence to the work creator and active direct member assignees;
- organisation ownership is enforced in the projection query;
- `work.view` / `work.manage` permission decisions are re-evaluated for organisation or project scope before shell data is returned;
- the shell links notification activity back to the governed My Work workspace.

The number shown in the shell is a **recent-event count**, not an unread count. This avoids inventing read semantics before durable member inbox state exists.

The next notification package should add durable, idempotent delivery state rather than mutating `outbox_events` into a user inbox. That package should cover:

- per-member notification inbox/read/dismiss state;
- subscription and routing preferences;
- notification deduplication at the delivery boundary;
- asynchronous email/digest delivery;
- overdue reminders and escalation policy;
- deeper source-record links as domains adopt canonical Work Kernel linkage.

## 9. Definition of done for this foundation

The foundation is complete when:

1. the migration applies cleanly after the current migration stream;
2. generated Kysely types are regenerated from migrated MySQL;
3. work-item create/assign/progress/complete/decision operations are transactional;
4. audit and outbox evidence are emitted atomically;
5. explicit permission denies override `work.manage`;
6. project-linked work is project-scope constrained;
7. integration tests run against real MySQL;
8. the first existing domain writes through the Work Kernel without duplicate mutable state.

This package establishes the shared execution substrate. It does not claim that all existing domain actions have already migrated.
