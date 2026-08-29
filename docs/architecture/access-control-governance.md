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
4. the stable `owner` access-role identity is an ownership boundary and may be delegated only by an active member who already holds that bound role;
5. explicit member permission overrides remain subject to their own governed service and must not be used as an undocumented privilege-escalation path.

The ownership rule prevents an Administrator from turning `organisation.manage` into ownership merely by renaming or assigning the Owner template to themselves or another member.

## 4. Permission decision precedence

The effective organisation-level decision remains:

```text
explicit member deny
  > explicit member allow
  > active role grant
  > default deny
```

Project/record scope is applied after the organisation-level decision.

## 5. Segregation of duties

NuBlox uses two complementary controls.

### Transactional maker/checker controls

Where the conflict is record-specific, the domain service enforces separation at transaction time. Example: a member may possess both supplier-payment preparation and approval capability but cannot approve the same supplier payment they created.

This avoids over-restricting legitimate small-organisation staffing while still protecting the governed transaction.

### Static access conflicts

Static role-assignment conflicts should be introduced only where merely possessing both authorities creates unacceptable control-plane risk. These rules must be permission- or stable-role-key-based and must never depend on mutable role display labels.

Future static conflict rules belong in the central access-governance policy and require integration tests proving that composed multi-role access cannot bypass them.

## 6. Audit requirements

The following actions require append-oriented audit evidence with organisation, acting user/member, correlation identifier and subject identity:

- member role assignment/replacement;
- role creation and modification;
- invitation role assignment;
- member permission override changes;
- ownership-sensitive membership changes;
- standard access-role template binding or template-version changes.

Audit evidence is not a substitute for current-state relational integrity, and current-state tables are not a substitute for immutable audit evidence.

## 7. Governance direction

With stable standard-role identity and template provenance established, the next RBAC evolution should focus on role-assignment lifecycle and expiry, narrowly justified toxic-access/segregation-of-duties rules, delegated authority by scope/value/effective dates, and periodic access review/attestation.

Organisation positions may carry recommended access templates in future, but activation must remain an explicit, auditable access-control decision.
