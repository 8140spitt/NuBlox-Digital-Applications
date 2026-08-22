# 17 — Sources and Standards

**Status:** Reference register  
**Verified:** 22 August 2026  
**Governing sector model:** [`construction-and-built-environment.md`](construction-and-built-environment.md)

This document records external sources used to benchmark or configure NuBlox. External standards are **overlays, reference data and interoperability contracts**; they do not replace NuBlox canonical records or become irreversible database assumptions.

## Construction and Built Environment sector boundary

National Careers Service — Construction and the built environment:

- https://nationalcareers.service.gov.uk/explore-careers/job-sector/construction-and-the-built-environment
- https://nationalcareers.service.gov.uk/explore-careers/job-sector/construction-and-the-built-environment/view-all-sector-careers

NuBlox uses the breadth of the sector — including physical trades, design, engineering, surveying, environmental sustainability, property maintenance and civil engineering — as a career/capability coverage benchmark.

The repository career taxonomy contains 84 sector career profiles. Career data is a configuration/composition layer and is not interchangeable with organisation roles, project roles or permissions.

## Project lifecycle — RIBA Plan of Work

Official RIBA resource:

- https://www.architecture.com/knowledge-and-resources/resources-landing-page/riba-plan-of-work

The RIBA Plan of Work 2020 is the recognised UK building design/construction stage model with stages 0–7 from Strategic Definition through Use.

NuBlox supports it as a project-stage overlay. It does not define the complete NuBlox enterprise/asset lifecycle, because NuBlox must also cover market/work winning, infrastructure delivery patterns, commercial/financial processes and long-term asset operation.

## Information management — ISO 19650 / UK IMI Framework

UK information-management framework:

- https://www.ukbimframework.org/

The UK framework provides the national implementation approach for information management using the ISO 19650 series, including information requirements, tendering/appointments, information-delivery planning, CDE workflows and operational information management.

NuBlox uses ISO 19650-compatible concepts for controlled information management while retaining its own canonical information-container, project, permission and workflow model.

## Built-environment classification — Uniclass

NBS Uniclass:

- https://www.thenbs.com/our-tools/uniclass
- https://uniclass.thenbs.com/download

Uniclass is a unified classification system used across the built environment. NBS states that the tables are updated quarterly.

Current download baseline verified on 22 August 2026: **July 2026**.

NuBlox must therefore store classification source/version as governed reference data. Uniclass codes must not be hard-coded as database enums or primary business identifiers.

## OpenBIM — IFC

buildingSMART International:

- https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/

Current official IFC baseline verified for this document: **IFC 4.3.2.0**, commonly referred to as IFC 4.3 and published as **ISO 16739-1:2024**.

IFC 4.3 expands standardised openBIM coverage beyond buildings into infrastructure including roads, railways, bridges, waterways and ports.

NuBlox treats IFC as an open exchange/interoperability standard. It does not make an IFC file the authoritative record for NuBlox commercial, permission, workflow or accounting state.

## Cost management — RICS NRM

RICS New Rules of Measurement:

- https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/nrm

The current NRM suite comprises:

- NRM 1 — order of cost estimating and cost planning for capital building works;
- NRM 2 — detailed measurement for building works;
- NRM 3 — order of cost estimating and cost planning for building maintenance works.

The 2021 suite remains the core published measurement baseline. RICS also published updated NRM 3 logic/level material in 2026 to improve whole-life data continuity and interoperability.

NuBlox supports NRM-compatible cost/measurement structures where required, while allowing alternative regional/client classification and measurement regimes.

## Whole-life carbon — RICS WLCA

RICS Whole Life Carbon Assessment for the Built Environment:

- https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/whole-life-carbon-assessment

Verified baseline: **Whole Life Carbon Assessment for the Built Environment, 2nd edition**, effective from 1 July 2024.

The standard covers buildings and infrastructure and provides a consistent whole-life approach including embodied and operational carbon.

NuBlox uses this as a carbon-structure benchmark. Factors, assumptions, methodologies and assessment versions must be recorded explicitly because carbon standards and source datasets evolve.

## Asset management — ISO 55000 family

ISO asset-management reference:

- https://www.iso.org/

Verified baseline: **ISO 55000:2024** provides current asset-management vocabulary, principles and an overarching framework, with emphasis on value, alignment, assurance, adaptability, sustainability and continual improvement.

NuBlox asset/EAM capability must therefore connect portfolio objectives, asset value, risk, performance, cost and lifecycle decisions rather than reducing asset management to a maintenance register.

## Construction health and safety — CDM 2015

Health and Safety Executive:

- https://www.hse.gov.uk/construction/cdm/2015/

The Construction (Design and Management) Regulations 2015 are a UK construction design/management safety-duty baseline.

NuBlox must support dutyholder, competence, appointment, design-risk and project health/safety evidence as jurisdictionally applicable. Legal configuration must be verified against current legislation and guidance at implementation time.

## Building safety and golden thread — England

Building Safety Regulator / GOV.UK:

- https://www.gov.uk/guidance/keeping-information-about-a-higher-risk-building-the-golden-thread
- https://www.gov.uk/government/collections/design-and-construction-of-higher-risk-buildings
- https://www.gov.uk/government/collections/managing-high-rise-residential-buildings

Current guidance requires specified higher-risk/high-rise residential building information to be maintained digitally, securely, accessibly and with controlled, usable information across design/construction and occupation.

NuBlox treats this as an **England-specific regulatory overlay**. The product must support golden-thread, dutyholder, controlled-change, completion and operational building-safety evidence without assuming every project or jurisdiction is in scope.

## ERP breadth benchmark

SAP ERP capability references:

- https://www.sap.com/products/erp/s4hana.html
- https://learning.sap.com/products/s4hana-cloud
- https://help.sap.com/docs/SAP_S4HANA_CLOUD/

The repository also retains `sap-capability-coverage-register.csv` as a breadth checklist.

SAP and other enterprise products are **benchmarks only**. NuBlox does not mirror their module packaging and does not depend on them for a complete native deployment.

The governing NuBlox capability treatment is maintained in [`construction-and-built-environment.md`](construction-and-built-environment.md).

## Native-first interoperability rule

External enterprise products, CDEs, BIM tools, finance products and service platforms may exchange data with NuBlox but must not silently become the owner of a core NuBlox business process because a native capability is absent.

Permitted external boundaries include:

- banking/payment rails;
- statutory authority endpoints;
- communications transport;
- identity federation;
- object/infrastructure storage;
- open BIM/GIS exchange;
- migration/import/export;
- customer-requested coexistence.

See [`08-api-integrations.md`](08-api-integrations.md).

## Application platform standards

### Svelte 5

- https://svelte.dev/docs/svelte/what-are-runes

Svelte 5 runes are the baseline syntax for new reactive code.

### SvelteKit

- https://svelte.dev/docs/kit/routing
- https://svelte.dev/docs/kit/form-actions

Critical architecture must not depend on experimental APIs without an ADR.

### MySQL 8.4 / InnoDB

- https://dev.mysql.com/doc/refman/8.4/en/
- https://dev.mysql.com/doc/refman/8.4/en/innodb-storage-engine.html

Committed MySQL migrations are the implemented schema authority.

## Accessibility

W3C WCAG 2.2:

- https://www.w3.org/TR/WCAG22/

NuBlox target: **WCAG 2.2 AA**.

## Application security

OWASP ASVS:

- https://owasp.org/www-project-application-security-verification-standard/

Verified project baseline: **ASVS 5.0.0**.

OWASP Top 10:

- https://owasp.org/Top10/

Verified awareness baseline: **OWASP Top 10:2025**.

## UK data protection

ICO accountability / privacy by design:

- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/data-protection-by-design-and-by-default/
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/documentation/

Legal implementation must always use current law and current regulator guidance at delivery time.

## Reference-data rule

For every external standard/classification stored by NuBlox, record enough metadata to identify the authority and version/release used.

Where standards change over time, NuBlox must be able to preserve the historical classification/methodology associated with prior projects and assessments while making later releases available for new work.