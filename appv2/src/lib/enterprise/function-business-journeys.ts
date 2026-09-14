import type { EnterpriseFunctionId } from '$lib/enterprise/enterprise-functions';

export type FunctionJourneyStep = {
	label: string;
	detail: string;
};

export const functionBusinessJourneys: Record<
	EnterpriseFunctionId,
	readonly FunctionJourneyStep[]
> = {
	F01: [
		{ label: 'Develop', detail: 'Build direction, evidence, choices and the enterprise plan.' },
		{ label: 'Submit', detail: 'Submit the strategy or plan for governed review.' },
		{ label: 'Review', detail: 'Review evidence, assumptions, objectives and readiness.' },
		{ label: 'Decide', detail: 'Approve, return for amendment or reject.' },
		{ label: 'Publish', detail: 'Publish the approved major version as controlled evidence.' },
		{ label: 'Monitor', detail: 'Track performance, review outcomes and refresh direction.' }
	],
	F02: [
		{
			label: 'Establish',
			detail: 'Define governance bodies, authority, policy and accountabilities.'
		},
		{
			label: 'Prepare',
			detail: 'Prepare meetings, decisions, declarations and governance evidence.'
		},
		{ label: 'Decide', detail: 'Exercise delegated authority and record accountable decisions.' },
		{ label: 'Assign', detail: 'Issue actions, attestations and policy obligations.' },
		{ label: 'Assure', detail: 'Monitor governance effectiveness, conduct and compliance.' }
	],
	F03: [
		{
			label: 'Set measures',
			detail: 'Define performance frameworks, periods, measures and targets.'
		},
		{ label: 'Collect', detail: 'Assemble trusted actuals and reporting evidence.' },
		{ label: 'Explain', detail: 'Analyse variance, root cause and benefit performance.' },
		{ label: 'Decide', detail: 'Agree corrective actions and accountable interventions.' },
		{ label: 'Review', detail: 'Track outcomes and improve the management cycle.' }
	],
	F04: [
		{
			label: 'Identify',
			detail: 'Capture acquisition, divestiture and partnership opportunities.'
		},
		{ label: 'Evaluate', detail: 'Develop valuation, strategic fit and investment cases.' },
		{
			label: 'Diligence',
			detail: 'Coordinate due diligence, findings and transaction conditions.'
		},
		{ label: 'Execute', detail: 'Govern approvals, transaction milestones and completion.' },
		{ label: 'Integrate', detail: 'Deliver integration, separation and value-realisation plans.' }
	],
	F05: [
		{ label: 'Discover', detail: 'Capture needs, ideas, opportunities and innovation hypotheses.' },
		{ label: 'Design', detail: 'Shape the product or service proposition and controlled design.' },
		{ label: 'Develop', detail: 'Build, test and govern releases or service changes.' },
		{ label: 'Launch', detail: 'Approve readiness and coordinate market or operational launch.' },
		{ label: 'Evolve', detail: 'Review performance, improve the offering and govern retirement.' }
	],
	F06: [
		{ label: 'Understand', detail: 'Build market insight, segmentation and brand context.' },
		{ label: 'Plan', detail: 'Define marketing objectives, audiences, channels and campaigns.' },
		{ label: 'Create', detail: 'Develop controlled content, events and brand assets.' },
		{ label: 'Engage', detail: 'Execute campaigns and capture responses and leads.' },
		{ label: 'Optimise', detail: 'Measure effectiveness and improve demand generation.' }
	],
	F07: [
		{ label: 'Develop', detail: 'Develop accounts, opportunities and commercial strategy.' },
		{ label: 'Estimate', detail: 'Build cost, price, risk and margin positions.' },
		{ label: 'Offer', detail: 'Prepare bids, quotations and proposals.' },
		{ label: 'Commit', detail: 'Negotiate and approve contracts and sales commitments.' },
		{ label: 'Forecast', detail: 'Track pipeline, orders, revenue and commercial outcomes.' }
	],
	F08: [
		{ label: 'Onboard', detail: 'Establish the customer, entitlement and success context.' },
		{ label: 'Receive', detail: 'Capture enquiries, cases, complaints and support needs.' },
		{ label: 'Resolve', detail: 'Triage, fulfil, communicate and resolve service work.' },
		{ label: 'Recover', detail: 'Control returns, credits, warranty and service recovery.' },
		{ label: 'Retain', detail: 'Measure experience, manage success and protect renewal.' }
	],
	F09: [
		{ label: 'Plan', detail: 'Set procurement strategy, categories and sourcing priorities.' },
		{ label: 'Source', detail: 'Run sourcing events, RFx and supplier evaluation.' },
		{ label: 'Approve', detail: 'Approve suppliers, requisitions and commercial commitments.' },
		{ label: 'Order', detail: 'Issue and control purchase orders and amendments.' },
		{ label: 'Manage', detail: 'Monitor supplier performance, risk and relationships.' }
	],
	F10: [
		{
			label: 'Plan demand',
			detail: 'Translate demand into supply, inventory and capacity requirements.'
		},
		{
			label: 'Position stock',
			detail: 'Control material masters, stock policy and warehouse positions.'
		},
		{ label: 'Move', detail: 'Execute goods movements, transport and shipment activity.' },
		{ label: 'Deliver', detail: 'Coordinate distribution, trade compliance and receipt.' },
		{ label: 'Balance', detail: 'Review constraints, exceptions and supply-chain risk.' }
	],
	F11: [
		{ label: 'Engineer', detail: 'Define BOMs, routings, work centres and production controls.' },
		{ label: 'Plan', detail: 'Plan capacity, material, labour and production schedules.' },
		{ label: 'Release', detail: 'Authorise production orders and material staging.' },
		{ label: 'Produce', detail: 'Execute work, record WIP, checks, batches and output.' },
		{ label: 'Improve', detail: 'Review production performance and drive lean improvement.' }
	],
	F12: [
		{ label: 'Request', detail: 'Capture service demand, entitlement and required outcome.' },
		{ label: 'Plan', detail: 'Plan work, skills, capacity and service commitments.' },
		{ label: 'Dispatch', detail: 'Schedule resources, appointments and field activity.' },
		{ label: 'Deliver', detail: 'Execute and evidence service or professional work.' },
		{ label: 'Accept', detail: 'Confirm acceptance, quality and service performance.' }
	],
	F13: [
		{
			label: 'Plan quality',
			detail: 'Define quality plans, ITPs, standards and acceptance criteria.'
		},
		{ label: 'Inspect', detail: 'Perform inspections, tests and attributable checks.' },
		{ label: 'Control', detail: 'Record non-conformance and contain quality failures.' },
		{ label: 'Correct', detail: 'Investigate root cause and execute CAPA.' },
		{ label: 'Assure', detail: 'Verify effectiveness and improve quality performance.' }
	],
	F14: [
		{ label: 'Plan', detail: 'Set budgets, forecasts, funding and financial control context.' },
		{ label: 'Record', detail: 'Capture journals, invoices, expenses and accounting events.' },
		{ label: 'Settle', detail: 'Control collections, payments, treasury and bank activity.' },
		{ label: 'Close', detail: 'Reconcile, consolidate and govern period close.' },
		{ label: 'Report', detail: 'Produce traceable financial, tax and management reporting.' }
	],
	F15: [
		{
			label: 'Plan workforce',
			detail: 'Shape organisation, positions, jobs and workforce demand.'
		},
		{ label: 'Acquire', detail: 'Recruit, assess, offer and onboard people.' },
		{ label: 'Deploy', detail: 'Manage employment, time, attendance, reward and assignments.' },
		{ label: 'Develop', detail: 'Manage performance, learning, talent and succession.' },
		{ label: 'Transition', detail: 'Manage employee relations, absence, change and offboarding.' }
	],
	F16: [
		{
			label: 'Architect',
			detail: 'Set technology strategy, standards and architecture decisions.'
		},
		{ label: 'Build', detail: 'Develop, deploy and change applications and infrastructure.' },
		{ label: 'Operate', detail: 'Run services, platforms, networks, endpoints and configuration.' },
		{ label: 'Support', detail: 'Resolve requests, incidents and problems.' },
		{ label: 'Assure', detail: 'Manage capacity, availability, recovery, assets and suppliers.' }
	],
	F17: [
		{ label: 'Govern', detail: 'Define data domains, policy, ownership and quality expectations.' },
		{ label: 'Acquire', detail: 'Ingest, master and transform trusted data.' },
		{ label: 'Serve', detail: 'Publish datasets, products, reports and analytical models.' },
		{ label: 'Model', detail: 'Develop, assess and deploy analytical and AI models.' },
		{ label: 'Assure', detail: 'Monitor quality, access, retention, model risk and value.' }
	],
	F18: [
		{ label: 'Protect', detail: 'Set security policy, architecture and access controls.' },
		{ label: 'Detect', detail: 'Monitor vulnerabilities, threats, alerts and control health.' },
		{ label: 'Respond', detail: 'Triage and contain security incidents and exceptions.' },
		{
			label: 'Recover',
			detail: 'Remediate vulnerabilities, restore service and evidence recovery.'
		},
		{ label: 'Assure', detail: 'Test controls, suppliers, awareness and compliance.' }
	],
	F19: [
		{ label: 'Advise', detail: 'Receive legal matters, advice requests and obligations.' },
		{ label: 'Draft', detail: 'Prepare agreements, filings, notices and legal positions.' },
		{ label: 'Approve', detail: 'Review authority, risk and legal acceptability.' },
		{ label: 'Manage', detail: 'Manage entities, disputes, IP, holds and legal obligations.' },
		{ label: 'Evidence', detail: 'Preserve corporate, statutory and legal records.' }
	],
	F20: [
		{ label: 'Identify', detail: 'Identify risks, obligations, controls and assurance needs.' },
		{ label: 'Assess', detail: 'Assess exposure, control design and compliance status.' },
		{ label: 'Treat', detail: 'Agree treatment, remediation and accountable actions.' },
		{ label: 'Test', detail: 'Execute control testing, audit and assurance work.' },
		{ label: 'Monitor', detail: 'Track residual risk, findings and remediation closure.' }
	],
	F21: [
		{
			label: 'Discover',
			detail: 'Identify processing, personal data and information obligations.'
		},
		{ label: 'Assess', detail: 'Perform privacy assessments, DPIAs and transfer reviews.' },
		{ label: 'Control', detail: 'Manage consent, preference, retention and access.' },
		{ label: 'Respond', detail: 'Fulfil data-subject rights and privacy incident actions.' },
		{ label: 'Assure', detail: 'Review privacy compliance and information governance.' }
	],
	F22: [
		{ label: 'Plan', detail: 'Plan property, facilities, asset investment and space.' },
		{ label: 'Acquire', detail: 'Acquire or create properties, leases and physical assets.' },
		{ label: 'Operate', detail: 'Operate facilities, spaces, utilities and asset services.' },
		{ label: 'Maintain', detail: 'Plan and execute maintenance and condition work.' },
		{ label: 'Dispose', detail: 'Retire, dispose and close property and asset obligations.' }
	],
	F23: [
		{ label: 'Plan', detail: 'Set HSE and sustainability plans, targets and obligations.' },
		{ label: 'Assess', detail: 'Assess hazards, aspects, impacts and permit requirements.' },
		{ label: 'Control', detail: 'Operate permits, inspections and preventive controls.' },
		{ label: 'Respond', detail: 'Manage incidents, occupational health and environmental events.' },
		{ label: 'Improve', detail: 'Measure carbon, energy, waste and sustainability performance.' }
	],
	F24: [
		{ label: 'Prepare', detail: 'Assess criticality, threats and continuity requirements.' },
		{ label: 'Plan', detail: 'Maintain continuity, emergency, recovery and security plans.' },
		{ label: 'Exercise', detail: 'Test plans, readiness and decision arrangements.' },
		{ label: 'Respond', detail: 'Coordinate crisis, emergency and physical-security response.' },
		{ label: 'Recover', detail: 'Restore operations, close actions and capture lessons.' }
	],
	F25: [
		{ label: 'Plan', detail: 'Set communication, stakeholder and reputation priorities.' },
		{ label: 'Prepare', detail: 'Develop messages, releases, reports and engagement material.' },
		{ label: 'Engage', detail: 'Manage media, public affairs, investors and communities.' },
		{ label: 'Respond', detail: 'Coordinate reputation issues and crisis communications.' },
		{ label: 'Measure', detail: 'Review reach, sentiment, stakeholder outcomes and trust.' }
	],
	F26: [
		{ label: 'Create', detail: 'Create knowledge, controlled documents and information records.' },
		{ label: 'Review', detail: 'Review, approve, classify and issue trusted information.' },
		{ label: 'Distribute', detail: 'Transmit, publish and make information discoverable.' },
		{ label: 'Retain', detail: 'Apply record, retention and legal preservation controls.' },
		{ label: 'Dispose', detail: 'Authorise disposition and preserve organisational learning.' }
	],
	F27: [
		{ label: 'Select', detail: 'Evaluate demand, investment proposals and portfolio priorities.' },
		{ label: 'Initiate', detail: 'Authorise programmes and projects with accountable mandates.' },
		{ label: 'Plan', detail: 'Baseline scope, schedule, resources, cost, risk and controls.' },
		{ label: 'Deliver', detail: 'Execute, report, manage change and control outcomes.' },
		{ label: 'Handover', detail: 'Accept deliverables, realise benefits and close delivery.' }
	],
	F28: [
		{ label: 'Frame', detail: 'Define transformation outcomes, initiatives and target state.' },
		{ label: 'Assess', detail: 'Assess impacts, stakeholders, readiness and adoption risk.' },
		{ label: 'Prepare', detail: 'Plan communications, learning and organisational transition.' },
		{ label: 'Adopt', detail: 'Execute interventions and support changed ways of working.' },
		{ label: 'Realise', detail: 'Measure adoption, benefits and sustained transformation.' }
	],
	F29: [
		{ label: 'Discover', detail: 'Map processes, ownership, measures and compliance context.' },
		{
			label: 'Analyse',
			detail: 'Assess performance, waste, controls and improvement opportunity.'
		},
		{ label: 'Redesign', detail: 'Design target processes, SOPs and automation.' },
		{ label: 'Implement', detail: 'Deploy controlled process and workflow changes.' },
		{ label: 'Improve', detail: 'Monitor performance, compliance and continuous improvement.' }
	]
};
