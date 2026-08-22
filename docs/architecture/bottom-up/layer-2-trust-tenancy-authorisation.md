# Layer 2 — Trust, Tenancy and Authorisation

**Status:** Governing security architecture

Layer 2 determines who is acting, in what trusted context, and whether a requested action is authorised.

## Trust chain

```text
authenticated identity
→ linked active NuBlox user
→ active organisation membership
→ organisation role grants + member overrides
→ project participation/scope when required
→ tenant/record scope
→ lifecycle and business-policy checks
→ authorised domain command
```

Authentication alone is never tenant authority.

## Separation of concepts

**Career ≠ Organisation Role ≠ Project Role ≠ Permission**

- career/profession controls relevance and experience composition;
- organisation role contributes reusable permission grants;
- project role represents project responsibility/context;
- permission is an explicit server-authoritative action entitlement.

None of the first three may implicitly grant a permission unless an explicit governed mapping creates the relevant organisation-role permission grant.

## Permission resolution

```text
explicit member deny
> explicit member allow
> active role grant
> default deny
```

A same-domain umbrella may resolve only an otherwise undecided granular permission. An explicit granular deny cannot be bypassed by an umbrella.

Umbrellas never cross domains.

## Scope rules

Authorisation evaluates more than the permission key:

- active organisation;
- tenant ownership;
- project/programme participation where relevant;
- record relationship and visibility;
- lifecycle state;
- delegated authority/approval limit;
- segregation of duties;
- regulatory/business policy;
- temporal validity where applicable.

A public ID or guessed internal ID is never proof of access.

## Segregation of duties

Material controls may require different actors for preparation, review, authorisation, posting, payment, certification or reversal. SoD is a domain policy built on top of permission and actor attribution; it is not represented merely by hiding buttons.

## Delegation

Delegated authority must be explicit, scoped, attributable, time-bound where applicable and auditable. Delegation must not silently convert a project role or career into organisation-wide authority.

## Cross-organisation collaboration

Shared projects and portal participation use controlled participant relationships. They do not merge tenants.

A participating organisation/member sees only records exposed through authorised project/network relationships and explicit domain policy. The owning organisation and provenance remain intact.

## Masking and disclosure

Foreign-tenant record identifiers and existence are masked where disclosure itself would leak information. Error handling must not reveal inaccessible tenant data.

## Mutation contract

Every material domain command evaluates, in order:

1. authenticated actor;
2. active membership/context;
3. requested permission;
4. tenant and record scope;
5. project/network scope if applicable;
6. lifecycle/business preconditions;
7. SoD/delegated-authority constraints;
8. mutation and attributable evidence.

Client-side route guards and visibility controls are usability features only.