import { sql } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';

export type EnterpriseSearchCandidate =
	| {
			kind: 'project';
			projectId: string;
			publicId: string;
			reference: string;
			title: string;
			description: string | null;
			status: string;
	  }
	| {
			kind: 'document';
			projectId: string;
			projectPublicId: string;
			publicId: string;
			reference: string;
			title: string;
			description: string;
			status: string;
	  }
	| {
			kind: 'work';
			projectId: string | null;
			publicId: string;
			reference: string;
			title: string;
			description: string | null;
			status: string;
			priority: string;
			sourceDomain: string;
	  };

type ProjectCandidateRow = {
	project_id: string;
	public_id: string;
	project_number: string;
	name: string;
	description: string | null;
	status: string;
};

type DocumentCandidateRow = {
	project_id: string;
	project_public_id: string;
	public_id: string;
	container_number: string;
	title: string;
	type_name: string;
	status: string;
};

type WorkCandidateRow = {
	project_id: string | null;
	public_id: string;
	work_item_kind: string;
	title: string;
	description: string | null;
	status: string;
	priority: string;
	source_domain: string;
};

export class EnterpriseSearchRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async search(
		organisationId: string,
		memberId: string,
		query: string,
		limitPerKind = 20
	): Promise<EnterpriseSearchCandidate[]> {
		const safeLimit = Math.max(1, Math.min(Math.trunc(limitPerKind), 50));

		const [projects, documents, workItems] = await Promise.all([
			sql<ProjectCandidateRow>`
				SELECT
					p.id AS project_id,
					p.public_id,
					p.project_number,
					p.name,
					p.description,
					p.status
				FROM projects AS p
				INNER JOIN project_organisations AS po
					ON po.project_id = p.id
				INNER JOIN project_members AS pm
					ON pm.project_id = po.project_id
					AND pm.participant_organisation_id = po.participant_organisation_id
				WHERE po.participant_organisation_id = ${organisationId}
				  AND po.status = 'active'
				  AND pm.organisation_member_id = ${memberId}
				  AND pm.status = 'active'
				  AND LOCATE(
					LOWER(${query}),
					LOWER(CONCAT_WS(' ', p.project_number, p.name, COALESCE(p.description, '')))
				  ) > 0
				ORDER BY p.name, p.project_number
				LIMIT ${safeLimit}
			`.execute(this.db),
			sql<DocumentCandidateRow>`
				SELECT
					container.project_id,
					project.public_id AS project_public_id,
					container.public_id,
					container.container_number,
					container.title,
					type.name AS type_name,
					container.lifecycle_status AS status
				FROM information_containers AS container
				INNER JOIN information_container_types AS type
					ON type.id = container.information_container_type_id
				INNER JOIN projects AS project
					ON project.id = container.project_id
				INNER JOIN project_organisations AS po
					ON po.project_id = project.id
				INNER JOIN project_members AS pm
					ON pm.project_id = po.project_id
					AND pm.participant_organisation_id = po.participant_organisation_id
				WHERE container.owning_organisation_id = ${organisationId}
				  AND po.participant_organisation_id = ${organisationId}
				  AND po.status = 'active'
				  AND pm.organisation_member_id = ${memberId}
				  AND pm.status = 'active'
				  AND LOCATE(
					LOWER(${query}),
					LOWER(CONCAT_WS(' ', container.container_number, container.title, type.name))
				  ) > 0
				ORDER BY container.title, container.container_number
				LIMIT ${safeLimit}
			`.execute(this.db),
			sql<WorkCandidateRow>`
				SELECT
					wi.project_id,
					wi.public_id,
					wi.work_item_kind,
					wi.title,
					wi.description,
					wi.status,
					wi.priority,
					wi.source_domain
				FROM work_items AS wi
				WHERE wi.owning_organisation_id = ${organisationId}
				  AND (
					wi.created_by_member_id = ${memberId}
					OR EXISTS (
						SELECT 1
						FROM work_item_assignments AS assignment
						WHERE assignment.work_item_id = wi.id
						  AND assignment.work_item_owner_organisation_id = wi.owning_organisation_id
						  AND assignment.assigned_organisation_id = ${organisationId}
						  AND assignment.assignment_scope = 'member'
						  AND assignment.assigned_member_id = ${memberId}
						  AND assignment.ended_at IS NULL
					)
				  )
				  AND LOCATE(
					LOWER(${query}),
					LOWER(
						CONCAT_WS(
							' ',
							wi.work_item_kind,
							wi.title,
							COALESCE(wi.description, ''),
							wi.source_domain,
							COALESCE(wi.source_type, '')
						)
					)
				  ) > 0
				ORDER BY wi.updated_at DESC, wi.id DESC
				LIMIT ${safeLimit}
			`.execute(this.db)
		]);

		return [
			...projects.rows.map(
				(row): EnterpriseSearchCandidate => ({
					kind: 'project',
					projectId: row.project_id,
					publicId: row.public_id,
					reference: row.project_number,
					title: row.name,
					description: row.description,
					status: row.status
				})
			),
			...documents.rows.map(
				(row): EnterpriseSearchCandidate => ({
					kind: 'document',
					projectId: row.project_id,
					projectPublicId: row.project_public_id,
					publicId: row.public_id,
					reference: row.container_number,
					title: row.title,
					description: row.type_name,
					status: row.status
				})
			),
			...workItems.rows.map(
				(row): EnterpriseSearchCandidate => ({
					kind: 'work',
					projectId: row.project_id,
					publicId: row.public_id,
					reference: row.work_item_kind,
					title: row.title,
					description: row.description,
					status: row.status,
					priority: row.priority,
					sourceDomain: row.source_domain
				})
			)
		];
	}
}
