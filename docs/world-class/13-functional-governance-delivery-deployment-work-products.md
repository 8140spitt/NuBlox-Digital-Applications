# 13 — Functional Governance, Delivery, Deployment & Work Products

**Status:** Governing workforce-and-work-product operating model  
**Effective:** 20 September 2026  
**Scope:** all 29 enterprise functions, all 353 L2 sub-functions, all 84 Construction and Built Environment careers, organisation positions, project/asset roles and the work products they create.

## 1. Product decision

NuBlox must support four connected but distinct concerns:

1. **Functional governance** — how the organisation defines ownership, policy, methods, controls, competence, decision rights, assurance and performance for the work it performs.
2. **Functional delivery** — how work is planned, assigned, executed and evidenced through native NuBlox capabilities, processes, work packages, tasks and transactions.
3. **Workforce deployment** — how suitably competent people are placed into organisation positions and project/site/property/asset/service contexts with the correct responsibilities, authority, availability and permissions.
4. **Work products** — the information, decisions, commercial records, fabricated products, installed work, inspections, certificates, asset records and other controlled outputs produced by that work.

The 84-career taxonomy is therefore not a second organisation chart and not an RBAC model. It is a professional/trade composition layer used to help determine relevant capability, competence expectations, terminology, templates and likely work products.

The governing relationship is:

~~~text
29 enterprise functions / 353 sub-functions / 1,510 activities
        │
        ├── Functional governance
        │     owner · policy · method · control · competence · assurance · KPI
        │
        ├── Functional delivery
        │     process · work package · task · native domain command · evidence
        │
        └── Workforce deployment
              career/profile · job profile · position · person
              project/asset role · responsibility · authority · permission
                              │
                              ▼
                       controlled work product
                              │
                              ▼
              review · approval · issue/release · baseline
                              │
                              ▼
           fabricate / procure / construct / install / hand over
                              │
                              ▼
                     operate · maintain · change
~~~

## 2. Non-conflation invariants

NuBlox must keep the following distinctions explicit:

**Enterprise Function ≠ Native Capability Domain ≠ Workspace**

**Career ≠ Job Profile ≠ Organisation Position ≠ Project Role ≠ Access Role ≠ Permission**

**Work Assignment ≠ Permission Grant**

**Deliverable Item ≠ File**

**Information Container ≠ Physical Configuration Item**

**Approval ≠ Release ≠ Acceptance ≠ Baseline**

A person may perform work across several enterprise functions and may hold several project or asset responsibilities. A career supplies professional context; it does not determine what the user is authorised to do.

## 3. Functional governance

Every material function/sub-function must be governable through an accountable functional structure. Governance is attached to the work, process, control and work-product type — not inferred from a career title.

A governed function/sub-function must be able to define:

- accountable functional owner and delegated deputies;
- process owner and process version;
- policy, standard, procedure, method and guidance;
- approved templates, forms, reference data and classifications;
- required qualifications, competencies, licences, cards and training;
- decision rights, approval thresholds and segregation-of-duties constraints;
- mandatory controls, evidence and record-retention rules;
- quality/assurance checks and audit requirements;
- KPIs, service levels, tolerances and exception thresholds;
- regulatory/jurisdiction overlays;
- approved tools/techniques and interoperability requirements;
- change owner and controlled improvement route.

Functional governance produces versioned, attributable records. It is not a static document library.

## 4. Functional delivery

Functional delivery turns governed intent into executable work.

Work may be created in the context of an organisation, portfolio, programme, project, contract, site, property, space, system, asset, product, production order, work order, service case or other canonical business object.

The delivery chain is:

~~~text
requirement / obligation / objective
→ process or lifecycle stage
→ work breakdown / package / task
→ responsibility assignment
→ native NuBlox command
→ transaction / evidence
→ work product
→ review / approval / acceptance
→ downstream commercial, project, asset and accounting consequence
~~~

A contextual workspace may compose several native capability domains, but every mutation still resolves to an authoritative domain command and canonical record.

### Delivery responsibilities

NuBlox must support at least:

- accountable owner;
- responsible performer;
- contributor;
- reviewer/checker;
- approver/acceptor;
- consulted party;
- informed/distribution party;
- independent assurance role where required.

These responsibilities are context-specific assignments, not permanent permissions.

## 5. Workforce deployment

Deployment answers: **who is allowed, competent, available and accountable to perform this work here and now?**

The deployment model is:

~~~text
Person
  + career/professional profile
  + skills/competence/qualification evidence
  + employment/engagement
  + organisation position / canonical job profile
  + availability and allocation
  + project/site/property/asset/service role
  + responsibility assignment
  + delegated authority
  + server-authoritative permission
  + jurisdiction/site/contract context
= deployable worker for a defined scope of work
~~~

### Deployment gate

Before protected work is assigned or executed, NuBlox must be able to evaluate applicable requirements such as:

- active organisation membership/engagement;
- valid position or approved contingent-worker relationship;
- required competency/qualification evidence and expiry dates;
- induction, permit, medical, security or site prerequisites where applicable;
- current allocation/availability;
- project/site/property/asset participation;
- assigned responsibility;
- delegated financial/technical authority where needed;
- explicit permission/SoD outcome;
- information-security and jurisdiction constraints.

Failure of one gate must produce a controlled business outcome — for example **not authorised**, **competence expired**, **not assigned** or **approval required** — rather than an unhandled application failure.

## 6. The canonical work-product model

NuBlox must manage the thing that people are employed and deployed to produce, not merely the task used to produce it.

A **work product** is a controlled output of enterprise, project, asset, production, field or service work. It may be informational, transactional, physical or evidential.

### 6.1 Work-product classes

| Class | Examples |
| --- | --- |
| Strategy/governance | strategy, business plan, policy, decision, approved method, assurance report |
| Design/technical information | drawing, model, calculation, specification, schedule, survey, design decision |
| Commercial/contractual | estimate, BoQ, tender return, contract, instruction, variation, valuation, certificate |
| Procurement/supply | requisition, RFQ, purchase order, material record, delivery note, stock movement |
| Production/fabrication | BOM, cut list, fabrication order, weld record, manufactured assembly |
| Site/installed work | masonry, steelwork, services installation, finished element, temporary works |
| Quality/safety/compliance | ITP, inspection, test result, NCR, permit, RAMS reference, compliance certificate |
| Commissioning/handover | commissioning record, O&M information, training evidence, as-built record, asset data |
| Operations/service | work order, service report, defect record, maintenance history, condition assessment |
| Finance/performance | invoice, journal consequence, forecast, KPI pack, benefit/performance evidence |

### 6.2 Deliverable item

A **deliverable item** represents a planned obligation to provide an identified work product. It is distinct from the file or physical object that fulfils it.

A deliverable item must be able to carry:

- stable identifier and title;
- deliverable/work-product type;
- source requirement, contract obligation or information requirement;
- portfolio/programme/project/WBS/work-package context;
- site/location/space/system/asset/product context;
- responsible organisation, position/person and project role;
- author/producer, checker/reviewer, approver and acceptor;
- planned, forecast and actual dates;
- dependencies and predecessor deliverables;
- classification, discipline and package;
- required format/medium and information standard;
- revision/version;
- suitability/status and issue purpose;
- workflow/review state;
- transmittal/distribution;
- acceptance/rejection and comments;
- configuration/baseline membership;
- supersession/replacement relationship;
- linked change/variation/RFI/technical-query records;
- downstream procurement, fabrication, construction, commissioning or asset consequences.

For an architect, for example, the managed object is not merely a PDF upload. NuBlox must know that **Drawing A-123** is a required deliverable for a defined project/package, who owns it, which revision is current, what it is issued for, what requirement it satisfies, who approved/accepted it, which downstream work relies on it and what changed when a later revision supersedes it.

## 7. Information, product and physical-asset continuity

The work-product model must preserve continuity across digital and physical results:

~~~text
requirement
→ deliverable item
→ design information / product definition
→ approved/released configuration
→ procurement or production
→ delivered material/product
→ installed component/system
→ inspection/test/commissioning
→ as-built / handover information
→ operational asset
→ maintenance/change history
~~~

A drawing or model may define a physical configuration but is not itself the installed asset. Likewise a fabricated item and its inspection record are related but distinct canonical records.

## 8. Configuration and change control

NuBlox must apply closed-loop configuration/change management to material controlled work products and configuration items.

The control cycle is:

~~~text
identify
→ define owner and configuration identity
→ establish approved baseline
→ raise change
→ assess multi-domain impact
→ approve/reject through defined authority
→ revise affected information/product/work
→ release/issue
→ implement
→ verify implementation
→ reconcile status
→ audit the resulting baseline
~~~

A change is not complete merely because a document revision was approved. Where applicable, the system must reconcile affected:

- requirements and design responsibility;
- drawings, models, specifications and calculations;
- product/BOM/material definitions;
- procurement commitments;
- production/fabrication instructions;
- work packages and construction instructions;
- cost, schedule and contract consequences;
- inspection/test requirements;
- installed configuration;
- commissioning records;
- as-built and handover information;
- operational asset records and maintenance requirements.

Configuration status accounting must make it possible to answer what was approved, what was issued, what was built/installed, what changed, who authorised it and which baseline is current.

## 9. How the 84 careers fit

The canonical 84-career register remains [04-career-capability-matrix.md](../04-career-capability-matrix.md). It contains **84/84 careers**, their specialist capability focus, primary structured records/work products and lifecycle context.

Each career is interpreted through the same operating contract:

~~~text
Career
→ default professional capability composition
→ candidate job-profile mappings
→ competence expectations
→ likely delivery responsibilities
→ typical work-product types
→ likely workspace/navigation relevance

NOT

Career → automatic permission
~~~

The 16 professional domains are composition aids only. They do not replace the 29 enterprise functions or 19 native capability domains.

### Examples

| Career | Governance that may apply | Delivery composition | Deployment context | Representative work products |
| --- | --- | --- | --- | --- |
| Architect | design standards, information governance, quality, project controls, regulatory obligations | D6 design/information + D5 project + D14 assurance + D19 workflow/data | design team/project/package; assigned design responsibility | drawings, models, specifications, schedules, design decisions, review evidence |
| Quantity surveyor | commercial policy, procurement controls, contract authority, finance/project controls | D4 commercial + D5 project + D8 management accounting + D9 procurement + D19 | project/commercial package; delegated commercial authority | cost plan, BoQ, tender analysis, valuation, variation, forecast, final account |
| Bricklayer | work method, competence, H&S, quality, material and project controls | D13 field + D10 materials + D14 QHSE + D12 workforce | site/work package/task/area; competent operative assignment | installed masonry, work records, material usage, progress evidence, inspection/quality records |
| Welder | approved welding method, competence/certification, material traceability, quality | D11 production + D10 materials + D14 quality + D13 field | fabrication or site work package; qualified welder assignment | weld, weld log, material traceability, inspection/NDT reference, repair record |
| Facilities manager | asset/property governance, service standards, compliance and budget authority | D16 property + D15 assets + D17 service + D8 finance/performance + D19 | estate/property/facility/asset portfolio | maintenance plan, work orders, compliance evidence, condition/performance records |

The same principle applies to all 84 careers.

## 10. Coverage and completeness controls

NuBlox is not complete for a career merely because the career name appears in a catalogue.

For each of the 84 careers, World-Class evidence must ultimately prove:

1. appropriate professional/career reference data;
2. candidate/approved job-profile and position composition where applicable;
3. required competence/qualification model;
4. relevant native capability composition;
5. typical project/site/property/asset/service deployment contexts;
6. responsibility and authority assignment;
7. server-authoritative permission enforcement;
8. specialist work processes and exception paths;
9. structured work products/deliverables;
10. review/approval/issue/acceptance/change lifecycle;
11. downstream project, commercial, finance, asset or service consequences;
12. reporting/search/audit continuity;
13. usable desktop/mobile experience as appropriate;
14. automated evidence for the material end-to-end journey.

For each of the 29 functions / 353 sub-functions, NuBlox must likewise be able to identify the governance owner, delivery process, native capability, role/responsibility composition, controlled outputs, controls, evidence and performance measures.

## 11. Experience implications

The operating model should surface through a small number of coherent experiences rather than one application per career:

- **My Work** — assigned tasks, deliverables, reviews, approvals, exceptions and due work;
- **Function governance** — policies, processes, controls, standards, competence rules, KPIs and assurance;
- **Organisation design** — job profiles, positions, reporting lines and workforce assignments;
- **Resource/deployment** — availability, competence, project/site/asset assignments and mobilisation gates;
- **Project/site/property/asset context** — work packages, responsibilities, deliverables, records and consequences;
- **Deliverables / information management** — requirements, deliverable register, revisions, reviews, issues/transmittals and acceptance;
- **Configuration & change** — baselines, configuration items, impact assessment, implementation and status accounting;
- **Career/professional view** — relevant capability, terminology, templates and work-product defaults without becoming an authorisation boundary.

## 12. Governing sources

This document composes, and does not replace:

- [12-enterprise-function-native-capability-map.md](12-enterprise-function-native-capability-map.md);
- [architecture/taxonomy](../architecture/taxonomy/README.md);
- [architecture/job-architecture](../architecture/job-architecture/README.md);
- [03-career-taxonomy.md](../03-career-taxonomy.md);
- [04-career-capability-matrix.md](../04-career-capability-matrix.md);
- [construction-and-built-environment.md](../construction-and-built-environment.md);
- [Layer 3 — State, Work, Events & Evidence](../architecture/bottom-up/layer-3-state-work-events-evidence.md);
- [Layer 6 — Capability Domains](../architecture/bottom-up/layer-6-capability-domains.md);
- [Layer 8 — Experience & Workspaces](../architecture/bottom-up/layer-8-experience-workspaces.md).

The product requirement is simple: **NuBlox must govern the work, deploy the right people to it, enable them to perform it, and control the resulting work products through the complete enterprise/project/asset lifecycle.**
