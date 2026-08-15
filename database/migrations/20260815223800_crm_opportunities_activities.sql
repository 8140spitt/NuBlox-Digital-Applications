-- NuBlox CRM opportunities and activity timeline activation
-- Persistent data/reference-only forward migration over Package 002.
-- migrate:up transaction:false

INSERT INTO permissions (
    capability_id,
    permission_key,
    name,
    description,
    is_active
)
VALUES
    (NULL, 'crm.opportunity.manage', 'Manage CRM opportunities', 'Create and maintain tenant-owned opportunities, stages, outcomes and opportunity participants.', TRUE),
    (NULL, 'crm.activity.manage', 'Manage CRM activities', 'Create tenant-owned CRM timeline activities and their participants.', TRUE)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- These granular permissions are intentionally not auto-granted to standard
-- non-administrative roles. Owner and Administrator continue to operate through
-- the existing crm.manage umbrella; organisations can delegate the new keys to
-- the exact sales/commercial roles or members that need them.

-- Snapshot only the organisations that have zero pipeline configuration before
-- this migration creates anything. The temporary working set prevents the stage
-- seed from mutating an existing/custom default pipeline that happens to be
-- called "Sales" and has no stages yet.
DROP TEMPORARY TABLE IF EXISTS tmp_crm_default_pipeline_organisations;
CREATE TEMPORARY TABLE tmp_crm_default_pipeline_organisations (
    organisation_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (organisation_id)
) ENGINE = MEMORY;

INSERT INTO tmp_crm_default_pipeline_organisations (organisation_id)
SELECT organisation.id
FROM organisations AS organisation
WHERE NOT EXISTS (
    SELECT 1
    FROM crm_pipelines AS existing_pipeline
    WHERE existing_pipeline.organisation_id = organisation.id
);

INSERT INTO crm_pipelines (
    organisation_id,
    public_id,
    name,
    is_default,
    is_active
)
SELECT
    target.organisation_id,
    UUID(),
    'Sales',
    TRUE,
    TRUE
FROM tmp_crm_default_pipeline_organisations AS target;

-- Stage represents sales maturity. Opportunity.status owns terminal outcome, so
-- a won/lost/cancelled opportunity preserves the last stage it actually reached.
INSERT INTO crm_pipeline_stages (
    organisation_id,
    crm_pipeline_id,
    name,
    sort_order,
    probability_percent,
    is_active
)
SELECT
    pipeline.organisation_id,
    pipeline.id,
    stage.name,
    stage.sort_order,
    stage.probability_percent,
    TRUE
FROM tmp_crm_default_pipeline_organisations AS target
INNER JOIN crm_pipelines AS pipeline
    ON pipeline.organisation_id = target.organisation_id
   AND pipeline.name = 'Sales'
   AND pipeline.is_default = TRUE
   AND pipeline.is_active = TRUE
CROSS JOIN (
    SELECT 'Lead' AS name, 10 AS sort_order, CAST(10.00 AS DECIMAL(5,2)) AS probability_percent
    UNION ALL SELECT 'Qualified', 20, CAST(30.00 AS DECIMAL(5,2))
    UNION ALL SELECT 'Proposal', 30, CAST(60.00 AS DECIMAL(5,2))
    UNION ALL SELECT 'Negotiation', 40, CAST(80.00 AS DECIMAL(5,2))
) AS stage;

DROP TEMPORARY TABLE IF EXISTS tmp_crm_default_pipeline_organisations;

-- migrate:down transaction:false
-- Released permission catalogue and tenant pipeline configuration is forward-only.
-- Non-production environments are rebuilt instead of attempting destructive
-- rollback over customer CRM configuration.
SELECT 1;
