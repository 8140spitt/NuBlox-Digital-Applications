# Project controls plan and schedule baselines

NuBlox treats project-controls planning as a governed project domain, not as an extension of workforce scheduling.

## Canonical boundary

The project plan is the current authoritative scope-and-time model for an authorised project. It contains:

- `project_wbs_nodes` — hierarchical work breakdown structure nodes;
- `project_plan_activities` — activities and zero-duration milestones assigned to WBS scope;
- `project_plan_dependencies` — active or removed schedule-network relationships with FS/SS/FF/SF logic and lead/lag;
- `project_plan_baselines` — immutable schedule-baseline headers;
- `project_plan_baseline_activities` — immutable activity/milestone facts captured at baseline time;
- `project_plan_baseline_dependencies` — immutable dependency-network facts captured at baseline time.

The existing `schedule_events` records remain workforce/resource scheduling. They answer who is expected to work, where and when. Project-plan activities answer what controlled project scope is planned and how its schedule network is structured. The two domains may be linked in later resource-loading slices, but they are not the same record.

## Scope invariants

Every WBS node, activity, dependency and baseline is tenant- and project-scoped. Database constraints enforce organisation-owned project scope for planning records and same-project relationships for parent WBS nodes, activity WBS assignment and dependency endpoints.

A project member must already have active project scope before the plan service will resolve the project. Plan permissions never create project membership or cross-project visibility.

Project-plan mutations are additionally restricted to the project-owning organisation. Cross-organisation participants may receive authorised read access but cannot mutate the owner's current plan or capture its baselines.

## Authority

The planning permission catalogue is:

- `project.plan.view` — view WBS, activities, milestones, dependencies and baselines inside authorised project scope;
- `project.plan.manage` — maintain current WBS, activities, milestones and dependency relationships for owned projects;
- `project.plan.baseline.manage` — capture immutable schedule baselines for owned projects.

`project.manage` is the management umbrella for plan mutation authority.

Existing standard roles receive the permissions through the forward migration. Future organisation bootstrap grants management permissions to Owner, Administrator and Manager, and view permission to Finance/Commercial, Member/Professional, Field Worker and Read Only.

## Dependency governance

The service rejects:

- self-dependencies;
- duplicate active dependency edges;
- dependency types outside FS, SS, FF and SF;
- a new edge when the existing directed network already contains a path from the proposed successor back to the proposed predecessor.

That final rule prevents schedule cycles before persistence. Dependency correction is soft removal with actor and timestamp evidence rather than destructive deletion.

## Baseline semantics

A baseline is not a pointer to the mutable current plan. Capture occurs inside a project-serialised database transaction and copies:

- activity public identity;
- WBS code;
- activity code and name;
- activity/milestone kind and current status;
- planned start, finish and duration;
- every active predecessor/successor relationship, relationship type and lag.

No ordinary update/delete API exists for baseline records. Later additions or dependency corrections to the current plan therefore do not rewrite historical baseline evidence.

## Audit evidence

Material writes append canonical audit events:

- `project.wbs_node.created`;
- `project.plan.activity_created`;
- `project.plan.dependency_created`;
- `project.plan.dependency_removed`;
- `project.plan.baseline_captured`.

Audit rows retain acting organisation, user/member, project, subject public identity and correlation ID.

## Delivered user surface

`/projects/[projectPublicId]/plan` is the dedicated project-controls workspace. It provides:

- WBS register;
- activity/milestone schedule table;
- dependency-network register;
- immutable baseline register;
- controlled creation and baseline-capture forms where authority permits.

The global `/schedule` route remains the workforce schedule.

## Deliberately deferred

This foundation does not yet claim:

- critical-path/total-float calculation;
- project calendars and working-time engines;
- resource loading/capacity;
- progress/earned-value measurement;
- WBS/CBS/RBS/OBS cross-mapping;
- schedule import/export such as Primavera P6 or Microsoft Project;
- automated baseline approval workflow.

Those are subsequent project-controls slices built on these canonical records rather than parallel schedule truth.
