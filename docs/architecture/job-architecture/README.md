# NuBlox Functional Role & Job Architecture

**Status:** Architecture working baseline  
**Purpose:** translate the enterprise function taxonomy into reusable functional roles and canonical job profiles without conflating careers, access-control roles or organisation-specific positions.

## 1. Governing distinction

NuBlox must keep these concepts separate:

```text
Enterprise Function -> Functional Role -> Job Profile -> Organisation Position -> Person
                                  |              |
                                  |              +-> Career mapping
                                  +-> Capability mapping

Organisation Access Role -> Permission grants
```

- **Enterprise function** — what work an enterprise performs.
- **Functional role** — a coherent bundle of work/accountability performed by a person, team or position.
- **Job profile** — a canonical employable job that composes one or more functional roles at a defined level.
- **Organisation position** — a tenant-specific instance of a job profile in an organisation structure.
- **Career** — the person's professional classification; it may map to several job profiles and must not be used as an access-control rule.
- **Organisation access role** — permission-bearing security construct such as Owner, Administrator or Read Only.

Therefore:

**Enterprise Function != Functional Role != Job Profile != Career != Access Role != Position**

## 2. Source taxonomy

The canonical source remains `../taxonomy/`:

- 29 enterprise functions;
- 353 sub-functions;
- 1,510 source activities;
- L1 Function -> L2 Sub-function -> L3 Activity.

The enterprise taxonomy is not modified by this layer. Functional roles and job profiles reference it.

## 3. Functional-role baseline

The first mechanical baseline treats each L2 sub-function as a candidate functional role because an L2 already represents a coherent area of enterprise work.

Example:

```text
F09 Procurement & Supplier Management
  F09.04 Sourcing
        -> FR-F09.04 Strategic Sourcing
  F09.05 Supplier negotiation
        -> FR-F09.05 Supplier Negotiation
  F09.10 Supplier performance
        -> FR-F09.10 Supplier Performance Management
```

The activity list under the source sub-function becomes the initial responsibility/accountability evidence for the role.

This is deliberately a **candidate baseline**, not an assertion that every L2 must remain a standalone role forever. Governance may merge adjacent L2s into a broader role or split a role when the operating model requires it.

## 4. Job-profile baseline

A job profile composes functional roles rather than duplicating the enterprise taxonomy.

Example:

```text
JP-PROC-STRATEGIC-SOURCING-MANAGER
  title: Strategic Sourcing Manager
  primary roles:
    - FR-F09.04 Strategic Sourcing
    - FR-F09.05 Supplier Negotiation
  secondary roles:
    - FR-F09.02 Category Management
    - FR-F09.06 Procurement Contracting
    - FR-F09.10 Supplier Performance Management
```

A job profile contains:

- stable ID and canonical title;
- job family;
- level;
- purpose;
- primary and secondary functional roles;
- key accountabilities;
- expected outputs/deliverables;
- knowledge and technical skills;
- behavioural competencies;
- qualifications/certifications where relevant;
- experience expectations;
- performance measures;
- alternative titles;
- enterprise-taxonomy mappings.

## 5. Position model

Organisation-specific positions should eventually be implemented separately from canonical job profiles:

```text
organisation_positions
  id
  organisation_id
  job_profile_id
  title_override
  team_id
  reports_to_position_id
  location_id
  grade_id
  cost_centre_id
  fte
  valid_from
  valid_to

position_assignments
  position_id
  organisation_member_id
  start_date
  end_date
```

This allows two organisations to use the same canonical job profile while retaining different titles, reporting structures, grades and employment arrangements.

## 6. Generated baseline

`scripts/generate-job-architecture.mjs` reads all four canonical taxonomy shards and deterministically generates:

- `functional-roles.generated.json` — one candidate functional role per L2 sub-function, preserving all source activities and stable mappings;
- `job-profiles.generated.json` — a candidate specialist profile for each functional role plus one function-lead profile per L1 function;
- `coverage.generated.json` — coverage controls proving every source function/sub-function/activity is represented.

The generator intentionally marks generated profiles as `candidate`. They are architecture seed data for curation, not a claim that a machine-generated job title is automatically the preferred market title.

## 7. Governance rules

1. Existing enterprise taxonomy IDs remain canonical and immutable unless the taxonomy itself is governed through a separate change.
2. Functional roles reference source IDs; they do not copy or redefine enterprise-function identity.
3. Job profiles compose roles; they do not become permissions.
4. Careers may map to job profiles but are not synonymous with them.
5. Organisation positions may override display title and local employment metadata but do not rewrite the canonical profile.
6. Generated `candidate` content must be curated before promotion to `approved`.
7. Mapping changes must be explicit and reviewable; do not infer mappings merely to fill a matrix.

## 8. Identifier convention

```text
FR-F09.04                       functional role derived from source sub-function F09.04
JP-F09.04-PROFESSIONAL          generated specialist job profile
JP-F09-FUNCTION-LEAD            generated function-lead job profile
JF-F09                          generated job family aligned to source function
```

Curated market-facing job profiles may subsequently receive semantic IDs such as:

```text
JP-PROC-STRATEGIC-SOURCING-MANAGER
JP-TECH-ENTERPRISE-ARCHITECT
JP-PPM-PROJECT-MANAGER
```

Stable source mappings remain attached regardless of display title.

## 9. Planned persistence

The eventual relational model should introduce separate entities for:

- `functional_roles`;
- `functional_role_subfunctions`;
- `functional_role_activities`;
- `job_families`;
- `job_profiles`;
- `job_profile_roles`;
- `job_accountabilities`;
- `job_competencies`;
- `job_qualifications`;
- `job_performance_measures`;
- `job_title_aliases`;
- `job_profile_careers`;
- `organisation_positions`;
- `position_assignments`.

Database implementation should be a separate schema package/ADR after this architecture baseline is reviewed.