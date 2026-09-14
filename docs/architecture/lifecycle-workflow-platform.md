# NuBlox lifecycle and workflow platform

## Purpose

NuBlox treats lifecycle state, workflow execution, business-object versioning, permissions and audit history as separate but cooperating platform concerns. This prevents business functions from embedding ad-hoc status logic and provides one governed model for F01-F29.

This architecture is informed by the complete Windchill Life Cycle Administration and Workflow Administration capability set. NuBlox adopts the underlying enterprise patterns, not Windchill implementation details or embedded-code mechanisms.

## Non-negotiable separation of concerns

A governed business object has five independent coordinates:

1. **Business version** — immutable published major version plus mutable working minor versions.
2. **Lifecycle state** — business maturity such as Draft, Under Review, Approved, Released, Retired or Historical.
3. **Workflow process state** — execution state of a process instance such as Not Started, Running, Suspended, Completed, Terminated or Aborted.
4. **Work item state** — execution state of a human or automated task such as Open, In Progress, Blocked, Completed or Cancelled.
5. **Authority** — central RBAC plus temporary lifecycle/workflow role authority, always subject to explicit NuBlox denies and tenant boundaries.

Changing one coordinate must not silently mutate the others.

## Lifecycle model

### Basic and advanced lifecycles

A **Basic** lifecycle defines states/phases and permitted transitions. It is the default for high-volume operational records.

An **Advanced** lifecycle adds:

- lifecycle roles;
- phase-scoped access rules;
- phase-entry workflow processes;
- gate workflow processes;
- promotion/review behaviour;
- revision rules;
- controlled reassignment rules.

Advanced capability is used only where governance warrants the additional runtime cost and administration.

### Enterprise lifecycle states

States are canonical enterprise concepts, while lifecycle templates define how an object reaches them. A state such as `under_review` has the same semantic meaning wherever it is used even if different object types use different paths.

Lifecycle phases bind a canonical state to template-specific behaviour:

- label and display order;
- edit/delete/revise policy;
- role-scoped permissions;
- optional phase-entry workflow;
- optional gate workflow;
- optional revision series/rule.

### Lifecycle transitions

Transitions are explicit business events, not direct writes to a status column. Each transition may define:

- source and target state;
- transition class: direct, submit, promote, change, revise, lock, unlock, retire or cancel;
- required permission;
- required rationale/note;
- required target reference;
- optional workflow template;
- optional temporary lock state while review executes;
- optional automatic revision on successful promotion;
- optional version-series policy.

A valid transition and authority are both required. Administrative override is a separate audited capability.

### Phase process and gate process

Advanced lifecycles support two distinct workflow bindings:

- **Phase process** — starts automatically when an object enters a phase.
- **Gate process** — starts when an object attempts to leave a phase through a governed transition.

The workflow process remains separate from the lifecycle. A successful gate can authorize the lifecycle transition; rejection or return leaves the business object in its original state unless the template explicitly defines another outcome.

### Promotion

Promotion is a governed request to move one or more business objects to a target state. NuBlox promotion semantics are:

- promotion candidates are frozen to explicit object/version references;
- all candidates in one request must support the requested target state;
- reviewers may comment without decision authority;
- approvers determine the disposition according to the configured completion rule;
- optional temporary lock prevents mutation while review is active;
- approval applies the configured lifecycle transition;
- rejection/return does not falsely advance lifecycle state;
- automatic revision may create a new governed version/series as part of a successful promotion.

### Lifecycle template iteration

Lifecycle templates are governed administrative objects. Editing creates a new template iteration/version. Objects already bound to an older published template iteration continue to use that immutable iteration unless an administrator performs an explicit reassignment.

The latest published template is used for new bindings by default.

### Lifecycle assignment and reassignment

Object-to-lifecycle binding may be:

- defaulted by object type;
- explicitly selected at creation where policy permits;
- reassigned by an authorised administrator.

Reassignment records the old template iteration, new template iteration, old state, requested starting state, actor, reason and timestamp. The administrator may preserve a compatible state, reset to the initial state or select an allowed starting state.

## Workflow model

### Template versus process instance

A **workflow template** is an iterated, governed definition. A **workflow process instance** is a runtime execution pinned to one published template iteration. Running processes never silently switch to a newer template iteration.

### Workflow template graph

NuBlox workflow templates support a directed process graph with these node families:

- start;
- assigned activity;
- ad-hoc activity;
- subprocess/proxy process;
- activity block;
- AND connector;
- OR connector;
- threshold/quorum connector;
- conditional router;
- timer;
- notification;
- checkpoint;
- service/method action;
- synchronization/event wait;
- external URL/integration call;
- terminator/end.

Arbitrary server-side code embedded by ordinary administrators is not permitted. Conditional logic and service actions use a constrained, typed rule/action catalogue.

### Links and routing events

Links connect nodes and respond to emitted events. An activity may emit events such as `approve`, `reject`, `return`, `complete`, `cancel` or domain-specific values. Links map events to successor actions.

Routing can be:

- none;
- manual;
- manual-exclusive;
- conditional;
- vote/quorum based.

Loop links explicitly reset connector state before re-entry. Unneeded predecessor tasks may be terminated when OR/threshold routing fires.

### Participants and roles

Workflow activities resolve participants at runtime from:

- explicit member;
- team;
- organisation role;
- lifecycle role;
- workflow role;
- actor such as creator/submitter;
- process variable;
- approved resource pool.

Completion policies support any-one, all, N-of-M, required/optional participants and reviewer-versus-approver semantics.

Unresolved required roles are a workflow health condition. A template may either fail/abort or route the task to a configured responsible role.

### Variables

Workflow variables are typed process data. They may be process-global or node-local and may be:

- visible/hidden;
- required/optional;
- read-only/read-write;
- resettable/static;
- initialized from a parent process;
- copied back to a parent process on completion.

Persisted variables use safe JSON primitives and durable object references rather than serialized executable objects.

### Deadlines and overdue consequences

Processes and activities may define deadlines relative to their own start or the parent process start. The effective deadline is the earliest applicable deadline.

Configured overdue consequences include:

- notify responsible role;
- notify additional roles;
- reassign to responsible role;
- skip;
- mark complete;
- escalate;
- block/raise exception.

Automatic completion or skipping is only allowed when explicitly configured and auditable.

### Runtime execution states

Workflow process and node instances use an execution state machine distinct from business lifecycle state:

`not_started -> running -> completed`

with controlled alternatives including disabled, suspended, skipped, terminated, aborted and reset/restarted where permitted.

### Error handling and health

Each activity may configure error consequences, responsible-role notifications and parent-abort behaviour.

Workflow health is derived separately from workflow state:

- **green** — no identified warnings/errors;
- **amber** — warnings such as overdue tasks/processes, suspended nodes, excessive retries or long-running waits;
- **red** — errors such as aborted nodes, invalid source/template references, orphaned work items or stalled execution.

Administration must support inspection, restart where safe, suspend/resume and terminate with audit evidence.

### History

Workflow history is append-only and records at minimum:

- process/node state transitions;
- assignments and reassignments;
- participant resolution;
- votes and decisions;
- variable changes selected for history;
- emitted routing events;
- deadlines/escalations;
- integration/service-action results;
- errors and retries;
- lifecycle effects;
- process completion/termination.

### Electronic signatures

A human activity may require an electronic signature. A signature is stronger than a normal button click and records authenticated signer identity, decision, meaning, timestamp, business object/version, workflow process/activity and immutable evidence. The signature requirement is template-controlled and cannot be bypassed by client-side UI.

### Synchronization and automated nodes

Automated workflow behaviour is represented by typed nodes rather than embedded arbitrary code:

- notification;
- timer;
- checkpoint;
- internal service action;
- external integration call;
- wait for class/domain event;
- wait for object event;
- wait for typed expression/rule result.

Event-driven object synchronization is preferred over high-frequency polling.

## Template governance

Lifecycle and workflow templates both support:

- draft working iterations;
- published immutable iterations;
- controlled successor iteration;
- history;
- import/export using a validated NuBlox interchange schema;
- object/context applicability;
- explicit move/re-scope administration;
- no mutation of running instances or objects pinned to previous iterations.

## F01 reference implementation

F01 is the first consumer of the platform contract.

Governed F01 approvals use workflow-backed lifecycle gates:

- Strategy framework approval;
- Business plan approval;
- KPI approval;
- Strategic review approval.

The intended journey is:

`Draft object -> Submit transition -> workflow request/process -> approver My Work -> approve/return/reject -> workflow completion -> lifecycle transition -> published major version`

The source object remains in its current lifecycle state while approval is pending. Approval authority comes from the configured lifecycle/workflow permission model. Return/reject closes the workflow without publishing. Approval invokes the domain invariant/approval service and only then advances the lifecycle and governed version.

## NuBlox-specific safeguards

NuBlox deliberately differs from legacy workflow products in several areas:

- no administrator-authored arbitrary server code;
- explicit member deny always wins over lifecycle/workflow grants;
- every write is tenant-scoped;
- domain invariants remain authoritative even when workflow approves;
- workflow cannot directly forge domain state;
- published business versions and template iterations are immutable;
- all automated actions are typed, allow-listed and auditable;
- external integrations are executed through controlled connectors/outbox patterns;
- deletion is governed independently from lifecycle maturity and retains immutable evidence.

## Coverage target

The platform capability model covers the complete Life Cycle Administration and Workflow Administration taxonomy supplied for the Windchill benchmark: lifecycle states, basic/advanced templates, phase/gate workflows, transitions, promotion, automatic revision, phase roles/access, lifecycle assignment/reassignment, template iteration/import/export, workflow security/versioning, graphical process concepts, assigned activities, subprocesses, connectors, links, variables, routing, voting, deadlines, participants, resource pools, execution options, automated/robot nodes, synchronization, history, instance states, electronic signatures, process health, administration and process management.

Feature delivery may be incremental, but no NuBlox business function should implement a conflicting private model.