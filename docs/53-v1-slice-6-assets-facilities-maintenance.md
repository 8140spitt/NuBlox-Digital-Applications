# V1 Slice 6 — Assets, Facilities & Maintenance

## Product boundary

Slice 6 activates the existing Package 010 Assets, Facilities & Maintenance schema inside the NuBlox application shell. The V1 boundary is a controlled operational asset lifecycle that survives individual projects and reuses existing NuBlox sources of truth.

An authorised tenant team can:

1. register facilities and physical building/level/space hierarchy;
2. define maintainable asset types and register parent/component assets;
3. record controlled asset lifecycle transitions;
4. link a facility to an authorised contributing project without making the project own the asset;
5. report reactive maintenance requests and generate attributable work orders;
6. create active calendar-based planned-maintenance tasks and generate work orders from the source task;
7. assign eligible CRM suppliers/service providers as work-order contractors;
8. complete work orders with attributable task and status evidence;
9. record asset inspection/service/repair history, optionally tied to a completed work order;
10. publish versioned operational compliance requirements, assign them to assets and record outcomes against the exact published version;
11. link exact issued or superseded Package 007 information revisions as asset, work-order, service or compliance evidence.

## Source-of-truth rules

### Facilities and assets

Facilities and assets are tenant-owned long-lived operational facts. They may exist without a project. Projects contribute through `facility_project_links` for construction, handover, refurbishment, maintenance, replacement or decommissioning contexts; a project never becomes the owner of the asset lifecycle.

Buildings, levels, spaces and asset parent/component relationships remain within one facility context. Runtime services enforce compatible hierarchy in addition to Package 010 foreign keys.

### Controlled information

Asset and maintenance documents remain exact Package 007 `information_container_versions`. Slice 6 does not create another attachment store. A linked revision must be issued or superseded, visible to the acting member and belong to a project explicitly linked to the subject facility.

### Workforce, contractors and procurement

Internal workers remain Package 003 workforce records. External contractors remain CRM `parties`; Slice 6 uses the existing procurement supplier/service-provider eligibility projection rather than duplicating contractor masters. Purchase-order and timesheet facts remain authoritative in their source domains.

### Quality and compliance

Package 008 quality inspections remain independent controlled inspection evidence. Slice 6 compliance requirements use stable identities plus published versions so an event records the exact rule that was in force. NuBlox configuration does not itself determine legal applicability; competent users remain responsible for assigning statutory/client requirements.

## Access-control model

All runtime reads and writes require active tenant/member context plus explicit permission decisions.

Standard V1 role defaults are:

- **Owner / Administrator / Manager** — full Slice 6 control;
- **Member/Professional** — asset, maintenance, service and compliance working control, without facility-master administration by default;
- **Field Worker** — facility/asset visibility, reactive request capture, attributable work completion, service recording and compliance visibility;
- **Finance/Commercial / Read Only** — facility, asset, maintenance and compliance visibility only.

Navigation and hidden mutation controls are UX projections only; services re-check permissions server-side.

## Controlled lifecycles

### Asset

`planned/installed → active ↔ isolated/inactive → decommissioned → disposed`

Every material transition is transactional, attributable and appended to `asset_lifecycle_events`. Asset identity/history is retained rather than overwritten or recreated for each project.

### Reactive maintenance

`new maintenance request → open/assigned work order → completed work order → service history`

The generated work order preserves `source_maintenance_request_id`. The request, work order and service record remain separate facts with their own status and attribution.

### Planned maintenance

`active plan → plan asset + task + calendar schedule rule → generated work order → completion/service history`

Generated work orders preserve `source_maintenance_plan_task_id`. V1 prevents a second active work order for the same plan task and asset.

### Compliance

`stable requirement → published version → asset assignment → compliance event`

A compliance event binds the exact published requirement version associated with its active assignment and records attributable outcome evidence.

## Mobile operational workspace

`/assets` is the Slice 6 operational workspace. It provides:

- facility/building/level/space registration;
- asset type and asset registration;
- lifecycle controls;
- reactive requests;
- planned-maintenance schedules and work-order generation;
- contractor assignment and work-order completion;
- service/inspection history;
- compliance requirement, assignment and event registers;
- exact controlled-information evidence linking.

The surface uses touch-sized controls, responsive grids and single-column narrow-screen layouts for field and desktop use.

## V1 acceptance boundary

Slice 6 is complete when permanent Complete System Validation proves:

- production migrations and generated database types remain exact;
- standard-role defaults are equivalent for existing and newly created organisations;
- facility and asset records are tenant-owned and can exist without projects;
- hierarchy validation prevents cross-facility asset/location relationships;
- asset lifecycle transitions append attributable history;
- reactive requests preserve source identity into work orders;
- planned work orders preserve exact source maintenance tasks and avoid duplicate active generation;
- eligible CRM contractors can be assigned without duplicating supplier identity;
- work-order completion is attributable and terminal;
- service history can bind a completed work order only when the asset is on that order;
- compliance events bind the exact published requirement version for the active assignment;
- exact controlled-information evidence is constrained to an authorised facility-project context;
- read-only browser visibility does not expose mutation controls;
- owner browser acceptance traverses facility → asset → reactive/planned maintenance → work completion → service/compliance history;
- mobile-responsive workspace behaviour remains intact;
- the complete permanent validation gate is green on the exact final head.

## Explicitly deferred

The following are outside this Slice 6 release boundary:

- unrestricted EAV custom asset fields;
- GIS/indoor positioning and digital-twin geometry/model serving;
- IoT/BMS protocol ingestion and high-frequency telemetry storage;
- predictive-maintenance/ML scheduling;
- warehouse/spares inventory management;
- autonomous legal/statutory applicability determination;
- energy billing and tariff engines;
- cross-tenant shared asset identity;
- offline-first field synchronization and conflict resolution;
- full warranty/meter/handover-package administration UI;
- automatic background recurrence generation beyond controlled on-demand V1 schedule generation.

Future extensions must preserve tenant ownership, facility context, exact-version evidence, attribution and source-domain boundaries.
