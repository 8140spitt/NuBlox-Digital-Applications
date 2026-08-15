# 00 — Executive Summary

## Product vision

NuBlox will be a multi-tenant business and operational platform for the construction and built-environment ecosystem. It is intended to support businesses ranging from sole traders to multidisciplinary consultancies, contractors, suppliers and property/facilities organisations.

The product must solve two connected problems:

1. **Run the business** — customers, opportunities, quotations, contracts, people, procurement, time, invoicing, reporting and compliance.
2. **Perform built-environment work** — projects, sites, design information, commercial control, inspections, quality, safety, certification, assets, maintenance and handover.

Profession-specific functionality must be delivered through reusable capabilities rather than 84 disconnected applications.

## Target users

The canonical launch taxonomy contains **84 National Careers Service construction and built-environment career profiles**. These careers are grouped into reusable professional domains and capability packs.

The product must support:

- sole traders and micro-businesses;
- specialist subcontractors;
- main contractors;
- design and engineering consultancies;
- surveying and commercial practices;
- suppliers and merchants;
- facilities/property operators;
- clients and developers;
- external project participants with controlled access.

## Product layers

1. **Identity and Organisation Kernel**
2. **Business OS**
3. **Built Environment OS**
4. **Professional Capability Packs**
5. **Collaboration / NuBlox Network**
6. **Reporting, automation and AI assistance**

## Business outcome

A customer should not need separate products for CRM, project administration, job management, document records, inspection evidence and profession-specific workflows where those functions can be safely consolidated into one coherent data model.

## Strategic design principles

- Modular monolith before microservices.
- Multi-tenancy is foundational, not a retrofit.
- Capabilities are distinct from careers and permissions.
- Files are versioned records, not loose attachments.
- Auditability applies to material business, contractual and compliance actions.
- Structured records are preferred over unsearchable document-only workflows.
- Shared projects permit controlled cross-organisation participation.
- Mobile/responsive workflows are first-class for field users.
- Accessibility target: WCAG 2.2 AA.
- Privacy and security are designed in from inception.
- Regional legislation and terminology must be configurable.

## Initial product success measures

During pilot operation the product should demonstrate:

- a business can onboard, configure its organisation and invite staff without developer intervention;
- users see workspaces appropriate to their careers and permissions;
- a project can be created once and support multiple participating organisations;
- commercial, document, site, quality and asset records preserve history;
- all security-sensitive and material business actions are auditable;
- the same platform can support three deliberately different pilot profiles: Quantity Surveyor, Electrician and Facilities Manager;
- adding another career primarily means configuration/composition of capabilities, not cloning the application.

## Explicit non-goals for the first production release

Unless separately commissioned:

- full statutory accounting ledger;
- payroll engine;
- native BIM authoring;
- CAD authoring;
- replacement for specialist engineering calculation software;
- replacement for regulated certification bodies or government submission portals;
- autonomous AI approval of contractual, safety or regulatory decisions;
- microservice decomposition.

NuBlox may integrate with specialist systems in these areas.
