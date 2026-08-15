# 08 — API and Integrations

## 1. API principle

Internal UI interactions may use native SvelteKit form actions/server functions/endpoints as appropriate. External consumers require a stable explicit API contract.

Do not expose database-shaped CRUD endpoints as the product architecture.

## 2. External API baseline

Recommended:

```text
/api/v1/...
```

Characteristics:

- HTTPS only;
- JSON for structured APIs;
- explicit authentication/authorisation;
- tenant context;
- pagination;
- stable error envelope;
- idempotency support for retried writes;
- rate limiting;
- correlation/request identifiers;
- audit for sensitive actions.

## 3. Resource examples

```text
GET  /api/v1/projects
POST /api/v1/projects
GET  /api/v1/projects/{publicId}
GET  /api/v1/projects/{publicId}/documents
POST /api/v1/projects/{publicId}/rfis
POST /api/v1/work-orders
GET  /api/v1/assets/{publicId}
```

Exact resource design is subject to API discovery.

## 4. Error contract

```json
{
  "error": {
    "code": "PROJECT_ACCESS_DENIED",
    "message": "You do not have access to this project.",
    "requestId": "..."
  }
}
```

Do not leak internal database errors, stack traces or existence of inaccessible tenant resources.

## 5. Idempotency

Required for APIs/webhooks where clients may retry.

Examples:

- invoice creation;
- payment callbacks;
- document metadata creation;
- integration imports;
- webhook event processing.

Store or otherwise enforce idempotency keys with tenant/integration context and expiry policy.

## 6. Webhooks

Future webhook support should include:

- event identifier;
- event type;
- tenant context;
- timestamp;
- signed payload;
- retries with backoff;
- delivery history;
- dead-letter/manual replay;
- no sensitive data beyond necessity.

Possible events:

- `quote.accepted`
- `invoice.issued`
- `invoice.paid`
- `project.created`
- `document.issued`
- `rfi.created`
- `variation.approved`
- `work_order.completed`
- `asset.service_due`

## 7. Integration categories

### Accounting

Integrate operational finance with external accounting software rather than assuming NuBlox must provide a statutory ledger.

### Payments

Payment links/status may be integrated; card data should not be stored by NuBlox unless a PCI-compliant architecture is explicitly commissioned.

### Email/calendar

Use adapters for outbound email, inbound workflow capture where approved, and calendar synchronisation.

### E-sign

Use an integration boundary for customer approvals, appointments and contracts.

### Storage

Binary file/object storage provider must be abstracted.

### BIM/CDE

Potential later integration for document/model references, issue exchange and handover data. NuBlox is not initially a BIM authoring tool.

### Maps/geospatial

Geocoding/map providers should be replaceable and usage/privacy implications assessed.

### AI

All model access goes through a NuBlox AI gateway/service that enforces:

- permission-scoped context;
- prompt/data minimisation;
- provider configuration;
- audit/provenance;
- human approval policy.

## 8. Import/export

Core registers should support controlled CSV import/export.

Bulk import requires:

- validation report;
- dry-run/preview where practical;
- row-level errors;
- idempotent reprocessing strategy;
- tenant-scoped lookup;
- audit of importer and source file.

## 9. File upload API

Use direct-to-storage upload patterns where beneficial, with server-issued authorisation and subsequent verification.

Never trust:

- filename;
- client MIME type;
- file extension;
- object metadata supplied only by browser.

## 10. Versioning

Breaking external API changes require a versioning/deprecation policy. Internal application interfaces may evolve with the monolith but must retain automated contract coverage between modules where boundaries are important.
