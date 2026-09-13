# 14 — NuBlox Design System

**Status:** Governing implementation standard  
**Effective:** 13 September 2026  
**Scope:** NuBlox V2 application shell, F01–F29, portal surfaces and shared platform utilities.

## Purpose

NuBlox uses one visual and interaction language across the enterprise. Business functions may introduce new records and workflows, but they do not introduce independent UI conventions.

The design system is a product-platform layer:

```text
Foundations
  → semantic tokens
  → reusable primitives
  → enterprise interaction patterns
  → contextual workspaces
  → F01–F29 business experiences
```

This standard complements `13-ui-ux-operating-model.md`. The operating model governs information architecture and workflow continuity; this document governs the reusable implementation language used to realise it.

## 1. Token architecture

Raw palette values are implementation foundations only. Product surfaces consume semantic tokens.

```text
Raw palette
  blue / green / red / orange / yellow / purple / pink / brown / neutral
        ↓
Semantic contract
  canvas / surface / text / border / action / focus / success / warning / danger / information
        ↓
Components and patterns
```

Do not use a raw colour merely because it looks appropriate on one page. Status, action and feedback colours must carry consistent meaning across F01–F29.

The supplied NuBlox palette is encoded in `appv2/src/app.css` as `--nb-<family>-<step>` tokens. Existing V2 variables are temporary compatibility aliases over the semantic layer.

## 2. Typography, spacing and density

The design system owns typography, spacing, radii, elevation and density.

Supported density modes are:

- **comfortable** — orientation, executive and low-density decision surfaces;
- **standard** — default enterprise work;
- **compact** — data-intensive registers, comparisons and operational grids.

Density changes spacing and control/row height. It does not change business semantics or create separate components.

## 3. Reusable component rule

Components describe interaction and information patterns, not departments or functions.

Preferred:

```text
Button
Field
Panel
StatusBadge
PageHeader
ActionBar
Stat
Alert
EmptyState
Approval
ActivityTimeline
RecordHeader
DataTable
```

Avoid:

```text
StrategyButton
FinanceCard
ProjectStatusBadge
ProcurementApproval
HRPanel
```

A function-specific component is justified only when its behaviour or information model is genuinely specific to that business concept.

## 4. Native HTML first

NuBlox preserves semantic browser behaviour wherever possible.

Use native controls for:

- buttons;
- links;
- forms;
- inputs;
- selects;
- textareas;
- checkboxes and radios;
- tables;
- headings and landmarks.

A styled `div` is not a substitute for an interactive semantic element.

Keyboard behaviour, focus visibility, labels, error relationships and screen-reader meaning are part of component acceptance, not optional polish.

## 5. Business mutations: forms + actions

Normal business mutations use semantic HTML forms and SvelteKit server actions.

```text
User intent
  → <form method="POST">
  → named SvelteKit action
  → authenticate
  → resolve tenant/context
  → authorise
  → parse and validate
  → execute domain command / transaction
  → audit / workflow consequence
  → redirect or action result
```

Client-side code does not own validation, permissions, lifecycle rules or business invariants.

Named actions should express business intent where the lifecycle warrants it:

```text
?/create
?/update
?/submit
?/approve
?/reject
?/return
?/complete
?/cancel
?/archive
```

Avoid generic mutation endpoints that obscure the business transition.

## 6. Progressive enhancement

JavaScript improves the transaction; it does not define the transaction.

The baseline must work without JavaScript:

```text
POST
  → server validation / command
  → fail with field errors OR redirect 303
  → browser renders canonical state
```

With JavaScript, `use:enhance` may add:

- pending states;
- inline response handling;
- focus preservation;
- selective invalidation;
- smoother transitions;
- optimistic-feeling feedback where the server remains authoritative.

Do not replace routine SvelteKit form actions with custom client `fetch` calls merely to avoid browser form semantics.

## 7. Validation hierarchy

Validation is layered:

```text
Browser constraints / hints
  → enhanced client feedback
  → authoritative server validation
  → domain invariants and authority
  → database constraints
```

A value can be syntactically valid but still fail because of delegated authority, lifecycle state, segregation of duties, accounting period, project status or another domain rule. Those controls remain server-side.

Field errors must be associated with their controls. Material form failures should also provide a clear page/form-level summary.

## 8. Action hierarchy

A surface should normally have one visually dominant primary action.

- **primary** — the next meaningful business action;
- **secondary** — valid supporting action;
- **quiet** — low-emphasis navigation or utility;
- **danger** — destructive or materially irreversible transition.

Dangerous actions must not compete visually with routine work.

## 9. Lifecycle and status language

Status styling communicates semantic state, not decoration.

Initial semantic tones are:

- neutral;
- information;
- success;
- warning;
- danger.

Functions may have domain statuses such as Draft, Submitted, Approved, Active, Suspended, Closed or Cancelled, but the visual tone attached to those statuses must be deliberate and consistent.

## 10. Page composition

Pages compose shared patterns rather than writing large blocks of one-off CSS.

Default hierarchy:

```text
PageHeader
  → orientation + primary actions
ActionBar / local navigation
  → immediate commands / filtering
Primary work surface
  → list, record, decision or transaction
Supporting panels
  → relationships / evidence / activity / audit
```

Progressive disclosure remains mandatory. Page composition must obey the weight limits in `13-ui-ux-operating-model.md`.

## 11. Design-system laboratory

The protected route:

```text
/[tenant]/app/design-system
```

is the implementation laboratory for shared foundations and components.

It must remain business-neutral. Its purpose is to prove component behaviour, responsive composition, semantics, accessibility, density and progressive-enhancement patterns before those patterns are consumed by F01–F29.

The laboratory is not a replacement for browser/E2E proof inside real business workflows.

## 12. Current foundation components

The initial V2 foundation is exported from `appv2/src/lib/components/ui`:

- `Button`;
- `Field`;
- `StatusBadge`;
- `Panel`;
- `PageHeader`;
- `ActionBar`;
- `Alert`;
- `EmptyState`;
- `Stat`.

This is intentionally a foundation slice, not a claim that the design system is complete.

Next enterprise patterns should be added as F01 proves the need, including:

- breadcrumbs/context path;
- tabs/local navigation;
- searchable/filterable data table;
- record header and lifecycle strip;
- activity timeline;
- evidence/attachment panel;
- related-record panel;
- approval/decision pattern;
- loading/skeleton states;
- dialogs/drawers for focused actions;
- pagination;
- context selector;
- command/search pattern.

## 13. Contribution rule

When a function requires a new UI pattern:

1. confirm an existing design-system pattern cannot express it cleanly;
2. design the new pattern generically;
3. add it to the shared design system;
4. prove accessibility/responsive/interaction behaviour;
5. consume it from the function.

Do not solve the problem only inside the function and leave the pattern duplicated elsewhere.

## 14. Acceptance criteria

A component or pattern is not World-Class complete until it has:

- semantic HTML appropriate to its purpose;
- keyboard and focus behaviour;
- accessible names/relationships;
- responsive behaviour;
- semantic token usage;
- density behaviour where relevant;
- server-authoritative mutation semantics where relevant;
- progressive enhancement where relevant;
- clear loading, error, empty and disabled states;
- automated type/lint/build proof;
- real-workflow proof when adopted by a business function.

The target is not visual consistency alone. The target is a consistent enterprise interaction grammar that makes NuBlox predictable across all 29 functions.
