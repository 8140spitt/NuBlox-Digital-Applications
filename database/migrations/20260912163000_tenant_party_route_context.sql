-- Tenant-first route identity and CRM-party portal context.
-- Routing is a platform concern: authoritative organisation, CRM party and grant records remain unchanged.
-- migrate:up transaction:false

CREATE TABLE tenant_route_contexts (
    organisation_id BIGINT UNSIGNED NOT NULL,
    route_slug VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (organisation_id),
    UNIQUE KEY uq_tenant_route_contexts_slug (route_slug),
    CONSTRAINT fk_tenant_route_contexts_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO tenant_route_contexts (organisation_id, route_slug)
SELECT
    organisation.id,
    CASE
        WHEN duplicate_slug.slug_count > 1 THEN CONCAT(
            LOWER(REGEXP_REPLACE(
                COALESCE(NULLIF(TRIM(organisation.trading_name), ''), NULLIF(TRIM(organisation.legal_name), ''), CONCAT('tenant', organisation.id)),
                '[^A-Za-z0-9]+',
                ''
            )),
            '-',
            LEFT(REPLACE(organisation.public_id, '-', ''), 8)
        )
        ELSE LOWER(REGEXP_REPLACE(
            COALESCE(NULLIF(TRIM(organisation.trading_name), ''), NULLIF(TRIM(organisation.legal_name), ''), CONCAT('tenant', organisation.id)),
            '[^A-Za-z0-9]+',
            ''
        ))
    END AS route_slug
FROM organisations AS organisation
INNER JOIN (
    SELECT normalised_slug, COUNT(*) AS slug_count
    FROM (
        SELECT LOWER(REGEXP_REPLACE(
            COALESCE(NULLIF(TRIM(trading_name), ''), NULLIF(TRIM(legal_name), ''), CONCAT('tenant', id)),
            '[^A-Za-z0-9]+',
            ''
        )) AS normalised_slug
        FROM organisations
    ) AS source_slugs
    GROUP BY normalised_slug
) AS duplicate_slug
    ON duplicate_slug.normalised_slug = LOWER(REGEXP_REPLACE(
        COALESCE(NULLIF(TRIM(organisation.trading_name), ''), NULLIF(TRIM(organisation.legal_name), ''), CONCAT('tenant', organisation.id)),
        '[^A-Za-z0-9]+',
        ''
    ));

CREATE TABLE party_route_contexts (
    organisation_id BIGINT UNSIGNED NOT NULL,
    party_id BIGINT UNSIGNED NOT NULL,
    route_slug VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (organisation_id, party_id),
    UNIQUE KEY uq_party_route_contexts_slug (organisation_id, route_slug),
    CONSTRAINT fk_party_route_contexts_party
        FOREIGN KEY (party_id, organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO party_route_contexts (organisation_id, party_id, route_slug)
SELECT
    source.organisation_id,
    source.party_id,
    CASE
        WHEN duplicates.slug_count > 1 THEN CONCAT(
            source.normalised_slug,
            '-',
            LEFT(REPLACE(source.public_id, '-', ''), 8)
        )
        ELSE source.normalised_slug
    END AS route_slug
FROM (
    SELECT
        party.organisation_id,
        party.id AS party_id,
        party.public_id,
        LOWER(REGEXP_REPLACE(
            CASE
                WHEN party.party_kind = 'organisation' THEN COALESCE(
                    NULLIF(TRIM(company.trading_name), ''),
                    NULLIF(TRIM(company.legal_name), ''),
                    CONCAT('party', party.id)
                )
                ELSE COALESCE(
                    NULLIF(TRIM(CONCAT_WS('', person.preferred_name, person.family_name)), ''),
                    NULLIF(TRIM(CONCAT_WS('', person.given_names, person.family_name)), ''),
                    CONCAT('party', party.id)
                )
            END,
            '[^A-Za-z0-9]+',
            ''
        )) AS normalised_slug
    FROM parties AS party
    LEFT JOIN party_organisations AS company
        ON company.party_id = party.id
        AND company.organisation_id = party.organisation_id
    LEFT JOIN party_persons AS person
        ON person.party_id = party.id
        AND person.organisation_id = party.organisation_id
) AS source
INNER JOIN (
    SELECT organisation_id, normalised_slug, COUNT(*) AS slug_count
    FROM (
        SELECT
            party.organisation_id,
            LOWER(REGEXP_REPLACE(
                CASE
                    WHEN party.party_kind = 'organisation' THEN COALESCE(
                        NULLIF(TRIM(company.trading_name), ''),
                        NULLIF(TRIM(company.legal_name), ''),
                        CONCAT('party', party.id)
                    )
                    ELSE COALESCE(
                        NULLIF(TRIM(CONCAT_WS('', person.preferred_name, person.family_name)), ''),
                        NULLIF(TRIM(CONCAT_WS('', person.given_names, person.family_name)), ''),
                        CONCAT('party', party.id)
                    )
                END,
                '[^A-Za-z0-9]+',
                ''
            )) AS normalised_slug
        FROM parties AS party
        LEFT JOIN party_organisations AS company
            ON company.party_id = party.id
            AND company.organisation_id = party.organisation_id
        LEFT JOIN party_persons AS person
            ON person.party_id = party.id
            AND person.organisation_id = party.organisation_id
    ) AS route_candidates
    GROUP BY organisation_id, normalised_slug
) AS duplicates
    ON duplicates.organisation_id = source.organisation_id
    AND duplicates.normalised_slug = source.normalised_slug;

-- Current external adapters resolve their CRM principal from canonical domain relationships.
-- New adapters can add their own explicit binding without changing the public URL model.
CREATE OR REPLACE VIEW routing_external_portal_access_contexts AS
SELECT
    grant.id AS external_access_grant_id,
    grant.auth_user_id,
    grant.owning_organisation_id,
    rfq_invitation.supplier_party_id AS party_id
FROM external_access_grants AS grant
INNER JOIN external_supplier_rfq_links AS link
    ON link.external_access_invitation_id = grant.invitation_id
INNER JOIN rfq_invitations AS rfq_invitation
    ON rfq_invitation.id = link.rfq_invitation_id
    AND rfq_invitation.organisation_id = grant.owning_organisation_id
WHERE rfq_invitation.supplier_party_id IS NOT NULL
UNION
SELECT
    grant.id AS external_access_grant_id,
    grant.auth_user_id,
    grant.owning_organisation_id,
    COALESCE(collaborator.crm_organisation_party_id, collaborator.crm_person_party_id) AS party_id
FROM external_access_grants AS grant
INNER JOIN projects AS project
    ON project.public_id = grant.context_public_id
    AND project.owning_organisation_id = grant.owning_organisation_id
INNER JOIN project_external_collaborators AS collaborator
    ON collaborator.project_id = project.id
    AND collaborator.owning_organisation_id = grant.owning_organisation_id
    AND collaborator.auth_user_id = grant.auth_user_id
    AND collaborator.status = 'active'
WHERE grant.context_type = 'project'
  AND COALESCE(collaborator.crm_organisation_party_id, collaborator.crm_person_party_id) IS NOT NULL;

-- migrate:down transaction:false
DROP VIEW IF EXISTS routing_external_portal_access_contexts;
DROP TABLE party_route_contexts;
DROP TABLE tenant_route_contexts;
