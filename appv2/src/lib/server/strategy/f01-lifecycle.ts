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

export type F01LifecycleTransition = {
	to: string;
	label: string;
	requiresNote?: boolean;
	requiresTargetReference?: boolean;
	tone?: 'default' | 'danger';
};

type LifecyclePolicy = {
	editable: readonly string[];
	deletable: readonly string[];
	revisable?: readonly string[];
	transitions: Readonly<Record<string, readonly F01LifecycleTransition[]>>;
};

export const F01_LIFECYCLE_POLICIES: Readonly<Record<F01ManagedRecordKind, LifecyclePolicy>> = {
	framework: {
		editable: ['draft'],
		deletable: ['draft'],
		revisable: ['approved'],
		transitions: {
			draft: [{ to: 'approved', label: 'Approve strategy' }],
			approved: [],
			superseded: []
		}
	},
	evidence: {
		editable: ['active'],
		deletable: ['active'],
		transitions: {
			active: [{ to: 'retired', label: 'Retire evidence', tone: 'danger' }],
			retired: []
		}
	},
	factor: {
		editable: ['active'],
		deletable: ['active'],
		transitions: {
			active: [{ to: 'retired', label: 'Retire factor', tone: 'danger' }],
			retired: []
		}
	},
	assumption: {
		editable: ['unvalidated', 'validated', 'challenged', 'invalidated'],
		deletable: ['unvalidated'],
		transitions: {
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
	},
	option: {
		editable: ['proposed'],
		deletable: ['proposed'],
		transitions: {
			proposed: [
				{ to: 'selected', label: 'Select option', requiresNote: true },
				{ to: 'rejected', label: 'Reject option', requiresNote: true, tone: 'danger' }
			],
			selected: [],
			rejected: []
		}
	},
	theme: {
		editable: ['active'],
		deletable: ['active'],
		transitions: {
			active: [{ to: 'retired', label: 'Retire theme', tone: 'danger' }],
			retired: []
		}
	},
	objective: {
		editable: ['draft'],
		deletable: ['draft'],
		transitions: {
			draft: [],
			active: [
				{ to: 'achieved', label: 'Mark achieved', requiresNote: true },
				{ to: 'retired', label: 'Retire objective', requiresNote: true, tone: 'danger' }
			],
			achieved: [{ to: 'retired', label: 'Retire objective', requiresNote: true, tone: 'danger' }],
			retired: []
		}
	},
	plan: {
		editable: ['draft'],
		deletable: ['draft'],
		revisable: ['approved'],
		transitions: {
			draft: [{ to: 'approved', label: 'Approve business plan' }],
			approved: [],
			superseded: []
		}
	},
	initiative: {
		editable: ['proposed', 'approved', 'in_progress'],
		deletable: ['proposed'],
		transitions: {
			proposed: [{ to: 'cancelled', label: 'Cancel initiative', requiresNote: true, tone: 'danger' }],
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
	},
	requirement: {
		editable: ['identified'],
		deletable: ['identified'],
		transitions: {
			identified: [{ to: 'cancelled', label: 'Cancel requirement', requiresNote: true, tone: 'danger' }],
			requested: [{ to: 'cancelled', label: 'Cancel requirement', requiresNote: true, tone: 'danger' }],
			committed: [
				{ to: 'satisfied', label: 'Mark requirement satisfied', requiresNote: true },
				{ to: 'cancelled', label: 'Cancel requirement', requiresNote: true, tone: 'danger' }
			],
			satisfied: [],
			cancelled: []
		}
	},
	handoff: {
		editable: ['requested'],
		deletable: [],
		transitions: {
			requested: [
				{ to: 'accepted', label: 'Accept handoff', requiresNote: true },
				{ to: 'rejected', label: 'Reject handoff', requiresNote: true, tone: 'danger' },
				{ to: 'cancelled', label: 'Cancel handoff', requiresNote: true, tone: 'danger' }
			],
			accepted: [
				{
					to: 'fulfilled',
					label: 'Fulfil handoff',
					requiresNote: true,
					requiresTargetReference: true
				},
				{ to: 'cancelled', label: 'Cancel handoff', requiresNote: true, tone: 'danger' }
			],
			rejected: [],
			fulfilled: [],
			cancelled: []
		}
	},
	kpi: {
		editable: ['draft'],
		deletable: ['draft'],
		revisable: ['approved'],
		transitions: {
			draft: [{ to: 'approved', label: 'Approve KPI' }],
			approved: [{ to: 'retired', label: 'Retire KPI', requiresNote: true, tone: 'danger' }],
			superseded: [],
			retired: []
		}
	},
	review: {
		editable: ['draft'],
		deletable: ['draft'],
		transitions: {
			draft: [{ to: 'approved', label: 'Approve review' }],
			approved: []
		}
	},
	decision: {
		editable: ['open', 'in_progress'],
		deletable: ['open'],
		transitions: {
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
	}
};

export function lifecyclePolicy(kind: F01ManagedRecordKind): LifecyclePolicy {
	return F01_LIFECYCLE_POLICIES[kind];
}

export function canEditF01Record(kind: F01ManagedRecordKind, status: string): boolean {
	return lifecyclePolicy(kind).editable.includes(status);
}

export function canDeleteF01Record(kind: F01ManagedRecordKind, status: string): boolean {
	return lifecyclePolicy(kind).deletable.includes(status);
}

export function canReviseF01Record(kind: F01ManagedRecordKind, status: string): boolean {
	return lifecyclePolicy(kind).revisable?.includes(status) ?? false;
}

export function lifecycleTransitions(
	kind: F01ManagedRecordKind,
	status: string
): readonly F01LifecycleTransition[] {
	return lifecyclePolicy(kind).transitions[status] ?? [];
}

export function assertLifecycleTransition(
	kind: F01ManagedRecordKind,
	from: string,
	to: string
): F01LifecycleTransition {
	const transition = lifecycleTransitions(kind, from).find((candidate) => candidate.to === to);
	if (!transition) {
		throw new Error(`Invalid ${kind} lifecycle transition: ${from} → ${to}.`);
	}
	return transition;
}
