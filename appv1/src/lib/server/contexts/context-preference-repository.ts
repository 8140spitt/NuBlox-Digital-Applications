import { sql } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';

export type ContextKind = 'organisation' | 'project' | 'facility' | 'asset';

export type ContextPreferenceRecord = {
	kind: ContextKind;
	publicId: string;
	isFavourite: boolean;
	isPinned: boolean;
	lastOpenedAt: Date | null;
};

type ContextPreferenceRow = {
	context_kind: ContextKind;
	context_public_id: string;
	is_favourite: number;
	is_pinned: number;
	last_opened_at: Date | null;
};

function mapPreference(row: ContextPreferenceRow): ContextPreferenceRecord {
	return {
		kind: row.context_kind,
		publicId: row.context_public_id,
		isFavourite: Boolean(row.is_favourite),
		isPinned: Boolean(row.is_pinned),
		lastOpenedAt: row.last_opened_at
	};
}

export class ContextPreferenceRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listForMember(
		organisationId: string,
		memberId: string
	): Promise<ContextPreferenceRecord[]> {
		const result = await sql<ContextPreferenceRow>`
			SELECT
				context_kind,
				context_public_id,
				is_favourite,
				is_pinned,
				last_opened_at
			FROM member_context_preferences
			WHERE organisation_id = ${organisationId}
			  AND organisation_member_id = ${memberId}
			ORDER BY
				is_pinned DESC,
				is_favourite DESC,
				last_opened_at IS NULL,
				last_opened_at DESC,
				updated_at DESC
		`.execute(this.db);

		return result.rows.map(mapPreference);
	}

	async recordRecent(input: {
		organisationId: string;
		memberId: string;
		kind: ContextKind;
		publicId: string;
		openedAt: Date;
	}): Promise<void> {
		await sql`
			INSERT INTO member_context_preferences (
				organisation_id,
				organisation_member_id,
				context_kind,
				context_public_id,
				last_opened_at
			)
			VALUES (
				${input.organisationId},
				${input.memberId},
				${input.kind},
				${input.publicId},
				${input.openedAt}
			)
			ON DUPLICATE KEY UPDATE
				last_opened_at = VALUES(last_opened_at)
		`.execute(this.db);
	}

	async setPreference(input: {
		organisationId: string;
		memberId: string;
		kind: ContextKind;
		publicId: string;
		isFavourite: boolean;
		isPinned: boolean;
	}): Promise<void> {
		const isPinned = input.isPinned;
		const isFavourite = isPinned || input.isFavourite;
		await sql`
			INSERT INTO member_context_preferences (
				organisation_id,
				organisation_member_id,
				context_kind,
				context_public_id,
				is_favourite,
				is_pinned
			)
			VALUES (
				${input.organisationId},
				${input.memberId},
				${input.kind},
				${input.publicId},
				${isFavourite ? 1 : 0},
				${isPinned ? 1 : 0}
			)
			ON DUPLICATE KEY UPDATE
				is_favourite = VALUES(is_favourite),
				is_pinned = VALUES(is_pinned)
		`.execute(this.db);
	}
}
