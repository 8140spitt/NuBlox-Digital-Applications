import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	EnterpriseSearchRepository,
	type EnterpriseSearchCandidate
} from './enterprise-search-repository';

export type EnterpriseSearchResult = {
	id: string;
	kind: 'project' | 'document' | 'work';
	title: string;
	reference: string;
	description: string;
	context: string;
	status: string;
	href: string;
};

export class EnterpriseSearchValidationError extends Error {
	readonly code = 'ENTERPRISE_SEARCH_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'EnterpriseSearchValidationError';
	}
}

function normaliseQuery(query: string): string {
	const value = query.trim().replace(/\s+/g, ' ');
	if (value.length > 120) {
		throw new EnterpriseSearchValidationError('Search queries must not exceed 120 characters.');
	}
	return value;
}

function candidateRank(query: string, candidate: EnterpriseSearchCandidate): number {
	const q = query.toLocaleLowerCase();
	const title = candidate.title.toLocaleLowerCase();
	const reference = candidate.reference.toLocaleLowerCase();
	if (reference === q) return 0;
	if (title === q) return 1;
	if (title.startsWith(q)) return 2;
	if (reference.startsWith(q)) return 3;
	if (title.includes(q)) return 4;
	return 5;
}

function toResult(candidate: EnterpriseSearchCandidate): EnterpriseSearchResult {
	if (candidate.kind === 'project') {
		return {
			id: `project:${candidate.publicId}`,
			kind: 'project',
			title: candidate.title,
			reference: candidate.reference,
			description: candidate.description ?? 'Project workspace',
			context: 'Project',
			status: candidate.status,
			href: `/projects/${encodeURIComponent(candidate.publicId)}`
		};
	}

	if (candidate.kind === 'document') {
		return {
			id: `document:${candidate.publicId}`,
			kind: 'document',
			title: candidate.title,
			reference: candidate.reference,
			description: candidate.description,
			context: 'Controlled information',
			status: candidate.status,
			href: `/documents?project=${encodeURIComponent(candidate.projectPublicId)}`
		};
	}

	return {
		id: `work:${candidate.publicId}`,
		kind: 'work',
		title: candidate.title,
		reference: candidate.reference.replaceAll('_', ' '),
		description: candidate.description ?? `${candidate.priority} priority work item`,
		context: candidate.sourceDomain,
		status: candidate.status,
		href: '/my-work'
	};
}

export class EnterpriseSearchService {
	constructor(private readonly db: Database = getDatabase()) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	async search(
		actor: TenantActorContext,
		queryInput: string,
		limit = 30
	): Promise<EnterpriseSearchResult[]> {
		await this.assertActiveActor(actor);
		const query = normaliseQuery(queryInput);
		if (query.length < 2) return [];

		const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 50));
		const candidates = await new EnterpriseSearchRepository(this.db).search(
			actor.organisationId,
			actor.memberId,
			query,
			Math.min(Math.max(safeLimit, 12), 50)
		);
		if (candidates.length === 0) return [];

		const permissionService = new PermissionService(this.db);
		const permissionChecks = new Map<string, Promise<boolean>>();
		const isAllowed = (candidate: EnterpriseSearchCandidate): Promise<boolean> => {
			const scope = candidate.projectId ?? 'organisation';
			const key = `${candidate.kind}:${scope}`;
			const existing = permissionChecks.get(key);
			if (existing) return existing;

			const check = (async () => {
				if (candidate.kind === 'project') {
					return (
						await permissionService.decide(actor, 'project.view', {
							projectId: candidate.projectId
						})
					).allowed;
				}
				if (candidate.kind === 'document') {
					return (
						await permissionService.decide(actor, 'information.view', {
							projectId: candidate.projectId
						})
					).allowed;
				}
				return (
					await permissionService.decideWithUmbrella(actor, 'work.view', 'work.manage', {
						projectId: candidate.projectId ?? undefined
					})
				).allowed;
			})();
			permissionChecks.set(key, check);
			return check;
		};

		const decisions = await Promise.all(
			candidates.map(async (candidate) => ({ candidate, allowed: await isAllowed(candidate) }))
		);

		return decisions
			.filter((entry) => entry.allowed)
			.map((entry) => entry.candidate)
			.sort((a, b) => {
				const rankDelta = candidateRank(query, a) - candidateRank(query, b);
				if (rankDelta !== 0) return rankDelta;
				const titleDelta = a.title.localeCompare(b.title);
				if (titleDelta !== 0) return titleDelta;
				return a.reference.localeCompare(b.reference);
			})
			.slice(0, safeLimit)
			.map(toResult);
	}
}
