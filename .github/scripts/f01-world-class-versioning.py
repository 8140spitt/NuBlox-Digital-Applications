from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def rep(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)


# F01 strategy aggregate -------------------------------------------------------
p = "appv2/src/lib/server/strategy/f01-service.ts"
s = read(p)
s = rep(
    s,
    "import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';\n",
    "import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';\nimport { appendGovernedVersion, governedVersionCoordinates } from '$lib/server/platform/governed-versioning';\n",
    "f01-service versioning import",
)
s = rep(
    s,
    "\tversionNumber: number;\n\ttitle: string;",
    "\tversionNumber: number;\n\tminorVersionNumber: number;\n\tversionLabel: string;\n\tversionStage: 'draft' | 'published' | 'historical';\n\ttitle: string;",
    "framework summary version fields",
)
s = rep(
    s,
    "\tversionNumber: number | string;\n\ttitle: string;",
    "\tversionNumber: number | string;\n\tminorVersionNumber: number | string;\n\ttitle: string;",
    "framework row minor field",
)
s = rep(
    s,
    "function mapFramework(row: FrameworkRow, memberId: string): StrategyFrameworkSummary {\n\treturn {\n\t\tpublicId: row.publicId,\n\t\tcode: row.code,\n\t\tversionNumber: Number(row.versionNumber),",
    "function mapFramework(row: FrameworkRow, memberId: string): StrategyFrameworkSummary {\n\tconst version = governedVersionCoordinates({\n\t\tversionNumber: Number(row.versionNumber),\n\t\tminorVersionNumber: Number(row.minorVersionNumber),\n\t\tlifecycleStatus: row.lifecycleStatus\n\t});\n\treturn {\n\t\tpublicId: row.publicId,\n\t\tcode: row.code,\n\t\tversionNumber: Number(row.versionNumber),\n\t\tminorVersionNumber: Number(row.minorVersionNumber),\n\t\tversionLabel: version.label,\n\t\tversionStage: version.status,",
    "map framework version coordinates",
)
s = rep(
    s,
    "\t\t        framework.version_number AS versionNumber,\n\t\t        framework.title AS title,",
    "\t\t        framework.version_number AS versionNumber,\n\t\t        framework.minor_version_number AS minorVersionNumber,\n\t\t        framework.title AS title,",
    "framework list minor select",
)
s = rep(
    s,
    "\t\t\t\t(organisation_id, public_id, framework_code, version_number, title,\n",
    "\t\t\t\t(organisation_id, public_id, framework_code, version_number, minor_version_number, title,\n",
    "framework insert minor column",
)
s = rep(
    s,
    "\t\t\t VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?, NULL, NULL)`,",
    "\t\t\t VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?, NULL, NULL)`,",
    "framework insert minor value",
)
anchor = "\t\tawait appendDomainEvidence(connection, {\n\t\t\tactor: input.actor,\n\t\t\tactionKey: 'strategy.framework.create',"
s = rep(
    s,
    anchor,
    "\t\tawait appendGovernedVersion(connection, {\n\t\t\tactor: input.actor,\n\t\t\tdomainCode: 'F01',\n\t\t\trecordType: 'strategy_framework',\n\t\t\tlineageKey: code,\n\t\t\trecordPublicId: publicId,\n\t\t\tversionNumber: 1,\n\t\t\tminorVersionNumber: 1,\n\t\t\tlifecycleStatus: 'draft',\n\t\t\tsnapshot: { title, horizonStart, horizonEnd, purpose, vision, mission, lifecycleStatus: 'draft' },\n\t\t\tchangeNote: 'Initial working draft'\n\t\t});\n" + anchor,
    "framework create version history",
)
s = rep(
    s,
    "\t\t\t\tversionNumber: 1,\n\t\t\t\tlifecycleStatus: 'draft',",
    "\t\t\t\tversionNumber: 1,\n\t\t\t\tversionLabel: '0.1',\n\t\t\t\tlifecycleStatus: 'draft',",
    "framework create audit version label",
)
write(p, s)


# Strategy approval ------------------------------------------------------------
p = "appv2/src/lib/server/strategy/approval-service.ts"
s = read(p)
s = rep(
    s,
    "import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';\n",
    "import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';\nimport { appendGovernedVersion, markPublishedVersionHistorical } from '$lib/server/platform/governed-versioning';\n",
    "approval versioning import",
)
s = rep(
    s,
    "\tcode: string;\n\ttitle: string;\n\tlifecycleStatus:",
    "\tcode: string;\n\tversionNumber: number | string;\n\tminorVersionNumber: number | string;\n\ttitle: string;\n\thorizonStart: Date | string;\n\thorizonEnd: Date | string;\n\tpurpose: string;\n\tvision: string;\n\tmission: string;\n\tlifecycleStatus:",
    "approval framework row fields",
)
s = rep(
    s,
    "\t\t        framework_code AS code,\n\t\t        title,\n\t\t        lifecycle_status AS lifecycleStatus,",
    "\t\t        framework_code AS code,\n\t\t        version_number AS versionNumber,\n\t\t        minor_version_number AS minorVersionNumber,\n\t\t        title,\n\t\t        horizon_start AS horizonStart,\n\t\t        horizon_end AS horizonEnd,\n\t\t        purpose_text AS purpose,\n\t\t        vision_text AS vision,\n\t\t        mission_text AS mission,\n\t\t        lifecycle_status AS lifecycleStatus,",
    "approval lock select version fields",
)
s = rep(
    s,
    "Promise<{ id: string; publicId: string; code: string } | null>",
    "Promise<{ id: string; publicId: string; code: string; versionNumber: number } | null>",
    "approved framework return type",
)
s = rep(
    s,
    "(RowDataPacket & { id: string | number; publicId: string; code: string })[]",
    "(RowDataPacket & { id: string | number; publicId: string; code: string; versionNumber: number | string })[]",
    "approved framework row type",
)
s = rep(
    s,
    "`SELECT id, public_id AS publicId, framework_code AS code\n",
    "`SELECT id, public_id AS publicId, framework_code AS code, version_number AS versionNumber\n",
    "approved framework select version",
)
s = rep(
    s,
    "return row ? { id: row.id.toString(), publicId: row.publicId, code: row.code } : null;",
    "return row\n\t\t? { id: row.id.toString(), publicId: row.publicId, code: row.code, versionNumber: Number(row.versionNumber) }\n\t\t: null;",
    "approved framework map version",
)
old = "\t\t\tawait connection.execute(\n\t\t\t\t`UPDATE strategy_frameworks\n\t\t\t\t SET lifecycle_status = 'superseded'\n\t\t\t\t WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'approved'`,\n\t\t\t\t[input.actor.organisationId, existingApproved.id]\n\t\t\t);"
s = rep(
    s,
    old,
    old
    + "\n\t\t\tawait markPublishedVersionHistorical(connection, {\n\t\t\t\torganisationId: input.actor.organisationId,\n\t\t\t\tdomainCode: 'F01',\n\t\t\t\trecordType: 'strategy_framework',\n\t\t\t\tlineageKey: framework.code,\n\t\t\t\tmajorVersion: existingApproved.versionNumber\n\t\t\t});",
    "framework predecessor version historical",
)
s = rep(
    s,
    "\t\t\t SET lifecycle_status = 'approved',\n\t\t\t     approved_by_member_id = ?,",
    "\t\t\t SET lifecycle_status = 'approved',\n\t\t\t     minor_version_number = 0,\n\t\t\t     approved_by_member_id = ?,",
    "framework approval zero minor",
)
anchor = "\n\t\tawait appendDomainEvidence(connection, {\n\t\t\tactor: input.actor,\n\t\t\tactionKey: 'strategy.framework.approve',"
s = rep(
    s,
    anchor,
    "\n\t\tawait appendGovernedVersion(connection, {\n\t\t\tactor: input.actor,\n\t\t\tdomainCode: 'F01',\n\t\t\trecordType: 'strategy_framework',\n\t\t\tlineageKey: framework.code,\n\t\t\trecordPublicId: framework.publicId,\n\t\t\tversionNumber: Number(framework.versionNumber),\n\t\t\tminorVersionNumber: 0,\n\t\t\tlifecycleStatus: 'approved',\n\t\t\tsnapshot: { title: framework.title, horizonStart: framework.horizonStart, horizonEnd: framework.horizonEnd, purpose: framework.purpose, vision: framework.vision, mission: framework.mission, lifecycleStatus: 'approved' },\n\t\t\tchangeNote: 'Approved strategic direction',\n\t\t\tpublished: true\n\t\t});"
    + anchor,
    "framework published version snapshot",
)
s = rep(
    s,
    "\t\t\t\tlifecycleStatus: 'approved',\n\t\t\t\ttraceableObjectiveCount:",
    "\t\t\t\tlifecycleStatus: 'approved',\n\t\t\t\tversionLabel: `${Number(framework.versionNumber)}.0`,\n\t\t\t\ttraceableObjectiveCount:",
    "framework approval audit label",
)
write(p, s)


# Business plan approval -------------------------------------------------------
p = "appv2/src/lib/server/strategy/business-plan-approval-service.ts"
s = read(p)
s = rep(
    s,
    "import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';\n",
    "import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';\nimport { appendGovernedVersion, markPublishedVersionHistorical } from '$lib/server/platform/governed-versioning';\n",
    "plan approval versioning import",
)
s = rep(
    s,
    "\tcode: string;\n\tlifecycleStatus:",
    "\tcode: string;\n\tversionNumber: number | string;\n\tminorVersionNumber: number | string;\n\ttitle: string;\n\tperiodStart: Date | string;\n\tperiodEnd: Date | string;\n\tnarrative: string;\n\tcurrencyCode: string;\n\tplannedRevenueAmount: string | number;\n\tplannedOpexAmount: string | number;\n\tplannedCapexAmount: string | number;\n\tlifecycleStatus:",
    "plan approval row fields",
)
s = rep(
    s,
    "\t\t        plan.plan_code AS code,\n\t\t        plan.lifecycle_status AS lifecycleStatus,",
    "\t\t        plan.plan_code AS code,\n\t\t        plan.version_number AS versionNumber,\n\t\t        plan.minor_version_number AS minorVersionNumber,\n\t\t        plan.title,\n\t\t        plan.period_start AS periodStart,\n\t\t        plan.period_end AS periodEnd,\n\t\t        plan.narrative,\n\t\t        plan.currency_code AS currencyCode,\n\t\t        plan.planned_revenue_amount AS plannedRevenueAmount,\n\t\t        plan.planned_opex_amount AS plannedOpexAmount,\n\t\t        plan.planned_capex_amount AS plannedCapexAmount,\n\t\t        plan.lifecycle_status AS lifecycleStatus,",
    "plan approval select fields",
)
s = rep(
    s,
    "(RowDataPacket & { id: string | number; publicId: string })[]",
    "(RowDataPacket & { id: string | number; publicId: string; versionNumber: number | string })[]",
    "previous plan row version",
)
s = rep(
    s,
    "`SELECT id, public_id AS publicId\n",
    "`SELECT id, public_id AS publicId, version_number AS versionNumber\n",
    "previous plan select version",
)
old = "\t\t\tawait connection.execute(\n\t\t\t\t`UPDATE strategy_business_plans SET lifecycle_status = 'superseded' WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'approved'`,\n\t\t\t\t[input.actor.organisationId, previousApproved.id]\n\t\t\t);"
s = rep(
    s,
    old,
    old
    + "\n\t\t\tawait markPublishedVersionHistorical(connection, { organisationId: input.actor.organisationId, domainCode: 'F01', recordType: 'strategy_business_plan', lineageKey: plan.code, majorVersion: Number(previousApproved.versionNumber) });",
    "plan predecessor version historical",
)
s = rep(
    s,
    "\t\t\t SET lifecycle_status = 'approved',\n\t\t\t     approved_by_member_id = ?,",
    "\t\t\t SET lifecycle_status = 'approved',\n\t\t\t     minor_version_number = 0,\n\t\t\t     approved_by_member_id = ?,",
    "plan approval zero minor",
)
anchor = "\n\t\tawait appendDomainEvidence(connection, {\n\t\t\tactor: input.actor,\n\t\t\tactionKey: 'strategy.business-plan.approve',"
s = rep(
    s,
    anchor,
    "\n\t\tawait appendGovernedVersion(connection, { actor: input.actor, domainCode: 'F01', recordType: 'strategy_business_plan', lineageKey: plan.code, recordPublicId: plan.publicId, versionNumber: Number(plan.versionNumber), minorVersionNumber: 0, lifecycleStatus: 'approved', snapshot: { title: plan.title, periodStart: plan.periodStart, periodEnd: plan.periodEnd, narrative: plan.narrative, currencyCode: plan.currencyCode, plannedRevenueAmount: plan.plannedRevenueAmount, plannedOpexAmount: plan.plannedOpexAmount, plannedCapexAmount: plan.plannedCapexAmount, lifecycleStatus: 'approved' }, changeNote: 'Approved business plan', published: true });"
    + anchor,
    "plan published version snapshot",
)
s = rep(
    s,
    "\t\t\t\tlifecycleStatus: 'approved',\n\t\t\t\tobjectiveCount:",
    "\t\t\t\tlifecycleStatus: 'approved',\n\t\t\t\tversionLabel: `${Number(plan.versionNumber)}.0`,\n\t\t\t\tobjectiveCount:",
    "plan approval audit label",
)
write(p, s)


# Execution / KPI service ------------------------------------------------------
p = "appv2/src/lib/server/strategy/execution-review-service.ts"
s = read(p)
s = rep(
    s,
    "import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';\n",
    "import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';\nimport { appendGovernedVersion, governedVersionCoordinates, markPublishedVersionHistorical } from '$lib/server/platform/governed-versioning';\n",
    "execution versioning import",
)
s = rep(
    s,
    "\tversionNumber: number;\n\ttitle: string;",
    "\tversionNumber: number;\n\tminorVersionNumber: number;\n\tversionLabel: string;\n\tversionStage: 'draft' | 'published' | 'historical';\n\ttitle: string;",
    "plan type version fields",
)
s = rep(
    s,
    "export type StrategyKpi = {\n\tpublicId: string;\n\tcode: string;\n\ttitle: string;",
    "export type StrategyKpi = {\n\tpublicId: string;\n\tcode: string;\n\tversionNumber: number;\n\tminorVersionNumber: number;\n\tversionLabel: string;\n\tversionStage: 'draft' | 'published' | 'historical';\n\ttitle: string;",
    "kpi type version fields",
)
s = rep(
    s,
    "\tversionNumber: number | string;\n\ttitle: string;",
    "\tversionNumber: number | string;\n\tminorVersionNumber: number | string;\n\ttitle: string;",
    "plan row minor field",
)
s = rep(
    s,
    "type KpiRow = RowDataPacket & {\n\tpublicId: string;\n\tcode: string;\n\ttitle: string;",
    "type KpiRow = RowDataPacket & {\n\tpublicId: string;\n\tcode: string;\n\tversionNumber: number | string;\n\tminorVersionNumber: number | string;\n\ttitle: string;",
    "kpi row version fields",
)
s = rep(s, "\t\t        plan.version_number AS versionNumber,\n\t\t        plan.title,", "\t\t        plan.version_number AS versionNumber,\n\t\t        plan.minor_version_number AS minorVersionNumber,\n\t\t        plan.title,", "plan list minor select")
old = "\treturn rows.map((row) => ({\n\t\tpublicId: row.publicId,\n\t\tcode: row.code,\n\t\tversionNumber: Number(row.versionNumber),\n\t\ttitle: row.title,"
new = "\treturn rows.map((row) => {\n\t\tconst version = governedVersionCoordinates({ versionNumber: Number(row.versionNumber), minorVersionNumber: Number(row.minorVersionNumber), lifecycleStatus: row.lifecycleStatus });\n\t\treturn {\n\t\t\tpublicId: row.publicId,\n\t\t\tcode: row.code,\n\t\t\tversionNumber: Number(row.versionNumber),\n\t\t\tminorVersionNumber: Number(row.minorVersionNumber),\n\t\t\tversionLabel: version.label,\n\t\t\tversionStage: version.status,\n\t\t\ttitle: row.title,"
s = rep(s, old, new, "plan map version start")
s = rep(s, "\t\tinitiativeCount: Number(row.initiativeCount)\n\t}));\n}\n\nasync function listInitiatives", "\t\t\tinitiativeCount: Number(row.initiativeCount)\n\t\t};\n\t});\n}\n\nasync function listInitiatives", "plan map version end")
s = rep(s, "\t\t        kpi.kpi_code AS code,\n\t\t        kpi.title,", "\t\t        kpi.kpi_code AS code,\n\t\t        kpi.version_number AS versionNumber,\n\t\t        kpi.minor_version_number AS minorVersionNumber,\n\t\t        kpi.title,", "kpi list version select")
old = "\treturn rows.map((row) => ({\n\t\tpublicId: row.publicId,\n\t\tcode: row.code,\n\t\ttitle: row.title,\n\t\tobjectivePublicId: row.objectivePublicId,"
new = "\treturn rows.map((row) => {\n\t\tconst version = governedVersionCoordinates({ versionNumber: Number(row.versionNumber), minorVersionNumber: Number(row.minorVersionNumber), lifecycleStatus: row.lifecycleStatus });\n\t\treturn {\n\t\t\tpublicId: row.publicId,\n\t\t\tcode: row.code,\n\t\t\tversionNumber: Number(row.versionNumber),\n\t\t\tminorVersionNumber: Number(row.minorVersionNumber),\n\t\t\tversionLabel: version.label,\n\t\t\tversionStage: version.status,\n\t\t\ttitle: row.title,\n\t\t\tobjectivePublicId: row.objectivePublicId,"
s = rep(s, old, new, "kpi map version start")
s = rep(s, "\t\tlatestObservedOn: dateValue(row.latestObservedOn)\n\t}));\n}\n\nasync function listReviews", "\t\t\tlatestObservedOn: dateValue(row.latestObservedOn)\n\t\t};\n\t});\n}\n\nasync function listReviews", "kpi map version end")
s = rep(s, "\t\t\t\t(organisation_id, strategy_framework_id, public_id, plan_code, version_number,\n", "\t\t\t\t(organisation_id, strategy_framework_id, public_id, plan_code, version_number, minor_version_number,\n", "plan create minor column")
s = rep(s, "\t\t\t VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?, NULL, NULL)`,", "\t\t\t VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?, NULL, NULL)`,", "plan create minor value")
anchor = "\t\tawait appendDomainEvidence(connection, {\n\t\t\tactor: input.actor,\n\t\t\tactionKey: 'strategy.business-plan.create',"
s = rep(s, anchor, "\t\tawait appendGovernedVersion(connection, { actor: input.actor, domainCode: 'F01', recordType: 'strategy_business_plan', lineageKey: code, recordPublicId: publicId, versionNumber: 1, minorVersionNumber: 1, lifecycleStatus: 'draft', snapshot: { title, periodStart, periodEnd, narrative, currencyCode, plannedRevenueAmount, plannedOpexAmount, plannedCapexAmount, objectivePublicIds, lifecycleStatus: 'draft' }, changeNote: 'Initial business-plan working draft' });\n" + anchor, "plan initial version")
s = rep(s, "\t\t\t\t kpi_code, version_number, title, description, unit_label, direction,", "\t\t\t\t kpi_code, version_number, minor_version_number, title, description, unit_label, direction,", "kpi create minor column")
s = rep(s, "\t\t\t VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'latest', ?, ?, NULL, NULL, ?", "\t\t\t VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, 'latest', ?, ?, NULL, NULL, ?", "kpi create minor value")
anchor = "\t\tawait appendDomainEvidence(connection, {\n\t\t\tactor: input.actor,\n\t\t\tactionKey: 'strategy.kpi.create',"
s = rep(s, anchor, "\t\tawait appendGovernedVersion(connection, { actor: input.actor, domainCode: 'F01', recordType: 'strategy_kpi', lineageKey: code, recordPublicId: publicId, versionNumber: 1, minorVersionNumber: 1, lifecycleStatus: 'draft', snapshot: { title, description, unitLabel, direction: input.direction, baselineValue, targetValue, targetDate, objectivePublicId: input.objectivePublicId, initiativePublicIds, lifecycleStatus: 'draft' }, changeNote: 'Initial KPI working draft' });\n" + anchor, "kpi initial version")
s = rep(s, "\t\t\t\tid: string | number;\n\t\t\t\tcode: string;\n\t\t\t\tlifecycleStatus: KpiStatus;", "\t\t\t\tid: string | number;\n\t\t\t\tcode: string;\n\t\t\t\tversionNumber: number | string;\n\t\t\t\tminorVersionNumber: number | string;\n\t\t\t\ttitle: string;\n\t\t\t\tdescription: string;\n\t\t\t\tunitLabel: string;\n\t\t\t\tdirection: string;\n\t\t\t\tbaselineValue: string | number;\n\t\t\t\ttargetValue: string | number;\n\t\t\t\ttargetDate: Date | string | null;\n\t\t\t\tlifecycleStatus: KpiStatus;", "kpi approval lock fields")
s = rep(s, "`SELECT id, kpi_code AS code, lifecycle_status AS lifecycleStatus,\n\t\t\t        supersedes_strategy_kpi_id AS supersedesKpiId", "`SELECT id, kpi_code AS code, version_number AS versionNumber, minor_version_number AS minorVersionNumber, title, description, unit_label AS unitLabel, direction, baseline_value AS baselineValue, target_value AS targetValue, target_date AS targetDate, lifecycle_status AS lifecycleStatus,\n\t\t\t        supersedes_strategy_kpi_id AS supersedesKpiId", "kpi approval select fields")
s = rep(s, "(RowDataPacket & { id: string | number; publicId: string })[]", "(RowDataPacket & { id: string | number; publicId: string; versionNumber: number | string })[]", "previous kpi row version")
s = rep(s, "`SELECT id, public_id AS publicId FROM strategy_kpis\n", "`SELECT id, public_id AS publicId, version_number AS versionNumber FROM strategy_kpis\n", "previous kpi version select")
old = "\t\t\tawait connection.execute(\n\t\t\t\t`UPDATE strategy_kpis SET lifecycle_status = 'superseded' WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'approved'`,\n\t\t\t\t[input.actor.organisationId, previousApproved.id]\n\t\t\t);"
s = rep(s, old, old + "\n\t\t\tawait markPublishedVersionHistorical(connection, { organisationId: input.actor.organisationId, domainCode: 'F01', recordType: 'strategy_kpi', lineageKey: kpi.code, majorVersion: Number(previousApproved.versionNumber) });", "kpi predecessor historical")
s = rep(s, "\t\t\t SET lifecycle_status = 'approved', approved_by_member_id = ?, approved_at = CURRENT_TIMESTAMP(6)", "\t\t\t SET lifecycle_status = 'approved', minor_version_number = 0, approved_by_member_id = ?, approved_at = CURRENT_TIMESTAMP(6)", "kpi approval zero minor")
anchor = "\t\tawait appendDomainEvidence(connection, {\n\t\t\tactor: input.actor,\n\t\t\tactionKey: 'strategy.kpi.approve',"
s = rep(s, anchor, "\t\tawait appendGovernedVersion(connection, { actor: input.actor, domainCode: 'F01', recordType: 'strategy_kpi', lineageKey: kpi.code, recordPublicId: input.kpiPublicId, versionNumber: Number(kpi.versionNumber), minorVersionNumber: 0, lifecycleStatus: 'approved', snapshot: { title: kpi.title, description: kpi.description, unitLabel: kpi.unitLabel, direction: kpi.direction, baselineValue: kpi.baselineValue, targetValue: kpi.targetValue, targetDate: kpi.targetDate, lifecycleStatus: 'approved' }, changeNote: 'Approved KPI definition', published: true });\n" + anchor, "kpi published version")
s = rep(s, "\t\t\t\tlifecycleStatus: 'approved',\n\t\t\t\tsupersededKpiPublicId:", "\t\t\t\tlifecycleStatus: 'approved',\n\t\t\t\tversionLabel: `${Number(kpi.versionNumber)}.0`,\n\t\t\t\tsupersededKpiPublicId:", "kpi approval audit label")
write(p, s)


# Managed record workspace -----------------------------------------------------
p = "appv2/src/lib/server/strategy/f01-record-management-service.ts"
s = read(p)
s = rep(s, "import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';\n", "import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';\nimport { appendGovernedVersion, governedVersionCoordinates, listGovernedVersionHistory, type GovernedVersionHistoryItem } from '$lib/server/platform/governed-versioning';\n", "record management versioning import")
s = rep(s, "\tstatus: string;\n\tsection:", "\tstatus: string;\n\tversionLabel: string | null;\n\tversionStage: 'draft' | 'published' | 'historical' | null;\n\tversionHistory: GovernedVersionHistoryItem[];\n\tsection:", "managed record version fields")
s = rep(s, "\tlet status = '';\n\tlet fields:", "\tlet status = '';\n\tlet versionNumber: number | null = null;\n\tlet minorVersionNumber: number | null = null;\n\tlet fields:", "managed record local version fields")
# Framework managed record
s = rep(s, "\t\t\t\t\tcode: string;\n\t\t\t\t\ttitle: string;", "\t\t\t\t\tcode: string;\n\t\t\t\t\tversionNumber: number | string;\n\t\t\t\t\tminorVersionNumber: number | string;\n\t\t\t\t\ttitle: string;", "managed framework type version")
s = rep(s, "`SELECT public_id AS publicId, framework_code AS code, title, horizon_start AS horizonStart,", "`SELECT public_id AS publicId, framework_code AS code, version_number AS versionNumber, minor_version_number AS minorVersionNumber, title, horizon_start AS horizonStart,", "managed framework select version")
s = rep(s, "\t\t\tcode = row.code;\n\t\t\ttitle = row.title;\n\t\t\tstatus = row.status;", "\t\t\tcode = row.code;\n\t\t\tversionNumber = Number(row.versionNumber);\n\t\t\tminorVersionNumber = Number(row.minorVersionNumber);\n\t\t\ttitle = row.title;\n\t\t\tstatus = row.status;", "managed framework map version")
# Plan managed record
plan_case = s.index("\t\tcase 'plan': {")
plan_end = s.index("\n\t\tcase 'initiative':", plan_case)
block = s[plan_case:plan_end]
block2 = block.replace("\t\t\t\t\tcode: string;\n\t\t\t\t\ttitle: string;", "\t\t\t\t\tcode: string;\n\t\t\t\t\tversionNumber: number | string;\n\t\t\t\t\tminorVersionNumber: number | string;\n\t\t\t\t\ttitle: string;", 1)
block2 = block2.replace("`SELECT plan.plan_code AS code, plan.title,", "`SELECT plan.plan_code AS code, plan.version_number AS versionNumber, plan.minor_version_number AS minorVersionNumber, plan.title,", 1)
block2 = block2.replace("\t\t\tcode = row.code;\n\t\t\ttitle = row.title;\n\t\t\tstatus = row.status;", "\t\t\tcode = row.code;\n\t\t\tversionNumber = Number(row.versionNumber);\n\t\t\tminorVersionNumber = Number(row.minorVersionNumber);\n\t\t\ttitle = row.title;\n\t\t\tstatus = row.status;", 1)
if block2 == block:
    raise SystemExit("Plan managed record version patch made no changes")
s = s[:plan_case] + block2 + s[plan_end:]
# KPI managed record
kpi_case = s.index("\t\tcase 'kpi': {")
kpi_end = s.index("\n\t\tcase 'review':", kpi_case)
block = s[kpi_case:kpi_end]
block2 = block.replace("\t\t\t\t\tcode: string;\n\t\t\t\t\ttitle: string;", "\t\t\t\t\tcode: string;\n\t\t\t\t\tversionNumber: number | string;\n\t\t\t\t\tminorVersionNumber: number | string;\n\t\t\t\t\ttitle: string;", 1)
block2 = block2.replace("`SELECT kpi.kpi_code AS code, kpi.title,", "`SELECT kpi.kpi_code AS code, kpi.version_number AS versionNumber, kpi.minor_version_number AS minorVersionNumber, kpi.title,", 1)
block2 = block2.replace("\t\t\tcode = row.code;\n\t\t\ttitle = row.title;\n\t\t\tstatus = row.status;", "\t\t\tcode = row.code;\n\t\t\tversionNumber = Number(row.versionNumber);\n\t\t\tminorVersionNumber = Number(row.minorVersionNumber);\n\t\t\ttitle = row.title;\n\t\t\tstatus = row.status;", 1)
if block2 == block:
    raise SystemExit("KPI managed record version patch made no changes")
s = s[:kpi_case] + block2 + s[kpi_end:]
# Version metadata/history
anchor = "\n\tconst strategyAllowsEditing = ["
s = rep(s, anchor, "\n\tlet versionLabel: string | null = null;\n\tlet versionStage: 'draft' | 'published' | 'historical' | null = null;\n\tlet versionHistory: GovernedVersionHistoryItem[] = [];\n\tif (versionNumber !== null && minorVersionNumber !== null && code) {\n\t\tconst version = governedVersionCoordinates({ versionNumber, minorVersionNumber, lifecycleStatus: status });\n\t\tversionLabel = version.label;\n\t\tversionStage = version.status;\n\t\tconst recordType = input.kind === 'framework' ? 'strategy_framework' : input.kind === 'plan' ? 'strategy_business_plan' : 'strategy_kpi';\n\t\tconst historyConnection = await getPool().getConnection();\n\t\ttry {\n\t\t\tversionHistory = await listGovernedVersionHistory(historyConnection, { organisationId, domainCode: 'F01', recordType, lineageKey: code });\n\t\t} finally {\n\t\t\thistoryConnection.release();\n\t\t}\n\t}\n\n\tconst strategyAllowsEditing = [", "managed version history calculation")
s = rep(s, "\t\tstatus,\n\t\tsection: sectionFor(input.kind),", "\t\tstatus,\n\t\tversionLabel,\n\t\tversionStage,\n\t\tversionHistory,\n\t\tsection: sectionFor(input.kind),", "managed record return version fields")
# Meaningful saves -> new minor version
s = rep(s, "`UPDATE strategy_frameworks SET title = ?, horizon_start = ?, horizon_end = ?, purpose_text = ?, vision_text = ?, mission_text = ? WHERE", "`UPDATE strategy_frameworks SET title = ?, horizon_start = ?, horizon_end = ?, purpose_text = ?, vision_text = ?, mission_text = ?, minor_version_number = minor_version_number + 1 WHERE", "framework update increments minor")
s = rep(s, "`UPDATE strategy_business_plans SET title = ?, period_start = ?, period_end = ?, narrative = ?, currency_code = ?, planned_revenue_amount = ?, planned_opex_amount = ?, planned_capex_amount = ? WHERE", "`UPDATE strategy_business_plans SET title = ?, period_start = ?, period_end = ?, narrative = ?, currency_code = ?, planned_revenue_amount = ?, planned_opex_amount = ?, planned_capex_amount = ?, minor_version_number = minor_version_number + 1 WHERE", "plan update increments minor")
s = rep(s, "`UPDATE strategy_kpis SET title = ?, description = ?, unit_label = ?, direction = ?, baseline_value = ?, target_value = ?, target_date = ? WHERE", "`UPDATE strategy_kpis SET title = ?, description = ?, unit_label = ?, direction = ?, baseline_value = ?, target_value = ?, target_date = ?, minor_version_number = minor_version_number + 1 WHERE", "kpi update increments minor")
# Saved minor snapshot
anchor = "\n\t\tawait appendDomainEvidence(connection, {\n\t\t\tactor: input.actor,\n\t\t\tactionKey: `strategy.${input.kind}.update`,"
minor_snapshot = """
		if (['framework', 'plan', 'kpi'].includes(input.kind)) {
			const metadata = input.kind === 'framework'
				? await singleRow<RowDataPacket & { code: string; versionNumber: number | string; minorVersionNumber: number | string; snapshot: string | Record<string, unknown> }>(`SELECT framework_code AS code, version_number AS versionNumber, minor_version_number AS minorVersionNumber, JSON_OBJECT('title', title, 'horizonStart', horizon_start, 'horizonEnd', horizon_end, 'purpose', purpose_text, 'vision', vision_text, 'mission', mission_text, 'lifecycleStatus', lifecycle_status) AS snapshot FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ? LIMIT 1`, [input.actor.organisationId, input.recordPublicId])
				: input.kind === 'plan'
					? await singleRow<RowDataPacket & { code: string; versionNumber: number | string; minorVersionNumber: number | string; snapshot: string | Record<string, unknown> }>(`SELECT plan_code AS code, version_number AS versionNumber, minor_version_number AS minorVersionNumber, JSON_OBJECT('title', title, 'periodStart', period_start, 'periodEnd', period_end, 'narrative', narrative, 'currencyCode', currency_code, 'plannedRevenueAmount', planned_revenue_amount, 'plannedOpexAmount', planned_opex_amount, 'plannedCapexAmount', planned_capex_amount, 'lifecycleStatus', lifecycle_status) AS snapshot FROM strategy_business_plans WHERE organisation_id = ? AND public_id = ? LIMIT 1`, [input.actor.organisationId, input.recordPublicId])
					: await singleRow<RowDataPacket & { code: string; versionNumber: number | string; minorVersionNumber: number | string; snapshot: string | Record<string, unknown> }>(`SELECT kpi_code AS code, version_number AS versionNumber, minor_version_number AS minorVersionNumber, JSON_OBJECT('title', title, 'description', description, 'unitLabel', unit_label, 'direction', direction, 'baselineValue', baseline_value, 'targetValue', target_value, 'targetDate', target_date, 'lifecycleStatus', lifecycle_status) AS snapshot FROM strategy_kpis WHERE organisation_id = ? AND public_id = ? LIMIT 1`, [input.actor.organisationId, input.recordPublicId]);
			const snapshot = typeof metadata.snapshot === 'string' ? JSON.parse(metadata.snapshot) : metadata.snapshot;
			await appendGovernedVersion(connection, { actor: input.actor, domainCode: 'F01', recordType: input.kind === 'framework' ? 'strategy_framework' : input.kind === 'plan' ? 'strategy_business_plan' : 'strategy_kpi', lineageKey: metadata.code, recordPublicId: input.recordPublicId, versionNumber: Number(metadata.versionNumber), minorVersionNumber: Number(metadata.minorVersionNumber), lifecycleStatus: 'draft', snapshot, changeNote: 'Saved working revision' });
		}
""" + anchor
s = rep(s, anchor, minor_snapshot, "minor save snapshot")
# Revision clones start at x.1
s = s.replace("framework_code, version_number, title,", "framework_code, version_number, minor_version_number, title,", 1)
s = s.replace("plan_code, version_number, title,", "plan_code, version_number, minor_version_number, title,", 1)
s = s.replace("kpi_code, version_number, title,", "kpi_code, version_number, minor_version_number, title,", 1)
# Add minor parameter after each controlled revision's next major sequence.
s = s.replace("Number(source.versionNumber) + 1,\n\t\t\t\t\tsource.title,", "Number(source.versionNumber) + 1,\n\t\t\t\t\t1,\n\t\t\t\t\tsource.title,", 2)
s = s.replace("Number(source.versionNumber) + 1,\n\t\t\t\tsource.title,", "Number(source.versionNumber) + 1,\n\t\t\t\t1,\n\t\t\t\tsource.title,", 1)
# Add minor placeholder to revision INSERT VALUES where the version is parameterized.
s = s.replace("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft',", "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft',", 1)
s = s.replace("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft',", "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft',", 1)
s = s.replace("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft',", "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft',", 1)
# Snapshot controlled revisions.
for action, record_type, table, fields in [
    ("strategy.framework.revise", "strategy_framework", "strategy_frameworks", "'title', title, 'horizonStart', horizon_start, 'horizonEnd', horizon_end, 'purpose', purpose_text, 'vision', vision_text, 'mission', mission_text, 'lifecycleStatus', lifecycle_status"),
    ("strategy.business-plan.revise", "strategy_business_plan", "strategy_business_plans", "'title', title, 'periodStart', period_start, 'periodEnd', period_end, 'narrative', narrative, 'currencyCode', currency_code, 'plannedRevenueAmount', planned_revenue_amount, 'plannedOpexAmount', planned_opex_amount, 'plannedCapexAmount', planned_capex_amount, 'lifecycleStatus', lifecycle_status"),
    ("strategy.kpi.revise", "strategy_kpi", "strategy_kpis", "'title', title, 'description', description, 'unitLabel', unit_label, 'direction', direction, 'baselineValue', baseline_value, 'targetValue', target_value, 'targetDate', target_date, 'lifecycleStatus', lifecycle_status"),
]:
    anchor = f"\t\t\tawait appendDomainEvidence(connection, {{\n\t\t\t\tactor: input.actor,\n\t\t\t\tactionKey: '{action}',"
    prefix = f"\t\t\tconst versionRow = await singleRow<RowDataPacket & {{ versionNumber: number | string; minorVersionNumber: number | string; snapshot: string | Record<string, unknown> }}>(`SELECT version_number AS versionNumber, minor_version_number AS minorVersionNumber, JSON_OBJECT({fields}) AS snapshot FROM {table} WHERE organisation_id = ? AND public_id = ? LIMIT 1`, [input.actor.organisationId, revisionPublicId]);\n\t\t\tawait appendGovernedVersion(connection, {{ actor: input.actor, domainCode: 'F01', recordType: '{record_type}', lineageKey: source.code, recordPublicId: revisionPublicId, versionNumber: Number(versionRow.versionNumber), minorVersionNumber: Number(versionRow.minorVersionNumber), lifecycleStatus: 'draft', snapshot: typeof versionRow.snapshot === 'string' ? JSON.parse(versionRow.snapshot) : versionRow.snapshot, changeNote: 'Controlled revision created from published version' }});\n" + anchor
    s = rep(s, anchor, prefix, f"revision snapshot {record_type}")
write(p, s)


# UI --------------------------------------------------------------------------
p = "appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/+page.svelte"
s = read(p)
s = rep(s, "<span>{framework.code} · v{framework.versionNumber}</span>", "<span>{framework.code} · v{framework.versionLabel}</span>", "overview version label")
s = rep(s, "<p class=\"section-kicker\">Controlled version lifecycle</p>\n\t\t\t<h2 id=\"version-lifecycle-title\">Strategy history is preserved, not overwritten.</h2>", "<p class=\"section-kicker\">Governed version · v{framework.versionLabel}</p>\n\t\t\t<h2 id=\"version-lifecycle-title\">Version history and business lifecycle are separate controls.</h2>", "overview version heading")
write(p, s)

p = "appv2/src/routes/[tenant]/app/(protected)/functions/f01/strategies/[strategy]/manage/[kind]/[record]/+page.svelte"
s = read(p)
anchor = "\n\t<section class=\"state-card\" aria-labelledby=\"lifecycle-title\">"
panel = """
	{#if record.versionLabel}
		<section class="version-card" aria-labelledby="version-title">
			<div>
				<p class="section-kicker">Version control</p>
				<h2 id="version-title">Version {record.versionLabel}</h2>
				<p>
					{record.versionStage === 'draft'
						? 'Working minor version. Each meaningful save creates the next minor version; approval publishes the next major version.'
						: record.versionStage === 'published'
							? 'Current published major version. It is immutable; create a controlled revision to change it.'
							: 'Historical published major version retained as immutable enterprise evidence.'}
				</p>
			</div>
			<StatusBadge
				label={record.versionStage === 'draft' ? 'Working draft' : record.versionStage === 'published' ? 'Published' : 'Historical'}
				tone={record.versionStage === 'published' ? 'success' : record.versionStage === 'draft' ? 'warning' : 'neutral'}
			/>
		</section>

		{#if record.versionHistory.length > 0}
			<Panel title="Version history" description="Published majors remain immutable; working minors record meaningful saved revisions.">
				<div class="version-history">
					{#each record.versionHistory as version (`${version.major}.${version.minor}-${version.createdAt}`)}
						<div class="version-row">
							<strong>v{version.label}</strong>
							<span>{recordLabel(version.status)}</span>
							<time datetime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time>
							<small>{version.changeNote ?? 'Governed version snapshot'}</small>
						</div>
					{/each}
				</div>
			</Panel>
		{/if}
	{/if}

	<section class="state-card" aria-labelledby="lifecycle-title">"""
s = rep(s, anchor, "\n" + panel, "manage version panel")
s = rep(s, "\t.state-card {\n", "\t.state-card,\n\t.version-card {\n", "version card style")
s = rep(s, "\n\t.record-form {\n", "\n\t.version-history { display: grid; gap: var(--nb-space-3); }\n\t.version-row { display: grid; grid-template-columns: 80px 110px minmax(160px, auto) 1fr; gap: var(--nb-space-3); align-items: baseline; padding-block: var(--nb-space-3); border-bottom: 1px solid var(--nb-color-border-subtle); }\n\t.version-row:last-child { border-bottom: 0; }\n\t.version-row span, .version-row time, .version-row small { color: var(--nb-color-text-secondary); }\n\n\t.record-form {\n", "version history styles")
write(p, s)


# Governing architecture -------------------------------------------------------
p = "docs/world-class/15-f01-strategy-enterprise-planning-v2.md"
s = read(p)
old = """## 4. Lifecycle and governance

The canonical strategy-version lifecycle is:

```text
Draft → Approved → Superseded
```

Draft strategy may be developed by authorised strategy managers. Strategy approval is an explicit governed transition and requires at least one active objective retaining selected-option lineage and a primary theme. Objectives created while a strategy is draft remain draft working records. Strategy approval validates their decision lineage and activates draft objectives in the same governed transaction. Approved strategy is immutable enterprise evidence. Material change requires a controlled revision or new strategy cycle.

F01.04 planning begins from an approved strategy. Business plans use:

```text
Draft → Approved → Superseded
```

Business-plan approval requires strategic-objective scope, at least one active initiative, and no identified resource demand left orphaned without an execution handoff. Proposed initiatives are governed as approved execution commitments when their business plan is approved.

KPI definitions use `Draft → Approved → Superseded/Retired`. Actual observations can only be recorded against an approved KPI definition. Strategic reviews use `Draft → Approved`; approval freezes the review as enterprise evidence rather than turning meeting notes into mutable history.

Server-side mutations re-check lifecycle inside the database transaction. A client-visible button or an earlier permission check is never sufficient authority.
"""
new = """## 4. Version control, lifecycle and governance

NuBlox separates **record version** from **business lifecycle**. Superseded is not a workflow step that a current record progresses into; it is the historical condition of a previously published major version after its controlled successor is published.

Versioned governed aggregate roots use SharePoint-style major/minor semantics adapted for enterprise transactions:

```text
0.1 Working draft
0.2, 0.3 ... meaningful saved minor revisions
1.0 Published / approved major
1.1, 1.2 ... controlled working revision of 1.0
2.0 Next published / approved major
```

Rules:

1. A minor version (`x.1`, `x.2`, ...) is a mutable working copy and is visible as draft governance state.
2. A meaningful explicit save creates the next minor; autosave/keystrokes do not create versions.
3. Approval publishes the next major (`x.0`) atomically with the governed approval transaction.
4. Published majors are immutable enterprise evidence.
5. Editing a published record creates a controlled minor revision; it never overwrites the published major.
6. When the successor is published, the predecessor major becomes historical automatically.
7. Version history records actor, timestamp, snapshot and change note and is queryable independently from audit/outbox evidence.
8. Transactional/event records that are not revision-controlled continue to use their domain lifecycle rather than artificial document versions.

For strategy, a first working cycle is `0.1`; first approval publishes `1.0`. A controlled revision of `1.0` starts at `1.1`; its approval publishes `2.0`. Strategy business lifecycle remains draft/current/historical governance, while objectives and downstream execution records retain their own lifecycle semantics.

Draft strategy may be developed by authorised strategy managers. Strategy approval is an explicit governed transition and requires at least one objective retaining selected-option lineage and a primary theme. Objectives created while a strategy is draft remain draft working records. Strategy approval validates their decision lineage and activates draft objectives in the same governed transaction.

F01.04 planning begins from an approved strategy. Business plans use the same major/minor publishing discipline. Business-plan approval requires strategic-objective scope, at least one active initiative, and no identified resource demand left orphaned without an execution handoff. Proposed initiatives become approved execution commitments when their governing plan major is published.

KPI definitions use the same major/minor publishing discipline and may later be retired as a business lifecycle outcome. Actual observations can only be recorded against a published/approved KPI definition. Strategic reviews use a frozen approval lifecycle; their evidence snapshot is immutable and is not rewritten by later observations.

Server-side mutations re-check lifecycle and version authority inside the database transaction. A client-visible button or an earlier permission check is never sufficient authority.
"""
s = rep(s, old, new, "governing versioning section")
s = s.replace("- controlled strategy revision and approved-version carry-forward semantics for all new V2 traceability records;\n", "", 1)
write(p, s)
