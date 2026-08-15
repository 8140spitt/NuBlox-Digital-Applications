// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Actor, TenantContext } from '$lib/types/request-context';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			actor: Actor | null;
			correlationId: string;
			tenant: TenantContext;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
