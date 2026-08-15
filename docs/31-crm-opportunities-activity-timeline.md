# 31 — CRM Opportunities and Activity Timeline

## 1. Purpose

This document defines the first NuBlox application implementation of the **opportunity and CRM activity** structures already present in Database Package 002.

The slice turns a private tenant CRM party into a prospective-work workflow:

```text
CRM party
   ↓
Opportunity
   ↓
Pipeline / stage
   ↓
Opportunity participants
   ↓
Activity timeline
   ↓
Future estimate / quotation workflow
```

It does **not** introduce a second customer, sales, pipeline or activity data model.

## 2. Application scope

Implemented application surfaces:

- `/crm/opportunities`
  - tenant-scoped opportunity portfolio;
  - search by opportunity/customer text;
  - filter by opportunity outcome status;
  - create a new opportunity;
  - select primary prospective customer;
  - select pipeline/stage;
  - capture estimated value/currency;
  - capture expected close date and description.
- `/crm/opportunities/[opportunityPublicId]`
  - opportunity commercial snapshot;
  - update title/description/value/currency/expected close;
  - change pipeline stage;
  - change opportunity outcome;
  - change primary customer;
  - add/remove non-primary opportunity parties;
  - log opportunity-linked CRM activities;
  - display chronological activity timeline.

## 3. Existing Package 002 structures reused

The implementation uses:

```text
crm_pipelines
crm_pipeline_stages
opportunities
opportunity_parties
opportunity_party_role_types
crm_activities
crm_activity_types
crm_activity_parties
crm_activity_members
parties
party_persons
party_organisations
organisation_members
```

No new business tables are required for this slice.

## 4. Identity boundary

A prospective customer remains an existing tenant-private CRM party.

```text
NuBlox platform organisation ≠ CRM party organisation
NuBlox user                  ≠ CRM party person
CRM party role               ≠ NuBlox permission
Opportunity participant role ≠ NuBlox permission
```

An opportunity never copies a customer name into a competing editable customer master record. Display identity is resolved from the linked `parties` subtype.

## 5. Tenant boundary

Every opportunity/pipeline/activity repository operation carries the active `organisation_id`.

Required rule:

```text
trusted active tenant
AND record.organisation_id = trusted tenant organisation_id
```

Cross-tenant controls include:

- a party public ID from another tenant cannot become an opportunity customer;
- a pipeline from another tenant cannot be selected;
- an opportunity public ID from another tenant is masked as not found;
- activity party links are constrained to the same tenant;
- internal activity member links are constrained to the same tenant.

## 6. Permissions

Read authority:

```text
crm.view
```

Opportunity mutation authority:

```text
crm.opportunity.manage
    OR crm.manage umbrella fallback
```

Activity mutation authority:

```text
crm.activity.manage
    OR crm.manage umbrella fallback
```

The runtime calls `PermissionService.decideWithUmbrella()`.

An explicit granular member deny has precedence over umbrella fallback.

### Default-role policy

`crm.opportunity.manage` and `crm.activity.manage` are intentionally **not** auto-granted to the standard Manager, Finance/Commercial, Member/Professional, Field Worker or Read Only templates.

Reason: opportunity ownership and sales activity are separate business responsibilities from generic CRM party/contact maintenance.

Owner and Administrator retain access through `crm.manage` unless a granular decision overrides it.

Organisations can explicitly delegate the two granular permissions to their own sales, bid, business-development or commercial roles.

## 7. Pipeline model

Package 002 provides tenant-owned pipelines and stages.

The first standard configuration is:

| Stage | Sort | Probability |
|---|---:|---:|
| Lead | 10 | 10% |
| Qualified | 20 | 30% |
| Proposal | 30 | 60% |
| Negotiation | 40 | 80% |

### Stage vs outcome

These concepts must remain separate:

```text
Pipeline stage
    = current sales maturity

Opportunity status
    = business outcome
```

Valid opportunity outcomes remain:

```text
open
won
lost
cancelled
```

Won/lost/cancelled are therefore **not** duplicated as pipeline stages.

A terminal opportunity keeps the last commercial stage reached.

## 8. Pipeline provisioning

### Existing organisations

The forward migration creates a default `Sales` pipeline only where an organisation has **no `crm_pipelines` rows at all**.

Existing/custom pipeline configuration is never overwritten.

### Future organisations

An organisation created after the migration may initially have no pipeline rows.

`CrmPipelineProvisioningService.ensureDefaultPipeline()` handles first use:

1. verify active membership;
2. require opportunity-management authority;
3. start transaction;
4. lock the tenant `organisations` row `FOR UPDATE`;
5. re-check for any existing pipeline;
6. if one exists, no-op;
7. otherwise create `Sales`;
8. create Lead / Qualified / Proposal / Negotiation stages;
9. append `crm.pipeline.initialized` audit evidence;
10. commit.

The organisation-row lock makes the provisioning path idempotent under concurrent first access.

## 9. Stage request boundary

`crm_pipeline_stages` deliberately has no external `public_id`.

The application therefore transports:

```text
pipeline public_id + stage name
```

The service resolves the actual stage using:

```text
active organisation_id
AND pipeline.public_id
AND stage.crm_pipeline_id = pipeline.id
AND stage.organisation_id = pipeline.organisation_id
AND stage.name
AND active pipeline/stage state
```

Internal pipeline-stage surrogate IDs never cross the browser/request boundary.

## 10. Opportunity creation

Creation requires:

- title;
- active pipeline;
- active stage belonging to that pipeline;
- active/non-archived CRM party as primary prospective customer;
- current organisation member as opportunity owner.

Optional:

- description;
- estimated value;
- ISO 4217-style three-letter currency code;
- expected close date.

Transaction:

```text
insert opportunity
    ↓
insert primary opportunity_parties(customer)
    ↓
append crm.opportunity.created audit event
```

The primary party assignment uses the controlled global opportunity role `customer`.

## 11. Money handling

`opportunities.estimated_value` is `DECIMAL(19,4)`.

Application validation keeps monetary input as a decimal string rather than converting through JavaScript binary floating-point before persistence.

Accepted first-slice shape:

```text
non-negative decimal
maximum 15 integral digits
maximum 4 fractional digits
```

Currency remains separate from the amount.

## 12. Expected-close date

The first UI accepts `YYYY-MM-DD`.

The server validates calendar correctness and stores the date using the existing Package 002 column semantics.

The expected close date is planning information and must not be treated as an actual closing timestamp.

## 13. Outcome and `closed_at`

Rules:

```text
status = open
    → closed_at = NULL

open → won/lost/cancelled
    → closed_at = current server time

terminal → same terminal status
    → preserve existing closed_at

terminal A → terminal B
    → record new closed_at for the changed outcome

terminal → open
    → closed_at = NULL
```

The activity/audit timeline provides historical evidence of application mutations; `closed_at` represents the current terminal outcome timestamp.

## 14. Primary prospective customer

Every created opportunity has exactly one primary `opportunity_parties` assignment.

Package 002's generated uniqueness guard enforces one primary party per opportunity.

When the primary customer changes:

1. validate the replacement CRM party belongs to the tenant and is not archived;
2. ensure a `customer` opportunity-party assignment exists for the replacement;
3. demote the old primary assignment;
4. promote the replacement assignment;
5. update the opportunity;
6. append audit evidence.

The previous party remains as a non-primary opportunity participant. This preserves context without duplicating identity.

## 15. Additional opportunity participants

Controlled opportunity roles include concepts such as:

- Customer
- Contact
- Decision maker
- Consultant
- Referrer
- Influencer
- Other

The same party may hold more than one opportunity role where valid.

Duplicate `(opportunity, party, role)` assignment is rejected.

The primary assignment cannot be removed directly. A different primary customer must first be selected.

## 16. Opportunity activity timeline

Activities are stored in `crm_activities` and linked to the opportunity.

First-slice fields:

- activity type;
- subject;
- notes/body;
- direction where applicable;
- occurrence timestamp;
- external CRM party participants;
- internal acting member.

Activity types come from the controlled `crm_activity_types` catalogue, including examples such as note, phone call, email, meeting and site visit.

### External participants

External CRM party links use:

```text
crm_activity_parties
```

If the user selects no external participant, the opportunity's primary customer is linked as `regarding` when available.

Additional selected parties are stored as activity participants.

### Internal participant

The authenticated tenant member creating the activity is inserted into:

```text
crm_activity_members
participant_role = owner
```

This does not duplicate the user or worker model.

## 17. Timeline ordering

The opportunity workspace displays activity in descending chronological order:

```text
occurred_at DESC
activity.id DESC
```

The surrogate ID is a deterministic secondary order only; business chronology is `occurred_at`.

## 18. Audit evidence

Mutation audit keys introduced/used by this slice:

```text
crm.pipeline.initialized
crm.opportunity.created
crm.opportunity.updated
crm.opportunity.participant_added
crm.opportunity.participant_removed
crm.activity.created
```

Audit records include acting tenant, user/member, public subject ID and request correlation ID.

## 19. UI behavior

### Portfolio

Opportunity cards show:

- title;
- primary customer;
- status;
- pipeline/stage;
- estimated value/currency;
- expected close date.

### Workspace

The workspace separates:

1. commercial snapshot;
2. opportunity maintenance;
3. opportunity parties;
4. activity creation;
5. chronological timeline.

Read-only users with `crm.view` can inspect the workspace without mutation controls.

## 20. Search boundary

The first portfolio search covers opportunity/customer display text within the active tenant.

It is not a platform-global business directory.

Future full-text/indexing work must preserve `organisation_id` as part of the security boundary.

## 21. Deliberate exclusions

Not implemented by this slice:

- custom pipeline creation/editing/reordering;
- deleting pipelines/stages;
- standalone CRM activities not linked to an opportunity;
- recurring tasks/reminders;
- email/calendar provider synchronisation;
- lead scoring automation;
- bid/no-bid workflow;
- estimate creation;
- quotation creation/issue;
- automatic opportunity-to-estimate conversion;
- automatic won-opportunity-to-project/contract conversion.

These are not implied complete merely because the underlying schema can support later workflows.

## 22. Relationship to Package 003

The intended next commercial boundary is:

```text
Opportunity
    ↓
Estimate
    ↓
Estimate Version
    ↓
Quotation
    ↓
Quotation Version / issue
```

Package 003 remains authoritative for estimates/quotations. Opportunity data should provide source/context, not become a competing estimate ledger.

## 23. Integration tests

`crm-opportunities-activities.integration.test.ts` covers:

1. read vs opportunity-manage vs activity-manage separation;
2. tenant-owned opportunity creation with primary customer/stage;
3. cross-tenant customer/pipeline rejection and opportunity masking;
4. stage/outcome/primary-customer update behavior;
5. non-primary participant add/remove and primary protection;
6. activity timeline with party/member junction integrity.

`crm-pipeline-provisioning.integration.test.ts` covers:

- a tenant created after migrations;
- `crm.manage` umbrella compatibility;
- exact one-time Sales pipeline creation;
- exact standard stage set;
- idempotent repeated first-use call;
- exactly one pipeline-initialization audit event.

## 24. Release validation

The executable close-out has passed on MySQL 8.4.11 with:

```text
9 production migrations
344 base tables
749 foreign keys
429 CHECK constraints
0 generated Kysely type drift
12 integration files
50 real-MySQL tests
0 Svelte errors
0 Svelte warnings
```

The documentation-synchronised PR head and the eventual merged `main` commit must independently pass the same permanent validation gate before the slice is considered released.
