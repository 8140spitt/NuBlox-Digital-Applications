# 41 — Controlled Credit Limits and Credit Holds

## 1. Purpose

Package 004I adds customer credit-limit policy, explicit stop-trading holds and exceptional override evidence across NuBlox's commercial/contract commitment boundaries.

The governing rule is:

> **Credit control evaluates authoritative exposure; it never becomes a second receivable ledger.**

Current receivable remains derived from issued finance facts. A credit limit is a policy threshold, a credit hold is an explicit stop-new-trade decision, and an override is evidence that an authorised person deliberately allowed one named commitment to proceed.

```text
Issued invoice / credit / cash facts
              ↓
      Current receivable
              +
      Proposed commitment
              ↓
      Projected exposure
              ↓
 Currency-specific credit limit
              +
 Customer-wide credit hold
              ↓
      Commitment decision
```

## 2. Application surface

Protected route:

```text
/finance/credit-control
```

The workspace provides:

- customer credit-limit policy and current revision;
- live derived utilisation by currency;
- available headroom where a limit is enabled;
- active/released credit-hold history;
- immutable credit-control override evidence;
- explicit forms for limit revision/disable and hold placement/release.

Credit-control state is also surfaced at the two enforcement boundaries:

```text
/commercial/quotations/[quotationPublicId]/convert
/contracts/[contractPublicId]
```

Finance amounts are shown there only when the actor also has the finance + credit-control read boundary.

## 3. Permission family

Package 004I adds:

```text
finance.credit_control.view
finance.credit_control.policy.manage
finance.credit_control.hold.manage
finance.credit_control.override
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

An explicit member deny on `finance.credit_control.override` therefore cannot be bypassed by `finance.manage`.

`commercial.manage` and `contract.manage` do not grant credit-control authority.

### Read boundary

The dedicated workspace requires:

```text
active tenant membership
AND finance.view
AND (finance.credit_control.view OR finance.manage)
```

A commercial/project/contract actor may still be told that the commitment is blocked, but current receivable, limit and projected exposure are masked unless that actor also passes this finance read boundary.

### Standard-role defaults

Owner and Administrator receive all four granular credit-control permissions and retain `finance.manage`.

Finance/Commercial receives:

```text
finance.credit_control.view
finance.credit_control.policy.manage
finance.credit_control.hold.manage
```

Finance/Commercial deliberately does **not** receive:

```text
finance.credit_control.override
finance.manage
```

This allows ordinary finance staff to maintain policy and stop trading while reserving the bypass of an active control for stronger/custom authority.

Existing organisations receive the same split through the forward migration and future organisations receive equivalent persisted grants from `OrganisationBootstrapService`.

## 4. Normalised persistence model

Package 004I adds:

```text
receivable_credit_policies
receivable_credit_policy_revisions
receivable_credit_holds
receivable_credit_control_overrides
```

No table stores a mutable `used_credit`, `available_credit`, current receivable or customer balance.

### `receivable_credit_policies`

One policy identity exists per:

```text
tenant + customer + currency
```

The policy identifies the credit-control stream only. The actual limit is held in append-only revisions.

### `receivable_credit_policy_revisions`

Each change creates a new monotonically increasing version containing:

- enabled/disabled state;
- positive credit limit when enabled;
- mandatory reason;
- actor and timestamp.

Disabling a limit creates a new revision with `is_enabled = false` and no limit amount. Prior values are not overwritten.

### `receivable_credit_holds`

A hold is customer-wide rather than currency-specific because it represents a stop-new-trade decision.

The database permits one active hold per tenant/customer through the generated active-customer uniqueness key.

Lifecycle:

```text
active → released
```

Placement and release both require reasoned actor/time evidence. Repeating hold placement while one is already active is application-idempotent and returns the existing active hold.

### `receivable_credit_control_overrides`

An override is immutable evidence attached to one named workflow subject. It snapshots:

```text
customer
workflow type
workflow subject public ID
currency
current outstanding receivable
proposed commitment amount
projected exposure
applicable credit limit when breached
applicable active hold when present
reason
authorising member
authorised time
```

At least a breached policy or active hold must be linked to the override evidence.

## 5. Authoritative exposure model

### Current receivable

For one customer/currency:

```text
Current Receivable
= Σ positive outstanding issued invoices
```

Each issued invoice outstanding is:

```text
Issued Invoice Gross
− Issued Credit Note Gross
− Active Payment Allocations
```

Voided invoices do not contribute to current exposure. Unallocated cash does not reduce customer receivable until it is allocated to an invoice.

The shared `receivable-ledger.ts` derivation is used by both invoice-position and credit-control services so credit policy cannot drift onto a parallel balance implementation.

### Projected exposure

At a new commitment boundary:

```text
Projected Exposure
= Current Receivable
+ Proposed Commitment
```

The limit blocks when:

```text
Projected Exposure > Enabled Credit Limit
```

Exact equality is allowed:

```text
Projected Exposure = Credit Limit
→ not blocked by the limit itself
```

An active hold still blocks regardless of amount.

No enabled limit means there is no limit-threshold block, but an active hold remains effective.

## 6. Accepted quotation commitment amount

Accepted quotation → proposed-project conversion is one 004I commitment boundary.

The proposed commitment amount is derived from the exact accepted quotation version as:

```text
sum(non-optional quotation line net amounts)
+ stored quotation-item tax amounts
```

Optional lines are excluded because they are not part of the accepted base commitment at this boundary.

The credit-control gate therefore evaluates:

```text
Current customer receivable
+ accepted non-optional quotation gross
```

before a new proposed project is created.

## 7. Contract execution commitment amount

Contract execution is the second 004I commitment boundary.

The proposed commitment amount is the sum of value components on the issued contract version being executed:

```text
Contract Commitment
= Σ contract_version_value_components.amount
```

The gate therefore evaluates:

```text
Current customer receivable
+ issued contract-version value
```

before execution/signatory evidence is inserted and before the contract becomes active.

## 8. Named enforcement matrix

Package 004I deliberately enforces stop-new-trade policy at named service boundaries rather than adding a passive CRM flag.

```text
Quotation issue                 allowed — commercial offer/pre-commitment
Accepted quotation conversion   CREDIT GATE
Contract draft management       allowed — preparation
Contract issue                   allowed — pre-execution evidence
Contract execution               CREDIT GATE
Invoice issue                    allowed — bill existing work
Credit-note workflow             allowed — can reduce exposure
Payment/allocation               allowed — can reduce exposure
Collections workflow             allowed — manages existing exposure
```

A hold therefore cannot prevent the organisation from billing work already performed, applying a credit, receiving cash, allocating cash or collecting debt.

## 9. Commitment decision

A commitment is blocked when either condition is true:

```text
active customer credit hold
OR
projected exposure > enabled currency credit limit
```

Normal continuation requires the block to be cleared through policy/hold lifecycle.

Exceptional continuation requires:

```text
finance.credit_control.override OR finance.manage
AND explicit non-empty override reason
```

An actor who merely has the underlying commercial/project/contract permission cannot bypass the finance control.

## 10. Transactional override policy

Override evidence is inserted using the same database transaction as the business commitment.

For quotation conversion:

```text
credit revalidation + override evidence
        +
project creation + conversion ledger
        ↓
one transaction
```

For contract execution:

```text
credit revalidation + override evidence
        +
execution/signatory evidence + active lifecycle
        ↓
one transaction
```

If the surrounding business transaction fails or rolls back, the override evidence rolls back as well. NuBlox therefore cannot retain evidence saying a commitment was authorised when that commitment did not actually complete.

Accepted-quotation conversion retains its existing idempotency rule: if the accepted response already has authoritative `quotation_project_conversions` evidence, a retry returns that project before a fresh credit gate and does not create duplicate override evidence.

## 11. Concurrency and serialization

A commitment decision must not race a customer invoice changing from draft to issued.

At enforcement time the service serializes on:

```text
customer party
+
all invoice financial_documents for that customer/currency
```

The balance calculation still includes **issued invoices only**.

This means a concurrent invoice-issue transaction and a new commitment receive a deterministic database order. After obtaining the locks, credit control derives the current receivable again before making the decision.

Policy and active-hold rows are also locked when present.

## 12. Limit maintenance

Setting or revising a limit requires:

```text
finance.credit_control.policy.manage OR finance.manage
AND active same-tenant customer
AND valid 3-letter currency
AND positive limit
AND reason
```

A new revision is appended. The previous revision remains immutable evidence.

Disabling a limit requires the same authority and an explicit reason. A disabled policy identity remains in history so future re-enablement continues the revision stream instead of rewriting the past.

## 13. Hold lifecycle

Placement requires:

```text
finance.credit_control.hold.manage OR finance.manage
AND active same-tenant customer
AND reason
```

An already-active hold makes placement idempotent.

Release requires:

```text
finance.credit_control.hold.manage OR finance.manage
AND same-tenant active hold
AND release reason
```

Released holds remain historical evidence. A later risk event may create a new active hold.

## 14. Tenant isolation

Every policy, revision, hold and override query is tenant-scoped.

Foreign customer and hold public identities are masked as unavailable rather than disclosing another tenant's records.

Credit-control state on commercial/contract pages is calculated only against the active tenant's customer party and finance facts.

## 15. Audit actions

Controlled mutations append platform audit evidence including:

```text
finance.credit_control.limit.set
finance.credit_control.limit.disabled
finance.credit_control.hold.placed
finance.credit_control.hold.released
finance.credit_control.override.authorised
```

The normalised policy/hold/override tables remain the business evidence; `audit_events` records the platform mutation trail.

## 16. Database and generated-type boundary

Migration:

```text
20260817150000_credit_control_limits_holds.sql
```

Expected Package 004I migrated structure:

```text
19 production migrations
356 base tables
789 foreign keys
459 CHECK constraints
```

The four new tables live in the generated `receivable_*` Kysely output:

```text
app/src/lib/server/db/generated/collections.d.ts
```

Core schema generation remains separated in `database.d.ts`; both compose into the runtime `DatabaseSchema`.

## 17. Deliberate exclusions

Package 004I does not claim:

- a credit-scoring engine or external bureau integration;
- automatic risk-score-driven limit changes;
- FX aggregation of limits/exposure;
- one cross-currency group credit limit;
- guarantees, parent-company limits or insurance limits;
- reservation of headroom as a persistent editable balance;
- automatic hold placement from aging thresholds;
- automatic hold release after payment;
- legal/agency escalation;
- bad-debt/write-off processing;
- general-ledger posting.

The current commitment model evaluates the live receivable plus the **transaction being authorised**. It does not yet create a separate persisted open-order/contract exposure ledger.

## 18. Validation contract

The permanent real-MySQL gate must prove:

- clean 19-migration build and exact structural counts;
- zero generated Kysely drift;
- all four credit-control permission keys exist;
- existing-organisation migration grants and future-bootstrap grants use the intended role split;
- Finance/Commercial can manage limits/holds but cannot override by default;
- credit-limit changes create immutable versioned revisions;
- active hold placement is idempotent and controlled release retains history;
- current utilisation changes when authoritative receivable facts change and no used-credit balance is stored;
- exact-limit projected exposure is allowed;
- projected exposure above the limit is blocked even when current receivable itself is below the limit;
- accepted-quotation conversion is blocked by hold/projected-limit policy;
- quotation-conversion credit details are masked without finance read authority;
- an authorised reasoned quotation override commits exactly once with conversion evidence;
- contract issue remains possible under a hold;
- contract execution is blocked by hold/projected-limit policy;
- explicit granular override deny beats `finance.manage`;
- an authorised reasoned execution override commits with execution evidence;
- override evidence snapshots current receivable, proposed commitment, projected exposure and limit;
- override evidence rolls back when the surrounding business transaction rolls back;
- credit checks serialize against concurrent invoice issue and re-evaluate the issued receivable;
- foreign-tenant customer/hold identities are masked;
- existing Package 004 finance, collections, commercial and contract tests remain green;
- Svelte/TypeScript diagnostics remain clean.
