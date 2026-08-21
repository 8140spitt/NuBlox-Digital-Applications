# V1 UX anomaly refinement

## Goal

Correct the discoverability and context anomalies found after the context-first navigation release without reopening domain boundaries or weakening server-side authority.

## Business workspace navigation

- Customers is the parent workspace for Customers & contacts, Opportunities, Estimates, Quotations and Contracts.
- Finance now lands on a finance workspace rather than arbitrarily opening Invoices, and finance functions remain visible in a permission-filtered secondary navigation.
- The global sidebar remains compact. Specialist functions remain searchable and available from More.
- Create exposes workflow entry points only where the domain supports direct creation. Opportunities and Estimates are direct entry points; Quotations remain controlled outputs of finalised estimate revisions and Contracts remain downstream of accepted quotation/project formation.

## Project workspace refinement

The persistent project context separates Team, Costs, Valuations, Schedule and Time rather than collapsing distinct high-frequency workflows behind broad labels. Project context remains permission-filtered and carries the selected project query through compatible legacy workspaces.

## CRM-backed project invitations

A private CRM organisation can optionally link to one active NuBlox platform organisation through an explicit foreign key. The link is not inferred from legal or trading names and does not create a platform-wide organisation directory.

The explicit NuBlox account link is maintained from the CRM organisation record. Project invitation forms then select tenant CRM organisations; only CRM organisations with an explicit active NuBlox link can be submitted. The server resolves the CRM record within the actor tenant and calls the existing controlled project-participant invitation service with the linked platform identity.

Security invariants remain unchanged:

- project participant authority remains server-side;
- only the project-owning organisation can invite participants;
- project lifecycle restrictions still apply;
- CRM records stay tenant-private;
- exact NuBlox IDs are used only while explicitly linking a CRM record, not during routine project work;
- no organisation is matched by name;
- navigation visibility never grants permission.

## Acceptance

Browser acceptance covers persistent Customers and Finance business navigation, restored Opportunity/Estimate creation entry points, and refined project workstream navigation. Integration coverage verifies that a project invitation can be initiated through an explicitly linked CRM organisation while preserving the existing invitation/acceptance scope boundary.
