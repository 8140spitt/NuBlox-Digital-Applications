# Portfolio, programme and project hierarchy

**Status:** Native project-controls foundation  
**Governing architecture:** `construction-and-built-environment.md`  
**Programme:** issue #58, section 2

## Product model

NuBlox now treats **Portfolio → Programme → Project** as distinct canonical records rather than labels copied onto projects.

The hierarchy is deliberately optional:

- a portfolio may contain zero or more programmes;
- a programme may belong to one portfolio or remain standalone;
- a project may belong to one programme or remain standalone;
- existing projects are not backfilled into artificial hierarchy records.

This preserves legitimate single-project organisations while allowing owners, developers, contractors and consultants to introduce programme and portfolio governance where their operating model requires it.

## Ownership and tenant integrity

Portfolios and programmes are owned by exactly one NuBlox organisation. Projects retain their existing `owning_organisation_id` and cross-organisation participation remains represented through `project_organisations` and `project_members`.

Database constraints enforce tenant-safe hierarchy edges:

- `(programme.portfolio_id, programme.organisation_id)` references a portfolio in the same organisation;
- `(project.programme_id, project.owning_organisation_id)` references a programme in the same owning organisation.

A participating external organisation therefore cannot re-parent another organisation's project or attach it to its own programme structure.

## Permissions

The hierarchy introduces four granular permissions:

- `project.portfolio.view`
- `project.portfolio.manage`
- `project.programme.view`
- `project.programme.manage`

`project.manage` remains the umbrella management permission. Standard-role grants are established by the migration and are also self-healed at the hierarchy service boundary so organisations created after the migration receive the same product defaults.

Organisation-wide hierarchy visibility is distinct from project membership. A member without portfolio/programme view permission may still see the parent programme/portfolio names for a project they are independently authorised to view; this is project context, not organisation-wide hierarchy enumeration.

## Audit evidence

Material hierarchy actions append canonical audit events:

- `portfolio.created`
- `programme.created`
- `project.programme_assigned`

Project assignment audit evidence is project-scoped. Portfolio/programme creation evidence is organisation-scoped.

## User experience

`/projects` is the operating surface for hierarchy discovery and creation. It presents:

- portfolio and programme counts;
- the organisation's portfolio/programme tree when authorised;
- standalone programmes explicitly rather than hiding them;
- controlled portfolio/programme creation paths;
- project cards with their portfolio/programme context or an explicit standalone-project state.

Existing project collaboration, lifecycle and member-scope rules are unchanged.

## What this foundation does not yet implement

This slice establishes the project-controls structure only. Subsequent issue #58 work adds:

1. WBS, activities, milestones, dependencies and schedule baselines;
2. resource loading and capacity;
3. project budgets, commitments, actuals, forecast-at-completion and cash flow;
4. progress measurement and earned-value foundations;
5. risk, issue, decision and action registers;
6. controlled project change spanning scope, programme, cost, contract and information impact.
