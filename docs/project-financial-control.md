# Project financial control

## Purpose

This slice continues Section 2 of the NuBlox delivery programme by making project budgets, commitments, actuals, forecast-at-completion and cash flow a coherent project-controls capability without introducing a second editable project ledger.

The governing rule remains:

> **Live project financial position is derived from canonical source facts; approved forecasts are controlled historical management snapshots.**

## Canonical boundaries

NuBlox already owns the source facts required for project financial control:

- `project_budgets`, `project_budget_versions` and `project_budget_lines` own approved budget baselines;
- `project_budget_adjustments` and their items own additive approved budget movement;
- purchase-order versions and items own supplier commitments;
- `purchase_order_item_cost_allocations` classify commitments to project cost codes;
- confirmed purchase-order receipts own procurement incurred-cost evidence;
- approved timesheet cost snapshots and `timesheet_cost_code_allocations` own labour actual cost;
- `project_direct_costs` and reversals own genuinely manual/imported project cost facts;
- commercial variations and decisions own approved change and pending exposure;
- `commercial_reporting_periods`, `commercial_forecasts` and `commercial_forecast_lines` own controlled point-in-time forecast history.

This slice adds only one missing business fact:

- `commercial_forecast_cash_flow_lines` time-phase forward-looking forecast cash movement against a forecast version.

No editable `current_budget`, `committed_cost`, `actual_cost` or `eac` balance is introduced.

## Live position

For a selected project and as-of date, NuBlox derives each project cost code position.

Conceptually:

```text
approved baseline budget
+ approved budget adjustments
= current control budget

issued purchase-order value
= commitment

confirmed receipt cost
+ allocated approved labour cost
+ net posted direct cost
= actual cost

max(commitment - procurement actual, 0)
= remaining commitment
```

Approved and pending commercial variation values are displayed separately so change exposure is not silently folded into either budget or actual cost.

## Cost classification

Forecast creation is a governed reporting cut-off, so source facts must reconcile to the project cost-code structure before a forecast snapshot can be created.

The service therefore blocks forecast creation while any of these remain unclassified:

- issued purchase-order commitment;
- confirmed receipt actual cost derived from that commitment;
- approved/pending commercial change exposure.

Procurement actual cost follows the same purchase-order cost allocation proportionally as confirmed receipt quantity is incurred. This keeps commitment and actual cost aligned to the same classification without duplicating receipt facts.

## Reporting cut-off

A `commercial_reporting_period` defines the project commercial cut-off.

Periods are non-overlapping and move through:

```text
open → closed
  ↑      ↓
  └─ reopened
```

A period can be closed only after an approved forecast exists for it. Reopening requires forecast approval authority and preserves audit evidence.

## Forecast snapshot

Creating a forecast version transactionally snapshots every active project cost code at the selected period end:

- control budget;
- actual cost;
- remaining commitment;
- approved change;
- pending change exposure;
- forecast-to-complete management judgement.

The initial FTC is a planning starting point:

```text
max(
  0,
  control budget - actual cost,
  remaining commitment
)
```

It is intentionally editable while the forecast remains `draft`.

Forecast-at-completion is derived:

```text
actual cost snapshot + forecast to complete = EAC
```

Cost variance is derived:

```text
control budget snapshot - EAC = cost variance
```

The forecast also snapshots project forecast revenue. Forecast margin is derived:

```text
forecast revenue - EAC = forecast margin
```

Approved/superseded forecasts and their lines are immutable through the service boundary. A later management view is a new forecast version, not an edit to the historical forecast.

## Cash flow

`commercial_forecast_cash_flow_lines` records forward-looking cash movement after the reporting cut-off.

A cash-flow line records:

- forecast version;
- date;
- inflow/outflow direction;
- controlled cash-flow category;
- optional project cost code;
- amount;
- commentary.

Cash-flow planning is forecast evidence, not a bank ledger, accounts-payable ledger or receivables ledger.

Before forecast approval:

```text
sum(forecast outflows) = total forecast-to-complete
```

This reconciliation prevents an approved EAC from carrying a forward cost forecast that is not time-phased into the cash plan.

Forecast inflow may not exceed project forecast revenue. Future finance expansion may refine inflow timing using invoice/valuation/payment forecasts, but it must not turn these planning lines into transaction truth.

## Authority and segregation of duties

Project financial information remains more confidential than ordinary project collaboration.

Access requires:

- active organisation membership;
- active project membership;
- `project.view` within the project scope;
- the relevant financial-control permission;
- ownership by the active organisation for workforce/commercial confidentiality.

Permissions introduced by this slice:

- `commercial.forecast.view`;
- `commercial.forecast.manage`;
- `commercial.forecast.approve`;
- `commercial.cash_flow.manage`.

Default role policy deliberately separates preparation and approval:

- Owner / Administrator / Manager: view, prepare, cash-flow plan and approve;
- Finance/Commercial: view, prepare and cash-flow plan, but no default approval;
- Read Only: view;
- Member/Professional and Field Worker: no default financial-forecast access.

Explicit member permission overrides remain authoritative through `PermissionService`.

## Currency

A governed forecast requires one reporting currency across the project facts included at cut-off.

NuBlox does not silently convert currency. Projects containing multiple financial currencies remain visible in the live position but forecast creation is blocked until an explicit FX policy/snapshot architecture is introduced.

## Audit and correction semantics

Material lifecycle events append audit evidence:

- `commercial.reporting_period.created`;
- `commercial.forecast.created`;
- `commercial.forecast.approved`;
- `commercial.reporting_period.closed`;
- `commercial.reporting_period.reopened`.

Draft FTC and cash-flow planning remain editable while the forecast is draft. Approval locks the controlled historical snapshot. Corrections after approval require a new forecast version or period reopening under authority; source financial facts retain their own additive correction/reversal rules.

## UX

`/projects/[projectPublicId]/financials` provides a project-context workspace with:

- live as-of project cost position;
- classification quality gates;
- cost-code drill-through for budget, commitment, actual and remaining commitment;
- reporting-period control;
- versioned forecast creation;
- editable draft FTC and commentary;
- EAC, variance, margin and margin percentage;
- time-phased cash inflow/outflow;
- cash-to-FTC reconciliation;
- controlled forecast approval and period close/reopen.

The existing `/commercial/cost-control` workspace remains the source workflow for cost-code, budget, commitment allocation and commercial-change control. The project Financials workspace is the integrated project-controls view, not a replacement source ledger.

## Acceptance proof

The real-MySQL integration test demonstrates:

- live control budget and direct actual derivation from canonical facts;
- owner-organisation financial containment from external project participants;
- reporting-period creation;
- transactional forecast snapshot creation;
- initial FTC/EAC/margin calculation;
- preparer versus approver segregation of duties;
- cash outflow reconciliation blocking approval;
- reconciled forecast approval;
- immutability after approval;
- reporting-period close/reopen;
- audit evidence.

Playwright acceptance demonstrates the browser path from project creation and approved budget through reporting period, forecast snapshot, reconciled cash flow and forecast approval.
