# 17 — Sources and Standards

Verified for this baseline on **15 August 2026**.

## Career taxonomy

National Careers Service — Construction and the built environment:

- https://nationalcareers.service.gov.uk/explore-careers/job-sector/construction-and-the-built-environment/view-all-sector-careers
- pages 1–5 contain 84 profiles.

The National Careers Service site states its content is available under the Open Government Licence v3.0 except where otherwise stated. Attribution/licensing should be reviewed before reproducing substantial source descriptions/metadata in production.

## Svelte 5

Official Svelte documentation:

- https://svelte.dev/docs/svelte/what-are-runes

Svelte 5 runes are the baseline syntax for new reactive code in this project.

## SvelteKit

Official documentation:

- https://svelte.dev/docs/kit/routing
- https://svelte.dev/docs/kit/form-actions

Form actions are a stable SvelteKit mechanism for server mutations. The documentation also identifies remote functions as experimental/newer work; NuBlox should not make critical architecture depend on experimental APIs without an ADR.

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

Latest stable version verified: ASVS 5.0.0.

OWASP Top 10:

- https://owasp.org/Top10/

Current released awareness list verified: OWASP Top 10:2025.

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
