# Project progress measurement and earned-value foundations

NuBlox treats progress and earned value as governed project-controls facts built on the canonical project plan and project financial-control domains. This capability does not create a second schedule, budget or accounting ledger.

## Canonical boundary

- `project_plan_activities` remains the current project-controls activity record.
- `project_plan_baselines` and `project_plan_baseline_activities` remain immutable schedule snapshots.
- approved project budget versions and approved budget adjustments remain the control-budget source.
- procurement receipts, labour cost snapshots and posted project direct costs remain actual-cost sources.
- `project_progress_periods` records the controlled project data date and progress workflow.
- `project_activity_progress_measurements` records activity progress observations for a period.
- `project_earned_value_baselines` freezes a control-budget total against an immutable schedule baseline.
- `project_earned_value_baseline_allocations` distributes that frozen budget at completion (BAC) to immutable schedule-baseline activities.

The project workforce `/schedule` surface remains operational workforce scheduling and is not used as the project-controls baseline.

## Progress workflow

Progress periods transition:

`open → submitted → approved`

Only open periods can be edited. Submission requires at least one measurement. Approved periods are immutable official progress facts; later corrections are recorded in a later period. A reduction from the latest approved percentage is treated as a correction and requires commentary.

Supported measurement methods are:

- physical/manual percentage;
- 0/100 milestone rules;
- 50/50 rules;
- quantity-based progress, where percentage is derived from measured quantity complete / total quantity.

Progress greater than zero requires an actual start. Progress at 100% requires an actual finish and zero remaining duration. Actual dates cannot be later than the period data date.

## Performance measurement baseline

An earned-value baseline references one immutable schedule baseline and freezes the current single-currency control budget at creation. The draft baseline is then allocated across the source schedule-baseline activities.

Approval requires:

1. a positive frozen control budget;
2. at least one activity allocation;
3. total allocated BAC to equal the frozen control-budget snapshot exactly.

Approval makes the baseline immutable and supersedes the previously approved performance baseline. The underlying schedule baseline and financial source facts are not modified.

## Earned-value semantics

For a selected data date:

- **BAC** = sum of approved performance-baseline activity allocations.
- **PV** = time-phased BAC from the immutable schedule-baseline dates. Activities use a linear daily spread; milestones use 0/100 at the baseline milestone date.
- **EV** = BAC × the latest approved activity progress at or before the data date.
- **AC** = canonical project financial-control actual cost at the data date.
- **SV** = EV − PV.
- **CV** = EV − AC.
- **SPI** = EV / PV when PV is non-zero.
- **CPI** = EV / AC when AC is non-zero.

NuBlox does not introduce a competing statistical EAC here. The governed commercial forecast remains the canonical forecast-at-completion process; earned value supplies performance evidence that can inform that forecast.

## Authority and confidentiality

Server-authoritative permissions are:

- `project.progress.view`
- `project.progress.manage`
- `project.progress.approve`
- `project.progress.baseline.manage`

All access still requires active project membership and `project.view`. Mutations are restricted to the project's owning organisation. Monetary earned-value information additionally requires owner-side commercial financial visibility; external project participants may be allowed to view approved progress without being able to infer BAC, PV, EV, AC, CPI or cost variance.

This preserves `Career ≠ Organisation Role ≠ Project Role ≠ Permission` and prevents a project progress permission from becoming a financial-data disclosure path.

## Audit and correction semantics

Audit events are written for period creation/submission/approval, progress recording/correction, performance-baseline creation/allocation and baseline approval. Approved progress periods and approved performance baselines are immutable. Corrections are represented by later controlled facts rather than destructive edits to approved history.

## Validation

The slice is covered by real-MySQL integration tests for:

- project and tenant containment;
- performance-baseline reconciliation;
- controlled period state transitions;
- approved-progress immutability;
- PV/EV/AC, SV/CV and SPI/CPI calculations;
- external financial confidentiality.

Playwright acceptance exercises the project → WBS/activity → schedule baseline → progress period → measurement → submit → approve workflow in the browser.
