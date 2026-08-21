# 17 — Sources and Standards

Verified for the current product baseline on **21 August 2026**.

## Career taxonomy and sector boundary

National Careers Service — Construction and the built environment:

- https://nationalcareers.service.gov.uk/explore-careers/job-sector/construction-and-the-built-environment
- https://nationalcareers.service.gov.uk/explore-careers/job-sector/construction-and-the-built-environment/view-all-sector-careers
- pages 1–5 contain 84 profiles.

The sector description explicitly spans physical trades as well as environmental sustainability, property maintenance and civil engineering, with careers from entry level through senior management. NuBlox uses this breadth as a sector-coverage benchmark.

The National Careers Service site states its content is available under the Open Government Licence v3.0 except where otherwise stated. Attribution/licensing should be reviewed before reproducing substantial source descriptions/metadata in production.

## ERP capability benchmark

The supplied SAP-module benchmark:

- https://www.uneecops.com/blog/sap-modules-list/

The article identifies an A–Z list of 64 SAP modules and describes primary functional areas including Financial Accounting, Production Planning, Materials Management, Controlling, Sales and Distribution, Financial Supply Chain Management, Logistics Execution, Project System, Plant Maintenance and Quality Management.

NuBlox uses these module names only as a **capability completeness benchmark**. It does not copy SAP's product architecture and it does not depend on SAP modules.

Current SAP ERP capability references:

- https://www.sap.com/products/erp/s4hana.html
- https://learning.sap.com/products/s4hana-cloud
- https://help.sap.com/docs/SAP_S4HANA_CLOUD/

Current SAP S/4HANA Cloud capability areas include finance, asset management, manufacturing/product engineering, projects/professional services, sales, service, sourcing/procurement, supply chain, transportation, warehouse management and human resources.

The NuBlox governing crosswalk is maintained in `57-world-class-native-erp-architecture.md`.

## Native-first benchmark rule

External enterprise products are research/benchmark sources, not required runtime modules.

If a materially relevant ERP capability is identified in a benchmark, NuBlox must provide a native treatment or an explicit native implementation boundary. External connectivity may still be used for infrastructure, statutory exchange, banking/payment rails, communications, open-standard interchange, migration or customer-requested coexistence.

See `08-api-integrations.md` and `57-world-class-native-erp-architecture.md`.

## Svelte 5

Official Svelte documentation:

- https://svelte.dev/docs/svelte/what-are-runes

Svelte 5 runes are the baseline syntax for new reactive code in this project.

## SvelteKit

Official documentation:

- https://svelte.dev/docs/kit/routing
- https://svelte.dev/docs/kit/form-actions

Form actions are a stable SvelteKit mechanism for server mutations. NuBlox should not make critical architecture depend on experimental APIs without an ADR.

## MySQL

Official MySQL 8.4 reference:

- https://dev.mysql.com/doc/refman/8.4/en/
- https://dev.mysql.com/doc/refman/8.4/en/innodb-storage-engine.html

InnoDB provides transactional/ACID behaviour and is the default MySQL 8.4 storage engine.

## Accessibility

W3C WCAG 2.2:

- https://www.w3.org/TR/WCAG22/

NuBlox target: Level AA.

## Application security

OWASP ASVS:

- https://owasp.org/www-project-application-security-verification-standard/

Latest stable version verified for the project baseline: ASVS 5.0.0.

OWASP Top 10:

- https://owasp.org/Top10/

Current released awareness list verified for the project baseline: OWASP Top 10:2025.

## UK data protection

ICO accountability / privacy by design:

- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/data-protection-by-design-and-by-default/
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/guide-to-accountability-and-governance/documentation/

Legal implementation must use current law and current ICO guidance at delivery time.

## Construction Design and Management

HSE — Construction (Design and Management) Regulations 2015:

- https://www.hse.gov.uk/Construction/cdm/2015/

## Building safety / golden thread

GOV.UK / Building Safety Regulator:

- https://www.gov.uk/guidance/keeping-information-about-a-higher-risk-building-the-golden-thread

The guidance applies to specified higher-risk building contexts in England. NuBlox must not assume every project is in scope.
