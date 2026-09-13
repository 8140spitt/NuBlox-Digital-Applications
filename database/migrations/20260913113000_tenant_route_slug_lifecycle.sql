-- NuBlox V2 tenant-first routing lifecycle.
-- Ensures every organisation has one stable route slug, including organisations
-- created after the original tenant_route_contexts backfill.
-- migrate:up transaction:false

UPDATE tenant_route_contexts route_context
JOIN organisations organisation
  ON organisation.id = route_context.organisation_id
SET route_context.route_slug = CONCAT(
    LEFT(route_context.route_slug, 80),
    '-',
    LEFT(REPLACE(organisation.public_id, '-', ''), 8)
)
WHERE route_context.route_slug IN ('api', 'start', 'register', 'verify-email');

INSERT INTO tenant_route_contexts (organisation_id, route_slug)
SELECT
    missing.organisation_id,
    CASE
        WHEN missing.duplicate_count > 1
          OR missing.base_slug IN ('api', 'start', 'register', 'verify-email')
          OR EXISTS (
              SELECT 1
              FROM tenant_route_contexts existing_slug
              WHERE existing_slug.route_slug = missing.base_slug
          )
        THEN CONCAT(
            LEFT(missing.base_slug, 80),
            '-',
            LEFT(REPLACE(missing.public_id, '-', ''), 8)
        )
        ELSE LEFT(missing.base_slug, 96)
    END
FROM (
    SELECT
        normalised.organisation_id,
        normalised.public_id,
        normalised.base_slug,
        COUNT(*) OVER (PARTITION BY normalised.base_slug) AS duplicate_count
    FROM (
        SELECT
            organisation.id AS organisation_id,
            organisation.public_id,
            COALESCE(
                NULLIF(
                    TRIM(BOTH '-' FROM REGEXP_REPLACE(
                        LOWER(COALESCE(NULLIF(organisation.trading_name, ''), organisation.legal_name)),
                        '[^a-z0-9]+',
                        '-'
                    )),
                    ''
                ),
                CONCAT('tenant-', LEFT(REPLACE(organisation.public_id, '-', ''), 8))
            ) AS base_slug
        FROM organisations organisation
        LEFT JOIN tenant_route_contexts route_context
          ON route_context.organisation_id = organisation.id
        WHERE route_context.organisation_id IS NULL
    ) normalised
) missing;

CREATE TRIGGER trg_organisations_create_tenant_route_context
AFTER INSERT ON organisations
FOR EACH ROW
INSERT INTO tenant_route_contexts (organisation_id, route_slug)
SELECT
    NEW.id,
    CASE
        WHEN candidate.base_slug IN ('api', 'start', 'register', 'verify-email')
          OR EXISTS (
              SELECT 1
              FROM tenant_route_contexts existing_slug
              WHERE existing_slug.route_slug = candidate.base_slug
          )
        THEN CONCAT(
            LEFT(candidate.base_slug, 80),
            '-',
            LEFT(REPLACE(NEW.public_id, '-', ''), 8)
        )
        ELSE LEFT(candidate.base_slug, 96)
    END
FROM (
    SELECT COALESCE(
        NULLIF(
            TRIM(BOTH '-' FROM REGEXP_REPLACE(
                LOWER(COALESCE(NULLIF(NEW.trading_name, ''), NEW.legal_name)),
                '[^a-z0-9]+',
                '-'
            )),
            ''
        ),
        CONCAT('tenant-', LEFT(REPLACE(NEW.public_id, '-', ''), 8))
    ) AS base_slug
) candidate;

-- migrate:down transaction:false
DROP TRIGGER IF EXISTS trg_organisations_create_tenant_route_context;
