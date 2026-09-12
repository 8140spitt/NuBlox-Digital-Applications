type AuditEvent = {
	actorId: string | null;
	correlationId: string;
	eventType: string;
	payload: Record<string, unknown>;
};

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
	// Placeholder adapter for structured audit persistence.
	console.info('audit-event', event);
}
