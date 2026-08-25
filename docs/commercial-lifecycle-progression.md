# Commercial lifecycle progression

NuBlox treats winning work as one continuous commercial journey rather than a sequence of unrelated record-creation screens.

## Canonical progression

```text
CRM party
  ↓
Opportunity
  ↓
Estimate
  ↓
Quotation
  ↓
Accepted quotation
  ↓
Contract
  ↓
Executed contract
  ↓
Project
```

The **CRM opportunity is the journey root**. NuBlox does not introduce a second pursuit/master record because the existing model already carries the required lineage through `opportunity_id`, estimate/quotation links, quotation response provenance and contract/project relationships.

## Identity flows forward once

The primary CRM party is selected and maintained on the opportunity. Normal downstream progression must not ask the user to select the customer again.

When an estimate is developed from an opportunity, NuBlox inherits the opportunity's:

- primary customer identity;
- title;
- currency;
- initial scope/description;
- opportunity provenance.

Quotation creation inherits the estimate/opportunity relationship and creates an issued commercial snapshot. Contract formation inherits the **accepted quotation snapshot**, not mutable live CRM presentation data.

## Historical snapshots remain authoritative

Shared identity and stage history are different concerns.

The CRM party remains the canonical customer identity, while issued quotation versions and contract versions own immutable commercial snapshots. A later CRM rename or contact change must not rewrite what was quoted or contracted.

This allows NuBlox to preserve commercial movement such as:

```text
Opportunity expected value
→ Estimate selling price
→ Accepted quotation value
→ Executed contract value
→ Project forecast
```

## Stage promotion rules

### Opportunity → Estimate

`Develop estimate` creates the first estimate from opportunity context. If a live estimate already exists for the opportunity, the progression is idempotent and opens/returns that estimate rather than creating a duplicate.

### Estimate → Quotation

Quotation preparation remains estimate-led. Estimate versions remain the internal cost/price model; quotation versions are the customer-facing commercial offer.

### Quotation → Contract

An accepted, issued and locked quotation progresses to contract formation.

Contract formation:

- does not require an existing project;
- does not require `project.create` authority;
- records `source_quotation_response_id`;
- retains the opportunity relationship;
- snapshots the accepted customer and address evidence;
- initializes the contract base-scope value from the accepted quotation's included lines.

### Contract → Project

Project creation is a mobilisation event, not a quotation-acceptance side effect.

A project can be mobilised only when:

- the contract originated from accepted quotation evidence;
- the contract lifecycle is active;
- the latest contract version is executed;
- the actor holds `project.create` authority.

Mobilisation creates one active project and links the contract, accepted quotation and source estimates to that project. It also records `quotation_project_conversions` evidence and audit events. Repeating the operation returns the existing project.

## Legacy compatibility

Historical NuBlox records may already follow the previous sequence:

```text
Accepted quotation → proposed project → contract
```

Those records remain operable. Contract formation recognises an existing quotation-linked project as legacy provenance, and the contract portfolio identifies project-first items as a compatibility path.

The normal application workflow no longer creates new project-first records. The old quotation conversion route redirects to contract formation.

## UX principle

NuBlox should use progression language rather than generic creation language:

- Develop estimate
- Prepare / issue quotation
- Form contract
- Record execution
- Mobilise project

Each stage asks only for information that becomes authoritative at that stage. Upstream context is inherited and displayed, not repeatedly rebuilt.
