from pathlib import Path
import re


def rw(path: str, fn):
    p = Path(path)
    s = p.read_text()
    n = fn(s)
    if n == s:
        raise SystemExit(f"no change: {path}")
    p.write_text(n)


def repl(s: str, a: str, b: str) -> str:
    if a not in s:
        raise SystemExit(f"missing source block: {a[:80]}")
    return s.replace(a, b, 1)


rw(
    "appv2/src/app.css",
    lambda s: repl(
        repl(
            repl(
                s,
                "\t--nb-content: 1200px;\n\t--nb-content-wide: 1440px;",
                "\t--nb-content: 1200px;\n\t--nb-content-wide: 1440px;\n\t--nb-page-gutter: var(--nb-space-6);",
            ),
            ".nb-page {\n\twidth: min(calc(100% - 40px), var(--nb-content));\n\tmargin-inline: auto;\n}\n\n.nb-page-wide {\n\twidth: min(calc(100% - 40px), var(--nb-content-wide));\n\tmargin-inline: auto;\n}",
            ".nb-page,\n.nb-page-wide,\n.nb-page-form {\n\twidth: 100%;\n\tmargin-inline: auto;\n\tpadding-inline: var(--nb-page-gutter);\n}\n\n.nb-page {\n\tmax-width: calc(var(--nb-content) + var(--nb-page-gutter) + var(--nb-page-gutter));\n}\n\n.nb-page-wide,\n.nb-page-form {\n\tmax-width: calc(var(--nb-content-wide) + var(--nb-page-gutter) + var(--nb-page-gutter));\n}",
        ),
        "@media (max-width: 700px) {\n\t.nb-page,\n\t.nb-page-wide {\n\t\twidth: min(calc(100% - 24px), var(--nb-content));\n\t}\n}",
        "@media (max-width: 700px) {\n\t:root {\n\t\t--nb-page-gutter: var(--nb-space-4);\n\t}\n}",
    ),
)

rw(
    "appv2/src/lib/components/shell/ApplicationShell.svelte",
    lambda s: repl(
        s,
        "\t.application-main {\n\t\tpadding: 34px 0 72px;\n\t}",
        "\t.application-main {\n\t\tpadding: var(--nb-space-6) 0 var(--nb-space-12);\n\t}",
    ),
)

layout_path = "appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/+layout.svelte"

def layout(s: str) -> str:
    s = repl(
        s,
        "\t\tmax-width: var(--nb-page-wide, 1440px);\n\t\tmargin-inline: auto;\n\t\tpadding: 0 var(--nb-space-6);",
        "\t\twidth: 100%;\n\t\tmax-width: calc(var(--nb-content-wide) + var(--nb-page-gutter) + var(--nb-page-gutter));\n\t\tmargin-inline: auto;\n\t\tpadding-inline: var(--nb-page-gutter);",
    )
    return s.replace(
        "\n\t@media (max-width: 640px) {\n\t\t.strategy-context-nav {\n\t\t\tpadding-inline: var(--nb-space-4);\n\t\t}\n\t}\n",
        "\n",
    )

rw(layout_path, layout)

for area in ["analysis", "planning", "business-planning", "performance", "review"]:
    path = Path(
        f"appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/{area}/new/[record]/+page.svelte"
    )
    path.write_text(path.read_text().replace("\n\t\tpadding-bottom: var(--nb-space-16);", ""))

manage_path = "appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/manage/[kind]/[record]/+page.svelte"

def manage(s: str) -> str:
    s = s.replace(
        "This approved version remains current and immutable. Create a controlled revision to change it; when the revision is approved, this version becomes superseded automatically.",
        "This approved version is immutable for editing. Create a controlled revision to amend it, or use governed deletion when the business object itself must be removed.",
    )
    s = repl(
        s,
        'title="Delete ungoverned record"\n\t\t\tdescription="Permanent deletion is only available before the record becomes governed or is depended on by downstream records."',
        "title={record.status === 'approved' ? 'Delete governed record' : 'Delete record'}\n\t\t\tdescription={record.status === 'approved'\n\t\t\t\t? 'Permanent deletion removes this live record and every downstream F01 record it owns. Published version snapshots and audit evidence are retained.'\n\t\t\t\t: 'Permanent deletion removes this record and every downstream F01 record it owns.'}",
    )
    s = s.replace(
        'hint="After governance, use retire, cancel or controlled revision instead of deletion."',
        "hint={record.status === 'approved'\n\t\t\t\t\t\t? 'Deleting a governed parent cascades through its owned F01 chain. Records owned by another function are not deleted.'\n\t\t\t\t\t\t: 'Deleting a parent cascades through its owned F01 chain.'}",
    )
    return repl(
        s,
        "\t.manage-page,\n\t.record-form,\n\t.lifecycle-actions {\n\t\tdisplay: grid;\n\t\tgap: var(--nb-space-6);\n\t\tpadding-bottom: var(--nb-space-16);\n\t}",
        "\t.manage-page,\n\t.record-form,\n\t.lifecycle-actions {\n\t\tdisplay: grid;\n\t\tgap: var(--nb-space-5);\n\t}",
    )

rw(manage_path, manage)


def lifecycle(s: str) -> str:
    for kind in ("framework", "plan", "kpi"):
        pattern = rf"({kind}: \{{\n\t\teditable: \['draft'\],\n\t\tdeletable:) \['draft'\]"
        s, count = re.subn(pattern, rf"\1 ['draft', 'approved']", s, count=1)
        if count != 1:
            raise SystemExit(f"lifecycle policy not found: {kind}")
    return s

rw("appv2/src/lib/server/strategy/f01-lifecycle.ts", lifecycle)

rw(
    "appv2/src/lib/server/strategy/f01-lifecycle.test.ts",
    lambda s: repl(
        s,
        "\tit('keeps approved business plans immutable but revisable', () => {\n\t\texpect(canEditF01Record('plan', 'approved')).toBe(false);\n\t\texpect(canDeleteF01Record('plan', 'approved')).toBe(false);\n\t\texpect(canReviseF01Record('plan', 'approved')).toBe(true);\n\t});",
        "\tit('keeps approved governed roots immutable for editing but explicitly deletable or revisable', () => {\n\t\tfor (const kind of ['framework', 'plan', 'kpi'] as const) {\n\t\t\texpect(canEditF01Record(kind, 'approved')).toBe(false);\n\t\t\texpect(canDeleteF01Record(kind, 'approved')).toBe(true);\n\t\t\texpect(canReviseF01Record(kind, 'approved')).toBe(true);\n\t\t}\n\t});",
    ),
)

service_path = "appv2/src/lib/server/strategy/f01-record-management-service.ts"

def service(s: str) -> str:
    head, tail = s.split("export async function deleteF01Record", 1)
    tail = tail.replace(
        "if (['framework', 'plan', 'kpi'].includes(input.kind)) {",
        "if (currentStatus === 'draft' && ['framework', 'plan', 'kpi'].includes(input.kind)) {",
        1,
    )

    def replace_case(src: str, kind: str, body: str) -> str:
        pattern = rf"\t\t\tcase '{kind}': \{{.*?\n\t\t\t\tbreak;\n\t\t\t\}}"
        src, count = re.subn(pattern, body, src, count=1, flags=re.S)
        if count != 1:
            raise SystemExit(f"delete case not found: {kind}")
        return src

    tail = replace_case(
        tail,
        "framework",
        """\t\t\tcase 'framework': {\n\t\t\t\tif (input.frameworkPublicId !== id) throw new StrategyValidationError('Strategy record mismatch.');\n\t\t\t\tconst row = await singleConnectionRow<IdRow>(connection, `SELECT id FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ? AND lifecycle_status IN ('draft','approved') LIMIT 1 FOR UPDATE`, [org, id]);\n\t\t\t\tawait connection.execute(`DELETE FROM strategy_frameworks WHERE organisation_id = ? AND id = ?`, [org, row.id]);\n\t\t\t\tbreak;\n\t\t\t}""",
    )
    tail = replace_case(
        tail,
        "plan",
        """\t\t\tcase 'plan': {\n\t\t\t\tconst row = await singleConnectionRow<IdRow>(connection, `SELECT id FROM strategy_business_plans WHERE organisation_id = ? AND public_id = ? AND lifecycle_status IN ('draft','approved') LIMIT 1 FOR UPDATE`, [org, id]);\n\t\t\t\tawait connection.execute(`DELETE FROM strategy_business_plans WHERE id = ?`, [row.id]);\n\t\t\t\tbreak;\n\t\t\t}""",
    )
    tail = replace_case(
        tail,
        "kpi",
        """\t\t\tcase 'kpi': {\n\t\t\t\tconst row = await singleConnectionRow<IdRow>(connection, `SELECT id FROM strategy_kpis WHERE organisation_id = ? AND public_id = ? AND lifecycle_status IN ('draft','approved') LIMIT 1 FOR UPDATE`, [org, id]);\n\t\t\t\tawait connection.execute(`DELETE FROM strategy_kpis WHERE id = ?`, [row.id]);\n\t\t\t\tbreak;\n\t\t\t}""",
    )
    return head + "export async function deleteF01Record" + tail

rw(service_path, service)

test_path = "appv2/src/lib/server/strategy/f01-golden-thread.integration.test.ts"

def golden(s: str) -> str:
    old = """\t\tawait expect(\n\t\t\tdeleteF01Record({\n\t\t\t\tactor,\n\t\t\t\tframeworkPublicId: revision.publicId,\n\t\t\t\tkind: 'plan',\n\t\t\t\trecordPublicId: plan.publicId\n\t\t\t})\n\t\t).rejects.toBeInstanceOf(StrategyValidationError);"""
    new = """\t\tawait deleteF01Record({ actor, frameworkPublicId: revision.publicId, kind: 'plan', recordPublicId: plan.publicId });\n\t\tconst [deletedPlans] = await getPool().execute<IdRow[]>(`SELECT id FROM strategy_business_plans WHERE organisation_id = ? AND public_id = ?`, [organisationId, plan.publicId]);\n\t\tconst [deletedInitiatives] = await getPool().execute<IdRow[]>(`SELECT id FROM strategy_initiatives WHERE organisation_id = ? AND public_id = ?`, [organisationId, initiative.publicId]);\n\t\tconst [deletedRequirements] = await getPool().execute<IdRow[]>(`SELECT id FROM strategy_initiative_resource_requirements WHERE organisation_id = ? AND public_id = ?`, [organisationId, requirement.publicId]);\n\t\texpect(deletedPlans).toHaveLength(0);\n\t\texpect(deletedInitiatives).toHaveLength(0);\n\t\texpect(deletedRequirements).toHaveLength(0);\n\n\t\tawait deleteF01Record({ actor, frameworkPublicId: revision.publicId, kind: 'kpi', recordPublicId: kpi.publicId });\n\t\tconst [deletedKpis] = await getPool().execute<IdRow[]>(`SELECT id FROM strategy_kpis WHERE organisation_id = ? AND public_id = ?`, [organisationId, kpi.publicId]);\n\t\texpect(deletedKpis).toHaveLength(0);\n\n\t\tawait deleteF01Record({ actor, frameworkPublicId: revision.publicId, kind: 'framework', recordPublicId: revision.publicId });\n\t\tconst [deletedFrameworks] = await getPool().execute<IdRow[]>(`SELECT id FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ?`, [organisationId, revision.publicId]);\n\t\texpect(deletedFrameworks).toHaveLength(0);"""
    return repl(s, old, new)

rw(test_path, golden)
