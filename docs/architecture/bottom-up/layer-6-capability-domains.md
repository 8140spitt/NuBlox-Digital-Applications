# Layer 6 — Native Capability Domains

**Status:** Governing capability architecture

Layer 6 groups native NuBlox capability. A capability domain is not a database schema, sidebar section, career or enterprise function.

Every capability must map downward to canonical records, permissions, state transitions, services and process participation before it is considered architecturally defined.

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
- automated tests.

A domain may expose many workspaces and a workspace may compose several domains.

## Enterprise taxonomy relationship

The 29-function enterprise taxonomy describes **work organisations perform**. These 19 domains describe **native capability NuBlox owns**. Mapping is many-to-many and must be explicit.

See [`../taxonomy/README.md`](../taxonomy/README.md).

## Benchmark rule

External ERP suites can reveal missing capability but do not define NuBlox's internal architecture. Benchmark coverage must map into these domains and then downward through Layers 5–0.