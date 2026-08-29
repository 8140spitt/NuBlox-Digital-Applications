export type AccessWindow = {
	effectiveFrom: Date | null;
	expiresAt: Date | null;
};

export function isAccessWindowEffective(window: AccessWindow, at = new Date()): boolean {
	return (!window.effectiveFrom || window.effectiveFrom <= at) && (!window.expiresAt || window.expiresAt > at);
}

export function serialiseAccessWindow(window: AccessWindow) {
	return {
		effectiveFrom: window.effectiveFrom?.toISOString() ?? null,
		expiresAt: window.expiresAt?.toISOString() ?? null
	};
}
