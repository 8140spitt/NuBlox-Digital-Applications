import { randomUUID } from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { decidePermissions } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';
import { getJobFamily, getJobProfile } from './job-architecture-catalogue';

export class OrganisationStructureAccessError extends Error {}
export class OrganisationStructureValidationError extends Error {}

export type OrganisationPositionAssignment = {
	publicId: string;
	memberPublicId: string;
	memberName: string;
	memberEmail: string;
	assignmentType: 'primary' | 'acting' | 'secondary';
	allocationPercent: string;
	startDate: string;
	endDate: string | null;
	status: 'planned' | 'active' | 'ended';
};

export type OrganisationPositionSummary = {
	publicId: string;
	positionCode: string;
	jobProfileKey: string;
	jobProfileTitle: string;
	jobFamilyName: string;
	title: string;
	reportsToPublicId: string | null;
	reportsToCode: string | null;
	fte: string;
	validFrom: string | null;
	validTo: string | null;
	status: 'planned' | 'open' | 'frozen' | 'closed';
	assignments: OrganisationPositionAssignment[];
};

export type PositionAssignableMember = {
	memberId: string;
	publicId: string;
	name: string;
	email: string;
};

async function requirePermission(actor: EvidenceActor, permissionKey: string): Promise<void> {
	const decisions = await decidePermissions({
		organisationId: actor.organisationId,
		memberId: actor.memberId,
		permissionKeys: [permissionKey]
	});
	if (decisions.get(permissionKey)?.allowed !== true) {
		throw new OrganisationStructureAccessError(
			`You do not have ${permissionKey} authority in this organisation.`
		);
	}
}

function required(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) throw new OrganisationStructureValidationError(`${label} is required.`);
	return normalized;
}

function positionCode(value: string): string {
	const normalized = required(value, 'Position code').toUpperCase();
	if (!/^[A-Z0-9][A-Z0-9._-]{1,63}$/.test(normalized)) {
		throw new OrganisationStructureValidationError(
			'Position code must use 2-64 letters, numbers, dots, dashes or underscores.'
		);
	}
	return normalized;
}

function optionalDate(value: string | null | undefined, label: string): string | null {
	const normalized = value?.trim() || '';
	if (!normalized) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		throw new OrganisationStructureValidationError(`${label} must be a valid date.`);
	}
	return normalized;
}

function requiredDate(value: string, label: string): string {
	const normalized = optionalDate(value, label);
	if (!normalized) throw new OrganisationStructureValidationError(`${label} is required.`);
	return normalized;
}

function validateDateRange(start: string | null, end: string | null): void {
	if (start && end && end < start) {
		throw new OrganisationStructureValidationError('End date cannot be before start date.');
	}
}

function fteValue(value: number): number {
	if (!Number.isFinite(value) || value <= 0 || value > 1) {
		throw new OrganisationStructureValidationError('FTE must be greater than 0 and no more than 1.00.');
	}
	return Math.round(value * 100) / 100;
}

function allocationValue(value: number): number {
	if (!Number.isFinite(value) || value <= 0 || value > 100) {
		throw new OrganisationStructureValidationError(
			'Allocation must be greater than 0 and no more than 100 percent.'
		);
	}
	return Math.round(value * 100) / 100;
}

function dateText(value: Date | string | null): string | null {
	if (value === null) return null;
	if (typeof value === 'string') return value.slice(0, 10);
	return value.toISOString().slice(0, 10);
}

export async function listOrganisationPositions(
	actor: EvidenceActor
): Promise<OrganisationPositionSummary[]> {
	await requirePermission(actor, 'organisation.structure.view');
	const [positionRows] = await getPool().execute<
		Array<
			RowDataPacket & {
				id: string;
				publicId: string;
				positionCode: string;
				jobProfileKey: string;
				titleOverride: string | null;
				reportsToPublicId: string | null;
				reportsToCode: string | null;
				fte: string;
				validFrom: Date | string | null;
				validTo: Date | string | null;
				status: OrganisationPositionSummary['status'];
			}
		>
	>(
		`SELECT position.id,
		        position.public_id AS publicId,
		        position.position_code AS positionCode,
		        position.job_profile_key AS jobProfileKey,
		        position.title_override AS titleOverride,
		        parent.public_id AS reportsToPublicId,
		        parent.position_code AS reportsToCode,
		        CAST(position.fte AS CHAR) AS fte,
		        position.valid_from AS validFrom,
		        position.valid_to AS validTo,
		        position.position_status AS status
		 FROM organisation_positions position
		 LEFT JOIN organisation_positions parent
		   ON parent.id = position.reports_to_position_id
		  AND parent.organisation_id = position.organisation_id
		 WHERE position.organisation_id = ?
		 ORDER BY FIELD(position.position_status, 'open', 'planned', 'frozen', 'closed'),
		          position.position_code`,
		[actor.organisationId]
	);

	const [assignmentRows] = await getPool().execute<
		Array<
			RowDataPacket & {
				positionId: string;
				publicId: string;
				memberPublicId: string;
				memberName: string;
				memberEmail: string;
				assignmentType: OrganisationPositionAssignment['assignmentType'];
				allocationPercent: string;
				startDate: Date | string;
				endDate: Date | string | null;
				status: OrganisationPositionAssignment['status'];
			}
		>
	>(
		`SELECT assignment.position_id AS positionId,
		        assignment.public_id AS publicId,
		        member.public_id AS memberPublicId,
		        user.name AS memberName,
		        user.email AS memberEmail,
		        assignment.assignment_type AS assignmentType,
		        CAST(assignment.allocation_percent AS CHAR) AS allocationPercent,
		        assignment.start_date AS startDate,
		        assignment.end_date AS endDate,
		        assignment.assignment_status AS status
		 FROM position_assignments assignment
		 JOIN organisation_members member
		   ON member.id = assignment.organisation_member_id
		  AND member.organisation_id = assignment.organisation_id
		 JOIN users user ON user.id = member.user_id
		 WHERE assignment.organisation_id = ?
		 ORDER BY FIELD(assignment.assignment_status, 'active', 'planned', 'ended'),
		          assignment.start_date DESC,
		          assignment.id DESC`,
		[actor.organisationId]
	);

	const assignmentsByPosition = new Map<string, OrganisationPositionAssignment[]>();
	for (const row of assignmentRows) {
		const list = assignmentsByPosition.get(String(row.positionId)) ?? [];
		list.push({
			publicId: row.publicId,
			memberPublicId: row.memberPublicId,
			memberName: row.memberName,
			memberEmail: row.memberEmail,
			assignmentType: row.assignmentType,
			allocationPercent: row.allocationPercent,
			startDate: dateText(row.startDate) ?? '',
			endDate: dateText(row.endDate),
			status: row.status
		});
		assignmentsByPosition.set(String(row.positionId), list);
	}

	return positionRows.map((row) => {
		const profile = getJobProfile(row.jobProfileKey);
		const family = profile ? getJobFamily(profile.jobFamilyId) : null;
		return {
			publicId: row.publicId,
			positionCode: row.positionCode,
			jobProfileKey: row.jobProfileKey,
			jobProfileTitle: profile?.title ?? row.jobProfileKey,
			jobFamilyName: family?.name ?? 'Unresolved job family',
			title: row.titleOverride?.trim() || profile?.title || row.jobProfileKey,
			reportsToPublicId: row.reportsToPublicId,
			reportsToCode: row.reportsToCode,
			fte: row.fte,
			validFrom: dateText(row.validFrom),
			validTo: dateText(row.validTo),
			status: row.status,
			assignments: assignmentsByPosition.get(String(row.id)) ?? []
		};
	});
}

export async function listPositionAssignableMembers(
	actor: EvidenceActor
): Promise<PositionAssignableMember[]> {
	await requirePermission(actor, 'organisation.structure.view');
	const [rows] = await getPool().execute<
		Array<
			RowDataPacket & {
				memberId: string;
				publicId: string;
				name: string;
				email: string;
			}
		>
	>(
		`SELECT member.id AS memberId,
		        member.public_id AS publicId,
		        user.name,
		        user.email
		 FROM organisation_members member
		 JOIN users user ON user.id = member.user_id
		 WHERE member.organisation_id = ?
		   AND member.status = 'active'
		   AND user.status = 'active'
		 ORDER BY user.name, user.email`,
		[actor.organisationId]
	);
	return rows.map((row) => ({
		memberId: String(row.memberId),
		publicId: row.publicId,
		name: row.name,
		email: row.email
	}));
}

async function positionIdForPublicId(
	connection: PoolConnection,
	organisationId: string,
	publicId: string
): Promise<string | null> {
	const [rows] = await connection.execute<Array<RowDataPacket & { id: string }>>(
		`SELECT id FROM organisation_positions
		 WHERE organisation_id = ? AND public_id = ?
		 LIMIT 1`,
		[organisationId, publicId]
	);
	return rows[0] ? String(rows[0].id) : null;
}

export async function createOrganisationPosition(input: {
	actor: EvidenceActor;
	positionCode: string;
	jobProfileKey: string;
	titleOverride?: string | null;
	reportsToPublicId?: string | null;
	fte: number;
	validFrom?: string | null;
	validTo?: string | null;
}): Promise<string> {
	await requirePermission(input.actor, 'organisation.structure.manage');
	const code = positionCode(input.positionCode);
	const profileKey = required(input.jobProfileKey, 'Job profile');
	const profile = getJobProfile(profileKey);
	if (!profile) {
		throw new OrganisationStructureValidationError('Select a canonical NuBlox job profile.');
	}
	const titleOverride = input.titleOverride?.trim() || null;
	const validFrom = optionalDate(input.validFrom, 'Valid from');
	const validTo = optionalDate(input.validTo, 'Valid to');
	validateDateRange(validFrom, validTo);
	const fte = fteValue(input.fte);
	const publicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		let reportsToPositionId: string | null = null;
		if (input.reportsToPublicId?.trim()) {
			reportsToPositionId = await positionIdForPublicId(
				connection,
				input.actor.organisationId,
				input.reportsToPublicId.trim()
			);
			if (!reportsToPositionId) {
				throw new OrganisationStructureValidationError('Reporting position was not found.');
			}
		}

		await connection.execute<ResultSetHeader>(
			`INSERT INTO organisation_positions
			 (organisation_id, public_id, position_code, job_profile_key, title_override,
			  reports_to_position_id, fte, valid_from, valid_to, position_status, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
			[
				input.actor.organisationId,
				publicId,
				code,
				profileKey,
				titleOverride,
				reportsToPositionId,
				fte,
				validFrom,
				validTo,
				input.actor.memberId
			]
		);

		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'organisation.position.create',
			subjectType: 'organisation_position',
			subjectPublicId: publicId,
			changeSummary: {
				positionCode: code,
				jobProfileKey: profileKey,
				jobProfileTitle: profile.title,
				reportsToPositionId,
				fte,
				validFrom,
				validTo
			}
		});
		await connection.commit();
		return publicId;
	} catch (cause) {
		await connection.rollback();
		if (
			cause instanceof OrganisationStructureValidationError ||
			cause instanceof OrganisationStructureAccessError
		) {
			throw cause;
		}
		if (typeof cause === 'object' && cause && 'code' in cause && cause.code === 'ER_DUP_ENTRY') {
			throw new OrganisationStructureValidationError('That position code already exists.');
		}
		throw cause;
	} finally {
		connection.release();
	}
}

export async function assignOrganisationMemberToPosition(input: {
	actor: EvidenceActor;
	positionPublicId: string;
	memberPublicId: string;
	assignmentType: 'primary' | 'acting' | 'secondary';
	allocationPercent: number;
	startDate: string;
	endDate?: string | null;
}): Promise<string> {
	await requirePermission(input.actor, 'organisation.structure.manage');
	const assignmentTypes = new Set(['primary', 'acting', 'secondary']);
	if (!assignmentTypes.has(input.assignmentType)) {
		throw new OrganisationStructureValidationError('Assignment type is invalid.');
	}
	const allocation = allocationValue(input.allocationPercent);
	const startDate = requiredDate(input.startDate, 'Start date');
	const endDate = optionalDate(input.endDate, 'End date');
	validateDateRange(startDate, endDate);
	const publicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const positionId = await positionIdForPublicId(
			connection,
			input.actor.organisationId,
			input.positionPublicId
		);
		if (!positionId) throw new OrganisationStructureValidationError('Position was not found.');

		const [memberRows] = await connection.execute<Array<RowDataPacket & { id: string }>>(
			`SELECT id FROM organisation_members
			 WHERE organisation_id = ? AND public_id = ? AND status = 'active'
			 LIMIT 1`,
			[input.actor.organisationId, input.memberPublicId]
		);
		const memberId = memberRows[0] ? String(memberRows[0].id) : null;
		if (!memberId) throw new OrganisationStructureValidationError('Organisation member was not found.');

		if (input.assignmentType === 'primary') {
			const [overlapRows] = await connection.execute<Array<RowDataPacket & { id: string }>>(
				`SELECT id
				 FROM position_assignments
				 WHERE organisation_id = ?
				   AND position_id = ?
				   AND assignment_type = 'primary'
				   AND assignment_status IN ('planned', 'active')
				   AND (end_date IS NULL OR end_date >= ?)
				   AND (? IS NULL OR start_date <= ?)
				 LIMIT 1`,
				[input.actor.organisationId, positionId, startDate, endDate, endDate]
			);
			if (overlapRows.length > 0) {
				throw new OrganisationStructureValidationError(
					'This position already has an overlapping primary assignment.'
				);
			}
		}

		const today = new Date().toISOString().slice(0, 10);
		const status: OrganisationPositionAssignment['status'] =
			startDate > today ? 'planned' : endDate && endDate < today ? 'ended' : 'active';

		await connection.execute<ResultSetHeader>(
			`INSERT INTO position_assignments
			 (organisation_id, public_id, position_id, organisation_member_id, assignment_type,
			  allocation_percent, start_date, end_date, assignment_status, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				publicId,
				positionId,
				memberId,
				input.assignmentType,
				allocation,
				startDate,
				endDate,
				status,
				input.actor.memberId
			]
		);

		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'organisation.position.assign',
			subjectType: 'position_assignment',
			subjectPublicId: publicId,
			changeSummary: {
				positionPublicId: input.positionPublicId,
				memberPublicId: input.memberPublicId,
				assignmentType: input.assignmentType,
				allocationPercent: allocation,
				startDate,
				endDate,
				status
			}
		});
		await connection.commit();
		return publicId;
	} catch (cause) {
		await connection.rollback();
		if (
			cause instanceof OrganisationStructureValidationError ||
			cause instanceof OrganisationStructureAccessError
		) {
			throw cause;
		}
		if (typeof cause === 'object' && cause && 'code' in cause && cause.code === 'ER_DUP_ENTRY') {
			throw new OrganisationStructureValidationError('That position assignment already exists.');
		}
		throw cause;
	} finally {
		connection.release();
	}
}
