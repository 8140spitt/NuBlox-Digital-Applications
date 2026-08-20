# V1 Slice 5 — Site, Quality & Safety

## Product boundary

Slice 5 activates the existing Package 008 Site, Quality & Safety schema inside the NuBlox application shell. The V1 boundary is a coherent field workflow that can be used from mobile and desktop without introducing a second project, document or attachment model.

An authorised project team can:

1. create controlled project site/location identities;
2. create, submit and approve attributable site diaries;
3. publish controlled inspection/checklist definitions;
4. execute inspections against an exact published checklist version;
5. record item responses and attributable inspection findings;
6. raise and close defects/snags;
7. raise and close formal non-conformance reports;
8. report safety observations, create corrective/preventive actions, complete those actions and close the event;
9. link exact issued project-information revisions as field photos/evidence.

## Source-of-truth rules

### Project and site scope

Projects and project participation remain authoritative in the existing Projects domain. Site operations never create a parallel project-access model. Every project-scoped read and write requires active organisation membership plus effective project membership.

Project site/location identities use the existing `project_sites` primitive already shared by the project-information and field-operation packages.

### Project information and evidence

Photos and documentary evidence remain controlled Package 007 information revisions. Slice 5 links exact issued or superseded `information_container_versions` through the existing diary, defect, NCR and safety evidence-link tables.

Slice 5 does not create a second file store, opaque attachment table or editable copy of document metadata.

### Quality definitions

Inspection templates are versioned definitions. An inspection references one exact published template version, so the checklist used in the field cannot silently change after inspection evidence has been recorded.

Inspection findings are attributable evidence and may be used as the source for a defect or NCR without collapsing those separate controlled lifecycles.

## Access-control model

All runtime reads and writes require:

- an active organisation/member context;
- an explicit permission decision;
- effective project membership for project-scoped facts.

Standard V1 role defaults are:

- **Owner / Administrator / Manager** — full Slice 5 control;
- **Member/Professional** — field operation, quality and safety working access, excluding diary approval and template administration where configured;
- **Field Worker** — mobile field capture, inspection, defect and safety working access without formal NCR administration or diary approval;
- **Finance/Commercial / Read Only** — site, quality and safety visibility only.

Menu visibility and hidden mutation controls remain UX projections only; services re-check permissions and project scope server-side.

## Controlled lifecycles

### Site diary

`draft field record → submitted attributable evidence → approved controlled diary`

Submission and approval are explicit state transitions. Approval is separate from ordinary diary capture permission.

### Inspection

`published checklist version → in-progress inspection → item responses/findings → completed inspection`

Every required checklist item must have a recorded result before the inspection can complete.

### Defect

`open defect → controlled working lifecycle → closed defect`

A defect may reference an inspection finding while retaining its own identity, status and closure evidence.

### Non-conformance

`open/contained NCR → controlled working lifecycle → closed NCR`

A formal NCR remains distinct from a defect even when both originate from one inspection finding.

### Safety observation/action

`reported observation → corrective/preventive action → completed action(s) → closed safety event`

A safety event cannot close while an action remains open or in progress. Action completion records the completing member and organisation.

## Mobile field workspace

`/site` is the Slice 5 operational workspace. It provides:

- project and site context;
- diary capture and approvals;
- published checklists and inspection execution;
- defect and NCR registers;
- safety observations and actions;
- controlled evidence linking.

The surface uses touch-sized controls, responsive forms and single-column narrow-screen layouts so primary capture and closure workflows remain usable from a field device as well as desktop.

## V1 acceptance boundary

Slice 5 is complete when the permanent Complete System Validation gate proves:

- the production migration stream and generated database types remain exact;
- standard-role permission parity for existing and newly created organisations;
- effective project membership denial even when an organisation-level permission is present;
- diary create/submit/approve attribution;
- exact published checklist version binding;
- required inspection-item completion enforcement;
- inspection finding creation and linked defect/NCR evidence;
- controlled defect and NCR closure;
- safety-action completion before event closure;
- exact issued information-revision reuse for photo/evidence links;
- read-only browser visibility without mutation controls;
- owner browser acceptance through the principal site → diary → inspection → defect → safety workflow;
- responsive Site workspace behavior;
- the complete permanent validation gate is green on the exact final head.

## Explicitly deferred

The following are outside this Slice 5 release boundary:

- dedicated RAMS author/review/acceptance UX;
- permit-to-work administration UX;
- toolbox-talk/briefing administration UX;
- specialist accident/incident investigation and statutory reporting workflows;
- external contractor field portal participation;
- offline-first synchronization and conflict resolution;
- native camera/upload UX beyond reuse of the existing project-information storage boundary;
- advanced site/quality/safety dashboards, trend analytics and cross-project reporting;
- configurable inspection scoring, signatures and richer dynamic question types.

These capabilities may extend Package 008 later, but they must preserve project scope, exact-version evidence, auditability and the shared Project Information source-of-truth boundary.
