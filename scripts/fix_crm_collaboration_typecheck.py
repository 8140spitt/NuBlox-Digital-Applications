from pathlib import Path

project_server = Path('app/src/routes/(app)/projects/[projectPublicId]/+page.server.ts')
text = project_server.read_text()
old_import = "import {\n\tProjectExternalCollaborationService,\n\tProjectExternalCollaborationValidationError\n} from '$lib/server/projects/project-external-collaboration-service';"
new_import = "import {\n\tProjectExternalCollaborationService,\n\tProjectExternalCollaborationValidationError,\n\ttype ExternalCollaborationManagementView\n} from '$lib/server/projects/project-external-collaboration-service';"
if old_import not in text:
    raise SystemExit('Expected external collaboration import block not found')
text = text.replace(old_import, new_import, 1)
old_decl = "\t\tlet externalCollaboration = {"
new_decl = "\t\tlet externalCollaboration: ExternalCollaborationManagementView = {"
if old_decl not in text:
    raise SystemExit('Expected externalCollaboration declaration not found')
text = text.replace(old_decl, new_decl, 1)
project_server.write_text(text)

crm_page = Path('app/src/routes/(app)/crm/[partyPublicId]/+page.svelte')
text = crm_page.read_text()
start = text.find('\t.platform-link-summary {')
end_marker = "\t.platform-link-form input {\n\t\tmin-width: 0;\n\t\tfont: inherit;\n\t\tborder: 1px solid #b9b9b1;\n\t\tborder-radius: 0.45rem;\n\t\tpadding: 0.64rem;\n\t\tbackground: white;\n\t}\n"
if start < 0:
    raise SystemExit('Expected obsolete platform-link CSS start not found')
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit('Expected obsolete platform-link CSS end not found')
end += len(end_marker)
text = text[:start] + text[end:]
crm_page.write_text(text)
