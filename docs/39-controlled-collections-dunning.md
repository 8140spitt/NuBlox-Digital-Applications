# 39 — Controlled Collections and Dunning

## 1. Purpose

Package 004G adds the first operational collections boundary over the customer statements and aged receivables delivered by Package 004F.

The governing rule is:

> **Collections reacts to the receivable ledger; it never becomes the receivable ledger.**

The accounting position remains derived from issued invoices, issued credit notes, payment allocations, allocation reversals and exceptional invoice voids. A reminder, promise to pay or dispute cannot settle, reduce or increase an invoice balance by itself.

```text
Issued invoice / credit / cash facts
              ↓
       004F aged receivable
              ↓
       overdue customer account
              ↓
       controlled collection case
          ├── action evidence
          ├── promise to pay
          └── receivable dispute
```

## 2. Application surfaces

Protected routes:

```text
/finance/collections
/finance/collections/[customerPartyPublicId]
```

The portfolio exposes customer accounts with at least one currently overdue invoice and shows whether an active collection case already exists.

The customer workspace combines the live Package 004F overdue position with case lifecycle, immutable collection-action evidence, promises to pay and disputes.

## 3. Permission family

Package 004G adds:

```text
finance.collections.view
finance.collections.case.manage
finance.collections.action.record
finance.collections.promise.manage
finance.collections.dispute.manage
```

Collections mutation keys use the existing same-domain umbrella:

```text
finance.manage
```

Collections reads require both:

```text
finance.view
AND
(finance.collections.view OR finance.manage)
```

This deliberately prevents a generic finance reader from automatically receiving operational collection-case evidence.

Permission precedence remains:

```text
explicit granular member deny
    > granular member allow / role grant
    > finance.manage fallback
    > default deny
```

`commercial.manage` and `contract.manage` do not grant collections authority.

### Standard-role defaults

Owner, Administrator and Finance/Commercial receive all five collections permissions explicitly for both existing organisations and future organisation bootstrap.

Owner and Administrator also retain `finance.manage`. Finance/Commercial does not receive that umbrella, so its collections authority remains explicitly delegated and independently revocable.

## 4. Normalised data model

Package 004G adds four business tables:

```text
receivable_collection_cases
    ├── receivable_collection_actions
    ├── receivable_promises_to_pay
    └── receivable_disputes
```

No current overdue balance, outstanding balance or aging bucket is stored in these tables.

### `receivable_collection_cases`

A case identifies one customer-account collection episode and stores:

- tenant and public identity;
- customer CRM party;
- `open / paused / closed` lifecycle;
- optional assigned organisation member;
- opening actor/time;
- controlled closing actor/time/reason.

An active case is `open` or `paused`.

### `receivable_collection_actions`

Actions are immutable operational evidence. Supported action types include:

```text
case_opened
case_paused
case_resumed
case_closed
reminder
phone_call
note
promise_recorded
promise_kept
promise_broken
promise_cancelled
dispute_opened
dispute_resolved
dispute_withdrawn
```

Evidence may include delivery channel, subject/body/outcome and links to invoice, promise or dispute facts.

### `receivable_promises_to_pay`

A promise records:

- collection case;
- optional same-customer invoice;
- positive fixed-precision amount;
- exact currency;
- promised due date;
- `open / kept / broken / cancelled` status;
- recording and resolution evidence.

A promise is a customer commitment only. It does not create cash, an allocation or a settlement.

### `receivable_disputes`

A dispute records:

- collection case;
- optional same-customer invoice;
- optional positive amount + currency pair;
- required dispute reason;
- `open / resolved / withdrawn` status;
- opening and resolution evidence.

A dispute does not automatically suspend, reduce or reverse the invoice. Any accounting correction still requires the appropriate credit-note/void/payment workflow.

## 5. Starting a collection case

Case creation requires:

```text
active tenant membership
AND finance.view
AND finance.collections.view OR finance.manage
AND finance.collections.case.manage OR finance.manage
AND same-tenant customer account
AND at least one currently overdue invoice with positive outstanding value
```

The service derives overdue status through Package 004F at the time of creation.

The customer party row is locked before checking for an existing active case. This gives one serialisation point for concurrent case starts.

If an `open` or `paused` case already exists, start is idempotent and returns that case rather than creating another active episode.

## 6. Case lifecycle

```text
open
  ↔ paused
  ↓
closed
```

A closed case is immutable.

Closing requires an explicit reason and is rejected while either of these remains unresolved:

```text
open promise to pay
open receivable dispute
```

A later collection episode may create a new case if the customer still has an overdue receivable.

## 7. Collection-action evidence

Normal user-recordable actions are:

```text
reminder
phone_call
note
```

Recording evidence requires:

```text
finance.collections.action.record OR finance.manage
AND active same-tenant collection case
AND supported delivery channel when supplied
AND non-empty message/note evidence
```

The application records the action; it does not claim that email, portal or letter delivery happened unless a later provider/delivery boundary actually performs and proves that delivery.

## 8. Promise-to-pay policy

Recording a promise requires:

```text
finance.collections.promise.manage OR finance.manage
AND active same-tenant collection case
AND amount > 0
AND valid currency
AND due date
```

If an invoice is linked:

```text
invoice organisation = active tenant
AND invoice customer = collection case customer
AND promise currency = invoice currency
```

Resolution is append-evidenced as:

```text
open → kept
open → broken
open → cancelled
```

The original amount, currency, due date and invoice link remain preserved.

## 9. Dispute policy

Opening a dispute requires:

```text
finance.collections.dispute.manage OR finance.manage
AND active same-tenant collection case
AND reason
```

An amount is optional. If supplied, it must be positive and accompanied by a currency.

If an invoice is linked it must belong to the same tenant and customer. A supplied dispute currency must match the invoice currency.

Resolution is:

```text
open → resolved
open → withdrawn
```

Resolution evidence is required. The invoice itself is not mutated by the dispute lifecycle.

## 10. Tenant isolation

Every case, action, promise and dispute query is scoped by active `organisation_id`.

Invoice links are validated through both tenant and customer ownership. A public invoice ID belonging to another customer is masked as unavailable rather than being accepted into the case.

Foreign customer IDs are masked as not found after the caller passes the collections read boundary.

## 11. Audit actions

Package 004G writes audit evidence for controlled mutations, including:

```text
finance.collections.case.opened
finance.collections.case.open
finance.collections.case.paused
finance.collections.case.closed
finance.collections.action.recorded
finance.collections.promise.recorded
finance.collections.promise.kept
finance.collections.promise.broken
finance.collections.promise.cancelled
finance.collections.dispute.opened
finance.collections.dispute.resolved
finance.collections.dispute.withdrawn
```

The immutable `receivable_collection_actions` timeline remains the business-facing operational chronology, while `audit_events` records the platform mutation trail.

## 12. Database and generated-type boundary

Package 004G is a genuine forward-schema increment because the Package 004 baseline contained no collection-case, promise, dispute or dunning evidence structures.

Migration:

```text
20260817124500_controlled_collections.sql
```

The expected migrated application shape is:

```text
17 production migrations
348 base tables
767 foreign keys
439 CHECK constraints
```

Kysely types remain generated from migrated MySQL. Generation is split into:

```text
database.d.ts    → core schema excluding receivable_*
collections.d.ts → receivable_* collections tables only
```

The runtime database schema is the intersection of those two generated DB interfaces.

## 13. Deliberate exclusions

Package 004G does not claim:

- scheduled or automatic reminder generation;
- automatic email/letter/portal delivery;
- escalating dunning-stage policy;
- automatic legal escalation;
- external debt-collection agency handoff;
- customer credit-limit or credit-hold policy;
- late-fee or interest calculation;
- bad-debt/write-off processing;
- settlement/write-off mutation through a collection case;
- FX/reporting-currency translation;
- general-ledger posting.

Those are later controlled boundaries. In particular, any future automation must continue to derive eligibility from the authoritative receivable position and must not manufacture a second editable account balance.

## 14. Validation contract

The permanent real-MySQL gate must prove:

- clean 17-migration build and expected structural counts;
- zero drift across both generated Kysely outputs;
- collections permission availability;
- existing-organisation and future-bootstrap standard-role parity;
- only overdue accounts enter the collections portfolio;
- case creation rejects non-overdue accounts;
- active-case start is idempotent;
- opening/action/promise/dispute evidence is retained;
- promises/disputes cannot link another customer's invoice;
- promise currency matches linked invoice currency;
- collections facts do not change receivable balance;
- case closure is blocked by unresolved promises/disputes;
- closed cases reject further mutation;
- explicit granular deny overrides `finance.manage`;
- collections read requires its explicit read boundary in addition to `finance.view`;
- foreign-tenant customer identity is masked;
- Svelte/TypeScript diagnostics remain clean.
