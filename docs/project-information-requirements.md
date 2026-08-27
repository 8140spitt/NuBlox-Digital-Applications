# Project information requirements and responsibility governance

## Purpose

NuBlox treats project information requirements as governed obligations around the existing Common Data Environment (CDE), not as a second document register.

The model supports four requirement classes:

- **OIR** — organisational information requirements.
- **AIR** — asset information requirements.
- **PIR** — project information requirements.
- **EIR** — exchange information requirements.

A requirement defines what controlled information is expected, when it is needed and the minimum container type, purpose and suitability controls where these are known.

## Canonical CDE boundary

The authoritative information master remains:

- `information_containers`
- `information_container_versions`
- `information_files`
- controlled issue events, reviews and transmittals

`project_information_requirements` does not duplicate a document/model master. Instead, `project_information_requirement_containers` links a requirement to an existing controlled information container as fulfilment evidence.

A linked container fulfils an approved requirement only when NuBlox can identify an **issued** revision that matches the requirement's purpose and suitability controls when those controls are specified.

## Responsibility matrix

`project_information_requirement_responsibilities` records RACI responsibility against the project's controlled organisation-role assignments.

Each assignment therefore identifies:

1. the project information requirement;
2. an active project participant organisation;
3. an existing `project_role_type` assigned to that organisation; and
4. one RACI responsibility: Responsible, Accountable, Consulted or Informed.

The matrix deliberately references project roles rather than careers, application permissions or free-text job titles. This keeps delivery accountability separate from professional taxonomy and authorization.

An information requirement cannot be approved until it has at least one **Responsible** or **Accountable** assignment.

## Lifecycle

### Draft

A permitted member may create and edit the requirement definition and replace its RACI matrix.

### Approved

Approval records the approving organisation member and timestamp. Definition fields and the RACI matrix are then locked. CDE evidence can continue to be linked as delivery progresses.

### Withdrawn

An approved requirement may be withdrawn only with a controlled reason, actor and timestamp. Withdrawn requirements cannot receive or remove fulfilment evidence.

## Derived delivery health

The workspace derives a health state rather than storing another lifecycle field:

- **Draft** — requirement is not approved.
- **Open** — approved and awaiting qualifying issued evidence.
- **Overdue** — approved, past the required-by date and still awaiting qualifying evidence.
- **Fulfilled** — approved and at least one linked container has a qualifying issued revision.
- **Withdrawn** — controlled requirement has been withdrawn.

This makes delivery health a reproducible view of governed source records rather than mutable status data.

## Permissions

The slice introduces:

- `information.requirement.manage`
- `information.requirement.approve`
- `information.responsibility.manage`
- `information.requirement.link`

Standard Owner, Administrator and Manager roles receive all four. Member/Professional receives draft-management, responsibility and evidence-linking permissions but not approval. Read-only and specialist standard roles retain their existing information permissions.

## Audit boundary

NuBlox emits audit evidence for:

- requirement creation and draft updates;
- responsibility-matrix replacement;
- approval;
- withdrawal;
- CDE evidence linking and unlinking.

Every event carries the active organisation, internal member actor, project, correlation ID and requirement public ID.

## Current collaboration boundary

This first delivery slice exposes fulfilment candidates from the owning organisation's active project CDE containers only. It does not automatically surface another participant organisation's private container metadata into the owner's requirement workspace.

Future federated CDE collaboration should extend this boundary through explicit sharing/exchange controls rather than weakening tenant isolation.

## Validation

The authoritative validation workflow applies all migrations to MySQL, regenerates Kysely types, verifies zero generated-type drift, runs the real-MySQL integration suite, Svelte type checks, unit tests, production build and Playwright browser acceptance.