# NuBlox Access-Control Governance

**Status:** enforced baseline  
**Scope:** organisation access roles, delegated administration and segregation-of-duties boundaries.

## 1. Identity and work architecture are not access control

NuBlox keeps these concepts separate:

```text
Enterprise Function -> Functional Role -> Job Profile -> Organisation Position -> Person

Organisation Member -> Organisation Access Role -> Permission grants
```

A job profile, career, functional role, project business role or position may inform an access recommendation, but it must never become an implicit permission grant.

## 2. Standard access-role baseline

NuBlox standard organisation access roles use durable machine identities that are independent of their display labels:

| Stable role key | Default display label |
| --- | --- |
| `owner` | Owner |
| `administrator` | Administrator |
| `manager` | Manager |
| `finance-commercial` | Finance/Commercial |
| `member-professional` | Member/Professional |
| `field-worker` | Field Worker |
| `read-only` | Read Only |

These are security templates, not job titles. Domain bootstrap/reconciliation extends their permission grants as NuBlox capabilities are introduced.

Stable template identity is stored in `organisation_role_template_bindings`, not inferred continuously from `organisation_roles.name`. Standard roles are bound to the template key `nublox.standard-access-role`; `template_version` records the permission-template version that was successfully reconciled for the bound role. Once bound, changing an organisation role's display name does not change its security semantics.

Canonical display names are used only to bootstrap/backfill a missing binding for legacy or newly provisioned standard roles. Tenant-created custom organisation roles remain unbound and are not treated as NuBlox-managed standard templates unless a future explicit governance operation binds them.

Organisation-specific access requirements should be represented by explicit custom organisation roles rather than by converting careers or job profiles into security rules.

## 3. Delegated administration

Role delegation is governed at the service boundary as well as the UI boundary.

Rules:

1. assigning any access role requires `member.manage` or the wider `organisation.manage` authority;
2. a delegated member administrator may assign only permissions they effectively hold;
3. `organisation.manage` may administer the ordinary organisation role catalogue;
4. the stable `owner` access-role identity is an ownership boundary and may be delegated only by an active member whose bound Owner assignment is effective at the decision instant;
5. explicit member permission overrides remain subject to their own governed service and must not be used as an undocumented privilege-escalation path.

The ownership rule prevents an Administrator from turning `organisation.manage` into ownership merely by renaming or assigning the Owner template to themselves or another member. An expired or not-yet-effective Owner assignment is not an ownership credential.

## 4. Permission decision precedence

The effective organisation-level decision remains:

```text
active explicit member deny
  > active explicit member allow
  > active role grant
  > default deny
```

A role assignment or member override is active only when its access lifecycle window is effective. Project/record scope is applied after the organisation-level decision.

## 5. Access lifecycle and expiry

NuBlox treats time bounds as metadata on an access assignment or exception, not as lifecycle attributes on the role or permission definition itself.

- `member_role_access_windows` governs an existing `member_roles` assignment.
- `member_permission_override_access_windows` governs an existing `member_permission_overrides` exception.
- absence of a lifecycle row means the parent assignment/exception is indefinite and preserves legacy behaviour;
- `effective_from` and `expires_at` are UTC instants;
- windows are half-open: `[effective_from, expires_at)`, so access becomes effective at `effective_from` and ceases exactly at `expires_at`;
- either bound may be omitted, but where both are present `effective_from < expires_at` is enforced by the database;
- deleting a parent assignment/override cascades its lifecycle metadata;
- expiry is enforced synchronously by every permission decision and does not depend on a background cleanup job;
- scheduled and expired exceptions may remain in current-state administration views until explicitly removed so governance evidence is visible alongside audit history.

The permission engine accepts an explicit evaluation instant for deterministic boundary testing and governance checks. This also permits service-layer continuity checks at a scheduled activation or expiry transition rather than relying only on the present moment.

Lifecycle applies only to access security. It does not make careers, job profiles, functional roles, organisation positions or project business roles into security assignments.

## 6. Segregation of duties

NuBlox uses two complementary controls.

### Transactional maker/checker controls

Where the conflict is record-specific, the domain service enforces separation at transaction time. Example: a member may possess both supplier-payment preparation and approval capability but cannot approve the same supplier payment they created.

This avoids over-restricting legitimate small-organisation staffing while still protecting the governed transaction.

### Static access conflicts

Static role-assignment conflicts should be introduced only where merely possessing both authorities creates unacceptable control-plane risk. These rules must be permission- or stable-role-key-based and must never depend on mutable role display labels.

Future static conflict rules belong in the central access-governance policy and require integration tests proving that composed multi-role access cannot bypass them.

## 7. Audit requirements

The following actions require append-oriented audit evidence with organisation, acting user/member, correlation identifier and subject identity:

- member role assignment/replacement;
- role creation and modification;
- invitation role assignment;
- member permission override changes, including effective/expiry bounds;
- role-assignment lifecycle changes;
- ownership-sensitive membership changes;
- standard access-role template binding or template-version changes.

Audit evidence is not a substitute for current-state relational integrity, and current-state tables are not a substitute for immutable audit evidence.

## 8. Governance direction

With stable standard-role identity, template provenance and synchronous access expiry established, the next RBAC evolution should focus on narrowly justified toxic-access/segregation-of-duties rules, delegated authority by scope/value/effective dates, and periodic access review/attestation.

Organisation positions may carry recommended access templates in future, but activation must remain an explicit, auditable access-control decision.
