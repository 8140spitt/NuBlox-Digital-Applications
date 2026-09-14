# NuBlox lifecycle and workflow benchmark register

This register records how the NuBlox platform architecture accounts for the complete Windchill 12.0.2 Life Cycle Administration and Workflow Administration capability taxonomy reviewed in September 2026.

Status meanings:

- **Operational** — production code exists and is exercised by NuBlox runtime paths.
- **Platform model** — semantics are represented in the shared platform contract/kernel and are available for incremental runtime implementation.
- **Planned administration** — semantics are understood but a complete administrator-facing utility is not yet delivered.
- **Deliberate alternative** — NuBlox intentionally implements the business need differently for security, cloud architecture or usability reasons.

| Capability family | NuBlox interpretation | Status |
| --- | --- | --- |
| Basic and advanced life cycles | Basic state/transition templates plus advanced roles, phase access and workflow gates | Operational |
| Enterprise life-cycle states | Canonical states are separate from template-specific routes | Operational |
| Phase transitions | Explicit transitions with permission, rationale, target-reference and workflow gates | Operational |
| Phase roles and phase access | Lifecycle roles map to central organisation roles; phase grants cannot override explicit denies | Operational |
| Phase workflow and gate workflow | Workflow is a separate runtime; governed F01 approvals use gate workflows | Operational for F01 approval gates |
| Promotion processes | Governed request, fixed candidate references, approver/reviewer separation, target state and rejection semantics | Platform model |
| Promotion locking | Optional temporary lock/review state without conflating workflow state | Platform model |
| Automatic revision during promotion | Successful promotion may trigger a configured new revision/series | Platform model |
| State-based revision sequences | Revision policy can vary with lifecycle state | Platform model |
| Life-cycle template iteration | Draft working definition, immutable published iteration, controlled successor | Operational |
| Life-cycle template history | Retained governed history | Operational |
| Life-cycle import/export/move | Validated interchange and context movement semantics | Planned administration |
| Object/lifecycle association | Object-type binding plus tenant template binding/fallback | Operational |
| Life-cycle reassignment | Explicit audited reassignment with compatible state policy | Platform model |
| Workflow security | Central RBAC plus workflow/lifecycle role context; explicit deny wins | Operational for F01 workflow decisions |
| Restricted embedded code | No ordinary administrator-authored arbitrary server code | Deliberate alternative |
| Workflow version control | Immutable published template iterations; runtime pins an iteration | Platform model; code-backed F01 templates operational |
| Workflow process diagrams | Directed node/link graph contract | Platform model |
| Assigned activities | Human tasks materialise in canonical Work Kernel / My Work | Operational |
| Ad-hoc activities | Runtime-created governed human activities | Platform model |
| Subprocess/proxy process | Child workflow templates with mapped roles/variables | Platform model |
| Activity blocks | Reusable grouped workflow activity semantics | Platform model |
| Connectors | AND, OR, threshold/quorum and conditional routing | Platform model |
| Links and loop links | Event/condition links with explicit loop semantics | Platform model |
| Variables | Typed process/node variables and durable object references | Platform model |
| Participants | Member, team, organisation role, lifecycle role, workflow role, actor and variable resolution | Platform model |
| Completion rules | Any, all and N-of-M completion | Platform model |
| Resource pools | Approved participant-resource resolution | Platform model |
| Deadlines | Process/node deadlines, earliest effective deadline and overdue consequences | Platform model |
| Routing/voting | Event routing, conditional routing and quorum/vote semantics | Platform model |
| Runtime process states | Workflow execution state is separate from business lifecycle state | Operational contract |
| Process/activity execution flags | Safe typed execution/history/error options | Platform model |
| Notification robot | Typed notification automated node | Platform model |
| Method robot | Allow-listed internal service action node | Platform model |
| Checkpoint robot | Checkpoint automated node | Platform model |
| Timer robot | Durable timer node | Platform model |
| Launch application robot | Controlled integration/service action; no arbitrary shell command from template | Deliberate alternative |
| Execute expression robot | Typed rule catalogue; no arbitrary executable expression | Deliberate alternative |
| Synchronize robot | Typed domain/object event wait, preferring event-driven synchronization | Platform model |
| URL robot | Controlled connector/integration invocation | Platform model |
| Workflow history | Append-only work-item, decision, event, audit and outbox evidence | Operational for F01 approval workflow |
| Workflow health | Green/amber/red health independent from process execution state | Platform model |
| Process administration | Search, inspect, diagnose, suspend/resume/restart/terminate with audit | Planned administration |
| Process manager | Process/node inspection and controlled intervention | Planned administration |
| Electronic signatures | Strong authenticated signature evidence tied to activity, object/version and meaning | Platform model |
| PDF/custom task forms | Task presentation is a UI/form contract separate from process semantics | Planned administration |
| Workflow template import/export | Validated NuBlox interchange schema rather than executable-code transport | Planned administration |
| Cross-release template transport | Versioned validated interchange and migration compatibility checks | Planned administration |
| Process images | Diagram/view metadata can be associated without affecting execution semantics | Platform model |
| Workflow expressions/code samples | Converted to typed rules/actions/events rather than copied executable code | Deliberate alternative |

## F01 reference closure

The first operational workflow path is the F01 governed approval gate:

`Draft -> Submit approval -> durable workflow request -> canonical approval work item -> My Work -> Approve / Return / Reject -> F01 domain invariant -> lifecycle transition -> published version`

Return and reject close the workflow without falsely changing the business-object lifecycle. Approval does not bypass F01 domain invariants or explicit member denies.

## Delivery rule

No F01-F29 function should introduce a private workflow engine or a second lifecycle model. Missing capability is added to the platform kernel and then consumed by the function.