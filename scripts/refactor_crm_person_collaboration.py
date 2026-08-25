from pathlib import Path
import re


def sub1(path: str, pattern: str, repl: str, flags: int = re.S) -> None:
    target = Path(path)
    text = target.read_text()
    updated, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(
            f"Expected exactly one replacement in {path}, got {count}: {pattern[:120]}"
        )
    target.write_text(updated)


# CRM repository: remove every CRM-to-platform organisation linkage type/query.
sub1(
    "app/src/lib/server/crm/crm-repository.ts",
    r"\nexport type CrmPlatformOrganisationLink = \{.*?\n\};\n\nexport type CrmCollaborationOrganisation = \{.*?\n\};\n",
    "\n",
)
sub1(
    "app/src/lib/server/crm/crm-repository.ts",
    r"\n\tasync findPlatformOrganisationLink\(.*?\n\tasync listOrganisationContacts\(",
    "\n\tasync listOrganisationContacts(",
)

# CRM service: party/customer workspaces no longer expose or mutate platform links.
path = Path("app/src/lib/server/crm/crm-service.ts")
text = path.read_text()
text = text.replace("\n\ttype CrmPlatformOrganisationLink,", "")
text = text.replace("\n\tplatformOrganisationLink: CrmPlatformOrganisationLink | null;", "")
path.write_text(text)
sub1(
    "app/src/lib/server/crm/crm-service.ts",
    r"\n\t\tconst platformOrganisationLinkPromise =.*?\n\t\tconst \[roleTypes, contacts, affiliations, candidateRows, platformOrganisationLink\] =\n\t\t\tawait Promise\.all\(\[.*?\n\t\t\t\]\);",
    "\n\t\tconst [roleTypes, contacts, affiliations, candidateRows] = await Promise.all([\n"
    "\t\t\troleTypesPromise,\n"
    "\t\t\tcontactsPromise,\n"
    "\t\t\taffiliationsPromise,\n"
    "\t\t\tcandidatesPromise\n"
    "\t\t]);",
)
path = Path("app/src/lib/server/crm/crm-service.ts")
text = path.read_text().replace(
    ",\n\t\t\tplatformOrganisationLink\n\t\t};", "\n\t\t};"
)
path.write_text(text)
sub1(
    "app/src/lib/server/crm/crm-service.ts",
    r"\n\tasync linkPlatformOrganisation\(.*?\n\tasync createOrganisationContact\(",
    "\n\tasync createOrganisationContact(",
)

# Project-team administration retains true NuBlox organisation participation, but CRM is no longer its directory.
path = Path("app/src/lib/server/projects/project-team-service.ts")
text = path.read_text()
text = text.replace(
    "import { CrmRepository, type CrmCollaborationOrganisation } from '$lib/server/crm/crm-repository';\n",
    "",
)
text = text.replace("\n\tinvitationCandidates: CrmCollaborationOrganisation[];", "")
text = text.replace(
    "const [teamDecision, participantDecision, participationDecision, crmViewDecision] =",
    "const [teamDecision, participantDecision, participationDecision] =",
)
text = text.replace(
    "\n\t\t\t\t),\n\t\t\t\tpermissionService.decide(actor, 'crm.view')\n\t\t\t]);",
    "\n\t\t\t\t)\n\t\t\t]);",
)
path.write_text(text)
sub1(
    "app/src/lib/server/projects/project-team-service.ts",
    r"\n\t\tconst collaborationOrganisations =.*?\n\n\t\treturn \{",
    "\n\n\t\treturn {",
)
sub1(
    "app/src/lib/server/projects/project-team-service.ts",
    r"\n\t\t\troleTypes,\n\t\t\tinvitationCandidates: collaborationOrganisations\.filter\(.*?\n\t\t\t\),\n\t\t\townOrganisationPublicId:",
    "\n\t\t\troleTypes,\n\t\t\townOrganisationPublicId:",
)
sub1(
    "app/src/lib/server/projects/project-team-service.ts",
    r"\n\tasync inviteCrmParticipant\(.*?\n\tasync inviteParticipant\(",
    "\n\tasync inviteParticipant(",
)

# Project workspace: load/manage person-level external collaborators separately from project organisations.
path = Path("app/src/routes/(app)/projects/[projectPublicId]/+page.server.ts")
text = path.read_text()
text = text.replace(
    "import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';",
    "import {\n"
    "\tProjectExternalCollaborationService,\n"
    "\tProjectExternalCollaborationValidationError\n"
    "} from '$lib/server/projects/project-external-collaboration-service';\n"
    "import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';",
)
text = text.replace(
    "if (error instanceof ProjectTeamValidationError) {",
    "if (\n"
    "\t\terror instanceof ProjectTeamValidationError ||\n"
    "\t\terror instanceof ProjectExternalCollaborationValidationError\n"
    "\t) {",
)
text = text.replace(
    "\t\tconst team = await new ProjectTeamService(db).getTeamView(actor, params.projectPublicId);\n"
    "\t\treturn { ...workspace, team };",
    "\t\tconst team = await new ProjectTeamService(db).getTeamView(actor, params.projectPublicId);\n"
    "\t\tlet externalCollaboration = {\n"
    "\t\t\tcanManage: false,\n"
    "\t\t\troleTypes: [],\n"
    "\t\t\tcandidates: [],\n"
    "\t\t\tcollaborators: [],\n"
    "\t\t\tpendingInvitations: []\n"
    "\t\t};\n"
    "\t\tif (team.canManageParticipants) {\n"
    "\t\t\ttry {\n"
    "\t\t\t\texternalCollaboration = await new ProjectExternalCollaborationService(db).getManagementView(\n"
    "\t\t\t\t\tactor,\n"
    "\t\t\t\t\tparams.projectPublicId\n"
    "\t\t\t\t);\n"
    "\t\t\t} catch (cause) {\n"
    "\t\t\t\tif (!(cause instanceof ProjectExternalCollaborationValidationError)) throw cause;\n"
    "\t\t\t}\n"
    "\t\t}\n"
    "\t\treturn { ...workspace, team, externalCollaboration };",
)
path.write_text(text)
sub1(
    "app/src/routes/(app)/projects/[projectPublicId]/+page.server.ts",
    r"\n\tinviteParticipant: async \(\{ request, locals, params \}\) => \{.*?\n\t\},\n\n\tupdateParticipantRoles:",
    """
\tinviteExternal: async ({ request, locals, params }) => {
\t\tconst actor = actorFromLocals(locals);
\t\tif (!actor)
\t\t\treturn fail(
\t\t\t\t401,
\t\t\t\tactionFailure({ teamError: 'Authentication is required.', teamAction: 'external-invite' })
\t\t\t);
\t\tconst data = await request.formData();
\t\tconst [personPartyPublicId = '', organisationPartyPublicId = ''] = String(
\t\t\tdata.get('candidate') ?? ''
\t\t).split('|', 2);
\t\ttry {
\t\t\tawait new ProjectExternalCollaborationService(getDatabase()).invite(actor, {
\t\t\t\tprojectPublicId: params.projectPublicId,
\t\t\t\tpersonPartyPublicId,
\t\t\t\torganisationPartyPublicId: organisationPartyPublicId || null,
\t\t\t\troleKeys: roleKeys(data)
\t\t\t});
\t\t} catch (cause) {
\t\t\treturn teamFailure(cause, 'external-invite');
\t\t}
\t\tthrow redirect(
\t\t\t303,
\t\t\t`/projects/${encodeURIComponent(params.projectPublicId)}#external-collaborators`
\t\t);
\t},

\trevokeExternalInvitation: async ({ request, locals, params }) => {
\t\tconst actor = actorFromLocals(locals);
\t\tconst data = await request.formData();
\t\tconst invitationPublicId = String(data.get('invitationPublicId') ?? '');
\t\tconst marker = `external-invitation-${invitationPublicId}`;
\t\tif (!actor)
\t\t\treturn fail(401, actionFailure({ teamError: 'Authentication is required.', teamAction: marker }));
\t\ttry {
\t\t\tawait new ProjectExternalCollaborationService(getDatabase()).revokeInvitation(
\t\t\t\tactor,
\t\t\t\tparams.projectPublicId,
\t\t\t\tinvitationPublicId
\t\t\t);
\t\t} catch (cause) {
\t\t\treturn teamFailure(cause, marker);
\t\t}
\t\tthrow redirect(
\t\t\t303,
\t\t\t`/projects/${encodeURIComponent(params.projectPublicId)}#external-collaborators`
\t\t);
\t},

\tremoveExternalCollaborator: async ({ request, locals, params }) => {
\t\tconst actor = actorFromLocals(locals);
\t\tconst data = await request.formData();
\t\tconst collaboratorPublicId = String(data.get('collaboratorPublicId') ?? '');
\t\tconst marker = `external-${collaboratorPublicId}`;
\t\tif (!actor)
\t\t\treturn fail(401, actionFailure({ teamError: 'Authentication is required.', teamAction: marker }));
\t\ttry {
\t\t\tawait new ProjectExternalCollaborationService(getDatabase()).removeCollaborator(
\t\t\t\tactor,
\t\t\t\tparams.projectPublicId,
\t\t\t\tcollaboratorPublicId
\t\t\t);
\t\t} catch (cause) {
\t\t\treturn teamFailure(cause, marker);
\t\t}
\t\tthrow redirect(
\t\t\t303,
\t\t\t`/projects/${encodeURIComponent(params.projectPublicId)}#external-collaborators`
\t\t);
\t},

\tupdateParticipantRoles:""",
)

# Project UI: CRM people are invited as external collaborators, never as organisations.
path = Path("app/src/routes/(app)/projects/[projectPublicId]/+page.svelte")
text = path.read_text().replace(
    "form.teamAction === 'invite-participant' || form.teamAction.startsWith('participant-')",
    "form.teamAction.startsWith('participant-')",
)
path.write_text(text)
external_markup = r'''
\t</section>

\t<section id="external-collaborators" class="panel participants">
\t\t<div class="panel-heading">
\t\t\t<div>
\t\t\t\t<p class="eyebrow">External collaboration</p>
\t\t\t\t<h2>Customer and contact collaborators</h2>
\t\t\t</div>
\t\t\t<span class="count">{data.externalCollaboration.collaborators.length}</span>
\t\t</div>
\t\t<p class="hint">
\t\t\tAccess is granted to authenticated people for this project. CRM organisations remain private
\t\t\trelationship records and are never linked to NuBlox organisations.
\t\t</p>

\t\t{#if form?.teamError && form.teamAction.startsWith('external')}
\t\t\t<p class="error" role="alert">{form.teamError}</p>
\t\t{/if}

\t\t<div class="participant-list">
\t\t\t{#each data.externalCollaboration.collaborators as collaborator}
\t\t\t\t<article class="participant-card">
\t\t\t\t\t<div class="participant-summary">
\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t<strong>{collaborator.personName}</strong>
\t\t\t\t\t\t\t<small>{collaborator.email}</small>
\t\t\t\t\t\t\t{#if collaborator.organisationName}<small>CRM affiliation · {collaborator.organisationName}</small>{/if}
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<span class="participant-status participant-active">Active</span>
\t\t\t\t\t</div>
\t\t\t\t\t<div class="role-list">
\t\t\t\t\t\t{#each collaborator.roles as role}<span>{role.name}</span>{/each}
\t\t\t\t\t</div>
\t\t\t\t\t{#if data.externalCollaboration.canManage}
\t\t\t\t\t\t<form method="POST" action="?/removeExternalCollaborator">
\t\t\t\t\t\t\t<input type="hidden" name="collaboratorPublicId" value={collaborator.publicId} />
\t\t\t\t\t\t\t<button class="danger" type="submit">Remove external access</button>
\t\t\t\t\t\t</form>
\t\t\t\t\t{/if}
\t\t\t\t</article>
\t\t\t{/each}
\t\t</div>

\t\t{#if data.externalCollaboration.pendingInvitations.length}
\t\t\t<h3>Pending invitations</h3>
\t\t\t<div class="participant-list">
\t\t\t\t{#each data.externalCollaboration.pendingInvitations as invitation}
\t\t\t\t\t<article class="participant-card">
\t\t\t\t\t\t<div class="participant-summary">
\t\t\t\t\t\t\t<div>
\t\t\t\t\t\t\t\t<strong>{invitation.personName}</strong>
\t\t\t\t\t\t\t\t<small>{invitation.email}</small>
\t\t\t\t\t\t\t\t{#if invitation.organisationName}<small>CRM affiliation · {invitation.organisationName}</small>{/if}
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<span class="participant-status participant-invited">Invited</span>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div class="role-list">
\t\t\t\t\t\t\t{#each invitation.roles as role}<span>{role.name}</span>{/each}
\t\t\t\t\t\t</div>
\t\t\t\t\t\t{#if data.externalCollaboration.canManage}
\t\t\t\t\t\t\t<form method="POST" action="?/revokeExternalInvitation">
\t\t\t\t\t\t\t\t<input type="hidden" name="invitationPublicId" value={invitation.publicId} />
\t\t\t\t\t\t\t\t<button class="danger" type="submit">Revoke invitation</button>
\t\t\t\t\t\t\t</form>
\t\t\t\t\t\t{/if}
\t\t\t\t\t</article>
\t\t\t\t{/each}
\t\t\t</div>
\t\t{/if}

\t\t{#if data.externalCollaboration.canManage}
\t\t\t<form method="POST" action="?/inviteExternal" class="invite-form">
\t\t\t\t<h3>Invite external person</h3>
\t\t\t\t<p class="hint">
\t\t\t\t\tChoose a direct person customer or a contact at a CRM organisation. The invitation belongs
\t\t\t\t\tto that person.
\t\t\t\t</p>
\t\t\t\t{#if data.externalCollaboration.candidates.length === 0}
\t\t\t\t\t<p class="hint">
\t\t\t\t\t\tNo active CRM people with primary email addresses are available.
\t\t\t\t\t\t<a href="/crm?kind=person&status=active">Open Customers</a>.
\t\t\t\t\t</p>
\t\t\t\t{:else}
\t\t\t\t\t<label>
\t\t\t\t\t\t<span>Person</span>
\t\t\t\t\t\t<select name="candidate" required>
\t\t\t\t\t\t\t<option value="">Select person</option>
\t\t\t\t\t\t\t{#each data.externalCollaboration.candidates as candidate}
\t\t\t\t\t\t\t\t<option value={`${candidate.personPartyPublicId}|${candidate.organisationPartyPublicId ?? ''}`}>
\t\t\t\t\t\t\t\t\t{candidate.personName} · {candidate.email}{candidate.organisationName
\t\t\t\t\t\t\t\t\t\t? ` · ${candidate.organisationName}`
\t\t\t\t\t\t\t\t\t\t: ' · direct person customer/contact'}
\t\t\t\t\t\t\t\t</option>
\t\t\t\t\t\t\t{/each}
\t\t\t\t\t\t</select>
\t\t\t\t\t</label>
\t\t\t\t\t<label>
\t\t\t\t\t\t<span>Project roles</span>
\t\t\t\t\t\t<select name="roleKeys" multiple size="6" required>
\t\t\t\t\t\t\t{#each data.externalCollaboration.roleTypes as role}<option value={role.roleKey}>{role.name}</option>{/each}
\t\t\t\t\t\t</select>
\t\t\t\t\t</label>
\t\t\t\t\t<button type="submit">Send personal project invitation</button>
\t\t\t\t{/if}
\t\t\t</form>
\t\t{/if}
\t</section>

\t<section id="team"'''
sub1(
    "app/src/routes/(app)/projects/[projectPublicId]/+page.svelte",
    r"\n\t\t\{#if data\.team\.canManageParticipants\}\n\t\t\t<form method=\"POST\" action=\"\?/inviteParticipant\" class=\"invite-form\">.*?\n\t\t\{/if\}\n\t</section>\n\n\t<section id=\"team\"",
    external_markup,
)

# CRM party route/UI: remove all explicit platform-link actions and screen content.
sub1(
    "app/src/routes/(app)/crm/[partyPublicId]/+page.server.ts",
    r"\n\tlinkPlatformOrganisation: async .*?\n\tunlinkPlatformOrganisation: async .*?\n\t\},\n\n\tcreateContact:",
    "\n\tcreateContact:",
)
sub1(
    "app/src/routes/(app)/crm/[partyPublicId]/+page.svelte",
    r"\n\t\{#if data\.party\.kind === 'organisation'\}\n\t\t<section id=\"nublox-link\".*?\n\t\{/if\}\n\n(?=\t\{#if data\.party\.kind === 'organisation'\}\n\t\t<section id=\"contacts\")",
    "\n",
)
path = Path("app/src/routes/(app)/crm/[partyPublicId]/+page.svelte")
text = path.read_text().replace(
    "\t\t\t<p class=\"private-note\">\n"
    "\t\t\t\tThis record belongs only to the active NuBlox organisation. It is not a platform-wide identity\n"
    "\t\t\t\trecord.\n"
    "\t\t\t</p>",
    "\t\t\t<p class=\"private-note\">\n"
    "\t\t\t\tThis record belongs only to the active NuBlox organisation. CRM companies and people are\n"
    "\t\t\t\tprivate business relationships and never map to NuBlox platform organisations.\n"
    "\t\t\t</p>",
)
text = text.replace(
    "\t\t\t{#if form?.contactActionError}",
    "\t\t\t<p class=\"muted\">\n"
    "\t\t\t\tContacts describe a person's affiliation with this organisation. A contact is not automatically\n"
    "\t\t\t\ta customer; customer/client status remains an explicit CRM business role.\n"
    "\t\t\t</p>\n\n"
    "\t\t\t{#if form?.contactActionError}",
    1,
)
path.write_text(text)

# Remove obsolete organisation-link collaboration service. Its replacement is person-scoped.
Path("app/src/lib/server/projects/project-collaboration-invitation-service.ts").unlink(
    missing_ok=True
)
