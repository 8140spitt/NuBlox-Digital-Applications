# Project risk, issue, decision and action registers

## Purpose

NuBlox project controls now provides a governed RIDA workspace for uncertainty, active problems, project decisions and their follow-up actions.

The implementation deliberately preserves domain authority:

- **Risks** are prospective threats or opportunities with probability, impact and response treatment.
- **Issues** are current problems with severity, impact and resolution planning.
- **Decisions** are controlled project-governance records with an explicit required date, authoritative outcome, rationale and attributable decision maker.
- **Actions** are not duplicated into a project-controls task table. They are canonical Work Kernel `work_items` linked to their originating RIDA record.

## Canonical records

`project_control_register_items` is owned by the project owning organisation and carries an immutable public identity plus type-scoped sequence number.

Risk lifecycle:

`open → monitoring → realised → closed`

Issue lifecycle:

`open → investigating → resolved → closed`

Decision lifecycle:

`proposed → pending → decided → superseded`

The service constrains allowed movements and uses optimistic status checks so stale requests cannot silently overwrite a concurrent lifecycle change.

## Risk control

A risk records:

- threat or opportunity direction;
- probability and impact scores from 1–5;
- optional response strategy: avoid, reduce, transfer, accept, exploit, enhance or share;
- response plan;
- optional residual probability and impact scores after treatment;
- owner, priority and due date.

The database rejects incomplete or out-of-range risk scoring and prevents risk-only fields from leaking into issue or decision records.

## Issue control

An issue records:

- severity;
- current impact;
- resolution plan;
- owner, priority and due date.

Closing an issue is a controlled operation that attributes the closing member and timestamp. The same closure evidence applies to risks.

## Decision control

A decision starts as a proposal and may be moved to pending. Only `project.rida.decide` authority (or the existing `project.manage` umbrella) may record the authoritative outcome.

A decided record captures:

- decision outcome;
- rationale;
- deciding organisation member;
- decision timestamp.

The database requires decided/superseded decisions to retain this evidence and prohibits decision outcome evidence on risk and issue records.

## Action register and Work Kernel boundary

RIDA follow-up actions use the existing canonical Work Kernel rather than a parallel project action master.

Each action is created as:

- `work_item_kind = 'action'`;
- `source_domain = 'project_controls'`;
- `source_type = 'project_rida_item'`;
- `source_public_id = <project_control_register_items.public_id>`.

That means project actions automatically retain the Work Kernel's assignment, status, completion, event, audit and outbox semantics and participate in **My work**. The RIDA workspace resolves these work items back into the Action register using the immutable source identity.

## Authority model

The RIDA capability introduces:

- `project.rida.view`
- `project.rida.manage`
- `project.rida.decide`
- `project.rida.close`

Default role grants are:

| Role | View | Manage | Decide | Close |
| --- | --- | --- | --- | --- |
| Owner | Yes | Yes | Yes | Yes |
| Administrator | Yes | Yes | Yes | Yes |
| Manager | Yes | Yes | Yes | Yes |
| Member/Professional | Yes | Yes | No | No |
| Field Worker | Yes | Yes | No | No |
| Finance/Commercial | Yes | No | No | No |
| Read Only | Yes | No | No | No |

All RIDA operations remain subject to active organisation membership and active project-member scope. The current register is confidential to the project owning organisation; external project participants do not inherit owner governance records merely because they can collaborate on the project.

Creating an action additionally requires Work Kernel creation authority.

## Evidence

Every RIDA create, update, lifecycle transition, decision and closure appends:

1. an immutable `audit_events` record with project, actor and correlation identity; and
2. an `outbox_events` record for downstream automation/integration without coupling the transaction to an external system.

Work Kernel actions retain their own Work Kernel event, audit and outbox evidence as well.

## User experience

The project workspace exposes `/projects/[projectPublicId]/rida` with:

- open risk, issue, pending-decision and open-action indicators;
- risk, issue and decision creation;
- governed lifecycle transitions;
- authoritative decision recording;
- controlled risk/issue closure;
- linked follow-up action creation;
- an aggregated Work Kernel-backed Action register.

The project-controls page navigation links Overview, Plan, Resources, Progress and RIDA so the registers sit alongside the schedule/resource/progress control loop rather than becoming a separate application silo.
