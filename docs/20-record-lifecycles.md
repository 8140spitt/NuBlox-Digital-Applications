# Record Lifecycles and State Machines

**Status:** Compatibility reference  
**Canonical execution architecture:** [`architecture/bottom-up/layer-3-state-work-events-evidence.md`](architecture/bottom-up/layer-3-state-work-events-evidence.md)

Material state transitions are explicit, server-validated and attributable. The owning domain defines its actual states; there is no universal state machine that should be copied mechanically across records.

Every material transition must define source state, target state, permission, tenant/project scope, required evidence, invariants, side effects, emitted evidence/events, idempotency and correction behaviour.

Approved/issued/executed/posted facts are corrected through controlled revision, supersession, void, reversal, addendum or audited reopen semantics as appropriate; they are not silently overwritten.

The Work Kernel supplies shared task/action/approval execution semantics but does not replace domain lifecycle authority.