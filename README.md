# NuBlox: Digital Applications

NuBlox is a natively engineered **construction and built-environment operating system**: a world-class ERP and operational platform connecting commercial, project, field, financial, workforce, asset and property lifecycles in one governed system.

## Architecture: bottom up

NuBlox is not designed from screens or modules downward. The governing architecture starts from irreducible business semantics and builds upward:

```text
Primitives & invariants
→ Canonical records & relationships
→ Trust, tenancy & authorisation
→ State, work, events & evidence
→ Domain services & boundaries
→ End-to-end business processes
→ Native capability domains
→ Construction & Built Environment overlays
→ Experience & workspaces
→ Completeness & validation
```

Start with [`docs/architecture/bottom-up/README.md`](docs/architecture/bottom-up/README.md).

This architecture enforces a simple rule: **an upper layer may compose lower layers, but it may not invent contradictory semantics**. A workspace cannot invent permission, a process cannot invent duplicate master data, and a capability cannot bypass its owning domain service.

## Construction and Built Environment

The sector model covers the enterprise and whole built-asset lifecycle:

**Market → Lead → Opportunity → Bid → Estimate → Proposal → Quote → Contract → Design → Plan → Procure → Produce → Construct → Control → Invoice → Account → Handover → Operate → Maintain → Refurbish → Dispose**

See [`docs/construction-and-built-environment.md`](docs/construction-and-built-environment.md).

The product supports organisations ranging from sole traders to multi-entity groups across development/ownership, contracting, specialist trades, design/engineering, surveying/commercial, manufacturing, merchants/logistics, plant/fleet, infrastructure/utilities, property/FM and maintenance/service.

## Native capability architecture

NuBlox has 19 native capability domains covering enterprise/master data, CRM, estimating/sales, contracts/commercial, projects, design/BIM, finance, management accounting/planning, procurement, materials/logistics, production, people/payroll, site, QHSE, plant/EAM, property/FM, service, sustainability and platform data/workflow/intelligence.

The separate enterprise function taxonomy contains 29 functions, 353 sub-functions and 1,510 source activities. It describes **work performed**; capability domains describe **product capability owned**. They are mapped many-to-many.

## Security model

**Career ≠ Organisation Role ≠ Project Role ≠ Permission**

Permission precedence:

```text
explicit member deny
> explicit member allow
> active role grant
> default deny
```

Tenant/project/record scope, lifecycle policy, delegated authority and segregation of duties are evaluated server-side. UI visibility is never authority.

## Data and implementation authority

- **Database:** MySQL 8.4 / InnoDB
- **Migrations:** Dbmate plain SQL
- **Runtime SQL:** Kysely + `mysql2`
- **Application:** Svelte 5 / SvelteKit
- **Authentication:** Better Auth
- **Architecture:** modular monolith with explicit domain boundaries
- **Data model:** relational and normalised to 3NF by default

Committed SQL migrations in [`database/migrations/`](database/migrations/) are the implemented schema authority. Generated Kysely types are derivative.

The last clean consolidated migration baseline measured on 22 August 2026 was 35 applied / 0 pending, 398 application tables, 904 foreign keys and 530 CHECK constraints. These are baseline observations, not permanent architecture invariants.

## Repository structure

```text
app/                         SvelteKit application and server domain code
database/
  migrations/                authoritative MySQL migration stream
  docs/                      durable schema-package references
  seeds/                     controlled seed/reference data
docs/
  architecture/bottom-up/    governing architecture layers
  architecture/taxonomy/     enterprise function/activity taxonomy
  adr/                       Architecture Decision Records
  branding/                  NuBlox brand system
```

## Engineering definition of done

A material capability is not complete because a screen or table exists. It must trace through canonical records, invariants, permissions, lifecycle, service boundary, workflow/evidence, process consequences, reporting/integration, usable experience and automated validation.

See [`docs/architecture/bottom-up/layer-9-completeness-validation.md`](docs/architecture/bottom-up/layer-9-completeness-validation.md).

## Local validation

From `app/`:

```bash
pnpm install
pnpm db:migrate
pnpm db:status
pnpm db:types
pnpm lint
pnpm test:integration
pnpm check
pnpm test:unit -- --run
pnpm build
```

Browser acceptance requires the repository Playwright test environment.