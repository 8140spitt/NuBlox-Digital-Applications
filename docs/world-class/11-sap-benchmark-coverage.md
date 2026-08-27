# SAP Benchmark Coverage in the World-Class NuBlox Rebaseline

**Status:** Governing benchmark interpretation  
**Effective:** 27 August 2026  
**Source register:** [`../sap-capability-coverage-register.csv`](../sap-capability-coverage-register.csv)

## 1. Purpose

The repository contains a 64-line SAP capability coverage register spanning enterprise ERP, planning, finance, HCM, procurement, supply chain, manufacturing, warehouse/logistics, service, asset/property management, governance and platform capability.

The register remains strategically valuable because it asks a hard enterprise question:

> **Could a sophisticated organisation run the materially relevant enterprise capability represented by this SAP benchmark natively in NuBlox, with equal or better continuity into projects and built assets?**

It is not a NuBlox architecture, module catalogue or delivery plan.

SAP product/module names are benchmark labels. NuBlox capability is owned by the 19 native domains and delivered through the nine enterprise value streams, three golden reference journeys and bottom-up architecture.

## 2. Rebaseline rule

The CSV predates the 27 August 2026 World-Class rebaseline. Three columns are therefore historical rather than governing:

- `nublox_domain` uses the former `E##` domain notation;
- `current_state` was a coarse benchmark judgement made before the World-Class readiness matrix;
- `target_slice` describes the superseded feature-slice sequence.

These fields may be useful as provenance, but **must not be used to sequence new work**.

The governing interpretation is now:

```text
SAP benchmark capability
        ↓
Material enterprise outcome represented
        ↓
NuBlox native domain ownership (1–19)
        ↓
Enterprise value stream(s)
        ↓
Golden reference journey(s), where applicable
        ↓
Current evidence / World-Class readiness
        ↓
Gap that blocks an end-to-end outcome
        ↓
Architecturally complete delivery tranche
```

## 3. What the SAP register contributes

The SAP benchmark is particularly useful for preventing NuBlox from becoming a construction application with an underpowered enterprise back office.

It tests capability that can otherwise be obscured when focusing on projects and assets, including:

- enterprise financial accounting, controlling, treasury, cash and consolidation;
- HCM, time, attendance, travel and workforce planning;
- supplier lifecycle and strategic sourcing;
- material master, inventory, warehouse and logistics execution;
- demand/supply planning and integrated business planning;
- production planning, product/process engineering and variant configuration;
- real-estate and property operations;
- enterprise GRC and master-data governance;
- data integration, event management, analytics, platform operations and extensibility.

That breadth is part of the NuBlox target state.

## 4. Benchmark families mapped to NuBlox

The mapping below replaces any interpretation of SAP module boundaries as NuBlox product boundaries.

| SAP benchmark family | Representative references in the CSV | Primary NuBlox native domains | Primary value streams | World-Class interpretation |
| --- | --- | --- | --- | --- |
| Enterprise identity, master data and governance | MDG, MDG-M, MDG-S, GRC | **1**, 9, 10, 14, 19 | All; especially VS2, VS8, VS9 | Canonical master records, stewardship, duplicate/merge control, delegated authority, SoD and assurance. |
| CRM, sales, pricing and customer service | CRM, SD, RTOM, CC, CS, ICM | **2, 3, 4, 17**, 7, 19 | **VS1 Customer-to-cash** | Customer → opportunity → offer/contract → service/revenue continuity without a separate CX architecture. |
| Finance, controlling, treasury and enterprise performance | FI, S/4HANA Finance, EFM, CO, CM, TRM, BPC, SEM, SEM-IP, FM | **7, 8, 19** | **VS8 Record-to-report**, VS3, VS1, VS2 | Full enterprise accounting, planning, cash/liquidity, profitability, close/consolidation and management drill-through. |
| Procurement and supplier management | SLC, SRM, MM, S/4HANA Supply Chain | **9, 10**, 7, 19 | **VS2 Source-to-pay**, VS6 | Supplier onboarding → sourcing → order → receipt → verification/AP → payment/ledger. |
| Supply-chain planning, inventory, warehouse and transport | APO, IBP, SCM, EWM, WM, TM, SPP, GTS | **9, 10, 11, 15, 19** | **VS2**, **VS6 Design-to-asset** | Demand/supply, stock, stores, traceability, logistics and site/asset supply consequences on one thread. |
| Product engineering, PLM and production | IPPE, PLM, PP, VC | **6, 10, 11, 19** | **VS6 Design-to-asset** | Requirement/product/system/configuration → BOM/production/procurement → installation → handed-over asset. |
| Portfolio, programme and project controls | PPM, PS | **5, 8, 19** | **VS4 Plan-to-perform**, VS3, VS9 | Portfolio/programme/project, WBS, schedule, resources, progress, cost, risk and controlled change. |
| People, HCM and multi-resource planning | HCM, TAM, Travel Management, MRS | **12**, 5, 15, 17, 19 | **VS5 Hire-to-retire**, VS4 | Employment → competence → capacity/scheduling → time/payroll → project/service cost and performance. |
| Quality, EHS and compliance | QM, EHS, GRC | **14**, 12, 13, 18, 19 | **VS9 Risk-to-assurance**, VS6, VS7 | Inspection/test/quality/safety/environment/control evidence through delivery and operations. |
| Assets, plant, fleet, maintenance and service | EAM, PM, VMS, CS, SPP | **15, 17**, 10, 12, 19 | **VS7 Asset-to-retirement** | Installed asset → work/parts/labour/cost → condition/reliability → renewal/retirement. |
| Property and real estate | RE, RE-FX | **16**, 8, 17, 19 | **VS7**, VS3 | Property/space/lease/occupancy/FM and enterprise performance. |
| Data, integration, workflow, analytics and platform operations | BI, DS, EM, NetWeaver, PI, Predictive Analytics, SolMan, TDMS, UX, Xapps | **19**, 1 plus source domains | All | Governed semantic data, APIs/events, automation, observability, migration, UX and permission-aware intelligence. |
| Merchant/distribution and other sector extensions | POS, Retail, TPM, Oil & Gas | Relevant native domains by business semantics | Relevant value streams | Sector overlays only where the underlying enterprise/built-environment semantics genuinely apply. |

## 5. Relationship to the 19-domain control matrix

The SAP register is an **outside-in benchmark**. The World-Class Capability Control Matrix is the **inside-out NuBlox control baseline**.

They answer different questions:

| Artefact | Question |
| --- | --- |
| SAP coverage register | What mature enterprise capability might NuBlox otherwise overlook? |
| 19-domain control matrix | What does NuBlox own today, how mature is it and which thread is incomplete? |
| 29-function enterprise taxonomy | What work does a complete enterprise perform? |
| Platform coverage contract | Which market software categories must the one NuBlox product materially subsume? |
| Golden journeys | Does the product actually work end to end? |

None should replace another.

## 6. SAP benchmark pressure by current NuBlox readiness

The current control matrix shows the following high-value pressure points where SAP benchmarking reinforces existing rebaseline priorities.

### Priority 1 — complete enterprise finance and record-to-report

SAP FI, S/4HANA Finance, CO, Cash Management, TRM, BPC and SEM expose the remaining gap between NuBlox's strong accounting/project-financial foundations and complete enterprise finance.

The material NuBlox outcome is not “implement FI”. It is:

```text
Operational fact
→ accounting consequence
→ AP/AR/cash
→ ledger
→ period close
→ consolidation
→ statutory/management reporting
→ drill-through to source evidence
```

Primary domains: **7, 8, 19**.

### Priority 2 — source-to-pay plus material/warehouse continuity

SAP SLC/SRM/MM/EWM/WM/SCM exposes the gap after NuBlox's current RFQ/PO foundations.

The material outcome is:

```text
Supplier qualification
→ demand/requisition
→ sourcing
→ order/subcontract
→ receipt
→ inventory/material movement
→ invoice verification
→ AP/payment
→ ledger/project/asset consequence
```

Primary domains: **9, 10, 7, 19**.

This aligns directly with the planned Materials/Inventory/Logistics domain and the current UX-friction priority in purchasing.

### Priority 3 — design/product/production-to-asset continuity

SAP PLM/IPPE/PP/VC reinforces the biggest Journey B weakness.

The material outcome is:

```text
Requirement
→ design/system/product definition
→ approved configuration
→ material/BOM/production or procurement
→ installation
→ verification/commissioning
→ installed asset configuration
```

Primary domains: **6, 10, 11, 13, 14, 15, 19**.

This is more important to NuBlox than copying SAP PLM packaging because it is where enterprise product data, project delivery and long-lived built assets converge.

### Priority 4 — complete hire-to-retire and cost continuity

SAP HCM/TAM/MRS/Travel highlights the difference between workforce scheduling/time foundations and enterprise HCM.

The material outcome is:

```text
Person
→ employment/position
→ competence
→ mobilisation/capacity
→ schedule/time/attendance
→ payroll/expenses
→ project/service actual cost
→ utilisation/performance
→ exit
```

Primary domains: **12, 5, 7, 19**.

### Priority 5 — enterprise data/platform maturity

SAP BI/DS/PI/NetWeaver/SolMan/TDMS-style references are useful only as capability questions, not platform templates.

NuBlox must strengthen:

- governed semantic/KPI definitions;
- cross-domain analytics and drill-through;
- versioned APIs and webhooks;
- integration/adaptor governance;
- data import/export and migration;
- observability and administrative operations;
- controlled test-data/environment tooling;
- permission/provenance-aware automation and intelligence.

Primary domain: **19**.

## 7. What is not automatically core

Several entries in the CSV represent industry or operating-model extensions rather than universal NuBlox core scope, for example:

- Oil & Gas;
- retail;
- trade-promotion management;
- point of sale;
- funds management;
- incentive/commission management;
- convergent charging.

These remain useful benchmarks where NuBlox's target organisations genuinely require the underlying semantics. They should be delivered as contextual sector/operating-pattern capability over canonical domains, not as permanent SAP-shaped modules.

## 8. Governance of the CSV going forward

The existing CSV is retained as benchmark provenance. From this rebaseline forward:

1. `sap_reference` remains a benchmark label only.
2. `classification` remains useful for distinguishing functional, platform and industry-extension references.
3. the legacy `E##` mapping must be translated to current native domain IDs before using a row in planning.
4. `target_slice` is superseded and must not drive priority.
5. current capability judgement must be reconciled with `10-capability-control-matrix.md` and executable repository evidence.
6. a SAP gap becomes a delivery candidate only when it blocks an enterprise value stream, golden journey, statutory/operational requirement or a materially relevant world-class benchmark.
7. NuBlox may deliberately solve a benchmark outcome differently and more coherently than SAP.

## 9. Benchmark success criterion

NuBlox does not succeed by reproducing SAP's catalogue.

It succeeds when the materially relevant enterprise outcomes represented by that catalogue can be performed natively, efficiently and governably while preserving a digital thread that SAP-style ERP boundaries often leave to adjacent project, BIM/CDE, PLM, EAM or specialist systems.

The decisive question is therefore:

> **Can NuBlox equal or exceed the enterprise capability represented by this SAP benchmark while connecting it more directly to construction delivery and the resulting built asset?**

That is how this register should guide the World-Class programme.