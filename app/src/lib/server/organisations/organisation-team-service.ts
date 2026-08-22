import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from './membership-repository';
import { OrganisationRepository } from './organisation-repository';
import { OrganisationTeamRepository } from './organisation-team-repository';

export class OrganisationTeamValidationError extends Error {
	readonly code = 'ORGANISATION_TEAM_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'OrganisationTeamValidationError';
	}
}

export class OrganisationTeamNotFoundError extends Error {
	readonly code = 'ORGANISATION_TEAM_NOT_FOUND';

	constructor() {
		super('Organisation team not found.');
		this.name = 'OrganisationTeamNotFoundError';
	}
}

function teamName(value: string): string {
	const name = value.trim();
	if (!name || name.length > 160) {
		throw new OrganisationTeamValidationError('Team name must be between 1 and 160 characters.');
	}
	return name;
}

function teamDescription(value: string | null | undefined): string | null {
	const description = value?.trim() ?? '';
	if (description.length > 4000) {
		throw new OrganisationTeamValidationError('Team description must not exceed 4000 characters.');
	}
	return description || null;
}

function uniquePublicIds(values: readonly string[]): string[] {
	const memberPublicIds = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
	if (memberPublicIds.length > 500) {
		throw new OrganisationTeamValidationError('A team cannot contain more than 500 members.');
	}
	return memberPublicIds;
}

export class OrganisationTeamService {
	constructor(private readonly db: Database = getDatabase()) {}

	async load(actor: TenantActorContext) {
		await this.requireTeamManagement(this.db, actor);
		const organisation = await new OrganisationRepository(this.db).findActiveById(
			actor.organisationId
		);
		if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

		const repository = new OrganisationTeamRepository(this.db);
		const [teams, members] = await Promise.all([
			repository.listTeams(actor.organisationId),
			repository.listAssignableMembers(actor.organisationId)
		]);
		return { organisation, teams, members };
	}

	async createTeam(
		actor: TenantActorContext,
		input: { name: string; description?: string | null; memberPublicIds: readonly string[] }
	): Promise<string> {
		const name = teamName(input.name);
		const description = teamDescription(input.description);
		const memberPublicIds = uniquePublicIds(input.memberPublicIds);
		const publicId = randomUUID();

		await this.db.transaction().execute(async (trx) => {
			await this.requireTeamManagement(trx, actor);
			const organisation = await new OrganisationRepository(trx).findActiveForUpdate(
				actor.organisationId
			);
			if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

			const repository = new OrganisationTeamRepository(trx);
			if (await repository.findTeamByName(actor.organisationId, name)) {
				throw new OrganisationTeamValidationError('A team with this name already exists.');
			}
			const memberIds = await repository.findAssignableMemberIdsByPublicIds(
				actor.organisationId,
				memberPublicIds
			);
			if (memberIds.length !== memberPublicIds.length) {
				throw new OrganisationTeamValidationError(
					'One or more selected members are not active or suspended members of this organisation.'
				);
			}

			const teamId = await repository.createTeam({
				organisationId: actor.organisationId,
				publicId,
				name,
				description
			});
			await repository.replaceTeamMembers(actor.organisationId, teamId, memberIds);

			const change = { name, description, isActive: true, memberPublicIds };
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.team.create',
				subjectType: 'team',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: change
			});
			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'organisation.team.created',
				aggregateType: 'organisation',
				aggregatePublicId: organisation.publicId,
				payload: { teamPublicId: publicId, ...change },
				correlationId: actor.correlationId
			});
		});

		return publicId;
	}

	async updateTeam(
		actor: TenantActorContext,
		input: {
			teamPublicId: string;
			name: string;
			description?: string | null;
			isActive: boolean;
			memberPublicIds: readonly string[];
		}
	): Promise<void> {
		const teamPublicId = input.teamPublicId.trim();
		if (!teamPublicId) throw new OrganisationTeamValidationError('Team is required.');
		const name = teamName(input.name);
		const description = teamDescription(input.description);
		const memberPublicIds = uniquePublicIds(input.memberPublicIds);

		await this.db.transaction().execute(async (trx) => {
			await this.requireTeamManagement(trx, actor);
			const organisation = await new OrganisationRepository(trx).findActiveForUpdate(
				actor.organisationId
			);
			if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

			const repository = new OrganisationTeamRepository(trx);
			const team = await repository.findTeamForUpdate(actor.organisationId, teamPublicId);
			if (!team) throw new OrganisationTeamNotFoundError();

			const duplicate = await repository.findTeamByName(actor.organisationId, name);
			if (duplicate && duplicate.publicId !== team.publicId) {
				throw new OrganisationTeamValidationError('A team with this name already exists.');
			}
			const memberIds = await repository.findAssignableMemberIdsByPublicIds(
				actor.organisationId,
				memberPublicIds
			);
			if (memberIds.length !== memberPublicIds.length) {
				throw new OrganisationTeamValidationError(
					'One or more selected members are not active or suspended members of this organisation.'
				);
			}

			const previousMemberPublicIds = await repository.listTeamMemberPublicIds(
				actor.organisationId,
				team.id
			);
			const nextMemberPublicIds = [...memberPublicIds].sort();
			const unchanged =
				team.name === name &&
				team.description === description &&
				team.isActive === input.isActive &&
				previousMemberPublicIds.length === nextMemberPublicIds.length &&
				previousMemberPublicIds.every((value, index) => value === nextMemberPublicIds[index]);
			if (unchanged) return;

			await repository.updateTeam({
				organisationId: actor.organisationId,
				teamId: team.id,
				name,
				description,
				isActive: input.isActive
			});
			await repository.replaceTeamMembers(actor.organisationId, team.id, memberIds);

			const change = {
				from: {
					name: team.name,
					description: team.description,
					isActive: team.isActive,
					memberPublicIds: previousMemberPublicIds
				},
				to: { name, description, isActive: input.isActive, memberPublicIds: nextMemberPublicIds }
			};
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.team.update',
				subjectType: 'team',
				subjectPublicId: team.publicId,
				correlationId: actor.correlationId,
				changeSummary: change
			});
			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'organisation.team.updated',
				aggregateType: 'organisation',
				aggregatePublicId: organisation.publicId,
				payload: { teamPublicId: team.publicId, ...change },
				correlationId: actor.correlationId
			});
		});
	}

	private async requireTeamManagement(
		executor: DatabaseExecutor,
		actor: TenantActorContext
	): Promise<void> {
		const membership = await new OrganisationMembershipRepository(executor).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();

		const decisions = await new PermissionService(executor).decideMany(actor, [
			'organisation.manage',
			'member.manage'
		]);
		if (
			!decisions.get('organisation.manage')?.allowed &&
			!decisions.get('member.manage')?.allowed
		) {
			throw new TenantAccessError('Organisation team management is not permitted.');
		}
	}
}
