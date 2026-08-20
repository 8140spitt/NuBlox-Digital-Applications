# V1 Slice 4 — Procurement & Project Commercial Control

## Product boundary

Slice 4 activates the existing Package 005 Procurement and Package 009 Commercial Cost Control schema inside the NuBlox application shell. The product boundary is project procurement plus confidential project commercial control; it is not a second CRM, a second ledger, or an accounts-payable subsystem.

An authorised team can:

1. create project procurement packages and requirement lines;
2. create and issue controlled supplier enquiries/RFQs;
3. create, independently approve and issue purchase orders;
4. record controlled goods/service receipts without over-receipting the issued order;
5. classify issued purchase-order commitments to project cost codes;
6. establish and approve a controlled project budget baseline;
7. create, issue and decide project commercial variations;
8. record supplier applications/valuations against issued purchase orders and submit/assess them;
9. read a project commercial position derived from controlled source facts.

## Source-of-truth rules

### Supplier identity

Supplier, subcontractor, consultant, manufacturer and merchant identities remain CRM `Party` records with supplier-side party roles. Procurement never owns a duplicate supplier master.

### Procurement facts

Package 005 remains authoritative for procurement packages, RFQs, purchase orders, issued purchase-order versions and receipts.

Issued RFQ and purchase-order versions are controlled historical facts. Issue evidence and supplier snapshots are written transactionally with the state transition.

### Commercial facts

Package 009 classifies and interprets procurement facts. It does not copy purchase-order balances or receipt balances into editable commercial fields.

Project cost-code allocations refer to authoritative purchase-order line facts. Budget versions, issued variation versions, variation decisions and valuations remain attributable commercial evidence.

### Finance boundary

Slice 4 does not create accounts-payable invoices, supplier payments or ledger postings from purchase orders, receipts or valuations. Future AP integration must reference the controlled procurement/commercial evidence rather than inventing parallel source facts.

## Access-control model

All runtime reads and writes require:

- an active organisation/member context;
- an explicit permission decision;
- effective project membership for project-scoped facts.

Procurement visibility can be broader than commercial visibility.

Commercial cost control is deliberately confidential. Ordinary project participation does not imply access to budgets, supplier rates, commitments, variations or valuations. Those facts require dedicated `commercial.*` permissions.

Standard V1 role defaults are:

- **Owner / Administrator / Finance-Commercial** — full Slice 4 control;
- **Manager** — procurement plus operational commercial control, excluding the most privileged baseline/decision authorities where configured;
- **Member/Professional** — procurement working access, no confidential commercial-control visibility;
- **Read Only** — procurement view only;
- **Field Worker** — no Slice 4 access by default.

The same defaults are applied by the forward permission migration and by new-organisation bootstrap.

## Controlled lifecycles

### RFQ

`package requirement → RFQ draft version → controlled issue → immutable issued version + issue event + supplier invitation`

### Purchase order

`PO draft version → independent approval → controlled issue → immutable issued version + supplier snapshot + issue evidence → receipts`

Receipts are additive source facts and are rejected if cumulative received quantity would exceed the issued order quantity.

### Budget

`budget identity → draft version + lines → approval → locked approved baseline`

### Variation

`variation identity → draft version + cost-coded items → controlled issue → immutable issued version → attributable decision`

### Supplier valuation

`issued PO → supplier application draft + value-to-date item → submit → assess`

Gross value-to-date is bounded by the authoritative issued purchase-order value. Valuation assessment is commercial evidence, not an AP invoice or payment.

## Derived project commercial position

The cost-control workspace derives, at read time:

- approved baseline budget;
- issued purchase-order commitment;
- commitment classified to project cost codes;
- accepted receipt cost from received less rejected quantity at authoritative PO rate;
- approved change from variation decisions;
- pending change exposure from issued undecided/pending variations;
- budget headroom;
- exposed headroom after pending change.

No editable `committed_cost`, `actual_cost` or equivalent duplicate balance is introduced.

## Browser workspaces

- `/purchasing` — packages, RFQs, purchase orders, issue/approval controls and receipts;
- `/commercial/cost-control` — project cost codes, budgets, commitment classification, variations and derived commercial position;
- `/commercial/valuations` — supplier application/valuation submission and assessment.

All three routes sit inside the existing authenticated NuBlox shell and preserve project/permission boundaries server-side.

## V1 acceptance boundary

Slice 4 is complete when the permanent Complete System Validation gate proves:

- the production migration stream and generated database types remain exact;
- standard-role permission parity for existing and new organisations;
- CRM supplier reuse;
- project-scope denial even where organisation-level permission is present;
- controlled RFQ issue evidence;
- controlled PO approval/issue evidence and immutable issued version state;
- over-receipt prevention;
- commercial confidentiality for ordinary read-only/project users;
- budget approval, commitment classification and variation issue/decision controls;
- derived position arithmetic from authoritative source facts;
- supplier valuation value cap, submission and assessment evidence;
- owner browser acceptance through the full Slice 4 workflow;
- read-only browser acceptance showing Procurement while withholding confidential Commercial controls.

## Explicitly deferred

The following remain outside this Slice 4 release boundary:

- supplier self-service portal and external tender-return UX;
- automated email delivery of RFQs/POs;
- advanced multi-supplier tender comparison/scoring UX and procurement award recommendation;
- purchase-order amendment/version UI beyond the first controlled V1 version;
- split/multi-cost-code allocation editing UI;
- retention, VAT, contra and certificate adjustment UX for valuations;
- valuation certificate-to-AP invoice automation;
- supplier invoices, payment runs and accounts-payable ledger posting;
- advanced forecast snapshots, earned-value analysis and cash-flow forecasting;
- cross-company procurement networks/marketplaces.

Those capabilities may extend Packages 005/009 later, but they must preserve the same CRM, procurement, commercial and finance source-of-truth boundaries.
