-- NuBlox CRM opportunities and activity timeline activation
-- Data/reference-only forward migration over Package 002.
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

-- Existing standard management roles receive the same granular defaults that
-- OrganisationBootstrapService applies to future organisations. Owner and
-- Administrator also retain crm.manage as the broad umbrella.
INSERT IGNORE INTO role_permissions (
    organisation_id,
    organisation_role_id,
    permission_id
)
SELECT
    role.organisation_id,
    role.id,
    permission.id
FROM organisation_roles AS role
INNER JOIN permissions AS permission
    ON role.name IN ('Owner', 'Administrator', 'Manager')
   AND permission.permission_key IN ('crm.opportunity.manage', 'crm.activity.manage')
WHERE role.is_active = TRUE
  AND permission.is_active = TRUE;

-- Package 002 already contains tenant-owned pipeline/stage tables. Seed one
-- usable default only for organisations that have no pipeline configuration at
-- all; existing/custom tenant pipeline configuration is never overwritten.
INSERT INTO crm_pipelines (
    organisation_id,
    public_id,
    name,
    is_default,
    is_active
)
SELECT
    organisation.id,
    UUID(),
    'Sales',
    TRUE,
    TRUE
FROM organisations AS organisation
WHERE NOT EXISTS (
    SELECT 1
    FROM crm_pipelines AS existing_pipeline
    WHERE existing_pipeline.organisation_id = organisation.id
);

-- Seed the standard stages only when the default Sales pipeline has no stages.
-- Pipeline stage remains sales maturity; opportunity.status owns terminal
-- outcome, so a won/lost/cancelled opportunity preserves the last stage reached.
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
FROM crm_pipelines AS pipeline
CROSS JOIN (
    SELECT 'Lead' AS name, 10 AS sort_order, CAST(10.00 AS DECIMAL(5,2)) AS probability_percent
    UNION ALL SELECT 'Qualified', 20, CAST(30.00 AS DECIMAL(5,2))
    UNION ALL SELECT 'Proposal', 30, CAST(60.00 AS DECIMAL(5,2))
    UNION ALL SELECT 'Negotiation', 40, CAST(80.00 AS DECIMAL(5,2))
) AS stage
WHERE pipeline.name = 'Sales'
  AND pipeline.is_default = TRUE
  AND pipeline.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM crm_pipeline_stages AS existing_stage
      WHERE existing_stage.organisation_id = pipeline.organisation_id
        AND existing_stage.crm_pipeline_id = pipeline.id
  );

-- migrate:down transaction:false
-- Released permission/grant and tenant pipeline configuration is forward-only.
-- Non-production environments are rebuilt instead of attempting destructive
-- rollback over customer CRM configuration.
SELECT 1;
