type OutboxEvent = {
	topic: string;
	payload: Record<string, unknown>;
	correlationId: string;
};

export async function enqueueOutboxEvent(_event: OutboxEvent): Promise<void> {
	// Placeholder adapter for persisting outbox events.
}
