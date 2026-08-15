# 07 — Authentication, Permissions and Multi-tenancy

## 1. Security model

NuBlox requires a hybrid of:

- authentication;
- tenant membership;
- RBAC for administrative/business roles;
- capability-based professional features;
- project-scoped permissions;
- record-scoped tenant policy;
- contextual policy checks.

A career is **not** a security role.

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
AND organisation permission
AND feature/capability entitlement
AND tenant/project/record scope
AND record-state/business policy
```

Within organisation permission resolution, the implemented precedence is:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

For normal in-project operations an organisation permission is necessary but insufficient. The implemented project boundary additionally requires active organisation participation and the exact organisation member to have active `project_members` scope.

For tenant-owned CRM operations the active organisation itself is the record scope: every repository read/write is bounded by the verified tenant `organisation_id` in addition to the effective CRM permission.

## 4. Controlled account provisioning

Better Auth is the authentication/session provider; it is not allowed to create a trusted NuBlox tenant actor merely because an auth identity exists.

Email sign-up remains fail-closed unless exactly one valid NuBlox provisioning intent is present:

1. an organisation invitation; or
2. a self-service organisation-bootstrap intent.

If both intent cookies are present, sign-up is rejected as ambiguous. Entering one provisioning path clears the other intent cookie.

### Invitation provisioning

Invitation tokens are random values whose SHA-256 hashes are persisted. Invitation state, intended roles, expiry, acceptance and audit evidence remain NuBlox domain concerns. New membership activation requires persisted email verification.

### Self-service organisation bootstrap

A new customer may create a first organisation through `/start` without turning Better Auth sign-up into an unrestricted public endpoint.

The server validates the organisation/account input and issues a short-lived HMAC-SHA256 signed bootstrap token in an HttpOnly cookie. A modified, expired or email-mismatched token is rejected before account creation is authorised.

The token is only a pre-sign-up authorisation envelope; there is no parallel bootstrap-intent table. After Better Auth creates the auth identity, durable bootstrap state uses the existing normalised Package 001 model:

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

The session resolver requires an **active** NuBlox `users` row, so this pending state cannot produce a trusted application actor or tenant context.

Verified email then transactionally activates the existing user, email, organisation and owner membership records. An existing active NuBlox user may create an additional organisation without creating another auth/domain identity.

## 5. Permission namespaces

Implemented platform-policy keys currently include:

- `organisation.manage`
- `member.invite`
- `member.manage`
- `project.create`
- `project.view`
- `project.manage`
- `crm.view`
- `crm.manage`

Planned domain namespaces include `document.*`, `commercial.*`, `invoice.*`, `inspection.*`, `asset.*`, `maintenance.*`, `report.*` and `admin.audit.*` permissions as their application workflows are implemented.

Permission keys are stable platform policy identifiers. Organisation roles decide which active permissions are granted to members; job/career titles do not confer permission automatically.

## 6. Organisation administration authority

Organisation administration is deliberately split rather than represented by one generic admin flag:

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

`organisation.manage` is the explicit higher administrative authority and acts as an override for the narrower administration capabilities.

### Delegation ceiling

A member administrator who does not hold `organisation.manage` may assign only roles whose active permission grants are all permissions the administrator effectively holds themselves. The same ceiling applies when role intent is attached to a pending invitation.

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

These are templates, not hard-coded assumptions about careers.

Current stable defaults are:

```text
Owner         → organisation.manage + member.invite + member.manage
                + project.create + project.view + project.manage
                + crm.view + crm.manage
Administrator → organisation.manage + member.invite + member.manage
                + project.create + project.view + project.manage
                + crm.view + crm.manage
Manager       → member.invite + member.manage
                + project.create + project.view + project.manage
                + crm.view + crm.manage
Finance/Commercial → project.view + crm.view
Member/Professional → project.view + crm.view
Field Worker        → project.view
Read Only           → project.view + crm.view
```

The project grants only establish organisation-level authority. `project.view` and `project.manage` remain ineffective for a particular project unless active member-level project scope also exists, except for the explicit invitation-response boundary described below. CRM grants remain effective only inside the active tenant's private CRM scope. The founding member receives **Owner only**.

The permission migration for existing organisations and `OrganisationBootstrapService` for future organisations deliberately apply the same CRM defaults. Integration tests verify that new tenants do not drift from migrated tenants.

## 8. Implemented CRM access model

The first CRM application boundary uses two stable permissions:

```text
crm.view   → discover and open tenant-owned CRM parties/contact relationships
crm.manage → create and maintain tenant-owned CRM parties/contact relationships
```

The effective CRM rule is:

```text
active NuBlox user
AND active organisation membership
AND effective crm.view or crm.manage as required
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

A CRM `party_organisations` record is **not** a NuBlox platform `organisations` row. A CRM `party_persons` record is **not** an authenticated `users` row or workforce identity. The same external business/person may be represented separately in several customer tenants because CRM ownership and platform identity are different concepts.

The application service enforces the Package 002 subtype invariant transactionally: a person party receives exactly one `party_persons` subtype and an organisation party exactly one `party_organisations` subtype.

### Business roles and contact methods

Business classifications such as Client, Supplier, Subcontractor, Consultant and Developer are `party_role_assignments` on one party record. They do not create duplicate masters and do not grant application permissions.

The first UI manages one primary email and one primary E.164 phone while preserving the underlying multi-contact-method schema for subsequent expansion.

### Organisation contacts

Person↔organisation business context is stored on `party_organisation_contacts`, including job title, department, primary-contact status and dated relationship evidence.

`crm.manage` can:

- create a new person directly as an organisation contact;
- link an existing active person party in the same tenant;
- nominate the primary contact;
- end a current relationship while preserving history.

Archived parties cannot acquire new contact relationships. CRM mutations append tenant-scoped audit evidence using party public IDs at the request boundary.

Opportunities, pipelines and CRM activity timelines remain separate Package 002 workflows and are not implied by `crm.view`/`crm.manage` until their application slices are implemented.

## 9. Implemented project access model

The first application project boundary uses three stable permissions:

```text
project.create → create a project owned by the active organisation
project.view   → discover/open projects where the member has explicit project scope
project.manage → project administration where scope and contextual policy permit
```

The effective normal read rule is:

```text
active NuBlox user
AND active organisation membership
AND effective project.view
AND active project_organisations participation
AND active project_members membership for the exact organisation member
```

A same-organisation employee with `project.view` but no `project_members` row does **not** inherit access from colleagues or from the organisation's participation. Portfolio queries return only projects within that exact member scope, and direct non-member project lookups are masked as not found.

Project creation requires `project.create`. The existing Platform Kernel transaction creates the project, owner participation, creator project membership and audit evidence atomically.

Lifecycle mutation requires:

```text
project.manage
AND active project participation
AND active project membership
AND active organisation is the project owning organisation
AND requested lifecycle transition is valid
```

An external participating organisation may therefore view a shared project when explicitly scoped, but cannot change the owning organisation's project lifecycle merely because one of its members has `project.manage`.

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

Only the project owning organisation may invite/re-invite, revoke/remove another participant organisation or manage organisation-level project roles. Invitations identify the target by exact NuBlox organisation `public_id`; the application does not expose an unrestricted organisation directory.

An invited organisation has no active project scope yet, so invitation response deliberately evaluates `project.manage` at **organisation level**:

```text
active NuBlox user
AND active membership in invited organisation
AND effective organisation-level project.manage
AND pending project_organisations invitation for that organisation
```

Accepting then atomically establishes:

```text
project_organisations.status = active
AND joined_at evidence
AND accepting member's project_members.status = active
```

Only after that transaction does the normal member-scoped project boundary apply. Decline is preserved explicitly as `project_organisations.status = declined`; the owner may later re-invite the organisation.

This invitation-response exception does **not** permit pre-acceptance project reads or arbitrary project mutation.

### Participant organisation boundary

Once accepted, all in-project participant/team administration requires normal scoped `project.manage`:

```text
effective project.manage
AND active project_organisations participation
AND exact actor project_members membership
```

A participant organisation may administer only its own project members. It may add active members from its own `organisation_members`, remove its own project members, update contextual member project roles, or—if it is not the owner—leave the project.

Owner removal or voluntary leave terminates every active `project_members` scope belonging to that participant while retaining historical participation/member records and audit evidence.

The service rejects removal of the final active scoped member in an organisation who effectively holds `project.manage`; another scoped project manager must exist first.

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

Project roles are **contextual metadata**. Neither `project_organisation_roles` nor `project_member_roles` grants `project.view`, `project.manage`, or any other permission. Permission authority remains in organisation roles/member overrides, while project membership supplies project scope.

## 12. Cross-organisation sharing

Every share must specify source/owning organisation, target participant, project, record/access context, expiry where applicable, and granting actor. Revocation must not delete historical evidence that a record was previously shared.

Private CRM records are not automatically shared merely because the same external business later becomes a NuBlox project participant. Any future CRM↔platform-organisation linkage must be explicit, tenant-controlled and auditable.

## 13. Tenant-isolation rules

- Server determines tenant context from authenticated membership.
- No repository method may fetch tenant-owned records by ID alone when tenant context is required.
- CRM party/contact queries must always include the active tenant `organisation_id`.
- A CRM party must never become a platform-global directory identity by inference.
- Project reads must not treat organisation participation as implicit access for all organisation members.
- Project team administration must never allow one participant organisation to add/remove members from another participant organisation.
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
- CRM cross-tenant direct-public-ID masking;
- CRM view/manage permission separation;
- CRM person/organisation subtype exclusivity;
- CRM business-role and primary contact-method persistence;
- CRM existing-person contact linking without duplicate identity;
- CRM primary-contact changes and dated relationship ending;
- archived CRM party relationship protections;
- CRM standard-role defaults for migrated and newly bootstrapped organisations;
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
- cross-organisation project-member administration denied;
- project-role assignment does not create permission authority;
- final scoped project-manager removal denied until handover;
- participant voluntary leave revokes active member scope;
- owner participant removal revokes active member scope;
- external participant owner-lifecycle mutation denied;
- invalid lifecycle transitions denied;
- direct endpoint attempts;
- object/file download attempts;
- export/report access;
- background job authorisation/context handling.

Tenant isolation, controlled provisioning, private CRM tenant scope and exact-member project scope are release gates.