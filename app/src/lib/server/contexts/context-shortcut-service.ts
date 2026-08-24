import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { AssetsMaintenanceRepository } from '$lib/server/assets/assets-maintenance-repository';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { OrganisationRepository } from '$lib/server/organisations/organisation-repository';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import {
	ContextPreferenceRepository,
	type ContextKind,
	type ContextPreferenceRecord
} from './context-preference-repository';

export type ContextShortcut = {
	id: string;
	kind: ContextKind;
	publicId: string;
	label: string;
	reference: string;
	status: string;
	href: string;
	isFavourite: boolean;
	isPinned: boolean;
	lastOpenedAt: Date | null;
};

export type ContextCentre = {
	items: ContextShortcut[];
	pinned: ContextShortcut[];
	favourites: ContextShortcut[];
	recent: ContextShortcut[];
};

type ContextCandidate = Omit<ContextShortcut, 'isFavourite' | 'isPinned' | 'lastOpenedAt'>;

function keyOf(kind: ContextKind, publicId: string): string {
	return `${kind}:${publicId}`;
}

function contextRank(kind: ContextKind): number {
	if (kind === 'organisation') return 0;
	if (kind === 'project') return 1;
	if (kind === 'facility') return 2;
	return 3;
}

function byContextLabel(left: ContextShortcut, right: ContextShortcut): number {
	return contextRank(left.kind) - contextRank(right.kind) || left.label.localeCompare(right.label);
}

function byRecent(left: ContextShortcut, right: ContextShortcut): number {
	return (right.lastOpenedAt?.getTime() ?? 0) - (left.lastOpenedAt?.getTime() ?? 0);
}

function withPreference(
	candidate: ContextCandidate,
	preference: ContextPreferenceRecord | undefined
): ContextShortcut {
	return {
		...candidate,
		isFavourite: preference?.isFavourite ?? false,
		isPinned: preference?.isPinned ?? false,
		lastOpenedAt: preference?.lastOpenedAt ?? null
	};
}

export class ContextShortcutService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async listCandidates(actor: TenantActorContext): Promise<ContextCandidate[]> {
		await this.assertActiveActor(actor);
		const organisation = await new OrganisationRepository(this.db).findActiveById(
			actor.organisationId
		);
		if (!organisation) throw new TenantAccessError();

		const decisions = await new PermissionService(this.db).decideMany(actor, [
			'project.view',
			'facilities.view',
			'assets.view'
		]);
		const canViewProjects = decisions.get('project.view')?.allowed ?? false;
		const canViewFacilities = decisions.get('facilities.view')?.allowed ?? false;
		const canViewAssets = decisions.get('assets.view')?.allowed ?? false;
		const assetsRepository = new AssetsMaintenanceRepository(this.db);
		const [projects, facilities, assets] = await Promise.all([
			canViewProjects
				? new ProjectRepository(this.db).listForMember(actor.organisationId, actor.memberId)
				: Promise.resolve([]),
			canViewFacilities
				? assetsRepository.listFacilities(actor.organisationId)
				: Promise.resolve([]),
			canViewAssets ? assetsRepository.listAssets(actor.organisationId) : Promise.resolve([])
		]);

		return [
			{
				id: keyOf('organisation', organisation.publicId),
				kind: 'organisation',
				publicId: organisation.publicId,
				label: organisation.tradingName ?? organisation.legalName,
				reference: 'Organisation',
				status: organisation.status,
				href: '/organisation'
			},
			...projects.map(
				(project): ContextCandidate => ({
					id: keyOf('project', project.publicId),
					kind: 'project',
					publicId: project.publicId,
					label: project.name,
					reference: project.projectNumber,
					status: project.status,
					href: `/projects/${encodeURIComponent(project.publicId)}`
				})
			),
			...facilities.map(
				(facility): ContextCandidate => ({
					id: keyOf('facility', facility.publicId),
					kind: 'facility',
					publicId: facility.publicId,
					label: facility.name,
					reference: facility.facilityCode,
					status: facility.operationalStatus,
					href: `/assets?facility=${encodeURIComponent(facility.publicId)}#facility-register`
				})
			),
			...assets.map(
				(asset): ContextCandidate => ({
					id: keyOf('asset', asset.publicId),
					kind: 'asset',
					publicId: asset.publicId,
					label: asset.name,
					reference: asset.assetTag,
					status: asset.lifecycleStatus,
					href: `/assets?asset=${encodeURIComponent(asset.publicId)}#asset-register`
				})
			)
		];
	}

	private async resolveCandidate(
		actor: TenantActorContext,
		kind: ContextKind,
		publicId: string
	): Promise<ContextCandidate> {
		const candidate = (await this.listCandidates(actor)).find(
			(item) => item.kind === kind && item.publicId === publicId
		);
		if (!candidate) throw new RecordNotFoundError('Context is not available in your effective scope.');
		return candidate;
	}

	async getCentre(actor: TenantActorContext): Promise<ContextCentre> {
		const [candidates, preferences] = await Promise.all([
			this.listCandidates(actor),
			new ContextPreferenceRepository(this.db).listForMember(
				actor.organisationId,
				actor.memberId
			)
		]);
		const preferenceByContext = new Map(
			preferences.map((preference) => [keyOf(preference.kind, preference.publicId), preference])
		);
		const items = candidates
			.map((candidate) => withPreference(candidate, preferenceByContext.get(candidate.id)))
			.sort(byContextLabel);

		return {
			items,
			pinned: items.filter((item) => item.isPinned).sort(byContextLabel),
			favourites: items.filter((item) => item.isFavourite).sort(byContextLabel),
			recent: items.filter((item) => item.lastOpenedAt).sort(byRecent).slice(0, 12)
		};
	}

	async listShortcuts(actor: TenantActorContext, limit = 12): Promise<ContextShortcut[]> {
		const centre = await this.getCentre(actor);
		const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 30));
		const shortcuts: ContextShortcut[] = [];
		const seen = new Set<string>();
		for (const item of [...centre.pinned, ...centre.favourites, ...centre.recent]) {
			if (seen.has(item.id)) continue;
			seen.add(item.id);
			shortcuts.push(item);
			if (shortcuts.length >= safeLimit) break;
		}
		return shortcuts;
	}

	async setPreference(
		actor: TenantActorContext,
		input: {
			kind: ContextKind;
			publicId: string;
			isFavourite: boolean;
			isPinned: boolean;
		}
	): Promise<void> {
		await this.resolveCandidate(actor, input.kind, input.publicId);
		await new ContextPreferenceRepository(this.db).setPreference({
			organisationId: actor.organisationId,
			memberId: actor.memberId,
			...input
		});
	}

	async openContext(
		actor: TenantActorContext,
		kind: ContextKind,
		publicId: string
	): Promise<string> {
		const candidate = await this.resolveCandidate(actor, kind, publicId);
		await new ContextPreferenceRepository(this.db).recordRecent({
			organisationId: actor.organisationId,
			memberId: actor.memberId,
			kind,
			publicId,
			openedAt: this.now()
		});
		return candidate.href;
	}
}
