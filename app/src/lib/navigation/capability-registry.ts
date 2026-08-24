export type CapabilityMaturity = 'operational' | 'partial' | 'planned';

export type CapabilityRoute = {
	label: string;
	href: string;
	memberAvailable?: boolean;
	anyPermissions?: readonly string[];
	anyPermissionNamespaces?: readonly string[];
};

export type NativeCapabilityDomain = {
	id: number;
	key: string;
	name: string;
	description: string;
	maturity: CapabilityMaturity;
	maturityNote: string;
	permissionNamespaces: readonly string[];
	routes: readonly CapabilityRoute[];
};

export type ResolvedNativeCapabilityDomain = Omit<NativeCapabilityDomain, 'routes'> & {
	routes: CapabilityRoute[];
	available: boolean;
};

export type CapabilityRegistrySummary = {
	total: number;
	available: number;
	operational: number;
	partial: number;
	planned: number;
};

const nativeCapabilityDomains: readonly NativeCapabilityDomain[] = [
	{
		id: 1,
		key: 'enterprise-identity-master-data',
		name: 'Enterprise, identity and master data',
		description:
			'Organisation, identity, membership, authority and governed enterprise master data.',
		maturity: 'operational',
		maturityNote:
			'Organisation, membership, roles, permissions, careers and audit foundations are native.',
		permissionNamespaces: ['organisation.', 'member.', 'role.', 'permission.', 'career.', 'audit.'],
		routes: [{ label: 'Organisation', href: '/organisation', memberAvailable: true }]
	},
	{
		id: 2,
		key: 'crm-business-development',
		name: 'CRM, business development and customer management',
		description: 'Customers, contacts, opportunities, pipeline and relationship activity.',
		maturity: 'operational',
		maturityNote:
			'Canonical parties, CRM pipelines, opportunities and activities have native workspaces.',
		permissionNamespaces: ['crm.'],
		routes: [
			{ label: 'Customers & contacts', href: '/crm', anyPermissionNamespaces: ['crm.'] },
			{ label: 'Opportunities', href: '/crm/opportunities', anyPermissionNamespaces: ['crm.'] }
		]
	},
	{
		id: 3,
		key: 'estimating-bidding-sales',
		name: 'Estimating, bidding, tendering, proposals and sales',
		description: 'Estimate, tender, proposal and quotation formation before contract award.',
		maturity: 'partial',
		maturityNote:
			'Estimates and quotations are native; deeper take-off, bid governance and tender analysis remain.',
		permissionNamespaces: ['commercial.estimate.', 'commercial.quotation.'],
		routes: [
			{
				label: 'Estimates',
				href: '/commercial/estimates',
				anyPermissions: ['commercial.view', 'commercial.manage', 'commercial.estimate.manage']
			},
			{
				label: 'Quotations',
				href: '/commercial/quotations',
				anyPermissions: ['commercial.view', 'commercial.manage', 'commercial.quotation.manage']
			}
		]
	},
	{
		id: 4,
		key: 'contracts-commercial-revenue',
		name: 'Contracts, commercial management and revenue',
		description: 'Contracts, change, valuation, revenue and commercial control.',
		maturity: 'partial',
		maturityNote:
			'Contract formation, valuations and project change are native; claims and final-account depth remain.',
		permissionNamespaces: [
			'contract.',
			'commercial.variation.',
			'commercial.valuation.',
			'commercial.cost_control.'
		],
		routes: [
			{ label: 'Contracts', href: '/contracts', anyPermissionNamespaces: ['contract.'] },
			{
				label: 'Valuations',
				href: '/commercial/valuations',
				anyPermissions: ['commercial.manage'],
				anyPermissionNamespaces: ['commercial.valuation.']
			},
			{
				label: 'Project cost control',
				href: '/commercial/cost-control',
				anyPermissions: ['commercial.manage'],
				anyPermissionNamespaces: [
					'commercial.cost_control.',
					'commercial.cost_code.',
					'commercial.budget.',
					'commercial.variation.'
				]
			}
		]
	},
	{
		id: 5,
		key: 'portfolio-programme-project',
		name: 'Portfolio, programme and project management',
		description: 'Project governance, planning, work, schedule, risk, change and project controls.',
		maturity: 'partial',
		maturityNote:
			'Portfolio/programme/project hierarchy, projects, schedule and Work Kernel are native; WBS, baseline scheduling, resources, risk and full project-controls depth remain.',
		permissionNamespaces: ['project.', 'schedule.', 'work.'],
		routes: [
			{ label: 'Projects', href: '/projects', anyPermissionNamespaces: ['project.'] },
			{ label: 'Schedule', href: '/schedule', anyPermissionNamespaces: ['schedule.'] },
			{ label: 'My work', href: '/my-work', anyPermissionNamespaces: ['work.'] }
		]
	},
	{
		id: 6,
		key: 'design-engineering-information',
		name: 'Design, engineering, BIM and information management',
		description:
			'Controlled information, design review, RFIs, submittals, instructions and BIM foundations.',
		maturity: 'partial',
		maturityNote:
			'Controlled information workflows are native; BIM/openBIM, responsibility matrices and model-object depth remain.',
		permissionNamespaces: ['information.'],
		routes: [{ label: 'Documents', href: '/documents', anyPermissionNamespaces: ['information.'] }]
	},
	{
		id: 7,
		key: 'finance-statutory-accounting',
		name: 'Finance and statutory accounting',
		description:
			'Financial documents, receivables, payments, ledger, periods, tax and statutory accounting.',
		maturity: 'partial',
		maturityNote:
			'Core accounting and receivables are native; complete AP, banking, fixed assets and localisation remain.',
		permissionNamespaces: ['finance.'],
		routes: [
			{ label: 'Finance', href: '/finance', anyPermissionNamespaces: ['finance.'] },
			{ label: 'Accounting', href: '/finance/accounting', anyPermissionNamespaces: ['finance.'] },
			{ label: 'Invoices', href: '/finance/invoices', anyPermissionNamespaces: ['finance.'] },
			{ label: 'Receivables', href: '/finance/receivables', anyPermissionNamespaces: ['finance.'] }
		]
	},
	{
		id: 8,
		key: 'management-accounting-performance',
		name: 'Management accounting, planning, treasury and enterprise performance',
		description:
			'Cost control, budgets, forecasts, cash flow, profitability and management reporting.',
		maturity: 'partial',
		maturityNote:
			'Project budgets/cost control and financial reporting foundations exist; treasury, consolidation and planning depth remain.',
		permissionNamespaces: ['commercial.cost_control.', 'commercial.budget.', 'finance.accounting.'],
		routes: [
			{
				label: 'Project cost control',
				href: '/commercial/cost-control',
				anyPermissions: ['commercial.manage'],
				anyPermissionNamespaces: ['commercial.cost_control.', 'commercial.budget.']
			},
			{
				label: 'Financial reports',
				href: '/finance/accounting/reports',
				anyPermissionNamespaces: ['finance.']
			}
		]
	},
	{
		id: 9,
		key: 'procurement-supplier-management',
		name: 'Procurement, subcontracting and supplier management',
		description:
			'Supplier relationships, procurement packages, RFQs, purchase orders and commitments.',
		maturity: 'partial',
		maturityNote:
			'Packages, sourcing and purchase orders are native; onboarding, receipt/matching and supplier-performance depth remain.',
		permissionNamespaces: ['procurement.'],
		routes: [
			{ label: 'Procurement', href: '/purchasing', anyPermissionNamespaces: ['procurement.'] }
		]
	},
	{
		id: 10,
		key: 'materials-inventory-logistics',
		name: 'Materials, inventory, warehouse, distribution and logistics',
		description: 'Material master, stock, warehousing, traceability, delivery and site logistics.',
		maturity: 'planned',
		maturityNote:
			'Procurement records provide upstream foundations; a native inventory/logistics workspace is not yet delivered.',
		permissionNamespaces: ['inventory.', 'logistics.'],
		routes: []
	},
	{
		id: 11,
		key: 'production-fabrication',
		name: 'Production, fabrication and prefabrication',
		description:
			'BOM, routing, capacity, fabrication orders, quality and project-linked production.',
		maturity: 'planned',
		maturityNote: 'Native manufacturing and prefabrication execution is not yet delivered.',
		permissionNamespaces: ['production.', 'manufacturing.'],
		routes: []
	},
	{
		id: 12,
		key: 'people-workforce-payroll',
		name: 'People, HCM, workforce and payroll',
		description:
			'Workers, competencies, teams, scheduling, time, attendance and payroll foundations.',
		maturity: 'partial',
		maturityNote:
			'Workforce, skills, time and scheduling are native; employment/HCM and payroll depth remain.',
		permissionNamespaces: ['workforce.', 'timesheet.', 'schedule.', 'payroll.'],
		routes: [
			{ label: 'People', href: '/people', anyPermissionNamespaces: ['workforce.'] },
			{ label: 'Time', href: '/time', anyPermissionNamespaces: ['timesheet.'] },
			{ label: 'Schedule', href: '/schedule', anyPermissionNamespaces: ['schedule.'] }
		]
	},
	{
		id: 13,
		key: 'site-field-operations',
		name: 'Site, field and construction operations',
		description: 'Site records, diaries, work areas, progress, evidence and field execution.',
		maturity: 'partial',
		maturityNote:
			'Native site controls exist; production/work-package depth and offline-first field execution remain.',
		permissionNamespaces: ['site.'],
		routes: [{ label: 'Site', href: '/site', anyPermissionNamespaces: ['site.'] }]
	},
	{
		id: 14,
		key: 'quality-safety-environment-compliance',
		name: 'Quality, health, safety, environment and compliance',
		description: 'Inspections, defects, NCRs, safety evidence, statutory compliance and assurance.',
		maturity: 'partial',
		maturityNote:
			'Quality, safety and asset-compliance workflows exist; full environmental and regulatory depth remains.',
		permissionNamespaces: ['quality.', 'safety.', 'compliance.'],
		routes: [
			{
				label: 'Site, quality & safety',
				href: '/site',
				anyPermissionNamespaces: ['quality.', 'safety.']
			},
			{ label: 'Asset compliance', href: '/assets', anyPermissionNamespaces: ['compliance.'] }
		]
	},
	{
		id: 15,
		key: 'plant-fleet-eam',
		name: 'Plant, fleet, equipment and enterprise asset management',
		description:
			'Asset hierarchy, equipment lifecycle, maintenance, service, compliance and work orders.',
		maturity: 'partial',
		maturityNote:
			'Asset, maintenance, service and compliance records are native; fleet/hire/utilisation depth remains.',
		permissionNamespaces: ['assets.', 'maintenance.', 'compliance.'],
		routes: [
			{
				label: 'Assets & maintenance',
				href: '/assets',
				anyPermissionNamespaces: ['assets.', 'maintenance.', 'compliance.']
			}
		]
	},
	{
		id: 16,
		key: 'property-estates-facilities',
		name: 'Property, real estate, estates and facilities',
		description:
			'Facility, building, level and space hierarchy with operational estate management foundations.',
		maturity: 'partial',
		maturityNote:
			'Facilities/buildings/spaces and maintenance are native; land, interests, leases and occupancy depth remain.',
		permissionNamespaces: ['facilities.', 'maintenance.'],
		routes: [
			{
				label: 'Assets & facilities',
				href: '/assets',
				anyPermissionNamespaces: ['facilities.', 'maintenance.']
			}
		]
	},
	{
		id: 17,
		key: 'service-maintenance-aftercare',
		name: 'Service, maintenance, warranty and aftercare',
		description:
			'Service requests, maintenance plans, work orders, service history, warranties and aftercare.',
		maturity: 'partial',
		maturityNote:
			'Planned/reactive maintenance and service evidence are native; service contracts, dispatch and billing depth remain.',
		permissionNamespaces: ['maintenance.', 'assets.'],
		routes: [
			{
				label: 'Maintenance & service',
				href: '/assets',
				anyPermissionNamespaces: ['maintenance.', 'assets.']
			}
		]
	},
	{
		id: 18,
		key: 'sustainability-carbon',
		name: 'Sustainability, carbon and environmental performance',
		description:
			'Carbon, energy, waste, circularity, provenance and whole-life sustainability performance.',
		maturity: 'planned',
		maturityNote:
			'Environmental evidence exists in adjacent domains, but the governed sustainability performance domain is not yet delivered.',
		permissionNamespaces: ['sustainability.', 'carbon.'],
		routes: []
	},
	{
		id: 19,
		key: 'data-workflow-analytics-intelligence',
		name: 'Data, workflow, analytics, search and intelligence',
		description:
			'Work Kernel, notifications, search, context, workflow, reporting and governed platform intelligence.',
		maturity: 'operational',
		maturityNote:
			'Work Kernel, canonical-event notifications, enterprise search and personal context are active horizontal services.',
		permissionNamespaces: ['work.', 'reporting.', 'integration.', 'automation.'],
		routes: [
			{ label: 'My work', href: '/my-work', anyPermissionNamespaces: ['work.'] },
			{ label: 'Enterprise search', href: '/search', memberAvailable: true },
			{ label: 'Contexts', href: '/contexts', memberAvailable: true }
		]
	}
] as const;

function hasAnyNamespace(allowed: Set<string>, namespaces: readonly string[] | undefined): boolean {
	if (!namespaces?.length) return false;
	for (const key of allowed) {
		if (namespaces.some((namespace) => key.startsWith(namespace))) return true;
	}
	return false;
}

function routeAllowed(route: CapabilityRoute, allowed: Set<string>): boolean {
	if (route.memberAvailable) return true;
	if (route.anyPermissions?.some((permission) => allowed.has(permission))) return true;
	return hasAnyNamespace(allowed, route.anyPermissionNamespaces);
}

export function getNativeCapabilityRegistry(): readonly NativeCapabilityDomain[] {
	return nativeCapabilityDomains;
}

export function resolveNativeCapabilityRegistry(
	allowedPermissionKeys: readonly string[]
): ResolvedNativeCapabilityDomain[] {
	const allowed = new Set(allowedPermissionKeys);
	return nativeCapabilityDomains.map((domain) => {
		const routes = domain.routes.filter((route) => routeAllowed(route, allowed));
		return { ...domain, routes, available: routes.length > 0 };
	});
}

export function summariseCapabilityRegistry(
	registry: readonly ResolvedNativeCapabilityDomain[]
): CapabilityRegistrySummary {
	return {
		total: registry.length,
		available: registry.filter((domain) => domain.available).length,
		operational: registry.filter((domain) => domain.maturity === 'operational').length,
		partial: registry.filter((domain) => domain.maturity === 'partial').length,
		planned: registry.filter((domain) => domain.maturity === 'planned').length
	};
}
