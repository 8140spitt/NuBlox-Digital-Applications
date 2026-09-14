# F01 completion reset

This change set completes the V2 business-facing F01 management thread without exposing platform lifecycle/workflow authoring as the primary business user experience.

The target F01 journey is:

1. F01.01 Direction — purpose, vision, mission and governed strategy cycle.
2. F01.02 Environment — evidence, factors and assumptions.
3. F01.03 Strategic planning — options, choices, themes and objectives.
4. F01.04 Business planning — plans, initiatives, resource requirements and enterprise handoffs.
5. F01.05 Operating model — current-to-target capabilities, organisation, process, governance, information, technology, ecosystem and location changes, with accountability and initiative linkage.
6. F01.06 Performance — goals, KPIs, targets, observations and corrective action.
7. F01.07 Strategic review — structured review, decisions and controlled follow-through.
8. F01.08 Scenario & foresight — scenarios, assumptions, KPI projections, approval and controlled revision.

Platform lifecycle and workflow controls remain authoritative infrastructure. Business users interact with business language and domain transactions; lifecycle/workflow internals are surfaced only where governance requires them.

F01 is considered complete only when the V2 quality gate is green on `main`, including lint, type-check, unit tests, build and the real-MySQL F01 regression suite.