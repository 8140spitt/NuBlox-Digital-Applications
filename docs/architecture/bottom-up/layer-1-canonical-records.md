# Layer 1 — Canonical Records and Relationships

**Status:** Governing canonical model

Layer 1 defines the business things NuBlox recognises. Domain tables may specialise these concepts, but separate modules must not create competing copies of the same real-world record.

## Canonical record families

### Identity, party and organisation

- user identity;
- person;
- organisation/party;
- legal entity and operating unit;
- organisation membership;
- team;
- customer, supplier, subcontractor, consultant and other relationship roles;
- contact method and address;
- delegated authority and organisational relationship.

A party may hold several business relationships simultaneously. “Customer” and “supplier” are relationships, not automatically separate master persons/organisations.

### People and workforce

- worker/person relationship;
- employment or engagement;
- position;
- career/professional classification;
- competency, skill, qualification, card and training record;
- availability, roster, time entry, leave and absence;
- expense;
- payroll input/output evidence.

### Portfolio, programme, project and work structure

- portfolio;
- programme;
- project/job;
- site;
- work breakdown element/work package;
- schedule activity and milestone;
- project participant and project role;
- risk, issue, decision and action.

### Property, spatial and built assets

- land/property/estate;
- site/building/structure;
- level/space/zone/location;
- system;
- asset/component;
- plant/equipment/vehicle/tool;
- meter and condition/inspection point;
- ownership, occupation and allocation relationships.

### Product, material and resource

- product/material/service catalogue item;
- unit and conversion;
- resource/rate;
- assembly/BOM where applicable;
- batch/lot/serial identity where required;
- inventory holding and location.

### Information and BIM

- information container/document/model;
- version/revision;
- classification and metadata;
- issue/transmittal;
- RFI/technical query;
- submittal;
- review/comment/markup;
- specification/schedule;
- model/object linkage and open-standard exchange identity.

### Commercial and contract

- lead/opportunity;
- enquiry/tender invitation;
- estimate and estimate version;
- proposal/quotation and version;
- appointment/contract/subcontract/framework;
- obligation, clause, key date and notice;
- commercial change/variation/compensation event;
- claim and entitlement evidence;
- application, valuation, assessment and certificate;
- retention, bond, guarantee and insurance evidence.

### Procurement, supply and logistics

- supplier relationship/qualification;
- procurement package;
- requisition;
- RFQ/RFP/tender response;
- purchase/subcontract order and change;
- goods/service receipt;
- material reservation/issue/return/transfer;
- delivery/dispatch/shipment.

### Finance and accounting

- account and accounting dimension;
- cost code/cost centre/profit centre;
- budget/forecast scenario;
- customer/supplier financial document;
- receipt/payment and allocation;
- journal and journal line;
- financial year/period;
- bank/cash account and reconciliation evidence;
- tax record;
- fixed-asset accounting record.

Operational records remain authoritative for their own business facts; accounting evidence does not silently replace operational authority.

### Site, quality, safety and compliance

- daily/site record;
- permit;
- RAMS/briefing/induction evidence;
- inspection/test plan and inspection/test result;
- defect/snag;
- NCR/CAPA;
- hazard/observation/incident/investigation;
- audit/assurance record;
- compliance obligation and certificate;
- environmental event/waste record.

### Service, maintenance and aftercare

- service request/case;
- work order;
- maintenance plan;
- task/assignment linkage;
- service visit;
- warranty/entitlement;
- spare/part consumption;
- installed-base/service history.

## Relationship rules

Relationships carry their own semantics. Examples include:

- organisation membership has status, dates and authority context;
- project participation has organisation, member/project role and valid period;
- asset installation links an asset to a location/system and commissioning context;
- contract participation links parties with contractual roles;
- document links connect controlled information to projects/assets/contracts without turning the schema into an EAV model.

## Snapshot rule

Master data is referenced while it is current. A historical business instrument may preserve an immutable snapshot when the exact issued/approved/executed representation is itself a legal or commercial fact.

Examples: issued quotation, invoice, tender submission, valuation, certificate, executed contract and document revision.

## Canonicality test

Before adding a new root entity, ask:

1. Is this a genuinely new business identity?
2. Is it a state/version of an existing record?
3. Is it a relationship between existing records?
4. Is it evidence/event history rather than a root business object?
5. Is it reference/classification data?

A new table may still be correct, but a new **business identity** requires a stronger justification than a new persistence structure.