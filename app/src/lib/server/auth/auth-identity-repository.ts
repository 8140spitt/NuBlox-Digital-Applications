import type { DatabaseExecutor } from '$lib/server/db/executor';

export type LinkedPlatformUser = {
	authUserId: string;
	userId: string;
	displayName: string;
	status: string;
};

export class AuthIdentityRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async findActivePlatformUser(authUserId: string): Promise<LinkedPlatformUser | null> {
		const row = await this.db
			.selectFrom('auth_user_links as link')
			.innerJoin('users as user', 'user.id', 'link.user_id')
			.select([
				'link.auth_user_id as authUserId',
				'user.id as userId',
				'user.display_name as displayName',
				'user.status as status'
			])
			.where('link.auth_user_id', '=', authUserId)
			.where('user.status', '=', 'active')
			.executeTakeFirst();

		return row ?? null;
	}
}
