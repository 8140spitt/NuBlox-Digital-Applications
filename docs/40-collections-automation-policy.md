# 40 — Operational Accounts Receivable: Collections Automation Policy

## 1. Purpose

Package 004H adds controlled policy and delivery evidence over the Package 004G collections workflow.

It deliberately does **not** add a second receivable ledger, an application scheduler, or an implicit background email worker.

```text
Package 004F Aged Receivables
        +
Package 004G Collection Case
        +
Versioned Active Collections Policy
        ↓
Due Reminder Candidate
        ↓
Explicit Reminder Generation
        ↓
Immutable Reminder Snapshot
        ↓
Explicit Dispatch / Retry
        ↓
Immutable Delivery Attempt Evidence
```

The governing rule is:

> **Automation may derive actions from authoritative receivable and collections facts, but it must never become an alternate source of receivable, settlement or aging truth.**

## 2. Application surface

```text
/finance/collections/automation
```

The workspace exposes:

- the current active policy version and ordered stages;
- a draft policy editor for authorised policy managers;
- policy-driven reminder candidates calculated from current overdue accounts;
- generated pending/sent reminder evidence;
- dispatch-attempt outcome and retry evidence;
- open promises that are due or overdue and require review.

The normal collections portfolio links into this workspace.

## 3. Permission boundary

Package 004H adds:

```text
finance.collections.policy.manage
finance.collections.reminder.generate
finance.collections.reminder.dispatch
```

All three use `finance.manage` only as a same-domain umbrella fallback.

The surrounding collections read boundary still requires:

```text
active NuBlox user
AND active organisation membership
AND finance.view
AND (finance.collections.view OR finance.manage fallback)
AND same-tenant finance/customer scope
```

### Default role delegation

Owner and Administrator receive all three 004H permissions.

Finance/Commercial receives:

```text
finance.collections.reminder.generate
finance.collections.reminder.dispatch
```

but deliberately does **not** receive:

```text
finance.collections.policy.manage
finance.manage
```

This separates routine AR operations from authority to redefine customer-facing escalation thresholds and templates.

Existing-role grants come from the forward migration. `OrganisationBootstrapService` persists equivalent grants for organisations created after release.

## 4. New normalised structures

The migration introduces:

```text
receivable_collection_policies
receivable_collection_policy_stages
receivable_collection_reminders
receivable_collection_reminder_deliveries
```

No table stores current overdue, outstanding, settled or aging balance.

### 4.1 Policy versions

`receivable_collection_policies` is organisation-scoped and versioned.

Lifecycle:

```text
draft → active → retired
```

A draft may be edited. An activated version is immutable through ordinary policy APIs.

Activating a new version retires the previous active version in the same transaction.

The organisation row is locked while the next version and active-version transition are resolved, preventing competing policy activations from independently claiming current authority.

### 4.2 Policy stages

Each stage belongs to exactly one policy version and records:

- explicit sequence number;
- stage name;
- positive days-overdue trigger;
- delivery channel;
- subject template;
- body template;
- whether an open receivable dispute suppresses the stage;
- whether a current open promise to pay suppresses the stage.

The initial delivery channel is deliberately restricted to:

```text
email
```

Policy activation requires:

- at least one stage;
- contiguous sequence numbers starting at 1;
- strictly increasing days-overdue triggers.

## 5. Supported reminder templates

The first template vocabulary is intentionally small and deterministic:

```text
{{customer_name}}
{{account_reference}}
{{days_overdue}}
{{invoice_count}}
{{as_of_date}}
```

Unknown placeholders are rejected when a draft stage is saved.

Templates are resolved when the reminder is generated. Later CRM or policy changes therefore do not rewrite an already-generated customer communication snapshot.

## 6. Due reminder candidates

A candidate is a derived operational view, not a persisted scheduled job.

A stage may become a candidate only when:

```text
active collection case
AND case status = open
AND active policy exists
AND live positive outstanding invoice is overdue
AND maximum invoice age >= stage trigger
AND that case/stage has not already generated a reminder
```

The workspace computes candidates from current Package 004F / 004G facts when requested.

Package 004H does not claim a cron worker, scheduler, queue consumer or background execution service exists.

## 7. Suppression policy

A policy stage may suppress reminder generation/dispatch when:

### Open dispute

```text
receivable_disputes.status = open
```

for the active collection case.

### Current promise to pay

The initial definition of a current promise is:

```text
promise.status = open
AND promise.due_on >= current collections as-of date
```

An open promise whose due date has already passed no longer suppresses the reminder. Instead it enters the **promise review queue**.

This distinction avoids silently extending customer credit merely because an old promise record remains unresolved.

## 8. Recipient resolution

Reminder generation traverses CRM identity and therefore requires `crm.view` in addition to finance/collections authority.

The initial recipient policy is:

1. active customer party primary email, when present;
2. otherwise, for an organisation customer, the active primary organisation contact's primary email;
3. otherwise generation is blocked.

No email address is invented and no platform identity is inferred from CRM identity.

The generated reminder snapshots:

- recipient party where resolved;
- recipient email;
- rendered subject;
- rendered body;
- policy/stage provenance;
- customer and collection-case provenance;
- receivable as-of date;
- generating member/time.

## 9. Generation is not dispatch

`finance.collections.reminder.generate` creates the immutable reminder snapshot only.

It does **not**:

- call an email provider;
- record a collection reminder action as if contact occurred;
- mark the reminder sent;
- change invoice outstanding;
- change a promise/dispute;
- create cash or an allocation.

The pair:

```text
collection_case_id + policy_stage_id
```

is unique for a reminder. Retrying generation for the same case/stage therefore returns the existing snapshot instead of creating duplicate reminder evidence.

## 10. Controlled dispatch

`finance.collections.reminder.dispatch` is the external-side-effect boundary.

Before each dispatch attempt, the service revalidates:

```text
active membership
AND dispatch permission
AND same-tenant reminder
AND reminder still pending
AND collection case still open
AND customer still has overdue receivable
AND policy stage is still due by age
AND no configured current-promise suppression
AND no configured open-dispute suppression
```

Customer + issued invoice rows are serialised before the live receivable revalidation. This aligns reminder dispatch with the same settlement-race protection introduced for collection-case opening.

A generated reminder therefore cannot be sent merely because it was valid when created; it must still be valid immediately before the external side effect.

## 11. Delivery evidence and retries

Each dispatch attempt creates one immutable row in:

```text
receivable_collection_reminder_deliveries
```

with:

- attempt number;
- member/time;
- `sent` or `failed` outcome;
- explicit error evidence when failed.

Failure leaves the reminder `pending` and retryable.

A successful attempt:

1. records successful delivery-attempt evidence;
2. moves the reminder to `sent` with `sent_at`;
3. adds ordinary Package 004G collection-action evidence with type `reminder` and channel `email`;
4. writes platform audit evidence.

The generated reminder body itself is not changed by retries.

## 12. Provider-neutral delivery boundary

Package 004H continues to use:

```text
src/lib/server/email/email-delivery.ts
```

`EMAIL_DELIVERY_MODE=console` remains development/integration behavior only.

Package 004H adds an optional stable business-message `idempotencyKey` to the delivery contract. Reminder dispatch supplies the immutable reminder public ID as that key.

A future production provider adapter should pass the key to a provider that supports idempotent send semantics.

This reduces duplicate-send risk around process/transaction failure, but Package 004H does **not** claim mathematically exact-once email delivery.

## 13. Promise-due monitoring

The automation workspace surfaces open promises on open/paused collection cases when:

```text
promise.due_on <= collections as-of date
```

It derives `daysPastDue` from the promise date and current collections date.

The queue is a review surface only. It does not automatically mark a promise `broken` or alter the customer balance.

Promise resolution remains the explicit Package 004G lifecycle:

```text
open → kept | broken | cancelled
```

## 14. Tenant isolation

All policy, stage, reminder and delivery-attempt queries are organisation-scoped.

Foreign reminder/case/public IDs are not authority and are masked after the caller passes the applicable read/permission boundary.

Recipient lookup is also tenant-scoped through CRM party/contact relationships.

## 15. Concurrency and idempotency

Package 004H uses several separate controls:

- organisation locking for policy-version allocation/activation;
- immutable active policy versions;
- unique case/stage reminder generation;
- reminder row locking for attempt sequencing;
- customer + issued-invoice locking before dispatch-time receivable revalidation;
- stable external delivery idempotency key;
- immutable delivery attempt rows.

These controls make retries auditable without claiming that a distributed email provider and the MySQL transaction are one atomic system.

## 16. Validation contract

The permanent real-MySQL suite must prove, at minimum:

- policy authoring is stronger authority than routine generation/dispatch;
- Owner/Administrator and Finance/Commercial bootstrap grants retain the documented split;
- activated policy versions reject ordinary editing;
- next draft policy increments the version;
- ordered trigger thresholds derive candidates from live overdue receivables;
- unsupported template placeholders are rejected;
- reminder generation is idempotent per case/stage;
- generation snapshots customer/recipient/template evidence;
- generation does not change receivable balance or create contact evidence;
- explicit granular dispatch deny overrides `finance.manage`;
- failed dispatch records immutable failure evidence and remains retryable;
- successful retry records success, marks the reminder sent and appends collection-action evidence;
- stable idempotency key is reused across attempts for the same reminder;
- current promises suppress configured stages;
- overdue open promises appear in promise review instead of suppressing indefinitely;
- paused/closed cases block dispatch;
- a settled/voided receivable after generation blocks later dispatch;
- foreign-tenant reminder identities are masked;
- generated Kysely types remain drift-free;
- Svelte/TypeScript diagnostics remain clean.

## 17. Deliberate exclusions / next boundary

Not claimed implemented by Package 004H:

- background scheduler/worker execution;
- automatic cron-driven reminder generation;
- automatic cron-driven email dispatch;
- production email provider adapter;
- SMS, postal or portal reminder delivery;
- customer self-service payment links;
- automatic promise-breaking decisions;
- customer credit limits;
- customer credit holds;
- quotation/order/contract/invoice enforcement of a credit hold;
- late-fee or interest calculation;
- legal escalation;
- debt-collection agency handoff;
- bad-debt/write-off;
- general-ledger posting.

The next finance boundary should be **Controlled Credit Limits and Credit Holds**, implemented as a cross-workflow policy rather than a decorative CRM/billing flag. Any hold must define who may place/release it, the evidence/reason required, and exactly which commercial/contract/finance transitions it blocks.
