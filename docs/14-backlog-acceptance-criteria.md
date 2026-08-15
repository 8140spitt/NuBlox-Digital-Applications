# 14 — Backlog and Acceptance Criteria

## Epic E01 — Organisation onboarding

### US-E01-01 Create organisation

**As a** new customer  
**I want** to create an organisation  
**So that** I can configure NuBlox for my business.

Acceptance:

- authenticated user can create an organisation;
- creator becomes an authorised owner membership;
- organisation has a unique internal/public identity;
- audit event records creation;
- another tenant cannot retrieve it;
- validation errors are accessible and do not lose safe form data.

### US-E01-02 Invite member

Acceptance:

- authorised admin can invite by email;
- invitation is tenant-scoped, expiring and revocable;
- accepting creates/links membership only to intended tenant;
- invite cannot grant permissions the inviter lacks authority to grant;
- invitation lifecycle is audited.

## Epic E02 — Career and capability configuration

### US-E02-01 Assign multiple careers

Acceptance:

- member can be associated with zero or more careers;
- all 84 canonical careers are selectable;
- assigning a career does not independently bypass permission policy;
- changes are audited.

### US-E02-02 Capability-driven navigation

Acceptance:

- inaccessible modules are not shown;
- hiding navigation is not the security control;
- direct requests are independently authorised server-side;
- changing permissions is reflected on next authorised context refresh.

## Epic E03 — CRM

### US-E03-01 Create client/contact

Acceptance:

- contact can be linked to organisation;
- duplicate-warning mechanism exists or is explicitly deferred;
- record is tenant-scoped;
- authorised users can search/filter it;
- unauthorised tenant receives no record metadata.

## Epic E04 — Quote to work

### US-E04-01 Create quote

Acceptance:

- quote supports versioned line items;
- arithmetic uses fixed precision;
- totals are reproducible server-side;
- draft can be revised;
- issued version is preserved.

### US-E04-02 Accept quote

Acceptance:

- only eligible quote state can be accepted;
- acceptance actor/time recorded;
- accepted version remains immutable;
- configured flow can create/link project/job;
- repeated acceptance request is idempotent.

## Epic E05 — Projects

### US-E05-01 Create project

Acceptance:

- project belongs to organisation;
- client/site fields can be linked;
- reference uniqueness follows tenant rule;
- creator requires permission;
- audit event generated.

### US-E05-02 Invite external participant

Acceptance:

- share is scoped to project;
- recipient cannot see unrelated tenant data;
- role/access level visible to administrator;
- revocation is immediate for future access;
- share/revocation is audited.

## Epic E06 — Documents

### US-E06-01 Upload document

Acceptance:

- metadata record created in MySQL;
- binary stored in approved file/object storage;
- size/type limits enforced;
- malware workflow applied;
- checksum captured;
- unauthorised download is denied.

### US-E06-02 Add revision

Acceptance:

- previous version remains available to authorised users;
- new revision cannot silently replace payload of old version;
- current revision updates according to workflow;
- uploader/time/revision recorded;
- supersede action audited.

## Epic E07 — RFIs and project information

### US-E07-01 Raise RFI

Acceptance:

- originator, recipient, due date, question and project recorded;
- attachments/links use authorised records;
- status workflow enforced;
- response history preserved;
- notifications are not duplicated on retries.

## Epic E08 — Variations/change

### US-E08-01 Create variation

Acceptance:

- source/change reason recorded;
- cost and status stored with fixed precision;
- approval permission separate from creation permission;
- approval/rejection is auditable;
- approved value cannot be silently changed.

## Epic E09 — Invoicing

### US-E09-01 Issue invoice

Acceptance:

- authorised user can issue eligible draft;
- number assigned according to tenant sequence policy;
- issued financial snapshot preserved;
- issue action audited;
- subsequent edits require controlled correction/credit workflow.

## Epic E10 — Inspection and defects

### US-E10-01 Perform inspection

Acceptance:

- template/version recorded;
- inspector/time recorded;
- answers/evidence preserved;
- failed item can create defect/issue;
- completion cannot overwrite prior inspection history.

### US-E10-02 Close defect

Acceptance:

- authorised actor provides closure evidence;
- original issue remains visible;
- closure actor/time recorded;
- reopen workflow supported where policy allows.

## Epic E11 — Assets and work orders

### US-E11-01 Create asset

Acceptance:

- asset can link to building/space/system where applicable;
- simple jobs can omit complex hierarchy;
- identifiers can be searched;
- documents/service history can link to asset.

### US-E11-02 Complete work order

Acceptance:

- assigned/authorised worker records work and evidence;
- service record linked to asset;
- status transition validated;
- next maintenance date updated only through defined policy;
- completion audited.

## Epic E12 — Audit

### US-E12-01 View audit history

Acceptance:

- only authorised users can access audit;
- filters by date/actor/entity/action;
- audit records cannot be edited from normal product UI;
- tenant isolation applies;
- sensitive values are minimised/redacted according to policy.

## Epic E13 — Reporting/export

### US-E13-01 Export register

Acceptance:

- export contains only rows/fields user can access;
- applied filters can be reflected;
- large exports use controlled background workflow if necessary;
- export action is logged where sensitive.

## Definition of Done

A story is not done unless:

- acceptance criteria pass;
- TypeScript/lint/build pass;
- unit/integration/E2E coverage is added at the appropriate level;
- tenant/permission implications tested;
- accessibility implications tested;
- migrations are reviewed;
- logging/audit behaviour is correct;
- no secrets or sensitive test data committed;
- documentation is updated;
- code reviewed and CI passes.
