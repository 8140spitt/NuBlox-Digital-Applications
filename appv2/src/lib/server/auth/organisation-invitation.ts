import { createHash, randomUUID } from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';

export const ORGANISATION_INVITATION_COOKIE = 'nublox-v2-organisation-invitation';

type InvitationRow = RowDataPacket & {
	id: string | number;
	public_id: string;
	organisation_id: string | number;
	organisation_public_id: string;
	organisation_name: string;
	email: string;
	auth_user_id: string | null;
	expires_at: Date;
};
type LinkRow = RowDataPacket & { user_id: string | number };
type IdRow = RowDataPacket & { id: string | number; status?: string };
type RoleRow = RowDataPacket & { organisation_role_id: string | number };

export type OrganisationInvitationSummary = {
	publicId: string;
	organisationPublicId: string;
	organisationName: string;
	email: string;
	expiresAt: Date;
};

export class OrganisationInvitationAccessError extends Error {
	readonly code = 'ORGANISATION_INVITATION_ACCESS_DENIED';
	constructor(message = 'The invitation is invalid, expired or cannot be accepted.') {
		super(message);
		this.name = 'OrganisationInvitationAccessError';
	}
}

function normaliseEmail(email: string): string {
	return email.trim().toLowerCase();
}

function tokenHash(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function findPendingInvitation(
	rawToken: string,
	connection: PoolConnection | ReturnType<typeof getPool> = getPool(),
	forUpdate = false
): Promise<InvitationRow | null> {
	const lock = forUpdate ? ' FOR UPDATE' : '';
	const [rows] = await connection.execute<InvitationRow[]>(
		`SELECT invitation.id,
				invitation.public_id,
				invitation.organisation_id,
				invitation.email,
				invitation.auth_user_id,
				invitation.expires_at,
				organisation.public_id AS organisation_public_id,
				organisation.legal_name AS organisation_name
		 FROM organisation_invitations invitation
		 JOIN organisations organisation ON organisation.id = invitation.organisation_id
		 WHERE invitation.token_hash = ?
		   AND invitation.status = 'pending'
		   AND invitation.expires_at > CURRENT_TIMESTAMP(6)
		   AND organisation.status = 'active'
		 LIMIT 1${lock}`,
		[tokenHash(rawToken)]
	);
	return rows[0] ?? null;
}

async function audit(
	connection: PoolConnection,
	input: {
		organisationId: string;
		userId: string;
		memberId: string;
		invitationPublicId: string;
		roleCount: number;
	}
): Promise<void> {
	await connection.execute(
		`INSERT INTO audit_events
			(event_public_id, acting_organisation_id, actor_user_id, actor_member_id,
			 external_auth_user_id, project_id, action_key, subject_type, subject_public_id,
			 correlation_id, change_summary, event_metadata)
		 VALUES (?, ?, ?, ?, NULL, NULL, 'organisation.invitation.accept',
			'organisation_invitation', ?, ?, ?, NULL)`,
		[
			randomUUID(),
			input.organisationId,
			input.userId,
			input.memberId,
			input.invitationPublicId,
			randomUUID(),
			JSON.stringify({ roleCount: input.roleCount })
		]
	);
}

export async function getOrganisationInvitation(
	rawToken: string
): Promise<OrganisationInvitationSummary | null> {
	const invitation = await findPendingInvitation(rawToken);
	if (!invitation) return null;
	return {
		publicId: invitation.public_id,
		organisationPublicId: invitation.organisation_public_id,
		organisationName: invitation.organisation_name,
		email: invitation.email,
		expiresAt: new Date(invitation.expires_at)
	};
}

export async function validateOrganisationInvitationSignup(
	rawToken: string,
	email: string
): Promise<void> {
	const invitation = await findPendingInvitation(rawToken);
	if (!invitation || normaliseEmail(invitation.email) !== normaliseEmail(email)) {
		throw new OrganisationInvitationAccessError();
	}
}

export async function bindOrganisationInvitationAuthUser(input: {
	rawToken: string;
	email: string;
	authUserId: string;
}): Promise<void> {
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const invitation = await findPendingInvitation(input.rawToken, connection, true);
		if (!invitation || normaliseEmail(invitation.email) !== normaliseEmail(input.email)) {
			throw new OrganisationInvitationAccessError();
		}
		if (invitation.auth_user_id && invitation.auth_user_id !== input.authUserId) {
			throw new OrganisationInvitationAccessError();
		}
		await connection.execute(
			`UPDATE organisation_invitations
			 SET auth_user_id = ?
			 WHERE id = ? AND status = 'pending'`,
			[input.authUserId, invitation.id]
		);
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

async function finaliseInvitation(input: {
	invitation: InvitationRow;
	authUserId: string;
	email: string;
	displayName: string;
	connection: PoolConnection;
}): Promise<OrganisationInvitationSummary> {
	const { invitation, connection } = input;
	const email = normaliseEmail(input.email);
	if (normaliseEmail(invitation.email) !== email) throw new OrganisationInvitationAccessError();
	if (invitation.auth_user_id && invitation.auth_user_id !== input.authUserId) {
		throw new OrganisationInvitationAccessError();
	}

	const [links] = await connection.execute<LinkRow[]>(
		'SELECT user_id FROM auth_user_links WHERE auth_user_id = ? LIMIT 1 FOR UPDATE',
		[input.authUserId]
	);
	const [emailOwners] = await connection.execute<LinkRow[]>(
		'SELECT user_id FROM user_emails WHERE LOWER(email) = LOWER(?) LIMIT 1 FOR UPDATE',
		[email]
	);

	let userId = links[0]?.user_id?.toString() ?? null;
	const emailOwnerId = emailOwners[0]?.user_id?.toString() ?? null;
	if (emailOwnerId && userId && emailOwnerId !== userId) {
		throw new OrganisationInvitationAccessError(
			'The verified email is already linked to another NuBlox user.'
		);
	}
	if (emailOwnerId && !userId) {
		throw new OrganisationInvitationAccessError(
			'The verified email already belongs to another NuBlox identity.'
		);
	}

	if (!userId) {
		const [userInsert] = await connection.execute<ResultSetHeader>(
			"INSERT INTO users (public_id, display_name, status) VALUES (?, ?, 'active')",
			[randomUUID(), input.displayName.trim() || email]
		);
		userId = userInsert.insertId.toString();
		await connection.execute(
			`INSERT INTO user_emails (user_id, email, is_primary, is_verified, verified_at)
			 VALUES (?, ?, 1, 1, CURRENT_TIMESTAMP(6))`,
			[userId, email]
		);
		await connection.execute('INSERT INTO auth_user_links (auth_user_id, user_id) VALUES (?, ?)', [
			input.authUserId,
			userId
		]);
	} else if (!emailOwnerId) {
		const [primaryEmails] = await connection.execute<IdRow[]>(
			'SELECT id FROM user_emails WHERE user_id = ? AND is_primary = 1 LIMIT 1',
			[userId]
		);
		await connection.execute(
			`INSERT INTO user_emails (user_id, email, is_primary, is_verified, verified_at)
			 VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP(6))`,
			[userId, email, primaryEmails.length ? 0 : 1]
		);
	}

	const [users] = await connection.execute<IdRow[]>(
		'SELECT id, status FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
		[userId]
	);
	if (!users[0] || users[0].status !== 'active') {
		throw new OrganisationInvitationAccessError('The NuBlox user is not active.');
	}

	const [members] = await connection.execute<IdRow[]>(
		`SELECT id, status
		 FROM organisation_members
		 WHERE organisation_id = ? AND user_id = ?
		 LIMIT 1 FOR UPDATE`,
		[invitation.organisation_id, userId]
	);

	let memberId: string;
	if (!members[0]) {
		const [memberInsert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO organisation_members
				(organisation_id, user_id, public_id, status, joined_at, disabled_at)
			 VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP(6), NULL)`,
			[invitation.organisation_id, userId, randomUUID()]
		);
		memberId = memberInsert.insertId.toString();
	} else {
		memberId = members[0].id.toString();
		if (members[0].status === 'invited') {
			await connection.execute(
				`UPDATE organisation_members
				 SET status = 'active', joined_at = CURRENT_TIMESTAMP(6), disabled_at = NULL
				 WHERE id = ? AND organisation_id = ?`,
				[memberId, invitation.organisation_id]
			);
		} else if (members[0].status !== 'active') {
			throw new OrganisationInvitationAccessError(
				'This membership cannot be reactivated by invitation.'
			);
		}
	}

	const [roles] = await connection.execute<RoleRow[]>(
		`SELECT organisation_role_id
		 FROM organisation_invitation_roles
		 WHERE organisation_id = ? AND organisation_invitation_id = ?`,
		[invitation.organisation_id, invitation.id]
	);
	for (const role of roles) {
		await connection.execute(
			`INSERT IGNORE INTO member_roles
				(organisation_id, organisation_member_id, organisation_role_id)
			 VALUES (?, ?, ?)`,
			[invitation.organisation_id, memberId, role.organisation_role_id]
		);
	}

	await connection.execute(
		`UPDATE organisation_invitations
		 SET status = 'accepted', auth_user_id = ?, accepted_user_id = ?,
			 accepted_at = CURRENT_TIMESTAMP(6), revoked_at = NULL
		 WHERE id = ? AND status = 'pending'`,
		[input.authUserId, userId, invitation.id]
	);

	await audit(connection, {
		organisationId: invitation.organisation_id.toString(),
		userId,
		memberId,
		invitationPublicId: invitation.public_id,
		roleCount: roles.length
	});

	return {
		publicId: invitation.public_id,
		organisationPublicId: invitation.organisation_public_id,
		organisationName: invitation.organisation_name,
		email: invitation.email,
		expiresAt: new Date(invitation.expires_at)
	};
}

export async function acceptOrganisationInvitation(input: {
	rawToken: string;
	authUserId: string;
	email: string;
	displayName: string;
}): Promise<OrganisationInvitationSummary> {
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const invitation = await findPendingInvitation(input.rawToken, connection, true);
		if (!invitation) throw new OrganisationInvitationAccessError();
		const result = await finaliseInvitation({ ...input, invitation, connection });
		await connection.commit();
		return result;
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function activateVerifiedOrganisationInvitation(input: {
	authUserId: string;
	email: string;
	displayName: string;
}): Promise<boolean> {
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const [rows] = await connection.execute<InvitationRow[]>(
			`SELECT invitation.id,
					invitation.public_id,
					invitation.organisation_id,
					invitation.email,
					invitation.auth_user_id,
					invitation.expires_at,
					organisation.public_id AS organisation_public_id,
					organisation.legal_name AS organisation_name
			 FROM organisation_invitations invitation
			 JOIN organisations organisation ON organisation.id = invitation.organisation_id
			 WHERE invitation.auth_user_id = ?
			   AND LOWER(invitation.email) = LOWER(?)
			   AND invitation.status = 'pending'
			   AND invitation.expires_at > CURRENT_TIMESTAMP(6)
			   AND organisation.status = 'active'
			 LIMIT 2 FOR UPDATE`,
			[input.authUserId, input.email]
		);
		if (!rows.length) {
			await connection.rollback();
			return false;
		}
		if (rows.length !== 1) {
			throw new OrganisationInvitationAccessError(
				'Multiple pending organisation invitations were found.'
			);
		}
		await finaliseInvitation({ ...input, invitation: rows[0]!, connection });
		await connection.commit();
		return true;
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}
