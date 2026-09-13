-- NuBlox governed record versioning foundation.
-- SharePoint-style semantics adapted for controlled business records:
--   draft working copies use minor versions (0.1, 1.1, 1.2 ...)
--   approved/published copies use major versions (1.0, 2.0 ...)
--   previously published majors remain immutable history.
-- migrate:up transaction:false

ALTER TABLE strategy_frameworks
    ADD COLUMN minor_version_number INT UNSIGNED NOT NULL DEFAULT 0 AFTER version_number;

ALTER TABLE strategy_business_plans
    ADD COLUMN minor_version_number INT UNSIGNED NOT NULL DEFAULT 0 AFTER version_number;

ALTER TABLE strategy_kpis
    ADD COLUMN minor_version_number INT UNSIGNED NOT NULL DEFAULT 0 AFTER version_number;

UPDATE strategy_frameworks
SET minor_version_number = 1
WHERE lifecycle_status = 'draft';

UPDATE strategy_business_plans
SET minor_version_number = 1
WHERE lifecycle_status = 'draft';

UPDATE strategy_kpis
SET minor_version_number = 1
WHERE lifecycle_status = 'draft';

CREATE TABLE governed_record_versions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    organisation_id BIGINT UNSIGNED NOT NULL,
    domain_code VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    record_type VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    lineage_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    record_public_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    major_version INT UNSIGNED NOT NULL,
    minor_version INT UNSIGNED NOT NULL,
    version_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    snapshot_json JSON NOT NULL,
    change_note TEXT NULL,
    created_by_member_id BIGINT UNSIGNED NOT NULL,
    published_by_member_id BIGINT UNSIGNED NULL,
    published_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uq_governed_record_version (
        organisation_id,
        domain_code,
        record_type,
        lineage_key,
        major_version,
        minor_version
    ),
    KEY ix_governed_record_public (
        organisation_id,
        domain_code,
        record_type,
        record_public_id,
        created_at
    ),
    KEY ix_governed_record_lineage (
        organisation_id,
        domain_code,
        record_type,
        lineage_key,
        major_version,
        minor_version
    ),
    CONSTRAINT fk_governed_record_version_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations(id),
    CONSTRAINT fk_governed_record_version_created_by
        FOREIGN KEY (created_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT fk_governed_record_version_published_by
        FOREIGN KEY (published_by_member_id) REFERENCES organisation_members(id),
    CONSTRAINT chk_governed_record_version_status
        CHECK (version_status IN ('draft', 'published', 'historical', 'discarded')),
    CONSTRAINT chk_governed_record_version_coordinates
        CHECK (
            (version_status = 'draft' AND minor_version >= 1)
            OR (version_status IN ('published', 'historical') AND minor_version = 0)
            OR version_status = 'discarded'
        )
) ENGINE=InnoDB
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

-- Backfill the currently persisted F01 governed aggregates so version history
-- begins with the evidence already in the system.
INSERT INTO governed_record_versions (
    organisation_id,
    domain_code,
    record_type,
    lineage_key,
    record_public_id,
    major_version,
    minor_version,
    version_status,
    snapshot_json,
    change_note,
    created_by_member_id,
    published_by_member_id,
    published_at,
    created_at
)
SELECT
    organisation_id,
    'F01',
    'strategy_framework',
    framework_code,
    public_id,
    CASE WHEN lifecycle_status = 'draft' THEN version_number - 1 ELSE version_number END,
    minor_version_number,
    CASE
        WHEN lifecycle_status = 'draft' THEN 'draft'
        WHEN lifecycle_status = 'approved' THEN 'published'
        ELSE 'historical'
    END,
    JSON_OBJECT(
        'title', title,
        'horizonStart', horizon_start,
        'horizonEnd', horizon_end,
        'purpose', purpose_text,
        'vision', vision_text,
        'mission', mission_text,
        'lifecycleStatus', lifecycle_status
    ),
    'Backfilled when governed major/minor versioning was enabled.',
    created_by_member_id,
    approved_by_member_id,
    approved_at,
    created_at
FROM strategy_frameworks;

INSERT INTO governed_record_versions (
    organisation_id,
    domain_code,
    record_type,
    lineage_key,
    record_public_id,
    major_version,
    minor_version,
    version_status,
    snapshot_json,
    change_note,
    created_by_member_id,
    published_by_member_id,
    published_at,
    created_at
)
SELECT
    organisation_id,
    'F01',
    'strategy_business_plan',
    plan_code,
    public_id,
    CASE WHEN lifecycle_status = 'draft' THEN version_number - 1 ELSE version_number END,
    minor_version_number,
    CASE
        WHEN lifecycle_status = 'draft' THEN 'draft'
        WHEN lifecycle_status = 'approved' THEN 'published'
        ELSE 'historical'
    END,
    JSON_OBJECT(
        'title', title,
        'periodStart', period_start,
        'periodEnd', period_end,
        'narrative', narrative,
        'currencyCode', currency_code,
        'plannedRevenueAmount', planned_revenue_amount,
        'plannedOpexAmount', planned_opex_amount,
        'plannedCapexAmount', planned_capex_amount,
        'lifecycleStatus', lifecycle_status
    ),
    'Backfilled when governed major/minor versioning was enabled.',
    created_by_member_id,
    approved_by_member_id,
    approved_at,
    created_at
FROM strategy_business_plans;

INSERT INTO governed_record_versions (
    organisation_id,
    domain_code,
    record_type,
    lineage_key,
    record_public_id,
    major_version,
    minor_version,
    version_status,
    snapshot_json,
    change_note,
    created_by_member_id,
    published_by_member_id,
    published_at,
    created_at
)
SELECT
    organisation_id,
    'F01',
    'strategy_kpi',
    kpi_code,
    public_id,
    CASE WHEN lifecycle_status = 'draft' THEN version_number - 1 ELSE version_number END,
    minor_version_number,
    CASE
        WHEN lifecycle_status = 'draft' THEN 'draft'
        WHEN lifecycle_status = 'approved' THEN 'published'
        ELSE 'historical'
    END,
    JSON_OBJECT(
        'title', title,
        'description', description,
        'unitLabel', unit_label,
        'direction', direction,
        'aggregationMethod', aggregation_method,
        'baselineValue', baseline_value,
        'targetValue', target_value,
        'warningThreshold', warning_threshold,
        'criticalThreshold', critical_threshold,
        'targetDate', target_date,
        'sourceMode', source_mode,
        'sourceDomain', source_domain,
        'sourceRecordType', source_record_type,
        'sourceMeasureKey', source_measure_key,
        'lifecycleStatus', lifecycle_status
    ),
    'Backfilled when governed major/minor versioning was enabled.',
    created_by_member_id,
    approved_by_member_id,
    approved_at,
    created_at
FROM strategy_kpis;

-- migrate:down transaction:false
DROP TABLE governed_record_versions;

ALTER TABLE strategy_kpis
    DROP COLUMN minor_version_number;

ALTER TABLE strategy_business_plans
    DROP COLUMN minor_version_number;

ALTER TABLE strategy_frameworks
    DROP COLUMN minor_version_number;
