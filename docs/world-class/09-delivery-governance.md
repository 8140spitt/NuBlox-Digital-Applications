# 09 — Delivery Governance

**Status:** Governing delivery-control model  
**Effective:** 27 August 2026  
**Reaffirmed:** 6 September 2026

## 1. Delivery objective

NuBlox development is governed by **customer outcomes, enterprise completeness and architectural completeness**, not by the desire to make every taxonomy row or capability-domain card appear complete.

The SAP capability register is a mandatory outside-in enterprise-completeness benchmark. It does not define NuBlox modules, but material delivery must show which benchmark capability is being advanced or explicitly state why no benchmark row is relevant.

## 2. Delivery sequence

Each material tranche should follow this order:

1. select the broken/incomplete value-stream outcome;
2. identify the reference journey it strengthens;
3. identify the relevant SAP benchmark row(s)/family or record that none is materially applicable;
4. trace canonical upstream/downstream records;
5. identify the owning domain service(s) and transaction boundaries;
6. define permission, scope, delegation and segregation rules;
7. define lifecycle, correction and evidence semantics;
8. define the user interaction and measurable experience target;
9. implement the smallest coherent tranche;
10. prove database/service/browser behaviour;
11. update benchmark/current-state maturity and journey evidence.

This complements the bottom-up architecture design sequence; it does not replace it.

## 3. World-class scorecard

A material capability or process is scored across eight dimensions.

| Dimension | Required question |
| --- | --- |
| Enterprise depth | Can a sophisticated organisation genuinely run this function? |
| Built-environment depth | Does it support materially relevant sector semantics? |
| Digital-thread integration | Are upstream/downstream facts connected without duplicate authority? |
| Control | Are state, permission, SoD/delegation, evidence and correction robust? |
| Experience | Is the workflow fast, understandable, accessible and context-preserving? |
| Reporting & intelligence | Are metrics defined from authoritative facts with drill-through? |
| Interoperability | Can relevant external standards/systems exchange data safely? |
| Validation | Are schema, service, integration, type/build and browser proofs present? |

Suggested maturity interpretation:

- **Planned** — target defined; no coherent native workflow.
- **Foundation** — canonical records or lower-layer semantics exist but user outcome is incomplete.
- **Operational** — a useful controlled end-to-end outcome works natively.
- **Advanced** — substantial enterprise/sector depth, exceptions, reporting and integrations are proven.
- **World-class** — benchmark-competitive depth plus exceptional integration, control and experience are proven in reference journeys.

The code-level capability registry may retain its simpler `planned | partial | operational` states; the richer scorecard is a product-review tool.

## 4. Definition of done for a tranche

A material tranche is not complete until applicable items are satisfied:

- relevant SAP benchmark row/family identified and resulting coverage evidence recorded;
- canonical records/relationships reuse or deliberate schema additions;
- database and service invariants;
- lifecycle/state and correction semantics;
- explicit permission/scope controls;
- approval/work/evidence where required;
- audit/domain/outbox consequences;
- downstream financial/commercial/information effects;
- reporting/search discoverability;
- context-aware accessible experience;
- integration/open-standard boundary where material;
- real database integration tests;
- type/Svelte/unit/build validation;
- browser acceptance for the user journey;
- architecture/current-state/benchmark documentation updated.

A route, table, permission model or service is not sufficient evidence on its own.

## 5. Repository governance

### Architecture documents

- Governing architecture contains stable intent/invariants, not temporary completion claims.
- Current implementation observations are dated and explicitly non-permanent.
- Superseded paths must not remain referenced as primary authority.
- `docs/sap-capability-coverage-register.csv` and `docs/world-class/11-sap-benchmark-coverage.md` are mandatory enterprise-completeness controls alongside the 19-domain matrix.

### GitHub issues

Programme issues should:

- link to current governing product and architecture documents;
- organise work around value streams/reference journeys;
- show which SAP benchmark priorities/families are being advanced;
- reflect merged work accurately;
- avoid duplicating detailed implementation truth that belongs in code/tests;
- identify the measurable outcome of the next tranche.

### Pull requests

Every material PR should state:

- value stream/reference journey strengthened;
- SAP benchmark row(s)/family advanced or `not materially applicable` with reason;
- canonical boundary and owner service;
- new/changed permissions and lifecycle;
- cross-domain consequences;
- user-experience effect;
- reporting/interoperability consequence where applicable;
- validation evidence;
- maturity/benchmark/documentation impact.

## 6. Open-work rule

Open PRs created under an older delivery sequence should be reassessed rather than automatically merged or discarded.

For each open PR ask:

1. Is the capability still required by the rebaseline?
2. Does it strengthen a priority value stream/reference journey?
3. Which SAP benchmark outcome does it advance or enable?
4. Does it preserve canonical boundaries?
5. Is its UX proportionate to its control depth?
6. Is it based on current `main` and current governing architecture?
7. Should it be merged as-is, revised, split, or closed?

## 7. Prioritisation rule

Prioritise work that improves the greatest combination of:

- customer/business value;
- SAP/enterprise-completeness pressure;
- reference-journey continuity;
- enterprise + built-environment depth;
- digital-thread leverage;
- risk/control importance;
- user-frequency/friction improvement;
- reuse across organisation archetypes.

Avoid prioritising work primarily because:

- a taxonomy activity is unmapped;
- a competitor has a named module;
- a planned domain has no route;
- a screen is easy to add;
- a roadmap checkbox happens to be next;
- a horizontal technical concern can be deepened indefinitely without advancing the active product outcome.

## 8. Reaffirmed programme sequence

As of 6 September 2026, the connected Source-to-Pay accounting seam has materially advanced through AP, supplier payment, bank reconciliation and project-financial drill-through. Access governance has also advanced materially through stable access roles, lifecycle windows, SoD, delegated authority and access review.

The programme now returns explicitly to the World-Class/SAP delivery spine:

1. **P1 — close Journey A / enterprise-finance and Record-to-Report proof**: reconcile the existing customer/commercial/project/procurement/finance chain into one browser-level proof and close the remaining enterprise finance gaps that block credible period close, management reporting and source drill-through.
2. **P2 — materials, inventory and warehouse continuity**: introduce the canonical material/product master and stock/receipt/issue/return/transfer/site-logistics execution required to close the Domain 10 W0 gap and make Source-to-Pay materially complete.
3. **P3 — Journey B design/product/production-to-installed-asset continuity**: requirement/design → configuration/BOM/production/procurement → installation/test/commissioning → handover/installed asset.
4. **P4 — Hire-to-Retire and workforce-cost continuity**: employment/position/competence → mobilisation/time/attendance/expenses/payroll → project/service cost/performance → exit.
5. **P5 — data/platform maturity**: semantic/KPI governance, APIs/events/webhooks, integration/migration, observability, controlled environments and governed intelligence in direct support of the active streams, then as a complete enterprise operations layer.
6. Continue CRM/commercial/project/QHSE/asset/property/service depth when a golden journey exposes a blocking gap.
7. Implement contextual sector extensions only where a target organisation operating model requires them.

The sequence can be changed only by an explicit programme rebaseline supported by product evidence.

## 9. Horizontal-work rule

Horizontal controls and platform engineering are first-class requirements, but they are not an unlimited parallel programme.

A horizontal tranche must satisfy at least one of these tests:

- it is a blocking prerequisite for the active P1–P5 objective;
- it closes a material statutory, security, assurance or data-integrity risk;
- it creates reusable proof required across multiple imminent value-stream tranches.

Otherwise it should remain queued behind the active product objective.

## 10. Governing question

Every substantial development decision should be able to answer:

> **How does this make NuBlox materially better at running the enterprise, delivering the built environment, operating the resulting assets, or preserving the governed thread between them — and which benchmark outcome proves that improvement matters?**

If the answer is unclear, the work is not ready to enter delivery.