# 08 — API, Interoperability and External Exchange

## 1. Governing principle

NuBlox is a native ERP. APIs and external connectivity exist for **interoperability, statutory exchange, transport, migration and customer-controlled coexistence**. They are not a substitute for missing core NuBlox modules.

Internal UI interactions may use native SvelteKit form actions/server functions/endpoints as appropriate. External consumers require a stable explicit API contract.

Do not expose database-shaped CRUD endpoints as the product architecture.

## 2. Native ownership boundary

For a material NuBlox business process, NuBlox owns:

- canonical business records;
- lifecycle/workflow state;
- tenant/project scope;
- permissions and segregation of duties;
- audit evidence;
- accounting/commercial consequences;
- reporting semantics.

An external provider may carry or exchange data without becoming the authoritative workflow engine simply because NuBlox lacks a native capability.

Examples:

- bank feeds support the native NuBlox cash/bank ledger and reconciliation process;
- payment processors execute payment rails while NuBlox owns invoices, receipts, allocation and accounting evidence;
- statutory submission endpoints receive data from native NuBlox accounting/payroll/compliance modules;
- email/SMS services transport communications while NuBlox owns the related business workflow/evidence;
- BIM/open-standard exchange shares controlled information while NuBlox owns its native design/CDE records;
- e-signature services may provide cryptographic/signing transport while NuBlox owns contract lifecycle, approvals and executed evidence.

## 3. External API baseline

Recommended:

```text
/api/v1/...
```

Characteristics:

- HTTPS only;
- JSON for structured APIs;
- explicit authentication/authorisation;
- tenant context;
- resource/scope permissions;
- pagination;
- stable error envelope;
- idempotency support for retried writes;
- rate limiting;
- correlation/request identifiers;
- audit for sensitive actions;
- versioned contracts and deprecation policy.

## 4. Resource examples

```text
GET  /api/v1/projects
POST /api/v1/projects
GET  /api/v1/projects/{publicId}
GET  /api/v1/projects/{publicId}/documents
POST /api/v1/projects/{publicId}/rfis
POST /api/v1/work-orders
GET  /api/v1/assets/{publicId}
GET  /api/v1/suppliers/{publicId}/orders
POST /api/v1/material-receipts
GET  /api/v1/ledger/accounts
```

Exact resource design follows native domain services and must not create a second business model for API clients.

## 5. Error contract

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

## 6. Idempotency

Required for APIs/webhooks/exchange boundaries where callers may retry.

Examples:

- invoice/payment exchange;
- bank transaction import;
- document/model metadata exchange;
- statutory submission acknowledgement;
- material/delivery events;
- integration migration/import batches;
- webhook event processing.

Idempotency keys must include tenant/integration context and an explicit retention/expiry policy.

## 7. Webhooks and events

Webhook support should include:

- event identifier;
- event type/version;
- tenant context;
- timestamp;
- signed payload;
- retries with backoff;
- delivery history;
- dead-letter/manual replay;
- least-data payload design.

Possible events:

- `quotation.accepted`
- `contract.executed`
- `invoice.issued`
- `invoice.paid`
- `supplier_invoice.approved`
- `purchase_order.issued`
- `goods_receipt.recorded`
- `project.created`
- `document.issued`
- `rfi.created`
- `variation.approved`
- `work_order.completed`
- `asset.service_due`

The internal event/outbox architecture is also a native automation foundation and must not be constrained by external webhook payloads.

## 8. Interoperability categories

### Banking and payments

NuBlox provides native AR, AP, ledger, bank/cash and reconciliation capability. External banking/payment rails exchange statements, confirmations and payment instructions; they do not replace those modules.

### Statutory authorities

Tax, payroll, company/reporting and sector-specific submissions may require external government/regulatory endpoints. NuBlox remains the system that calculates, controls, approves and evidences the underlying records.

### Communications

Email, SMS, push and calendar protocols/providers are transport boundaries. NuBlox owns notifications, tasks, approvals and business correspondence metadata/evidence.

### Electronic signing

NuBlox owns approval and contract/document lifecycle. External trust/signature services may be used where legally/technically appropriate, but signing integration is not the contract-management system.

### Storage

Binary/object storage is infrastructure. NuBlox owns metadata, versioning, permissions, integrity, retention and information-container lifecycle.

### BIM, GIS and open standards

NuBlox must provide native design/information/BIM and geospatial business capability appropriate to its ERP workflows. IFC/BCF/COBie and other open-standard exchange may connect participants and legacy systems without making another CDE/BIM product mandatory.

### Identity federation

SSO/federation can delegate authentication to trusted identity providers while NuBlox retains organisation membership, role, capability and authorisation semantics.

### AI/model services

AI capability is governed through NuBlox business services enforcing:

- permission-scoped context;
- prompt/data minimisation;
- provider/model abstraction where appropriate;
- audit/provenance;
- deterministic validation for consequential data;
- human approval policy.

AI infrastructure is not permitted to become an ungoverned parallel system of record.

## 9. Import/export and migration

Core registers should support controlled import/export and standards-based exchange.

Bulk import requires:

- validation report;
- dry-run/preview where practical;
- row-level errors;
- idempotent reprocessing strategy;
- tenant-scoped lookup;
- canonical-master-data matching/deduplication;
- audit of importer and source file.

Migration tooling exists to bring customers into NuBlox, not to preserve permanent dependency on the legacy product.

## 10. File/model upload API

Use direct-to-storage upload patterns where beneficial, with server-issued authorisation and subsequent verification.

Never trust:

- filename;
- client MIME type;
- file extension;
- object metadata supplied only by the browser.

Controlled information/model records must still carry native NuBlox lifecycle, revision, status, classification, permission and audit semantics.

## 11. Versioning

Breaking external API changes require a versioning/deprecation policy. Internal application interfaces may evolve with the modular monolith but must retain automated contract coverage between domain boundaries where integrity is important.

## 12. Product gate

No interoperability proposal is accepted if its primary justification is: “NuBlox does not have this core business capability.” In that case the missing native capability must first be entered into the ERP capability architecture in `57-world-class-native-erp-architecture.md`.
