import {
	assertLifecycleTransition as assertPlatformLifecycleTransition,
	canLifecycleOperation,
	defineLifecycleTemplate,
	lifecycleTransitions as platformLifecycleTransitions,
	type LifecycleOperation,
	type LifecycleTemplate
} from '$lib/server/platform/lifecycle-kernel';
import {
	decideLifecyclePermission,
	resolveLifecycleTemplate,
	type LifecycleAuthorityDecision,
	type ResolvedLifecycleTemplate
} from '$lib/server/platform/lifecycle-registry-service';
import {
	lifecycleTemplate,
	type F01LifecycleTransition,
	type F01ManagedRecordKind
} from './f01-lifecycle';

const STARTER_OBJECT_TYPES: Partial<Record<F01ManagedRecordKind, string>> = {
	framework: 'strategy.strategy-cycle',
	plan: 'strategy.business-plan',
	kpi: 'strategy.kpi-definition',
	review: 'strategy.strategic-review'
};

export function f01LifecycleObjectType(kind: F01ManagedRecordKind): string {
	return `F01.${kind}`;
}

export function assertNativeF01LifecycleCompatibility(
	kind: F01ManagedRecordKind,
	fallback: LifecycleTemplate,
	configured: ResolvedLifecycleTemplate
): ResolvedLifecycleTemplate {
	if (configured.source !== 'binding') return configured;
	const nativeStates = Object.keys(fallback.phases).sort();
	const configuredStates = Object.keys(configured.template.phases).sort();
	if (
		nativeStates.length !== configuredStates.length ||
		nativeStates.some((state, index) => state !== configuredStates[index])
	) {
		throw new Error(
			`Lifecycle binding ${configured.template.key} is incompatible with native F01.${kind} states.`
		);
	}
	if (configured.template.initialState !== fallback.initialState) {
		throw new Error(
			`Lifecycle binding ${configured.template.key} initial state ${configured.template.initialState} is incompatible with native F01.${kind} initial state ${fallback.initialState}.`
		);
	}
	const nativeTransitions = new Set(
		Object.entries(fallback.transitions).flatMap(([from, transitions]) =>
			transitions.map((transition) => `${from}->${transition.to}`)
		)
	);
	for (const [from, transitions] of Object.entries(configured.template.transitions)) {
		for (const transition of transitions) {
			if (!nativeTransitions.has(`${from}->${transition.to}`)) {
				throw new Error(
					`Lifecycle binding ${configured.template.key} transition ${from} → ${transition.to} is not executable by native F01.${kind}.`
				);
			}
		}
	}
	return configured;
}
function overlayStarterWorkflow(
	fallback: LifecycleTemplate,
	starter: ResolvedLifecycleTemplate
): ResolvedLifecycleTemplate {
	const configuredWorkflow = Object.values(starter.template.transitions)
		.flat()
		.find((transition) => transition.to === 'approved' && transition.workflowKey)?.workflowKey;
	if (!configuredWorkflow) return starter;
	const transitions = Object.fromEntries(
		Object.entries(fallback.transitions).map(([state, candidates]) => [
			state,
			candidates.map((transition) =>
				state === 'draft' && transition.to === 'approved'
					? { ...transition, workflowKey: configuredWorkflow }
					: { ...transition }
			)
		])
	);
	return {
		...starter,
		template: defineLifecycleTemplate({
			...fallback,
			key: starter.template.key,
			version: starter.template.version,
			transitions
		})
	};
}

async function resolved(organisationId: string, kind: F01ManagedRecordKind) {
	const fallback = lifecycleTemplate(kind);
	const exact = await resolveLifecycleTemplate({
		organisationId,
		objectType: f01LifecycleObjectType(kind),
		fallback
	});
	if (exact.source === 'binding') {
		return assertNativeF01LifecycleCompatibility(kind, fallback, exact);
	}

	const starterObjectType = STARTER_OBJECT_TYPES[kind];
	if (starterObjectType) {
		const starter = await resolveLifecycleTemplate({
			organisationId,
			objectType: starterObjectType,
			fallback
		});
		if (starter.source === 'binding') return overlayStarterWorkflow(fallback, starter);
	}
	return exact;
}

export async function canF01LifecycleOperation(
	organisationId: string,
	kind: F01ManagedRecordKind,
	status: string,
	operation: LifecycleOperation
): Promise<boolean> {
	const lifecycle = await resolved(organisationId, kind);
	return canLifecycleOperation(lifecycle.template, status, operation);
}

export async function f01LifecycleTransitions(
	organisationId: string,
	kind: F01ManagedRecordKind,
	status: string
): Promise<readonly F01LifecycleTransition[]> {
	const lifecycle = await resolved(organisationId, kind);
	return platformLifecycleTransitions(lifecycle.template, status);
}

export async function assertF01LifecycleTransition(
	organisationId: string,
	kind: F01ManagedRecordKind,
	from: string,
	to: string
): Promise<F01LifecycleTransition> {
	const lifecycle = await resolved(organisationId, kind);
	return assertPlatformLifecycleTransition(lifecycle.template, from, to);
}

export async function decideF01LifecyclePermission(input: {
	organisationId: string;
	memberId: string;
	kind: F01ManagedRecordKind;
	state: string;
	permissionKey: string;
}): Promise<LifecycleAuthorityDecision> {
	const lifecycle = await resolved(input.organisationId, input.kind);
	return decideLifecyclePermission({
		organisationId: input.organisationId,
		memberId: input.memberId,
		resolved: lifecycle,
		state: input.state,
		permissionKey: input.permissionKey
	});
}
