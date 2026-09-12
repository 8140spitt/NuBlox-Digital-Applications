export class TenantAccessError extends Error {
	readonly code = 'TENANT_ACCESS_DENIED';

	constructor(message = 'The actor is not active in the requested organisation.') {
		super(message);
		this.name = 'TenantAccessError';
	}
}

export class RecordNotFoundError extends Error {
	readonly code = 'RECORD_NOT_FOUND';

	constructor(message = 'The requested record was not found in the permitted scope.') {
		super(message);
		this.name = 'RecordNotFoundError';
	}
}

export class InvalidLifecycleTransitionError extends Error {
	readonly code = 'INVALID_LIFECYCLE_TRANSITION';

	constructor(from: string, to: string) {
		super(`Lifecycle transition from '${from}' to '${to}' is not permitted.`);
		this.name = 'InvalidLifecycleTransitionError';
	}
}

export class ConcurrentUpdateError extends Error {
	readonly code = 'CONCURRENT_UPDATE';

	constructor(message = 'The record changed while the operation was being applied.') {
		super(message);
		this.name = 'ConcurrentUpdateError';
	}
}
