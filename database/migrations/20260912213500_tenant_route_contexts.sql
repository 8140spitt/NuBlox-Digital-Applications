-- NuBlox V2 stable tenant routing identity.
-- Route slugs identify URL context only; they never grant organisation membership or permission.
-- migrate:up transaction:false

CREATE TABLE tenant_route_contexts (
    organisation_id BIGINT UNSIGNED NOT NULL,
    route_slug VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (organisation_id),
    UNIQUE KEY uq_tenant_route_contexts_route_slug (route_slug),

    CONSTRAINT fk_tenant_route_contexts_organisation
        FOREIGN KEY (organisation_id) REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT ck_tenant_route_contexts_route_slug
        CHECK (route_slug REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$')
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT INTO tenant_route_contexts (organisation_id, route_slug)
SELECT
    ranked.organisation_id,
    CASE
        WHEN ranked.duplicate_count > 1 OR ranked.base_slug IN (
            'api', 'signin', 'signup', 'forgot-password', 'reset-password',
            'select-organisation', 'network', 'portal'
        )
            THEN CONCAT(LEFT(ranked.base_slug, 80), '-', LEFT(REPLACE(ranked.public_id, '-', ''), 8))
        ELSE LEFT(ranked.base_slug, 96)
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
        FROM organisations AS organisation
        WHERE organisation.status = 'active'
    ) AS normalised
) AS ranked;

-- migrate:down transaction:false
DROP TABLE tenant_route_contexts;
