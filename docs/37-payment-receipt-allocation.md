# 37 — Operational Accounts Receivable: Payment Receipt and Controlled Allocation

## 1. Purpose

Package 004E activates the payment, allocation and reversal structures already present in **Package 004 — Contracts and Finance**.

It extends the immutable invoice/credit-note boundary into cash application:

```text
Issued Invoice
    − Issued Credit Notes
          ↓
Outstanding Receivable
          ↓
Customer Payment Receipt
          ↓
Controlled Allocation
          ↓
Active Cash Application
          ↓
Allocation Reversal | Payment Reversal
```

The governing rule is:

> **A payment is an immutable receipt fact. Allocation and correction create additional controlled records; they do not rewrite or delete the original cash fact.**

No general-ledger posting or bank-reconciliation fact is created by this boundary.

## 2. Application surfaces

```text
/finance/payments
/finance/payments/[paymentPublicId]
/finance/invoices/[invoicePublicId]
```

`/finance/payments` records customer receipts and lists their active/reversed cash position.

`/finance/payments/[paymentPublicId]` exposes receipt evidence, active and reversed allocations, eligible same-currency invoices, allocation controls and controlled payment reversal.

The invoice detail surface now exposes the operational receivable position:

```text
Invoice Gross
− Issued Credit Gross
− Active Payment Allocations
= Outstanding Receivable
```

That position is derived. It is not stored as an editable invoice balance or lifecycle field.

## 3. Permission family

Package 004E adds:

```text
finance.payment.create
finance.payment.allocate
finance.payment.allocation.reverse
finance.payment.reverse
```

All four use the existing same-domain umbrella:

```text
finance.manage
```

Permission precedence remains:

```text
explicit granular member deny
    > granular member allow / role grant
    > finance.manage fallback
    > default deny
```

`commercial.manage` and `contract.manage` do not grant payment authority.

### Standard-role defaults

```text
Owner / Administrator
    finance.payment.create
    finance.payment.allocate
    finance.payment.allocation.reverse
    finance.payment.reverse
    + existing finance.manage

Finance/Commercial
    finance.payment.create
    finance.payment.allocate
    finance.payment.allocation.reverse
    finance.payment.reverse
    # deliberately no finance.manage

Manager / Member/Professional / Field Worker / Read Only
    no automatic finance grants
```

Payment reversal is an ordinary immutable finance correction in this model. It does not destroy a legal financial document and is therefore not treated like the stronger `finance.invoice.void` authority.

## 4. Existing normalised data model

No new payment business tables are introduced.

Package 004E uses:

```text
payments
payment_allocations
payment_allocation_reversals
payment_reversals
payment_methods
```

Relationships are:

```text
Payment
    ├── Allocation → Invoice A
    ├── Allocation → Invoice B
    └── Payment Reversal

Allocation
    └── Allocation Reversal
```

A payment can be allocated to multiple invoices and an invoice can receive multiple payments. The many-to-many relationship therefore remains normalised through `payment_allocations`.

## 5. Payment receipt fact

Recording a payment requires:

```text
finance.payment.create OR finance.manage
AND active tenant membership
AND active payment method
AND amount > 0
AND valid three-letter currency code
```

The receipt stores:

- immutable public identity;
- optional payer CRM party;
- payment method;
- received date/time;
- positive amount;
- currency;
- optional bank/remittance/payment reference;
- creating organisation member;
- created timestamp.

No invoice allocation is implied by receipt creation.

### Optional payer

A payer may be omitted so an unidentified bank receipt can be recorded without fabricating CRM identity.

Selecting a payer from CRM requires `crm.view` because it traverses a separate domain. The selected party must be active and owned by the current tenant.

The payment references the current CRM party rather than creating a historical party snapshot because the Package 004 payment model does not contain a receipt-party snapshot relation. The immutable cash facts remain amount, currency, method, received time, reference and creator.

## 6. Positive cash magnitudes

Payment and allocation amounts are stored as positive fixed-precision magnitudes:

```text
DECIMAL(19,4) > 0
```

Authoritative application calculations use the same scaled-integer decimal functions used by commercial and invoice calculation. JavaScript binary floating point is not authoritative.

## 7. Usable payment balance

A payment's usable value is derived as:

```text
Usable Payment
= Payment Amount
− Sum(Active Allocations)
```

An allocation is active when no corresponding `payment_allocation_reversals` row exists.

A reversed payment has no usable value even though its original receipt amount remains preserved.

## 8. Invoice outstanding receivable

For an issued invoice:

```text
Outstanding Receivable
= Invoice Gross
− Sum(Issued Credit Note Gross)
− Sum(Active Payment Allocations)
```

Only **issued** credit notes affect the receivable. Draft corrections do not.

Only **active** allocations affect the receivable. Reversed allocations do not.

The invoice workspace derives neutral operational settlement states:

```text
open
part_settled
settled
```

alongside the document lifecycle. A credit can therefore settle an invoice without falsely labelling that invoice as “paid.”

Draft invoices have no receivable balance. Voided invoices have zero operational outstanding while their legal issue/void evidence remains preserved.

## 9. Allocation eligibility

Allocation requires:

```text
finance.payment.allocate OR finance.manage
AND payment belongs to active tenant
AND payment is not reversed
AND invoice belongs to active tenant
AND invoice lifecycle = issued
AND payment currency = invoice currency
AND allocation amount > 0
AND allocation <= usable payment
AND allocation <= invoice outstanding
```

The initial boundary deliberately performs **no FX conversion**. Cross-currency allocation is rejected rather than silently converting cash.

### Payer/customer mismatch

A selected payment payer does not have to equal the invoice customer.

Third-party payments can be legitimate, so payer mismatch is surfaced in the workspace as a review signal rather than being treated as proof that allocation is invalid.

The hard invariants remain tenant ownership, currency equality, usable payment and invoice outstanding.

## 10. Concurrency and locking

The authoritative allocation transaction locks:

1. the payment row; then
2. the target invoice document row.

Only after both locks are held does the service recompute:

```text
remaining usable payment
current invoice outstanding
```

This prevents two concurrent actors from independently seeing and consuming the same payment or invoice balance.

The allocation is inserted only after both limits are satisfied.

## 11. Allocation reversal

An allocation is never edited or deleted by the application.

Correction requires:

```text
finance.payment.allocation.reverse OR finance.manage
AND payment not already reversed
AND allocation belongs to that payment and active tenant
AND allocation has no existing reversal
AND explicit reason
```

The service writes one immutable `payment_allocation_reversals` row containing:

```text
payment_allocation_id
reversed_by_member_id
reversed_at
reason
```

The original allocation amount, invoice link, allocator and timestamp remain unchanged.

After reversal the amount becomes usable on the payment again and no longer reduces invoice outstanding.

## 12. Payment reversal

A payment is corrected through `payment_reversals`, not by changing or deleting the receipt.

Reversal requires:

```text
finance.payment.reverse OR finance.manage
AND payment belongs to active tenant
AND payment has no existing payment reversal
AND explicit reason
```

The Package 004 invariant requires active allocations to be reversed first.

Package 004E enforces that atomically:

1. lock the payment;
2. lock all payment allocations;
3. identify allocations without an existing allocation reversal;
4. insert allocation-reversal evidence for every still-active allocation;
5. insert the payment-reversal evidence;
6. append audit evidence;
7. commit the transaction.

A partially failed payment reversal cannot leave active allocations attached to a reversed payment.

After reversal:

- the original receipt remains visible;
- every allocation remains visible;
- all former active allocations have reversal evidence;
- the payment has zero usable balance;
- the restored invoice outstanding positions are derived from the reversed allocation state.

## 13. Audit actions

Package 004E writes:

```text
finance.payment.recorded
finance.payment.allocated
finance.payment.allocation.reversed
finance.payment.reversed
```

Audit events retain active tenant, actor user/member, correlation ID and relevant payment/invoice identifiers and amounts.

## 14. Tenant and cross-domain boundary

Every payment, allocation and invoice lookup is tenant-scoped.

A foreign payment or invoice public ID is masked as not found after the caller passes the finance authority boundary.

Finance authority does not imply CRM authority. `crm.view` is required only when selecting a payer from CRM; payment viewing remains governed by `finance.view`.

Finance payment authority cannot mutate CRM, contract or commercial records.

## 15. Interaction with invoice void

Package 004D already prevents invoice void while an unreversed payment allocation exists.

Package 004E activates the application path that creates and reverses those allocation facts:

```text
active allocation
    → invoice void blocked

allocation reversal
    → allocation no longer blocks void
```

A payment reversal automatically reverses its active allocations and therefore removes those allocations from the invoice-void blocker, subject to all other void rules such as credit-note history.

## 16. Validation contract

The permanent real-MySQL gate must prove:

- payment permissions migrate cleanly;
- existing-tenant and future-bootstrap standard-role parity;
- immutable payment receipt creation;
- optional same-tenant CRM payer selection;
- positive fixed-precision payment amounts;
- issued-credit-aware invoice outstanding;
- active-allocation-aware invoice outstanding;
- payment usable-balance derivation;
- allocation cannot exceed payment availability;
- allocation cannot exceed invoice outstanding;
- payment/invoice currency mismatch rejection;
- explicit granular deny overriding `finance.manage`;
- allocation reversal restoring both balances;
- duplicate allocation reversal rejection;
- payment reversal automatically reversing all active allocations first;
- reversed payment cannot be reallocated;
- duplicate payment reversal rejection;
- foreign-tenant payment/invoice masking;
- invoice workspace operational receivable position;
- zero generated Kysely drift;
- Svelte/TypeScript diagnostics.

## 17. Boundary handoff

Package 004E deliberately stopped after authoritative receipt/allocation/reversal facts and per-invoice outstanding receivable.

Package 004F now consumes those facts for **derived customer statements and aged receivables** without adding another balance ledger:

```text
Issued invoices
+ issued credits
+ allocations
+ allocation reversals
+ invoice void events
        ↓
Customer account movements
        ↓
Opening / closing balances
        ↓
Currency-separated aging
```

See [`docs/38-customer-statements-aged-receivables.md`](38-customer-statements-aged-receivables.md).

Still not claimed by either boundary:

- FX conversion or cross-currency allocation/reporting translation;
- refunds / outbound customer payments;
- automated bank-feed ingestion;
- automated remittance matching;
- bank reconciliation;
- general-ledger posting;
- credit-note void/reversal;
- persisted/issued statement documents or PDFs;
- production outbound statement delivery;
- dunning/reminder/collections workflows;
- configurable settlement/write-off policy;
- payment-gateway settlement processing.

The next finance boundary after 004F is controlled **collections and dunning policy** over the derived overdue position, with workflow/communication state kept separate from the immutable finance facts.
