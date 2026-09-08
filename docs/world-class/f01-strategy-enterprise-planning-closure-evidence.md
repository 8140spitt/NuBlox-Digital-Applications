# F01 — Strategy & Enterprise Planning closure evidence

**Status:** Merge-candidate evidence; F01 remains open until PR #133 is merged and the merged `main` commit passes Complete System Validation.

## Scope

This evidence closes the implementation and proof gap across all eight canonical F01 sub-functions:

- F01.01 Vision & purpose
- F01.02 Environmental analysis
- F01.03 Strategic planning
- F01.04 Business planning
- F01.05 Operating model
- F01.06 Goal & KPI management
- F01.07 Strategic review
- F01.08 Scenario & foresight planning

## Continuous enterprise thread

The governing F01 browser proof executes one business thread through:

`Purpose/Vision → Strategy → Objective → Business Plan → Initiative/Resource envelope → Initiative milestone → Target Operating Model → KPI/Target → canonical Finance Actual → Variance → Corrective Action → Forecast → Strategic Review → Scenario/Foresight`

The final closure tranche deliberately removes a false seam that previously allowed a user to type an actual value while merely labelling it as a canonical finance source.

## Canonical actual rule

A KPI configured with `source_mode = canonical` cannot accept a user-entered actual through the strategy owner service. Its actual must be resolved by a source-domain provider.

The first supported provider is Finance / Accounting Profit & Loss:

- authoritative source domain: `finance`
- authoritative record type: `accounting_profit_and_loss`
- source identity: accounting period public ID
- measures: period/YTD revenue, expenses, profit and profit-margin percentage
- source computation: journal-derived accounting reporting, not a copied strategy ledger
- access: the caller must also have the applicable Finance and Accounting reporting authority
- evidence: append-only KPI observation, attributable audit event and outbox event
- replay: unchanged canonical evidence is idempotent
- drill-through: the KPI observation links directly to the selected accounting report, which retains account → journal → originating business-source drill-through

This establishes the governing ownership boundary: Strategy owns targets, management forecasts, variance/action/review and scenarios; Finance owns the accounting fact used as the actual.

## Native-domain composition

- **D8** — strategy, planning and enterprise performance ownership
- **D7** — authoritative accounting fact provider
- **D19** — workflow, evidence and drill-through
- **D1** — organisation membership and accountability context

Completion of F01 does not imply that every capability in D8 is complete; treasury, broader management accounting and other D8 outcomes remain governed by their own function/value-stream evidence.

## SAP benchmark pressure

This tranche materially advances the enterprise-performance outcomes represented by:

- BPC — governed business planning, targets, forecasts and scenario foundations; consolidation remains a separate finance gap
- SEM — strategy, objectives, KPI performance, variance/action and executive review
- SEM-IP — integrated planning/forecast/scenario foundations
- FI / S/4HANA Finance adjacency — canonical accounting actual and report/source drill-through

The SAP references remain benchmark labels rather than NuBlox module boundaries.

## Automated proof

Merge acceptance requires the exact PR head to pass Complete System Validation, including formatting/lint, migration/schema validation, generated types, the full real-MySQL integration suite, Svelte/TypeScript validation, unit/component tests, production build and Playwright E2E.

The closure-specific database proof verifies that a 1,000,000 revenue fact and 902,500 expense fact produce 97,500 profit and a 9.75% operating-margin KPI actual from canonical accounting reporting, that repeated unchanged refresh is idempotent, and that a forged canonical actual is rejected.

The closure-specific browser proof verifies the complete F01 thread, including the funded initiative milestone and target operating-model change, and navigates from the 9.75% strategy KPI observation back to the accounting report that produced the fact.

## Closure gate

Issue #124 may be closed only after:

1. PR #133 exact-head Complete System Validation is green;
2. PR #133 is merged to `main`;
3. the merge commit's Complete System Validation is green;
4. the F01 function-capability map and SAP benchmark current-state evidence reflect the delivered capability; and
5. repository hygiene is restored to zero open pull requests and only `main` remotely.
