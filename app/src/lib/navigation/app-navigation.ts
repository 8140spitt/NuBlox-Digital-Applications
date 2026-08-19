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

const navigationSections: readonly AppNavigationSection[] = [
	{
		id: 'home',
		label: 'Home',
		items: [{ id: 'dashboard', label: 'Dashboard', href: '/dashboard' }]
	},
	{
		id: 'pipeline',
		label: 'Pipeline',
		items: [
			{
				id: 'crm',
				label: 'CRM',
				href: '/crm',
				anyPermissionNamespaces: ['crm.'],
				children: [
					{ id: 'crm-overview', label: 'Organisations & people', href: '/crm' },
					{ id: 'opportunities', label: 'Opportunities', href: '/crm/opportunities' }
				]
			},
			{
				id: 'commercial',
				label: 'Commercial',
				href: '/commercial/estimates',
				anyPermissionNamespaces: ['commercial.'],
				children: [
					{ id: 'estimates', label: 'Estimates', href: '/commercial/estimates' },
					{ id: 'quotations', label: 'Quotations', href: '/commercial/quotations' }
				]
			}
		]
	},
	{
		id: 'delivery',
		label: 'Delivery',
		items: [
			{
				id: 'projects',
				label: 'Projects',
				href: '/projects',
				anyPermissionNamespaces: ['project.']
			},
			{
				id: 'contracts',
				label: 'Contracts',
				href: '/contracts',
				anyPermissionNamespaces: ['contract.']
			}
		]
	},
	{
		id: 'finance',
		label: 'Finance',
		items: [
			{
				id: 'finance',
				label: 'Finance',
				href: '/finance/invoices',
				anyPermissionNamespaces: ['finance.'],
				children: [
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
						id: 'collections-automation',
						label: 'Collections automation',
						href: '/finance/collections/automation',
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
			}
		]
	},
	{
		id: 'administration',
		label: 'Administration',
		items: [{ id: 'organisation', label: 'Organisation', href: '/organisation' }]
	}
];

const quickActions: readonly AppQuickAction[] = [
	{
		id: 'new-crm-record',
		label: 'CRM record',
		href: '/crm',
		description: 'Create an organisation or person record.',
		anyPermissions: ['crm.party.manage', 'crm.manage']
	},
	{
		id: 'new-estimate',
		label: 'Estimate',
		href: '/commercial/estimates',
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

export function resolveAppNavigation(
	allowedPermissionKeys: readonly string[]
): AppNavigationSection[] {
	const allowed = new Set(allowedPermissionKeys);
	return navigationSections
		.map((section) => ({
			...section,
			items: section.items
				.filter((item) => canRenderItem(item, allowed))
				.map((item) => ({
					...item,
					children: item.children?.filter((child) => canRenderItem(child, allowed))
				}))
		}))
		.filter((section) => section.items.length > 0);
}

export function resolveQuickActions(allowedPermissionKeys: readonly string[]): AppQuickAction[] {
	const allowed = new Set(allowedPermissionKeys);
	return quickActions.filter((action) => hasAnyPermission(allowed, action.anyPermissions));
}
