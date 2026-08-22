# Layer 6 — Native Capability Domains

**Status:** Governing capability architecture

Layer 6 groups native NuBlox capability. A capability domain is not a database schema, sidebar section, career, market software category or enterprise function.

Every capability must map downward to canonical records, permissions, state transitions, services and process participation before it is considered architecturally defined.

## One-product invariant

**NuBlox: Digital Applications for the Construction and the Built Environment is one complete product.**

The customer does not select ERP, PLM, PDM, CDE, BIM, PMIS, HCM, SCM, EAM, CMMS, IWMS or other core capability modules. Those category labels are coverage benchmarks. Materially relevant capability ships as part of NuBlox and is exposed according to context and authority.

Therefore:

- core capability is included by default;
- no separate NuBlox module purchase is required to complete a native end-to-end business process;
- contextual workspaces simplify the experience without removing capability from the product;
- permissions determine authority, not product availability;
- external applications may interoperate but do not substitute for planned missing core capability.

The complete category-convergence contract is defined in [`platform-coverage-contract.md`](platform-coverage-contract.md).

## Nineteen native domains

1. **Enterprise, identity and master data**
2. **CRM, business development and customer management**
3. **Estimating, bidding, tendering, proposals and sales**
4. **Contracts, commercial management and revenue**
5. **Portfolio, programme and project management**
6. **Design, engineering, BIM and information management**
7. **Finance and statutory accounting**
8. **Management accounting, planning, treasury and enterprise performance**
9. **Procurement, subcontracting and supplier management**
10. **Materials, inventory, warehouse, distribution and logistics**
11. **Production, fabrication and prefabrication**
12. **People, HCM, workforce and payroll**
13. **Site, field and construction operations**
14. **Quality, health, safety, environment and compliance**
15. **Plant, fleet, equipment and enterprise asset management**
16. **Property, real estate, estates and facilities**
17. **Service, maintenance, warranty and aftercare**
18. **Sustainability, carbon and environmental performance**
19. **Data, workflow, analytics, search and intelligence**

The 19 domains are stable ownership/composition boundaries. They deliberately converge capabilities that the software market often sells as many separate products.

## Market-category convergence

Market labels such as ERP, PLM, PDM, PPM, PMIS, CDE, BIM, SCM, WMS, MES, HCM, QMS, EHS, EAM, CMMS, APM, IWMS, FSM, GIS and digital twin are many-to-many views over the NuBlox domains.

They must **not** become a second module architecture.

For example:

- PLM/PDM spans design/information, production, materials, assets, service and data governance;
- project controls spans project management, commercial, finance, workforce and analytics;
- digital twin spans engineering information, geospatial context, installed assets, operations, condition and history;
- EAM/CMMS spans assets, materials/spares, workforce, service, finance and analytics;
- CDE/BIM spans information management, projects, site delivery, quality and handover.

The authoritative coverage mapping is [`platform-coverage-contract.md`](platform-coverage-contract.md).

## Domain completeness contract

For each capability inside a domain, document:

- canonical records and relationships;
- owner domain/service;
- lifecycle/state machine;
- permissions and SoD;
- work/approval semantics;
- audit/events/outbox;
- correction model;
- process chains using it;
- reporting/KPIs;
- external interchange;
- sector/jurisdiction overlays;
- workspace composition;
- automated tests;
- market-category coverage where relevant;
- digital-thread relationships to upstream and downstream records.

A domain may expose many workspaces and a workspace may compose several domains.

## Enterprise taxonomy relationship

The 29-function enterprise taxonomy describes **work organisations perform**. These 19 domains describe **native capability NuBlox owns**. Mapping is many-to-many and must be explicit.

See [`../taxonomy/README.md`](../taxonomy/README.md).

## Benchmark rule

External enterprise, PLM, construction, asset and geospatial suites can reveal missing capability but do not define NuBlox's internal architecture. Benchmark coverage must map into these domains and then downward through Layers 5–0.

If a materially relevant benchmark capability is missing, it becomes a NuBlox product requirement rather than an assumed permanent dependency on the benchmark product.
