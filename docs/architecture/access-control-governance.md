# NuBlox Access-Control Governance

**Status:** enforced baseline  
**Scope:** organisation access roles, delegated administration, delegated authority ceilings, access lifecycle, segregation of duties and periodic access review.

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

## 3. Delegated administration and authority ceilings

Role delegation is governed at the service boundary as well as the UI boundary.

Baseline rules:

1. assigning any access role requires `member.manage` or the wider `organisation.manage` action authority;
2. a delegated member administrator without `organisation.manage` may assign only permissions they effectively hold unless an Owner has explicitly configured a delegated-authority policy for that member;
3. an unrestricted `organisation.manage` holder retains the existing non-Owner delegation behavior when no delegated-authority policy is configured;
4. the stable `owner` access-role identity is an ownership boundary and may be delegated only by an active member whose bound Owner assignment is effective at the decision instant;
5. explicit member permission overrides remain subject to their own governed service and must not be used as an undocumented privilege-escalation path.

The ownership rule prevents an Administrator from turning `organisation.manage` into ownership merely by renaming or assigning the Owner template to themselves or another member. An expired or not-yet-effective Owner assignment is not an ownership credential.

### Owner-governed delegated authority policy

An active Owner may place a non-Owner member under an explicit delegation ceiling using normalized policy state:

- `organisation_delegation_policies` stores one policy per organisation member, its effective/expiry window, reason and original Owner author;
- `organisation_delegation_role_grants` stores the standard access-role keys that may be delegated;
- `organisation_delegation_permission_grants` stores the permission keys that may be carried by delegated roles.

A configured policy does **not** grant runtime permissions or action authority. The caller still needs the normal capability required by the operation, such as member administration or organisation administration. The policy only limits what access the caller may grant to somebody else.

Configured policies are intentionally fail-closed:

- before `effective_from`, delegation is denied;
- at `effective_from`, the configured ceiling becomes usable;
- at `expires_at`, delegation is denied exactly at that instant and thereafter;
- an expired or scheduled policy never falls back to unrestricted `organisation.manage` behavior;
- only explicit Owner removal of the policy restores the legacy unrestricted behavior.

The Owner role is not permitted in delegated role grants and an active Owner cannot themselves be placed under a delegated-authority policy.

For an effective configured policy:

1. every requested bound standard access role must appear in the policy's stable-role allow-list;
2. every permission carried by every requested role must appear in the policy's permission allow-list;
3. custom organisation roles have no stable NuBlox role key and are therefore governed by the permission ceiling;
4. role creation and role updates are checked against the same permission ceiling so a restricted administrator cannot bypass assignment controls by widening a role first;
5. updates to a bound standard role are also subject to the stable-role allow-list, while Owner-role mutation remains Owner-only.

The ceiling is evaluated centrally so member-role replacement and organisation invitations cannot diverge into separate delegation rules.

Delegated authority remains security governance only. Enterprise functions, functional roles, job profiles, careers, organisation positions and project business roles neither configure nor inherit these policies.

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

The central access-conflict policy evaluates stable role keys and effective permissions. It never depends on mutable role display labels.

The first enforced static policy makes the bound `read-only` access role an exclusive least-privilege posture. It cannot be combined with another standard access role and cannot effectively hold `organisation.manage` or `finance.manage`. Explicit denies continue to take precedence and may safely neutralise a conflicting role grant. Removing such a deny is blocked if the resulting effective access would violate policy.

Financial and other domain-specific static conflicts should be added only where merely possessing both authorities creates unacceptable control-plane risk. Record-specific maker/checker controls remain preferable where the risk belongs to a particular transaction.

## 7. Periodic access review and attestation

Periodic access review is represented by normalized review campaigns and immutable review items:

- `access_review_campaigns` records the organisation review window, snapshot instant, due date and terminal state;
- `access_review_items` snapshots every current member role assignment and explicit member permission override at campaign opening;
- each item preserves the member public identity, source role/permission identity, stable standard-role key where applicable, lifecycle state, effective/expiry bounds, source reason and final review decision;
- role display names are evidence only; standard-role governance continues to use stable role keys;
- review items survive the revocation of their source access so the attestation record is not destroyed by the remediation it triggered;
- campaigns may be completed only when every snapshotted item has been certified or revoked;
- cancelled campaigns retain their snapshot and any decisions already made.

Campaign administration remains governed by `organisation.manage`, but campaigns now support two reviewer modes. `organisation_manage` preserves the original manager-attestation behaviour. `assigned` mode records exactly one active same-organisation reviewer for every reviewed member in `access_review_reviewer_assignments`; self-attestation is prohibited. In assigned mode, `organisation.manage` does not bypass the recorded reviewer for item decisions. Reviewer assignment grants attestation authority for that campaign subject only and never grants runtime permissions. Managers retain full campaign visibility and terminal administration, while non-manager reviewers can see and decide only the subjects assigned to them.

Review-driven revocation is subject to the same security invariants as ordinary administration:

1. a bound Owner assignment may be revoked only by an active Owner;
2. revocation cannot remove the last active Owner;
3. revocation cannot leave the organisation without an active `organisation.manage` path;
4. removing an explicit deny is re-evaluated against static access-conflict policy before commit;
5. access mutation and review decision are committed atomically, so a failed governance check leaves both the access source and pending review item unchanged.

Certification does not mutate access. Revocation removes the snapshotted assignment/override when it is still present and records whether remediation was actually applied. If an administrator removed the source before the reviewer acted, the review may still be closed with a revoke decision while retaining that historical fact in audit evidence.

Access review governs security assignments only. It does not certify job profiles, careers, functional roles, positions or project business roles.

## 8. Audit requirements

The following actions require append-oriented audit evidence with organisation, acting user/member, correlation identifier and subject identity:

- member role assignment/replacement;
- role creation and modification;
- invitation role assignment;
- member permission override changes, including effective/expiry bounds;
- role-assignment lifecycle changes;
- ownership-sensitive membership changes;
- standard access-role template binding or template-version changes;
- delegated-authority policy creation/update and removal, including stable-role keys, permission ceiling and effective/expiry bounds;
- access-review campaign opening, reviewer assignment, item decisions, completion and cancellation.

Audit evidence is not a substitute for current-state relational integrity, and current-state tables are not a substitute for immutable audit evidence.

## 9. Governance direction

With stable role identity, lifecycle enforcement, SoD controls, independent scoped attestation and Owner-governed delegation ceilings established, the next access-control evolution should focus on delegated authority by project/value/domain scope, access-policy decision evidence, and explicit audit evidence for automatic standard-role binding/reconciliation.

Organisation positions may carry recommended access templates in future, but activation must remain an explicit, auditable access-control decision.
