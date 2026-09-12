export type EnterpriseFunctionId =
	| 'F01'
	| 'F02'
	| 'F03'
	| 'F04'
	| 'F05'
	| 'F06'
	| 'F07'
	| 'F08'
	| 'F09'
	| 'F10'
	| 'F11'
	| 'F12'
	| 'F13'
	| 'F14'
	| 'F15'
	| 'F16'
	| 'F17'
	| 'F18'
	| 'F19'
	| 'F20'
	| 'F21'
	| 'F22'
	| 'F23'
	| 'F24'
	| 'F25'
	| 'F26'
	| 'F27'
	| 'F28'
	| 'F29';

export type EnterpriseFunctionDefinition = {
	id: EnterpriseFunctionId;
	name: string;
	shortName: string;
	purpose: string;
};

export const enterpriseFunctions: readonly EnterpriseFunctionDefinition[] = [
	{
		id: 'F01',
		name: 'Strategy & Enterprise Planning',
		shortName: 'Strategy & planning',
		purpose: 'Set direction, translate strategy into funded plans and govern strategic outcomes.'
	},
	{
		id: 'F02',
		name: 'Corporate Governance',
		shortName: 'Corporate governance',
		purpose: 'Govern authority, policy, decisions, ethics and accountable enterprise actions.'
	},
	{
		id: 'F03',
		name: 'Enterprise Performance Management',
		shortName: 'Enterprise performance',
		purpose: 'Measure performance, explain variance and drive corrective decisions.'
	},
	{
		id: 'F04',
		name: 'Corporate Development & M&A',
		shortName: 'Corporate development',
		purpose:
			'Identify, evaluate, execute and integrate acquisitions, divestitures and partnerships.'
	},
	{
		id: 'F05',
		name: 'Product, Service & Innovation Management',
		shortName: 'Product & innovation',
		purpose:
			'Create, launch, improve and retire products and services through a controlled lifecycle.'
	},
	{
		id: 'F06',
		name: 'Marketing & Brand',
		shortName: 'Marketing & brand',
		purpose: 'Understand markets, build demand and convert engagement into qualified opportunities.'
	},
	{
		id: 'F07',
		name: 'Sales & Commercial Management',
		shortName: 'Sales & commercial',
		purpose: 'Develop accounts, win profitable work and convert commitments into governed revenue.'
	},
	{
		id: 'F08',
		name: 'Customer Service, Experience & Success',
		shortName: 'Customer service',
		purpose: 'Onboard, support, retain and recover customer value through controlled service.'
	},
	{
		id: 'F09',
		name: 'Procurement & Supplier Management',
		shortName: 'Procurement & suppliers',
		purpose: 'Source and manage suppliers and preserve procurement-to-payment traceability.'
	},
	{
		id: 'F10',
		name: 'Demand, Supply Chain & Logistics',
		shortName: 'Supply chain & logistics',
		purpose: 'Plan and move materials from demand through stock, logistics and delivery.'
	},
	{
		id: 'F11',
		name: 'Manufacturing / Production Operations',
		shortName: 'Production operations',
		purpose:
			'Plan, execute and control production with material, labour, quality and cost traceability.'
	},
	{
		id: 'F12',
		name: 'Service Delivery & Field Operations',
		shortName: 'Service & field operations',
		purpose: 'Plan, dispatch, execute and evidence professional and field services.'
	},
	{
		id: 'F13',
		name: 'Quality Management',
		shortName: 'Quality management',
		purpose: 'Plan, assure, control and continuously improve quality with attributable evidence.'
	},
	{
		id: 'F14',
		name: 'Finance, Accounting, Treasury & Tax',
		shortName: 'Finance',
		purpose: 'Control accounting and cash consequences and produce traceable financial reporting.'
	},
	{
		id: 'F15',
		name: 'Human Resources / Human Capital',
		shortName: 'People & workforce',
		purpose: 'Plan, acquire, develop, deploy, pay and retain a competent workforce.'
	},
	{
		id: 'F16',
		name: 'Information Technology',
		shortName: 'Information technology',
		purpose: 'Govern and operate technology services, platforms, assets and changes reliably.'
	},
	{
		id: 'F17',
		name: 'Data, Analytics & AI',
		shortName: 'Data, analytics & AI',
		purpose: 'Govern data and intelligence from source through trusted analytics and AI.'
	},
	{
		id: 'F18',
		name: 'Cybersecurity & Information Security',
		shortName: 'Cybersecurity',
		purpose: 'Prevent, detect, respond to and assure information-security risks.'
	},
	{
		id: 'F19',
		name: 'Legal & Corporate Secretariat',
		shortName: 'Legal & secretariat',
		purpose: 'Manage legal obligations, agreements, corporate records and disputes.'
	},
	{
		id: 'F20',
		name: 'Risk, Compliance, Internal Control & Audit',
		shortName: 'Risk, control & audit',
		purpose: 'Identify risk, operate and test controls, manage compliance and assurance.'
	},
	{
		id: 'F21',
		name: 'Privacy & Information Governance',
		shortName: 'Privacy & information governance',
		purpose: 'Govern personal information, privacy obligations, rights and retention.'
	},
	{
		id: 'F22',
		name: 'Property, Facilities & Physical Assets',
		shortName: 'Property & assets',
		purpose: 'Acquire, operate, maintain, optimise and dispose of property and physical assets.'
	},
	{
		id: 'F23',
		name: 'Health, Safety, Environment & Sustainability',
		shortName: 'HSE & sustainability',
		purpose: 'Protect people and environment and improve sustainability performance.'
	},
	{
		id: 'F24',
		name: 'Business Continuity, Crisis & Physical Security',
		shortName: 'Continuity & security',
		purpose: 'Prepare for disruption, coordinate crises and protect people and operations.'
	},
	{
		id: 'F25',
		name: 'Communications, Public Affairs & Investor Relations',
		shortName: 'Communications & affairs',
		purpose: 'Manage corporate narrative, stakeholders, reputation and investor communications.'
	},
	{
		id: 'F26',
		name: 'Knowledge, Document & Records Management',
		shortName: 'Knowledge & documents',
		purpose: 'Create, control, retain, find and reuse trusted organisational knowledge and records.'
	},
	{
		id: 'F27',
		name: 'Portfolio, Programme & Project Management',
		shortName: 'Projects & programmes',
		purpose: 'Select, plan, resource, execute, control and close projects predictably.'
	},
	{
		id: 'F28',
		name: 'Change & Transformation Management',
		shortName: 'Change & transformation',
		purpose: 'Move the organisation from current to target state and realise measurable benefits.'
	},
	{
		id: 'F29',
		name: 'Business Process & Continuous Improvement',
		shortName: 'Process & improvement',
		purpose: 'Design, govern, automate and continuously improve enterprise processes.'
	}
] as const;

export function findEnterpriseFunction(id: string): EnterpriseFunctionDefinition | null {
	return enterpriseFunctions.find((entry) => entry.id === id.toUpperCase()) ?? null;
}
