import {
	assertLifecycleTransition as assertPlatformLifecycleTransition,
	canLifecycleOperation,
	lifecycleTransitions as platformLifecycleTransitions,
	type LifecycleOperation
} from '$lib/server/platform/lifecycle-kernel';
import {
	decideLifecyclePermission,
	resolveLifecycleTemplate,
	type LifecycleAuthorityDecision
} from '$lib/server/platform/lifecycle-registry-service';
import {
	lifecycleTemplate,
	type F01LifecycleTransition,
	type F01ManagedRecordKind
} from './f01-lifecycle';

export function f01LifecycleObjectType(kind: F01ManagedRecordKind): string {
	return `F01.${kind}`;
}

async function resolved(organisationId: string, kind: F01ManagedRecordKind) {
	return resolveLifecycleTemplate({
		organisationId,
		objectType: f01LifecycleObjectType(kind),
		fallback: lifecycleTemplate(kind)
	});
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
