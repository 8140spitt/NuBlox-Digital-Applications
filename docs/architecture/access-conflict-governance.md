# Access conflict governance

NuBlox treats segregation of duties and toxic-access prevention as a security-governance concern that is separate from enterprise functions, functional roles, job profiles, careers and organisation positions.

## Security boundary

The access-security model remains:

```text
Organisation Access Role -> Permission grants
```

Job/work architecture remains:

```text
Enterprise Function -> Functional Role -> Job Profile -> Organisation Position -> Person
```

No job profile, functional role, career or position implicitly grants an organisation access role or permission.

## Policy identity

System access-conflict policies are declared in `access-conflict-policy.ts` using immutable subjects:

- stable standard access-role keys such as `read-only`, `owner` and `finance-commercial`;
- permission keys such as `organisation.manage` and `finance.manage`.

Mutable role display names are never used for conflict evaluation.

Each policy has a stable `policyKey`, human-readable name and description, two typed subjects, and an enforcement action. The first policy version supports hard-deny enforcement. The model is deliberately generic enough to represent role/role, role/permission and permission/permission conflicts as the catalogue expands.

## Initial hard conflicts

The initial safe-to-enforce policy set establishes Read Only as an exclusive least-privilege posture:

- `read-only` cannot be combined with Owner;
- `read-only` cannot be combined with Administrator;
- `read-only` cannot be combined with Manager;
- `read-only` cannot be combined with Finance/Commercial;
- `read-only` cannot be combined with Member/Professional;
- `read-only` cannot be combined with Field Worker;
- `read-only` cannot simultaneously hold `organisation.manage`;
- `read-only` cannot simultaneously hold `finance.manage`.

The policy catalogue intentionally does not prohibit holding both supplier-payment create and approve permissions at this stage. Existing NuBlox standard roles deliberately contain both capabilities, while supplier-payment domain logic already enforces maker/checker separation on the individual payment by preventing its maker from approving the same payment. Access-level financial conflict policies should only be activated after standard-role templates and delegated-authority semantics are designed to support them without creating unintended lockouts.

## Enforcement

Conflict evaluation uses the same effective-access semantics as permission decisions:

1. active role assignments are evaluated at the requested instant;
2. role-assignment lifecycle windows use the half-open interval `[effective_from, expires_at)`;
3. explicit member denies take precedence over explicit allows;
4. explicit allows take precedence over role grants;
5. default deny applies otherwise;
6. bound standard-role identity comes from `organisation_role_template_bindings`, not display names.

Role replacement is evaluated inside the same database transaction as the assignment mutation. A conflict raises an organisation-administration validation error and the transaction rolls back.

Member permission overrides are evaluated after the proposed override is written inside the transaction. Evaluation occurs at the current instant and at any effective-from or expiry transition supplied by the override. This prevents a currently harmless scheduled exception from becoming toxic later. Removing an override is also checked before commit, so removing an explicit deny cannot expose a prohibited role grant.

Reactivating a member is checked before the status transition commits, preventing dormant legacy assignments from becoming active if they violate current policy.

## Precedence example

A member may hold `read-only` and a custom role containing `organisation.manage` only while an effective explicit deny for `organisation.manage` neutralises that grant. Removing the deny is rejected because the resulting effective access would violate `read-only.permission.organisation-manage`.

This is intentional: conflict governance is evaluated against effective access, not merely the raw collection of grants.

## Future extensions

The policy engine is designed to expand without coupling security to job architecture. Subsequent governance slices should add:

- financial permission/permission policies where standard role templates support genuine separation;
- approval-required policies in addition to hard denies;
- tenant-specific policy overlays with protected system baselines;
- scoped policies for project or legal-entity boundaries;
- access review and attestation evidence for detected and remediated conflicts;
- audit evidence for policy catalogue version changes and administrative conflict denials.
