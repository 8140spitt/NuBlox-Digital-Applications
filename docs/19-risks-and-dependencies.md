# 19 — Risks and Dependencies

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R01 | Trying to build all 84 careers as separate products | Extreme complexity and duplication | Capability/domain architecture; pilot 3 contrasting roles |
| R02 | Career labels used as permissions | Security and maintainability failure | Separate career, capability, organisation permission and project access |
| R03 | Multi-tenancy added late | Cross-tenant leakage/rework | Tenant context in schema/services/tests from first sprint |
| R04 | Full accounting scope expands unexpectedly | Major programme expansion | Baseline operational finance + integrations; decide ledger scope explicitly |
| R05 | Regulated certificate workflows assumed generic | Legal/professional risk | Domain/legal validation before product claims/templates |
| R06 | Files treated as generic attachments | Loss of revision/audit integrity | Logical documents + immutable versions + metadata |
| R07 | Cross-organisation project sharing leaks data | Severe security/commercial risk | Explicit share model; deny by default; automated adversarial tests |
| R08 | Generic EAV/JSON data model | Poor integrity/reporting | Relational core; JSON only for justified extensions |
| R09 | Premature microservices | Delivery/operational overhead | Modular monolith; documented extraction criteria |
| R10 | Field workflows unusable on mobile | Adoption failure | Mobile-first testing for site workflows |
| R11 | Offline requirement discovered late | Architectural rework | Validate during pilot discovery |
| R12 | Supplier/vendor lock-in | Exit cost | Adapters, data export, IP/source ownership, documented infrastructure |
| R13 | AI introduced before data/permission foundations | Leakage/unreliable outputs | AI later; permission-scoped gateway; provenance; human approval |
| R14 | Regulatory rules hard-coded to UK/England | International expansion cost | Regional configuration layer |
| R15 | Audit logs capture too much sensitive data | Privacy/security exposure | Minimise structured change summaries; retention/access policy |
| R16 | Background retries duplicate business actions | Financial/workflow corruption | Idempotency keys/outbox and status invariants |
| R17 | Poor migration discipline | Production outages/data loss | Versioned migrations, staging, backups, rollback plan |
| R18 | Accessibility left to final QA | Costly redesign/exclusion | Design system + continuous accessibility testing |
| R19 | No clear record-state models | Invalid approvals/edits | Explicit state machines and server enforcement |
| R20 | National Careers Service taxonomy changes | Taxonomy drift | Source/version metadata; periodic review; preserve historical IDs |

## External dependencies

Potential dependencies to select during discovery:

- hosting/cloud;
- managed MySQL or database operations;
- object/file storage;
- transactional email;
- monitoring/error tracking;
- authentication/identity provider if used;
- accounting integration;
- payment/e-sign providers;
- maps/geocoding;
- malware scanning;
- AI provider if/when enabled.

Every dependency requires an owner, cost, service limit, data-processing assessment and exit strategy.
