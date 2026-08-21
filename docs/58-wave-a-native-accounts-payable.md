# 58 — Wave A Native Accounts Payable

**Status:** Delivery contract  
**Governing architecture:** `57-world-class-native-erp-architecture.md`  
**Wave:** A — Enterprise and accounting completeness  
**Purpose:** close the native procure-to-pay gap between NuBlox procurement, supplier records, accounting and cash without introducing a second supplier, project, tax or ledger model.

## 1. Product outcome

NuBlox will provide a controlled native accounts-payable chain:

**Supplier → Purchase Order / Subcontract → Receipt → Supplier Invoice → Match → Approval → Accounting Posting → Payable → Payment Proposal / Run → Settlement → Reconciliation / Reversal**

The system of record remains NuBlox throughout. External banking rails may transport payment instructions or statements, but they do not own payable state, accounting semantics or audit evidence.

## 2. Existing capability to reuse

This capability extends rather than replaces existing NuBlox primitives:

- CRM Party is the canonical supplier/subcontractor identity;
- procurement packages, RFQs, awards and purchase orders remain the commercial commitment source;
- PO versions remain immutable issued order evidence;
- goods/service receipts remain receipt evidence;
- project commercial controls remain the commitment/forecast authority for project reporting;
- tax categories/rates remain canonical tax configuration;
- accounting accounts, mappings, periods, journals, reporting and year-end remain the statutory accounting kernel;
- project, contract, organisation, document and audit models are reused by reference.

No `suppliers_v2`, second purchase-order model, second project-cost ledger or separate AP chart of accounts is permitted.

## 3. Scope

### 3.1 Supplier invoice capture

Native records must support:

- supplier invoice and supplier credit note;
- supplier invoice number/reference and invoice date;
- accounting/tax date where distinct;
- due date/payment terms;
- supplier Party;
- currency;
- optional project, contract/subcontract and procurement context;
- immutable supplier identity/address/tax snapshots at controlled approval/posting boundaries;
- line items, descriptions, quantities, unit rates and tax snapshots;
- controlled document/evidence links;
- duplicate-invoice detection per supplier and tenant;
- draft, submitted, matched/exception, approved, posted, paid/part-paid, disputed, void/cancelled and reversed consequences without overwriting historical evidence.

### 3.2 PO and receipt matching

NuBlox must support:

- invoice-to-PO matching;
- invoice-line to PO-line matching;
- invoice-line to goods/service receipt matching;
- quantity and value tolerances;
- tax and currency validation;
- partial invoice and partial receipt scenarios;
- multiple invoices against one order;
- one invoice against multiple eligible order lines where controlled;
- non-PO invoices with explicit policy/approval;
- mismatch/exception reasons and resolution evidence;
- prevention of invoicing beyond permitted ordered/received quantity/value unless an authorised exception is recorded.

The authoritative match result is derived from linked commercial and receipt facts plus controlled tolerance policy. Users must not type an arbitrary `matched=true` flag.

### 3.3 Approval and segregation of duties

Permissions must separate at minimum:

- AP view;
- invoice capture/edit before approval;
- invoice submit;
- matching/exception resolution;
- approve;
- post to accounting;
- create payment proposal;
- approve payment run;
- release/export payment instruction;
- record/confirm settlement;
- reverse/correct.

The product must support maker/checker separation and configurable delegated-authority thresholds. A user must not gain authority merely because a control is hidden in the UI.

### 3.4 Accounts-payable accounting

The accounting kernel will be extended with controlled mappings appropriate to AP, including at minimum:

- accounts payable / trade creditors;
- purchase/expense or project-cost destination;
- recoverable input VAT/tax where applicable;
- cash/bank clearing or payment account;
- purchase price/quantity variance where required;
- supplier advances/unapplied amounts where required.

Initial posting pattern for an approved supplier invoice:

```text
Dr Expense / Project Cost / Inventory or Asset destination   net
Dr Recoverable Input VAT / Tax                               tax
Cr Accounts Payable                                          gross
```

A supplier credit note reverses the economic effect through a distinct controlled source event. Corrections do not mutate previously posted journal evidence.

Posting must be:

- balanced;
- transactional;
- accounting-period aware;
- idempotent for the same immutable source event/fingerprint;
- tenant constrained;
- reversible only through controlled reversal evidence;
- traceable from journal line back to supplier invoice and commercial source.

### 3.5 Payables subledger

NuBlox must derive supplier-account position from authoritative supplier documents, approved adjustments, payments and reversals.

Required views include:

- supplier transactions;
- open payables;
- aged payables;
- overdue payables;
- disputed/held invoices;
- unapproved/unposted invoices;
- supplier statement reconciliation foundations;
- project/contract/AP exposure where linked.

`paid`, `part-paid`, `overdue` and outstanding balance are derived states, not independently editable balances.

### 3.6 Payment proposals and payment runs

Native capability must support:

- due/discount/priority-based payment proposals;
- supplier/payment-method/bank-detail eligibility controls;
- holds and disputes;
- proposal review and controlled selection/exclusion;
- payment-run approval;
- immutable run version/evidence after approval;
- individual payment instructions within a run;
- allocation to one or more supplier invoices/credits;
- partial payments;
- payment reference and remittance evidence;
- export to banking rails/file formats as transport only;
- settlement confirmation and reversal/cancellation controls.

Supplier bank details are sensitive master data and require restricted access, change audit, approval controls and change-risk checks before use in a payment run.

## 4. Canonical data model

The implementation should introduce AP-specific transactional facts while preserving canonical shared entities.

Expected logical entities include:

- `supplier_financial_documents` — stable supplier invoice/credit-note identity;
- supplier financial document subtype/detail where needed;
- `supplier_financial_document_items`;
- `supplier_financial_document_item_taxes`;
- supplier document party/address/tax snapshots;
- `supplier_invoice_matches` and line-level match allocations;
- `supplier_invoice_exceptions` / resolutions;
- approval events;
- `supplier_payments` or a deliberately generalised payment supertype if existing payment semantics can be extended safely;
- `supplier_payment_allocations`;
- `payment_runs` and run items/instructions;
- reversal/cancellation records.

Exact SQL names may vary after implementation review. The architectural invariant is more important than naming: separate facts for document, match, approval, posting, payment, allocation and reversal.

## 5. Construction and built-environment depth

AP cannot be a generic office-expense screen only. It must understand construction procurement and commercial evidence.

Required project-aware scenarios include:

- material supplier invoice against PO and delivery/receipt;
- subcontractor invoice/application against subcontract commitment;
- professional consultant invoice against appointment/order;
- plant hire invoice with period/usage evidence;
- non-PO statutory/utility/site overhead invoices;
- project cost-code/WBS attribution;
- retention/withholding/CIS-style deductions as later jurisdictional extensions without corrupting the generic payable model;
- linkage from payable actuals to project commitment, forecast and cost reporting.

A single approved event must be able to explain both enterprise-finance and project-commercial consequences without re-entry.

## 6. Lifecycle and immutability

Baseline lifecycle:

```text
Draft → Submitted → Matching / Exception → Approved → Posted → Open / Part-paid → Settled
                         ↘ Rejected / Returned
                         ↘ Disputed / Held
```

Rules:

- pre-approval draft content may be edited under permission;
- once approved and especially once posted, economic facts are not silently edited;
- supplier credits, adjustments and accounting reversals provide controlled correction mechanisms;
- payment allocations are reversed, not deleted from history;
- approval, posting and payment evidence is append-oriented and attributable.

## 7. UX operating model

Primary workspace: **Finance → Accounts Payable**.

Expected views:

- Inbox / Capture;
- To match;
- Exceptions;
- Awaiting approval;
- Open payables;
- Payment proposals;
- Payment runs;
- Suppliers / statements;
- Aged payables;
- Configuration.

Contextual entry points must also exist from:

- Supplier → Invoices / Payments / Statement;
- Project → Procurement / Commercial / Finance;
- Purchase Order → Receipts / Supplier invoices;
- Contract/Subcontract → Applications / invoices / payments where applicable.

The user should not need to know which internal module owns the journal, PO or supplier record.

## 8. Reporting and controls

Minimum operational/management reporting:

- aged payables by supplier and organisation;
- due cash requirements;
- invoice processing cycle time;
- unmatched and exception value;
- approved-not-posted value;
- posted-not-paid value;
- payment-run totals and failures;
- purchase-order committed vs received vs invoiced vs paid;
- project cost actuals sourced from AP;
- tax input-control reconciliation;
- AP control-account to subledger reconciliation.

## 9. SAP/ERP parity target

This Wave A increment materially advances parity with SAP-style capabilities across:

- FI — accounts payable and posting;
- MM — invoice verification against procurement;
- CO / Project System — cost attribution and project consequence;
- Cash Management / Treasury — payment planning foundations;
- GRC / MDG-S — authority, supplier master and bank-detail controls.

NuBlox should exceed generic parity by making the procurement, project-commercial and financial lineage native and immediately understandable in construction context.

## 10. Implementation increments

### A1 — Supplier invoice and three-way-match foundation

- schema/migration;
- AP permissions;
- supplier invoice/credit-note service;
- invoice items/tax snapshots;
- PO/receipt match service and exceptions;
- Finance AP workspace;
- integration and browser coverage.

### A2 — AP posting and subledger

- AP accounting mappings/source types;
- approved invoice/credit posting;
- supplier open-item and aged-payables reporting;
- AP control reconciliation;
- posting/reversal/concurrency tests.

### A3 — Payment proposals and runs

- supplier bank/payment configuration;
- payment proposal/run lifecycle;
- allocations/remittance;
- export/release boundary;
- settlement/reversal;
- maker/checker and audit coverage.

### A4 — Bank/cash and reconciliation bridge

- bank account master and statement ingestion;
- payment settlement matching;
- bank reconciliation;
- cash position integration;
- preparation for broader Wave A treasury/cash controls.

## 11. Acceptance gates

An increment is not complete because a route or table exists. Exit requires:

1. tenant isolation at database/service boundaries;
2. explicit server-side permissions and SoD controls;
3. no duplicate supplier, PO, project, tax or accounting master;
4. immutable/controlled economic evidence;
5. transactional and concurrency-safe material writes;
6. idempotent accounting consequences;
7. exact source-to-journal traceability;
8. positive, denial, tenant-crossing, lifecycle and reversal integration tests;
9. responsive context-first browser workflow;
10. generated database types aligned with migrations;
11. full Complete System Validation on the exact release head.

## 12. Deferred from A1

The following remain within the world-class target but should not overload the first increment:

- OCR/AI invoice extraction;
- PEPPOL/e-invoicing networks;
- dynamic discounting;
- supplier financing;
- full CIS/statutory deduction engine;
- multi-jurisdiction withholding tax;
- advanced fraud/anomaly models;
- broad treasury forecasting;
- complete bank reconciliation.

Their future introduction must preserve the same canonical invoice, approval, posting and payment evidence rather than introduce parallel workflows.