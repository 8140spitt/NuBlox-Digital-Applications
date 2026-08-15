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

## 4. Permission namespaces

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

## 5. Standard organisation roles

Initial defaults:

- Owner
- Administrator
- Manager
- Finance/Commercial
- Member/Professional
- Field Worker
- Read Only

These are templates, not hard-coded assumptions about careers.

## 6. Project roles

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

## 7. Cross-organisation sharing

Every share must specify:

- source/owning organisation;
- target participant/organisation;
- project;
- record type/record;
- access level;
- expiry where applicable;
- actor who granted access.

Revocation must not delete historical evidence that a record was previously shared.

## 8. Tenant-isolation rules

- Server determines tenant context from authenticated membership.
- No repository method may fetch tenant-owned records by ID alone when tenant context is required.
- Composite query methods should take `organisationId` or a verified access context.
- Background jobs include tenant context explicitly.
- Search indexes, caches and exports preserve tenancy boundaries.
- Object-storage keys/authorisation must not become a tenancy bypass.
- Platform support access requires a privileged, auditable workflow.

## 9. Session requirements

- secure, HttpOnly cookies where cookie sessions are used;
- Secure flag in production;
- appropriate SameSite policy;
- session rotation after privilege/authentication changes;
- logout/revocation;
- idle/absolute expiry policy;
- MFA step-up for high-risk actions if required by security design.

## 10. Permission testing

Automated tests must include:

- same-tenant allowed access;
- same-tenant denied role;
- different-tenant denial;
- project not shared;
- project shared read-only;
- direct endpoint attempts;
- object/file download attempts;
- export/report access;
- background job authorisation/context handling.

Tenant isolation is a release gate.
