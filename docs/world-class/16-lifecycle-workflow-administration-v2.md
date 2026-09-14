# NuBlox V2 Lifecycle & Workflow Administration

**Status:** governed platform baseline  
**Scope:** reusable lifecycle policy, workflow orchestration, approval work, authority, audit evidence and future administration capability across F01–F29.

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
- arbitrary administrator-authored executable server code is prohibited.

## 8. Administration roadmap

The shared kernels are the baseline for expanding administration beyond the F01 proving slice. Subsequent tranches should add reusable workflow-template persistence/version administration, graphical/template editing, participant and deadline administration, process monitoring/intervention, reusable notification/escalation rules, electronic-signature policy integration and adoption by each owning business function. These capabilities must extend the common kernels rather than reintroducing function-specific workflow engines.
