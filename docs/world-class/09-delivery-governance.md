# 09 — Delivery Governance

**Status:** Governing delivery-control model  
**Effective:** 27 August 2026

## 1. Delivery objective

NuBlox development is governed by **customer outcomes and architectural completeness**, not by the desire to make every taxonomy row or capability-domain card appear complete.

## 2. Delivery sequence

Each material tranche should follow this order:

1. select the broken/incomplete value-stream outcome;
2. identify the reference journey it strengthens;
3. trace canonical upstream/downstream records;
4. identify the owning domain service(s) and transaction boundaries;
5. define permission, scope, delegation and segregation rules;
6. define lifecycle, correction and evidence semantics;
7. define the user interaction and measurable experience target;
8. implement the smallest coherent tranche;
9. prove database/service/browser behaviour;
10. update current-state maturity and journey evidence.

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
- architecture/current-state documentation updated.

## 5. Repository governance

### Architecture documents

- Governing architecture contains stable intent/invariants, not temporary completion claims.
- Current implementation observations are dated and explicitly non-permanent.
- Superseded paths must not remain referenced as primary authority.

### GitHub issues

Programme issues should:

- link to current governing product and architecture documents;
- organise work around value streams/reference journeys;
- reflect merged work accurately;
- avoid duplicating detailed implementation truth that belongs in code/tests;
- identify the measurable outcome of the next tranche.

### Pull requests

Every material PR should state:

- value stream/reference journey strengthened;
- canonical boundary and owner service;
- new/changed permissions and lifecycle;
- cross-domain consequences;
- user-experience effect;
- validation evidence;
- maturity/documentation impact.

## 6. Open-work rule

Open PRs created under an older delivery sequence should be reassessed rather than automatically merged or discarded.

For each open PR ask:

1. Is the capability still required by the rebaseline?
2. Does it strengthen a priority value stream/reference journey?
3. Does it preserve canonical boundaries?
4. Is its UX proportionate to its control depth?
5. Is it based on current `main` and current governing architecture?
6. Should it be merged as-is, revised, split, or closed?

PR #92 (project information requirements) is the first candidate for this reassessment.

## 7. Prioritisation rule

Prioritise work that improves the greatest combination of:

- customer/business value;
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
- a roadmap checkbox happens to be next.

## 8. Immediate rebaseline programme

The next delivery-control work should be:

1. reconcile GitHub programme issue #58 with this suite and actual merged work;
2. reassess PR #92 against Journey B and current `main`;
3. create a current value-stream × domain × journey coverage baseline;
4. execute the highest-impact UX-friction tranche across existing high-frequency workflows;
5. establish the golden reference enterprise/project data scenario;
6. prioritise the missing handover → installed asset → operation junction;
7. continue enterprise-depth work in parallel where it strengthens the core streams, particularly source-to-pay, record-to-report and hire-to-retire.

## 9. Governing question

Every substantial development decision should be able to answer:

> **How does this make NuBlox materially better at running the enterprise, delivering the built environment, operating the resulting assets, or preserving the governed thread between them?**

If the answer is unclear, the work is not ready to enter delivery.
