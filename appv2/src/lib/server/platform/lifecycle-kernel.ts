export type LifecycleTemplateMode = 'basic' | 'advanced';
export type LifecycleOperation = 'edit' | 'delete' | 'revise';
export type LifecycleTransitionTone = 'default' | 'danger';

export type LifecycleTransition = {
	to: string;
	label: string;
	requiresNote?: boolean;
	requiresTargetReference?: boolean;
	tone?: LifecycleTransitionTone;
	requiredPermissionKey?: string;
	workflowKey?: string;
};

export type LifecyclePhaseAccessRule = {
	roleKey: string;
	permissionKeys: readonly string[];
};

export type LifecyclePhase = {
	state: string;
	label: string;
	editable?: boolean;
	deletable?: boolean;
	revisable?: boolean;
	accessRules?: readonly LifecyclePhaseAccessRule[];
};

export type LifecycleTemplate = {
	key: string;
	version: string;
	mode: LifecycleTemplateMode;
	enabled: boolean;
	objectType: string;
	initialState: string;
	phases: Readonly<Record<string, LifecyclePhase>>;
	transitions: Readonly<Record<string, readonly LifecycleTransition[]>>;
};

export function defineLifecycleTemplate<T extends LifecycleTemplate>(template: T): T {
	if (!template.key.trim()) throw new Error('Lifecycle template key is required.');
	if (!template.version.trim())
		throw new Error(`Lifecycle template ${template.key} requires a version.`);
	if (!template.enabled) return template;
	if (!template.phases[template.initialState]) {
		throw new Error(
			`Lifecycle template ${template.key} initial state ${template.initialState} is not defined as a phase.`
		);
	}

	for (const [state, phase] of Object.entries(template.phases)) {
		if (phase.state !== state) {
			throw new Error(
				`Lifecycle template ${template.key} phase key ${state} does not match ${phase.state}.`
			);
		}
		if (template.mode === 'basic' && (phase.accessRules?.length ?? 0) > 0) {
			throw new Error(
				`Lifecycle template ${template.key} is basic and cannot define phase access rules.`
			);
		}
	}

	for (const [from, transitions] of Object.entries(template.transitions)) {
		if (!template.phases[from]) {
			throw new Error(
				`Lifecycle template ${template.key} transition source ${from} is not a phase.`
			);
		}
		for (const transition of transitions) {
			if (!template.phases[transition.to]) {
				throw new Error(
					`Lifecycle template ${template.key} transition target ${transition.to} is not a phase.`
				);
			}
		}
	}

	return template;
}

export function lifecyclePhase(template: LifecycleTemplate, state: string): LifecyclePhase | null {
	return template.phases[state] ?? null;
}

export function canLifecycleOperation(
	template: LifecycleTemplate,
	state: string,
	operation: LifecycleOperation
): boolean {
	const phase = lifecyclePhase(template, state);
	if (!phase) return false;
	if (operation === 'edit') return phase.editable === true;
	if (operation === 'delete') return phase.deletable === true;
	return phase.revisable === true;
}

export function lifecycleTransitions(
	template: LifecycleTemplate,
	state: string
): readonly LifecycleTransition[] {
	return template.transitions[state] ?? [];
}

export function assertLifecycleTransition(
	template: LifecycleTemplate,
	from: string,
	to: string
): LifecycleTransition {
	const transition = lifecycleTransitions(template, from).find((candidate) => candidate.to === to);
	if (!transition) {
		throw new Error(`Invalid ${template.objectType} lifecycle transition: ${from} → ${to}.`);
	}
	return transition;
}

/**
 * Returns permissions granted by the active advanced-lifecycle phase to the supplied lifecycle roles.
 * These grants are additive context only. They never override a deny from NuBlox's central authority model.
 */
export function phasePermissionKeysForRoles(
	template: LifecycleTemplate,
	state: string,
	roleKeys: readonly string[]
): readonly string[] {
	if (template.mode !== 'advanced') return [];
	const phase = lifecyclePhase(template, state);
	if (!phase?.accessRules?.length) return [];
	const roles = new Set(roleKeys);
	return [
		...new Set(
			phase.accessRules
				.filter((rule) => roles.has(rule.roleKey))
				.flatMap((rule) => rule.permissionKeys)
		)
	].sort();
}
