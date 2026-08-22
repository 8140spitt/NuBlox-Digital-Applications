# NuBlox documentation

This directory contains the durable product, architecture, security, standards and domain references for NuBlox.

NuBlox documentation is **not** a chronological delivery diary. Feature history belongs in Git commits, pull requests and issues. Permanent documents describe enduring requirements, governing architecture, standards, invariants or reusable reference material.

## Documentation authority

When two sources appear to disagree, use this precedence:

1. **Committed MySQL migrations** in [`database/migrations/`](../database/migrations/) are the authority for the implemented relational schema.
2. **[`construction-and-built-environment.md`](construction-and-built-environment.md)** is the governing Construction and Built Environment sector and product model.
3. **Security and tenancy rules** in [`07-auth-permissions-multitenancy.md`](07-auth-permissions-multitenancy.md) and [`11-security-privacy-compliance.md`](11-security-privacy-compliance.md) govern identity, authorisation, tenancy and control semantics.
4. **Architecture Decision Records** in [`adr/`](adr/) record accepted technical decisions.
5. **Product and functional requirements** define expected behaviour where implementation has not established a stronger invariant.
6. **The enterprise function taxonomy** in [`architecture/taxonomy/`](architecture/taxonomy/) is the canonical machine-readable catalogue of enterprise work; it does not replace the product capability model.
7. **Database package references** in [`../database/docs/`](../database/docs/) explain schema-design intent; migrations remain authoritative if implementation has advanced beyond them.
8. GitHub issues and pull requests describe delivery work and history; they are not architectural authority.

## Governing model

| Reference | Purpose |
| --- | --- |
| [`construction-and-built-environment.md`](construction-and-built-environment.md) | Single governing sector, lifecycle, capability and operating model |
| [`architecture/taxonomy/README.md`](architecture/taxonomy/README.md) | 29-function enterprise activity taxonomy |
| [`work-kernel-foundation.md`](work-kernel-foundation.md) | Horizontal action, assignment, approval, evidence and event model |
| [`00-executive-summary.md`](00-executive-summary.md) | Product and architecture summary |
| [`01-product-requirements-document.md`](01-product-requirements-document.md) | Product requirements |
| [`02-functional-requirements.md`](02-functional-requirements.md) | Cross-domain functional requirements |

The former `57-world-class-native-erp-architecture.md` path is retained only as a compatibility pointer for older references. It is not a second architecture authority.

## Foundation references

The retained numbered documents are stable reference material. Their numbering is historical and must not be extended as a delivery sequence.

- [`03-career-taxonomy.md`](03-career-taxonomy.md) — career taxonomy.
- [`04-career-capability-matrix.md`](04-career-capability-matrix.md) — career capability model.
- [`05-system-architecture.md`](05-system-architecture.md) — application architecture.
- [`06-data-model.md`](06-data-model.md) — canonical data-model principles.
- [`07-auth-permissions-multitenancy.md`](07-auth-permissions-multitenancy.md) — identity, tenancy and permissions.
- [`08-api-integrations.md`](08-api-integrations.md) — API and interoperability boundaries.
- [`09-ux-information-architecture.md`](09-ux-information-architecture.md) — information architecture and UX principles.
- [`10-non-functional-requirements.md`](10-non-functional-requirements.md) — non-functional requirements.
- [`11-security-privacy-compliance.md`](11-security-privacy-compliance.md) — security, privacy and compliance.
- [`12-devops-environments-testing.md`](12-devops-environments-testing.md) — environments and validation principles.
- [`16-glossary.md`](16-glossary.md) — terminology.
- [`17-sources-and-standards.md`](17-sources-and-standards.md) — current external standards and sources.
- [`19-risks-and-dependencies.md`](19-risks-and-dependencies.md) — durable product and architecture risks.
- [`20-record-lifecycles.md`](20-record-lifecycles.md) — record lifecycle principles.

## Structured reference collections

- [`adr/`](adr/) — Architecture Decision Records.
- [`architecture/`](architecture/) — enterprise architecture and taxonomy material.
- [`branding/`](branding/) — NuBlox brand system.
- [`../database/docs/`](../database/docs/) — schema-package design references.
- `career-taxonomy-seed.csv` and `career-taxonomy-seed.json` — career taxonomy seed/reference data.
- `sap-capability-coverage-register.csv` — benchmark coverage register; SAP is a benchmark, not a dependency.

## Documentation rules

New documentation must follow these rules:

- Update the governing Construction and Built Environment model rather than creating overlapping sector architecture.
- Prefer updating an existing governing document over adding another specification.
- Do not create numbered implementation-slice documents.
- Do not duplicate database schema documentation already represented by SQL migrations or `database/docs/`.
- Record significant technical choices as ADRs.
- Track delivery plans, backlog, implementation status and temporary decisions in GitHub issues rather than permanent architecture docs.
- State whether a document is **governing**, **reference**, **proposal**, **compatibility** or **historical** when authority could be ambiguous.
- Never treat career taxonomy, organisation role, project role and permission as interchangeable concepts.
- Keep tenant, project, permission, audit and correction semantics explicit in every domain design.
- Treat external classifications and standards as versioned overlays/reference data, not irreversible schema assumptions.

## Historical material

Superseded roadmap, backlog, implementation-slice, package-activation and duplicate architecture documents were removed from the active documentation set during the August 2026 consolidation. Their full history remains recoverable through Git.