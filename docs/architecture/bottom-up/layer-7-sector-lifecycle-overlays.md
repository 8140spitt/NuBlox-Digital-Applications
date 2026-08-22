# Layer 7 — Construction, Built Environment and Lifecycle Overlays

**Status:** Governing sector-composition layer

Layer 7 specialises the native enterprise model for construction and the built environment without forking lower-layer records or security semantics.

The complete sector model is maintained in [`../../construction-and-built-environment.md`](../../construction-and-built-environment.md).

## Sector dimensions

NuBlox composes lower layers across:

- built-asset class;
- organisation archetype;
- project/procurement/contract delivery model;
- professional discipline and trade;
- lifecycle stage;
- classification system;
- jurisdiction/regulatory regime;
- complexity/scale.

These are overlays, not separate applications.

## Whole-life lifecycle

The product supports the continuous thread from strategy and work-winning through feasibility, design, estimating, contracting, procurement, production, construction, control, commissioning, handover, operation, maintenance, refurbishment and disposal.

The canonical NuBlox lifecycle remains:

**Market → Lead → Opportunity → Bid → Estimate → Proposal → Quote → Contract → Design → Plan → Procure → Produce → Construct → Control → Invoice → Account → Handover → Operate → Maintain → Refurbish → Dispose**

Lifecycle frameworks such as RIBA Plan of Work are mapped overlays rather than replacements for the whole enterprise/asset lifecycle.

## Discipline overlays

Supported professional/operational overlays include architecture, civil/structural/geotechnical/building-services/fire engineering, surveying/geomatics, quantity surveying/commercial management, project/programme controls, site/trades, temporary works, quality, H&S, environmental management, building control/compliance, manufacturing/off-site, logistics, plant/fleet, property/FM, service/maintenance, energy/carbon and infrastructure/utilities.

## Standards overlays

External standards/classifications are versioned reference layers. Examples include ISO 19650 information management, IFC/openBIM, Uniclass, RICS measurement/cost/carbon frameworks, ISO 55000 asset management, CDM and applicable building-safety/golden-thread requirements.

Standards may introduce validation, terminology, classifications, information requirements or reporting obligations. They must not create hidden alternative identity/security models.

See [`../../17-sources-and-standards.md`](../../17-sources-and-standards.md).

## Career composition

Career/profession data helps select relevant capability and terminology. It remains orthogonal to organisation/project roles and permissions.

Sector packs therefore configure experience and process relevance; they do not clone the canonical data model.