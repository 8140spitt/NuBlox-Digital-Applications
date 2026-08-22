# Layer 5 — End-to-End Business Processes

**Status:** Governing process-composition model

Layer 5 composes domain commands into complete business outcomes. Processes do not own duplicate master data; they coordinate the lower layers.

## Process specification

Every material process defines:

- trigger and intended outcome;
- participating actor/organisation roles;
- canonical records used/created;
- sequence of domain commands/state transitions;
- permission/SoD/delegation gates;
- project/tenant scope;
- work items/approvals;
- events and evidence;
- financial/commercial consequences;
- exceptions, rejection, cancellation and correction paths;
- integration boundaries;
- reporting/KPIs;
- completion condition.

## Core enterprise process chains

NuBlox must support, natively and traceably:

- market-to-opportunity;
- opportunity-to-bid;
- estimate-to-quote;
- quote/award-to-contract-and-project;
- source-to-contract;
- requisition-to-order;
- procure-to-pay;
- order/contract-to-cash;
- valuation/application-to-certificate-to-cash;
- change-to-commercial-position;
- plan-to-perform;
- project-to-profit;
- hire-to-retire;
- time-to-payroll-and-project-cost;
- demand-to-material/production supply;
- design-information-to-approved/issued information;
- RFI/submittal/technical-query-to-resolution;
- issue/NCR/defect-to-verified closure;
- incident-to-investigation-and-action;
- commissioning-to-handover;
- asset-information-to-operation;
- service-request-to-resolution;
- maintenance-plan-to-work-order-to-history;
- asset-to-retirement;
- record-to-report;
- period-to-close;
- data-to-decision.

## Construction process integrity

Construction processes often cross project, contract, procurement, site, finance and information domains. NuBlox must link consequences without flattening those domains.

Example: an approved commercial change may legitimately influence contract value, budget/forecast, procurement commitments, programme impact, valuation, revenue position and margin. Those consequences are linked through controlled domain records and services, not by editing one omnibus “project” row.

## Process variants

Contract form, asset class, organisation size and jurisdiction may change gates and terminology. Variants are configuration/overlay rules over the same lower-layer canonical model unless the underlying business semantics genuinely differ.

## No happy-path-only design

A process is incomplete until it defines rejection, withdrawal, expiration, partial fulfilment, dispute, correction, reversal/reopen and concurrent-action behaviour where applicable.