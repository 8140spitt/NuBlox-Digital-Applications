# V1 Slice 3 — Documents and Project Information activation

## Purpose

This slice activates Package 007 as a production NuBlox workspace. It does not create another document model: the Package 007 tables remain authoritative for stable information identity, immutable revision history, file metadata, issue evidence, RFIs, submittals and formal instructions.

The release exit condition is that controlled project information can be created, revised, issued and retrieved with server-side permission checks, effective project scope and attributable audit evidence.

## Activated product surface

The `/documents` workspace exposes four project-information registers:

- controlled document register;
- RFI register;
- submittal register;
- formal instruction register.

The Delivery navigation exposes Documents only when an `information.*` capability is effective. Quick Create exposes controlled documents, RFIs and project instructions only to members with the corresponding mutation permission.

## Controlled documents

A document is represented by a stable `information_containers` identity and one or more `information_container_versions` revisions.

The runtime enforces:

1. a document can only be created against a project in the actor's effective project membership scope;
2. the first revision is created atomically with the stable document identity;
3. new corrections create another revision sequence rather than rewriting an issued revision;
4. draft revision metadata can be edited;
5. issue changes a draft revision to `issued`, records the locking member/time and appends an `information_version_issue_events` evidence row;
6. issued revisions cannot be modified through ordinary business APIs;
7. discipline, classification, purpose and suitability remain structured metadata rather than being parsed from filenames;
8. all business mutations append an organisation/project-scoped audit event.

## File and object-storage boundary

Package 007 intentionally keeps binary payloads outside MySQL. Slice 3 therefore defines an `InformationStorageAdapter` boundary and records authoritative object metadata in `information_files` without pretending the database stores uploaded content.

The current UI supports registering existing object metadata: provider, bucket/container, object key, original filename, MIME type, size, checksum and file role. New metadata records remain in `pending` malware-scan state because this slice does not include a trusted object-store upload/scanner implementation.

A deployment must not claim binary upload/download or malware-cleared object support until a private storage adapter and trusted scanner are configured. Package 007's rule that unsafe authoritative objects must not be issued remains a required control at that integration boundary.

## RFI policy

RFIs use Package 007 `rfis` and append-oriented `rfi_responses`.

The V1 Slice 3 workflow is deliberately single-organisation:

- an authorised project member creates a draft RFI;
- an authorised information manager opens it;
- an authorised responder in the owning project organisation records a response;
- a final response moves the RFI to `answered`;
- an information manager closes an answered RFI.

Cross-organisation addressees, external portal recipients and multi-party response routing are deferred to the collaboration slice. FK participation alone does not create UI visibility: every read/write is filtered by active tenant context and effective project membership.

## Submittal policy

Submittals use Package 007 `submittals`, `submittal_items`, `submittal_reviewers` and `submittal_reviews`.

The activated workflow supports:

- draft creation;
- optional linkage to an exact document revision from the same project;
- controlled submission;
- an organisation-level review assignment;
- approved / approved-with-comments / revise-and-resubmit / rejected / no-objection / for-information outcomes;
- prohibition on the submitting member reviewing their own submittal.

Submitted item sets are not exposed to ordinary edit APIs.

## Formal instruction policy

Instructions use Package 007 `project_instructions` and controlled instruction types. An authorised member may create a draft. Only a member with `information.instruction.issue` may issue it. Once issued, the current slice exposes no ordinary edit operation; correction/supersession is an additive future transition rather than an overwrite.

## Permissions

Slice 3 introduces:

- `information.view`
- `information.manage`
- `information.file.manage`
- `information.issue`
- `information.rfi.manage`
- `information.rfi.respond`
- `information.submittal.manage`
- `information.submittal.review`
- `information.instruction.manage`
- `information.instruction.issue`

The migration grants defaults to existing standard roles. `ensureInformationStandardRoleDefaults` applies the same defaults whenever a new organisation is created, preserving old/new tenant parity.

## Acceptance contract

Release validation must prove:

- migration and generated database types remain deterministic;
- a stable document + first revision can be created;
- an issued revision is locked and has append-only issue evidence;
- issued revision overwrite is rejected and a new revision is accepted;
- a same-tenant member outside project membership cannot read or mutate the project information;
- RFI lifecycle transitions are controlled and audited;
- submittal self-review is rejected and independent review succeeds;
- formal instruction issue is controlled and repeat issue is rejected;
- unauthenticated `/documents` requests preserve the sign-in return target;
- read-only users can see the workspace without mutation controls;
- an owner can perform the core project → document → revision → issue → RFI → submittal → instruction browser flow.

## Deliberately deferred Package 007 capabilities

These schema primitives remain available but are not prematurely activated in Slice 3:

- external/private object-storage upload and download implementation;
- malware scanning/quarantine automation;
- transmittals and external recipients;
- cross-organisation document visibility and issue routing;
- project portal collaboration;
- generic multi-step information review workflows;
- explicit supersession/withdrawal UI and graph-cycle validation;
- RFI external addressee routing and reopen policy;
- instruction recipient acknowledgement and supersession;
- project change-event workflow;
- generic cross-module task capability.

Those boundaries belong to later V1 collaboration/change-control slices and must not be inferred from schema availability alone.
