import {
	enterpriseFunctions,
	type EnterpriseFunctionId
} from '$lib/enterprise/enterprise-functions';

export type LifecyclePatternKey =
	| 'GOV'
	| 'MASTER'
	| 'PLAN'
	| 'TXN'
	| 'CASE'
	| 'RISK'
	| 'WORK'
	| 'DOC'
	| 'PROJECT'
	| 'ASSET'
	| 'EVENT';

export type WorkflowFamilyKey =
	| 'approval'
	| 'review'
	| 'revision'
	| 'case-resolution'
	| 'execution'
	| 'exception'
	| 'periodic-review'
	| 'closure'
	| 'qualification'
	| 'stage-gate';

export type LifecycleStateTemplate = {
	key: string;
	label: string;
	terminal?: boolean;
};

export type LifecycleTransitionTemplate = {
	from: string;
	to: string;
	label: string;
	workflowFamily?: WorkflowFamilyKey;
	requiresNote?: boolean;
	tone?: 'default' | 'danger';
};

export type LifecycleTemplateDefinition = {
	pattern: LifecyclePatternKey;
	initialState: string;
	states: LifecycleStateTemplate[];
	transitions: LifecycleTransitionTemplate[];
};

export type WorkflowStarterTemplate = {
	family: WorkflowFamilyKey;
	name: string;
	purpose: string;
};

export type ObjectTypeDefinition = {
	objectType: string;
	name: string;
	functionId: EnterpriseFunctionId;
	functionName: string;
	ownerDomain: string;
	pattern: LifecyclePatternKey;
	description: string;
	featuredStarter: boolean;
	lifecycle: LifecycleTemplateDefinition;
	workflows: WorkflowStarterTemplate[];
};

export type FunctionObjectGroup = {
	functionId: EnterpriseFunctionId;
	functionName: string;
	objects: ObjectTypeDefinition[];
};

const patterns: Record<LifecyclePatternKey, LifecycleTemplateDefinition> = {
	GOV: {
		pattern: 'GOV',
		initialState: 'draft',
		states: [
			{ key: 'draft', label: 'Draft' },
			{ key: 'in_review', label: 'In review' },
			{ key: 'approved', label: 'Approved' },
			{ key: 'superseded', label: 'Superseded', terminal: true },
			{ key: 'retired', label: 'Retired', terminal: true }
		],
		transitions: [
			{ from: 'draft', to: 'in_review', label: 'Submit for review', workflowFamily: 'review' },
			{ from: 'in_review', to: 'approved', label: 'Approve', workflowFamily: 'approval' },
			{
				from: 'in_review',
				to: 'draft',
				label: 'Return for amendment',
				workflowFamily: 'revision',
				requiresNote: true
			},
			{ from: 'approved', to: 'superseded', label: 'Supersede', workflowFamily: 'revision' },
			{
				from: 'approved',
				to: 'retired',
				label: 'Retire',
				workflowFamily: 'closure',
				requiresNote: true
			}
		]
	},
	MASTER: {
		pattern: 'MASTER',
		initialState: 'proposed',
		states: [
			{ key: 'proposed', label: 'Proposed' },
			{ key: 'validated', label: 'Validated' },
			{ key: 'active', label: 'Active' },
			{ key: 'suspended', label: 'Suspended' },
			{ key: 'retired', label: 'Retired', terminal: true }
		],
		transitions: [
			{ from: 'proposed', to: 'validated', label: 'Validate', workflowFamily: 'qualification' },
			{ from: 'validated', to: 'active', label: 'Activate', workflowFamily: 'approval' },
			{
				from: 'active',
				to: 'suspended',
				label: 'Suspend',
				workflowFamily: 'exception',
				requiresNote: true,
				tone: 'danger'
			},
			{
				from: 'suspended',
				to: 'active',
				label: 'Reactivate',
				workflowFamily: 'review',
				requiresNote: true
			},
			{
				from: 'active',
				to: 'retired',
				label: 'Retire',
				workflowFamily: 'closure',
				requiresNote: true
			}
		]
	},
	PLAN: {
		pattern: 'PLAN',
		initialState: 'draft',
		states: [
			{ key: 'draft', label: 'Draft' },
			{ key: 'review', label: 'Review' },
			{ key: 'approved', label: 'Approved' },
			{ key: 'active', label: 'Active' },
			{ key: 'completed', label: 'Completed' },
			{ key: 'closed', label: 'Closed', terminal: true }
		],
		transitions: [
			{ from: 'draft', to: 'review', label: 'Submit for review', workflowFamily: 'review' },
			{ from: 'review', to: 'approved', label: 'Approve plan', workflowFamily: 'approval' },
			{
				from: 'review',
				to: 'draft',
				label: 'Return for amendment',
				workflowFamily: 'revision',
				requiresNote: true
			},
			{ from: 'approved', to: 'active', label: 'Activate plan', workflowFamily: 'execution' },
			{ from: 'active', to: 'completed', label: 'Complete plan', workflowFamily: 'review' },
			{ from: 'completed', to: 'closed', label: 'Close plan', workflowFamily: 'closure' }
		]
	},
	TXN: {
		pattern: 'TXN',
		initialState: 'draft',
		states: [
			{ key: 'draft', label: 'Draft' },
			{ key: 'submitted', label: 'Submitted' },
			{ key: 'approved', label: 'Approved' },
			{ key: 'rejected', label: 'Rejected', terminal: true },
			{ key: 'executed', label: 'Executed' },
			{ key: 'closed', label: 'Closed', terminal: true },
			{ key: 'cancelled', label: 'Cancelled', terminal: true }
		],
		transitions: [
			{ from: 'draft', to: 'submitted', label: 'Submit', workflowFamily: 'review' },
			{ from: 'submitted', to: 'approved', label: 'Approve', workflowFamily: 'approval' },
			{
				from: 'submitted',
				to: 'rejected',
				label: 'Reject',
				workflowFamily: 'approval',
				requiresNote: true,
				tone: 'danger'
			},
			{ from: 'approved', to: 'executed', label: 'Execute', workflowFamily: 'execution' },
			{ from: 'executed', to: 'closed', label: 'Close', workflowFamily: 'closure' },
			{
				from: 'draft',
				to: 'cancelled',
				label: 'Cancel',
				workflowFamily: 'closure',
				requiresNote: true,
				tone: 'danger'
			},
			{
				from: 'approved',
				to: 'cancelled',
				label: 'Cancel approved transaction',
				workflowFamily: 'exception',
				requiresNote: true,
				tone: 'danger'
			}
		]
	},
	CASE: {
		pattern: 'CASE',
		initialState: 'new',
		states: [
			{ key: 'new', label: 'New' },
			{ key: 'triage', label: 'Triage' },
			{ key: 'in_progress', label: 'In progress' },
			{ key: 'pending', label: 'Pending' },
			{ key: 'resolved', label: 'Resolved' },
			{ key: 'closed', label: 'Closed', terminal: true },
			{ key: 'reopened', label: 'Reopened' }
		],
		transitions: [
			{ from: 'new', to: 'triage', label: 'Begin triage', workflowFamily: 'case-resolution' },
			{
				from: 'triage',
				to: 'in_progress',
				label: 'Assign and progress',
				workflowFamily: 'case-resolution'
			},
			{
				from: 'in_progress',
				to: 'pending',
				label: 'Place pending',
				workflowFamily: 'exception',
				requiresNote: true
			},
			{ from: 'pending', to: 'in_progress', label: 'Resume', workflowFamily: 'case-resolution' },
			{ from: 'in_progress', to: 'resolved', label: 'Resolve', workflowFamily: 'case-resolution' },
			{ from: 'resolved', to: 'closed', label: 'Close', workflowFamily: 'closure' },
			{
				from: 'closed',
				to: 'reopened',
				label: 'Reopen',
				workflowFamily: 'exception',
				requiresNote: true
			},
			{
				from: 'reopened',
				to: 'in_progress',
				label: 'Resume reopened case',
				workflowFamily: 'case-resolution'
			}
		]
	},
	RISK: {
		pattern: 'RISK',
		initialState: 'identified',
		states: [
			{ key: 'identified', label: 'Identified' },
			{ key: 'assessed', label: 'Assessed' },
			{ key: 'treatment', label: 'Treatment' },
			{ key: 'monitoring', label: 'Monitoring' },
			{ key: 'accepted', label: 'Accepted' },
			{ key: 'closed', label: 'Closed', terminal: true }
		],
		transitions: [
			{ from: 'identified', to: 'assessed', label: 'Assess', workflowFamily: 'review' },
			{ from: 'assessed', to: 'treatment', label: 'Approve treatment', workflowFamily: 'approval' },
			{
				from: 'treatment',
				to: 'monitoring',
				label: 'Begin monitoring',
				workflowFamily: 'execution'
			},
			{
				from: 'assessed',
				to: 'accepted',
				label: 'Accept risk',
				workflowFamily: 'approval',
				requiresNote: true
			},
			{ from: 'monitoring', to: 'closed', label: 'Close risk', workflowFamily: 'closure' },
			{ from: 'accepted', to: 'closed', label: 'Close accepted risk', workflowFamily: 'closure' }
		]
	},
	WORK: {
		pattern: 'WORK',
		initialState: 'requested',
		states: [
			{ key: 'requested', label: 'Requested' },
			{ key: 'planned', label: 'Planned' },
			{ key: 'scheduled', label: 'Scheduled' },
			{ key: 'in_progress', label: 'In progress' },
			{ key: 'complete', label: 'Complete' },
			{ key: 'accepted', label: 'Accepted' },
			{ key: 'closed', label: 'Closed', terminal: true }
		],
		transitions: [
			{ from: 'requested', to: 'planned', label: 'Plan work', workflowFamily: 'execution' },
			{ from: 'planned', to: 'scheduled', label: 'Schedule work', workflowFamily: 'execution' },
			{ from: 'scheduled', to: 'in_progress', label: 'Start work', workflowFamily: 'execution' },
			{ from: 'in_progress', to: 'complete', label: 'Complete work', workflowFamily: 'execution' },
			{ from: 'complete', to: 'accepted', label: 'Accept work', workflowFamily: 'review' },
			{ from: 'accepted', to: 'closed', label: 'Close work', workflowFamily: 'closure' }
		]
	},
	DOC: {
		pattern: 'DOC',
		initialState: 'draft',
		states: [
			{ key: 'draft', label: 'Draft' },
			{ key: 'review', label: 'Review' },
			{ key: 'approved', label: 'Approved' },
			{ key: 'issued', label: 'Issued' },
			{ key: 'superseded', label: 'Superseded' },
			{ key: 'archived', label: 'Archived', terminal: true }
		],
		transitions: [
			{ from: 'draft', to: 'review', label: 'Submit for review', workflowFamily: 'review' },
			{ from: 'review', to: 'approved', label: 'Approve', workflowFamily: 'approval' },
			{
				from: 'review',
				to: 'draft',
				label: 'Return for revision',
				workflowFamily: 'revision',
				requiresNote: true
			},
			{ from: 'approved', to: 'issued', label: 'Issue', workflowFamily: 'execution' },
			{ from: 'issued', to: 'superseded', label: 'Supersede', workflowFamily: 'revision' },
			{ from: 'superseded', to: 'archived', label: 'Archive', workflowFamily: 'closure' }
		]
	},
	PROJECT: {
		pattern: 'PROJECT',
		initialState: 'proposed',
		states: [
			{ key: 'proposed', label: 'Proposed' },
			{ key: 'approved', label: 'Approved' },
			{ key: 'mobilising', label: 'Mobilising' },
			{ key: 'active', label: 'Active' },
			{ key: 'handover', label: 'Handover' },
			{ key: 'closed', label: 'Closed', terminal: true },
			{ key: 'cancelled', label: 'Cancelled', terminal: true }
		],
		transitions: [
			{ from: 'proposed', to: 'approved', label: 'Approve', workflowFamily: 'approval' },
			{ from: 'approved', to: 'mobilising', label: 'Mobilise', workflowFamily: 'execution' },
			{ from: 'mobilising', to: 'active', label: 'Start delivery', workflowFamily: 'stage-gate' },
			{ from: 'active', to: 'handover', label: 'Enter handover', workflowFamily: 'stage-gate' },
			{ from: 'handover', to: 'closed', label: 'Close', workflowFamily: 'closure' },
			{
				from: 'proposed',
				to: 'cancelled',
				label: 'Cancel proposal',
				workflowFamily: 'closure',
				requiresNote: true,
				tone: 'danger'
			},
			{
				from: 'active',
				to: 'cancelled',
				label: 'Terminate',
				workflowFamily: 'exception',
				requiresNote: true,
				tone: 'danger'
			}
		]
	},
	ASSET: {
		pattern: 'ASSET',
		initialState: 'proposed',
		states: [
			{ key: 'proposed', label: 'Proposed' },
			{ key: 'acquired', label: 'Acquired / created' },
			{ key: 'active', label: 'Active' },
			{ key: 'maintained', label: 'Maintained' },
			{ key: 'suspended', label: 'Suspended' },
			{ key: 'retired', label: 'Retired' },
			{ key: 'disposed', label: 'Disposed', terminal: true }
		],
		transitions: [
			{ from: 'proposed', to: 'acquired', label: 'Acquire / create', workflowFamily: 'approval' },
			{
				from: 'acquired',
				to: 'active',
				label: 'Commission / activate',
				workflowFamily: 'qualification'
			},
			{
				from: 'active',
				to: 'maintained',
				label: 'Complete maintenance',
				workflowFamily: 'execution'
			},
			{ from: 'maintained', to: 'active', label: 'Return to service', workflowFamily: 'review' },
			{
				from: 'active',
				to: 'suspended',
				label: 'Suspend',
				workflowFamily: 'exception',
				requiresNote: true,
				tone: 'danger'
			},
			{ from: 'suspended', to: 'active', label: 'Return to service', workflowFamily: 'review' },
			{
				from: 'active',
				to: 'retired',
				label: 'Retire',
				workflowFamily: 'approval',
				requiresNote: true
			},
			{ from: 'retired', to: 'disposed', label: 'Dispose', workflowFamily: 'closure' }
		]
	},
	EVENT: {
		pattern: 'EVENT',
		initialState: 'recorded',
		states: [
			{ key: 'recorded', label: 'Recorded' },
			{ key: 'corrected', label: 'Corrected', terminal: true },
			{ key: 'voided', label: 'Voided', terminal: true }
		],
		transitions: [
			{
				from: 'recorded',
				to: 'corrected',
				label: 'Record correction',
				workflowFamily: 'review',
				requiresNote: true
			},
			{
				from: 'recorded',
				to: 'voided',
				label: 'Void record',
				workflowFamily: 'approval',
				requiresNote: true,
				tone: 'danger'
			}
		]
	}
};

const defaultWorkflows: Record<LifecyclePatternKey, WorkflowStarterTemplate[]> = {
	GOV: [
		{
			family: 'approval',
			name: 'Review and approval',
			purpose: 'Review the governed definition and record an attributable approval decision.'
		},
		{
			family: 'revision',
			name: 'Controlled revision',
			purpose:
				'Assess, amend and reapprove a controlled revision without overwriting published evidence.'
		}
	],
	MASTER: [
		{
			family: 'qualification',
			name: 'Validate and activate',
			purpose: 'Validate the master record before controlled activation.'
		},
		{
			family: 'exception',
			name: 'Suspend or reinstate',
			purpose: 'Govern exceptional suspension, remediation and reinstatement.'
		}
	],
	PLAN: [
		{
			family: 'approval',
			name: 'Plan approval',
			purpose: 'Review and approve the plan before activation.'
		},
		{
			family: 'periodic-review',
			name: 'Plan review',
			purpose: 'Review progress, evidence and corrective actions.'
		},
		{
			family: 'closure',
			name: 'Plan closure',
			purpose: 'Confirm completion and close the plan with evidence.'
		}
	],
	TXN: [
		{
			family: 'approval',
			name: 'Transaction approval',
			purpose: 'Review and approve the transaction before execution.'
		},
		{
			family: 'exception',
			name: 'Transaction exception',
			purpose: 'Resolve rejection, cancellation or execution exceptions.'
		}
	],
	CASE: [
		{
			family: 'case-resolution',
			name: 'Case resolution',
			purpose: 'Triage, assign, resolve and verify the case.'
		},
		{
			family: 'exception',
			name: 'Case escalation',
			purpose: 'Escalate blocked, overdue or high-risk cases.'
		}
	],
	RISK: [
		{
			family: 'review',
			name: 'Assessment and treatment review',
			purpose: 'Assess exposure and agree treatment or acceptance.'
		},
		{
			family: 'periodic-review',
			name: 'Risk monitoring review',
			purpose: 'Review risk evidence, treatment progress and residual exposure.'
		}
	],
	WORK: [
		{
			family: 'execution',
			name: 'Work execution',
			purpose: 'Plan, execute, verify and accept controlled work.'
		},
		{
			family: 'exception',
			name: 'Work exception',
			purpose: 'Resolve blocked, failed or overdue work.'
		}
	],
	DOC: [
		{
			family: 'approval',
			name: 'Document review and approval',
			purpose: 'Review and approve controlled information before issue.'
		},
		{
			family: 'revision',
			name: 'Controlled document revision',
			purpose: 'Revise issued information without losing version history.'
		}
	],
	PROJECT: [
		{
			family: 'stage-gate',
			name: 'Stage-gate review',
			purpose: 'Review evidence and authorise progression through delivery gates.'
		},
		{
			family: 'revision',
			name: 'Change control',
			purpose: 'Assess, approve and implement controlled delivery change.'
		},
		{
			family: 'closure',
			name: 'Delivery closure',
			purpose: 'Confirm handover, acceptance and controlled closure.'
		}
	],
	ASSET: [
		{
			family: 'qualification',
			name: 'Commission and activate',
			purpose: 'Verify readiness and place the asset into controlled service.'
		},
		{
			family: 'execution',
			name: 'Maintain or change asset',
			purpose: 'Plan, execute and verify controlled asset work.'
		},
		{
			family: 'closure',
			name: 'Retire and dispose',
			purpose: 'Authorise retirement, decommissioning and disposal.'
		}
	],
	EVENT: [
		{
			family: 'review',
			name: 'Evidence correction review',
			purpose: 'Review a proposed correction or void while preserving immutable evidence.'
		}
	]
};

const featuredObjects = new Set([
	'strategy.strategy-cycle',
	'governance.decision',
	'sales.opportunity',
	'commercial.contract',
	'procurement.supplier',
	'procurement.requisition',
	'procurement.purchase-order',
	'finance.supplier-invoice',
	'supply.material',
	'project.project',
	'project.change-request',
	'information.document',
	'quality.non-conformance',
	'risk.risk',
	'people.employment',
	'asset.physical-asset',
	'maintenance.work-order',
	'process.process'
]);

const workflowOverrides: Record<string, WorkflowStarterTemplate[]> = {
	'strategy.strategy-cycle': [
		{
			family: 'approval',
			name: 'Strategy approval',
			purpose:
				'Review strategic direction, objective lineage and approve a governed strategy major version.'
		},
		{
			family: 'periodic-review',
			name: 'Strategic review',
			purpose:
				'Freeze evidence, conduct executive review and assign governed decisions and corrective actions.'
		},
		{
			family: 'revision',
			name: 'Controlled strategy revision',
			purpose:
				'Create and govern the next strategy revision without overwriting published evidence.'
		}
	],
	'governance.decision': [
		{
			family: 'approval',
			name: 'Governance decision',
			purpose:
				'Prepare a decision, confirm authority and quorum, record the outcome and assign actions.'
		}
	],
	'sales.opportunity': [
		{
			family: 'stage-gate',
			name: 'Opportunity stage gate',
			purpose:
				'Qualify the opportunity and govern progression through pursuit, proposal and negotiation.'
		}
	],
	'commercial.contract': [
		{
			family: 'approval',
			name: 'Contract approval',
			purpose: 'Coordinate commercial and legal review before controlled execution.'
		},
		{
			family: 'revision',
			name: 'Contract amendment',
			purpose: 'Assess, approve and execute a controlled contract amendment.'
		}
	],
	'procurement.supplier': [
		{
			family: 'qualification',
			name: 'Supplier qualification',
			purpose: 'Perform due diligence, approve onboarding and activate the supplier.'
		},
		{
			family: 'exception',
			name: 'Supplier suspension and reinstatement',
			purpose: 'Govern supplier restriction, remediation and reinstatement.'
		}
	],
	'procurement.requisition': [
		{
			family: 'approval',
			name: 'Requisition approval',
			purpose: 'Validate demand, budget and authority before procurement commitment.'
		}
	],
	'procurement.purchase-order': [
		{
			family: 'approval',
			name: 'Purchase order approval',
			purpose: 'Review commercial commitment and approve issue to the supplier.'
		},
		{
			family: 'revision',
			name: 'Purchase order amendment',
			purpose: 'Assess and approve controlled changes to an issued purchase order.'
		},
		{
			family: 'exception',
			name: 'Purchase order exception',
			purpose: 'Resolve cancellation, fulfilment and commercial exceptions.'
		}
	],
	'finance.supplier-invoice': [
		{
			family: 'approval',
			name: 'Supplier invoice approval',
			purpose: 'Validate, match and approve the supplier invoice before posting and payment.'
		},
		{
			family: 'exception',
			name: 'Invoice exception resolution',
			purpose: 'Resolve match, tax, coding or approval exceptions without losing evidence.'
		}
	],
	'supply.material': [
		{
			family: 'qualification',
			name: 'Material master approval',
			purpose: 'Validate classification, units, controls and activate the material master.'
		},
		{
			family: 'revision',
			name: 'Material master change',
			purpose: 'Govern controlled amendments to active material data.'
		}
	],
	'project.project': [
		{
			family: 'approval',
			name: 'Project approval',
			purpose: 'Approve initiation, mandate, ownership and initial delivery controls.'
		},
		{
			family: 'stage-gate',
			name: 'Project stage-gate review',
			purpose: 'Review readiness and evidence before progression through delivery and handover.'
		},
		{
			family: 'closure',
			name: 'Project closure',
			purpose: 'Confirm technical, commercial and information closeout before final closure.'
		}
	],
	'project.change-request': [
		{
			family: 'revision',
			name: 'Project change control',
			purpose: 'Assess impact, obtain authority and govern implementation of project change.'
		}
	],
	'information.document': [
		{
			family: 'approval',
			name: 'Document review and approval',
			purpose: 'Coordinate review, approval and controlled issue.'
		},
		{
			family: 'revision',
			name: 'Document revision',
			purpose: 'Revise issued information while preserving the superseded record.'
		}
	],
	'quality.non-conformance': [
		{
			family: 'case-resolution',
			name: 'NCR resolution',
			purpose: 'Contain, investigate, disposition and verify a non-conformance.'
		},
		{
			family: 'execution',
			name: 'Corrective action',
			purpose: 'Implement and verify corrective or preventive action.'
		}
	],
	'risk.risk': [
		{
			family: 'review',
			name: 'Risk assessment and treatment',
			purpose: 'Assess exposure, agree response and assign treatment.'
		},
		{
			family: 'periodic-review',
			name: 'Risk review',
			purpose: 'Review residual risk, treatment effectiveness and escalation.'
		}
	],
	'people.employment': [
		{
			family: 'approval',
			name: 'Employment approval',
			purpose: 'Approve employment or engagement before activation.'
		},
		{
			family: 'revision',
			name: 'Employment change',
			purpose: 'Govern changes to employment terms, position or status.'
		},
		{
			family: 'closure',
			name: 'Employment offboarding',
			purpose: 'Coordinate controlled exit, access removal and final obligations.'
		}
	],
	'asset.physical-asset': [
		{
			family: 'qualification',
			name: 'Asset commissioning',
			purpose: 'Verify installation, testing and handover before placing the asset into service.'
		},
		{
			family: 'execution',
			name: 'Asset maintenance',
			purpose: 'Plan, execute and verify controlled maintenance.'
		},
		{
			family: 'closure',
			name: 'Asset retirement and disposal',
			purpose: 'Approve retirement, decommissioning and final disposal.'
		}
	],
	'maintenance.work-order': [
		{
			family: 'execution',
			name: 'Maintenance work execution',
			purpose: 'Plan, schedule, execute and evidence maintenance work.'
		},
		{
			family: 'review',
			name: 'Maintenance acceptance',
			purpose: 'Verify completion and return the asset or facility to service.'
		}
	],
	'process.process': [
		{
			family: 'approval',
			name: 'Process approval',
			purpose: 'Review and approve the governed enterprise process before publication.'
		},
		{
			family: 'revision',
			name: 'Process change control',
			purpose: 'Assess and implement controlled process redesign.'
		},
		{
			family: 'periodic-review',
			name: 'Process performance review',
			purpose: 'Review compliance, performance and improvement actions.'
		}
	]
};

type SeedObject = [objectType: string, name: string, pattern: LifecyclePatternKey];
type FunctionSeed = {
	functionId: EnterpriseFunctionId;
	ownerDomain: string;
	objects: SeedObject[];
};

const seeds: FunctionSeed[] = [
	{
		functionId: 'F01',
		ownerDomain: 'D8',
		objects: [
			['strategy.strategy-cycle', 'Strategy cycle / framework', 'GOV'],
			['strategy.business-plan', 'Business plan', 'PLAN'],
			['strategy.initiative', 'Strategic initiative', 'PROJECT'],
			['strategy.kpi-definition', 'Strategic KPI definition', 'GOV'],
			['strategy.strategic-review', 'Strategic review', 'GOV'],
			['strategy.scenario', 'Strategy scenario', 'GOV']
		]
	},
	{
		functionId: 'F02',
		ownerDomain: 'D1',
		objects: [
			['governance.framework', 'Governance framework', 'GOV'],
			['governance.body', 'Governance body', 'MASTER'],
			['governance.meeting', 'Governance meeting', 'TXN'],
			['governance.decision', 'Governance decision', 'TXN'],
			['governance.policy', 'Governed policy', 'DOC'],
			['governance.ethics-case', 'Ethics / conduct case', 'CASE']
		]
	},
	{
		functionId: 'F03',
		ownerDomain: 'D8',
		objects: [
			['performance.framework', 'Performance framework', 'GOV'],
			['performance.reporting-pack', 'Performance reporting pack', 'GOV'],
			['performance.variance-case', 'Performance variance case', 'CASE'],
			['performance.benefit', 'Benefit', 'PLAN']
		]
	},
	{
		functionId: 'F04',
		ownerDomain: 'D8',
		objects: [
			['corporate-development.opportunity', 'Corporate-development opportunity', 'CASE'],
			['corporate-development.valuation-case', 'Valuation / investment case', 'GOV'],
			['corporate-development.due-diligence', 'Due-diligence case', 'PROJECT'],
			['corporate-development.transaction', 'Corporate transaction', 'PROJECT'],
			['corporate-development.integration-plan', 'Integration / separation plan', 'PLAN'],
			['corporate-development.partnership', 'Strategic partnership', 'MASTER']
		]
	},
	{
		functionId: 'F05',
		ownerDomain: 'D6',
		objects: [
			['product-service.offering', 'Product / service offering', 'ASSET'],
			['product-service.business-case', 'Product / service business case', 'GOV'],
			['product-service.design', 'Product / service design', 'DOC'],
			['product-service.launch', 'Launch plan', 'PLAN'],
			['product-service.lifecycle-review', 'Offering lifecycle review', 'GOV'],
			['product-service.retirement', 'Offering retirement plan', 'PLAN'],
			['innovation.experiment', 'Innovation experiment', 'CASE']
		]
	},
	{
		functionId: 'F06',
		ownerDomain: 'D2',
		objects: [
			['marketing.market-insight', 'Market insight', 'GOV'],
			['marketing.customer-segment', 'Customer segment', 'MASTER'],
			['marketing.brand', 'Brand', 'MASTER'],
			['marketing.plan', 'Marketing plan', 'PLAN'],
			['marketing.campaign', 'Marketing campaign', 'PLAN'],
			['marketing.content', 'Marketing content asset', 'DOC'],
			['marketing.event', 'Marketing event', 'PLAN'],
			['marketing.lead', 'Marketing lead', 'CASE']
		]
	},
	{
		functionId: 'F07',
		ownerDomain: 'D2',
		objects: [
			['sales.account-plan', 'Account plan', 'PLAN'],
			['sales.opportunity', 'Sales opportunity', 'CASE'],
			['estimating.estimate', 'Estimate', 'GOV'],
			['sales.quotation', 'Quotation', 'TXN'],
			['sales.bid', 'Bid / tender', 'PROJECT'],
			['sales.proposal', 'Proposal', 'DOC'],
			['commercial.contract', 'Contract / agreement', 'GOV'],
			['sales.order', 'Sales order', 'TXN'],
			['sales.forecast', 'Sales forecast', 'GOV']
		]
	},
	{
		functionId: 'F08',
		ownerDomain: 'D17',
		objects: [
			['customer.onboarding', 'Customer onboarding', 'WORK'],
			['customer.service-case', 'Customer service case', 'CASE'],
			['customer.complaint', 'Customer complaint', 'CASE'],
			['customer.support-ticket', 'Technical-support ticket', 'CASE'],
			['customer.return', 'Customer return', 'TXN'],
			['customer.warranty-claim', 'Warranty claim', 'CASE'],
			['customer.success-plan', 'Customer success plan', 'PLAN'],
			['customer.service-entitlement', 'Service entitlement / SLA', 'GOV']
		]
	},
	{
		functionId: 'F09',
		ownerDomain: 'D9',
		objects: [
			['procurement.strategy', 'Procurement strategy', 'GOV'],
			['procurement.category', 'Procurement category', 'MASTER'],
			['procurement.supplier', 'Supplier', 'MASTER'],
			['procurement.sourcing-event', 'Sourcing event', 'PROJECT'],
			['procurement.rfq', 'RFQ / RFP', 'TXN'],
			['procurement.requisition', 'Purchase requisition', 'TXN'],
			['procurement.purchase-order', 'Purchase order', 'TXN'],
			['procurement.supplier-performance-review', 'Supplier performance review', 'GOV'],
			['procurement.supplier-risk', 'Supplier risk', 'RISK']
		]
	},
	{
		functionId: 'F10',
		ownerDomain: 'D10',
		objects: [
			['supply.demand-plan', 'Demand plan', 'PLAN'],
			['supply.supply-plan', 'Supply plan', 'PLAN'],
			['supply.material', 'Material / item master', 'MASTER'],
			['warehouse.warehouse', 'Warehouse', 'ASSET'],
			['inventory.stock-lot', 'Stock lot / batch', 'ASSET'],
			['inventory.goods-movement', 'Goods movement', 'EVENT'],
			['logistics.transport-order', 'Transport order', 'WORK'],
			['logistics.shipment', 'Shipment', 'WORK'],
			['logistics.trade-declaration', 'Import / export declaration', 'TXN'],
			['supply.supply-chain-risk', 'Supply-chain risk', 'RISK']
		]
	},
	{
		functionId: 'F11',
		ownerDomain: 'D11',
		objects: [
			['production.bill-of-materials', 'Bill of materials', 'GOV'],
			['production.routing', 'Production routing / process plan', 'GOV'],
			['production.work-centre', 'Work centre', 'MASTER'],
			['production.plan', 'Production plan', 'PLAN'],
			['production.order', 'Production order', 'WORK'],
			['production.batch', 'Production batch / lot', 'ASSET'],
			['production.process-control', 'Process-control record', 'EVENT'],
			['production.capacity-plan', 'Production capacity plan', 'PLAN'],
			['production.lean-improvement', 'Lean improvement', 'CASE']
		]
	},
	{
		functionId: 'F12',
		ownerDomain: 'D17',
		objects: [
			['service.plan', 'Service delivery plan', 'PLAN'],
			['service.request', 'Service request', 'CASE'],
			['service.work-order', 'Service work order', 'WORK'],
			['service.appointment', 'Service appointment', 'TXN'],
			['service.dispatch', 'Resource dispatch', 'WORK'],
			['service.field-visit', 'Field visit', 'WORK'],
			['service.professional-engagement', 'Professional-services engagement', 'PROJECT'],
			['service.acceptance', 'Service acceptance', 'TXN'],
			['service.quality-issue', 'Service quality issue', 'CASE']
		]
	},
	{
		functionId: 'F13',
		ownerDomain: 'D14',
		objects: [
			['quality.quality-plan', 'Quality plan', 'PLAN'],
			['quality.itp', 'Inspection and test plan', 'PLAN'],
			['quality.inspection', 'Inspection', 'WORK'],
			['quality.test', 'Test', 'WORK'],
			['quality.non-conformance', 'Non-conformance report', 'CASE'],
			['quality.capa', 'Corrective / preventive action', 'WORK'],
			['quality.supplier-quality-issue', 'Supplier quality issue', 'CASE'],
			['quality.certificate', 'Quality certificate / record', 'DOC'],
			['quality.improvement-opportunity', 'Quality improvement opportunity', 'CASE']
		]
	},
	{
		functionId: 'F14',
		ownerDomain: 'D7',
		objects: [
			['finance.budget', 'Budget', 'GOV'],
			['finance.forecast', 'Financial forecast', 'GOV'],
			['finance.journal', 'Journal', 'TXN'],
			['finance.supplier-invoice', 'Supplier invoice', 'TXN'],
			['finance.customer-invoice', 'Customer invoice', 'TXN'],
			['finance.credit-case', 'Credit case', 'CASE'],
			['finance.collection-case', 'Collection case', 'CASE'],
			['finance.expense-claim', 'Expense claim', 'TXN'],
			['finance.fixed-asset', 'Fixed asset', 'ASSET'],
			['finance.close-cycle', 'Financial close cycle', 'PLAN'],
			['finance.consolidation-run', 'Consolidation run', 'WORK'],
			['finance.payment', 'Payment', 'TXN'],
			['finance.bank-reconciliation', 'Bank reconciliation', 'WORK'],
			['finance.tax-return', 'Tax return', 'GOV'],
			['finance.capex-request', 'Capital expenditure request', 'TXN']
		]
	},
	{
		functionId: 'F15',
		ownerDomain: 'D12',
		objects: [
			['people.workforce-plan', 'Workforce plan', 'PLAN'],
			['people.organisation-unit', 'Organisation unit', 'MASTER'],
			['people.position', 'Position', 'MASTER'],
			['people.job-profile', 'Job profile', 'GOV'],
			['people.vacancy', 'Vacancy / recruitment requisition', 'TXN'],
			['people.candidate', 'Candidate', 'CASE'],
			['people.employment', 'Employment / engagement', 'MASTER'],
			['people.onboarding-plan', 'Employee onboarding plan', 'WORK'],
			['people.timesheet', 'Timesheet', 'TXN'],
			['people.payroll-run', 'Payroll run', 'WORK'],
			['people.compensation-review', 'Compensation review', 'GOV'],
			['people.performance-review', 'Employee performance review', 'GOV'],
			['people.learning-plan', 'Learning / development plan', 'PLAN'],
			['people.employee-relations-case', 'Employee-relations case', 'CASE'],
			['people.absence-request', 'Absence / leave request', 'TXN'],
			['people.offboarding', 'Offboarding', 'WORK']
		]
	},
	{
		functionId: 'F16',
		ownerDomain: 'D19',
		objects: [
			['it.strategy', 'IT strategy', 'GOV'],
			['it.architecture-decision', 'Architecture decision', 'GOV'],
			['it.technology-service', 'Application / technology service', 'ASSET'],
			['it.deployment', 'Deployment', 'TXN'],
			['it.infrastructure-resource', 'Infrastructure / cloud resource', 'ASSET'],
			['it.endpoint', 'Endpoint', 'ASSET'],
			['it.identity-account', 'Identity / account', 'MASTER'],
			['it.service-request', 'IT service request', 'CASE'],
			['it.incident', 'IT incident', 'CASE'],
			['it.problem', 'IT problem', 'CASE'],
			['it.change-request', 'IT change request', 'TXN'],
			['it.release', 'IT release', 'PLAN'],
			['it.configuration-item', 'Configuration item', 'MASTER'],
			['it.asset', 'IT asset', 'ASSET'],
			['it.disaster-recovery-plan', 'Disaster-recovery plan', 'GOV']
		]
	},
	{
		functionId: 'F17',
		ownerDomain: 'D19',
		objects: [
			['data.policy', 'Data policy / standard', 'GOV'],
			['data.domain', 'Data domain', 'MASTER'],
			['data.product', 'Data product / dataset', 'ASSET'],
			['data.reference-dataset', 'Reference dataset', 'GOV'],
			['data.quality-rule', 'Data-quality rule', 'GOV'],
			['data.quality-issue', 'Data-quality issue', 'CASE'],
			['data.pipeline', 'Data pipeline', 'ASSET'],
			['analytics.report', 'Report / dashboard', 'GOV'],
			['analytics.model', 'Analytical model', 'GOV'],
			['ai.use-case', 'AI use case', 'CASE'],
			['ai.model', 'AI / ML model', 'ASSET'],
			['ai.risk-assessment', 'AI risk assessment', 'RISK'],
			['data.access-request', 'Data access request', 'TXN'],
			['data.retention-rule', 'Data-retention rule', 'GOV']
		]
	},
	{
		functionId: 'F18',
		ownerDomain: 'D14',
		objects: [
			['security.policy', 'Security policy / standard', 'GOV'],
			['security.privileged-access-request', 'Privileged-access request', 'TXN'],
			['security.vulnerability', 'Vulnerability', 'RISK'],
			['security.patch-campaign', 'Patch campaign', 'WORK'],
			['security.alert', 'Security alert', 'CASE'],
			['security.incident', 'Security incident', 'CASE'],
			['security.threat-intelligence', 'Threat-intelligence item', 'EVENT'],
			['security.penetration-test', 'Penetration test', 'PLAN'],
			['security.finding', 'Security finding', 'RISK'],
			['security.third-party-assessment', 'Third-party security assessment', 'GOV'],
			['security.awareness-campaign', 'Security-awareness campaign', 'PLAN'],
			['security.compliance-assessment', 'Security-compliance assessment', 'GOV']
		]
	},
	{
		functionId: 'F19',
		ownerDomain: 'D4',
		objects: [
			['legal.matter', 'Legal matter', 'CASE'],
			['legal.advice-request', 'Legal-advice request', 'CASE'],
			['legal.contract-obligation', 'Contract obligation', 'WORK'],
			['legal.corporate-entity', 'Corporate entity record', 'MASTER'],
			['legal.statutory-filing', 'Statutory filing', 'TXN'],
			['legal.intellectual-property', 'Intellectual-property asset', 'ASSET'],
			['legal.dispute', 'Litigation / dispute', 'CASE'],
			['legal.regulatory-matter', 'Regulatory legal matter', 'CASE'],
			['legal.legal-hold', 'Legal hold', 'GOV'],
			['legal.ediscovery', 'eDiscovery collection', 'WORK'],
			['legal.obligation', 'Legal obligation', 'GOV']
		]
	},
	{
		functionId: 'F20',
		ownerDomain: 'D14',
		objects: [
			['risk.framework', 'Risk framework', 'GOV'],
			['risk.risk', 'Enterprise / operational risk', 'RISK'],
			['risk.assessment', 'Risk assessment', 'GOV'],
			['risk.treatment-plan', 'Risk treatment plan', 'PLAN'],
			['compliance.regulatory-obligation', 'Regulatory obligation', 'GOV'],
			['compliance.assessment', 'Compliance assessment', 'GOV'],
			['control.control', 'Internal control', 'GOV'],
			['control.test', 'Control test', 'WORK'],
			['audit.plan', 'Internal audit plan', 'PLAN'],
			['audit.engagement', 'Audit engagement', 'PROJECT'],
			['audit.finding', 'Audit finding', 'CASE'],
			['audit.remediation-action', 'Remediation action', 'WORK'],
			['risk.fraud-case', 'Fraud case', 'CASE'],
			['risk.conduct-case', 'Conduct case', 'CASE']
		]
	},
	{
		functionId: 'F21',
		ownerDomain: 'D14',
		objects: [
			['privacy.policy', 'Privacy framework / policy', 'GOV'],
			['privacy.processing-activity', 'Processing activity', 'MASTER'],
			['privacy.dpia', 'Data-protection impact assessment', 'GOV'],
			['privacy.consent', 'Consent / preference record', 'EVENT'],
			['privacy.data-subject-request', 'Data-subject rights request', 'CASE'],
			['privacy.incident', 'Privacy incident / breach', 'CASE'],
			['privacy.international-transfer', 'International data transfer', 'GOV'],
			['privacy.assurance-review', 'Privacy assurance review', 'GOV']
		]
	},
	{
		functionId: 'F22',
		ownerDomain: 'D16',
		objects: [
			['asset.strategy', 'Asset / property strategy', 'GOV'],
			['asset.capital-plan', 'Capital plan', 'PLAN'],
			['property.property', 'Property', 'ASSET'],
			['property.facility', 'Facility / building', 'ASSET'],
			['property.space', 'Space', 'MASTER'],
			['property.lease', 'Lease', 'GOV'],
			['asset.physical-asset', 'Physical asset', 'ASSET'],
			['maintenance.plan', 'Maintenance plan', 'PLAN'],
			['maintenance.work-order', 'Maintenance work order', 'WORK'],
			['asset.condition-assessment', 'Condition assessment', 'GOV'],
			['facilities.request', 'Facilities request', 'CASE'],
			['property.utility-meter', 'Utility meter / account', 'MASTER'],
			['asset.disposal', 'Asset disposal', 'TXN']
		]
	},
	{
		functionId: 'F23',
		ownerDomain: 'D14',
		objects: [
			['hse.management-plan', 'H&S / environmental management plan', 'PLAN'],
			['hse.hazard', 'Hazard', 'RISK'],
			['hse.rams', 'RAMS / task risk assessment', 'GOV'],
			['hse.workplace-inspection', 'Workplace inspection', 'WORK'],
			['hse.incident', 'H&S incident', 'CASE'],
			['hse.occupational-health-case', 'Occupational-health case', 'CASE'],
			['hse.permit-to-work', 'Permit to work', 'TXN'],
			['environment.aspect-impact', 'Environmental aspect / impact', 'RISK'],
			['environment.incident', 'Environmental incident', 'CASE'],
			['environment.waste-consignment', 'Waste consignment', 'TXN'],
			['sustainability.carbon-inventory', 'Carbon inventory', 'GOV'],
			['sustainability.energy-plan', 'Energy plan', 'PLAN'],
			['sustainability.target', 'Sustainability target', 'GOV'],
			['sustainability.esg-report', 'ESG report / disclosure', 'DOC'],
			['environment.permit', 'Environmental permit / obligation', 'GOV']
		]
	},
	{
		functionId: 'F24',
		ownerDomain: 'D14',
		objects: [
			['continuity.framework', 'Business-continuity framework', 'GOV'],
			['continuity.business-impact-assessment', 'Business-impact assessment', 'GOV'],
			['continuity.plan', 'Business-continuity plan', 'GOV'],
			['continuity.exercise', 'Continuity exercise', 'PLAN'],
			['crisis.crisis', 'Crisis', 'CASE'],
			['crisis.emergency-event', 'Emergency event', 'CASE'],
			['crisis.communication', 'Crisis communication', 'DOC'],
			['continuity.disaster-recovery-invocation', 'Disaster-recovery invocation', 'CASE'],
			['physical-security.zone', 'Physical-security zone / site', 'MASTER'],
			['physical-security.visitor-pass', 'Visitor request / pass', 'TXN'],
			['physical-security.incident', 'Physical-security incident', 'CASE'],
			['security.travel-risk-assessment', 'Travel-risk assessment', 'GOV']
		]
	},
	{
		functionId: 'F25',
		ownerDomain: 'D2',
		objects: [
			['communications.plan', 'Communications plan', 'PLAN'],
			['communications.item', 'Communication item', 'DOC'],
			['communications.media-enquiry', 'Media enquiry', 'CASE'],
			['communications.media-release', 'Media release / statement', 'DOC'],
			['communications.pr-campaign', 'PR campaign', 'PLAN'],
			['communications.reputation-issue', 'Reputation issue', 'RISK'],
			['communications.public-affairs-issue', 'Public-affairs issue', 'CASE'],
			['communications.investor-engagement', 'Investor engagement', 'PLAN'],
			['communications.annual-report', 'Annual report', 'DOC'],
			['communications.stakeholder-engagement-plan', 'Stakeholder-engagement plan', 'PLAN']
		]
	},
	{
		functionId: 'F26',
		ownerDomain: 'D6',
		objects: [
			['knowledge.article', 'Knowledge article', 'DOC'],
			['knowledge.collection', 'Knowledge collection', 'MASTER'],
			['information.document', 'Controlled document / information container', 'DOC'],
			['information.transmittal', 'Information transmittal', 'TXN'],
			['records.record', 'Declared record', 'DOC'],
			['records.record-series', 'Record series / file', 'MASTER'],
			['records.retention-schedule', 'Retention schedule', 'GOV'],
			['records.disposition-request', 'Record disposition request', 'TXN'],
			['knowledge.lesson-learned', 'Lesson learned', 'GOV']
		]
	},
	{
		functionId: 'F27',
		ownerDomain: 'D5',
		objects: [
			['portfolio.portfolio', 'Portfolio', 'GOV'],
			['portfolio.investment-proposal', 'Investment proposal', 'TXN'],
			['programme.programme', 'Programme', 'PROJECT'],
			['project.project', 'Project', 'PROJECT'],
			['project.charter', 'Project charter', 'GOV'],
			['project.wbs-element', 'WBS element', 'PLAN'],
			['project.schedule', 'Project schedule', 'GOV'],
			['project.baseline', 'Project baseline', 'GOV'],
			['project.resource-requirement', 'Project resource requirement', 'TXN'],
			['project.risk', 'Project risk', 'RISK'],
			['project.issue', 'Project issue', 'CASE'],
			['project.change-request', 'Project change request', 'TXN'],
			['project.status-report', 'Project status report', 'GOV'],
			['project.gate-review', 'Project gate review', 'GOV'],
			['project.handover', 'Project handover', 'WORK'],
			['project.closure', 'Project closure', 'GOV']
		]
	},
	{
		functionId: 'F28',
		ownerDomain: 'D5',
		objects: [
			['transformation.portfolio', 'Transformation portfolio', 'GOV'],
			['transformation.initiative', 'Transformation initiative', 'PROJECT'],
			['change.impact-assessment', 'Change-impact assessment', 'GOV'],
			['change.stakeholder-group', 'Change stakeholder group', 'MASTER'],
			['change.action', 'Change action', 'WORK'],
			['change.communication', 'Change communication', 'DOC'],
			['change.readiness-plan', 'Training / readiness plan', 'PLAN'],
			['change.readiness-assessment', 'Readiness assessment', 'GOV'],
			['change.adoption-intervention', 'Adoption intervention', 'WORK'],
			['change.organisation-transition', 'Organisation transition', 'PLAN']
		]
	},
	{
		functionId: 'F29',
		ownerDomain: 'D19',
		objects: [
			['process.architecture', 'Process architecture', 'GOV'],
			['process.process', 'Enterprise process', 'GOV'],
			['process.model', 'Process model / version', 'GOV'],
			['process.owner-assignment', 'Process-owner assignment', 'TXN'],
			['process.measure', 'Process measure / KPI', 'GOV'],
			['process.analysis', 'Process analysis', 'GOV'],
			['process.improvement-opportunity', 'Process improvement opportunity', 'CASE'],
			['process.redesign-proposal', 'Process redesign proposal', 'GOV'],
			['process.sop', 'Standard operating procedure', 'DOC'],
			['process.compliance-assessment', 'Process-compliance assessment', 'GOV'],
			['process.improvement-initiative', 'Continuous-improvement initiative', 'PROJECT'],
			['process.performance-review', 'Process-performance review', 'GOV']
		]
	}
];

function cloneLifecycle(pattern: LifecyclePatternKey): LifecycleTemplateDefinition {
	const source = patterns[pattern];
	return {
		pattern: source.pattern,
		initialState: source.initialState,
		states: source.states.map((state) => ({ ...state })),
		transitions: source.transitions.map((transition) => ({ ...transition }))
	};
}

function workflowPurpose(objectName: string, starter: WorkflowStarterTemplate): string {
	return `${starter.purpose} Applies to the ${objectName.toLowerCase()} object.`;
}

const functionNames = new Map(enterpriseFunctions.map((entry) => [entry.id, entry.name]));

export const objectTypeRegistry: readonly ObjectTypeDefinition[] = seeds.flatMap((seed) => {
	const functionName = functionNames.get(seed.functionId) ?? seed.functionId;
	return seed.objects.map(([objectType, name, pattern]) => ({
		objectType,
		name,
		functionId: seed.functionId,
		functionName,
		ownerDomain: seed.ownerDomain,
		pattern,
		description: `Canonical ${name.toLowerCase()} object for ${functionName}.`,
		featuredStarter: featuredObjects.has(objectType),
		lifecycle: cloneLifecycle(pattern),
		workflows: (workflowOverrides[objectType] ?? defaultWorkflows[pattern]).map((workflow) => ({
			...workflow,
			purpose: workflowPurpose(name, workflow)
		}))
	}));
});

export const functionObjectRegistry: readonly FunctionObjectGroup[] = enterpriseFunctions.map(
	(entry) => ({
		functionId: entry.id,
		functionName: entry.name,
		objects: objectTypeRegistry.filter((object) => object.functionId === entry.id)
	})
);

export const featuredObjectTemplates: readonly ObjectTypeDefinition[] = objectTypeRegistry.filter(
	(object) => object.featuredStarter
);

export function getObjectTypeDefinition(objectType: string): ObjectTypeDefinition | null {
	return objectTypeRegistry.find((object) => object.objectType === objectType) ?? null;
}

export function lifecycleTemplateKey(objectType: string): string {
	return `library.${objectType}.lifecycle`;
}

export function workflowTemplateKey(objectType: string, family: WorkflowFamilyKey): string {
	return `library.${objectType}.${family}`;
}

export function lifecyclePattern(pattern: LifecyclePatternKey): LifecycleTemplateDefinition {
	return cloneLifecycle(pattern);
}
