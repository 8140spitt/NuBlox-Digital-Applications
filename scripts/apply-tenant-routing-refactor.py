from pathlib import Path


def edit(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"pattern missing in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, count))


edit('.github/workflows/database-migration-validation.yml', "test \"$fk_count\" = '1476'", "test \"$fk_count\" = '1478'")

edit('app/src/lib/server/organisations/bootstrap-service.ts',
     "import type { DatabaseExecutor } from '$lib/server/db/executor';\n",
     "import type { DatabaseExecutor } from '$lib/server/db/executor';\nimport { allocateOrganisationRouteSlug } from '$lib/server/routing/route-context-service';\n")
edit('app/src/lib/server/organisations/bootstrap-service.ts',
     "\t\tconst organisationPublicId = randomUUID();\n\t\tconst organisationInsert = await executor",
     "\t\tconst organisationPublicId = randomUUID();\n\t\tconst organisationRouteSlug = await allocateOrganisationRouteSlug(\n\t\t\texecutor,\n\t\t\tdetails.tradingName ?? details.legalName\n\t\t);\n\t\tconst organisationInsert = await executor")
edit('app/src/lib/server/organisations/bootstrap-service.ts',
     "\t\t\t\tpublic_id: organisationPublicId,\n\t\t\t\tlegal_name: details.legalName,",
     "\t\t\t\tpublic_id: organisationPublicId,\n\t\t\t\troute_slug: organisationRouteSlug,\n\t\t\t\tlegal_name: details.legalName,")

edit('app/src/lib/server/crm/crm-repository.ts',
     "import type { DatabaseExecutor } from '$lib/server/db/executor';\n",
     "import type { DatabaseExecutor } from '$lib/server/db/executor';\nimport { allocatePartyRouteSlug } from '$lib/server/routing/route-context-service';\n")
old = """\tasync insertParty(input: {
\t\torganisationId: string;
\t\tpublicId: string;
\t\tkind: CrmPartyKind;
\t\taccountOwnerMemberId: string;
\t}): Promise<string> {
\t\treturn insertedId(
\t\t\tawait this.db
\t\t\t\t.insertInto('parties')
\t\t\t\t.values({
\t\t\t\t\torganisation_id: input.organisationId,
\t\t\t\t\tpublic_id: input.publicId,
\t\t\t\t\tparty_kind: input.kind,
\t\t\t\t\taccount_owner_member_id: input.accountOwnerMemberId,
\t\t\t\t\tstatus: 'active'
\t\t\t\t})
\t\t\t\t.executeTakeFirstOrThrow()
\t\t);
\t}
"""
new = """\tasync insertParty(input: {
\t\torganisationId: string;
\t\tpublicId: string;
\t\tkind: CrmPartyKind;
\t\taccountOwnerMemberId: string;
\t\trouteName?: string | null;
\t}): Promise<string> {
\t\tconst routeSlug = input.routeName
\t\t\t? await allocatePartyRouteSlug(this.db, input.organisationId, input.routeName)
\t\t\t: null;
\t\treturn insertedId(
\t\t\tawait this.db
\t\t\t\t.insertInto('parties')
\t\t\t\t.values({
\t\t\t\t\torganisation_id: input.organisationId,
\t\t\t\t\tpublic_id: input.publicId,
\t\t\t\t\troute_slug: routeSlug,
\t\t\t\t\tparty_kind: input.kind,
\t\t\t\t\taccount_owner_member_id: input.accountOwnerMemberId,
\t\t\t\t\tstatus: 'active'
\t\t\t\t})
\t\t\t\t.executeTakeFirstOrThrow()
\t\t);
\t}
"""
edit('app/src/lib/server/crm/crm-repository.ts', old, new)
edit('app/src/lib/server/crm/crm-service.ts',
     "\t\t\tkind: input.kind,\n\t\t\taccountOwnerMemberId: membership.id\n\t\t});",
     "\t\t\tkind: input.kind,\n\t\t\taccountOwnerMemberId: membership.id,\n\t\t\trouteName:\n\t\t\t\tinput.kind === 'organisation'\n\t\t\t\t\t? input.tradingName ?? input.legalName\n\t\t\t\t\t: [input.preferredName ?? input.givenNames, input.familyName].filter(Boolean).join(' ')\n\t\t});")
edit('app/src/lib/server/crm/crm-organisation-onboarding-service.ts',
     "\t\t\t\tkind: 'organisation',\n\t\t\t\taccountOwnerMemberId: membership.id\n\t\t\t});",
     "\t\t\t\tkind: 'organisation',\n\t\t\t\taccountOwnerMemberId: membership.id,\n\t\t\t\trouteName: tradingName ?? legalName\n\t\t\t});")
edit('app/src/lib/server/crm/crm-organisation-onboarding-service.ts',
     "\t\t\t\tkind: 'person',\n\t\t\t\taccountOwnerMemberId: membership.id\n\t\t\t});",
     "\t\t\t\tkind: 'person',\n\t\t\t\taccountOwnerMemberId: membership.id,\n\t\t\t\trouteName: [contactPreferredName ?? contactGivenNames, contactFamilyName]\n\t\t\t\t\t.filter(Boolean)\n\t\t\t\t\t.join(' ')\n\t\t\t});")

edit('app/src/lib/server/external-access/external-invitation-service.ts',
     "\towningOrganisationId: string;\n\tinviteEmail: string;",
     "\towningOrganisationId: string;\n\tpartyId: string;\n\tinviteEmail: string;")
edit('app/src/lib/server/external-access/external-invitation-service.ts',
     "\t\t\t\towning_organisation_id: input.owningOrganisationId,\n\t\t\t\tinvite_email: email,",
     "\t\t\t\towning_organisation_id: input.owningOrganisationId,\n\t\t\t\tparty_id: input.partyId,\n\t\t\t\tinvite_email: email,")
edit('app/src/lib/server/external-access/external-invitation-service.ts',
     "\t\t\tinvitedByMemberId: string;\n\t\t}\n\t): Promise<void> {",
     "\t\t\tinvitedByMemberId: string;\n\t\t\tpartyId: string | null;\n\t\t}\n\t): Promise<void> {")
edit('app/src/lib/server/external-access/external-invitation-service.ts',
     "\t\t\t\towning_organisation_id: invitation.owningOrganisationId,\n\t\t\t\tauth_user_id: invitation.authUserId,",
     "\t\t\t\towning_organisation_id: invitation.owningOrganisationId,\n\t\t\t\tparty_id: invitation.partyId,\n\t\t\t\tauth_user_id: invitation.authUserId,")
edit('app/src/lib/server/external-access/external-invitation-service.ts',
     "\t\t\t.onDuplicateKeyUpdate({\n\t\t\t\tinvitation_id: invitation.id,",
     "\t\t\t.onDuplicateKeyUpdate({\n\t\t\t\tparty_id: invitation.partyId,\n\t\t\t\tinvitation_id: invitation.id,")
edit('app/src/lib/server/external-access/external-invitation-service.ts',
     "\t\t\t\t'owning_organisation_id as owningOrganisationId',\n\t\t\t\t'auth_user_id as authUserId',",
     "\t\t\t\t'owning_organisation_id as owningOrganisationId',\n\t\t\t\t'party_id as partyId',\n\t\t\t\t'auth_user_id as authUserId',")
edit('app/src/lib/server/procurement/supplier-rfq-network-service.ts',
     "\t\t\t\towningOrganisationId: actor.organisationId,\n\t\t\t\tinviteEmail: supplier.primaryEmail,",
     "\t\t\t\towningOrganisationId: actor.organisationId,\n\t\t\t\tpartyId: supplier.id,\n\t\t\t\tinviteEmail: supplier.primaryEmail,")

edit('app/src/lib/server/projects/project-external-collaboration-service.ts',
     "\t\t\t\t\towning_organisation_id: invitation.ownerId,\n\t\t\t\t\tauth_user_id: authUserId,",
     "\t\t\t\t\towning_organisation_id: invitation.ownerId,\n\t\t\t\t\tparty_id: invitation.companyPartyId ?? invitation.personPartyId,\n\t\t\t\t\tauth_user_id: authUserId,")
edit('app/src/lib/server/projects/project-external-collaboration-service.ts',
     "\t\t\t\t.onDuplicateKeyUpdate({\n\t\t\t\t\tvalid_from: at,",
     "\t\t\t\t.onDuplicateKeyUpdate({\n\t\t\t\t\tparty_id: invitation.companyPartyId ?? invitation.personPartyId,\n\t\t\t\t\tvalid_from: at,", 1)

edit('app/src/lib/server/projects/project-external-action-service.ts',
     "\t\t\t\t'auth_user_id as authUserId',\n\t\t\t\t'invite_email as email'",
     "\t\t\t\t'auth_user_id as authUserId',\n\t\t\t\t'crm_person_party_id as personPartyId',\n\t\t\t\t'crm_organisation_party_id as organisationPartyId',\n\t\t\t\t'invite_email as email'")
edit('app/src/lib/server/projects/project-external-action-service.ts',
     "\t\t\tcreatedByMemberId: string;\n\t\t\tcontextPublicId: string;",
     "\t\t\tcreatedByMemberId: string;\n\t\t\tpartyId: string;\n\t\t\tcontextPublicId: string;")
edit('app/src/lib/server/projects/project-external-action-service.ts',
     "\t\t\t\towning_organisation_id: input.owningOrganisationId,\n\t\t\t\tauth_user_id: input.authUserId,",
     "\t\t\t\towning_organisation_id: input.owningOrganisationId,\n\t\t\t\tparty_id: input.partyId,\n\t\t\t\tauth_user_id: input.authUserId,")
edit('app/src/lib/server/projects/project-external-action-service.ts',
     "\t\t\t.onDuplicateKeyUpdate({\n\t\t\t\tvalid_from: at,",
     "\t\t\t.onDuplicateKeyUpdate({\n\t\t\t\tparty_id: input.partyId,\n\t\t\t\tvalid_from: at,", 1)
edit('app/src/lib/server/projects/project-external-action-service.ts',
     "\t\t\tcreatedByMemberId: string;\n\t\t\tprojectPublicId: string;",
     "\t\t\tcreatedByMemberId: string;\n\t\t\tpartyId: string;\n\t\t\tprojectPublicId: string;")
edit('app/src/lib/server/projects/project-external-action-service.ts',
     "\t\t\t\tcreatedByMemberId: membership.id,\n\t\t\t\tprojectPublicId: project.publicId",
     "\t\t\t\tcreatedByMemberId: membership.id,\n\t\t\t\tpartyId: collaborator.organisationPartyId ?? collaborator.personPartyId,\n\t\t\t\tprojectPublicId: project.publicId")
edit('app/src/lib/server/projects/project-external-action-service.ts',
     "\t\t\t\tcreatedByMemberId: membership.id,\n\t\t\t\tcontextPublicId: project.publicId,",
     "\t\t\t\tcreatedByMemberId: membership.id,\n\t\t\t\tpartyId: collaborator.organisationPartyId ?? collaborator.personPartyId,\n\t\t\t\tcontextPublicId: project.publicId,")

edit('app/src/routes/api/tenant/select/+server.ts',
     "\treturn json({ organisationPublicId: membership.organisationPublicId });",
     "\treturn json({ organisationPublicId: membership.organisationPublicId, organisationRouteSlug: membership.organisationRouteSlug });")
edit('app/src/routes/(auth)/select-organisation/+page.server.ts',
     "import { ProjectExternalCollaborationService } from '$lib/server/projects/project-external-collaboration-service';\n",
     "import { ProjectExternalCollaborationService } from '$lib/server/projects/project-external-collaboration-service';\nimport { RouteContextService } from '$lib/server/routing/route-context-service';\n")
edit('app/src/routes/(auth)/select-organisation/+page.server.ts',
     "\t\tif (hasNetworkAccess || externalProjects.length > 0) throw redirect(303, '/portal');",
     "\t\tif (hasNetworkAccess || externalProjects.length > 0) {\n\t\t\tconst portal = await new RouteContextService(db).defaultPortalDashboard(locals.actor.authUserId);\n\t\t\tif (portal) throw redirect(303, portal);\n\t\t}")
edit('app/src/routes/(auth)/select-organisation/+page.svelte',
     "\t\tawait goto('/dashboard', { invalidateAll: true });",
     "\t\tconst selected = await response.json();\n\t\tconst slug = selected.organisationRouteSlug;\n\t\tawait goto(slug ? `/${slug}/dashboard` : '/select-organisation', { invalidateAll: true });")

edit('app/e2e/seed-authenticated-fixture.mjs',
     "(public_id, legal_name, default_timezone, default_currency_code, status)\n\t\tVALUES (?, ?, ?, ?, ?)`",
     "(public_id, route_slug, legal_name, default_timezone, default_currency_code, status)\n\t\tVALUES (?, 'nublox', ?, ?, ?, ?)`", 1)

p = Path('app/src/routes/portal/+page.svelte')
s = p.read_text()
s = s.replace('NuBlox Network', 'Portal')
s = s.replace("{data.mode === 'external' ? 'Your shared work' : 'Network & collaboration'}", "{data.mode === 'external' ? `${data.party?.name ?? 'External'} dashboard` : 'Portal sharing controls'}")
s = s.replace('Network evaluates each grant, context, record and permitted action independently.', 'Each grant, context, record and permitted action is evaluated independently.')
s = s.replace('Network summary', 'Portal summary')
p.write_text(s)
