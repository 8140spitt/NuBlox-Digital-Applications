import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';

export type PermissionDecision = {
	allowed: boolean;
	reason: 'member-deny' | 'member-allow' | 'role-grant' | 'default-deny';
};

type PermissionRow = RowDataPacket & {
	permissionKey: string;
	effect?: 'allow' | 'deny' | null;
};

function uniquePermissionKeys(permissionKeys: readonly string[]): string[] {
	return [...new Set(permissionKeys.map((key) => key.trim()).filter(Boolean))];
}

export async function decidePermissions(input: {
	organisationId: string;
	memberId: string;
	permissionKeys: readonly string[];
	at?: Date;
}): Promise<Map<string, PermissionDecision>> {
	const permissionKeys = uniquePermissionKeys(input.permissionKeys);
	const decisions = new Map<string, PermissionDecision>();
	if (permissionKeys.length === 0) return decisions;

	const at = input.at ?? new Date();
	const placeholders = permissionKeys.map(() => '?').join(', ');
	const pool = getPool();

	const [overrideRows] = await pool.execute<PermissionRow[]>(
		`SELECT permission.permission_key AS permissionKey,
		        member_override.effect AS effect
		 FROM member_permission_overrides member_override
		 JOIN permissions permission
		   ON permission.id = member_override.permission_id
		  AND permission.is_active = 1
		 LEFT JOIN member_permission_override_access_windows access_window
		   ON access_window.organisation_id = member_override.organisation_id
		  AND access_window.organisation_member_id = member_override.organisation_member_id
		  AND access_window.permission_id = member_override.permission_id
		 WHERE member_override.organisation_id = ?
		   AND member_override.organisation_member_id = ?
		   AND permission.permission_key IN (${placeholders})
		   AND (access_window.effective_from IS NULL OR access_window.effective_from <= ?)
		   AND (access_window.expires_at IS NULL OR access_window.expires_at > ?)`,
		[input.organisationId, input.memberId, ...permissionKeys, at, at]
	);

	const overrideByKey = new Map<string, 'allow' | 'deny'>();
	for (const row of overrideRows) {
		if (row.effect === 'allow' || row.effect === 'deny') {
			overrideByKey.set(row.permissionKey, row.effect);
		}
	}

	const [roleRows] = await pool.execute<PermissionRow[]>(
		`SELECT DISTINCT permission.permission_key AS permissionKey
		 FROM member_roles member_role
		 JOIN organisation_roles role
		   ON role.id = member_role.organisation_role_id
		  AND role.organisation_id = member_role.organisation_id
		  AND role.is_active = 1
		 JOIN role_permissions role_permission
		   ON role_permission.organisation_role_id = member_role.organisation_role_id
		  AND role_permission.organisation_id = member_role.organisation_id
		 JOIN permissions permission
		   ON permission.id = role_permission.permission_id
		  AND permission.is_active = 1
		 LEFT JOIN member_role_access_windows access_window
		   ON access_window.organisation_id = member_role.organisation_id
		  AND access_window.organisation_member_id = member_role.organisation_member_id
		  AND access_window.organisation_role_id = member_role.organisation_role_id
		 WHERE member_role.organisation_id = ?
		   AND member_role.organisation_member_id = ?
		   AND permission.permission_key IN (${placeholders})
		   AND (access_window.effective_from IS NULL OR access_window.effective_from <= ?)
		   AND (access_window.expires_at IS NULL OR access_window.expires_at > ?)`,
		[input.organisationId, input.memberId, ...permissionKeys, at, at]
	);

	const roleGrantKeys = new Set(roleRows.map((row) => row.permissionKey));

	for (const permissionKey of permissionKeys) {
		const override = overrideByKey.get(permissionKey);
		if (override === 'deny') {
			decisions.set(permissionKey, { allowed: false, reason: 'member-deny' });
		} else if (override === 'allow') {
			decisions.set(permissionKey, { allowed: true, reason: 'member-allow' });
		} else if (roleGrantKeys.has(permissionKey)) {
			decisions.set(permissionKey, { allowed: true, reason: 'role-grant' });
		} else {
			decisions.set(permissionKey, { allowed: false, reason: 'default-deny' });
		}
	}

	return decisions;
}

export async function hasPermission(input: {
	organisationId: string;
	memberId: string;
	permissionKey: string;
	at?: Date;
}): Promise<boolean> {
	const decisions = await decidePermissions({
		organisationId: input.organisationId,
		memberId: input.memberId,
		permissionKeys: [input.permissionKey],
		at: input.at
	});
	return decisions.get(input.permissionKey)?.allowed === true;
}
