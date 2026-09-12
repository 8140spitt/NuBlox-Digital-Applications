export type Actor = {
	authUserId: string;
	userId: string;
	email: string;
	displayName: string;
};

export type TenantContext = {
	organisationId: string | null;
	organisationPublicId: string | null;
	memberId: string | null;
	membershipVerified: boolean;
};

export type RequestContext = {
	actor: Actor | null;
	correlationId: string;
	tenant: TenantContext;
};
