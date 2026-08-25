from pathlib import Path
import re


def sub1(path: str, pattern: str, repl: str, flags: int = re.S) -> None:
    target = Path(path)
    text = target.read_text()
    updated, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"Expected one replacement in {path}, got {count}: {pattern[:120]}")
    target.write_text(updated)


# The project-team suite tests genuine NuBlox organisation participation. Remove the obsolete CRM link fixture.
path = Path("app/src/lib/server/projects/project-team-administration.integration.test.ts")
text = path.read_text()
text = text.replace("\nlet crmOrganisationBPublicId = '';", "")
text = re.sub(
    r"\n\tcrmOrganisationBPublicId = randomUUID\(\);.*?\n\tawait assignPermissionRole\(organisationBId, memberBManagerId, 'External Manager',",
    "\n\tawait assignPermissionRole(organisationBId, memberBManagerId, 'External Manager',",
    text,
    count=1,
    flags=re.S,
)
text = re.sub(
    r"\tit\('invites a linked CRM organisation without granting project scope before acceptance', async \(\) => \{.*?\n\t\}\);\n\n\tit\('records an explicit decline",
    """\tit('invites a NuBlox organisation explicitly without granting project scope before acceptance', async () => {
\t\tconst service = new ProjectTeamService(db);
\t\tawait service.inviteParticipant(actorA, {
\t\t\tprojectPublicId,
\t\t\torganisationPublicId: organisationBPublicId,
\t\t\troleKeys: ['main_contractor']
\t\t});

\t\tconst invitations = await service.listPendingInvitations(actorBManager);
\t\texpect(invitations).toHaveLength(1);
\t\texpect(invitations[0]).toMatchObject({
\t\t\tprojectPublicId,
\t\t\tprojectName: 'Participant administration project'
\t\t});
\t\texpect(invitations[0]?.roles.map((role) => role.roleKey)).toEqual(['main_contractor']);
\t\tawait expect(
\t\t\tnew ProjectWorkspaceService(db).getWorkspace(actorBManager, projectPublicId)
\t\t).rejects.toBeInstanceOf(RecordNotFoundError);
\t});

\tit('records an explicit decline""",
    text,
    count=1,
    flags=re.S,
)
path.write_text(text)

# Carry the private CRM organisation public id accurately in the management view.
path = Path("app/src/lib/server/projects/project-external-collaboration-service.ts")
text = path.read_text()
text = text.replace(
    "\t\t\t.leftJoin(\n\t\t\t\t'party_organisations as company',\n\t\t\t\t'company.party_id',\n\t\t\t\t'collaborator.crm_organisation_party_id'\n\t\t\t)",
    "\t\t\t.leftJoin(\n\t\t\t\t'parties as company_party',\n\t\t\t\t'company_party.id',\n\t\t\t\t'collaborator.crm_organisation_party_id'\n\t\t\t)\n\t\t\t.leftJoin('party_organisations as company', 'company.party_id', 'company_party.id')",
    1,
)
text = text.replace(
    "\t\t\t\t'company.party_id as companyPartyId',",
    "\t\t\t\t'company_party.public_id as companyPublicId',",
    1,
)
text = text.replace(
    "organisationPartyPublicId: row.companyPartyId ? null : null,",
    "organisationPartyPublicId: row.companyPublicId ?? null,",
    1,
)
path.write_text(text)

# Clarify the schema package: future sharing does not alter private CRM identity semantics.
path = Path("database/docs/002-crm-parties.md")
text = path.read_text()
old = "If the same external contractor is known to two different NuBlox organisations, each tenant maintains its own private CRM record unless a later NuBlox Network feature explicitly links identities with controlled consent and sharing rules.\n\nThis avoids creating an unintended global customer/contact directory and protects private relationship data."
new = "If the same external contractor is known to two different NuBlox organisations, each tenant maintains its own private CRM record. CRM people and companies never map to NuBlox platform organisations. Any future consent-based network or sharing capability must preserve these private party identities rather than reconciling them into a platform-wide company record.\n\nThis avoids creating an unintended global customer/contact directory and protects private relationship data."
if old not in text:
    raise SystemExit("CRM tenant-boundary paragraph was not found")
path.write_text(text.replace(old, new, 1))
