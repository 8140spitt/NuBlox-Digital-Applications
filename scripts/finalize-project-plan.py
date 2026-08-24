from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected_count: int = 1) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != expected_count:
        raise RuntimeError(f"{path}: expected {expected_count} occurrence(s), found {count}: {old!r}")
    file.write_text(text.replace(old, new))


bootstrap = "app/src/lib/server/organisations/bootstrap-service.ts"
replace_exact(
    bootstrap,
    "\t'project.programme.manage',\n\t'project.lifecycle.manage',",
    "\t'project.programme.manage',\n\t'project.plan.view',\n\t'project.plan.manage',\n\t'project.plan.baseline.manage',\n\t'project.lifecycle.manage',",
    expected_count=2,
)
replace_exact(
    bootstrap,
    "\t\t\t'project.programme.manage',\n\t\t\t'project.lifecycle.manage',",
    "\t\t\t'project.programme.manage',\n\t\t\t'project.plan.view',\n\t\t\t'project.plan.manage',\n\t\t\t'project.plan.baseline.manage',\n\t\t\t'project.lifecycle.manage',",
)
replace_exact(
    bootstrap,
    "\t\t\t'project.programme.view',\n\t\t\t'crm.view',",
    "\t\t\t'project.programme.view',\n\t\t\t'project.plan.view',\n\t\t\t'crm.view',",
)
replace_exact(
    bootstrap,
    "permissionKeys: ['project.view', 'project.portfolio.view', 'project.programme.view', 'crm.view']",
    "permissionKeys: [\n\t\t\t'project.view',\n\t\t\t'project.portfolio.view',\n\t\t\t'project.programme.view',\n\t\t\t'project.plan.view',\n\t\t\t'crm.view'\n\t\t]",
    expected_count=2,
)
replace_exact(
    bootstrap,
    "permissionKeys: ['project.view']",
    "permissionKeys: ['project.view', 'project.plan.view']",
)

service = "app/src/lib/server/projects/project-plan-service.ts"
replace_exact(
    service,
    "\t\tconst project = await this.findProjectInMemberScope(actor, projectPublicId);\n\t\tconst decision = await new PermissionService(this.db).decideWithUmbrella(",
    "\t\tconst project = await this.findProjectInMemberScope(actor, projectPublicId);\n\t\tconst permissionService = new PermissionService(this.db);\n\t\tconst projectViewDecision = await permissionService.decide(actor, 'project.view', {\n\t\t\tprojectId: project.id\n\t\t});\n\t\tif (!projectViewDecision.allowed) {\n\t\t\tthrow new TenantAccessError('Project access is not permitted.');\n\t\t}\n\t\tconst decision = await permissionService.decideWithUmbrella(",
)
replace_exact(
    service,
    "\t\tconst [viewDecision, manageDecision, baselineDecision] = await Promise.all([\n\t\t\tpermissionService.decide(actor, 'project.plan.view', { projectId: project.id }),",
    "\t\tconst [projectViewDecision, viewDecision, manageDecision, baselineDecision] = await Promise.all([\n\t\t\tpermissionService.decide(actor, 'project.view', { projectId: project.id }),\n\t\t\tpermissionService.decide(actor, 'project.plan.view', { projectId: project.id }),",
)
replace_exact(
    service,
    "\t\tif (!viewDecision.allowed && !manageDecision.allowed && !baselineDecision.allowed) {",
    "\t\tif (\n\t\t\t!projectViewDecision.allowed ||\n\t\t\t(!viewDecision.allowed && !manageDecision.allowed && !baselineDecision.allowed)\n\t\t) {",
)

project_page = "app/src/routes/(app)/projects/[projectPublicId]/+page.svelte"
replace_exact(
    project_page,
    "</section>\n\n<div class=\"workspace-grid\">",
    "</section>\n\n<nav class=\"project-actions\" aria-label=\"Project controls\">\n\t<a href={`/projects/${data.project.publicId}/plan`}>Open project plan</a>\n</nav>\n\n<div class=\"workspace-grid\">",
)
replace_exact(
    project_page,
    "<style>\n\t.breadcrumbs {",
    "<style>\n\t.project-actions {\n\t\tdisplay: flex;\n\t\tgap: 0.75rem;\n\t\tmargin: -0.6rem 0 1.25rem;\n\t}\n\t.project-actions a {\n\t\tdisplay: inline-flex;\n\t\talign-items: center;\n\t\tpadding: 0.62rem 0.88rem;\n\t\tborder-radius: 0.55rem;\n\t\tbackground: #1f1f1c;\n\t\tcolor: white;\n\t\tfont-weight: 700;\n\t\ttext-decoration: none;\n\t}\n\t.project-actions a:hover {\n\t\tbackground: #373732;\n\t}\n\t.breadcrumbs {",
)

registry = "app/src/lib/navigation/capability-registry.ts"
replace_exact(
    registry,
    "'Portfolio/programme/project hierarchy, projects, schedule and Work Kernel are native; WBS, baseline scheduling, resources, risk and full project-controls depth remain.'",
    "'Portfolio/programme/project hierarchy, WBS, activities, milestones, dependency logic, schedule baselines, projects and Work Kernel are native; resource loading, risk, earned value and deeper project-controls integration remain.'",
)

print("Project Plan source finalization complete.")
