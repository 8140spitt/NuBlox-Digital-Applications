# 26 — Workforce, Time and Scheduling Domain Model

## 1. Purpose

This specification defines NuBlox Schema Package 006: workforce identity, engagements, career assignment, competencies, credentials, working patterns, availability, project resourcing, scheduling, attendance and timesheets.

The domain must work for built-environment businesses ranging from sole traders and consultancy practices to contractors, facilities teams and multi-discipline organisations.

The governing rule is:

> **A login account, a CRM person and a workforce record are related concepts, not the same database entity.**

A worker may have a NuBlox login, may exist only as an internal/external workforce person, or may be linked to both a login and a tenant-owned person party. Employment/engagement facts belong to the workforce relationship, not to the global user profile.

## 2. Scope

Package 006 covers:

- workforce records;
- employee, director, subcontract, agency, consultant and other engagement types;
- organisation-specific career assignments;
- competencies and proficiency/assessment records;
- qualifications, cards, registrations and licences with expiry tracking;
- effective-dated worker cost rates for project costing;
- work calendars and recurring weekly working patterns;
- worker calendar assignments;
- unavailability/leave blocks for scheduling;
- project resource assignments;
- shifts, appointments, visits, meetings and other scheduled work;
- worker assignment to schedule events;
- attendance/actual time evidence;
- timesheet periods, entries, submission and approval;
- immutable cost snapshots when approved time becomes authoritative.

Package 006 does **not** provide:

- payroll calculation;
- PAYE/NI/tax processing;
- pension administration;
- statutory HR case management;
- recruitment/applicant tracking;
- payroll payments;
- full resource-levelling optimisation;
- offline/mobile synchronisation implementation;
- document binary storage for certificates or evidence.

## 3. Dependencies

Package 006 depends on:

- organisations and organisation members;
- teams;
- careers;
- parties/person records;
- projects and project roles;
- tenant-owned addresses;
- audit/event conventions;
- `DECIMAL`/UTC conventions already established by the schema baseline.

## 4. Normalisation target

The workforce transactional model targets **3NF by default**.

Key rules:

1. `workers` identify workforce resources; engagement terms are stored separately in `worker_engagements`.
2. A worker may hold multiple careers through `worker_careers` rather than repeated career columns.
3. Competency definitions are separate from worker competency assessments.
4. Credential definitions are separate from credentials actually held by workers.
5. Cost rates are effective-dated rows, not mutable fields on the worker.
6. Recurring weekly work patterns are separated from the worker who is assigned to a calendar.
7. Project assignment, schedule assignment, attendance and timesheet entry are different business facts and are not collapsed into one table.
8. Many-to-many relations use explicit associative tables.
9. Approved timesheet cost facts may be snapshotted because they represent an approval-time historical fact.
10. Derived values such as worked hours, utilisation and current competency validity are not maintained as independently editable balances.
11. Tenant context is carried through composite candidate/foreign keys where it materially strengthens isolation.

## 5. Identity model

```text
users
  ↓
organisation_members
  ↓ optional
workers
  ↑ optional
parties (person)
```

`workers.organisation_member_id` links a worker to an authenticated member when the person has a NuBlox account.

`workers.person_party_id` optionally links the worker to a tenant-owned person party when the organisation needs CRM/contact identity for the same person.

At least one identity link must exist. The application must prevent accidental creation of multiple active worker records for the same member/person within one organisation.

The links do **not** make CRM private notes or workforce-sensitive data interchangeable. Authorisation remains domain-specific.

## 6. Worker engagements

A worker may have successive engagements with the same organisation.

Examples:

- employee;
- director;
- subcontract worker;
- agency worker;
- consultant;
- apprentice;
- temporary worker;
- volunteer/other authorised worker where applicable.

`worker_engagements` owns relationship-specific attributes such as:

- engagement type;
- job title;
- department/team description;
- start/end date;
- status;
- optional manager worker;
- employee/contractor reference.

This means a job title is not incorrectly treated as a permanent property of a person.

## 7. Careers

`worker_careers` provide organisation-specific professional/trade classification.

This is distinct from `user_careers` in the platform profile:

- `user_careers` describes the user's general professional profile;
- `worker_careers` records how a particular tenant classifies/uses that worker.

A worker can therefore be assigned multiple careers, for example:

```text
Electrician
Solar panel installer
Heat pump engineer
```

Career assignment remains descriptive/configurational and is **not** an authorisation grant.

## 8. Competencies

`competency_types` are tenant-defined capability/competence definitions such as:

- confined space;
- working at height;
- asbestos awareness;
- first aid;
- specific plant competence;
- testing/inspection competence;
- internal authorised-person competence.

`worker_competencies` records:

- worker;
- competency type;
- proficiency/assessment level;
- assessed date;
- assessed by;
- valid from/to;
- status.

A competency may exist without a formal external certificate.

## 9. Credentials, qualifications and cards

`credential_types` defines controlled tenant credential categories including qualification, licence, registration, card, certificate and membership.

`worker_credentials` records the actual credential held by the worker, including:

- type;
- reference/registration number;
- issuing body;
- issued date;
- valid from/to;
- verification status/date;
- verifier;
- notes.

Expiry is derived from `valid_to` and current date. Do not store a separately editable `is_expired` flag.

Later document packages may link evidence files to the credential without changing the credential's relational identity.

## 10. Effective-dated worker cost rates

`worker_cost_rates` supports labour-cost reporting without becoming a payroll engine.

A worker may have multiple rates over time, for example:

```text
2026-01-01 → 2026-06-30   £24.50/hour
2026-07-01 → open ended   £26.00/hour
```

The application must prevent overlapping effective periods for the same worker/rate type/currency.

Rate types include ordinary cost, overtime cost and other controlled costing bases. These are management-cost facts, not statutory payroll calculations.

## 11. Work calendars

`work_calendars` are reusable tenant calendars such as:

- Office — 37.5 hours;
- Site — 40 hours;
- Four-day week;
- Night shift;
- Part-time pattern.

`work_calendar_weekdays` stores the recurring weekly pattern by ISO weekday and local start/end time.

`worker_calendar_assignments` effective-dates a worker's calendar assignment.

This prevents Monday–Friday hours being duplicated on every worker record.

## 12. Unavailability

`worker_unavailability` records periods where a worker should not normally be scheduled.

Examples:

- annual leave;
- sickness;
- training;
- unavailable;
- non-working day override;
- other approved absence.

The table is scheduling evidence, not payroll absence calculation.

## 13. Project resource assignments

`project_resource_assignments` represents the decision to resource a worker to a project for a period.

It can record:

- project;
- worker;
- optional project role;
- start/end date;
- planned allocation percentage;
- assignment status;
- assigning member.

This is different from a single scheduled shift or a timesheet line.

## 14. Scheduling

`schedule_events` represents planned work such as:

- appointment;
- site visit;
- shift;
- inspection;
- survey;
- maintenance visit;
- meeting;
- task/work session;
- training.

An event may optionally relate to a project and address.

`schedule_event_workers` is the many-to-many allocation of workers to events and records assignment/acceptance state.

Do not place `worker_id_1`, `worker_id_2`, etc. on the schedule event.

## 15. Attendance

`attendance_records` capture actual attendance/time evidence independently of planned schedule data.

A record may optionally reference a schedule event but must retain actual start/end facts. This enables NuBlox to compare:

```text
planned time ↔ attended time ↔ claimed/approved timesheet time
```

without overwriting one fact with another.

## 16. Timesheets

`timesheets` are worker/period approval containers.

Typical lifecycle:

```text
draft → submitted → approved
            ↓          ↓
          rejected    reopened (privileged correction)
```

`timesheet_entries` carry the actual time claim and may reference:

- project;
- schedule event;
- attendance record;
- work date;
- optional start/end timestamps;
- worked minutes;
- description;
- billable classification.

`worked_minutes` is authoritative for the entry because not all users enter start/end times. When both timestamps exist, the application validates consistency with the submitted duration according to rounding/break rules.

## 17. Approved cost snapshots

When a timesheet becomes approved, `timesheet_entry_cost_snapshots` may store the effective management cost rate and calculated cost applied to the entry.

This is intentional historical duplication because later edits to current worker cost rates must not rewrite previously approved project labour costs.

The snapshot must identify:

- source cost-rate row where available;
- currency;
- rate basis;
- rate amount;
- costed minutes;
- calculated cost amount;
- snapshot timestamp.

## 18. Derived values

The following should normally be calculated:

```text
Scheduled hours
Attendance duration
Timesheet hours
Approved labour cost
Worker utilisation
Project labour hours
Project labour cost
Credential expiry state
Competency validity state
Available capacity
```

Materialised reporting projections may be introduced later only with an ADR or explicit reporting architecture decision.

## 19. Security and privacy

Workforce data may contain commercially sensitive and personal information.

Required controls include:

- tenant-scoped access;
- separate permissions for worker identity, competency, scheduling, time approval and cost rates;
- least-privilege visibility of cost rates;
- audit for credential verification, timesheet submission/approval/reopen and cost-rate changes;
- no exposure of workforce records merely because the same person exists as a CRM party;
- project collaborators must not automatically gain access to workforce records of another organisation.

## 20. Required application invariants

The domain/application layer must enforce and test rules that simple FKs cannot fully express:

1. A worker must link to at least an organisation member or a person party.
2. `person_party_id` used for a worker must be a person subtype.
3. An organisation member/person party should not accidentally map to multiple concurrent active worker records for the same tenant.
4. Engagement date periods for the same worker must follow agreed overlap rules.
5. Worker cost-rate effective periods for the same rate type/currency must not overlap.
6. Calendar assignments must not create ambiguous overlapping active calendars unless explicitly supported by future design.
7. Project resource assignments must belong to the same owning tenant as the worker.
8. Schedule event worker assignments must belong to the event's tenant.
9. Schedule end must be later than schedule start.
10. Attendance end must not precede attendance start.
11. Submitted/approved timesheets are immutable through ordinary edit APIs.
12. Approval/rejection/reopen actions require appropriate permission and audit evidence.
13. Approved entry cost snapshots must be generated transactionally and must not silently recalculate if current cost rates later change.
14. Timesheet entries referencing project/schedule/attendance records must remain within the same tenant.
15. Project labour cost calculations use decimal arithmetic, never binary floating point.

## 21. Acceptance criteria

Package 006 is acceptable for implementation planning when:

- employees and external workers can be represented without requiring every worker to own a login;
- a worker may hold several career assignments;
- competency and credential expiry can be queried without duplicated status flags;
- effective-dated cost rates are representable;
- reusable working patterns are normalised;
- workers can be assigned to projects and scheduled events;
- actual attendance does not overwrite planned scheduling;
- timesheets can be submitted and approved with immutable approval evidence;
- approved historical cost is protected from later rate changes;
- tenant boundaries are represented in FK/candidate-key design;
- the schema remains compatible with the 3NF-first NuBlox database policy.
