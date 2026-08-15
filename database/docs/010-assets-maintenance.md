# NuBlox Database Package 010 — Assets & Maintenance

## Status

Implementation-level relational specification for the final planned NuBlox baseline database-domain package.

**Target:** MySQL 8.4 / InnoDB  
**Design target:** 3NF by default  
**Depends on:** Packages 001–009

## 1. Purpose

Package 010 establishes the long-lived operational asset and facilities-management model used after construction handover and throughout operation, maintenance, inspection, refurbishment and disposal.

The package covers:

- facilities and project-to-facility handover relationships;
- buildings, levels, spaces and building systems;
- asset types, models, assets and parent/component relationships;
- asset identifiers and controlled-information links;
- lifecycle events, warranties and meter readings;
- handover packages and exact revision evidence;
- planned and reactive maintenance;
- maintenance requests, work orders, tasks and assignments;
- labour/procurement traceability without duplicating source transactions;
- asset service history;
- compliance requirements, effective versions, assignments and inspection events.

## 2. Primary design rule

> **A facility and its assets are long-lived operational records; projects contribute to them but do not own their entire lifecycle.**

A construction project may create, refurbish, replace or hand over assets. The same facility can later participate in many projects. Therefore the operational hierarchy is tenant-owned and project relationships are explicit junction records.

## 3. Reused domains

Package 010 reuses rather than duplicates:

- `organisations`, `organisation_members` and tenant security from Package 001;
- `parties` for manufacturers, warranty providers, contractors and authorities from Package 002;
- `purchase_order_items` for procured maintenance goods/services from Package 005;
- `workers`, `timesheet_entries` and workforce scheduling facts from Package 006;
- `project_sites`, projects and controlled `information_container_versions` from Package 007;
- `quality_inspections` where an operational compliance event uses a Package 008 inspection workflow;
- commercial classification/reporting from Package 009 where operational costs later need project/commercial treatment.

## 4. Operational hierarchy

The target hierarchy is:

```text
Organisation
  └── Facility
       ├── Building
       │    ├── Level
       │    └── Space
       ├── Building System
       └── Asset
            └── Child Asset / Component
```

A `facility` may be linked to zero, one or many projects over time.

Examples:

- original construction project;
- fit-out project;
- refurbishment project;
- plant replacement project;
- maintenance capital project;
- demolition/decommissioning project.

## 5. Facilities

`facilities` are tenant-owned operational roots.

Key fields include:

- organisation;
- public ID and facility code;
- name and description;
- optional tenant-owned address;
- timezone;
- operational status;
- commissioning/opening dates.

A facility does not require a project to exist. This supports FM organisations importing existing estates where NuBlox was not used during construction.

### 5.1 Project relationships

`facility_project_links` records why a project relates to a facility.

Example link roles:

- construction;
- handover;
- refurbishment;
- fit-out;
- maintenance;
- replacement;
- decommissioning;
- other.

The organisation owning the facility must be a valid participant in the linked project.

## 6. Buildings, levels and spaces

`facility_buildings` represents physical buildings within a facility.

`building_levels` represents floors/levels within a building.

`facility_spaces` represents rooms, zones or other managed spaces. A space may optionally have a parent space for controlled nesting.

Examples:

```text
Facility
  └── Main Building
       ├── Level 00
       │    ├── Reception
       │    └── Plant Room 01
       └── Level 01
            ├── Office 1.01
            └── Office 1.02
```

The schema does not use a generic EAV location tree.

## 7. Building systems

`building_system_types` is tenant-configurable master data.

Examples:

- electrical distribution;
- fire alarm;
- heating;
- ventilation;
- cooling;
- domestic water;
- drainage;
- security;
- lifts;
- BMS;
- renewable energy;
- lighting;
- communications.

`building_systems` represents actual installed systems within a facility/building.

Assets may belong to a system and a physical space simultaneously.

## 8. Asset types and models

`asset_types` classifies maintainable assets without using free-form type strings.

Examples:

- boiler;
- heat pump;
- air-handling unit;
- fan-coil unit;
- distribution board;
- fire alarm panel;
- emergency light;
- pump;
- lift;
- access-control panel;
- solar inverter.

`asset_models` stores reusable manufacturer/model information for an asset type.

Manufacturer may reference a CRM party known to the tenant and also stores a model/manufacturer display value suitable for operational use.

## 9. Assets and components

`assets` is the stable maintainable-asset identity.

Key fields include:

- facility;
- optional building, level, space and system;
- asset type and optional asset model;
- parent asset for component assemblies;
- asset tag;
- serial number;
- description;
- install, commission and decommission dates;
- lifecycle status;
- criticality.

Components use the same `assets` table through `parent_asset_id`. This avoids a second competing component master.

Example:

```text
Air Handling Unit AHU-01
  ├── Supply Fan
  ├── Extract Fan
  ├── Heating Coil
  └── Filter Bank
```

## 10. Asset identifiers

`asset_identifier_types` and `asset_identifiers` store structured external identifiers such as:

- manufacturer serial;
- barcode;
- QR reference;
- RFID;
- BMS point/reference;
- legacy asset number;
- statutory registration number.

This is identifier master data, not a generic EAV mechanism.

## 11. Controlled information

`asset_information_links` connects an asset to an exact Package 007 controlled-information revision.

Example link roles:

- O&M manual;
- datasheet;
- drawing;
- commissioning record;
- test certificate;
- photograph;
- risk information;
- other.

The exact revision is preserved. A later document revision does not silently replace the historical evidence previously linked to an asset.

## 12. Lifecycle history

`asset_lifecycle_events` records append-oriented lifecycle facts such as:

- installed;
- commissioned;
- placed in service;
- moved;
- temporarily isolated;
- returned to service;
- decommissioned;
- disposed;
- replaced.

The current `assets.lifecycle_status` is operational state; the event table preserves how that state was reached.

## 13. Warranties

`warranty_types` and `asset_warranties` preserve warranty facts independently of mutable supplier/manufacturer records.

A warranty records:

- provider party where known;
- warranty reference;
- start/end dates;
- terms summary;
- claim contact information where needed;
- status through dates, not a duplicated editable `is_expired` flag.

`asset_warranty_information_links` attaches exact controlled-information revisions such as warranty certificates or terms.

Warranty current/expired state is derived from status and dates.

## 14. Meters and readings

`meter_types`, `asset_meters` and `asset_meter_readings` support condition/usage-based maintenance.

Examples:

- run hours;
- operating cycles;
- electricity kWh;
- gas volume;
- water volume;
- heat meter;
- pressure/count values where a maintained asset exposes an operational meter.

Readings are append-oriented facts. A later reading does not overwrite earlier readings.

## 15. Handover

`handover_packages` represents a controlled transfer of operational asset information from project delivery into facility operations.

A handover package may link:

- a project;
- a facility;
- specific assets;
- exact controlled-information revisions.

`handover_package_assets` and `handover_package_information_links` preserve the exact asset/document set included in the handover event.

Package 010 does not copy O&M files into a second document store.

## 16. Maintenance requests

`maintenance_requests` records reactive intake before a work order necessarily exists.

Examples:

- fault report;
- user request;
- breakdown;
- damage;
- alarm response;
- defect observed in operation.

A request can identify a facility/space and may link one or more assets through `maintenance_request_assets`.

Request status is distinct from work-order status because a request may be rejected, duplicated, combined or resolved without formal work.

## 17. Planned maintenance

`maintenance_plans` is the logical maintenance plan.

`maintenance_plan_assets` associates assets with the plan.

`maintenance_plan_tasks` defines work to be performed.

`maintenance_task_schedule_rules` defines recurrence independently of the task text.

Supported scheduling bases include:

- calendar interval;
- meter/usage threshold;
- manual/event-driven.

The next due date/value is normally derived from schedule rules and completed service history. It is not maintained as an unrelated editable balance.

## 18. Work orders

`work_orders` is the operational instruction to perform maintenance work.

Work orders may originate from:

- a maintenance request;
- a planned-maintenance task;
- a compliance event;
- manual authorised creation.

The model includes:

- work-order type;
- priority;
- facility and location;
- status;
- requested/planned/actual timing;
- ownership and completion evidence.

### 18.1 Asset links

`work_order_assets` supports work against multiple assets without putting comma-separated asset IDs on the work order.

### 18.2 Assignments

Internal workers and external contractors are different relationships:

- `work_order_worker_assignments` references workforce workers;
- `work_order_party_assignments` references CRM parties.

This avoids a generic `assignee_type/assignee_id` polymorphic foreign key.

### 18.3 Tasks

`work_order_tasks` records ordered work/check steps and completion evidence.

### 18.4 Status history

`work_order_status_events` preserves lifecycle transitions instead of relying only on the current status column.

### 18.5 Documents

`work_order_information_links` references exact controlled-information revisions used as instructions/evidence.

### 18.6 Labour and procurement traceability

`work_order_timesheet_entries` links approved/claimed time facts from Package 006.

`work_order_purchase_order_items` links procured goods/services from Package 005.

Neither relation duplicates labour cost, PO quantity or PO value.

## 19. Service history

`service_event_types` and `asset_service_events` preserve actual asset service history.

A service event may reference a completed work order and records:

- service type;
- performed date/time;
- provider party/member;
- result;
- condition assessment;
- notes;
- optional recommended next service date.

The recommended next date is an explicit service finding, not the same thing as the system-derived maintenance schedule.

`service_event_information_links` attaches exact certificates/reports/test records.

## 20. Compliance

Operational compliance is modelled separately from ordinary maintenance.

`compliance_requirement_categories` provides controlled high-level classification.

`compliance_requirements` is the stable logical requirement.

`compliance_requirement_versions` preserves changing requirement details/effective dates.

Examples include organisation-configured requirements for:

- fire alarm inspection;
- emergency lighting tests;
- lift thorough examination;
- pressure-system inspection;
- electrical inspection/testing;
- gas-safety inspection;
- water hygiene checks;
- other statutory or insurer/client requirements.

NuBlox configuration must not imply legal applicability merely because a template exists.

### 20.1 Assignments

Requirements can be assigned to:

- facilities via `facility_compliance_assignments`;
- individual assets via `asset_compliance_assignments`.

### 20.2 Compliance events

`compliance_events` records actual inspection/test/certification evidence against an exact requirement version.

It may optionally reference a Package 008 `quality_inspection` where that workflow was used.

Outcome examples:

- pass;
- pass with observations;
- fail;
- not applicable;
- cancelled/void where appropriate.

`compliance_event_information_links` attaches exact certificates/reports.

Current compliance state and overdue status are derived from assignments, requirement versions and completed events rather than maintained as duplicated booleans.

## 21. Normalisation decisions

### 21.1 3NF default

The model separates:

- facility identity;
- physical hierarchy;
- system identity;
- asset identity;
- type/model master data;
- lifecycle history;
- maintenance planning;
- work execution;
- service evidence;
- compliance configuration;
- compliance evidence.

### 21.2 No generic EAV asset store

Core asset and maintenance concepts are relational.

Profession-specific asset attributes may later use explicit domain extension tables or controlled versioned form schemas. Package 010 does not introduce unrestricted `attribute_name/value` tables.

### 21.3 No duplicate transaction ledger

Work-order links do not copy:

- timesheet minutes/cost;
- PO quantities/values;
- document binaries;
- inspection responses.

Those remain authoritative in their source domains.

### 21.4 Valid historical duplication

Historical snapshots/evidence are permitted where they represent facts at an operational event, such as service findings, warranty contact information or handover composition.

## 22. Tenant and collaboration rules

- Facilities/assets are private tenant operational records unless explicitly shared by future network/portal policy.
- A linked project does not automatically expose the facility register to every project participant.
- A facility-owner organisation must be an authorised participant in a linked project.
- Package 007 information visibility rules still apply when linking controlled revisions.
- External contractors are referenced from the facility owner's CRM namespace.
- Safety-sensitive or security-sensitive asset information may require stricter permissions than ordinary facility records.

## 23. Deletion and history

- Facilities referenced by service/compliance history are archived, not casually deleted.
- Assets with work/service/compliance history are decommissioned/disposed through lifecycle state and events.
- Published/issued operational evidence remains historical.
- Work-order status events and service/compliance events are append-oriented.
- Incorrect unreferenced draft/configuration records may be hard-deleted where policy permits.

## 24. Derived operational measures

Examples normally derived rather than stored as independently editable balances:

- current warranty validity;
- next planned-maintenance due date/value;
- asset service age;
- open work-order count per asset;
- maintenance backlog;
- mean time between failures;
- current compliance/overdue state;
- facility/asset maintenance spend from linked source facts;
- asset availability where sufficient event data exists.

Reporting read models may later materialise these values separately from the authoritative transactional model.

## 25. Required domain-service invariants

The application must enforce invariants not completely expressible through simple MySQL foreign keys, including:

1. building/level/space/system selected on an asset must belong to the same facility;
2. `parent_asset_id` must belong to the same facility and cannot create cycles;
3. asset model must be valid for the asset type;
4. facility-project links require project visibility/authority in addition to relational participation;
5. controlled-information links must be visible to the linking organisation and relevant to the operational record;
6. handover assets and revisions must belong to/relate to the intended facility/project handover context;
7. meter readings must be chronologically/semantically valid for the meter and unit;
8. maintenance-plan assets and meter-based schedule rules must be compatible;
9. generated work orders must preserve their source maintenance task/request relationship;
10. timesheet entries linked to work orders must belong to the assigned/authorised worker and appropriate work context;
11. PO items linked to work orders must belong to authorised procurement for that tenant;
12. service events sourced from a work order must relate to an asset on that work order;
13. compliance assignments must use an effective requirement version according to organisation policy;
14. compliance events must relate to the correct facility/asset assignment and exact requirement version;
15. lifecycle transitions, work completion, compliance results and critical maintenance actions require permission checks and audit events.

## 26. Package tables

Package 010 creates the following structures:

1. `asset_categories`
2. `asset_identifier_types`
3. `warranty_types`
4. `meter_types`
5. `maintenance_plan_types`
6. `work_order_types`
7. `maintenance_priority_levels`
8. `service_event_types`
9. `compliance_requirement_categories`
10. `facilities`
11. `facility_project_links`
12. `facility_buildings`
13. `building_levels`
14. `facility_spaces`
15. `building_system_types`
16. `building_systems`
17. `asset_types`
18. `asset_models`
19. `assets`
20. `asset_identifiers`
21. `asset_information_links`
22. `asset_lifecycle_events`
23. `asset_warranties`
24. `asset_warranty_information_links`
25. `asset_meters`
26. `asset_meter_readings`
27. `handover_packages`
28. `handover_package_assets`
29. `handover_package_information_links`
30. `maintenance_requests`
31. `maintenance_request_assets`
32. `maintenance_plans`
33. `maintenance_plan_assets`
34. `maintenance_plan_tasks`
35. `maintenance_task_schedule_rules`
36. `work_orders`
37. `work_order_assets`
38. `work_order_worker_assignments`
39. `work_order_party_assignments`
40. `work_order_tasks`
41. `work_order_status_events`
42. `work_order_information_links`
43. `work_order_timesheet_entries`
44. `work_order_purchase_order_items`
45. `asset_service_events`
46. `service_event_information_links`
47. `compliance_requirements`
48. `compliance_requirement_versions`
49. `facility_compliance_assignments`
50. `asset_compliance_assignments`
51. `compliance_events`
52. `compliance_event_information_links`

## 27. Acceptance criteria

Package 010 is acceptable when:

- a facility can exist independently of a construction project;
- one facility can relate to multiple projects over its lifecycle;
- building/level/space/system/asset identity is relational and tenant-safe;
- asset components use parent assets rather than a competing component master;
- exact controlled-information revisions can be attached to assets, warranties, work and compliance evidence;
- asset lifecycle history is preserved;
- planned and reactive maintenance remain distinct facts;
- requests can generate work orders without being overwritten by them;
- work orders support multiple assets and separate internal/external assignments;
- labour/PO traceability does not duplicate source transaction values;
- service history remains append-oriented;
- compliance requirements are versioned/effective-dated;
- compliance state is derived from requirement assignments and event evidence;
- canonical relationships use foreign keys/junction tables rather than CSV/JSON IDs;
- ordinary derived operational balances are not duplicated merely for convenience.

## 28. Deferred beyond Package 010

The following are intentionally not part of this baseline package:

- unrestricted custom/EAV asset fields;
- full GIS/indoor-positioning model;
- IoT telemetry/time-series storage engine;
- BMS/SCADA protocol integrations;
- predictive-maintenance ML models;
- stock/warehouse inventory accounting;
- statutory legal-advice engine;
- full energy-management/utility billing engine;
- digital-twin geometry/model server;
- network-wide shared asset identity between independent tenants.

These can be added later without weakening the baseline asset identity and maintenance model.
