# NuBlox Network — External Access Architecture

**Status:** Governing target architecture  
**Effective:** 12 September 2026  
**Scope:** all NuBlox enterprise functions F01–F29, shared platform services and external/cross-organisation workflows.

## 1. Architectural decision

NuBlox Portal is not a standalone business module and must not become a second application containing duplicated versions of internal workflows.

The product concept is **NuBlox Network**: a horizontal external-access and cross-organisation interaction layer over canonical NuBlox records.

The implementation concept is the **External Access Kernel**.

Internal business processes remain owned by their canonical domain modules. When a record or action must cross an organisation boundary, the owning workflow publishes an explicitly authorised external view/action into NuBlox Network.

Examples:

- Commercial quotation -> customer review and accept/reject.
- Procurement RFQ -> invited supplier view and submit quotation.
- RFI -> assigned external respondent view and respond.
- Submittal -> external reviewer review/approve/reject.
- Finance invoice -> customer view, dispute or payment action.
- Work order -> external contractor accept, execute and submit completion evidence.

The portal therefore becomes a controlled interaction surface, not the owner of the business transaction.

## 2. Governing principles

1. **Canonical ownership stays in the domain.** External records are views/actions over the authoritative domain record; they are not independently editable portal copies.
2. **Explicit access only.** A relationship, project membership, supplier record, customer record or email address does not by itself grant access.
3. **Deny by default.** Every external view, download and mutation requires a valid server-side grant.
4. **Tenant membership and external access are different concepts.** A person may interact with one or many NuBlox organisations without becoming a member of any owner tenant.
5. **One external identity can hold many contexts.** Supplier, customer, consultant, subcontractor, tenant, regulator and project participant relationships may coexist.
6. **External actions execute domain commands.** The kernel authorises and routes the action; the owning domain validates and persists the business consequence.
7. **No hidden portal-management workflow.** Internal users publish/share from the authoritative record in its owning module. They should not need a separate `/portal/manage` workflow to finish ordinary domain work.
8. **One action inbox.** External users see only work and information relevant to their current grants, aggregated across domains.
9. **Sensitive data requires narrower grants.** Project participation must not automatically expose commercial, payroll, finance, legal, security or personal data.
10. **Every invitation and access change is auditable.** Creation, send, acceptance, grant, revoke, expiry and external business actions must be attributable.
11. **Delivery is durable.** Email or other notifications must use a transactional outbox/provider model with retry and delivery status; `channel='portal'` alone never constitutes portal functionality.
12. **Mobile-first external UX.** External tasks should be light, focused and action-oriented, not replicas of dense internal screens.

## 3. External principal model

The kernel must distinguish the authenticated identity from the business party and from access to a tenant.

```text
Authenticated Identity
        |
        v
External Principal / Party Binding
        |
        v
Access Grant
        |
        +--> Organisation owner
        +--> Business context
        +--> Shared record / record class
        +--> Allowed capabilities/actions
        +--> Validity / revocation
        |
        v
External Work Item / Shared View
        |
        v
Canonical Domain Service
```

A verified email may bootstrap an invitation, but after binding, access is determined by authenticated identity plus explicit grant. Email matching is not a continuing authorisation mechanism.

## 4. Core platform services

### 4.1 ExternalInvitationService

Responsibilities:

- create external transaction invitations;
- bind invitation to intended party/email/context;
- issue signed or opaque single-purpose invitation tokens;
- enforce expiry, revocation and one-time acceptance rules where appropriate;
- bind verified authenticated identity to the invitation;
- create the initial access grant(s);
- audit invitation lifecycle;
- enqueue durable notification delivery.

Organisation-membership invitations remain a distinct tenancy concern. External transaction invitations must not accidentally create owner-tenant membership.

### 4.2 ExternalAccessService

Responsibilities:

- resolve the authenticated external principal;
- evaluate owner organisation, context, record and capability;
- enforce validity, expiry and revocation;
- provide domain-independent `canView`, `canAct`, `canDownload` style checks;
- produce access-decision audit evidence where required.

### 4.3 ExternalWorkService

Responsibilities:

- aggregate actionable external work across domains;
- expose due date, state, owning organisation, context and action type;
- avoid copying canonical business state;
- mark work complete only as part of a successful domain transaction;
- support personalised external navigation and inbox counts.

### 4.4 Domain adapters

Each participating domain provides a narrow adapter contract defining:

- canonical source record;
- external summary/view projection;
- supported external actions;
- action validation schema;
- domain command execution;
- completion/state projection;
- sensitivity classification;
- permitted evidence/document downloads.

The kernel must not contain procurement pricing logic, quotation acceptance rules, RFI rules, invoice dispute logic or work-order completion logic.

## 5. Target data model

Names are provisional; the invariants are mandatory.

### `external_access_invitations`

Core attributes:

- public UUID;
- owner organisation ID;
- invitation purpose/domain key;
- intended person/party and/or normalised email;
- context type and context ID/public ID;
- token hash/version;
- status;
- expiry;
- accepted/revoked timestamps;
- inviter identity;
- audit timestamps.

### `external_access_grants`

Core attributes:

- public UUID;
- owner organisation ID;
- authenticated principal and party binding;
- context type/context ID;
- record type/record ID or explicit policy scope;
- capability/action key;
- valid-from/valid-until;
- revoked state/reason;
- grant provenance/invitation reference;
- audit timestamps.

### `external_work_items`

Core attributes:

- public UUID;
- owner organisation ID;
- external principal/grant context;
- domain key;
- canonical source type/source ID;
- action type;
- state;
- due date;
- published/completed timestamps;
- source version or concurrency reference where needed.

The work item is an index/pointer to authoritative work, not a duplicate transaction table.

### `external_delivery_outbox`

Core attributes:

- event/public ID;
- invitation/work item reference;
- delivery channel;
- recipient;
- template/payload version;
- queued/sent/delivered/failed state;
- attempt count;
- provider message ID;
- failure detail;
- retry schedule;
- timestamps.

## 6. UX operating model

### Internal user

The internal user works in the owning module and sees sharing/external status inline with the source transaction.

Examples:

- Sales quotation: `Send to customer` -> recipients -> permissions -> issue.
- Procurement RFQ: `Invite suppliers` -> recipients -> deadline -> issue.
- RFI: `Assign respondent` -> internal/external person -> due date -> issue.
- Invoice: `Issue to customer` -> recipient -> delivery -> external status.
- Work order: `Assign contractor` -> contractor -> scope -> due date -> publish.

The internal user does not visit a generic portal-management screen to complete those operations.

### External user

The external shell is separate from the internal tenant shell. It contains only granted contexts and actions.

Target navigation is capability-driven rather than module-driven:

- Home
- My Actions
- Projects
- Commercial
- Documents
- Finance
- Service

Sections appear only when the authenticated principal has relevant grants. A supplier invited only to one RFQ should see that RFQ, not generic procurement navigation or unrelated supplier/customer data.

## 7. Application-wide external interaction map

The detailed machine-maintainable register is `docs/architecture/external-access-coverage-register.csv`.

The target responsibilities across F01–F29 are:

| Function | External/network responsibility | Target posture |
| --- | --- | --- |
| F01 Strategy & Enterprise Planning | selected stakeholder plan/review packs, acknowledgement and controlled contribution | selective |
| F02 Corporate Governance | external/non-executive board and committee packs, decisions, declarations, actions | controlled |
| F03 Enterprise Performance Management | shared client/JV/partner performance packs, actions and evidence | selective |
| F04 Corporate Development & M&A | adviser/target/JV due-diligence rooms, Q&A, approvals and evidence | high-sensitivity |
| F05 Product, Service & Innovation Management | customer/partner research, pilot feedback, design/lifecycle review | selective |
| F06 Marketing & Brand | authenticated event/campaign/partner participation where needed; public marketing remains outside Network | limited |
| F07 Sales & Commercial Management | proposal/quotation review, accept/reject, clarifications, controlled customer approvals | core |
| F08 Customer Service, Experience & Success | onboarding tasks, cases, service requests, customer responses and feedback | core |
| F09 Procurement & Supplier Management | supplier onboarding, qualification, RFQ response, PO acknowledgement, compliance evidence | core |
| F10 Demand, Supply Chain & Logistics | ASN/delivery booking, logistics updates, proof of delivery and exceptions | core |
| F11 Manufacturing / Production Operations | external production partner orders, progress, inspection and quality evidence | contextual |
| F12 Service Delivery & Field Operations | contractor/service partner assignment, accept/decline, progress and completion evidence | core |
| F13 Quality Management | defect/NCR response, inspections, corrective action and close-out evidence | core |
| F14 Finance, Accounting, Treasury & Tax | invoices, statements, payment/dispute, remittance and supplier invoice status | core/high-sensitivity |
| F15 Human Resources / Human Capital | candidate/agency/external-worker onboarding tasks where not employee self-service | contextual/high-sensitivity |
| F16 Information Technology | external service-provider actions and evidence where business process requires it | limited |
| F17 Data, Analytics & AI | explicitly published reports/data products; no implicit access to internal analytics | limited/high-sensitivity |
| F18 Cybersecurity & Information Security | supplier assessments, security evidence, incident coordination and attestations | controlled/high-sensitivity |
| F19 Legal & Corporate Secretariat | counterparty/counsel agreement review, signature workflow, notices and dispute evidence | core/high-sensitivity |
| F20 Risk, Compliance, Internal Control & Audit | auditor/regulator evidence requests, responses, attestations and findings | controlled/high-sensitivity |
| F21 Privacy & Information Governance | data-subject requests, consent/rights evidence and approved information exchange | controlled/high-sensitivity |
| F22 Property, Facilities & Physical Assets | tenant/occupier requests, contractor work orders, asset/service evidence, warranty actions | core |
| F23 Health, Safety, Environment & Sustainability | RAMS, permits, incidents, inspections, training/briefing acknowledgements and ESG evidence | core/high-sensitivity |
| F24 Business Continuity, Crisis & Physical Security | emergency partner actions, crisis coordination and controlled physical-security interactions | controlled/high-sensitivity |
| F25 Communications, Public Affairs & Investor Relations | controlled stakeholder/investor packs and acknowledgement where authentication is required | selective |
| F26 Knowledge, Document & Records Management | controlled document sharing, transmittals, revisions, review/acknowledgement and immutable issue evidence | core |
| F27 Portfolio, Programme & Project Management | cross-organisation project participation, RFIs, submittals, instructions, tasks and progress evidence | core |
| F28 Change & Transformation Management | partner/consultant/stakeholder actions, readiness evidence, training/feedback | contextual |
| F29 Business Process & Continuous Improvement | external actions surface through owning domains; Network itself is governed as a shared process capability | platform |

## 8. Current-state findings that drive the refactor

The repository currently contains several different meanings of “portal”:

1. `/portal` supports tenant-member collaboration actions.
2. Standalone external project collaborators can authenticate and see shared projects, but current external project access does not yet provide the same controlled RFI/submittal/instruction action model as member mode.
3. Commercial quotation supports a `portal` delivery-channel value without a complete customer portal publication/acceptance workflow.
4. Finance includes `portal` in delivery-channel choices for selected documents without a common external finance interaction implementation.
5. Supplier RFQ work in PR #142 proves a useful round trip, but introduces another invitation/signup path and therefore must be folded into the common External Access Kernel rather than becoming a permanent supplier-specific access architecture.
6. `/portal/manage` contains internal assignment/publication operations that belong in the authoritative Documents/Project Information workflows.
7. Email delivery is not yet a production-grade durable provider/outbox capability. This is a blocker for reliable invitation-based external workflows.

No new domain should add another bespoke external-auth cookie, supplier/customer-specific portal shell or `channel='portal'` flag without implementing the kernel contract.

## 9. Security invariants

- Public URLs use UUIDs or purpose-built opaque tokens; sequential internal IDs are never sufficient access controls.
- Invitation tokens are purpose-bound, expiring, revocable and stored hashed where applicable.
- All external reads and writes re-authorise server-side on every request.
- Direct endpoint access without a valid grant is denied even when the caller knows a record identifier.
- Revocation and expiry take effect immediately on subsequent access checks.
- External identities do not inherit owner-tenant permissions.
- Project-level access does not imply commercial, finance, HR, legal, HSE or personal-data access.
- Downloads use the same grant/sensitivity checks as HTML/API views.
- Domain actions are transactionally coupled to work-item completion; a failed domain command cannot falsely mark external work complete.
- Audit records identify actor, owner organisation, context, record, action, decision and relevant provenance.

## 10. Delivery sequence

### Phase 0 — stop architectural divergence

- Treat this document and coverage register as governing design.
- Do not merge new bespoke portal identity/access patterns.
- Keep F05 implementation isolated from this workstream.

### Phase 1 — kernel foundation

- schema migrations for invitations, grants, work items and delivery outbox;
- `ExternalInvitationService`;
- `ExternalAccessService`;
- `ExternalWorkService`;
- external shell and `My Actions` inbox;
- production email provider abstraction plus durable outbox/retry/delivery status;
- audit and direct-access security tests.

### Phase 2 — migrate existing collaboration

- migrate project external collaboration to common principal/grant model;
- move internal publication/assignment controls out of `/portal/manage` into owning project/document workflows;
- retain canonical RFI/submittal/instruction/transmittal records;
- give standalone external collaborators controlled actions equivalent to their grants.

### Phase 3 — migrate supplier RFQ

- retain the valid RFQ issue/response business logic from PR #142;
- replace supplier-specific signup/access plumbing with kernel invitation/grant/work-item services;
- publish RFQ from Procurement and complete into canonical supplier returns;
- support multiple suppliers with isolated grants;
- add end-to-end cross-boundary test coverage.

### Phase 4 — customer commercial

- implement quotation/proposal publication and acceptance/rejection;
- replace `portal` channel metadata-only behaviour with real external work;
- surface acceptance outcome on the canonical commercial record.

### Phase 5 — finance

- publish customer invoices/statements/credit documents with appropriate actions;
- supplier invoice/evidence/status interactions where required;
- narrow financial grants and audit rules.

### Phase 6 — construction delivery breadth

- contracts and valuations;
- documents/CDE;
- site/quality/HSE;
- facilities/maintenance/service;
- handover/warranty/defects;
- remaining F01–F29 interactions according to the coverage register.

## 11. Definition of done for any external workflow

A domain cannot claim “portal supported” until all of the following are true:

1. publication starts from the authoritative internal record;
2. intended external principal is explicitly identified;
3. invitation/authentication path is production-capable;
4. explicit access grant is created and enforced server-side;
5. external user sees only authorised data;
6. supported action executes the canonical domain command;
7. concurrency/deadline/status rules are enforced;
8. completion is reflected on the internal source record;
9. revoke/expiry prevents subsequent access;
10. invitation, access and business action are auditable;
11. notification delivery has retry/status evidence;
12. direct unauthorised endpoint tests exist;
13. cross-organisation E2E proves the round trip;
14. no duplicate portal-only copy becomes the system of record.

## 12. UI/UX consequence

The forthcoming UI/UX reset must use the same architectural boundary:

- internal NuBlox = operating workflows and authoritative records;
- NuBlox Network = externally shared work and actions;
- `My Work` = internal user's cross-domain action inbox;
- `My Actions` in Network = external user's cross-domain action inbox.

This prevents the current pattern of heavy screens, duplicated management surfaces and users jumping between unrelated navigation structures merely to continue one business process.
