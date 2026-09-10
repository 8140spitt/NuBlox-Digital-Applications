# SAP Benchmark Coverage in the World-Class NuBlox Rebaseline

**Status:** Governing enterprise-completeness benchmark and delivery-control input  
**Effective:** 27 August 2026  
**Reaffirmed:** 6 September 2026  
**Source register:** [`../sap-capability-coverage-register.csv`](../sap-capability-coverage-register.csv)

## 1. Reaffirmation

NuBlox is still being built to become a complete enterprise operating system for organisations that create, deliver, own and operate the built environment. The 64-line SAP capability register remains a mandatory outside-in completeness benchmark for that ambition.

The benchmark is reaffirmed because recent delivery has demonstrated a risk that technically valuable horizontal work can become detached from the enterprise and built-environment outcomes the product is meant to deliver. Access control, testing, platform and architecture work remain essential, but they must normally be justified by the active enterprise value stream, reference journey or benchmark gap they unblock.

The governing question is therefore not whether NuBlox has an SAP-named module. It is:

> **Could a sophisticated organisation perform the materially relevant enterprise outcome represented by this SAP benchmark natively in NuBlox, with equal or better continuity into projects and built assets?**

If the answer is no, the capability remains a material product gap unless it is explicitly classified as a contextual sector extension.

## 2. What the SAP benchmark is and is not

The register is an **outside-in enterprise completeness control**. It prevents NuBlox from becoming a strong construction application with an underpowered enterprise back office.

SAP product/module names are benchmark labels only. NuBlox does not copy SAP module boundaries. Capability is owned by the 19 native domains and delivered through the nine enterprise value streams and three golden reference journeys.

The CSV retains the original `nublox_domain`, `current_state` and `target_slice` columns for provenance. They pre-date the World-Class rebaseline and are not governing sequencing fields. The governing columns are now:

- `world_class_priority` — which reaffirmed delivery pressure the row belongs to;
- `governing_streams` — which end-to-end value streams must prove the outcome;
- `governing_journeys` — which golden reference journeys provide browser-level proof where applicable;
- `delivery_treatment` — whether the row is a sequential priority, active stream depth, mandatory cross-cutting control or contextual extension.

## 3. Mandatory delivery rule

From 6 September 2026 every material product tranche and PR must state:

1. the enterprise value stream and reference journey it strengthens;
2. the relevant SAP benchmark row(s) or benchmark family it advances, or explicitly state that no SAP row is materially relevant;
3. the canonical upstream and downstream records involved;
4. the user-visible end-to-end outcome that becomes possible or materially better;
5. the control, reporting, interoperability and automated proof added;
6. the benchmark/current-state evidence that should be updated after merge.

Horizontal work such as RBAC, platform plumbing, test infrastructure, observability or developer tooling should not become an independent product programme unless it is a blocking prerequisite for an active delivery objective or a material assurance requirement.

## 4. Reaffirmed delivery spine

The programme is deliberately sequential. We do not attempt 64 SAP references in parallel. We close coherent enterprise outcomes that satisfy multiple benchmark rows at once.

### P1 — Complete enterprise finance and record-to-report

**Benchmark pressure:** FI, S/4HANA Finance, EFM, CO, Cash Management, TRM, BPC, SEM, SEM-IP and related planning/consolidation capability.

**Target outcome:**

```text
Operational fact
→ AP/AR/cash consequence
→ ledger
→ bank/clearing evidence
→ period close
→ fixed assets/intercompany where relevant
→ consolidation
→ statutory and management reporting
→ drill-through to source evidence
```

NuBlox already has meaningful accounting, receivables, AP, supplier-payment and bank-reconciliation foundations. The remaining benchmark gap is full enterprise finance depth rather than another isolated accounting screen.

F01 Strategy & Enterprise Planning now provides governed strategy-linked business planning, KPI targets and forecasts, strategic review and scenario/foresight foundations. Its closure proof resolves a canonical accounting P&L actual into the strategy KPI and drills back to the accounting report/source thread. This materially advances the BPC, SEM and SEM-IP benchmark outcomes without claiming that consolidation, treasury or the remaining P1 enterprise-finance gaps are complete.

F03 Enterprise Performance Management now extends that canonical KPI thread into governed enterprise execution: versioned performance frameworks, reporting periods and KPI packs, root-cause variance intervention, executive review, comparable-period benchmarks, and measured benefits. F03 snapshots canonical KPI observations for evidence rather than creating a second performance ledger, and preserves cross-domain project/governance references for drill-through. This materially deepens the SEM benchmark while leaving broader analytics, consolidation and treasury gaps explicitly open.

Primary domains: **7, 8, 19**.  
Primary streams: **VS8 Record-to-report**, with VS1 and VS2 consequences.  
Primary proof: **Journey A** plus enterprise reporting evidence.

### P2 — Complete source-to-pay plus materials, inventory and warehouse continuity

**Benchmark pressure:** SLC, SRM, MM, MDG-M, EWM, WM, SCM, TM, SPP and related supply-chain planning capability.

**Target outcome:**

```text
Supplier qualification
→ demand/requisition
→ sourcing
→ order/subcontract
→ receipt
→ material identity and stock consequence
→ issue/return/transfer/site logistics
→ invoice verification
→ AP/payment
→ ledger/project/asset consequence
```

The accounting seam is no longer enough. Domain 10 remains a major planned gap and is required before NuBlox can credibly claim enterprise supply-chain capability.

Primary domains: **9, 10, 7, 19**.  
Primary streams: **VS2 Source-to-pay** and **VS6 Design-to-asset**.  
Primary proof: **Journeys A and B**.

### P3 — Complete design/product/production-to-installed-asset continuity

**Benchmark pressure:** PLM, IPPE, PP, VC plus the design, material, quality, plant and asset consequences represented elsewhere in the register.

**Target outcome:**

```text
Requirement
→ information requirement and design responsibility
→ system/product/configuration definition
→ approved design
→ material/BOM/production or procurement
→ installation
→ inspection/test
→ commissioning
→ handover
→ installed asset configuration
→ warranty/maintenance obligation
```

This is NuBlox's strongest potential differentiator because it joins enterprise product/supply data directly to project delivery and the long-lived built asset.

Primary domains: **6, 10, 11, 13, 14, 15, 19**.  
Primary stream: **VS6 Design-to-asset**.  
Primary proof: **Journey B**.

### P4 — Complete hire-to-retire and workforce cost continuity

**Benchmark pressure:** HCM, TAM, MRS and Travel Management.

**Target outcome:**

```text
Person
→ employment/position
→ competence
→ mobilisation/capacity
→ schedule/time/attendance
→ leave/expenses/payroll
→ project/service actual cost
→ utilisation/performance
→ exit
```

Primary domains: **12, 5, 7, 19**.  
Primary streams: **VS5 Hire-to-retire** and VS4.  
Primary proof: **Journeys A/B/C where workforce consequences occur**.

### P5 — Complete enterprise data, integration, analytics and operations

**Benchmark pressure:** BI, DS, EM, PI, NetWeaver, Predictive Analytics, SolMan, TDMS, UX and Xapps.

**Target outcome:** governed semantic data and KPIs; cross-domain analytics and drill-through; versioned APIs/events/webhooks; governed import/export and migration; observability and administrative operations; controlled environment/test data; permission/provenance-aware automation and intelligence.

Primary domain: **19** with Domain 1 governance and source-domain ownership.  
Primary streams: **all**.  
Primary proof: **all three journeys plus operational evidence**.

P5 is not permission to disappear into platform engineering. Platform work must demonstrate how it enables or proves P1–P4 and the active value stream.

## 5. Benchmark families mapped to NuBlox

| SAP benchmark family | Representative references | Primary NuBlox domains | Primary value streams | World-Class interpretation |
| --- | --- | --- | --- | --- |
| Enterprise identity, master data and governance | MDG, MDG-M, MDG-S, GRC | **1**, 9, 10, 14, 19 | All; especially VS2, VS8, VS9 | Canonical masters and stewardship; business governance framework/bodies/DoA/decisions/policy/ethics; access delegation, SoD, access review and assurance. |
| CRM, sales, pricing and customer service | CRM, SD, RTOM, CC, CS, ICM | **2, 3, 4, 17**, 7, 19 | **VS1 Customer-to-cash** | Customer → opportunity → offer/contract → service/revenue continuity. |
| Finance, controlling, treasury and enterprise performance | FI, S/4HANA Finance, EFM, CO, CM, TRM, BPC, SEM, SEM-IP, FM | **7, 8, 19** | **VS8**, VS3, VS1, VS2 | Accounting, planning, cash/liquidity, profitability, close/consolidation and drill-through. |
| Procurement and supplier management | SLC, SRM, MM, S/4HANA Supply Chain | **9, 10**, 7, 19 | **VS2**, VS6 | Supplier onboarding → sourcing → order → receipt → verification/AP → payment/ledger. |
| Supply-chain planning, inventory, warehouse and transport | APO, IBP, SCM, EWM, WM, TM, SPP, GTS | **9, 10, 11, 15, 19** | **VS2**, **VS6** | Demand/supply, stock, stores, traceability, logistics and site/asset consequences. |
| Product engineering, PLM and production | IPPE, PLM, PP, VC | **6, 10, 11, 19** | **VS6** | Requirement/product/system/configuration → BOM/production/procurement → installation → handed-over asset. |
| Portfolio, programme and project controls | PPM, PS | **5, 8, 19** | **VS4**, VS3, VS9 | Portfolio/programme/project, WBS, schedule, resources, progress, cost, risk and controlled change. |
| People, HCM and multi-resource planning | HCM, TAM, Travel Management, MRS | **12**, 5, 15, 17, 19 | **VS5**, VS4 | Employment → competence → capacity/time/payroll → project/service cost and performance. |
| Quality, EHS and compliance | QM, EHS, GRC | **14**, 12, 13, 18, 19 | **VS9**, VS6, VS7 | Inspection/test/quality/safety/environment/control evidence across delivery and operations. |
| Assets, plant, fleet, maintenance and service | EAM, PM, VMS, CS, SPP | **15, 17**, 10, 12, 19 | **VS7** | Installed asset → work/parts/labour/cost → condition/reliability → renewal/retirement. |
| Property and real estate | RE, RE-FX | **16**, 8, 17, 19 | **VS7**, VS3 | Property/space/lease/occupancy/FM and enterprise performance. |
| Data, integration, workflow, analytics and platform operations | BI, DS, EM, NetWeaver, PI, Predictive Analytics, SolMan, TDMS, UX, Xapps | **19**, 1 plus source domains | All | Semantic data, APIs/events, automation, observability, migration, UX and governed intelligence. |
| Merchant/distribution and sector extensions | POS, Retail, TPM, Oil & Gas | Relevant native domains | Relevant streams | Contextual extensions only where target organisations materially require the semantics. |

## 6. Relationship to the 19-domain control matrix

The SAP register and World-Class control matrix are complementary controls:

| Artefact | Governing question |
| --- | --- |
| SAP coverage register | What mature enterprise capability might NuBlox otherwise overlook? |
| 19-domain control matrix | Where is NuBlox currently strong or weak and which digital thread is incomplete? |
| 29-function enterprise taxonomy | What work does a complete enterprise perform? |
| Platform coverage contract | Which software-category outcomes must the one NuBlox product materially subsume? |
| Golden journeys | Does the integrated product actually work end to end? |

A capability is not treated as delivered merely because a table, service or route exists. World-Class evidence must include enterprise depth, control, digital-thread continuity, experience, reporting/intelligence, interoperability where relevant and automated proof.

## 7. Current programme reset

As of 8 September 2026 the Source-to-Pay accounting seam has materially advanced through approved AP → accounting → supplier payment → bank settlement → project-financial drill-through. Access governance already strengthened the GRC benchmark; F02 implementation in PR #135 now adds the distinct corporate-governance layer of approved governance frameworks, board/executive/committee authority, business DoA, quorum-controlled decisions/actions, governed policy and ethics/conflict evidence. F02 remains merge-candidate until its exact-head and merged-`main` validation gates pass.

Those achievements do not close the broader benchmark. The next product work must return visibly to the delivery spine above.

The programme sequence is:

1. **close Journey A / P1 enterprise-finance proof** rather than add more isolated finance controls;
2. **enter P2 materials/inventory/warehouse continuity**, closing the Domain 10 W0 gap;
3. **drive P3 Journey B requirement-to-installed-asset continuity**, including production/fabrication where required;
4. **complete P4 hire-to-retire/workforce cost continuity**;
5. **deepen P5 platform/data capability in service of the active streams and then as an enterprise operations layer**;
6. continue stream-core depth in CRM/commercial/projects/QHSE/assets/property/service where golden journeys expose blocking gaps;
7. implement contextual sector extensions only when a target operating model requires them.

This sequence can be changed only by an explicit programme rebaseline supported by evidence, not by convenience or the availability of an isolated technical task.

## 8. PR and tranche acceptance gate

A material tranche is acceptable only when reviewers can answer all of the following:

- Which benchmark row/family does it advance?
- Which value-stream outcome becomes more complete?
- Which golden journey proves the consequence?
- What canonical records and transaction boundaries are used?
- What downstream project/asset/financial consequences are preserved?
- What control and correction semantics apply?
- What user workflow becomes materially better?
- What reporting or drill-through evidence is available?
- What integration boundary is required, if any?
- What real database and browser proof demonstrates the result?

If the work cannot answer these questions, it is either an explicitly justified prerequisite or it should not displace the active product objective.

## 9. Contextual extensions

Oil & Gas, retail, trade-promotion management, point of sale, funds management, incentive/commission management and convergent charging are not automatically universal core scope. They remain benchmark questions and are implemented only where the underlying operating model is materially relevant.

They must be expressed through canonical NuBlox domains rather than permanent SAP-shaped module boundaries.

## 10. Benchmark success criterion

NuBlox does not succeed by reproducing SAP's catalogue.

It succeeds when the materially relevant enterprise outcomes represented by that catalogue can be performed natively, efficiently and governably while preserving a stronger digital thread across enterprise management, construction delivery and the resulting built asset.

The decisive test remains:

> **Can NuBlox equal or exceed the enterprise capability represented by this SAP benchmark while connecting it more directly to construction delivery and the resulting built asset?**

From this reaffirmation forward, that question is part of delivery control rather than background strategy.