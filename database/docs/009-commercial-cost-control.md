# 009 — Commercial Cost Control Domain Model

## 1. Purpose

This specification defines NuBlox Schema Package 009: project commercial control, cost coding, budgets, cost/revenue classification, commercial variations, valuations and point-in-time forecasting.

The governing rule is:

> **Commercial control classifies and interprets authoritative source facts; it does not create a second editable ledger containing copies of them.**

Package 009 therefore links to procurement, workforce, finance and project-information records wherever those domains already own the underlying transaction/evidence.

## 2. Scope

Package 009 covers:

- project cost-code structures;
- approved/versioned project budgets;
- budget adjustments and transfers;
- allocation of issued PO lines to cost codes;
- allocation of approved labour-cost snapshots to cost codes;
- allocation of issued customer financial-document lines to cost codes for value/revenue analysis;
- direct/manual project cost facts not represented by another NuBlox source domain;
- project change-event to commercial-variation conversion/linkage;
- client/revenue-side and supplier/cost-side variations;
- versioned variation submissions and decisions;
- contract-amendment / PO-version implementation linkage;
- interim valuation/application/certification records;
- valuation adjustments such as retention, contra, materials-on-site and other deductions/additions;
- reporting periods;
- approved historical commercial forecasts;
- budget, commitment, actual, forecast-to-complete and change exposure snapshots for reproducible reporting.

Package 009 does **not** introduce:

- a statutory general ledger;
- supplier accounts payable / supplier invoices;
- payroll;
- bank reconciliation;
- duplicate copies of PO, receipt, timesheet, invoice or credit-note transactions.

Those capabilities may later integrate with accounting systems or be introduced in a dedicated finance expansion package.

## 3. Dependencies

Package 009 depends on Packages 001–008, particularly:

- `projects` and organisation membership;
- estimates and estimate cost components;
- contracts and contract amendments;
- financial documents/items;
- purchase orders, PO versions/items and receipts;
- timesheets and approved `timesheet_entry_cost_snapshots`;
- project change events;
- controlled project information where commercial evidence is linked.

## 4. Normalisation target

The domain targets **3NF by default**.

Key rules:

1. A project cost code is stored once and referenced by commercial facts.
2. A budget has stable identity; approved budget versions are immutable historical versions.
3. Budget adjustments are separate transactions; the approved baseline is not overwritten.
4. PO commitment values remain PO facts. Cost-code allocations classify them.
5. Labour actual costs remain approved timesheet-cost snapshot facts. Cost-code allocations classify them.
6. Customer invoice/credit-note values remain financial-document facts. Value allocations classify them.
7. A commercial variation has stable identity; submissions/revisions are immutable versions.
8. Project change events remain neutral source events and are linked to commercial variations rather than converted in place.
9. A valuation/application/certificate is a point-in-time commercial fact; current-period value is derived from cumulative records where policy permits.
10. Forecast snapshots are intentional historical duplication: they preserve the information and management judgment approved at a reporting cut-off.
11. No universal `entity_type/entity_id` polymorphic link is introduced for canonical commercial relationships.
12. Monetary values use `DECIMAL`, never binary floating-point.

## 5. Cost-code structure

`project_cost_codes` provides the internal cost breakdown structure for a project.

A cost code belongs to one NuBlox organisation and one project and may optionally have a parent cost code.

Example:

```text
01 Preliminaries
02 Substructure
03 Superstructure
   ├── 03.01 Structural steel
   ├── 03.02 Concrete
   └── 03.03 Carpentry
04 MEP
   ├── 04.01 Electrical
   └── 04.02 Mechanical
```

Cost codes are classification/master data. They do not themselves contain budget, committed or actual balances.

Current values are derived from linked commercial/source records.

## 6. Cost categories

Each project cost code may reference a controlled `commercial_cost_category`, initially including:

- labour;
- material;
- plant;
- subcontract;
- professional fee;
- overhead;
- preliminaries;
- contingency;
- other.

A project may use its own code hierarchy while the category provides consistent high-level reporting.

## 7. Project budgets

`project_budgets` is the stable budget identity.

`project_budget_versions` stores controlled versions such as:

```text
Budget BUD-001
├── Version 1 — approved initial baseline
├── Version 2 — later re-baseline if formally authorised
└── Version 3 — later re-baseline if formally authorised
```

Budget lines reference project cost codes and carry the approved planned amount.

Approved/superseded budget versions are immutable through normal APIs.

Normal commercial change does **not** rewrite the baseline. It is captured through `project_budget_adjustments`.

## 8. Estimate-to-budget traceability

Budget lines may link to one or more `estimate_item_cost_components`.

This provides traceability such as:

```text
Estimate cost component
        ↓
Approved project budget line
        ↓
Project cost code
```

The budget value remains an approved commercial fact. The link explains its origin and does not make the live estimate the budget source of truth after approval.

## 9. Budget adjustments

Approved budget movement uses:

- `project_budget_adjustments`;
- `project_budget_adjustment_items`.

Adjustment types include:

- approved variation;
- internal budget transfer;
- contingency release;
- authorised correction;
- reallocation;
- other.

Adjustment items may be positive or negative.

For an internal transfer, domain policy normally requires the total movement to net to zero.

Control budget is therefore derived conceptually as:

```text
approved baseline budget
+ approved budget adjustments
= current control budget
```

## 10. Procurement commitment allocation

Package 005 remains authoritative for purchase orders and receipts.

`purchase_order_item_cost_allocations` assigns issued PO line value to one or more project cost codes.

For an issued PO item:

```text
PO net line value
= quantity × unit rate
```

Allocation values must sum to the authoritative PO line net value according to the organisation's rounding policy.

Commercial commitment is derived from the effective issued PO version, excluding superseded/cancelled versions according to lifecycle rules.

Received/incurred value can be derived from confirmed receipt quantity × authoritative PO item rate, classified using the PO item's cost-code allocation.

No duplicate editable `committed_cost` balance is stored.

## 11. Labour actual-cost allocation

Package 006 remains authoritative for approved labour cost.

`timesheet_cost_code_allocations` allocates an immutable `timesheet_entry_cost_snapshot` to one or more project cost codes.

Allocation amounts must sum to the source cost snapshot.

Changing a worker's current rate must never alter historical commercial actuals.

## 12. Revenue/value allocation

Package 004 remains authoritative for customer invoices and credit notes.

`financial_document_item_value_allocations` assigns a customer financial-document line to project cost codes for project-value / CVR analysis.

The financial document remains authoritative for issued value. A credit note contributes negative value in reporting according to document kind; Package 009 does not rewrite the source amount.

## 13. Direct project costs

Some project costs may not originate from an existing NuBlox transaction—for example a manual accrual, petty-cash cost, imported accounting adjustment or historic opening balance.

`project_direct_costs` is the authoritative source only for these genuinely external/manual cost facts.

A posted direct cost is corrected by an explicit `project_direct_cost_reversal`, never by silently editing the original amount.

Where a future accounting/AP integration becomes authoritative, imported records should carry source-system identifiers and idempotency controls rather than becoming uncontrolled duplicates.

## 14. Commercial variations

A `commercial_variation` is the stable identity of a commercial change/claim/quotation event.

It has a commercial side:

- `revenue` — client/upstream change;
- `cost` — supplier/subcontract/downstream change;
- `internal` — internal commercial adjustment or exposure.

Revenue-side variations may be related to a client contract.

Cost-side variations may be related to a purchase order.

The stable variation record is separate from submitted versions:

```text
Variation V-012
├── Version 1 — issued £10,000
├── Version 2 — issued £9,500
└── Decision — accepted £9,000
```

Submitted versions and their line items are immutable after issue.

## 15. Change-event linkage

Package 007 `project_change_events` remains the neutral factual change register.

One change event may lead to multiple commercial effects:

```text
Project change event
├── client variation
├── supplier variation
└── internal forecast exposure
```

Conversely, one variation may combine multiple related change events.

The relationship is many-to-many through `commercial_variation_change_events`.

## 16. Variation decisions

Decisions are evidence separate from the issued variation version.

Decision states include:

- accepted;
- partially accepted;
- rejected;
- pending;
- withdrawn.

`commercial_variation_decision_items` may capture accepted/decided value at line level.

Current approved variation value is derived from the effective decision evidence, not copied into the variation header.

## 17. Implementing accepted variations

Accepted commercial change may later be implemented in contractual/procurement records.

Explicit link tables preserve traceability:

```text
commercial variation
    ↓
contract amendment
```

and/or:

```text
commercial variation
    ↓
purchase-order version
```

This avoids pretending the commercial decision and the contractual/order implementation are the same event.

## 18. Valuations / applications / certifications

`commercial_valuations` supports controlled project valuations such as:

- client application;
- client certificate;
- supplier/subcontract application;
- supplier/subcontract certificate;
- internal assessment.

A certificate may reference its source application using `source_application_id`.

Valuation items normally store cumulative/gross assessed value to date. Current-period movement can then be derived from the previous effective valuation for the same context.

The schema does not overwrite the earlier application when a different amount is certified.

## 19. Valuation context

A valuation may have one commercial context:

- client/upstream contract through `contract_valuations`;
- supplier/downstream purchase order through `purchase_order_valuations`;
- internal assessment with no external context subtype.

Domain policy validates the valuation kind against its context.

## 20. Valuation adjustments

`commercial_valuation_adjustments` captures explicit additions/deductions such as:

- retention;
- contra charge;
- materials on site;
- advance payment recovery;
- previous over/under certification;
- other adjustment.

These remain separate from measured work items so the commercial meaning is preserved.

## 21. Reporting periods

`commercial_reporting_periods` defines project commercial cut-offs.

Typical use:

```text
2026-08 monthly period
2026-09 monthly period
2026-10 monthly period
```

A period may be open, closed or reopened under controlled policy.

Closing a reporting period does not freeze source operational records globally; it controls which source facts and adjustments belong to a commercial reporting cut-off.

## 22. Forecasts

A `commercial_forecast` is a point-in-time management judgment for a reporting period.

Each forecast line is by project cost code and preserves approved snapshot values such as:

- control budget at cut-off;
- actual cost at cut-off;
- remaining commitment at cut-off;
- approved change value at cut-off;
- pending change exposure at cut-off;
- forecast-to-complete amount.

Forecast final cost is derived conceptually as:

```text
actual cost snapshot
+ forecast-to-complete
= forecast final cost
```

Remaining commitment is retained as decision context and must not automatically be added again if forecast-to-complete already includes it.

The approved forecast also stores project-level forecast revenue as an intentional snapshot so historical margin reporting remains reproducible.

## 23. Historical snapshot exception

Forecast lines intentionally snapshot values that may also be derivable from current source records.

This is a valid normalisation exception because the fact being stored is not "the current actual cost". It is:

> "the actual/control/commitment/change value that formed part of this approved forecast at this specific reporting cut-off."

The live/current source remains the underlying PO, receipt, timesheet, invoice, variation and budget records.

## 24. Derived commercial measures

The following are normally derived and are **not** independent editable columns:

- original budget total;
- current control budget;
- current PO commitment;
- incurred receipt value;
- labour actual cost;
- total actual cost;
- invoiced value;
- approved variation total;
- pending variation exposure;
- forecast final cost;
- cost variance;
- forecast margin;
- margin percentage;
- current-period valuation amount from cumulative valuation records.

Reporting projections/materialised summaries may later cache these measures, but they must not become competing sources of truth.

## 25. Currency

Budgets, variations, valuations, direct costs and forecasts carry explicit ISO currency codes where money is recorded.

The baseline does not silently convert currencies.

Cross-currency project reporting requires an explicit future FX-rate/snapshot policy.

## 26. Security and confidentiality

Commercial data is typically more restrictive than ordinary project collaboration data.

Project participation alone must **not** grant access to:

- budgets;
- worker cost allocations;
- supplier rates;
- margin;
- forecasts;
- client/supplier variation values;
- valuation/certification amounts.

Effective capability, organisation and project permission checks remain mandatory.

## 27. Lifecycle rules

Examples:

```text
Budget version:
draft → approved → superseded
      ↘ cancelled

Budget adjustment:
draft → submitted → approved
                  ↘ rejected
       ↘ cancelled

Variation version:
draft → issued → superseded
             ↘ withdrawn

Valuation:
draft → submitted → assessed/certified → closed
      ↘ cancelled

Forecast:
draft → approved → superseded
      ↘ cancelled
```

Every privileged transition must be auditable.

## 28. Application invariants

The application/domain layer must enforce and test:

1. Every cost code belongs to the same project/tenant as the commercial record using it.
2. Cost-code parent relationships cannot cross projects and cannot form cycles.
3. Approved/superseded budget versions are immutable.
4. An approved budget must have valid lines and one currency.
5. Budget adjustment internal transfers must satisfy configured balancing policy.
6. PO cost-code allocations must classify only PO items belonging to the same project.
7. Active allocations for an issued PO item must reconcile to its authoritative net line value under the configured rounding policy.
8. Timesheet cost-code allocations must reference a timesheet entry/cost snapshot for the same project and must reconcile to the cost snapshot amount.
9. Financial-document value allocations must reference a document item for the same project and reconcile to the source line value.
10. Posted direct costs are immutable; corrections use reversals.
11. A commercial variation must reference only project change events from the same project.
12. Contract/Purchase Order context must match the variation's project and organisation.
13. Issued variation versions/items are immutable.
14. Variation decision items must belong to the decided variation version.
15. Accepted variation implementation links must not cross unrelated contracts/POs/projects.
16. Valuation source applications, contract/PO contexts and items must remain within the same project/tenant.
17. Certification does not rewrite the submitted application.
18. Closed reporting periods require privileged reopening.
19. Approved forecasts and their snapshot lines are immutable.
20. Forecast snapshots are created transactionally from a coherent commercial cut-off and carry audit/outbox evidence.
21. All monetary arithmetic uses `DECIMAL` and explicit organisation rounding policy.
22. Commercial confidentiality must be enforced independently from general project collaboration visibility.

## 29. Package boundary

Package 009 deliberately stops before the built-asset/facilities hierarchy.

Package 010 will introduce assets, systems, spaces, maintenance and lifecycle service records while reusing project/site/document/workforce/commercial foundations from Packages 001–009.
