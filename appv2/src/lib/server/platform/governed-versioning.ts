import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { EvidenceActor } from './evidence';

export type GovernedVersionStatus = 'draft' | 'published' | 'historical' | 'discarded';
export type GovernedActiveVersionStatus = Exclude<GovernedVersionStatus, 'discarded'>;

export type GovernedVersionCoordinates = {
	major: number;
	minor: number;
	label: string;
	status: GovernedActiveVersionStatus;
};

export function governedVersionCoordinates(input: {
	versionNumber: number;
	minorVersionNumber: number;
	lifecycleStatus: string;
}): GovernedVersionCoordinates {
	const minor = Math.max(0, Number(input.minorVersionNumber));
	if (input.lifecycleStatus === 'draft') {
		const major = Math.max(0, Number(input.versionNumber) - 1);
		return {
			major,
			minor: Math.max(1, minor),
			label: `${major}.${Math.max(1, minor)}`,
			status: 'draft'
		};
	}
	const major = Math.max(0, Number(input.versionNumber));
	const status: GovernedActiveVersionStatus =
		input.lifecycleStatus === 'approved' ? 'published' : 'historical';
	return { major, minor: 0, label: `${major}.0`, status };
}

export function nextMinorVersion(currentMinorVersion: number): number {
	return Math.max(0, Number(currentMinorVersion)) + 1;
}

export async function appendGovernedVersion(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		domainCode: string;
		recordType: string;
		lineageKey: string;
		recordPublicId: string;
		versionNumber: number;
		minorVersionNumber: number;
		lifecycleStatus: string;
		snapshot: Record<string, unknown>;
		changeNote?: string | null;
		published?: boolean;
	}
): Promise<GovernedVersionCoordinates> {
	const version = governedVersionCoordinates({
		versionNumber: input.versionNumber,
		minorVersionNumber: input.minorVersionNumber,
		lifecycleStatus: input.lifecycleStatus
	});
	await connection.execute(
		`INSERT INTO governed_record_versions
			(organisation_id, domain_code, record_type, lineage_key, record_public_id,
			 major_version, minor_version, version_status, snapshot_json, change_note,
			 created_by_member_id, published_by_member_id, published_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE
			 record_public_id = VALUES(record_public_id),
			 version_status = VALUES(version_status),
			 snapshot_json = VALUES(snapshot_json),
			 change_note = VALUES(change_note),
			 published_by_member_id = VALUES(published_by_member_id),
			 published_at = VALUES(published_at)`,
		[
			input.actor.organisationId,
			input.domainCode,
			input.recordType,
			input.lineageKey,
			input.recordPublicId,
			version.major,
			version.minor,
			version.status,
			JSON.stringify(input.snapshot),
			input.changeNote?.trim() || null,
			input.actor.memberId,
			input.published ? input.actor.memberId : null,
			input.published ? new Date() : null
		]
	);
	return version;
}

export async function markPublishedVersionHistorical(
	connection: PoolConnection,
	input: {
		organisationId: string;
		domainCode: string;
		recordType: string;
		lineageKey: string;
		majorVersion: number;
	}
): Promise<void> {
	await connection.execute(
		`UPDATE governed_record_versions
		 SET version_status = 'historical'
		 WHERE organisation_id = ?
		   AND domain_code = ?
		   AND record_type = ?
		   AND lineage_key = ?
		   AND major_version = ?
		   AND minor_version = 0
		   AND version_status = 'published'`,
		[input.organisationId, input.domainCode, input.recordType, input.lineageKey, input.majorVersion]
	);
}

export async function markWorkingVersionDiscarded(
	connection: PoolConnection,
	input: {
		organisationId: string;
		domainCode: string;
		recordType: string;
		recordPublicId: string;
	}
): Promise<void> {
	await connection.execute(
		`UPDATE governed_record_versions
		 SET version_status = 'discarded'
		 WHERE organisation_id = ?
		   AND domain_code = ?
		   AND record_type = ?
		   AND record_public_id = ?
		   AND version_status = 'draft'`,
		[input.organisationId, input.domainCode, input.recordType, input.recordPublicId]
	);
}

export type GovernedVersionHistoryItem = {
	major: number;
	minor: number;
	label: string;
	status: GovernedVersionStatus;
	recordPublicId: string;
	changeNote: string | null;
	createdAt: string;
};

export async function listGovernedVersionHistory(
	connection: PoolConnection,
	input: {
		organisationId: string;
		domainCode: string;
		recordType: string;
		lineageKey: string;
		limit?: number;
	}
): Promise<GovernedVersionHistoryItem[]> {
	const limit = Math.min(Math.max(input.limit ?? 12, 1), 50);
	const [rows] = await connection.query<
		Array<
			RowDataPacket & {
				majorVersion: number | string;
				minorVersion: number | string;
				versionStatus: GovernedVersionStatus;
				recordPublicId: string;
				changeNote: string | null;
				createdAt: Date | string;
			}
		>
	>(
		`SELECT major_version AS majorVersion,
		        minor_version AS minorVersion,
		        version_status AS versionStatus,
		        record_public_id AS recordPublicId,
		        change_note AS changeNote,
		        created_at AS createdAt
		 FROM governed_record_versions
		 WHERE organisation_id = ?
		   AND domain_code = ?
		   AND record_type = ?
		   AND lineage_key = ?
		 ORDER BY major_version DESC, minor_version DESC, id DESC
		 LIMIT ${limit}`,
		[input.organisationId, input.domainCode, input.recordType, input.lineageKey]
	);
	return rows.map((row) => ({
		major: Number(row.majorVersion),
		minor: Number(row.minorVersion),
		label: `${Number(row.majorVersion)}.${Number(row.minorVersion)}`,
		status: row.versionStatus,
		recordPublicId: row.recordPublicId,
		changeNote: row.changeNote,
		createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
	}));
}
