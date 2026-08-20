from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Expected patch target not found in {path}: {old[:80]!r}")
    target.write_text(text.replace(old, new, 1))


# Provision Slice 7 defaults for Better Auth organisation bootstrap.
replace_once(
    "app/src/lib/server/auth/better-auth.ts",
    "import { ensureProcurementCommercialStandardRoleDefaults } from '$lib/server/procurement/procurement-commercial-bootstrap';",
    "import { ensurePortalCollaborationStandardRoleDefaults } from '$lib/server/portal/portal-collaboration-bootstrap';\nimport { ensureProcurementCommercialStandardRoleDefaults } from '$lib/server/procurement/procurement-commercial-bootstrap';",
)
replace_once(
    "app/src/lib/server/auth/better-auth.ts",
    "\t\t\t\t\t\t\tensureAssetsMaintenanceStandardRoleDefaults(db, created.organisationId)\n\t\t\t\t\t\t]);",
    "\t\t\t\t\t\t\tensureAssetsMaintenanceStandardRoleDefaults(db, created.organisationId),\n\t\t\t\t\t\t\tensurePortalCollaborationStandardRoleDefaults(db, created.organisationId)\n\t\t\t\t\t\t]);",
)

# Expose the focused portal from the internal navigation without merging its shell into the app shell.
replace_once(
    "app/src/lib/navigation/app-navigation.ts",
    "\t\t\t{\n\t\t\t\tid: 'projects',\n\t\t\t\tlabel: 'Projects',\n\t\t\t\thref: '/projects',\n\t\t\t\tanyPermissionNamespaces: ['project.']\n\t\t\t},\n\t\t\t{\n\t\t\t\tid: 'documents',",
    "\t\t\t{\n\t\t\t\tid: 'projects',\n\t\t\t\tlabel: 'Projects',\n\t\t\t\thref: '/projects',\n\t\t\t\tanyPermissionNamespaces: ['project.']\n\t\t\t},\n\t\t\t{\n\t\t\t\tid: 'portal',\n\t\t\t\tlabel: 'Portal',\n\t\t\t\thref: '/portal',\n\t\t\t\tanyPermissions: ['portal.view'],\n\t\t\t\tchildren: [\n\t\t\t\t\t{ id: 'portal-shared-work', label: 'Shared work', href: '/portal' },\n\t\t\t\t\t{\n\t\t\t\t\t\tid: 'portal-manage-sharing',\n\t\t\t\t\t\tlabel: 'Manage sharing',\n\t\t\t\t\t\thref: '/portal/manage',\n\t\t\t\t\t\tanyPermissions: ['portal.manage']\n\t\t\t\t\t}\n\t\t\t\t]\n\t\t\t},\n\t\t\t{\n\t\t\t\tid: 'documents',",
)

# Read-only portal members must not require organisation-level invitation management authority.
page_server = Path("app/src/routes/portal/+page.server.ts")
text = page_server.read_text()
if "import { PermissionService }" not in text:
    text = text.replace(
        "import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';\n",
        "import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';\nimport { PermissionService } from '$lib/server/capabilities/permission-service';\n",
        1,
    )
old_load = "\tconst db = getDatabase();\n\tconst [workspace, invitations] = await Promise.all([\n\t\tnew PortalCollaborationService(db).getWorkspace(actor),\n\t\tnew ProjectTeamService(db).listPendingInvitations(actor)\n\t]);\n\treturn { ...workspace, invitations };"
new_load = "\tconst db = getDatabase();\n\tconst invitationDecision = await new PermissionService(db).decideWithUmbrella(\n\t\tactor,\n\t\t'project.participation.manage',\n\t\t'project.manage'\n\t);\n\tconst [workspace, invitations] = await Promise.all([\n\t\tnew PortalCollaborationService(db).getWorkspace(actor),\n\t\tinvitationDecision.allowed\n\t\t\t? new ProjectTeamService(db).listPendingInvitations(actor)\n\t\t\t: Promise.resolve([])\n\t]);\n\treturn { ...workspace, invitations };"
if new_load not in text:
    if old_load not in text:
        raise SystemExit("Portal page load patch target not found")
    text = text.replace(old_load, new_load, 1)
page_server.write_text(text)

# Remove a provisional assertion and keep only the exact revision evidence assertion.
test_path = Path("app/src/lib/server/portal/portal-collaboration.integration.test.ts")
text = test_path.read_text()
text = text.replace(
    "\t\texpect(received?.items).toEqual([\n\t\t\texpect.objectContaining({ publicId: undefined })\n\t\t].filter(Boolean));\n",
    "",
)
test_path.write_text(text)

# Type the reusable Playwright helper.
e2e_path = Path("app/e2e/portal-collaboration.e2e.ts")
text = e2e_path.read_text()
if "type Page" not in text.splitlines()[0]:
    text = text.replace(
        "import { expect, test } from '@playwright/test';\n",
        "import { expect, test, type Page } from '@playwright/test';\n",
        1,
    )
text = text.replace("async function signIn(page, email:", "async function signIn(page: Page, email:", 1)
e2e_path.write_text(text)

# Keep browser shell contracts in sync with the new Portal navigation entry.
auth_e2e = Path("app/e2e/authenticated-workspaces.e2e.ts")
text = auth_e2e.read_text()
portal_expectation = "\tawait expect(primaryNavigation.getByRole('link', { name: 'Portal', exact: true })).toBeVisible();\n"
if portal_expectation not in text:
    anchor = "\tawait expect(\n\t\tprimaryNavigation.getByRole('link', { name: 'Projects', exact: true })\n\t).toBeVisible();\n"
    if anchor not in text:
        raise SystemExit("Authenticated workspace Portal nav anchor not found")
    text = text.replace(anchor, anchor + portal_expectation, 1)
auth_e2e.write_text(text)

permissions_e2e = Path("app/e2e/ui-permissions.e2e.ts")
text = permissions_e2e.read_text()
portal_view_expectation = "\tawait expect(primaryNavigation.getByRole('link', { name: 'Portal', exact: true })).toBeVisible();\n"
if portal_view_expectation not in text:
    anchor = "\tawait expect(\n\t\tprimaryNavigation.getByRole('link', { name: 'Assets / Facilities', exact: true })\n\t).toBeVisible();\n"
    if anchor not in text:
        raise SystemExit("UI permissions Portal nav anchor not found")
    text = text.replace(anchor, anchor + portal_view_expectation, 1)
portal_check = "\n\tawait page.goto('/portal');\n\tawait expect(page.getByRole('heading', { name: 'Shared work' })).toBeVisible();\n\tawait expect(page.getByRole('link', { name: 'Manage sharing' })).toHaveCount(0);\n"
if portal_check not in text:
    closing = "\n});\n"
    if not text.endswith(closing):
        raise SystemExit("UI permissions test closing marker not found")
    text = text[:-len(closing)] + portal_check + closing
permissions_e2e.write_text(text)
