# 11 — Security, Privacy and Compliance

## 1. Position

NuBlox will store commercially sensitive, personal, contractual, safety, quality and potentially regulated building information. Security and audit design are therefore core product requirements.

This specification does **not** assert that NuBlox automatically makes a customer compliant with any law or professional standard. It defines controls needed to support compliant workflows.

## 2. Security baseline

Use:

- OWASP ASVS 5.0.0 as an application-security verification baseline;
- OWASP Top 10:2025 for awareness/threat coverage;
- threat modelling before production;
- least privilege;
- secure defaults;
- server-side authorisation.

## 3. Primary threats

Threat model must include:

- cross-tenant data access;
- broken project sharing/access control;
- account takeover;
- privilege escalation;
- insecure direct object reference;
- injection;
- malicious file upload;
- sensitive data in logs;
- exposed object storage;
- insecure integration credentials;
- webhook spoofing/replay;
- supply-chain dependency compromise;
- AI prompt/context data leakage if AI is enabled;
- bulk export abuse;
- unauthorised support/admin access.

## 4. UK data protection

The product should be designed around current UK data-protection obligations and ICO guidance.

Required design themes:

- data protection by design and default;
- data minimisation;
- purpose limitation;
- access control;
- retention controls;
- processing documentation;
- DPIA support for high-risk processing where applicable;
- processor/subprocessor contract awareness;
- breach logging and operational response.

Legal/accountability ownership remains with the relevant controller/processor organisations and must be confirmed in contractual/legal work.

## 5. Construction/built-environment regulatory support

### CDM 2015

The system should be capable of representing project participants, duties, safety information, evidence, acknowledgements and records relevant to workflows under the Construction (Design and Management) Regulations 2015.

The application must not determine legal dutyholder status solely from a generic project role without explicit configuration and legal/product review.

### Building safety / golden thread

For higher-risk buildings in England, government guidance requires applicable dutyholders/accountable persons to keep specified building information digitally.

NuBlox architecture should therefore preserve:

- authoritative record identity;
- revision/history;
- access control;
- traceability;
- structured links to building/assets;
- exportability;
- durable retention policies.

Whether NuBlox is marketed as a golden-thread system is a separate product/legal decision.

## 6. Authentication controls

- MFA for privileged users;
- secure recovery;
- session revocation;
- rate limiting/abuse protection;
- brute-force defence;
- suspicious authentication logging;
- no plaintext passwords;
- secrets never logged.

## 7. Authorisation controls

- deny by default;
- permissions checked on server for every sensitive operation;
- tenant context verified;
- record/project scope verified;
- no client-only permission enforcement;
- platform-support impersonation requires explicit, audited control if provided.

## 8. Database controls

- parameterised queries;
- separate least-privilege application DB credentials;
- migrations executed by controlled deployment identity;
- production DB not directly exposed to the public internet;
- encryption/backups;
- monitoring and restore tests.

## 9. File controls

- private by default;
- signed/time-limited download where appropriate;
- malware scanning;
- safe preview/transcoding;
- no trusting extension/MIME from client;
- integrity checksum;
- version immutability for issued records.

## 10. Audit controls

Audit should capture:

- login/security events;
- role/permission changes;
- membership changes;
- record sharing;
- document issue/supersede;
- approvals/rejections;
- variations/commercial approvals;
- invoice issue/void;
- inspections/certificates;
- export activity where sensitive.

Audit logs must not become editable notes.

## 11. Privacy data inventory

During discovery create a data inventory covering:

- account/contact information;
- employee/worker data;
- competency/certificate data;
- time/location/site records;
- photos;
- signatures;
- incident/safety records;
- customer data;
- communication metadata;
- AI prompts/outputs if enabled.

For each category identify purpose, lawful basis responsibility, retention, access, sharing and deletion/anonymisation strategy.

## 12. Secure development lifecycle

Required supplier practices:

- dependency lockfiles;
- dependency/security scanning;
- secret scanning;
- code review;
- SAST where practical;
- vulnerability management;
- threat modelling;
- penetration test before material production launch;
- remediation severity/SLA policy;
- security regression tests.

## 13. Incident readiness

Define:

- security contact;
- severity levels;
- triage;
- containment;
- evidence preservation;
- customer notification workflow;
- regulator/legal escalation process;
- post-incident review.

## 14. AI-specific controls

If AI is added:

- do not send inaccessible tenant data to models;
- configurable provider/data-retention controls;
- protect against prompt injection through untrusted documents;
- separate retrieved source content from system instructions;
- preserve provenance;
- human approval for contractual, safety or regulatory outputs;
- ability to disable AI per organisation.
