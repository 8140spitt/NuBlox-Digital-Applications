# 00 — Executive Summary

## Product vision

NuBlox is being designed as the **world-class native ERP and operating platform for construction and the built environment**.

The target is not a collection of construction modules and not a project-management application with accounting attached. NuBlox must be capable of running the complete enterprise and built-asset lifecycle for organisations across construction, engineering, surveying, property, infrastructure, facilities, maintenance, building products and specialist trades.

The canonical lifecycle is:

**Market → Lead → Opportunity → Bid → Estimate → Proposal → Quote → Contract → Design → Plan → Procure → Produce → Construct → Control → Invoice → Account → Handover → Operate → Maintain → Refurbish → Dispose**

The platform must solve two connected problems as one system:

1. **Run the enterprise** — customers, sales, finance, people, payroll, procurement, supply chain, materials, inventory, logistics, production, property, assets, service, governance and reporting.
2. **Perform built-environment work** — portfolios, projects, programmes, design, BIM, commercial management, site operations, quality, safety, commissioning, handover, facilities, maintenance and asset lifecycle management.

Profession-specific functionality must be delivered through reusable native capabilities rather than disconnected applications.

## World-class product standard

NuBlox is acceptable only if a construction or built-environment organisation can operate its material business processes without depending on another ERP or operational product for missing core capability.

SAP and other enterprise systems are capability benchmarks, not dependencies. Where a materially relevant enterprise capability exists in a leading ERP, NuBlox must either provide the equivalent natively or have an explicit native implementation boundary in the product architecture.

NuBlox must then exceed generic ERP capability in construction and built-environment depth by understanding native industry concepts such as tenders, estimates, contracts, work packages, RFIs, submittals, instructions, variations, valuations, applications, retention, defects, commissioning, handover, assets and maintenance as first-class records.

## Native-first rule

Core business capability is owned by NuBlox.

NuBlox must not use integration as a substitute for a missing core ERP module. External connectivity may support statutory exchange, banking rails, communications transport, identity federation, open-standard interchange, migration or customer-requested coexistence, but the canonical business process, records, permissions, workflow and audit trail remain native to NuBlox.

Examples:

- accounting integrations must not replace the NuBlox ledger;
- payroll integrations must not replace the NuBlox payroll capability;
- BIM/CDE integrations must not replace NuBlox design and information-management capability;
- e-signature providers must not own NuBlox contract lifecycle or approval evidence;
- external scheduling, CRM, procurement, FM or asset systems must not be required to complete NuBlox workflows.

## Target users

The canonical sector taxonomy contains **84 National Careers Service construction and built-environment career profiles**. The taxonomy spans physical trades, design, engineering, construction management, surveying, property, environmental sustainability, plant, infrastructure and facilities roles.

NuBlox must support organisations ranging from sole traders to large multi-entity groups, including:

- specialist subcontractors and trades;
- main contractors and construction managers;
- developers and asset owners;
- architecture, engineering and multidisciplinary consultancies;
- surveying and commercial practices;
- suppliers, merchants and building-product businesses;
- plant, fleet and equipment operators;
- property, estate and facilities organisations;
- infrastructure and utilities delivery organisations;
- external project and supply-chain participants with controlled access.

## Product layers

1. **Enterprise, Identity and Master Data Kernel**
2. **Customer, Sales and Commercial ERP**
3. **Finance, Planning and Control ERP**
4. **People, Workforce and Payroll ERP**
5. **Procurement, Materials, Production and Logistics ERP**
6. **Projects, Design, BIM and Delivery OS**
7. **Site, Quality, Safety and Environmental OS**
8. **Plant, Assets, Property, Facilities and Service OS**
9. **Collaboration / NuBlox Network**
10. **Reporting, Workflow, Automation and Intelligence**
11. **Professional Capability Packs**

## Canonical-data principle

NuBlox uses one authoritative enterprise model rather than module-specific copies.

A customer is one party reused by CRM, estimating, contracts, projects, invoicing and service. The same principle applies to suppliers, people, projects, contracts, assets, properties, materials and cost structures.

Business events should propagate through the model rather than require duplicate manual entry. For example, an approved project change can affect commitments, programme, forecast, valuation, revenue, subcontract exposure and margin through controlled linked records.

## Strategic design principles

- Native ERP capability before external dependency.
- One canonical source of truth per business entity and domain.
- Modular monolith before microservices.
- Multi-tenancy is foundational, not a retrofit.
- Capabilities are distinct from careers and permissions.
- Context-first workspaces are preferred over module-hopping.
- Files and models are controlled, versioned records rather than loose attachments.
- Auditability applies to material business, contractual, financial and compliance actions.
- Structured records are preferred over unsearchable document-only workflows.
- Shared projects permit controlled cross-organisation participation without weakening tenant boundaries.
- Mobile/responsive field workflows are first-class.
- Accessibility target: WCAG 2.2 AA.
- Privacy, security, segregation of duties and financial control are designed in from inception.
- Regional legislation, accounting, tax, payroll and terminology must be configurable.
- Open standards and external APIs support interoperability without surrendering system-of-record ownership.
- AI assists governed business processes; it does not bypass permissions, evidence or human accountability.

## Programme success test

The long-term programme passes only when a built-environment enterprise can use NuBlox as its primary system for:

- customer acquisition and sales;
- estimating, tendering and contracting;
- project and programme delivery;
- design and information management;
- commercial and cost control;
- finance and statutory accounting;
- people, workforce and payroll;
- procurement, materials, inventory and logistics;
- production/fabrication where applicable;
- site, quality, safety and environmental management;
- plant, fleet and equipment;
- property, facilities and service;
- reporting, planning, governance and decision support.

The detailed capability model and implementation gate are defined in `57-world-class-native-erp-architecture.md`.
