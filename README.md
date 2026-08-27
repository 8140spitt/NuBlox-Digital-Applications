# NuBlox: Digital Applications

NuBlox is a natively engineered **enterprise operating system for organisations that create, deliver, own and operate the built environment**.

It is intended to combine two ambitions that are usually split across separate software estates:

1. **complete enterprise operations** — strategy, CRM, finance, people, payroll, procurement, supply chain, production, governance, property, assets, service, data and performance; and
2. **exceptional Construction and Built Environment depth** — estimating, contracts, project controls, design/BIM/CDE, commercial management, site delivery, QHSE, commissioning, handover, asset operations, FM, maintenance and renewal.

The differentiator is not the number of modules. It is one governed digital thread across enterprise, project and asset lifecycles.

## Start here — World-Class operating-system rebaseline

The governing product-strategy and delivery compass is [`docs/world-class/README.md`](docs/world-class/README.md).

That suite defines:

- the product North Star;
- the relationship between the 29-function enterprise taxonomy and 19 native capability domains;
- nine enterprise value streams that now govern delivery sequencing;
- Construction and Built Environment specialisation;
- the NuBlox digital thread;
- the world-class experience standard;
- the current implementation baseline;
- three golden reference journeys;
- delivery and repository governance.

**Target state and implemented state are deliberately separate.** The architecture describes what NuBlox is being engineered to become; current maturity is proven by code, migrations, tests, the capability registry and runtime process map.

## One complete product

Customers do not assemble NuBlox from ERP, PLM, PDM, CDE/BIM, PMIS, HCM, SCM, EAM or other separately licensed core modules. Market labels are world-class coverage benchmarks over the native architecture, not NuBlox product boundaries.

Capability is included by product design and exposed according to organisation context, career/professional context, explicit permission, project/contract/site/property/asset context and jurisdiction.

See [`docs/architecture/bottom-up/platform-coverage-contract.md`](docs/architecture/bottom-up/platform-coverage-contract.md).

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

An upper layer may compose lower layers, but it may not invent contradictory semantics. A workspace cannot invent permission, a process cannot invent duplicate master data, a market software category cannot become a parallel architecture, and a capability cannot bypass its owning domain service.

## Enterprise operating model

The enterprise function taxonomy contains **29 functions, 353 sub-functions and 1,510 source activities**. It describes **what work organisations perform**. The 19 native capability domains describe **what product capability NuBlox owns**. Value streams describe **how outcomes cross functions and domains**.

These dimensions are deliberately separate:

**Enterprise Function ≠ Capability Domain ≠ Value Stream ≠ Lifecycle Stage ≠ Workspace**

See [`docs/architecture/taxonomy/README.md`](docs/architecture/taxonomy/README.md) and [`docs/world-class/02-enterprise-operating-model.md`](docs/world-class/02-enterprise-operating-model.md).

## Construction and Built Environment

The sector model covers the enterprise and whole built-asset lifecycle:

**Market → Lead → Opportunity → Bid → Estimate → Proposal → Quote → Contract → Design → Plan → Procure → Produce → Construct → Control → Invoice → Account → Handover → Operate → Maintain → Refurbish → Dispose**

See [`docs/construction-and-built-environment.md`](docs/construction-and-built-environment.md).

Construction is NuBlox's deepest sector specialisation, but it is not the limit of the enterprise operating model. NuBlox must also run the sophisticated non-construction functions required by contractors, consultancies, developers, owners, manufacturers, property organisations and infrastructure operators.

## Native capability architecture

NuBlox has 19 native capability domains covering enterprise/master data, CRM, estimating/sales, contracts/commercial, projects, design/BIM, finance, management accounting/planning, procurement, materials/logistics, production, people/payroll, site, QHSE, plant/EAM, property/FM, service, sustainability and platform data/workflow/intelligence.

Those domains are ownership/composition boundaries, not 19 separate applications or a development checklist.

## Digital thread

NuBlox must preserve controlled continuity from market need and requirement through estimate, design, product/system definition, procurement/fabrication, installation, commissioning and handed-over asset into operation, maintenance, refurbishment and disposal.

The thread connects commercial, schedule, cost, document/model revision, configuration, quality, safety, provenance, carbon, asset condition, service and accounting evidence instead of leaving those facts in disconnected applications.

See [`docs/world-class/05-digital-thread.md`](docs/world-class/05-digital-thread.md).

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

Counts of migrations, tables, foreign keys, constraints and tests are observations of a particular baseline and must not be treated as permanent architecture invariants.

## Repository structure

```text
app/                         SvelteKit application and server domain code
database/
  migrations/                authoritative MySQL migration stream
  docs/                      durable schema-package references
  seeds/                     controlled seed/reference data
docs/
  world-class/               product strategy, value streams, digital thread and delivery governance
  architecture/bottom-up/    governing architecture layers and platform coverage contract
  architecture/taxonomy/     enterprise function/activity taxonomy
  adr/                       Architecture Decision Records
  branding/                  NuBlox brand system
```

## Engineering definition of done

A material capability is not complete because a screen or table exists. It must trace through canonical records, invariants, permissions, lifecycle, service boundary, workflow/evidence, process consequences, reporting/integration, usable experience and automated validation.

A world-class claim additionally requires benchmark-competitive depth plus exceptional integration, control and experience proven through reference journeys.

See [`docs/architecture/bottom-up/layer-9-completeness-validation.md`](docs/architecture/bottom-up/layer-9-completeness-validation.md) and [`docs/world-class/09-delivery-governance.md`](docs/world-class/09-delivery-governance.md).

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
