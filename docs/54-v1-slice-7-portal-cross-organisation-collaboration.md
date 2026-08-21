# V1 Slice 7 — Portal & Cross-Organisation Collaboration

## Product boundary

Slice 7 activates NuBlox's existing project-participation and Package 007 collaboration model as a focused external-work portal. The V1 objective is not to mirror the internal application. It is to let authorised members of participating organisations see and complete only the work that another project organisation has explicitly assigned or issued to them.

The user experience is intentionally split:

- `/portal` is a low-friction shared-work inbox for invitations, assigned actions, issued information and shared projects;
- `/portal/manage` is an internal control surface for an owning organisation to assign or issue specific collaboration records.

This separation keeps response workflows simple while keeping heavier sharing administration out of the external participant's path.

An authorised participant can:

1. accept or decline an organisation-level project invitation when they hold the existing project participation authority;
2. see active projects where both their organisation participates and they are an active project member;
3. see an RFI only when their organisation is an explicit `rfi_addressee` and submit an attributable response;
4. see a submittal only when their organisation is an explicit `submittal_reviewer` and record a controlled review outcome;
5. see an instruction only when their organisation is an explicit `instruction_recipient` and acknowledge it with member/time attribution;
6. receive an exact issued or superseded controlled-information revision through a formal project-organisation transmittal;
7. perform those response actions without receiving ordinary organisation-internal document administration authority.

An authorised owning-organisation manager can:

1. assign an open owned RFI to an active external project participant;
2. assign a submitted owned submittal to an active external reviewer organisation;
3. add an active external participant as recipient of an issued owned instruction;
4. issue one exact owned controlled-information revision to an active participant through a portal transmittal.

## Source-of-truth rules

### Project participation

Package 001 remains authoritative for cross-organisation project participation.

`project_organisations` says an organisation participates. `project_members` says an organisation member has active project scope. Neither relation by itself grants visibility to arbitrary project or organisation records.

Organisation-level invitations continue to use the existing `ProjectTeamService` lifecycle and audit model. Slice 7 does not create a competing invitation table.

### Controlled information

Package 007 remains authoritative for every shared collaboration fact:

- `transmittal_recipients` controls formal information delivery;
- `rfi_addressees` controls which organisation may receive/respond to an RFI;
- `submittal_reviewers` controls which organisation may review a submittal;
- `instruction_recipients` controls formal instruction receipt and acknowledgement;
- `information_container_versions` remains the exact revision identity shared through a transmittal.

The portal never exposes the receiving organisation to the issuing organisation's general document register merely because they participate on the same project.

### Responses and acknowledgement

Portal responses are not shadow records. They append directly to the existing controlled collaboration facts:

- RFI responses → `rfi_responses` with responding organisation/member and response sequence;
- submittal decisions → `submittal_reviews` with reviewer organisation/member, outcome and sequence;
- instruction acknowledgement → `instruction_recipients.acknowledged_by_member_id` + `acknowledged_at`;
- shared information → `transmittals` + `transmittal_items` + project-organisation `transmittal_recipients`.

Every material action also appends normal NuBlox audit evidence.

## Access-control model

Slice 7 adds three organisation permissions:

```text
portal.view
portal.respond
portal.manage
```

Standard V1 defaults are:

- **Owner / Administrator / Manager** — view, respond and manage;
- **Member/Professional / Field Worker** — view and respond;
- **Finance/Commercial / Read Only** — view only.

These permissions are only the outer portal boundary.

### Visibility rule

Portal record visibility requires all of:

```text
active organisation membership
AND portal.view
AND active project organisation participation
AND active project membership
AND explicit Package 007 assignment/share relationship
```

For project cards themselves, the explicit record-assignment clause does not apply; active project participation plus active project membership defines the project list.

### Response rule

A portal mutation requires:

```text
active organisation membership
AND portal.respond
AND active project participation/member scope
AND the actor's organisation is the explicit addressee/reviewer/recipient
AND the source record is in a valid response lifecycle state
```

External response authority deliberately does **not** grant ordinary `information.manage`, `information.rfi.manage`, `information.submittal.manage` or `information.instruction.manage` access.

### Management rule

An internal sharing mutation requires:

```text
active organisation membership
AND portal.manage
AND actor is an active member of an actor-owned project
AND target organisation is an active external project participant
AND the relevant underlying information-domain permission
AND the source record is owned by the actor organisation and in a shareable state
```

Examples:

- RFI assignment also requires `information.rfi.manage`;
- submittal reviewer assignment also requires `information.submittal.manage`;
- instruction recipient assignment also requires `information.instruction.manage`;
- controlled revision transmittal also requires `information.issue`.

This preserves the internal controlled-information authority model rather than making `portal.manage` an umbrella around it.

## Controlled collaboration lifecycles

### Organisation invitation

```text
invited project organisation
    ↓ accept by authorised member
active project organisation + accepting member project scope
```

Decline remains explicit and attributable. Acceptance does not expose collaboration records until those records are separately assigned or issued.

### RFI

```text
owned open/reopened RFI
    ↓ explicit rfi_addressee
partner portal action
    ↓ attributable response
answered RFI when final response is submitted
```

RFI ownership remains with the source organisation. The partner response records the responding organisation and member.

### Submittal

```text
owned submitted/under_review submittal
    ↓ explicit submittal_reviewer
partner portal action
    ↓ controlled review outcome
reviewed submittal
```

Review outcomes remain the Package 007 controlled vocabulary.

### Instruction

```text
owned issued instruction
    ↓ explicit instruction_recipient
partner portal action
    ↓ attributable acknowledgement
recipient acknowledgement evidence
```

When every recipient has acknowledged, the instruction may move to `acknowledged` without erasing recipient-level evidence.

### Controlled information issue

```text
owned issued/superseded revision
    ↓ portal transmittal
exact transmittal item + exact participant recipient
    ↓
receiving organisation portal visibility
```

The V1 portal management surface creates immediate `delivered` evidence because the controlled item is posted directly into the authenticated recipient organisation's portal. It does not claim external email delivery.

## Usability principles introduced with Slice 7

The portal is the first V1 slice to make workflow-friction reduction an explicit acceptance concern.

- Action-first information hierarchy: things needing attention appear before registers.
- Progressive disclosure: response forms remain collapsed until a user chooses to act.
- External users are not shown internal navigation or unrelated organisation capabilities.
- Sharing administration is isolated from the response inbox.
- Every sharing form selects human-readable project records and participant organisations rather than exposing database identifiers.
- Narrow-screen layouts collapse to one column and retain touch-sized controls.
- Empty states explain the next prerequisite instead of presenting disabled form grids.

These patterns should inform later simplification passes over the internal workspaces.

## V1 acceptance boundary

Slice 7 is complete when permanent Complete System Validation proves:

- the portal permission catalogue and standard-role defaults are equivalent for existing and newly provisioned organisations;
- project participation alone does not expose RFI, submittal, instruction or document records;
- an accepted participant still requires active member-level project scope;
- explicit RFI assignment enables only the assigned partner organisation to respond;
- RFI responses retain source ownership while attributing the responding organisation/member;
- explicit submittal reviewer assignment enables controlled partner review;
- explicit instruction recipient assignment enables attributable acknowledgement;
- exact controlled revisions can be issued through a participant transmittal without exposing the source document register;
- view-only portal authority does not expose response or management mutations;
- unrelated organisations cannot read or mutate shared records;
- management actions require the underlying internal information-domain authority as well as `portal.manage`;
- `/portal` remains action-oriented and `/portal/manage` keeps administration separate;
- owner/partner browser acceptance exercises at least one genuine cross-organisation shared workflow;
- mobile-responsive portal behaviour remains intact;
- the complete permanent validation gate is green on the exact final PR head.

## Explicitly deferred

The following are outside this Slice 7 V1 boundary:

- anonymous guests or users who do not belong to a NuBlox organisation;
- magic-link guest access outside Better Auth organisation membership;
- white-label/customer-specific portal branding;
- chat, threaded comments or social activity feeds;
- notification/email orchestration for new assignments (Slice 9/shared workflows boundary);
- binary object-storage upload/download adapters beyond the existing controlled file metadata boundary;
- electronic signatures or formal execution ceremonies;
- bulk/multi-recipient transmittal authoring UI beyond the focused single-recipient V1 flow;
- a generic record-level ACL framework that competes with Package 007's explicit relationship tables;
- customer payment/self-service finance portal flows;
- offline-first portal synchronisation;
- public project links or search-indexable shared records.

Future extensions must preserve explicit project participation, member-level project scope, record-specific sharing, exact-version evidence, tenant ownership and attributable actions.
