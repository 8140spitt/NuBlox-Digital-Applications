# 09 — UX and Information Architecture

## 1. UX objective

NuBlox must feel like one coherent application while exposing different workflows to different professionals.

The interface is capability-driven, not a collection of 84 skins.

## 2. Global shell

Recommended top-level structure:

```text
Organisation switcher
Global search
Notifications
Create/New action
User menu

Dashboard
CRM
Projects / Jobs
Schedule
Commercial
Purchasing
People
Documents
Assets / Facilities
Reports
Professional Tools
Administration
```

Navigation items appear only where the user has access/capability.

## 3. Organisation-centric URLs

Illustrative route model:

```text
/app/[organisation]/
/app/[organisation]/crm
/app/[organisation]/projects
/app/[organisation]/quotes
/app/[organisation]/invoices
/app/[organisation]/people
/app/[organisation]/assets
```

Project context:

```text
/app/[organisation]/projects/[project]/
  overview
  team
  tasks
  documents
  information
  commercial
  site
  quality
  safety
  assets
  handover
```

The exact URL ID strategy is subject to security/ID design.

## 4. Professional workspace examples

### Quantity Surveyor

- cost plans;
- measurement;
- tendering;
- procurement packages;
- variations;
- valuations;
- forecasts;
- final accounts.

### Electrician

- customers/jobs;
- survey/quote;
- schedule;
- installations;
- circuits/equipment;
- test records;
- certificates;
- materials;
- invoices/service history.

### Facilities Manager

- properties/buildings;
- assets;
- work orders;
- PPM;
- inspections;
- contractors;
- warranties;
- compliance;
- energy/service history.

## 5. Responsive requirements

Desktop is important for commercial/design registers. Mobile is essential for field workflows.

Mobile priority workflows:

- assigned work;
- site/job details;
- photos;
- checklists;
- inspections;
- defects;
- time;
- deliveries;
- signatures/attestations where applicable;
- asset lookup;
- work-order completion.

Do not force desktop data-grid layouts onto phones.

## 6. Common interaction patterns

Standardise:

- page headers;
- status chips;
- data tables;
- filters;
- saved views;
- form fields;
- date/time selection;
- money/unit inputs;
- people/contact selectors;
- document pickers;
- activity timelines;
- confirmation dialogs;
- bulk actions;
- permission-denied state;
- empty/error/loading states.

## 7. Registers

Built-environment users work heavily in registers. A shared register component should support:

- sort;
- filter;
- search;
- column selection;
- pagination/virtualisation where needed;
- saved views;
- export;
- row/bulk actions subject to permissions.

## 8. Status and workflow UX

Users must be able to distinguish:

- Draft
- Issued
- Awaiting response
- Approved/accepted
- Rejected
- Superseded
- Closed
- Cancelled/void

Status colours alone must not communicate meaning.

## 9. Accessibility

Target **WCAG 2.2 AA**.

Requirements include:

- keyboard operation;
- visible focus;
- accessible labels/errors;
- semantic structures;
- adequate target size;
- no colour-only status;
- accessible authentication;
- reduced motion consideration;
- responsive zoom/reflow;
- test with assistive technologies.

## 10. Field usability

Field interfaces should prioritise:

- large touch targets;
- minimal typing;
- defaults and recent values;
- fast photo capture;
- barcode/QR capability later where useful;
- clear sync/upload state;
- safe draft preservation.

## 11. Global search

Search should return typed results, for example:

- projects/jobs;
- contacts;
- documents;
- assets;
- work orders;
- RFIs;
- invoices;
- variations.

Search results must never reveal inaccessible record titles or metadata.

## 12. Design system

The development company should establish a reusable NuBlox design system with:

- typography;
- spacing;
- colour tokens;
- form controls;
- buttons;
- tables;
- cards;
- navigation;
- modal/drawer patterns;
- status tokens;
- notification patterns;
- accessibility states.

Business/domain components should compose these primitives rather than reimplement them.
