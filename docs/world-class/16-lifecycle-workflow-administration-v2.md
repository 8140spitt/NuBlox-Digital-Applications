# NuBlox V2 Lifecycle & Workflow Administration

**Status:** governed authoring and operations baseline  
**Scope:** reusable lifecycle policy, workflow orchestration, approval work, authority, audit evidence, graphical workflow authoring and operational intervention across F01–F29.

## 1. Architectural separation

NuBlox treats the following as distinct but connected control planes:

1. **Business-object version** — immutable published evidence and controlled revision lineage.
2. **Lifecycle state** — the business state of the governed object.
3. **Workflow process state** — execution state of an approval or operational process.
4. **Work-item state** — the state of individual human or automated activities.
5. **Authority and participants** — who may submit, decide, execute, reassign or administer work.

No implementation may collapse these concepts into a single generic status field.

## 2. Lifecycle administration capability

The platform lifecycle kernel and administration surface provide versioned templates, phases, transitions, lifecycle roles, phase-scoped access rules, organisation-role mappings and active object-type bindings.

Lifecycle templates support basic and advanced modes. Advanced templates may attach governed workflow gates to transitions. A workflow gate never mutates the source lifecycle merely because it has been submitted: the source transition is applied only after the workflow reaches the required successful outcome and the source-domain invariants pass again.

Published business records remain immutable. Material change requires a controlled revision. A predecessor becomes historical/superseded only when its approved successor is successfully published.

## 3. Workflow administration capability

The typed workflow kernel models:

- start and end nodes;
- human activities and ad-hoc activities;
- subprocesses and governed blocks;
- AND, OR, threshold and conditional routing;
- explicit routing events and loops;
- participants resolved from member, team, organisation role, lifecycle role, workflow role, actor or governed variable;
- completion rules of any, all or an explicit participant count;
- process and node variables with visibility, required/read-only and reset semantics;
- deadlines and overdue actions;
- notification, timer and checkpoint nodes;
- allow-listed service and integration actions;
- synchronization nodes using typed events;
- voting, reassignment and variable-change evidence;
- electronic-signature requirement metadata;
- independent workflow execution state and workflow health.

Administrator-authored arbitrary server code is intentionally excluded. Automation is represented by typed, allow-listed actions and connectors.

The persisted administration layer stores versioned workflow templates, workflow roles, typed variables, nodes, participants, routes and source-domain event bindings. Administrators work against draft minor versions; every governed mutation appends version evidence. Publication validates the complete persisted graph through the shared workflow kernel, produces an immutable major version and permits activation against business events. A published template can only be changed by creating a controlled successor revision.

Published revisions preserve operational continuity: when an active predecessor is superseded, its existing business-event bindings move atomically to the newly published successor. Runtime consumers resolve only published bound templates and materialise them back through the same typed kernel used for validation.

The V2 authoring experience follows the NuBlox UI/UX operating model rather than presenting all administration controls on one continuous page. Template creation is a focused action. The governance workspace separates Designer, People & data, Activation and History. A dedicated graphical designer provides direct drag/reposition authoring for draft process steps, keeps Start and End fixed, supports direct node-to-node route creation and exposes event/loop routing separately when expert detail is needed. Graphical ordering is persisted as a governed minor workflow version with audit/outbox evidence rather than as client-only layout state.

Published workflow templates are themselves reusable governed policy packages. Participant resolution, deadlines, overdue consequences, completion rules, routing, notification/service/integration actions and signature requirements are versioned with the reusable template lineage and therefore do not need to be recopied into each consuming business function.

## 4. Governed approval pattern

The production approval pattern is:

```text
Draft business object
        |
        v
Submit transition request     -- submit authority
        |
        v
Durable workflow request
        |
        v
Canonical Work item / My Work -- decision authority
        |
   +----+-----+
   |    |     |
Approve Return Reject
   |    |     |
   |    +-----+---- source remains in current lifecycle state
   v
Re-check source-domain invariants
   |
   v
Apply lifecycle transition
   |
   v
Close work + workflow and append audit/outbox evidence
```

Submission authority and decision authority are separate. A manager who may prepare and submit a record is not thereby entitled to approve it.

## 5. F01 production proving slice

F01 currently proves the shared pattern for:

- strategy framework approval;
- business-plan approval;
- KPI-definition approval;
- strategic-review approval.

For each governed approval, `strategy.manage` authorises submission and `strategy.approve` authorises the approval decision. Return or rejection closes the approval work without falsely advancing the source lifecycle.

The real-MySQL golden thread proves that a submitted draft remains draft, appears in authorised My Work, remains draft after return/rejection, and advances only after a successful approval decision and source-domain validation.

## 6. Work Kernel relationship

Workflow orchestration does not create a parallel task model. Human approval activities create canonical Work Kernel records and assignments. My Work is the user-facing queue for authorised pending work. Decision history, work-item events, domain audit evidence and outbox evidence remain independently queryable.

Workflow Operations uses those same canonical records rather than introducing another runtime model. Administrators with `workflow.manage` can monitor active and recent workflow requests, see derived green/amber/red health, inspect assignment and event evidence and intervene through governed controls:

- **Suspend** maps a pending workflow work item to the canonical blocked state with a recorded reason.
- **Resume** returns safely suspended work to in-progress execution while retaining the suspension evidence.
- **Escalate** raises triage priority to critical with an attributable reason; other priority changes remain available through progressive disclosure.
- **Delegate / reassign** closes the current assignment and appends a new member assignment without overwriting history.
- **Terminate** withdraws the pending workflow request and cancels its canonical work item without advancing or rewriting the source lifecycle.

A red/stale runtime is deliberately not given a blind restart button. The evidence remains visible for investigation so recovery can be chosen only when the source and workflow state make it safe.

## 7. Platform invariants for F01–F29

Every business function adopting lifecycle/workflow must preserve these invariants:

- lifecycle state is authoritative in the owning business domain;
- workflow execution cannot silently overwrite lifecycle state;
- receiving-function authority owns receiving outcomes in cross-function handoffs;
- submit, decide and administer permissions are separately enforceable;
- every transition is server-validated at execution time;
- stale workflow work must not be applied to a source object whose state has moved;
- duplicate active workflow requests for the same governed gate are prohibited;
- return/reject does not masquerade as an approved business-state transition;
- published versions are immutable and revision lineage is explicit;
- audit and outbox evidence is appended with governed mutations;
- graphical authoring changes are governed draft mutations, not disposable client state;
- operational intervention changes workflow/work state, not business lifecycle state;
- arbitrary administrator-authored executable server code is prohibited.

## 8. Delivered administration experience

The V2 workflow administration product includes:

- a focused template-creation journey rather than a permanent creation form beside the library;
- a reusable template library with clear version, publication and binding status;
- a dedicated graphical process designer with drag/reposition authoring and direct route connection;
- governed persistence of graphical ordering as minor workflow versions;
- visible routes, participants, deadlines and execution cues on the design canvas;
- progressively disclosed advanced node, deadline, routing and execution controls;
- dedicated People & data administration for roles, participants and typed variables;
- dedicated Activation administration for immutable publication and business-event binding;
- isolated governed version history;
- a workflow-operations monitor with active, attention and closed summaries;
- workflow health derived independently from lifecycle state;
- per-workflow evidence, assignment history and source/context visibility;
- explicit suspend/resume, escalation, delegation/reassignment and termination controls backed by canonical Work Kernel evidence;
- production integration through F01 lifecycle gates and My Work rather than a disconnected administration-only runtime.

Further product adoption should connect additional owning business functions to the same lifecycle/workflow kernels. Provider-backed electronic signatures and additional typed connectors may extend the platform, but they must not reintroduce function-specific workflow engines, administrator-authored arbitrary code or an everything-on-one-page administration pattern.
