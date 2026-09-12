# 13 — NuBlox UI/UX Operating Model

**Status:** Governing product-experience standard  
**Effective:** 12 September 2026  
**Scope:** all NuBlox application surfaces, F01–F29, shared platform utilities and contextual workspaces.

## Purpose

NuBlox must behave as one enterprise operating system, not as a collection of independently designed feature pages.

The user-facing information architecture is based on the **29 enterprise functions**. Functional roles, job profiles and permissions determine what a person may see and do; they do **not** determine where functionality lives or create separate role-based mini-applications.

```text
Enterprise function
  → sub-function / outcome
  → contextual workspace
  → canonical record / transaction
  → workflow / decision / evidence
  → downstream business consequence
```

The 19 native capability domains remain authoritative ownership boundaries behind the interface. They are not the primary navigation model.

## 1. Navigation contract

### Primary navigation

The application shell shall contain three stable concepts only:

1. **Work** — Home and My work.
2. **Functions** — authorised live enterprise functions, identified by canonical F-number and function name.
3. **Tools** — cross-functional utilities such as the complete function directory, enterprise search and saved/recent contexts.

Do not create primary navigation groups based on departments, assumed job roles, internal development domains or arbitrary collections such as “Business”, “People & operations” or “Project delivery”.

### Function directory

The complete F01–F29 taxonomy is always the governing directory. A function may be:

- available to the current user;
- live in the product but outside the current user's authority; or
- not yet represented by a dedicated live functional workspace.

This distinction prevents roadmap scope, permissions and navigation architecture from being conflated.

### Role and permission behaviour

Roles and permissions may:

- hide unauthorised live function links from the primary sidebar;
- change available commands, approvals and mutations;
- personalise My work, notifications, dashboards and shortcuts.

Roles and permissions shall not:

- rename the enterprise taxonomy;
- move the same capability to different locations for different jobs;
- create separate navigation architectures for different departments;
- duplicate authoritative records.

## 2. Context is the second navigation dimension

Functions answer **what work am I doing?**

Context answers **what am I doing it to or for?**

Supported context examples include organisation, customer, supplier, opportunity, contract, portfolio, programme, project, site, property, asset, product/service, work order and controlled information container.

Opening a context shall preserve it while the user moves between relevant functions. Cross-functional work should feel like moving around one business object, not opening unrelated applications.

## 3. Standard page hierarchy

Every function should use the same hierarchy where applicable:

```text
Function landing
  → work queue / portfolio / list
  → record workspace
  → lifecycle area or sub-function
  → focused action
```

### Function landing

Purpose: orientation and prioritisation.

Show only:

- a concise function title and outcome;
- material KPIs or exceptions;
- current work queues / portfolio summary;
- recent or priority records;
- the next meaningful actions.

Do not place full create/edit forms on the landing page unless creation is genuinely a one- or two-field capture action.

### List / portfolio page

Purpose: find, compare, filter and open records.

Use tables, boards or compact lists according to the business problem. Creation is initiated with a clear action and completed in a focused create surface.

### Record workspace

Purpose: manage one business object through its lifecycle.

A record workspace should have:

- persistent identity and status;
- owner / accountable person;
- lifecycle stage;
- primary next action;
- local navigation for lifecycle areas;
- related records and evidence;
- audit/activity history where material.

### Focused action surface

Creation, approval, amendment, closeout and other consequential actions belong in a dedicated page, drawer, dialog or guided workflow. They should not be permanently expanded beside unrelated information.

## 4. Progressive disclosure

NuBlox must not display every field, workflow and lifecycle phase simultaneously.

Default view = the information required to understand state and decide what to do next.

Secondary detail = available on demand through tabs, accordions, drill-through, related-record panels or dedicated detail pages.

Expert detail may be dense, but density must be purposeful and local to the task.

## 5. Workflow continuity

Every governed workflow must make five things obvious:

1. **Where am I?** — function, context and record.
2. **What state is this in?** — lifecycle/status.
3. **What happened before?** — attributable history and evidence.
4. **What can I do now?** — authorised next actions.
5. **What happens afterwards?** — resulting record, approval, accounting, project, notification or downstream consequence.

A workflow is not complete if the user must infer these relationships from disconnected screens.

## 6. Interaction grammar

The following interaction concepts shall be consistent across F01–F29:

- **Create** starts a new canonical record.
- **Edit / amend** changes an existing draft or controlled revision according to lifecycle rules.
- **Submit** moves work into a governed review/approval state.
- **Approve / reject / return** are decision actions, not generic edits.
- **Complete / close** finishes a lifecycle phase with explicit consequence.
- **Archive / retire / cancel** have distinct lifecycle meaning and must not be visually interchangeable with deletion.
- **Related records** show authoritative cross-functional relationships rather than copied data.
- **Activity / evidence** shows attributable history and supporting information.

Primary actions must be visually dominant. Destructive or irreversible actions must not compete visually with routine navigation.

## 7. Page weight limits

A single screen should normally represent one of the following:

- orientation;
- comparison/list management;
- one record;
- one focused transaction;
- one decision/review.

Avoid pages that simultaneously contain a portfolio, multiple lifecycle stages, several create forms and several approval forms.

Large command-centre pages are acceptable only when their purpose is monitoring and triage. They must link into focused record workspaces rather than becoming the record workspace themselves.

## 8. F04 reference correction

The existing F04 Corporate Development command-centre page demonstrates the anti-pattern this standard replaces: pipeline, opportunity creation, valuation, diligence, transaction and later lifecycle controls are presented on one continuous route.

F04 shall be refactored toward:

```text
F04 Corporate Development
  → Portfolio / pipeline
  → Opportunity / deal record
      → Overview
      → Valuation
      → Due diligence
      → Transaction
      → Integration / divestiture
      → Benefits / performance
      → Evidence / activity
```

Creation and lifecycle actions should open focused surfaces. The deal identity and lifecycle stage remain visible while the user moves between areas.

## 9. F05 and future-function rule

F05 and subsequent function delivery must not add another standalone “everything on one page” command centre.

Before implementation, each function must define:

- function landing page;
- primary record types;
- record workspace hierarchy;
- sub-function navigation;
- lifecycle and state model;
- cross-functional handoffs;
- primary actions and approvals;
- responsive behaviour;
- accessibility expectations;
- browser/E2E proof of the end-to-end user journey.

## 10. Acceptance test

A NuBlox surface is not World-Class complete until a competent business user can answer, without product-specific training:

> Where am I, what am I looking at, why does it matter, what can I do next, and what will happen when I do it?

If the interface cannot answer those questions through its structure and interaction model, the feature is not UX-complete even if the underlying database and service logic are complete.
