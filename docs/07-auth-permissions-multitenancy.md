# 07 — Authentication, Permissions and Multi-tenancy

## 1. Security model

NuBlox uses a hybrid of:

- authentication;
- tenant membership;
- RBAC for administrative/business roles;
- capability-based professional features;
- project-scoped permissions;
- record-scoped tenant policy;
- contextual policy checks.

A career is **not** a security role. Job titles may inform role design, but they never confer authority automatically.

## 2. Identity model

```text
User
 ├─ Organisation Membership A
 │    ├─ organisation roles
 │    ├─ granted capabilities
 │    ├─ private CRM records owned by Organisation A
 │    └─ project memberships
 └─ Organisation Membership B
      ├─ different roles
      ├─ different private CRM records
      └─ different project access
```

The same person may have different rights in different organisations. A CRM representation of a real-world person or business is not the same security identity as a NuBlox user or platform organisation.

## 3. Effective authorisation

Conceptually:

```text
authenticated user
AND active organisation membership
AND effective organisation permission
AND feature/capability entitlement where applicable
AND tenant/project/record scope
AND record-state/business policy
```

Within one permission key, organisation permission precedence is:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

### Granular permissions and umbrella permissions

Some management areas expose both a broad umbrella permission and narrower delegation permissions. The current umbrella pairs are:

```text
project.manage
    ├─ project.lifecycle.manage
    ├─ project.participant.manage
    ├─ project.team.manage
    └─ project.participation.manage

crm.manage
    ├─ crm.party.manage
    └─ crm.contact.manage
```

For an operation governed by a granular key, NuBlox resolves the granular key first. It falls back to the umbrella only when the granular key has **no explicit member or active-role decision**.

Therefore:

```text
granular member deny
    > granular member allow / granular role grant
    > umbrella permission fallback
    > default deny
```

An explicit granular member deny cannot be bypassed by `project.manage` or `crm.manage`. This preserves compatibility for broad legacy/custom roles while allowing precise delegation and exceptions.

For normal in-project operations, organisation permission is necessary but insufficient. The project boundary additionally requires active organisation participation and active `project_members` scope for the exact organisation member.

For tenant-owned CRM operations, the active organisation is the record scope: repository reads/writes are bounded by the verified tenant `organisation_id` in addition to the effective CRM permission.

## 4. Controlled account provisioning

Better Auth is the authentication/session provider; an authentication identity alone does not become a trusted NuBlox tenant actor.

Email sign-up remains fail-closed unless exactly one valid NuBlox provisioning intent exists:

1. an organisation invitation; or
2. a self-service organisation-bootstrap intent.

If both intent cookies are present, sign-up is rejected as ambiguous. Entering one provisioning path clears the other intent cookie.

### Invitation provisioning

Invitation tokens are random values whose SHA-256 hashes are persisted. Invitation state, intended roles, expiry, acceptance and audit evidence remain NuBlox domain concerns. New membership activation requires persisted email verification.

### Self-service organisation bootstrap

A new customer may create a first organisation through `/start` without turning Better Auth sign-up into an unrestricted public endpoint.

The server validates organisation/account input and issues a short-lived HMAC-SHA256 signed bootstrap token in an HttpOnly cookie. A modified, expired or email-mismatched token is rejected before account creation is authorised.

Durable pre-verification state uses the existing normalised model:

```text
users.status                 = pending
user_emails.is_verified      = false
auth_user_links              = created
organisations.status         = pending
organisation_members.status  = invited
organisation_roles           = standard role templates
member_roles                 = Owner assignment
audit_events                 = bootstrap pending evidence
```

The session resolver requires an **active** NuBlox `users` row, so pending state cannot produce a trusted application actor or tenant context.

Verified email transactionally activates the user, email, organisation and owner membership. An existing active NuBlox user may create another organisation without duplicating auth/domain identity.

## 5. Implemented permission catalogue

### Organisation and member administration

- `organisation.manage`
- `member.invite`
- `member.manage`

### Projects

- `project.create`
- `project.view`
- `project.manage` — broad project-management umbrella
- `project.lifecycle.manage`
- `project.participant.manage`
- `project.team.manage`
- `project.participation.manage`

### CRM

- `crm.view`
- `crm.manage` — broad CRM-management umbrella
- `crm.party.manage`
- `crm.contact.manage`

Planned domain namespaces include `document.*`, `commercial.*`, `invoice.*`, `inspection.*`, `asset.*`, `maintenance.*`, `report.*` and `admin.audit.*` as their workflows are implemented.

Permission keys are stable platform-policy identifiers. Organisation roles decide which active permissions members receive; careers/job titles do not grant permission automatically.

## 6. Organisation administration authority

Organisation administration is deliberately split:

```text
member.invite
    → create / resend / revoke invitations

member.manage
    → member lifecycle
    → member-to-role assignments

organisation.manage
    → organisation-role definitions
    → role-to-permission grants
    → full organisation-administration authority
```

`organisation.manage` is the explicit higher administrative authority for organisation administration.

### Delegation ceiling

A member administrator who does not hold `organisation.manage` may assign only roles whose active permission grants are all permissions the administrator effectively holds. The same ceiling applies when role intent is attached to a pending invitation.

### Manager protection and lockout prevention

Administrative mutations enforce:

- no self membership-status change through organisation administration;
- no self role-assignment mutation through that workspace;
- lower-level administrators cannot alter an effective organisation manager;
- only an organisation manager may administer another organisation manager;
- role/member changes cannot remove the final active `organisation.manage` authority;
- cross-tenant and inactive roles are rejected;
- request boundaries use public IDs;
- state changes append audit evidence.

## 7. Standard organisation roles

Each newly bootstrapped organisation receives:

- Owner
- Administrator
- Manager
- Finance/Commercial
- Member/Professional
- Field Worker
- Read Only

These are templates, not careers.

### Owner

```text
organisation.manage
member.invite
member.manage
project.create
project.view
project.manage
project.lifecycle.manage
project.participant.manage
project.team.manage
project.participation.manage
crm.view
crm.manage
crm.party.manage
crm.contact.manage
```

### Administrator

Administrator receives the same permission catalogue as Owner, without ownership semantics.

### Manager

Manager receives operationally broad but deliberately **granular** management authority:

```text
member.invite
member.manage
project.create
project.view
project.lifecycle.manage
project.participant.manage
project.team.manage
project.participation.manage
crm.view
crm.party.manage
crm.contact.manage
```

Manager does not receive the `project.manage` or `crm.manage` umbrella grants. This means new permission families can be added beneath those umbrellas without silently expanding the standard Manager role.

### Other standard roles

```text
Finance/Commercial  → project.view + crm.view
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

The founding member receives **Owner only**.

The forward permission migration updates existing standard roles and `OrganisationBootstrapService` seeds the same defaults for future organisations. Integration tests guard against migrated/bootstrap role drift.

Custom organisation roles remain supported. Existing custom roles that hold `project.manage` or `crm.manage` continue to exercise the currently implemented granular operations through umbrella fallback unless a granular member exception overrides them.

## 8. Implemented CRM access model

CRM authority is divided into read, party/master-data management and contact-relationship management:

```text
crm.view
    → discover/open tenant-owned CRM parties and relationships

crm.party.manage
    → create/update/archive parties
    → maintain person/organisation subtype data
    → maintain business-role classifications
    → maintain primary email/phone contact methods

crm.contact.manage
    → create a person as part of an organisation-contact workflow
    → link an existing tenant CRM person to an organisation
    → nominate/change the primary organisation contact
    → end a current contact relationship while preserving history

crm.manage
    → umbrella fallback for crm.party.manage and crm.contact.manage
```

The effective CRM rule is:

```text
active NuBlox user
AND active organisation membership
AND effective CRM permission
AND CRM record organisation_id = active tenant organisation_id
AND record-state policy
```

### Private party identity

Package 002 CRM identity is tenant-private:

```text
parties
├─ party_persons
└─ party_organisations
```

Each `parties` row belongs to one NuBlox tenant through `organisation_id`. A direct public ID from another tenant is masked as not found even when the actor has `crm.view` in their own organisation.

A CRM `party_organisations` row is **not** a NuBlox platform `organisations` row. A CRM `party_persons` row is **not** an authenticated `users` row or workforce identity. The same external business/person may be represented independently by several customer tenants.

The application enforces subtype exclusivity transactionally: a person party receives exactly one `party_persons` subtype and an organisation party exactly one `party_organisations` subtype.

### Business roles and contact methods

Business classifications such as Client, Supplier, Subcontractor, Consultant and Developer are `party_role_assignments` on one party record. They do not duplicate identity and do not grant application permission.

The current UI manages one primary email and one primary E.164 phone while retaining the normalised multi-contact-method schema for later expansion.

### Organisation contacts

Person↔organisation business context is stored on `party_organisation_contacts`, including job title, department, primary-contact status and dated relationship evidence.

Archived parties cannot acquire new contact relationships. CRM mutations append tenant-scoped audit evidence using public IDs at the request boundary.

Opportunities, pipelines and CRM activity timelines remain separate Package 002 workflows; the existing CRM permissions do not imply those future authorities automatically.

## 9. Implemented project access model

Project authority is divided into creation, viewing, lifecycle management, participant administration, team administration and participation response:

```text
project.create
    → create a project owned by the active organisation

project.view
    → discover/open projects where the exact member has active project scope

project.lifecycle.manage
    → change owner project lifecycle state

project.participant.manage
    → invite/re-invite/remove participant organisations
    → maintain organisation-level contextual project roles

project.team.manage
    → add/remove the active organisation's project members
    → maintain member contextual project roles

project.participation.manage
    → accept/decline an organisation project invitation
    → leave participation when the organisation is not the project owner

project.manage
    → umbrella fallback for the four granular project-management permissions
```

The effective normal read rule is:

```text
active NuBlox user
AND active organisation membership
AND effective project.view
AND active project_organisations participation
AND active project_members membership for the exact organisation member
```

A same-organisation employee with `project.view` but no `project_members` row does **not** inherit access from colleagues or from organisation participation. Portfolio discovery and direct project lookups remain exact-member scoped.

Project creation requires `project.create`. The Platform Kernel transaction creates the project, owner participation, creator project membership and audit evidence atomically.

### Lifecycle mutation

Lifecycle mutation requires:

```text
effective project.lifecycle.manage
    OR project.manage umbrella fallback
AND active project participation
AND active exact-member project membership
AND active organisation is the project owning organisation
AND requested lifecycle transition is valid
```

An external participant cannot mutate owner lifecycle state simply because it holds project management permission.

## 10. Implemented project participant and team administration

Project collaboration reuses the Package 001 structures:

```text
projects
  ├─ project_organisations
  │    └─ project_organisation_roles
  └─ project_members
       └─ project_member_roles
```

### Organisation invitation boundary

Only the project owning organisation may invite/re-invite or remove participant organisations and maintain organisation-level contextual project roles. These writes require `project.participant.manage` or umbrella fallback and normal project scope for the owner actor.

Invitations identify targets by exact NuBlox organisation `public_id`; the application does not expose an unrestricted organisation directory.

### Invitation response boundary

An invited organisation has no active project-member scope yet. Invitation response therefore evaluates `project.participation.manage` (or `project.manage` umbrella fallback) at **organisation level** against the exact pending invitation:

```text
active NuBlox user
AND active membership in invited organisation
AND effective organisation-level project.participation.manage
    OR project.manage umbrella fallback
AND pending project_organisations invitation for that organisation
```

Acceptance atomically establishes:

```text
project_organisations.status = active
AND joined_at evidence
AND accepting member project_members.status = active
```

Decline is preserved explicitly as `project_organisations.status = declined`; the owner may later re-invite the organisation.

This invitation-response exception does **not** permit pre-acceptance project reads or arbitrary project mutation.

### Participant organisation boundary

Once accepted:

- participant-organisation administration uses `project.participant.manage` and is restricted to the owning organisation;
- each participating organisation manages only its own project members using `project.team.manage`;
- a non-owner participant may voluntarily leave using `project.participation.manage`.

All in-project operations continue to require active participant and exact-member scope in addition to the effective permission.

Owner removal or voluntary leave terminates every active `project_members` scope belonging to that participant while preserving historical participation/member records and audit evidence.

The service rejects removal of the final active scoped member in an organisation who effectively holds `project.team.manage` (including `project.manage` umbrella fallback); another scoped project-team manager must exist first.

## 11. Project roles

The controlled project-role catalogue includes:

- Client
- Project administrator
- Project manager
- Designer
- Engineer
- Quantity surveyor/commercial
- Main contractor
- Subcontractor
- Supplier
- Inspector
- Facilities/operations
- Read-only participant

Project roles are **contextual metadata**. Neither `project_organisation_roles` nor `project_member_roles` grants application permission. Authority remains in organisation roles/member overrides, while project membership supplies project scope.

## 12. Cross-organisation sharing

Every share must specify source/owning organisation, target participant, project, record/access context, expiry where applicable, and granting actor. Revocation must not delete historical evidence that a record was previously shared.

Private CRM records are not automatically shared merely because the same external business later becomes a NuBlox project participant. Any future CRM↔platform-organisation linkage must be explicit, tenant-controlled and auditable.

## 13. Tenant-isolation rules

- Server determines tenant context from authenticated membership.
- No repository method may fetch tenant-owned records by ID alone when tenant context is required.
- CRM party/contact queries include the active tenant `organisation_id`.
- A CRM party must never become a platform-global directory identity by inference.
- Project reads must not treat organisation participation as implicit access for all organisation members.
- Project team administration must never allow one participant organisation to add/remove another participant's members.
- Invitation response must match the selected active organisation to the exact pending `project_organisations` row.
- Background jobs include tenant context explicitly.
- Search indexes, caches and exports preserve tenancy boundaries.
- Object-storage authorisation must not become a tenancy bypass.
- Platform support access requires a privileged, auditable workflow.

## 14. Session requirements

- secure, HttpOnly cookies where cookie sessions are used;
- Secure flag in production;
- appropriate SameSite policy;
- session rotation after privilege/authentication changes;
- logout/revocation;
- idle/absolute expiry policy;
- MFA step-up for high-risk actions where required by security design.

## 15. Permission, scope and provisioning testing

Automated tests must include:

- same-tenant allowed access and denied role;
- different-tenant denial;
- granular member deny overriding umbrella permission;
- umbrella compatibility where no granular decision exists;
- migrated and newly bootstrapped standard-role parity;
- CRM cross-tenant direct-public-ID masking;
- CRM read vs party-management vs contact-management separation;
- CRM person/organisation subtype exclusivity;
- CRM business-role and primary contact-method persistence;
- CRM existing-person contact linking without duplicate identity;
- CRM primary-contact changes and dated relationship ending;
- archived CRM party relationship protections;
- administrative delegation-ceiling enforcement;
- organisation-manager protection and final-manager lockout prevention;
- sign-up without provisioning intent denied;
- invitation/bootstrap intent ambiguity denied;
- bootstrap token tampering and email mismatch denied;
- pending bootstrap identities denied trusted actor access;
- verified bootstrap activation;
- organisation project permission without project membership denied;
- member-scoped project discovery after explicit membership;
- project invitation invisible as a project before acceptance;
- project invitation decline and controlled re-invite;
- invitation acceptance atomically establishes first member scope;
- external participant project view after explicit scope;
- project lifecycle / participant / team / participation authority separation;
- cross-organisation project-member administration denied;
- project-role assignment does not create permission authority;
- final scoped project-team-manager removal denied until handover;
- participant voluntary leave revokes active member scope;
- owner participant removal revokes active member scope;
- external participant owner-lifecycle mutation denied;
- invalid lifecycle transitions denied;
- direct endpoint attempts;
- object/file download attempts;
- export/report access;
- background job authorisation/context handling.
