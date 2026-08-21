# V1 contextual workspaces and navigation consolidation

## Goal

Reduce cross-application navigation overhead before the integration/API slice by making business context the primary way users move through NuBlox.

The change is intentionally a UX/navigation layer over the existing domain services, tenant boundary and permission model. It does not introduce a second project model, duplicate records, or weaken project scoping.

## Interaction model

NuBlox now follows this sequence:

1. start from **My work** or a business context;
2. choose the project, customer, supplier or asset being worked on;
3. keep that context visible while moving through its permitted business functions;
4. use specialist workspaces only when the work is genuinely cross-context.

The global sidebar is therefore deliberately small:

- Home
- My work
- Projects
- Customers
- Suppliers
- Assets
- Finance
- Portal
- More

Specialist functions such as Documents, Procurement, Commercial cost control, Valuations, Site, Schedule, Time, People, Contracts and Accounting remain available through the **More workspaces** directory and global search.

## Project workspace context

When a project is opened, the application shell resolves the selected project through `ProjectWorkspaceService.getWorkspace`. This preserves the existing controls:

- active organisation membership;
- active project membership;
- `project.view` permission in project scope;
- tenant isolation.

Only a successfully resolved project is shown as the current project.

The project context strip exposes permitted workstreams using the actor's existing permission keys. Depending on permissions, this can include:

- Overview
- Documents
- Procurement
- Commercial
- Site
- Schedule
- Assets
- Portal

The selected project public ID travels in the `project` query parameter when moving between workstreams. Existing workspaces remain authoritative for their own actions and continue enforcing their existing service-layer permissions.

## My work

`/my-work` is the default context-first launchpad. It lists only projects returned by `ProjectWorkspaceService.listProjects`, prioritising active work, and provides secondary links to cross-project queues that the actor is already permitted to use.

V1 deliberately does not invent synthetic task counts. Notification aggregation and richer cross-domain action queues remain part of the later notification/search/reporting work.

## More workspaces

`/more` is a permission-filtered directory of specialist business functions. The same directory powers global workspace search, so removing a function from the permanent sidebar does not make it difficult to find.

## Security and control invariants

This slice does not change domain authority:

- navigation visibility is not permission enforcement;
- each destination keeps its existing server/service permission checks;
- project context is resolved server-side and cannot be pinned for a project outside the actor's active member scope;
- external collaboration remains governed by the Slice 7 portal controls;
- audit behaviour remains in the underlying domain services.

## Browser acceptance

Browser coverage verifies:

- the simplified primary navigation for owner and read-only roles;
- specialist workspaces remain discoverable through search and More;
- mutation controls remain absent for read-only users;
- opening a project from My work pins project context;
- project context remains visible while navigating between Documents, Commercial and Site.

## Follow-on refinement

The context shell is the first consolidation step. Individual legacy register pages can now be progressively made more project-aware without another navigation redesign. In particular, project-filter defaults and action redirects should preserve the current project where those workspaces do not yet consume the `project` query parameter directly.
