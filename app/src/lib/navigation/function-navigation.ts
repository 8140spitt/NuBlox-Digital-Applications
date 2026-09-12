import type { AppNavigationSection } from './app-navigation';

export type EnterpriseFunctionDefinition = {
	id: `F${string}`;
	name: string;
	shortName: string;
	purpose: string;
	href?: string;
};

export type ResolvedEnterpriseFunction = EnterpriseFunctionDefinition & {
	delivered: boolean;
	available: boolean;
};

const enterpriseFunctions: readonly EnterpriseFunctionDefinition[] = [
	{
		id: 'F01',
		name: 'Strategy & Enterprise Planning',
		shortName: 'Strategy & planning',
		purpose: 'Set direction, translate strategy into funded plans and govern strategic outcomes.',
		href: '/strategy'
	},
	{
		id: 'F02',
		name: 'Corporate Governance',
		shortName: 'Corporate governance',
		purpose: 'Govern authority, policy, decisions, ethics and accountable enterprise actions.',
		href: '/governance'
	},
	{
		id: 'F03',
		name: 'Enterprise Performance Management',
		shortName: 'Enterprise performance',
		purpose: 'Measure performance, explain variance and drive corrective decisions.',
		href: '/performance'
	},
	{
		id: 'F04',
		name: 'Corporate Development & M&A',
		shortName: 'Corporate development',
		purpose: 'Identify, evaluate, execute and integrate acquisitions, divestitures and partnerships.',
		href: '/corporate-development'
	},
	{
		id: 'F05',
		name: 'Product, Service & Innovation Management',
		shortName: 'Product & innovation',
		purpose: 'Create, launch, improve and retire products and services through a controlled lifecycle.'
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
		purpose: 'Develop accounts, win profitable work and convert commitments into governed revenue.',
		href: '/crm'
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
		purpose: 'Source and manage suppliers and preserve procurement-to-payment traceability.',
		href: '/purchasing'
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
		purpose: 'Plan, execute and control production with material, labour, quality and cost traceability.'
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
		purpose: 'Control accounting and cash consequences and produce traceable financial reporting.',
		href: '/finance'
	},
	{
		id: 'F15',
		name: 'Human Resources / Human Capital',
		shortName: 'People & workforce',
		purpose: 'Plan, acquire, develop, deploy, pay and retain a competent workforce.',
		href: '/people'
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
		purpose: 'Acquire, operate, maintain, optimise and dispose of property and physical assets.',
		href: '/assets'
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
		purpose: 'Create, control, retain, find and reuse trusted organisational knowledge and records.',
		href: '/documents'
	},
	{
		id: 'F27',
		name: 'Portfolio, Programme & Project Management',
		shortName: 'Projects & programmes',
		purpose: 'Select, plan, resource, execute, control and close projects predictably.',
		href: '/projects'
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
];

function normaliseHref(href: string): string {
	return href.split(/[?#]/, 1)[0] ?? href;
}

function routeIsAvailable(href: string, availableHrefs: ReadonlySet<string>): boolean {
	const target = normaliseHref(href);
	for (const availableHref of availableHrefs) {
		const candidate = normaliseHref(availableHref);
		if (
			candidate === target ||
			candidate.startsWith(`${target}/`) ||
			target.startsWith(`${candidate}/`)
		) {
			return true;
		}
	}
	return false;
}

export function getEnterpriseFunctions(): readonly EnterpriseFunctionDefinition[] {
	return enterpriseFunctions;
}

export function resolveEnterpriseFunctions(
	availableHrefs: readonly string[]
): ResolvedEnterpriseFunction[] {
	const available = new Set(availableHrefs.map(normaliseHref));
	return enterpriseFunctions.map((definition) => ({
		...definition,
		delivered: Boolean(definition.href),
		available: Boolean(definition.href && routeIsAvailable(definition.href, available))
	}));
}

export function resolveFunctionNavigation(
	availableHrefs: readonly string[]
): AppNavigationSection[] {
	const functions = resolveEnterpriseFunctions(availableHrefs).filter(
		(entry) => entry.available && entry.href
	);

	return [
		{
			id: 'work',
			label: 'Work',
			items: [
				{ id: 'dashboard', label: 'Home', href: '/dashboard' },
				{ id: 'my-work', label: 'My work', href: '/my-work' }
			]
		},
		{
			id: 'functions',
			label: 'Functions',
			items: functions.map((entry) => ({
				id: entry.id.toLowerCase(),
				label: `${entry.id} ${entry.shortName}`,
				href: entry.href!,
				description: entry.purpose
			}))
		},
		{
			id: 'tools',
			label: 'Tools',
			items: [
				{
					id: 'all-functions',
					label: 'All 29 functions',
					href: '/functions',
					description: 'Open the canonical enterprise-function directory.'
				},
				{
					id: 'enterprise-search',
					label: 'Search',
					href: '/search',
					description: 'Find authorised records across NuBlox.'
				},
				{
					id: 'contexts',
					label: 'Contexts',
					href: '/contexts',
					description: 'Return to recent and pinned business contexts.'
				}
			]
		}
	].filter((section) => section.items.length > 0);
}
