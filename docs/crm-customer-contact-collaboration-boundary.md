# CRM customer, contact and project-collaboration boundary

## Purpose

NuBlox separates two different concepts that must never be conflated:

1. a tenant's private CRM knowledge about real-world people and organisations; and
2. a NuBlox platform account, organisation membership or project access relationship.

The canonical rule is:

> **CRM parties never map or link to NuBlox platform organisations.**

This is an identity, privacy and authority boundary rather than a presentation convention.

## CRM parties remain tenant-private

`parties`, `party_persons`, `party_organisations` and their relationship tables belong to the organisation that maintains the CRM record. Another NuBlox tenant may independently maintain a different CRM record for the same real-world business without either record being reconciled to a shared platform-company identity.

NuBlox must not use company name, registration number, domain, email address or another heuristic to turn a CRM organisation into a NuBlox organisation. There is no CRM platform-organisation foreign key or directory lookup.

A future network capability may define explicit, consent-based data sharing, but that capability must not mutate the ownership or identity semantics of private CRM parties.

## Customer and contact semantics

### B2B customer

A business-to-business customer is an **organisation party** carrying the appropriate client/customer CRM business role. People who work for or represent that organisation are linked through `party_organisation_contacts`.

The contact relationship records affiliation facts such as job title, department and primary-contact status. It does not make the person a customer in their own right.

### Direct-person customer

A business-to-person/customer relationship is a **person party** carrying the appropriate client/customer CRM business role. No artificial organisation record is required.

### Contacts are not automatically customers

A person may simultaneously be:

- a contact for one or more organisations;
- a direct customer under a separate business relationship;
- an external project collaborator;
- none of those other roles.

Each fact is represented by its own relationship. NuBlox does not infer one relationship from another.

## Project collaboration boundary

External project access belongs to a person, not to their employer's CRM record.

The governed relationship is `project_external_collaborators`:

- one project;
- the project's owning NuBlox organisation;
- one tenant-private CRM person;
- optional tenant-private CRM organisation affiliation;
- one verified NuBlox authentication identity;
- explicit lifecycle state;
- project-scoped contextual roles;
- invitation and audit provenance.

`project_external_collaborator_roles` records contextual project roles. As elsewhere in NuBlox, a project role describes business context; it does not silently grant tenant-wide permissions.

The optional CRM organisation reference is descriptive private context only. It is not, and cannot become, a NuBlox organisation relationship.

## Invitation and acceptance

A project owner with project-participant management authority and CRM visibility may invite:

- a direct CRM person; or
- a person who is an active contact of a CRM organisation.

The invitation is addressed to the person's primary email address. Acceptance requires the matching verified authentication identity.

For a new user, project collaboration is a first-class authentication provisioning intent. Account creation verifies the person and activates project access. It does **not** create an organisation, create organisation membership or copy CRM company data into the NuBlox organisation master.

For an existing verified user, acceptance activates the same person-level project relationship regardless of whether that user separately belongs to one or more NuBlox organisations.

## Portal access

An authenticated external collaborator may enter `/portal` without selecting a tenant organisation. External portal scope is derived directly from active `project_external_collaborators` rows for the authentication identity.

This external mode must expose only explicitly shared project collaboration capabilities. It does not grant:

- organisation administration;
- tenant membership;
- the owning organisation's internal application shell;
- broad CRM visibility;
- project access beyond the explicit collaborator records.

Internal organisation members continue to use the existing tenant/member permission model. Genuine organisation-to-organisation project participation also remains a separate project-domain relationship and must not be sourced from CRM mappings.

## Audit provenance

`audit_events` distinguishes two actor classes:

- internal action: `actor_member_id` populated and `external_auth_user_id` null;
- authenticated external action: `actor_member_id` null and `external_auth_user_id` populated.

The database CHECK constraint requires exactly one actor class. External actions therefore cannot be falsely attributed to an internal organisation member.

The acting/owning organisation remains recorded for business provenance, but that does not mean the external person is a member of it.

## Corrective migration

`20260825180500_crm_person_collaboration_boundary.sql` is a forward-only correction that:

- creates the canonical external-collaborator and role relationships;
- preserves already accepted historical collaboration invitations as person-level collaboration records;
- changes pending-invitation uniqueness from CRM employer to CRM contact/person;
- removes the obsolete collaboration target-organisation field;
- removes `party_organisations.linked_organisation_id` and its constraints/indexes;
- adds explicit external-auth audit provenance.

Historical project-organisation participation remains project history. The migration does not rewrite it into a CRM identity link.

## Invariants

Implementation and tests must preserve these invariants:

1. CRM parties cannot reference a NuBlox platform organisation as their identity.
2. An external collaboration invitation resolves to an active CRM person owned by the inviting tenant.
3. An optional CRM organisation on the invitation must be an active affiliation of that person in the same tenant.
4. The invitation email must match the accepting verified auth identity.
5. Acceptance creates no organisation and no organisation membership.
6. Project access is limited to active external-collaborator rows for that auth identity.
7. Revoking collaboration removes that external project scope without deleting CRM history.
8. Internal member and external-auth audit actor identities are mutually exclusive.
9. A contact relationship never implies a customer/client role.
10. Independent NuBlox usage by an external business never causes cross-tenant CRM reconciliation.

## Product language

User interfaces should use terms such as **customer**, **contact**, **external collaborator**, **CRM affiliation** and **project access** according to the underlying relationship.

Avoid language such as:

- “link customer to NuBlox organisation”;
- “connect CRM company to platform organisation”;
- “create the customer organisation on NuBlox” as part of project collaboration;
- “NuBlox Network match” when describing private CRM identity.

Those phrases imply an identity relationship the canonical model deliberately does not contain.
