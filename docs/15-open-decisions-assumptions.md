# 15 — Open Decisions and Assumptions

## Fixed decisions

| Decision | Status |
|---|---|
| Frontend | Svelte 5 |
| Framework | SvelteKit |
| Primary relational persistence | MySQL 8.4 / InnoDB |
| Initial architecture | Modular monolith |
| Product model | Business OS + Built Environment OS + capability packs |
| Career baseline | 84 National Careers Service construction/built-environment profiles |
| Tenancy | Multi-tenant |
| Market starting point | UK-first |
| Accessibility target | WCAG 2.2 AA |
| Database query layer | Kysely + mysql2 — ADR-0001 |
| Production migrations | Dbmate plain SQL — ADR-0001 |
| Authentication/session boundary | Better Auth; NuBlox remains tenancy/permission authority — ADR-0002 |
| Initial account provisioning | NuBlox organisation invitations + verified-email activation + organisation selection |

## Blockers to resolve during discovery / implementation planning

### Hosting

Define:

- cloud/provider;
- region/data residency;
- application runtime;
- MySQL service;
- object storage;
- backup/DR;
- observability.

### File/object storage

Select provider and define:

- private access;
- signed downloads;
- malware scanning;
- retention;
- lifecycle;
- preview generation.

### Accounting scope

Decide whether NuBlox provides:

1. operational invoicing/job costing only, integrating with accounting packages; or
2. a statutory ledger/accounting product.

Baseline assumes option 1.

### Mobile/offline

Decide whether first launch requires:

- responsive web only;
- installable PWA;
- offline field data;
- native wrapper/app.

### Regulatory product claims

Decide whether NuBlox will specifically market support for:

- CDM dutyholder workflows;
- Building Safety Act/golden thread;
- electrical/gas/energy certificate production;
- other professional regulated forms.

Claims require dedicated legal/domain validation.

## Authentication follow-on decisions

The authentication provider/session boundary is fixed by ADR-0002 and the initial invitation → verified identity → membership → organisation-selection path is implemented. Remaining security/product increments are narrower decisions:

- production transactional email provider and operational deliverability/monitoring;
- password-recovery UX and support/admin recovery workflow;
- MFA/step-up policy for high-risk operations;
- enterprise SSO/SAML/OIDC roadmap;
- invitation administration UX beyond initial create/accept flow;
- session lifetime tuning based on operational risk;
- production trusted-origin/deployment configuration.

The current provider-neutral email boundary uses `EMAIL_DELIVERY_MODE=console` only for local development and integration tests. Production must install a real delivery adapter rather than treating console delivery as a deployable configuration.

These decisions must extend the current boundary without moving organisation membership or NuBlox permissions into the authentication provider.

## Important non-blocking decisions

- payment provider;
- email provider;
- e-sign provider;
- calendar integration;
- geocoding/maps;
- BIM/CDE integrations;
- AI provider(s);
- feature-flag platform;
- analytics platform;
- customer support tooling.

## Product assumptions to validate

- organisations want one account with multiple career roles;
- projects often need controlled cross-organisation collaboration;
- many users need mobile field workflows;
- businesses will accept external accounting integration rather than full accounting initially;
- document/version history is a core differentiator;
- three pilot roles are representative enough to validate architecture;
- career expansion should be demand-led after shared capability families exist.

## Questions for discovery interviews

1. Which three daily workflows consume the most time?
2. Which documents/registers are currently duplicated?
3. What causes commercial leakage?
4. Which information must never be visible to another project party?
5. Which actions require formal approval?
6. What must work on a phone/site?
7. What requires offline access?
8. Which certificates/forms are legally or contractually prescribed?
9. Which systems must integrate on day one?
10. What records must be retained, and for how long?
11. Which reports are required weekly/monthly?
12. What would prevent switching from existing software?
