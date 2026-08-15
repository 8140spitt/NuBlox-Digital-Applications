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

Example: a Quantity Surveyor may have `commercial.variation.approve` in Organisation A but read-only access on a specific project.

Within organisation permission resolution, the implemented precedence is:

```text
explicit member deny
    > explicit member allow
    > active organisation-role grant
    > default deny
```

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

The server validates the organisation/account input and issues a short-lived HMAC-SHA256 signed bootstrap token in an HttpOnly cookie. The signed payload includes the account email, organisation settings, expiry and nonce. A modified, expired or email-mismatched token is rejected before account creation is authorised.

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

The session resolver requires an **active** NuBlox `users` row, so this pending state cannot produce a trusted application actor or trusted tenant context.

Verified email then transactionally changes the existing records to:

```text
users.status                 = active
user_emails.is_verified      = true
organisations.status         = active
organisation_members.status  = active
```

The membership receives `joined_at`, and activation appends audit evidence. An existing active NuBlox user may create an additional organisation without creating another auth/domain identity.

## 5. Permission namespaces

Examples:

- `organisation.manage`
- `member.invite`
- `member.manage`
- `project.create`
- `project.view`
- `project.manage`
- `document.create`
- `document.issue`
- `commercial.view`
- `commercial.variation.create`
- `commercial.variation.approve`
- `invoice.create`
- `invoice.issue`
- `inspection.perform`
- `inspection.approve`
- `asset.manage`
- `maintenance.complete`
- `report.export`
- `admin.audit.view`

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

A member administrator who does not hold `organisation.manage` may assign only roles whose active permission grants are all permissions the administrator effectively holds themselves.

This means `member.manage` is not a route for manufacturing stronger administrators. The same ceiling applies when role intent is attached to a pending invitation.

### Manager protection and lockout prevention

Administrative mutations must enforce all of the following:

- users cannot change their own membership status through the organisation-administration workspace;
- users cannot change their own organisation-role assignments through that workspace;
- a lower-level member administrator cannot suspend/disable or rewrite the roles of a member who effectively holds `organisation.manage`;
- only an organisation manager may administer another organisation manager;
- role/member changes must not leave an organisation without at least one active member who effectively holds `organisation.manage`;
- cross-tenant and inactive role identifiers are rejected;
- request boundaries use public IDs rather than internal surrogate IDs;
- administrative state changes append audit evidence.

These rules supplement normal permission evaluation; they do not replace it.

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

At the current implementation stage, the stable administration grants are:

```text
Owner         → organisation.manage + member.invite + member.manage
Administrator → organisation.manage + member.invite + member.manage
Manager       → member.invite + member.manage
```

The remaining role templates receive no domain permission grants until those permission catalogues are implemented. This prevents speculative permissions from becoming security policy. The founding member receives **Owner only**.

## 8. Project roles

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

Project roles control project context and visibility; they do not replace organisation permissions.

## 9. Cross-organisation sharing

Every share must specify:

- source/owning organisation;
- target participant/organisation;
- project;
- record type/record;
- access level;
- expiry where applicable;
- actor who granted access.

Revocation must not delete historical evidence that a record was previously shared.

## 10. Tenant-isolation rules

- Server determines tenant context from authenticated membership.
- No repository method may fetch tenant-owned records by ID alone when tenant context is required.
- Composite query methods should take `organisationId` or a verified access context.
- Background jobs include tenant context explicitly.
- Search indexes, caches and exports preserve tenancy boundaries.
- Object-storage keys/authorisation must not become a tenancy bypass.
- Platform support access requires a privileged, auditable workflow.

## 11. Session requirements

- secure, HttpOnly cookies where cookie sessions are used;
- Secure flag in production;
- appropriate SameSite policy;
- session rotation after privilege/authentication changes;
- logout/revocation;
- idle/absolute expiry policy;
- MFA step-up for high-risk actions if required by security design.

## 12. Permission and provisioning testing

Automated tests must include:

- same-tenant allowed access;
- same-tenant denied role;
- different-tenant denial;
- administrative delegation-ceiling enforcement;
- organisation-manager protection;
- final-manager lockout prevention;
- sign-up without provisioning intent denied;
- invitation/bootstrap intent ambiguity denied;
- bootstrap token tampering and email mismatch denied;
- pending bootstrap identities denied trusted actor access;
- verified bootstrap activation of user/organisation/membership;
- project not shared;
- project shared read-only;
- direct endpoint attempts;
- object/file download attempts;
- export/report access;
- background job authorisation/context handling.

Tenant isolation and controlled provisioning are release gates.
