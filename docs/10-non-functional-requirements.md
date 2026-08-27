# 10 — Non-functional Requirements

These are baseline targets for design and estimation. Final service levels must be agreed contractually.

## NFR-01 Availability

- Production target: design for **99.9% monthly service availability** excluding agreed maintenance, once the service reaches production maturity.
- Critical external dependencies and their effect on availability must be documented.
- Graceful degradation is preferred where third-party integrations fail.

## NFR-02 Performance

For normal interactive structured-data requests under agreed reference load:

- server response P95 target: **<500 ms** for typical CRUD/register operations excluding large file processing and third-party calls;
- slow query logging/monitoring enabled;
- no unbounded list endpoints;
- pagination required for large registers.

Performance test scenarios and data volumes must be agreed before launch.

## NFR-03 Scalability

Architecture must permit:

- many organisations;
- many projects per organisation;
- high document counts;
- long-lived asset history;
- background workload growth.

No code path should require loading all tenant records into memory.

## NFR-04 Security

- OWASP ASVS 5.0.0 should be used as the security verification baseline, with target level agreed during threat modelling.
- OWASP Top 10:2025 risks must be explicitly considered.
- tenant isolation is mandatory;
- TLS in transit;
- encryption at rest for production data/storage using platform capabilities;
- secrets managed outside source code;
- dependency scanning and patch process.

## NFR-05 Privacy

- privacy by design/default;
- data minimisation;
- configurable retention;
- data-subject support processes;
- export/deletion/anonymisation capability where legally appropriate;
- processor/subprocessor inventory.

## NFR-06 Accessibility

- WCAG 2.2 Level AA target for production web UI.
- Automated checks are insufficient; manual keyboard and assistive-technology testing must be included.

## NFR-07 Data integrity

- database transactions for multi-record invariants;
- foreign keys/constraints where practical;
- issued/approved versions preserved;
- audit history;
- integrity checks for stored files.

## NFR-08 Backup and recovery

Baseline production target for planning:

- encrypted backups;
- automated backup verification;
- restore tests;
- proposed **RPO ≤ 15 minutes** for transactional data where infrastructure supports it;
- proposed **RTO ≤ 4 hours** for a major service recovery.

The supplier must state the cost/architecture implications and propose final contractual targets.

## NFR-09 Observability

Required:

- structured logs;
- error monitoring;
- performance metrics;
- health checks;
- audit events;
- security alerting;
- correlation IDs.

Logs must not routinely contain secrets or unnecessary personal data.

## NFR-10 Maintainability

- TypeScript for application code unless exception is justified;
- domain boundaries documented;
- automated lint/type/test pipeline;
- migration discipline;
- code review;
- architecture decisions recorded;
- no business logic duplicated across route handlers.

## NFR-11 Compatibility

Support policy to be agreed, but baseline should include current supported releases of major evergreen desktop/mobile browsers.

Do not build critical workflows that require one browser engine without an explicit product decision.

## NFR-12 Internationalisation/regionalisation

UK-first does not mean UK-hard-coded.

Configurable concepts include:

- locale;
- timezone;
- currency;
- tax terminology/rules;
- units;
- address formats;
- date formats;
- regulatory templates.

## NFR-13 Auditability

Material actions must be attributable to:

- actor;
- organisation;
- project/context where relevant;
- time;
- action;
- affected record.

Audit access itself must be permission controlled.

## NFR-14 Data portability

Authorised customers must be able to export core structured business records in documented formats. Contractual exit/data-extraction requirements must be included before production procurement.

## NFR-15 Resilience

- retries use backoff and idempotency;
- failed background work is visible/recoverable;
- third-party outage does not corrupt local transaction state;
- partial multi-step operations have compensating/recovery behaviour.

## NFR-16 File handling

Limits to be agreed by file type/use case.

Required:

- upload size enforcement;
- safe file naming;
- malware scan;
- content-type verification;
- no arbitrary executable serving;
- access-controlled downloads;
- version history.

## NFR-17 Audit/security retention

Retention periods must be policy-driven rather than hard-coded. Security logs, audit logs, business documents and personal data may require different policies.

## NFR-18 Request-boundary hardening

- API and form-action boundaries must treat malformed JSON/body payloads as controlled client errors (4xx) rather than unhandled 5xx failures.
- Authentication, tenancy and permission denials must fail closed with stable, non-leaky error responses.
- Correlation identifiers accepted from inbound headers must be validated (allowed character set and bounded length) or replaced by server-generated values.

## NFR-19 Sensitive logging discipline

- Structured operational logs must avoid raw personal data by default (for example full email addresses and free-form external identifiers in INFO/WARN logs).
- Security-relevant events may include required identifiers, but with minimisation/redaction and explicit retention/access policy.
- Log schemas must distinguish operational diagnostics from audit evidence so that troubleshooting does not become an uncontrolled data store.
