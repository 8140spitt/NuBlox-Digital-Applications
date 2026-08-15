# 12 — DevOps, Environments and Testing

## 1. Environments

Minimum:

- Local development
- Automated test/CI
- Staging/UAT
- Production

Production secrets/data must not be copied into lower environments without an approved sanitisation process.

## 2. Source control

Recommended:

- protected `main`;
- short-lived feature branches;
- pull requests;
- required CI;
- required review;
- clear commit history;
- tagged releases.

Architecture-significant changes should add/update an ADR.

## 3. CI pipeline

At minimum:

1. install from lockfile;
2. format/lint checks;
3. TypeScript checks;
4. unit tests;
5. integration/database tests;
6. build;
7. dependency/security checks;
8. selected accessibility checks;
9. migration validation.

## 4. CD pipeline

Production deployment must include:

- immutable build artifact/image where applicable;
- environment-specific configuration;
- migration plan;
- health checks;
- rollback/recovery path;
- release metadata;
- audit/change record.

## 5. Database migrations

- committed to source;
- reviewed;
- tested from representative prior schema;
- backwards-compatible deployment strategy where practical;
- backup/recovery plan for destructive changes;
- no ad-hoc manual production schema changes.

## 6. Test pyramid

### Unit tests

For:

- calculations;
- domain policies;
- status transitions;
- permission logic;
- parsers/formatters.

### Integration tests

For:

- repositories;
- MySQL constraints;
- transactions;
- auth/session;
- file metadata;
- integration adapters.

### End-to-end tests

Critical journeys:

- organisation onboarding;
- invitation;
- tenant switching;
- project creation;
- quote acceptance;
- document versioning;
- cross-tenant denial;
- project sharing;
- invoice issue;
- inspection/defect workflow;
- work-order completion.

### Security tests

- tenant isolation;
- horizontal/vertical privilege escalation;
- CSRF/session controls;
- injection;
- unsafe upload;
- rate limiting;
- export access.

### Accessibility tests

- automated accessibility tooling;
- keyboard-only;
- screen-reader sample journeys;
- zoom/reflow;
- forms/errors/focus.

### Performance tests

Use representative datasets, not empty databases.

## 7. Test data

Provide deterministic seed factories for:

- organisations;
- users/members;
- careers/capabilities;
- clients;
- projects;
- documents;
- commercial records;
- assets;
- work orders.

Include adversarial tenancy test fixtures.

## 8. Observability

Production must expose:

- health/readiness;
- error tracking;
- structured logs;
- request/job correlation;
- queue/job failures;
- DB/query performance;
- integration health.

## 9. Secrets

- environment/secret manager;
- never source control;
- rotation procedure;
- separate production/non-production credentials;
- least privilege;
- API key ownership inventory.

## 10. Backups

Supplier must document:

- schedule;
- encryption;
- retention;
- geographic/storage strategy;
- restore procedure;
- restore-test frequency;
- RPO/RTO evidence.

## 11. Release gates

A release cannot progress to production if:

- critical tests fail;
- tenant-isolation tests fail;
- unresolved critical/high security defect exceeds agreed policy;
- migration rollback/recovery is undefined;
- required monitoring is absent;
- acceptance criteria for the release are incomplete.
