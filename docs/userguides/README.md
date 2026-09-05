# NuBlox User Guides

This folder contains end-user operating guides for the NuBlox application suite.

## Guide set

1. [00-complete-application-step-by-step.md](00-complete-application-step-by-step.md)
2. [01-sign-in-and-context-selection.md](01-sign-in-and-context-selection.md)
3. [02-navigation-search-and-create.md](02-navigation-search-and-create.md)
4. [03-core-workspaces-project-documents-finance.md](03-core-workspaces-project-documents-finance.md)
5. [04-enterprise-search-and-portal-sharing.md](04-enterprise-search-and-portal-sharing.md)

## Business function/domain guides

1. [10-domain-commercial-and-customer.md](10-domain-commercial-and-customer.md)
2. [11-domain-project-delivery-and-controls.md](11-domain-project-delivery-and-controls.md)
3. [12-domain-operations-workforce-assets.md](12-domain-operations-workforce-assets.md)
4. [13-domain-finance.md](13-domain-finance.md)
5. [14-domain-governance-and-administration.md](14-domain-governance-and-administration.md)
6. [15-domain-collaboration-search-and-portal.md](15-domain-collaboration-search-and-portal.md)

## Screenshot catalogue

The guides use this screenshot set from `screenshots/`:

- `01-sign-in.png`
- `02-select-organisation.png`
- `03-dashboard-home.png`
- `04-workspace-search.png`
- `05-create-menu.png`
- `06-projects-workspace.png`
- `07-documents-workspace.png`
- `08-finance-workspace.png`
- `09-more-workspaces.png`
- `10-enterprise-search.png`
- `11-portal-manage-sharing.png`
- `12-my-work.png`
- `13-projects.png`
- `14-crm-customers.png`
- `15-crm-opportunities.png`
- `16-commercial-estimates.png`
- `17-commercial-quotations.png`
- `18-purchasing.png`
- `19-contracts.png`
- `20-project-cost-control.png`
- `21-valuations.png`
- `22-people.png`
- `23-schedule.png`
- `24-time.png`
- `25-site-quality-safety.png`
- `26-assets-facilities.png`
- `27-finance-invoices.png`
- `28-finance-payments.png`
- `29-finance-receivables.png`
- `30-finance-collections.png`
- `31-finance-collections-automation.png`
- `32-finance-credit-control.png`
- `33-finance-bad-debt.png`
- `34-finance-tax.png`
- `35-finance-tax-relief.png`
- `36-finance-billing.png`
- `37-finance-accounting.png`
- `38-finance-accounting-periods.png`
- `39-finance-accounting-reports.png`
- `40-finance-year-end.png`
- `41-organisation-settings.png`
- `42-contexts.png`
- `43-capability-registry.png`
- `44-enterprise-search-empty.png`
- `45-portal-shared-work.png`

## Scope and assumptions

- Persona: authenticated organisation member (owner/admin baseline).
- Access pattern: context-first workspaces with permission-filtered navigation.
- Security rule in practice: access is role and permission controlled; workflows shown here assume the signed-in user has the required grants.

## How screenshots were generated

Screenshots were captured from a seeded E2E environment using:

- `app/e2e/userguides-capture.e2e.ts` (optional Playwright capture spec)
- Local preview route set at `http://127.0.0.1:4173`

If you need to refresh screenshots, run the capture workflow in a seeded environment and overwrite the PNG files in this folder.
