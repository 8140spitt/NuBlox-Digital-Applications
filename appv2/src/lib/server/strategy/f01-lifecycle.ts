import {
	assertLifecycleTransition as assertPlatformLifecycleTransition,
	canLifecycleOperation,
	defineLifecycleTemplate,
	lifecycleTransitions as platformLifecycleTransitions,
	phasePermissionKeysForRoles,
	type LifecycleTemplate,
	type LifecycleTransition
} from '$lib/server/platform/lifecycle-kernel';

export type F01ManagedRecordKind =
	| 'framework'
	| 'evidence'
	| 'factor'
	| 'assumption'
	| 'option'
	| 'theme'
	| 'objective'
	| 'plan'
	| 'initiative'
	| 'requirement'
	| 'handoff'
	| 'kpi'
	| 'review'
	| 'decision';

export type F01LifecycleTransition = LifecycleTransition;

const managerAccess = [
	{ roleKey: 'strategy.manager', permissionKeys: ['strategy.view', 'strategy.manage'] },
	{ roleKey: 'strategy.approver', permissionKeys: ['strategy.view', 'strategy.approve'] }
] as const;

const publishedAccess = [
	{ roleKey: 'strategy.manager', permissionKeys: ['strategy.view', 'strategy.manage'] },
	{ roleKey: 'strategy.approver', permissionKeys: ['strategy.view', 'strategy.approve'] },
	{ roleKey: 'strategy.viewer', permissionKeys: ['strategy.view'] }
] as const;

function basicTemplate(
	key: string,
	initialState: string,
	phases: LifecycleTemplate['phases'],
	transitions: LifecycleTemplate['transitions']
): LifecycleTemplate {
	return defineLifecycleTemplate({
		key: `f01.${key}`,
		version: '1.0',
		mode: 'basic',
		enabled: true,
		objectType: key,
		initialState,
		phases,
		transitions
	});
}

function advancedTemplate(
	key: string,
	initialState: string,
	phases: LifecycleTemplate['phases'],
	transitions: LifecycleTemplate['transitions']
): LifecycleTemplate {
	return defineLifecycleTemplate({
		key: `f01.${key}`,
		version: '1.0',
		mode: 'advanced',
		enabled: true,
		objectType: key,
		initialState,
		phases,
		transitions
	});
}

export const F01_LIFECYCLE_TEMPLATES: Readonly<Record<F01ManagedRecordKind, LifecycleTemplate>> = {
	framework: advancedTemplate(
		'framework',
		'draft',
		{
			draft: {
				state: 'draft',
				label: 'Draft',
				editable: true,
				deletable: true,
				accessRules: managerAccess
			},
			approved: {
				state: 'approved',
				label: 'Approved',
				deletable: true,
				revisable: true,
				accessRules: publishedAccess
			},
			superseded: {
				state: 'superseded',
				label: 'Historical',
				accessRules: publishedAccess
			}
		},
		{
			draft: [
				{
					to: 'approved',
					label: 'Submit strategy for approval',
					requiredPermissionKey: 'strategy.manage',
					workflowKey: 'f01.strategy-approval'
				}
			],
			approved: [],
			superseded: []
		}
	),
	evidence: basicTemplate(
		'evidence',
		'active',
		{
			active: { state: 'active', label: 'Active', editable: true, deletable: true },
			retired: { state: 'retired', label: 'Retired' }
		},
		{
			active: [
				{
					to: 'retired',
					label: 'Retire evidence',
					tone: 'danger',
					requiredPermissionKey: 'strategy.manage'
				}
			],
			retired: []
		}
	),
	factor: basicTemplate(
		'factor',
		'active',
		{
			active: { state: 'active', label: 'Active', editable: true, deletable: true },
			retired: { state: 'retired', label: 'Retired' }
		},
		{
			active: [
				{
					to: 'retired',
					label: 'Retire factor',
					tone: 'danger',
					requiredPermissionKey: 'strategy.manage'
				}
			],
			retired: []
		}
	),
	assumption: basicTemplate(
		'assumption',
		'unvalidated',
		{
			unvalidated: { state: 'unvalidated', label: 'Unvalidated', editable: true, deletable: true },
			validated: { state: 'validated', label: 'Validated', editable: true },
			challenged: { state: 'challenged', label: 'Challenged', editable: true },
			invalidated: { state: 'invalidated', label: 'Invalidated', editable: true },
			retired: { state: 'retired', label: 'Retired' }
		},
		{
			unvalidated: [
				{ to: 'validated', label: 'Validate assumption', requiresNote: true },
				{ to: 'challenged', label: 'Challenge assumption', requiresNote: true },
				{ to: 'invalidated', label: 'Invalidate assumption', requiresNote: true, tone: 'danger' },
				{ to: 'retired', label: 'Retire assumption', tone: 'danger' }
			],
			validated: [
				{ to: 'challenged', label: 'Challenge assumption', requiresNote: true },
				{ to: 'retired', label: 'Retire assumption', tone: 'danger' }
			],
			challenged: [
				{ to: 'validated', label: 'Validate assumption', requiresNote: true },
				{ to: 'invalidated', label: 'Invalidate assumption', requiresNote: true, tone: 'danger' },
				{ to: 'retired', label: 'Retire assumption', tone: 'danger' }
			],
			invalidated: [{ to: 'retired', label: 'Retire assumption', tone: 'danger' }],
			retired: []
		}
	),
	option: basicTemplate(
		'option',
		'proposed',
		{
			proposed: { state: 'proposed', label: 'Proposed', editable: true, deletable: true },
			selected: { state: 'selected', label: 'Selected' },
			rejected: { state: 'rejected', label: 'Rejected' }
		},
		{
			proposed: [
				{
					to: 'selected',
					label: 'Select option',
					requiresNote: true,
					requiredPermissionKey: 'strategy.approve'
				},
				{
					to: 'rejected',
					label: 'Reject option',
					requiresNote: true,
					tone: 'danger',
					requiredPermissionKey: 'strategy.approve'
				}
			],
			selected: [],
			rejected: []
		}
	),
	theme: basicTemplate(
		'theme',
		'active',
		{
			active: { state: 'active', label: 'Active', editable: true, deletable: true },
			retired: { state: 'retired', label: 'Retired' }
		},
		{
			active: [{ to: 'retired', label: 'Retire theme', tone: 'danger' }],
			retired: []
		}
	),
	objective: basicTemplate(
		'objective',
		'draft',
		{
			draft: { state: 'draft', label: 'Draft', editable: true, deletable: true },
			active: { state: 'active', label: 'Active' },
			achieved: { state: 'achieved', label: 'Achieved' },
			retired: { state: 'retired', label: 'Retired' }
		},
		{
			draft: [],
			active: [
				{ to: 'achieved', label: 'Mark achieved', requiresNote: true },
				{ to: 'retired', label: 'Retire objective', requiresNote: true, tone: 'danger' }
			],
			achieved: [{ to: 'retired', label: 'Retire objective', requiresNote: true, tone: 'danger' }],
			retired: []
		}
	),
	plan: advancedTemplate(
		'plan',
		'draft',
		{
			draft: {
				state: 'draft',
				label: 'Draft',
				editable: true,
				deletable: true,
				accessRules: managerAccess
			},
			approved: {
				state: 'approved',
				label: 'Approved',
				deletable: true,
				revisable: true,
				accessRules: publishedAccess
			},
			superseded: { state: 'superseded', label: 'Historical', accessRules: publishedAccess }
		},
		{
			draft: [
				{
					to: 'approved',
					label: 'Submit business plan for approval',
					requiredPermissionKey: 'strategy.manage',
					workflowKey: 'f01.business-plan-approval'
				}
			],
			approved: [],
			superseded: []
		}
	),
	initiative: basicTemplate(
		'initiative',
		'proposed',
		{
			proposed: { state: 'proposed', label: 'Proposed', editable: true, deletable: true },
			approved: { state: 'approved', label: 'Approved', editable: true },
			in_progress: { state: 'in_progress', label: 'In progress', editable: true },
			completed: { state: 'completed', label: 'Completed' },
			cancelled: { state: 'cancelled', label: 'Cancelled' }
		},
		{
			proposed: [
				{ to: 'cancelled', label: 'Cancel initiative', requiresNote: true, tone: 'danger' }
			],
			approved: [
				{ to: 'in_progress', label: 'Start initiative', requiresNote: true },
				{ to: 'cancelled', label: 'Cancel initiative', requiresNote: true, tone: 'danger' }
			],
			in_progress: [
				{ to: 'completed', label: 'Complete initiative', requiresNote: true },
				{ to: 'cancelled', label: 'Cancel initiative', requiresNote: true, tone: 'danger' }
			],
			completed: [],
			cancelled: []
		}
	),
	requirement: basicTemplate(
		'requirement',
		'identified',
		{
			identified: { state: 'identified', label: 'Identified', editable: true, deletable: true },
			requested: { state: 'requested', label: 'Requested' },
			committed: { state: 'committed', label: 'Committed' },
			satisfied: { state: 'satisfied', label: 'Satisfied' },
			cancelled: { state: 'cancelled', label: 'Cancelled' }
		},
		{
			identified: [
				{ to: 'cancelled', label: 'Cancel requirement', requiresNote: true, tone: 'danger' }
			],
			requested: [
				{ to: 'cancelled', label: 'Cancel requirement', requiresNote: true, tone: 'danger' }
			],
			committed: [
				{ to: 'satisfied', label: 'Mark requirement satisfied', requiresNote: true },
				{ to: 'cancelled', label: 'Cancel requirement', requiresNote: true, tone: 'danger' }
			],
			satisfied: [],
			cancelled: []
		}
	),
	handoff: basicTemplate(
		'handoff',
		'requested',
		{
			requested: { state: 'requested', label: 'Requested', editable: true },
			accepted: { state: 'accepted', label: 'Accepted' },
			rejected: { state: 'rejected', label: 'Rejected' },
			fulfilled: { state: 'fulfilled', label: 'Fulfilled' },
			cancelled: { state: 'cancelled', label: 'Cancelled' }
		},
		{
			requested: [{ to: 'cancelled', label: 'Cancel handoff', requiresNote: true, tone: 'danger' }],
			accepted: [],
			rejected: [],
			fulfilled: [],
			cancelled: []
		}
	),
	kpi: advancedTemplate(
		'kpi',
		'draft',
		{
			draft: {
				state: 'draft',
				label: 'Draft',
				editable: true,
				deletable: true,
				accessRules: managerAccess
			},
			approved: {
				state: 'approved',
				label: 'Approved',
				deletable: true,
				revisable: true,
				accessRules: publishedAccess
			},
			superseded: { state: 'superseded', label: 'Historical', accessRules: publishedAccess },
			retired: { state: 'retired', label: 'Retired', accessRules: publishedAccess }
		},
		{
			draft: [
				{
					to: 'approved',
					label: 'Submit KPI for approval',
					requiredPermissionKey: 'strategy.manage',
					workflowKey: 'f01.kpi-approval'
				}
			],
			approved: [{ to: 'retired', label: 'Retire KPI', requiresNote: true, tone: 'danger' }],
			superseded: [],
			retired: []
		}
	),
	review: advancedTemplate(
		'review',
		'draft',
		{
			draft: {
				state: 'draft',
				label: 'Draft',
				editable: true,
				deletable: true,
				accessRules: managerAccess
			},
			approved: { state: 'approved', label: 'Approved', accessRules: publishedAccess }
		},
		{
			draft: [
				{
					to: 'approved',
					label: 'Submit review for approval',
					requiredPermissionKey: 'strategy.manage',
					workflowKey: 'f01.strategic-review-approval'
				}
			],
			approved: []
		}
	),
	decision: basicTemplate(
		'decision',
		'open',
		{
			open: { state: 'open', label: 'Open', editable: true, deletable: true },
			in_progress: { state: 'in_progress', label: 'In progress', editable: true },
			completed: { state: 'completed', label: 'Completed' },
			cancelled: { state: 'cancelled', label: 'Cancelled' }
		},
		{
			open: [
				{ to: 'in_progress', label: 'Start action', requiresNote: true },
				{ to: 'completed', label: 'Complete action', requiresNote: true },
				{ to: 'cancelled', label: 'Cancel action', requiresNote: true, tone: 'danger' }
			],
			in_progress: [
				{ to: 'completed', label: 'Complete action', requiresNote: true },
				{ to: 'cancelled', label: 'Cancel action', requiresNote: true, tone: 'danger' }
			],
			completed: [],
			cancelled: []
		}
	)
};

export function lifecycleTemplate(kind: F01ManagedRecordKind): LifecycleTemplate {
	return F01_LIFECYCLE_TEMPLATES[kind];
}

export function canEditF01Record(kind: F01ManagedRecordKind, status: string): boolean {
	return canLifecycleOperation(lifecycleTemplate(kind), status, 'edit');
}

export function canDeleteF01Record(kind: F01ManagedRecordKind, status: string): boolean {
	return canLifecycleOperation(lifecycleTemplate(kind), status, 'delete');
}

export function canReviseF01Record(kind: F01ManagedRecordKind, status: string): boolean {
	return canLifecycleOperation(lifecycleTemplate(kind), status, 'revise');
}

export function lifecycleTransitions(
	kind: F01ManagedRecordKind,
	status: string
): readonly F01LifecycleTransition[] {
	return platformLifecycleTransitions(lifecycleTemplate(kind), status);
}

export function assertLifecycleTransition(
	kind: F01ManagedRecordKind,
	from: string,
	to: string
): F01LifecycleTransition {
	return assertPlatformLifecycleTransition(lifecycleTemplate(kind), from, to);
}

export function f01PhasePermissionKeys(
	kind: F01ManagedRecordKind,
	status: string,
	roleKeys: readonly string[]
): readonly string[] {
	return phasePermissionKeysForRoles(lifecycleTemplate(kind), status, roleKeys);
}
