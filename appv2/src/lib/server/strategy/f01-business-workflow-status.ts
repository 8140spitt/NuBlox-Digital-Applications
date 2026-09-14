import type { RowDataPacket } from 'mysql2/promise';
import { hasPermission } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import type { F01ManagedRecordKind } from './f01-lifecycle';

export type F01BusinessWorkflowStatus = {
	requestPublicId: string;
	activityTitle: string;
	transitionLabel: string;
	fromState: string;
	toState: string;
	submittedAt: string;
	dueAt: string | null;
	actionableByMember: boolean;
	assigneeLabel: string;
};

type StatusRow = RowDataPacket & {
	requestPublicId: string;
	activityTitle: string;
	transitionLabel: string;
	fromState: string;
	toState: string;
	submittedAt: Date | string;
	dueAt: Date | string | null;
	requiredPermissionKey: string;
	assignmentScope: 'organisation' | 'team' | 'member';
	assignedMemberId: string | null;
	assignedTeamId: string | null;
};

function dateTime(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : String(value);
}

async function actionable(
	row: StatusRow,
	organisationId: string,
	memberId: string
): Promise<boolean> {
	if (row.assignmentScope === 'member') return row.assignedMemberId === memberId;
	if (row.assignmentScope === 'team') {
		const [rows] = await getPool().execute<RowDataPacket[]>(
			`SELECT 1 FROM team_members
			 WHERE organisation_id = ? AND team_id = ? AND organisation_member_id = ? LIMIT 1`,
			[organisationId, row.assignedTeamId, memberId]
		);
		return rows.length > 0;
	}
	return hasPermission({
		organisationId,
		memberId,
		permissionKey: row.requiredPermissionKey
	});
}

export async function getF01BusinessWorkflowStatus(input: {
	organisationId: string;
	memberId: string;
	kind: F01ManagedRecordKind;
	recordPublicId: string;
}): Promise<F01BusinessWorkflowStatus | null> {
	const [rows] = await getPool().execute<StatusRow[]>(
		`SELECT request.public_id AS requestPublicId,
		        item.title AS activityTitle,
		        request.transition_label AS transitionLabel,
		        request.lifecycle_from_state AS fromState,
		        request.lifecycle_to_state AS toState,
		        request.submitted_at AS submittedAt,
		        item.due_at AS dueAt,
		        request.required_permission_key AS requiredPermissionKey,
		        assignment.assignment_scope AS assignmentScope,
		        CAST(assignment.assigned_member_id AS CHAR) AS assignedMemberId,
		        CAST(assignment.assigned_team_id AS CHAR) AS assignedTeamId
		 FROM workflow_requests request
		 JOIN work_items item ON item.id = request.work_item_id
		  AND item.owning_organisation_id = request.organisation_id
		 JOIN work_item_assignments assignment ON assignment.work_item_id = item.id
		  AND assignment.work_item_owner_organisation_id = request.organisation_id
		  AND assignment.ended_at IS NULL
		 WHERE request.organisation_id = ?
		   AND request.source_domain = 'F01'
		   AND request.source_type = ?
		   AND request.source_public_id = ?
		   AND request.status = 'pending'
		 ORDER BY request.submitted_at DESC
		 LIMIT 1`,
		[input.organisationId, input.kind, input.recordPublicId]
	);
	const row = rows[0];
	if (!row) return null;
	const actionableByMember = await actionable(row, input.organisationId, input.memberId);
	let assigneeLabel = 'Authorised approvers';
	if (row.assignmentScope === 'member') {
		assigneeLabel = row.assignedMemberId === input.memberId ? 'You' : 'Another named colleague';
	} else if (row.assignmentScope === 'team') {
		assigneeLabel = actionableByMember ? 'Your assigned team' : 'Another assigned team';
	} else if (actionableByMember) {
		assigneeLabel = 'You and other authorised approvers';
	}
	return {
		requestPublicId: row.requestPublicId,
		activityTitle: row.activityTitle,
		transitionLabel: row.transitionLabel,
		fromState: row.fromState,
		toState: row.toState,
		submittedAt: dateTime(row.submittedAt),
		dueAt: row.dueAt ? dateTime(row.dueAt) : null,
		actionableByMember,
		assigneeLabel
	};
}
