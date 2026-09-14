export type WorkflowTemplateStatus = 'draft' | 'published' | 'superseded';
export type WorkflowExecutionState =
	| 'not_started'
	| 'running'
	| 'suspended'
	| 'completed'
	| 'terminated'
	| 'aborted';
export type WorkflowHealth = 'green' | 'amber' | 'red';

export type WorkflowNodeType =
	| 'start'
	| 'activity'
	| 'ad_hoc_activity'
	| 'subprocess'
	| 'block'
	| 'and'
	| 'or'
	| 'threshold'
	| 'conditional'
	| 'notification'
	| 'timer'
	| 'checkpoint'
	| 'service'
	| 'synchronize'
	| 'integration'
	| 'end';

export type WorkflowParticipantType =
	| 'member'
	| 'team'
	| 'organisation_role'
	| 'lifecycle_role'
	| 'workflow_role'
	| 'actor'
	| 'variable';

export type WorkflowCompletionRule =
	| { type: 'any' }
	| { type: 'all' }
	| { type: 'count'; count: number };

export type WorkflowParticipantRule = {
	participantType: WorkflowParticipantType;
	participantKey: string;
	required?: boolean;
};

export type WorkflowVariableDefinition = {
	key: string;
	type: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'object_reference';
	scope: 'process' | 'node';
	visible?: boolean;
	required?: boolean;
	readOnly?: boolean;
	resettable?: boolean;
	defaultValue?: unknown;
};

export type WorkflowDeadline = {
	minutes: number;
	relativeTo: 'node_start' | 'process_start';
	overdueAction?: 'notify' | 'reassign' | 'skip' | 'complete' | 'escalate' | 'block';
	responsibleRoleKey?: string;
	notifyRoleKeys?: readonly string[];
};

export type WorkflowRule =
	| { op: 'always' }
	| { op: 'equals'; variable: string; value: string | number | boolean | null }
	| { op: 'not_equals'; variable: string; value: string | number | boolean | null }
	| { op: 'in'; variable: string; values: readonly (string | number | boolean | null)[] }
	| { op: 'gte'; variable: string; value: number }
	| { op: 'lte'; variable: string; value: number };

export type WorkflowNode = {
	key: string;
	label: string;
	type: WorkflowNodeType;
	responsibleRoleKey?: string;
	participants?: readonly WorkflowParticipantRule[];
	completionRule?: WorkflowCompletionRule;
	routingEvents?: readonly string[];
	deadline?: WorkflowDeadline;
	requiresElectronicSignature?: boolean;
	threshold?: number;
	subprocessKey?: string;
	serviceActionKey?: string;
	integrationKey?: string;
	timerMinutes?: number;
	synchronizeEventKey?: string;
	recordVariableChanges?: boolean;
	recordVotes?: boolean;
	recordReassignments?: boolean;
	abortOnError?: boolean;
	abortParentOnError?: boolean;
};

export type WorkflowLink = {
	from: string;
	to: string;
	event?: string;
	condition?: WorkflowRule;
	loop?: boolean;
	terminateOpenPredecessors?: boolean;
};

export type WorkflowTemplate = {
	key: string;
	version: string;
	status: WorkflowTemplateStatus;
	name: string;
	description?: string;
	roles?: readonly string[];
	variables?: readonly WorkflowVariableDefinition[];
	nodes: readonly WorkflowNode[];
	links: readonly WorkflowLink[];
};

function requiredKey(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${label} is required.`);
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(normalized)) {
		throw new Error(`${label} contains unsupported characters.`);
	}
	return normalized;
}

export function defineWorkflowTemplate<T extends WorkflowTemplate>(template: T): T {
	requiredKey(template.key, 'Workflow template key');
	if (!template.version.trim()) throw new Error(`Workflow template ${template.key} requires a version.`);
	if (!template.name.trim()) throw new Error(`Workflow template ${template.key} requires a name.`);

	const nodeKeys = new Set<string>();
	let starts = 0;
	for (const node of template.nodes) {
		const key = requiredKey(node.key, 'Workflow node key');
		if (nodeKeys.has(key)) throw new Error(`Workflow template ${template.key} has duplicate node ${key}.`);
		nodeKeys.add(key);
		if (node.type === 'start') starts += 1;
		if (node.type === 'threshold') {
			if (!Number.isInteger(node.threshold) || (node.threshold ?? 0) < 1) {
				throw new Error(`Threshold node ${node.key} requires a positive integer threshold.`);
			}
		}
		if (node.type === 'subprocess' && !node.subprocessKey?.trim()) {
			throw new Error(`Subprocess node ${node.key} requires a subprocess key.`);
		}
		if (node.type === 'service' && !node.serviceActionKey?.trim()) {
			throw new Error(`Service node ${node.key} requires an allow-listed service action key.`);
		}
		if (node.type === 'integration' && !node.integrationKey?.trim()) {
			throw new Error(`Integration node ${node.key} requires an integration key.`);
		}
		if (node.type === 'timer' && (!Number.isFinite(node.timerMinutes) || (node.timerMinutes ?? 0) < 0)) {
			throw new Error(`Timer node ${node.key} requires a non-negative timer duration.`);
		}
		if (node.type === 'synchronize' && !node.synchronizeEventKey?.trim()) {
			throw new Error(`Synchronize node ${node.key} requires a typed event key.`);
		}
		if (node.deadline && (!Number.isFinite(node.deadline.minutes) || node.deadline.minutes < 0)) {
			throw new Error(`Workflow node ${node.key} has an invalid deadline.`);
		}
		if (node.completionRule?.type === 'count' && node.completionRule.count < 1) {
			throw new Error(`Workflow node ${node.key} requires a positive completion count.`);
		}
	}
	if (starts !== 1) throw new Error(`Workflow template ${template.key} must contain exactly one start node.`);

	for (const link of template.links) {
		if (!nodeKeys.has(link.from)) throw new Error(`Workflow link source ${link.from} is not defined.`);
		if (!nodeKeys.has(link.to)) throw new Error(`Workflow link target ${link.to} is not defined.`);
		if (link.event !== undefined && !link.event.trim()) throw new Error('Workflow link event cannot be blank.');
	}

	const variableKeys = new Set<string>();
	for (const variable of template.variables ?? []) {
		const key = requiredKey(variable.key, 'Workflow variable key');
		if (variableKeys.has(key)) throw new Error(`Workflow template ${template.key} has duplicate variable ${key}.`);
		variableKeys.add(key);
	}

	return template;
}

export function workflowStartNode(template: WorkflowTemplate): WorkflowNode {
	const start = template.nodes.find((node) => node.type === 'start');
	if (!start) throw new Error(`Workflow template ${template.key} has no start node.`);
	return start;
}

export function workflowNode(template: WorkflowTemplate, key: string): WorkflowNode | null {
	return template.nodes.find((node) => node.key === key) ?? null;
}

export function workflowSuccessors(
	template: WorkflowTemplate,
	nodeKey: string,
	event?: string
): readonly WorkflowLink[] {
	return template.links.filter((link) => {
		if (link.from !== nodeKey) return false;
		if (link.event === undefined) return true;
		return event === link.event;
	});
}

export function completionSatisfied(input: {
	rule: WorkflowCompletionRule | undefined;
	requiredParticipants: number;
	completedParticipants: number;
}): boolean {
	const rule = input.rule ?? { type: 'all' as const };
	if (input.requiredParticipants < 1) return true;
	if (rule.type === 'any') return input.completedParticipants >= 1;
	if (rule.type === 'count') return input.completedParticipants >= rule.count;
	return input.completedParticipants >= input.requiredParticipants;
}

export function deriveWorkflowHealth(input: {
	errors: number;
	warnings: number;
}): WorkflowHealth {
	if (input.errors > 0) return 'red';
	if (input.warnings > 0) return 'amber';
	return 'green';
}
