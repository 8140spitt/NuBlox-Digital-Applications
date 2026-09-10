# F04 — Corporate Development & M&A implementation evidence

## Scope

F04.01–F04.07 are implemented as one native Corporate Development control thread rather than isolated modules.

## Native evidence

| Sub-function | Native implementation evidence |
| --- | --- |
| F04.01 — Opportunity identification | Organisation-scoped opportunity pipeline, target/partner provenance, strategic thesis/rationale, accountable owner, stage history and F01/F03 references. |
| F04.02 — Valuation | Versioned valuation cases with predecessor/supersession semantics, methods, value ranges, scenarios, assumptions, evidence and approval. |
| F04.03 — Due diligence | Domain workstreams, requests, findings/risks, owners, materiality and source-document/evidence references without duplicate file storage. |
| F04.04 — Transaction management | Transaction structure, consideration, terms, milestones, conditions and F02 governance/DoA references; close is blocked without a governed F02 decision or unresolved conditions. |
| F04.05 — Integration | Integration thesis, Day 1/Day 100/end-state outcomes, workstreams, D5 delivery references and F03 benefit linkage. |
| F04.06 — Divestiture | Carve-out perimeter, separation strategy, buyer provenance, TSA/separation obligations and completion evidence. |
| F04.07 — Strategic partnerships | Partnership objectives, commercial/governance model, commitments, review lifecycle and F02 decision gate for activation. |

## Control thread

`F01 strategy / market signal → F04 opportunity → valuation → due diligence → finding/risk → F02 governed approval → transaction/conditions → close → integration or divestiture → F03 benefit/performance evidence → review/closure`

## Automated proof

The real-MySQL F04 integration test exercises all seven sub-functions, including valuation revision supersession and negative governance tests proving that transaction close and partnership activation fail without required F02 approval evidence. Browser E2E proves authenticated access to the Corporate Development command centre and the opportunity-to-valuation operator path.

Final closure requires exact-head Complete System Validation and merged-main Complete System Validation to be green; those run identifiers are recorded in the issue closure evidence after merge.
