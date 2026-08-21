export type AppNavigationItem = {
	id: string;
	label: string;
	href: string;
	description?: string;
	anyPermissions?: readonly string[];
	anyPermissionNamespaces?: readonly string[];
	children?: readonly AppNavigationItem[];
};

export type AppNavigationSection = {
	id: string;
	label: string;
	items: AppNavigationItem[];
};

export type AppQuickAction = {
	id: string;
	label: string;
	href: string;
	description: string;
	anyPermissions: readonly string[];
};

export type ProjectContextNavigationItem = {
	id: string;
	label: string;
	href: string;
};

const primaryNavigationSections: readonly AppNavigationSection[] = [
	{
		id: 'work',
		label: 'Work',
		items: [
			{ id: 'dashboard', label: 'Home', href: '/dashboard' },
			{ id: 'my-work', label: 'My work', href: '/my-work' },
			{
				id: 'projects',
				label: 'Projects',
				href: '/projects',
				anyPermissionNamespaces: ['project.']
			}
		]
	},
	{
		id: 'relationships',
		label: 'Business',
		items: [
			{
				id: 'customers',
				label: 'Customers',
				href: '/crm',
				anyPermissionNamespaces: ['crm.']
			},
			{
				id: 'suppliers',
				label: 'Suppliers',
				href: '/purchasing',
				anyPermissionNamespaces: ['procurement.']
			},
			{
				id: 'assets',
				label: 'Assets',
				href: '/assets',
				anyPermissionNamespaces: ['assets.', 'facilities.', 'maintenance.', 'compliance.']
			},
			{
				id: 'finance',
				label: 'Finance',
				href: '/finance',
				anyPermissionNamespaces: ['finance.']
			},
			{
				id: 'portal',
				label: 'Portal',
				href: '/portal',
				anyPermissions: ['portal.view']
			}
		]
	},
	{
		id: 'more',
		label: 'Explore',
		items: [{ id: 'more-workspaces', label: 'More', href: '/more' }]
	}
];

const workspaceDirectorySections: readonly AppNavigationSection[] = [
	{
		id: 'relationships',
		label: 'Customers & pipeline',
		items: [
			{
				id: 'crm',
				label: 'Customers & contacts',
				href: '/crm',
				description: 'Organisations, people and relationship records.',
				anyPermissionNamespaces: ['crm.']
			},
			{
				id: 'opportunities',
				label: 'Opportunities',
				href: '/crm/opportunities',
				description: 'Pipeline opportunities and activity.',
				anyPermissionNamespaces: ['crm.']
			},
			{
				id: 'estimates',
				label: 'Estimates',
				href: '/commercial/estimates',
				description: 'Build controlled commercial estimates.',
				anyPermissions: ['commercial.view', 'commercial.manage', 'commercial.estimate.manage']
			},
			{
				id: 'quotations',
				label: 'Quotations',
				href: '/commercial/quotations',
				description: 'Issue and manage customer quotations.',
				anyPermissions: ['commercial.view', 'commercial.manage', 'commercial.quotation.manage']
			},
			{
				id: 'contracts',
				label: 'Contracts',
				href: '/contracts',
				description: 'Contract formation and amendments.',
				anyPermissionNamespaces: ['contract.']
			}
		]
	},
	{
		id: 'project-delivery',
		label: 'Project delivery',
		items: [
			{
				id: 'documents',
				label: 'Documents',
				href: '/documents',
				description: 'Controlled documents, RFIs, submittals and instructions.',
				anyPermissionNamespaces: ['information.']
			},
			{
				id: 'purchasing',
				label: 'Procurement',
				href: '/purchasing',
				description: 'Packages, RFQs, suppliers and purchase orders.',
				anyPermissionNamespaces: ['procurement.']
			},
			{
				id: 'project-cost-control',
				label: 'Project cost control',
				href: '/commercial/cost-control',
				description: 'Cost codes, budgets and project change control.',
				anyPermissionNamespaces: [
					'commercial.cost_control.',
					'commercial.cost_code.',
					'commercial.budget.',
					'commercial.variation.'
				]
			},
			{
				id: 'commercial-valuations',
				label: 'Valuations',
				href: '/commercial/valuations',
				description: 'Project valuation and assessment workflows.',
				anyPermissionNamespaces: ['commercial.valuation.']
			},
			{
				id: 'site',
				label: 'Site, quality & safety',
				href: '/site',
				description: 'Site diaries, quality inspections and safety observations.',
				anyPermissionNamespaces: ['site.', 'quality.', 'safety.']
			},
			{
				id: 'portal',
				label: 'Portal',
				href: '/portal',
				description: 'Shared work with external project organisations.',
				anyPermissions: ['portal.view']
			}
		]
	},
	{
		id: 'operations',
		label: 'People & operations',
		items: [
			{
				id: 'schedule',
				label: 'Schedule',
				href: '/schedule',
				description: 'Plan visits, shifts and scheduled work.',
				anyPermissionNamespaces: ['schedule.']
			},
			{
				id: 'time',
				label: 'Time',
				href: '/time',
				description: 'Personal and project timesheets.',
				anyPermissionNamespaces: ['timesheet.']
			},
			{
				id: 'people',
				label: 'People',
				href: '/people',
				description: 'Workforce records and assignments.',
				anyPermissionNamespaces: ['workforce.']
			},
			{
				id: 'assets',
				label: 'Assets & facilities',
				href: '/assets',
				description: 'Assets, maintenance, facilities and compliance.',
				anyPermissionNamespaces: ['assets.', 'facilities.', 'maintenance.', 'compliance.']
			}
		]
	},
	{
		id: 'finance',
		label: 'Finance',
		items: [
			{
				id: 'invoices',
				label: 'Invoices',
				href: '/finance/invoices',
				anyPermissions: ['finance.view', 'finance.manage']
			},
			{
				id: 'credit-notes',
				label: 'Credit notes',
				href: '/finance/credit-notes',
				anyPermissions: ['finance.view', 'finance.manage']
			},
			{
				id: 'payments',
				label: 'Payments',
				href: '/finance/payments',
				anyPermissions: ['finance.view', 'finance.manage']
			},
			{
				id: 'receivables',
				label: 'Receivables',
				href: '/finance/receivables',
				anyPermissions: ['finance.view', 'finance.manage']
			},
			{
				id: 'collections',
				label: 'Collections',
				href: '/finance/collections',
				anyPermissions: ['finance.collections.view', 'finance.manage']
			},
			{
				id: 'credit-control',
				label: 'Credit control',
				href: '/finance/credit-control',
				anyPermissions: ['finance.credit_control.view', 'finance.manage']
			},
			{
				id: 'bad-debt',
				label: 'Bad debt',
				href: '/finance/bad-debt',
				anyPermissions: ['finance.bad_debt.view', 'finance.manage']
			},
			{
				id: 'tax-relief',
				label: 'VAT bad-debt relief',
				href: '/finance/tax-relief',
				anyPermissions: ['finance.tax_relief.view', 'finance.manage']
			},
			{
				id: 'accounting',
				label: 'Accounting',
				href: '/finance/accounting',
				anyPermissions: ['finance.accounting.view', 'finance.manage']
			},
			{
				id: 'accounting-periods',
				label: 'Accounting periods',
				href: '/finance/accounting/periods',
				anyPermissions: ['finance.accounting.view', 'finance.manage']
			},
			{
				id: 'financial-reports',
				label: 'Financial reports',
				href: '/finance/accounting/reports',
				anyPermissions: ['finance.accounting.view', 'finance.manage']
			},
			{
				id: 'year-end',
				label: 'Year-end close',
				href: '/finance/accounting/year-end',
				anyPermissions: ['finance.accounting.view', 'finance.manage']
			},
			{
				id: 'billing-settings',
				label: 'Billing settings',
				href: '/finance/billing',
				anyPermissions: ['finance.view', 'finance.manage', 'finance.billing.manage']
			},
			{
				id: 'tax-settings',
				label: 'Tax settings',
				href: '/finance/tax',
				anyPermissions: ['finance.view', 'finance.manage']
			}
		]
	},
	{
		id: 'administration',
		label: 'Administration',
		items: [
			{
				id: 'organisation',
				label: 'Organisation settings',
				href: '/organisation',
				description: 'Membership, roles and organisation controls.'
			}
		]
	}
];

const quickActions: readonly AppQuickAction[] = [
	{
		id: 'new-crm-record',
		label: 'Customer / contact',
		href: '/crm#new-party',
		description: 'Create an organisation or person record.',
		anyPermissions: ['crm.party.manage', 'crm.manage']
	},
	{
		id: 'new-opportunity',
		label: 'Opportunity',
		href: '/crm/opportunities#new-opportunity',
		description: 'Capture prospective work against a customer.',
		anyPermissions: ['crm.opportunity.manage', 'crm.manage']
	},
	{
		id: 'new-estimate',
		label: 'Estimate',
		href: '/commercial/estimates#new-estimate',
		description: 'Start a new commercial estimate.',
		anyPermissions: ['commercial.estimate.manage', 'commercial.manage']
	},
	{
		id: 'new-project',
		label: 'Project',
		href: '/projects',
		description: 'Create a new project workspace.',
		anyPermissions: ['project.create']
	},
	{
		id: 'new-document',
		label: 'Controlled document',
		href: '/documents#create-document',
		description: 'Register a document identity and its first revision.',
		anyPermissions: ['information.manage']
	},
	{
		id: 'new-rfi',
		label: 'RFI',
		href: '/documents#create-rfi',
		description: 'Create a controlled request for information.',
		anyPermissions: ['information.rfi.manage']
	},
	{
		id: 'new-instruction',
		label: 'Project instruction',
		href: '/documents#create-instruction',
		description: 'Create a formal project instruction draft.',
		anyPermissions: ['information.instruction.manage']
	},
	{
		id: 'new-procurement-package',
		label: 'Procurement package',
		href: '/purchasing#create-package',
		description: 'Create a project procurement requirement.',
		anyPermissions: ['procurement.package.manage']
	},
	{
		id: 'new-purchase-order',
		label: 'Purchase order',
		href: '/purchasing#create-po',
		description: 'Create a controlled supplier commitment draft.',
		anyPermissions: ['procurement.po.manage']
	},
	{
		id: 'new-cost-code',
		label: 'Project cost code',
		href: '/commercial/cost-control#create-cost-code',
		description: 'Create project commercial classification.',
		anyPermissions: ['commercial.cost_code.manage']
	},
	{
		id: 'new-commercial-variation',
		label: 'Commercial variation',
		href: '/commercial/cost-control#create-variation',
		description: 'Create a controlled project change record.',
		anyPermissions: ['commercial.variation.manage']
	},
	{
		id: 'new-site-diary',
		label: 'Site diary',
		href: '/site#create-diary',
		description: 'Capture a controlled project field record.',
		anyPermissions: ['site.diary.manage']
	},
	{
		id: 'new-quality-inspection',
		label: 'Quality inspection',
		href: '/site#create-inspection',
		description: 'Start an inspection against a published checklist.',
		anyPermissions: ['quality.inspection.manage']
	},
	{
		id: 'new-safety-observation',
		label: 'Safety observation',
		href: '/site#create-safety-observation',
		description: 'Report a project safety observation from the field.',
		anyPermissions: ['safety.event.manage']
	},
	{
		id: 'new-workforce-member',
		label: 'Workforce member',
		href: '/people#create-worker',
		description: 'Link an organisation member to the workforce.',
		anyPermissions: ['workforce.manage']
	},
	{
		id: 'new-scheduled-work',
		label: 'Scheduled work',
		href: '/schedule#schedule-work',
		description: 'Plan a visit, shift, appointment or work session.',
		anyPermissions: ['schedule.manage']
	},
	{
		id: 'new-timesheet',
		label: 'Timesheet',
		href: '/time#new-timesheet',
		description: 'Create a new personal timesheet period.',
		anyPermissions: ['timesheet.manage']
	},
	{
		id: 'new-contract',
		label: 'Contract',
		href: '/contracts',
		description: 'Form a contract from an eligible project.',
		anyPermissions: ['contract.create', 'contract.manage']
	},
	{
		id: 'new-invoice',
		label: 'Invoice',
		href: '/finance/invoices',
		description: 'Create a controlled invoice draft.',
		anyPermissions: ['finance.invoice.create', 'finance.manage']
	},
	{
		id: 'new-asset',
		label: 'Asset',
		href: '/assets#create-asset',
		description: 'Register a maintainable operational asset.',
		anyPermissions: ['assets.manage']
	},
	{
		id: 'new-maintenance-request',
		label: 'Maintenance request',
		href: '/assets#create-maintenance-request',
		description: 'Report a reactive asset or facility issue.',
		anyPermissions: ['maintenance.request.manage']
	},
	{
		id: 'new-maintenance-plan',
		label: 'Maintenance plan',
		href: '/assets#create-maintenance-plan',
		description: 'Create planned maintenance for an asset.',
		anyPermissions: ['maintenance.plan.manage']
	}
];

function hasAnyPermission(allowed: ReadonlySet<string>, required: readonly string[]): boolean {
	return required.some((permissionKey) => allowed.has(permissionKey));
}

function hasAnyNamespace(allowed: ReadonlySet<string>, namespaces: readonly string[]): boolean {
	for (const permissionKey of allowed) {
		if (namespaces.some((namespace) => permissionKey.startsWith(namespace))) return true;
	}
	return false;
}

function canRenderItem(item: AppNavigationItem, allowed: ReadonlySet<string>): boolean {
	if (item.anyPermissions?.length && !hasAnyPermission(allowed, item.anyPermissions)) return false;
	if (
		item.anyPermissionNamespaces?.length &&
		!hasAnyNamespace(allowed, item.anyPermissionNamespaces)
	) {
		return false;
	}
	return true;
}

function resolveSections(
	sections: readonly AppNavigationSection[],
	allowedPermissionKeys: readonly string[]
): AppNavigationSection[] {
	const allowed = new Set(allowedPermissionKeys);
	return sections
		.map((section) => ({
			...section,
			items: section.items.filter((item) => canRenderItem(item, allowed))
		}))
		.filter((section) => section.items.length > 0);
}

export function resolveAppNavigation(
	allowedPermissionKeys: readonly string[]
): AppNavigationSection[] {
	return resolveSections(primaryNavigationSections, allowedPermissionKeys);
}

export function resolveWorkspaceDirectory(
	allowedPermissionKeys: readonly string[]
): AppNavigationSection[] {
	return resolveSections(workspaceDirectorySections, allowedPermissionKeys);
}

export function resolveProjectContextNavigation(
	allowedPermissionKeys: readonly string[],
	projectPublicId: string
): ProjectContextNavigationItem[] {
	const allowed = new Set(allowedPermissionKeys);
	const query = `?project=${encodeURIComponent(projectPublicId)}`;
	const projectHref = `/projects/${encodeURIComponent(projectPublicId)}${query}`;
	const links: ProjectContextNavigationItem[] = [
		{ id: 'overview', label: 'Overview', href: projectHref },
		{ id: 'team', label: 'Team', href: `${projectHref}#team` }
	];
	if (hasAnyNamespace(allowed, ['information.']))
		links.push({ id: 'documents', label: 'Documents', href: `/documents${query}` });
	if (hasAnyNamespace(allowed, ['procurement.']))
		links.push({ id: 'procurement', label: 'Procurement', href: `/purchasing${query}` });
	if (
		allowed.has('commercial.manage') ||
		hasAnyNamespace(allowed, [
			'commercial.cost_control.',
			'commercial.cost_code.',
			'commercial.budget.',
			'commercial.variation.'
		])
	)
		links.push({ id: 'costs', label: 'Costs', href: `/commercial/cost-control${query}` });
	if (allowed.has('commercial.manage') || hasAnyNamespace(allowed, ['commercial.valuation.']))
		links.push({ id: 'valuations', label: 'Valuations', href: `/commercial/valuations${query}` });
	if (hasAnyNamespace(allowed, ['site.', 'quality.', 'safety.']))
		links.push({ id: 'site', label: 'Site', href: `/site${query}` });
	if (hasAnyNamespace(allowed, ['schedule.']))
		links.push({ id: 'schedule', label: 'Schedule', href: `/schedule${query}` });
	if (hasAnyNamespace(allowed, ['timesheet.']))
		links.push({ id: 'time', label: 'Time', href: `/time${query}` });
	if (hasAnyNamespace(allowed, ['assets.', 'facilities.', 'maintenance.', 'compliance.']))
		links.push({ id: 'assets', label: 'Assets', href: `/assets${query}` });
	if (allowed.has('portal.view')) {
		links.push({
			id: 'portal',
			label: 'Portal',
			href: allowed.has('portal.manage') ? `/portal/manage${query}` : `/portal${query}`
		});
	}
	return links;
}

export function resolveQuickActions(allowedPermissionKeys: readonly string[]): AppQuickAction[] {
	const allowed = new Set(allowedPermissionKeys);
	return quickActions.filter((action) => hasAnyPermission(allowed, action.anyPermissions));
}
