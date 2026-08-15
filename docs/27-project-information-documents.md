# 27 — Project Information and Documents Domain Model

## 1. Purpose

This specification defines NuBlox Schema Package 007: project information management, documents, revisions, transmittals, RFIs, submittals, instructions, change events and review/approval evidence.

The governing rule is:

> **A document has a stable identity; revisions are immutable versions of that document.**

NuBlox must never treat a new drawing revision as an overwrite of the previous revision.

## 2. Scope

Package 007 covers:

- project sites and information-container registers;
- document identity and controlled classifications;
- immutable document revisions/versions;
- binary-file metadata (not binary payloads in MySQL);
- revision purpose/status metadata;
- transmittals and recipients;
- RFIs and responses;
- submittals, reviews and outcomes;
- formal project instructions;
- change-event register;
- typed links between information records;
- review/approval workflows and evidence;
- cross-organisation information ownership on shared projects.

Binary files remain in object storage. MySQL stores authoritative metadata, identifiers, checksums, revision history and workflow evidence.

## 3. Dependencies

Package 007 depends on:

- organisations and organisation members;
- projects and `project_organisations`;
- project roles/participants;
- Party/CRM records where external recipients are required;
- audit/event principles;
- the existing project tenant candidate key.

## 4. Normalisation target

The domain targets **3NF by default**.

Key rules:

1. Document identity is separate from document revision/version.
2. File payload metadata is separate from business revision metadata.
3. Revisions are not represented by columns such as `revision_1`, `revision_2`, etc.
4. One transmittal may contain many document versions and one document version may appear on many transmittals; this is represented by an associative table.
5. Reviewers, recipients and information links use associative tables rather than delimited lists.
6. RFI responses do not overwrite the RFI question.
7. Submittal reviews do not overwrite the submitted item.
8. Instructions and change events are independent business records even where they reference the same document/RFI/submittal.
9. Stable workflow/status reference data is relational, not embedded JSON.
10. Binary objects are not stored in MySQL BLOB columns in the baseline architecture.

## 5. Shared-project ownership

Project information may originate from any NuBlox organisation that is a valid participant in the project.

For project-owned information records, the schema carries:

- `project_id`;
- `owning_organisation_id`.

The pair is constrained against:

```text
project_organisations(project_id, participant_organisation_id)
```

This permits, for example, an architect, engineer and contractor to own different controlled information records in one shared NuBlox project without transferring organisational ownership of their information.

Authorisation remains additional to relational ownership: participation does not automatically grant visibility to every record.

## 6. Information-container model

`information_containers` are stable project information identities. Typical container types include:

- drawing;
- specification;
- schedule;
- report;
- calculation;
- model;
- certificate;
- method statement;
- photograph set;
- other controlled information.

A container has a project-scoped reference/number and title. Its revisions live in `information_container_versions`.

Example:

```text
A-101 — Ground Floor General Arrangement
├── P01
├── P02
├── C01
└── C02
```

`A-101` is the stable information-container identity. `P01`, `P02`, `C01` and `C02` are separate immutable version records.

## 7. Version immutability

A draft version may be edited while it remains draft.

Once issued/published, normal application writes must not modify authoritative content metadata such as:

- revision code;
- title at issue;
- purpose of issue;
- status/suitability at issue;
- checksum;
- storage key;
- file size/type;
- issue timestamp;
- issuing actor.

Corrections produce another version.

Supersession changes lifecycle state/evidence; it does not rewrite the old revision.

## 8. File model

`information_files` stores object-storage metadata:

```text
storage_provider
storage_bucket/container
storage_key
original_filename
content_type
size_bytes
checksum_algorithm
checksum_value
```

One information-container version may have multiple files where required, for example native authoring file + PDF rendition + IFC model.

`file_role` distinguishes authoritative/native/rendition/thumbnail/attachment representations.

## 9. Transmittals

A transmittal is a formal issue event, not merely an email timestamp.

Model:

```text
transmittal
├── recipients
└── items
    └── exact information-container version
```

This allows NuBlox to answer exactly which revision was sent, to whom, by whom, when and for what purpose.

## 10. RFIs

RFIs use separate records for:

- question/header;
- addressees;
- responses;
- response attachments/information links;
- close/acceptance state.

Typical lifecycle:

```text
draft → open → answered → closed
                 ↘ reopened
open → cancelled
```

An answer never replaces the original question.

## 11. Submittals

Submittals represent controlled information submitted for review/approval.

A submittal may include one or more exact information-container versions.

Review outcomes include configurable controlled values such as:

- approved;
- approved with comments;
- revise and resubmit;
- rejected;
- no objection;
- for information.

The reviewer outcome is evidence and remains historical.

## 12. Instructions

Formal instructions are independent immutable business records once issued.

An instruction may reference:

- project;
- recipient organisations/members;
- information-container versions;
- RFI;
- submittal;
- change event.

An instruction is not implemented as a free-text field added to another record because it has its own issuer, sequence, issue date, recipients and contractual significance.

## 13. Change events

`project_change_events` form a neutral project change register before later commercial treatment in Package 009.

Examples:

- design change;
- client request;
- site condition;
- statutory requirement;
- instruction-driven change;
- scope clarification.

Package 009 may later convert or link these events to commercial variations without overwriting their information-management history.

## 14. Typed links

Information records frequently reference one another.

Package 007 uses controlled typed link tables rather than a universal EAV store.

Examples:

```text
RFI → related drawing version
Submittal → specification version
Instruction → RFI
Change event → instruction
Document version → supersedes document version
```

Links are evidence/context; they do not replace normal domain foreign keys where a strong relationship exists.

## 15. Reviews and approvals

Review workflows separate:

- workflow definition/instance;
- ordered steps;
- reviewers;
- review decisions/comments;
- completion state.

A future UI may expose lightweight approval for small firms and multi-stage review for larger project teams while preserving the same relational model.

## 16. Storage and security

Files are stored outside MySQL using private object storage.

Requirements:

- unguessable object keys;
- server-side authorisation before download/upload;
- short-lived signed access where appropriate;
- malware scanning/quarantine pipeline;
- checksum verification;
- no trust in client-supplied MIME type alone;
- retention/version rules consistent with contractual and regulatory requirements;
- audit of upload, issue, download where required, supersession and deletion/retention actions.

## 17. Derived values

The following should normally be derived rather than maintained as duplicate editable fields:

- latest revision;
- current issued revision;
- number of transmittal recipients;
- RFI response count;
- overdue RFI state from due date + workflow status;
- submittal review completion;
- document review completion;
- superseded/current presentation flags where derivable from version relationships/status.

Materialised projections may be introduced later for performance, but never as competing authoritative facts.

## 18. Application invariants

The application/domain layer must additionally enforce and test:

1. A project information owner must be an active/authorised project participant for the relevant action.
2. An issued version cannot be modified through standard write APIs.
3. Revision identifiers are unique within their information container.
4. A transmittal may include only versions visible/issueable to the issuing organisation.
5. RFI/submittal/instruction references cannot cross unrelated projects.
6. Closing an RFI requires the configured closure policy.
7. Reviewers cannot approve outside their effective permission/project scope.
8. Supersession relationships cannot form cycles.
9. File checksums/object keys become immutable once the associated version is issued.
10. Cross-organisation visibility is permission-controlled in addition to FK-valid project participation.
11. File upload and issue operations write audit/outbox events transactionally with metadata changes where practicable.
12. Hard deletion of issued project information is prohibited through normal business APIs; retention/void/supersession rules apply.

## 19. Package boundary

Package 007 deliberately stops before site-quality/safety transactional records. Package 008 will build on these information containers and project references for site diaries, inspections, NCRs, defects, incidents, RAMS/toolbox/safety records and associated evidence.