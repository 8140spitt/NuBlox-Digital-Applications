# 35 — Operational Accounts Receivable: Billing Settings and Invoices

## 1. Purpose

This boundary activates the first operational accounts-receivable structures already present in **Package 004 — Contracts and Finance**.

It deliberately separates invoice preparation/issue from later cash and accounting workflows:

```text
Active Executed Contract
        ↓
Customer Billing Defaults
        ↓
Draft Invoice
        ├── payment term / due-date policy
        ├── customer PO/reference
        └── fixed-precision invoice lines + tax selections
        ↓
Controlled Issue
        ├── issue-date tax refresh
        ├── legal invoice-number allocation
        ├── customer/contact/address snapshots
        ├── issue/recipient evidence
        └── immutable issued invoice
```

No payment, allocation or general-ledger fact is created by invoice issue.

## 2. Application surfaces

```text
/finance/billing
/finance/invoices
/finance/invoices/[invoicePublicId]
```

`/finance/billing` manages tenant payment terms and customer-specific billing defaults.

`/finance/invoices` lists tenant invoices and exposes active executed contracts that are eligible to seed a draft invoice.

`/finance/invoices/[invoicePublicId]` exposes invoice header policy, charge lines, tax, contract-value context, issue controls, immutable issue evidence and customer snapshots.

## 3. Permission family

The first operational AR permission family is:

```text
finance.view
finance.manage                     # broad AR umbrella
finance.billing.manage
finance.invoice.create
finance.invoice.draft.manage
finance.invoice.issue
```

`finance.manage` is the same-domain umbrella fallback for the granular Package 004 finance mutations. It is independent from both `commercial.manage` and `contract.manage`.

Standard defaults are:

```text
Owner / Administrator
    finance.view
    finance.manage
    finance.billing.manage
    finance.invoice.create
    finance.invoice.draft.manage
    finance.invoice.issue

Finance/Commercial
    finance.view
    finance.billing.manage
    finance.invoice.create
    finance.invoice.draft.manage
    finance.invoice.issue
    # deliberately no finance.manage

Manager / Member/Professional / Field Worker / Read Only
    no automatic finance grants
```

Finance/Commercial deliberately receives only the activated AR responsibilities. The absence of `finance.manage` prevents later payment, credit-note, reversal or wider finance capabilities from flowing to that role merely because they share the finance namespace.

As with other NuBlox umbrella families, explicit granular member deny outranks a granular role grant and the `finance.manage` fallback.

## 4. Bootstrap parity

The forward permission migration seeds the standard-role grants for existing organisations.

`OrganisationBootstrapService` carries equivalent grants for future organisations. This increment also closes a prior Package 004B parity gap by persisting the contract-amendment granular permissions for newly bootstrapped Owner/Administrator roles rather than relying only on behaviorally equivalent `contract.manage` fallback.

Bootstrap integration coverage asserts the actual persisted role-permission rows.

## 5. Billing configuration

### Payment terms

Payment terms are tenant-owned policy records using the existing `payment_terms` relation.

Supported calculation bases are:

```text
invoice_date
end_of_month
manual
```

The application interpretation is:

```text
invoice_date  → issue date + days_offset
end_of_month  → end of issue month + days_offset
manual        → explicit draft due date; days_offset = 0
```

One payment term may be marked as tenant default. Changing the default is serialised under the tenant organisation row.

### Customer billing defaults

`party_billing_settings` stores customer-specific preparation defaults:

- default payment term;
- default currency reference;
- customer account reference;
- whether a customer PO/reference is required before invoice issue.

These settings are policy/defaults, not issued-document evidence. Issue snapshots the facts that must remain reproducible later.

Contract-derived invoices retain the contract currency as their authoritative currency; a customer default currency does not silently override the executed contract.

## 6. Invoice source boundary

The first operational invoice slice is intentionally **contract-anchored**.

A draft invoice may be created only when:

- the actor has active tenant membership;
- the actor has `finance.invoice.create` or `finance.manage` fallback;
- the actor has `contract.view` because the contract is the cross-domain source context;
- the contract belongs to the active tenant;
- the logical contract is `active`;
- an executed contract version exists;
- that executed version has a `client` contract party.

The draft retains existing Package 004 links:

```text
financial_documents.customer_party_id
financial_documents.billing_contact_party_id
financial_documents.project_id
financial_documents.contract_id
financial_documents.currency_code
```

The customer comes from the executed contract-party evidence rather than being selected independently in the first slice. The primary active CRM organisation contact is used as the initial billing contact where available.

## 7. Draft identity and numbering

A newly created invoice is:

```text
document_kind = invoice
lifecycle_status = draft
document_number = NULL
```

This follows the existing Package 004 database invariant: a legal document number is required only after a financial document leaves draft state.

Draft creation therefore **does not consume an invoice number**.

The first numbering policy is a controlled tenant-local sequence rendered as:

```text
INV-000001
INV-000002
...
```

Allocation happens only inside the issue transaction. Number uniqueness remains enforced by the existing `(organisation_id, document_kind, document_number)` database key.

A future configurable statutory numbering subsystem can replace the presentation policy without changing the rule that allocation belongs at issue rather than draft creation.

## 8. Draft line and tax calculation

Invoice lines reuse:

```text
financial_document_items
financial_document_item_taxes
```

Line constraints remain relational and fixed precision:

```text
quantity  DECIMAL(19,6) > 0
unit_rate DECIMAL(19,4) >= 0
```

The application reuses Package 003 scaled-`BigInt` arithmetic:

```text
line net = quantity × unit_rate
line tax = taxable_amount × applied_rate_percent / 100
line gross = net + tax
```

JavaScript binary floating point is not authoritative for invoice arithmetic.

A tax category is selected when the draft line is created. Draft tax is provisional because an invoice may be issued on a later date.

## 9. Issue-time tax boundary

Immediately before issue, every invoice tax fact is recalculated using the tax-category rate effective at the **actual issue timestamp/date**.

This prevents a long-lived draft from freezing a rate merely because that rate was current when the line was first prepared.

Taxable categories require an effective rate. Zero/exempt/outside-scope categories may resolve to zero where no explicit rate row is required.

The resulting applied rate, taxable amount and tax amount remain stored with the issued line tax evidence so later tax-table changes do not rewrite historical invoices.

## 10. Customer PO/reference policy

If `party_billing_settings.purchase_order_required = TRUE`, issue is rejected until `invoices.customer_purchase_order_reference` is populated.

The policy is enforced at issue rather than draft creation so a preparer may assemble the draft while waiting for the customer reference.

## 11. Due-date calculation

The due date is finalised inside the issue transaction.

For automatic payment terms it is derived from the issue date. For manual/no-term invoices an explicit due date must exist before issue.

A manual due date cannot be earlier than the issue date.

This ensures an old draft date cannot accidentally create a due date that predates the actual legal invoice issue.

## 12. Issue and immutable evidence

Issue requires invoice-issue authority and an eligible draft with at least one charge line.

Issue atomically:

1. validates billing policy;
2. finalises due date;
3. refreshes issue-date tax facts;
4. snapshots the customer;
5. snapshots the billing contact where one exists;
6. copies current billing-address evidence;
7. serialises tenant invoice-number allocation;
8. sets the financial document to `issued`;
9. records `financial_document_issue_events`;
10. records recipient evidence;
11. appends an audit event.

The issue channel is evidence of the chosen mechanism. This slice does not claim production outbound email/API/portal delivery.

After issue, ordinary invoice draft APIs reject header and line mutation.

## 13. Customer and address snapshots

Issue uses the existing normalised snapshot structures:

```text
financial_document_party_snapshots
financial_document_party_snapshot_addresses
```

The customer snapshot may carry the configured customer account reference. Billing-contact identity is separately snapshotted where present.

A later CRM edit therefore does not rewrite the customer name, contact details or address evidence associated with the issued invoice.

## 14. Contract-value context

The invoice workspace derives two useful controls without creating accounting balances:

```text
Current Contract Value
= Executed Contract Baseline
+ Agreed Contract Amendment Adjustments
```

and:

```text
Previously Issued Contract Net
= Sum(net invoice lines on other issued invoices for this contract)
```

These figures are contextual controls only. This first slice does not automatically prevent over-invoicing because later valuations, applications, retention and credit-note rules need a deliberate commercial policy rather than a simplistic cap.

## 15. Audit actions

The slice writes:

```text
finance.payment_term.created
finance.party_billing_settings.updated
finance.invoice.created_from_contract
finance.invoice.draft.updated
finance.invoice.line.added
finance.invoice.line.removed
finance.invoice.issued
```

Audit events include active tenant, actor user/member, correlation ID and project context where the contract has a project.

## 16. Tenant and security boundary

Every billing/invoice query is tenant-scoped.

Foreign invoice public IDs are masked as not found after the caller passes the finance read boundary.

Cross-domain contract sourcing requires `contract.view`; finance authority cannot substitute for contract visibility.

Conversely, `contract.manage` and `commercial.manage` cannot substitute for finance mutation authority.

## 17. Validation contract

The permanent release gate must prove:

- all production migrations apply cleanly to MySQL 8.4;
- structural counts remain correct;
- generated Kysely types have zero drift;
- standard-role migration/bootstrap parity;
- payment-term and customer-default mutation policy;
- pre-execution contract rejection;
- legally unnumbered drafts;
- fixed-precision line totals;
- customer PO enforcement;
- issue-date tax refresh;
- due-date calculation;
- customer/contact/address snapshots;
- immutable issued documents;
- sequential tenant invoice numbering;
- explicit granular deny overriding `finance.manage`;
- read-vs-mutation separation;
- foreign-tenant masking;
- SvelteKit type/diagnostic gate.

## 18. Deliberate exclusions / next increments

Not claimed implemented here:

- credit notes;
- invoice void/reversal UI and policy;
- payments;
- payment allocations;
- customer statements;
- aged receivables / dunning;
- valuation/application-to-invoice automation;
- retention release automation;
- configurable statutory invoice-number formats;
- PDF/document rendering;
- production outbound invoice delivery;
- general-ledger posting;
- bank reconciliation.

The next Package 004 finance boundary should be **payment receipt and allocation**, preceded or accompanied by controlled credit-note/void policy so receivable balances can be corrected without mutating issued invoices.
