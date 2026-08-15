export async function withTransaction<T>(work: () => Promise<T>): Promise<T> {
	// This is the single entry point for domain operations that must stay atomic.
	return work();
}
