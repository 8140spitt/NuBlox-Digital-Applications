# 07 — Authentication, Permissions and Multi-tenancy

## 1. Security model

NuBlox requires a hybrid of:

- authentication;
- tenant membership;
- RBAC for administrative/business roles;
- capability-based professional features;
- project-scoped permissions;
- contextual policy checks.

A career is **not** a security role.

## 2. Identity model

```text
User
 ├─ Organisation Membership A
 │    ├─ organisation roles
 │    ├─ granted capabilities
 │    └─ project memberships
 └─ Organisation Membership B
      ├─ different roles
      └─ different project access
```

The same person may have different rights in different organisations.

## 3. Effective authorisation

Conceptually:

```text
authenticated user
AND active organisation membership
AND organisation permission
AND feature/capability entitlement
AND project/record scope
AND record-state/business policy
```

Within organisation permission resolution, the implemented precedence is:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

For project-scoped operations an organisation permission is necessary but insufficient. The implemented project boundary additionally requires active organisation participation and the exact organisation member to have active `project_members` scope.

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
Administrator → organisation.manage + member.invite + member.manage
                + project.create + project.view + project.manage
Manager       → member.invite + member.manage
                + project.create + project.view + project.manage
Finance/Commercial → project.view
Member/Professional → project.view
Field Worker        → project.view
Read Only           → project.view
```

The project grants only establish organisation-level authority. `project.view` and `project.manage` remain ineffective for a particular project unless active member-level project scope also exists. The founding member receives **Owner only**.

## 8. Implemented project access model

The first application project boundary uses three stable permissions:

```text
project.create → create a project owned by the active organisation
project.view   → discover/open projects where the member has explicit project scope
project.manage → lifecycle administration where member scope and ownership policy permit
```

The effective read rule is:

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

Project participant-administration writes are intentionally not part of the first project workspace slice and require a separate permission-controlled workflow.

## 9. Project roles

Project roles may include:

- Client
- Project administrator
- Designer
- Engineer
- Quantity surveyor/commercial
- Main contractor
- Subcontractor
- Supplier
- Inspector
- Facilities/operations
- Read-only participant

Project roles control project context and visibility; they do not replace organisation permissions or active project-member scope.

## 10. Cross-organisation sharing

Every share must specify source/owning organisation, target participant, project, record/access context, expiry where applicable, and granting actor. Revocation must not delete historical evidence that a record was previously shared.

## 11. Tenant-isolation rules

- Server determines tenant context from authenticated membership.
- No repository method may fetch tenant-owned records by ID alone when tenant context is required.
- Project reads must not treat organisation participation as implicit access for all organisation members.
- Background jobs include tenant context explicitly.
- Search indexes, caches and exports preserve tenancy boundaries.
- Object-storage authorisation must not become a tenancy bypass.
- Platform support access requires a privileged, auditable workflow.

## 12. Session requirements

- secure, HttpOnly cookies where cookie sessions are used;
- Secure flag in production;
- appropriate SameSite policy;
- session rotation after privilege/authentication changes;
- logout/revocation;
- idle/absolute expiry policy;
- MFA step-up for high-risk actions where required by security design.

## 13. Permission, project-scope and provisioning testing

Automated tests must include:

- same-tenant allowed access and denied role;
- different-tenant denial;
- administrative delegation-ceiling enforcement;
- organisation-manager protection and final-manager lockout prevention;
- sign-up without provisioning intent denied;
- invitation/bootstrap intent ambiguity denied;
- bootstrap token tampering and email mismatch denied;
- pending bootstrap identities denied trusted actor access;
- verified bootstrap activation;
- organisation project permission without project membership denied;
- member-scoped project discovery after explicit membership;
- external participant project view after explicit scope;
- external participant owner-lifecycle mutation denied;
- invalid lifecycle transitions denied;
- direct endpoint attempts;
- object/file download attempts;
- export/report access;
- background job authorisation/context handling.

Tenant isolation, controlled provisioning and member-level project scope are release gates.
