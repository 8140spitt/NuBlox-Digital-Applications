# 06 — Data Model

## 1. Data modelling principles

- Relational-first.
- **Normalise to Third Normal Form (3NF) by default.**
- Use BCNF, 4NF or 5NF where they materially improve integrity and accurately represent the domain.
- Denormalisation is an explicit optimisation, never the default modelling technique.
- Repeating groups, comma-separated lists, duplicated descriptive attributes and avoidable multi-valued columns are prohibited in the transactional model.
- Many-to-many relationships use associative tables with appropriate keys and constraints.
- Reference/master data is separated from transactional data where the concepts have independent lifecycles.
- Derived values should normally be calculated from authoritative source data unless a historical snapshot, legal/business record, performance requirement or audit requirement justifies storage.
- Every tenant-owned root record is explicitly owned by an organisation.
- Project-sharing does not erase tenant ownership.
- Historical attribution survives user/member deactivation.
- Financial values use `DECIMAL`, never binary floating point.
- Times are stored in UTC with user/organisation timezone used for display.
- Business status is explicit, not inferred from deletion.
- Material records are archived/voided/superseded rather than physically deleted where history matters.

## 2. Normalisation policy

The NuBlox transactional schema must be designed in normal form as far as is practical for a production business system.

### First Normal Form — mandatory

- Each table represents a defined entity, relationship or event.
- Each row is uniquely identifiable.
- Columns contain atomic values appropriate to the domain.
- No repeating column groups such as `phone1`, `phone2`, `phone3` where the relationship is genuinely one-to-many.
- No comma-separated IDs, roles, careers, tags, participants or similar multi-valued business relationships.

Example:

```text
users
user_emails
```

rather than:

```text
users.email_1
users.email_2
users.email_3
```

### Second Normal Form — mandatory

Non-key attributes must depend on the whole candidate key, particularly in associative/junction tables.

Example:

```text
organisation_members
--------------------
organisation_id
user_id
membership_status
joined_at
```

Organisation attributes belong in `organisations`; user attributes belong in `users`.

### Third Normal Form — default target

Non-key attributes must not depend transitively on other non-key attributes unless there is an explicit historical-snapshot requirement.

Example:

```text
projects.client_party_id
```

references the authoritative party/client record instead of duplicating the client's current name, telephone, email and address on every project.

Where a legal/commercial document must preserve what was issued at a specific moment, a controlled immutable snapshot is acceptable. For example, an issued invoice may retain the customer name/address/tax details as issued even if the master customer record later changes.

### BCNF and higher normal forms

The design should apply BCNF and higher normal forms where they resolve real dependency anomalies, particularly for:

- multi-role relationships;
- professional careers and capabilities;
- project participants;
- qualifications and competencies;
- contact methods and addresses;
- document classifications;
- assets and asset relationships;
- product/catalogue attributes;
- configurable workflow/template relationships.

Do not pursue theoretical decomposition that makes ordinary transactions unnecessarily complex without improving integrity, maintainability or correctness.

### Associative entities

Many-to-many relationships must normally use explicit associative tables.

Examples:

```text
user_careers
career_capabilities
team_members
project_participants
role_permissions
member_roles
rfq_recipients
```

Associative tables may contain attributes that belong to the relationship itself, for example:

```text
project_participants
--------------------
project_id
organisation_id
user_id
project_role_id
access_level
start_date
end_date
```

### Controlled duplication and snapshots

Duplication is acceptable only when it has a defined semantic purpose, such as:

- immutable issued quotations;
- issued invoices and credit documents;
- submitted tenders;
- approved valuations;
- signed/approved contract records;
- document revisions;
- audit/change history;
- point-in-time regulatory or certification evidence.

In these cases the duplicated data represents a **historical fact**, not an uncontrolled cache of master data.

### Denormalisation exception process

Any deliberate denormalisation of the transactional schema must be documented in an Architecture Decision Record (ADR) identifying:

1. the normalised source model;
2. the measured problem being solved;
3. the denormalised field/table/materialised representation;
4. how consistency is maintained;
5. failure/rebuild behaviour;
6. test coverage;
7. rollback/removal strategy.

Performance must first be addressed through appropriate schema design, indexes, query design, pagination, caching and reporting/read models before weakening transactional normalisation.

### JSON usage

JSON columns must not be used to bypass relational modelling for stable business concepts.

Acceptable examples include:

- provider-specific integration metadata;
- controlled extension payloads;
- immutable event/change summaries;
- genuinely variable template response data where querying requirements are understood.

If a JSON property becomes business-critical, relationally constrained, frequently filtered/joined, permission-sensitive or required for reporting, it should normally be promoted into the relational schema.

## 3. Core identity/tenant model

```mermaid
erDiagram
    USERS ||--o{ ORGANISATION_MEMBERS : belongs
    ORGANISATIONS ||--o{ ORGANISATION_MEMBERS : has
    USERS ||--o{ USER_CAREERS : has
    CAREERS ||--o{ USER_CAREERS : classifies
    CAREERS ||--o{ CAREER_CAPABILITIES : defaults
    CAPABILITIES ||--o{ CAREER_CAPABILITIES : includes
    ORGANISATIONS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ PROJECT_PARTICIPANTS : has
```

## 4. Core tables

### Identity and tenancy

- `users`
- `user_emails`
- `sessions`
- `organisations`
- `organisation_members`
- `teams`
- `team_members`
- `organisation_locations`

### Career/capability

- `professional_domains`
- `careers`
- `career_aliases`
- `capabilities`
- `career_capabilities`
- `user_careers`
- `permission_roles`
- `role_permissions`
- `member_roles`

### CRM

- `parties` or separate `contacts`/`companies` after discovery
- `party_addresses`
- `party_relationships`
- `opportunities`
- `activities`

### Sales/contracts/finance

- `quotes`
- `quote_versions`
- `quote_items`
- `contracts`
- `contract_key_dates`
- `invoices`
- `invoice_items`
- `payments`
- `expenses`

### Procurement

- `suppliers`
- `rfqs`
- `rfq_recipients`
- `supplier_returns`
- `purchase_orders`
- `purchase_order_items`
- `receipts`

### Workforce

- `workers`
- `worker_competencies`
- `competency_types`
- `timesheets`
- `timesheet_entries`

### Projects

- `projects`
- `project_sites`
- `project_participants`
- `project_roles`
- `project_stages`
- `tasks`
- `milestones`

### Built environment hierarchy

- `buildings`
- `levels`
- `spaces`
- `systems`
- `assets`
- `asset_components`

The hierarchy must be optional for small jobs.

### Documents/information

- `documents`
- `document_versions`
- `document_links`
- `transmittals`
- `rfis`
- `rfi_responses`
- `instructions`
- `submittals`
- `change_events`
- `variations`

### Site/quality/safety

- `site_diaries`
- `site_diary_entries`
- `photos`
- `deliveries`
- `plant_usage`
- `inspection_templates`
- `inspections`
- `inspection_items`
- `issues`
- `defects`
- `ncrs`
- `safety_records`
- `incidents`
- `briefings`

### Asset/FM

- `maintenance_plans`
- `work_orders`
- `service_records`
- `warranties`
- `commissioning_records`

### Platform

- `audit_events`
- `notifications`
- `outbox_events`
- `background_jobs` or provider-backed equivalent
- `integration_connections`
- `webhook_deliveries`

## 5. Tenant-key pattern

Most tenant tables require:

```sql
organisation_id BIGINT UNSIGNED NOT NULL
```

and common indexes should begin with tenant/context when queries are tenant-scoped:

```sql
INDEX idx_projects_org_status (organisation_id, status)
```

A unique business reference usually needs tenant scope:

```sql
UNIQUE KEY uq_project_reference (organisation_id, reference)
```

## 6. Public and internal identifiers

Final ID strategy is an open architecture decision.

Requirements:

- public URLs must use opaque, non-guessable identifiers where enumeration would be sensitive;
- internal keys must index efficiently in MySQL;
- integrations require stable identifiers;
- IDs must not change during data migration.

A valid approach is an internal `BIGINT UNSIGNED` primary key plus a unique public UUID/ULID-style identifier. A UUIDv7-style binary key is another option if the selected MySQL access layer handles it cleanly.

## 7. Money

Use fixed precision, e.g.:

```sql
DECIMAL(19,4)
```

for stored monetary amounts/rates unless finance discovery establishes another standard.

Store:

- transaction currency;
- net;
- tax;
- gross;
- rounding basis where relevant.

Never derive historic issued-document totals from mutable product/rate tables.

## 8. Time and dates

Use:

- UTC timestamp/datetime for events;
- local date where the business concept is a date rather than an instant;
- timezone identifier at user/organisation/project level where necessary.

Do not store only formatted local strings.

## 9. Soft deletion and archival

Do not apply generic soft-delete indiscriminately.

Recommended:

- master/reference data: deactivate/archive;
- draft records: delete may be permitted with audit;
- issued/approved/contractual records: void/supersede/cancel with history;
- security/audit records: retention-controlled and not normal user-deletable.

## 10. Document model

```text
documents
  id
  organisation_id
  project_id?
  document_number?
  title
  classification
  current_version_id
  status

document_versions
  id
  document_id
  revision
  status
  storage_key
  checksum
  content_type
  size_bytes
  uploaded_by_user_id
  created_at
```

Never overwrite the payload of an existing document version.

## 11. Generic linking

Cross-domain records often need links.

Use a controlled relation/link table only where beneficial, e.g. linking a document to an asset, RFI or variation. Avoid making the entire business schema an entity-attribute-value model.

## 12. Audit model

Suggested fields:

```text
id
occurred_at
organisation_id
actor_user_id
actor_member_id
action
entity_type
entity_id
project_id
correlation_id
ip/context metadata (appropriately protected)
change_summary JSON
```

Audit data must not become a second uncontrolled store of sensitive full-record snapshots.

## 13. Referential integrity

Use foreign keys for strong ownership/referential rules where operationally practical.

Also enforce invariants in domain/application services, for example:

- project participant organisation must be valid;
- invoice project must belong/be visible to invoice organisation;
- document version cannot belong to a different tenant from document;
- a user cannot grant permissions they do not have authority to grant.

## 14. Migration requirements

- schema migrations are version controlled;
- production migrations are repeatable and reviewed;
- destructive changes require migration/backfill plans;
- large backfills must not require long blocking transactions;
- every release records schema version.
