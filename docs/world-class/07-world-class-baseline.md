# 07 — World-Class Baseline

**Status:** Current-state product baseline  
**Baseline date:** 27 August 2026  
**Important:** this document records an observed baseline and must not be treated as a permanent architecture invariant.

## 1. Current capability maturity

The live capability registry currently classifies the 19 native domains as:

- **3 operational** — enterprise/identity/master data; CRM/business development; data/workflow/analytics/search/intelligence;
- **13 partial** — materially implemented but incomplete against the domain contract;
- **3 planned** — materials/inventory/logistics; production/fabrication; sustainability/carbon.

The maturity registry in `app/src/lib/navigation/capability-registry.ts` remains the executable source for current classifications. The finer-grained World-Class readiness assessment is maintained in [`10-capability-control-matrix.md`](10-capability-control-matrix.md).

## 2. Proven runtime chains

The implementation runtime map currently documents four coherent operational chains:

1. **Lead-to-cash** — CRM → estimate → quote → contract → project → invoice → payment/allocation.
2. **Procure-to-pay** — procurement package → RFQ → PO → receipt → commercial valuation boundary.
3. **Project-to-profit** — budget → commitments/actuals → reporting periods → forecast/EAC → cash-flow control.
4. **Asset-to-maintain** — facilities/assets → reactive/planned maintenance → work orders → service/compliance evidence.

These chains are valuable product foundations. They are not yet proof of the complete target-state operating system.

## 3. Strong foundations to preserve

The rebaseline should preserve and build on:

- modular-monolith domain boundaries;
- canonical relational records and database constraints;
- Better Auth identity/session integration;
- tenant/organisation/project scoping;
- granular server-authoritative permissions;
- Work Kernel, notifications, search and personal contexts;
- audit/event evidence for material transitions;
- versioned/issued/approved history rather than destructive mutation;
- real-MySQL integration tests and browser acceptance;
- CRM → estimate → quote → contract → project commercial progression;
- project-controls hierarchy, WBS/schedule, resources, progress/EVM, financial forecasting, RIDA and controlled change;
- CDE/information-container foundations;
- asset/facility/maintenance foundations.

## 4. Largest strategic gaps

### A. One continuous digital thread is not yet proven

The major implemented chains are documented separately. The target state requires continuity across them.

The largest junction to prove is:

```text
Project delivery
→ design/information baseline
→ construction/installation evidence
→ commissioning
→ handover
→ installed asset configuration
→ operation/maintenance
```

### B. Complete enterprise ERP depth remains uneven

Material gaps still include areas such as:

- full AP and supplier-payment lifecycle;
- bank/cash/reconciliation depth;
- fixed assets/localisation/intercompany/consolidation;
- complete HCM/employment/payroll;
- inventory/warehouse/logistics;
- production/fabrication;
- enterprise strategy/performance and broader governance depth.

### C. Built-environment depth remains uneven

Material gaps include:

- deeper estimating/take-off/tender governance;
- full design/BIM/openBIM/model-object coordination;
- construction work-package/production control;
- field/mobile/offline execution depth;
- complete QHSE/environmental workflows;
- commissioning/handover/golden-thread controls;
- property/lease/occupancy and advanced FM;
- sustainability/carbon.

### D. Experience quality trails control depth

The current UX friction review identifies:

- full-page round trips after many actions;
- dense multi-form workspaces;
- limited progressive enhancement;
- expensive shared-layout work;
- a procurement N+1 query pattern.

Experience debt should now be treated as product debt.

## 5. Governance drift corrected by the rebaseline

The 27 August rebaseline identified several programme-control inconsistencies and corrected them:

- PR #94 established `docs/world-class/` as the product-strategy and delivery authority while preserving the bottom-up architecture as the engineering authority;
- GitHub issue #58 was rewritten around the nine value streams and three golden reference journeys rather than the superseded architecture sequence;
- completed project-controls foundations, including RIDA and controlled cross-domain change, are now recorded in the live programme;
- root README language now distinguishes target-state ambition from implemented maturity;
- PR #92 was returned to Draft for deliberate reassessment against Journey B before merge;
- the enterprise taxonomy is explicitly governed as a completeness/operating-model catalogue rather than a 1,510-item feature backlog;
- [`10-capability-control-matrix.md`](10-capability-control-matrix.md) now provides the evidence-led 19-domain × value-stream × reference-journey baseline used for prioritisation.

This section records the correction because governance drift itself is an important product risk. Future mismatches between roadmap, capability registry, implementation and product claims should be treated as defects in programme control.

## 6. Baseline verdict

NuBlox is **not off track at the architectural core**. It has a strong controlled enterprise foundation and several substantial vertical chains.

It is **off track if delivery continues to optimise individual capability slices without proving enterprise value streams, digital-thread continuity and user experience quality**.

The reset therefore changes the delivery question from:

> “Which capability box do we implement next?”

To:

> “Which end-to-end customer outcome is currently broken, incomplete or too cumbersome, and what is the smallest architecturally complete tranche that materially improves it?”
