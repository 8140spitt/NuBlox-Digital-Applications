# 28 — Site Operations, Quality and Safety Domain Model

## 1. Purpose

This specification defines NuBlox Schema Package 008: the operational field/site, quality-management and health-and-safety records that sit on top of the project, workforce and controlled-information foundations established by Packages 001–007.

The governing rules are:

> **Planned work, site evidence, quality evidence and safety evidence are different facts and must not overwrite one another.**

> **Package 008 reuses projects, project sites, workers, CRM parties and controlled information; it does not create competing master records for those concepts.**

## 2. Scope

Package 008 covers:

### Site operations

- site diaries;
- weather observations;
- named workforce entries;
- anonymous/group labour summaries where individual worker records are not available;
- plant/equipment usage snapshots for diary evidence;
- work activities and progress notes;
- delays/disruptions;
- general diary notes;
- delivery records and delivery items;
- visitor logs;
- links from operational records to exact controlled-information revisions.

### Quality

- reusable inspection templates;
- immutable/published template versions;
- sections, inspection items and controlled options;
- project/site inspections;
- inspection responses and findings;
- defects/snags;
- defect corrective actions;
- non-conformance reports (NCRs);
- NCR corrective actions;
- explicit links between NCRs and related defects;
- links to drawings, specifications, photographs, certificates and other controlled information.

### Health and safety

- RAMS register records backed by controlled-information containers;
- approval/rejection/withdrawal evidence for exact RAMS revisions;
- toolbox talks, inductions, briefings and RAMS briefings;
- briefing attendance/acknowledgement;
- permits to work, authorised persons and permit controls;
- safety events using a normalised supertype/subtype model;
- incidents;
- near misses;
- observations;
- involved/injured persons;
- safety corrective/preventive actions;
- links to exact controlled-information revisions.

## 3. Dependencies

Package 008 depends on:

- Package 001 — organisations, members, projects and project participation;
- Package 002 — CRM parties for suppliers, contractors and known external people/organisations;
- Package 003 — units of measure for delivery quantities;
- Package 006 — workers and attendance evidence;
- Package 007 — project sites, controlled information containers/versions and project change events;
- Package 007 integrity stage — shared project-site referencing and review hardening.

Package 008 does **not** depend on the future asset/plant master in Package 010. Plant used only as diary evidence is therefore captured as an issue-time/historical description and identifier snapshot. When Package 010 introduces managed assets, future operational records may link to those assets through forward migrations without rewriting old diary evidence.

## 4. Normalisation target

The domain targets **3NF by default**.

Key rules:

1. A site diary header does not contain repeating labour, weather, delivery, visitor, plant or activity columns.
2. Named workers and unidentified/group labour are separate facts; a group headcount is not fabricated into individual worker records.
3. Delivery header facts are separate from delivery line items.
4. Inspection-template identity is separate from immutable template versions.
5. Template sections, items and item options are separate relations.
6. An inspection response does not overwrite its template item.
7. Inspection findings, defects and NCRs are separate lifecycle records.
8. Defects and NCRs may be related explicitly without duplicating their descriptions/status histories.
9. A RAMS register entry refers to a stable controlled-information container; approval events refer to exact immutable revisions.
10. A safety event stores facts common to all safety events, with incident/near-miss/observation-specific facts stored in subtype tables.
11. Corrective actions are separate child records so multiple actions, owners and due dates can exist without repeating columns.
12. Photographs and formal evidence are linked to Package 007 controlled-information versions; Package 008 does not create another document/file system.
13. Stable relational business facts are not placed in generic JSON or EAV payloads.

## 5. Cross-organisation project/site model

Package 007 establishes that project information may be owned by any valid project participant and that `project_sites` are shared project context.

Package 008 follows the same rule. Most project/site records therefore contain:

```text
project_id
owning_organisation_id
project_site_id
```

`(project_id, owning_organisation_id)` is constrained against `project_organisations`, while `(project_site_id, project_id)` is constrained against the shared project-site candidate key.

This means, for example, a main contractor and consulting engineer can each create their own inspections on the same site while keeping organisational ownership and authorisation separate.

Relational participation is not permission. Application authorisation still determines who may create, view, approve or close records.

## 6. Site diary model

A site diary is a dated operational record owned by one participating organisation for one project/site.

Typical structure:

```text
site_diary
├── weather observations
├── named worker entries
├── labour-group entries
├── plant usage snapshots
├── activities
├── delays/disruptions
├── notes
├── delivery links
├── visitor links
└── controlled-information links
```

The baseline permits one diary per organisation/project/site/date. If a future organisation needs separate shifts or disciplines, that requirement should be introduced explicitly rather than storing several indistinguishable same-day diaries.

### Lifecycle

Recommended lifecycle:

```text
draft → submitted → approved → locked
  ↘ cancelled
```

Once approved/locked, ordinary editing is prohibited. Corrections should be auditable and should not silently rewrite historical evidence.

## 7. Weather observations

Weather is recorded as one or more observations against a diary rather than one set of weather columns on the diary header.

Supported facts include:

- observation time;
- controlled condition code;
- temperature;
- wind speed;
- rainfall quantity;
- free-text operational impact note.

This supports multiple observations during a working day and avoids overwriting morning conditions with afternoon conditions.

## 8. Labour evidence

### Named workforce

`site_diary_worker_entries` references Package 006 `workers` and may optionally reference an attendance record.

It stores the diary-specific historical facts such as hours attributed to that diary and activity summary.

### Labour groups

`site_diary_labour_groups` represents crews/headcounts where individual worker identities are unavailable or inappropriate to model individually.

Examples:

- four agency labourers;
- six subcontract bricklayers;
- two visiting commissioning engineers.

A group entry may reference a CRM party representing the contractor/supplier but retains a description/headcount/hours snapshot as diary evidence.

## 9. Plant/equipment diary evidence

Package 010 will own the managed asset/plant register.

Package 008 therefore records plant diary evidence using historical fields such as:

- plant description;
- registration/fleet/reference snapshot;
- operating hours;
- operator worker where known;
- notes.

This is intentional historical evidence, not a competing plant master.

## 10. Deliveries

Deliveries are independent operational records because they may need to exist even when no diary is created.

Model:

```text
site_delivery
├── supplier party
├── delivery note/reference
├── received time/member
├── status
└── delivery items
```

A many-to-many diary link permits the same delivery to be referenced by the relevant operational diary without copying delivery details into the diary.

Delivery line quantities use Package 003 units of measure where available.

## 11. Visitor log

Visitor entries are independent site access/evidence records.

The record may reference a tenant CRM person when one exists, but also preserves historical name/company snapshots so a later CRM edit does not rewrite who was recorded on site at that time.

Entry and exit times remain separate facts.

## 12. Quality inspection templates

Inspection templates are tenant-owned reusable definitions.

Structure:

```text
quality_inspection_template
└── template_version
    ├── sections
    │   └── items
    │       └── options
    └── publication state
```

Draft template versions may be edited. Published/retired versions are historical definitions and should not be rewritten through ordinary APIs.

An inspection references the exact template version used, so later template edits do not alter past inspection meaning.

## 13. Inspection responses

Inspection responses store:

- the exact inspection;
- the exact template item;
- result code such as pass/fail/not-applicable/observation;
- optional bounded response values (text, decimal, boolean, date, option);
- comments;
- responder/time.

The template item determines which response value type is valid. Because that invariant spans rows/tables, the domain service and integration tests must enforce it in addition to database checks.

A response is not itself a defect or NCR. It may generate a separate `quality_inspection_finding`.

## 14. Inspection findings

A finding records evidence raised during an inspection, for example:

- defect/snag;
- non-conformance;
- observation;
- improvement opportunity.

Findings may later become a formal defect or NCR. Conversion/linkage must preserve the original inspection finding rather than moving/rewriting it.

## 15. Defects and snagging

`defect_records` represents actionable defects/snags.

Typical facts:

- defect number;
- project/site;
- title/description;
- severity;
- responsible organisation/member;
- due date;
- status;
- optional source inspection finding.

Lifecycle example:

```text
open → assigned → in_progress → ready_for_review → closed
  ↘ rejected/reopened
  ↘ cancelled
```

Multiple corrective actions are separate `defect_actions` rows.

## 16. Non-conformance reports

NCRs are kept separate from ordinary defects because they normally carry stronger process/compliance meaning, root-cause/disposition evidence and formal close-out.

Typical NCR facts include:

- NCR number;
- description/non-conformance statement;
- severity;
- responsible organisation/member;
- immediate containment;
- root cause;
- proposed disposition;
- due date;
- status;
- optional source inspection finding.

NCR actions are separate rows. An NCR can link to one or more related defects using an explicit junction table.

## 17. RAMS

A RAMS record is not another document body inside Package 008.

Instead:

```text
RAMS register record
    ↓
stable information container (Package 007)
    ↓
immutable revisions
    ↓
RAMS approval events for exact revisions
```

This allows NuBlox to answer which exact RAMS revision was approved, rejected or withdrawn, by whom and when.

Current approved RAMS state is derived from the event history and information-version lifecycle rather than maintained as an unrelated duplicated revision field.

## 18. Safety briefings and toolbox talks

`safety_briefings` supports controlled types such as:

- toolbox talk;
- site induction;
- RAMS briefing;
- task briefing;
- safety stand-down;
- other safety briefing.

Attendees are separate rows. A known worker can be referenced, while the name/organisation recorded at the briefing is retained as a historical snapshot.

Exact RAMS/document revisions used in the briefing are linked through `safety_briefing_information_links`.

## 19. Permits to work

Permits are independent controlled operational records.

Examples include:

- hot work;
- confined space;
- electrical isolation;
- excavation;
- work at height;
- lifting;
- roof access;
- other controlled work.

Permit model:

```text
permit_to_work
├── authorised persons
├── controls/conditions
└── information links
```

Permit validity dates/times, issuer, responsible organisation and lifecycle are preserved.

Permit status is not inferred solely from the current clock because suspension, cancellation and formal close-out are business facts.

## 20. Safety-event supertype/subtypes

The safety-event model avoids duplicating project/site/date/reporter/status fields across incident, near-miss and observation tables.

```text
safety_event
├── safety_incident
├── safety_near_miss
└── safety_observation
```

Every safety event has exactly one matching subtype consistent with its `event_kind`.

That exclusive-subtype invariant spans tables and must therefore be enforced by domain services/integration tests (or a future carefully reviewed trigger strategy).

## 21. Incidents

Incident-specific facts may include:

- incident severity;
- whether injury occurred;
- whether property/environmental damage occurred;
- immediate response;
- investigation summary;
- external report reference where applicable.

People involved are stored in `safety_event_people`, which supports known workers and historical name/organisation snapshots.

The schema deliberately avoids hard-coding a single jurisdiction's statutory reportability rules. Jurisdiction-specific reporting workflows should be layered on through policy/configuration and later integrations.

## 22. Near misses

A near miss has no realised injury/damage event by definition but records potential severity and what could have happened.

It remains a separate subtype so incident-only facts do not become nullable columns on every safety event.

## 23. Safety observations

Observations can be positive or corrective and may classify unsafe/safe conditions or behaviours.

They use the shared safety-event lifecycle while keeping observation-specific category/positive-observation facts in the subtype table.

## 24. Safety actions

Safety corrective/preventive actions are separate records with:

- action text;
- responsible organisation/member;
- target date;
- status;
- completion time/member;
- verification note.

A single event can therefore have several actions owned by different people or organisations without repeating action columns.

## 25. Controlled-information evidence

Package 008 does not use a universal polymorphic `entity_type/entity_id` document-link table.

It uses explicit junctions such as:

- `site_diary_information_links`;
- `defect_information_links`;
- `ncr_information_links`;
- `safety_briefing_information_links`;
- `permit_information_links`;
- `safety_event_information_links`.

Each link targets an exact `information_container_version` so the historical evidence cannot silently move to a newer drawing/photo/certificate revision.

## 26. Derived values

The following are normally derived rather than stored as competing editable facts:

- total named diary labour hours;
- total labour-group headcount/hours;
- number of deliveries/visitors;
- inspection pass/fail counts;
- inspection completion percentage;
- open-defect count;
- overdue defect/NCR/action state from status + target date;
- current approved RAMS revision;
- permit currently-valid presentation state from lifecycle + validity window;
- briefing attendance count;
- safety-event action completion percentage.

Read models may materialise these values later if measured performance requirements justify it.

## 27. Delete/archive and immutability rules

Default behaviour:

| Record | Default behaviour |
|---|---|
| Draft diary | editable/cancellable |
| Approved/locked diary | immutable through ordinary APIs |
| Delivery/visitor evidence | retain; corrections audited |
| Published inspection template version | immutable |
| Completed inspection | retain; corrections/addenda audited |
| Closed defect/NCR | retain; reopen through state transition |
| RAMS approval event | append-only evidence |
| Held safety briefing | retain attendance/evidence |
| Issued/closed permit | retain |
| Safety event | retain; lifecycle transitions rather than hard delete |
| Completed corrective action | retain |

Foreign keys therefore use `RESTRICT` for historical/master evidence and `CASCADE` only for draft/pure dependent associations where destruction cannot erase required evidence.

## 28. Privacy and sensitive safety data

Safety incidents can contain personal and potentially sensitive information.

Requirements include:

- least-privilege access separate from ordinary project visibility;
- field-level/application policy for injury/investigation details where needed;
- retention rules appropriate to jurisdiction and contract;
- audit of access/changes where required;
- no broad exposure merely because an organisation is a project participant;
- minimisation of health/personal details to those required by the business/regulatory process.

## 29. Application invariants

The domain/application layer must enforce and integration-test at least:

1. Project/site records cannot cross unrelated projects.
2. The acting organisation is an authorised participant for the requested site operation.
3. Approved/locked diaries cannot be silently rewritten.
4. Attendance linked to a diary worker belongs to the same worker/tenant and relevant time period.
5. Published inspection-template versions and their sections/items/options are immutable.
6. Inspection responses may only use items belonging to the inspection's exact template version.
7. Response value type matches the template item's configured value type.
8. Findings converted to defects/NCRs preserve the source finding.
9. Defect/NCR responsible members belong to the stated responsible organisation/project participant.
10. Closed defects/NCRs require the configured close-out evidence/permissions.
11. RAMS approval references a version belonging to the RAMS information container and same project.
12. Briefing/permit/document links remain within the same project and respect visibility permissions.
13. Safety-event subtype exactly matches `event_kind` and exactly one subtype exists.
14. Injury/person details receive stricter policy checks than ordinary project records where configured.
15. Permit validity intervals satisfy `valid_to > valid_from`; issue/suspend/close transitions are auditable.
16. Corrective action completion requires a valid responsible/completing actor according to policy.
17. Hard deletion of submitted/approved/issued/closed evidence is prohibited through ordinary business APIs.
18. Material state transitions emit audit/outbox events transactionally where practicable.

## 30. Package tables

Package 008 contains the following principal structures.

### Reference/configuration

1. `quality_inspection_item_types`
2. `quality_finding_types`
3. `permit_types`
4. `safety_briefing_types`

### Site operations

5. `site_diaries`
6. `site_diary_weather_records`
7. `site_diary_worker_entries`
8. `site_diary_labour_groups`
9. `site_diary_plant_entries`
10. `site_diary_activities`
11. `site_diary_delays`
12. `site_diary_notes`
13. `site_diary_information_links`
14. `site_deliveries`
15. `site_delivery_items`
16. `site_diary_deliveries`
17. `site_visitor_entries`
18. `site_diary_visitors`

### Quality

19. `quality_inspection_templates`
20. `quality_inspection_template_versions`
21. `quality_inspection_template_sections`
22. `quality_inspection_template_items`
23. `quality_inspection_item_options`
24. `quality_inspections`
25. `quality_inspection_responses`
26. `quality_inspection_findings`
27. `defect_records`
28. `defect_actions`
29. `defect_information_links`
30. `nonconformance_reports`
31. `ncr_actions`
32. `ncr_information_links`
33. `ncr_defect_links`

### Health and safety

34. `rams_records`
35. `rams_approval_events`
36. `safety_briefings`
37. `safety_briefing_attendees`
38. `safety_briefing_information_links`
39. `permits_to_work`
40. `permit_authorised_persons`
41. `permit_controls`
42. `permit_information_links`
43. `safety_events`
44. `safety_incidents`
45. `safety_near_misses`
46. `safety_observations`
47. `safety_event_people`
48. `safety_actions`
49. `safety_event_information_links`

## 31. Acceptance criteria

Package 008 is acceptable when MySQL integration tests demonstrate at minimum:

- same-project and project-participant FKs reject cross-project/cross-tenant references;
- shared `project_sites` can be referenced by authorised participating organisations;
- a diary can contain many weather/labour/activity/delay records without repeating header data;
- delivery line items cannot belong to another delivery/tenant context;
- published inspection-template version content is protected by service/state policy;
- inspection responses cannot reference a template item from another template version/tenant;
- defects and NCRs retain independent lifecycle records and can be explicitly related;
- RAMS approval targets an exact controlled-information revision;
- permits/briefings/safety events retain historical evidence after closure;
- safety-event subtype invariants are covered by integration tests;
- a safety action cannot assign a member outside the stated responsible organisation;
- exact controlled-information links cannot cross unrelated projects under domain validation;
- tenant A cannot retrieve tenant B site/quality/safety records by surrogate ID alone.

## 32. Next package boundary

Package 008 deliberately stops before project commercial cost/value management.

Package 009 will build on projects, change events, procurement, labour facts and quality/site evidence to add commercial cost control such as budgets, cost codes, commitments, forecasts, valuations, variations and cost reporting without rewriting Package 008 operational history.
