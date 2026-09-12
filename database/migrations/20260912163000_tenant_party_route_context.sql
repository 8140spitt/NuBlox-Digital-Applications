-- Tenant-first route identity and CRM-party portal context.
-- Public URLs use stable human-readable slugs, while authorisation remains ID/grant based.
-- migrate:up transaction:false

ALTER TABLE organisations
    ADD COLUMN route_slug VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER public_id;

UPDATE organisations
SET route_slug = LOWER(
    REGEXP_REPLACE(
        COALESCE(NULLIF(TRIM(trading_name), ''), NULLIF(TRIM(legal_name), ''), CONCAT('tenant', id)),
        '[^A-Za-z0-9]+',
        ''
    )
);

UPDATE organisations
SET route_slug = CONCAT('tenant', id)
WHERE route_slug IS NULL OR route_slug = '';

UPDATE organisations AS organisation
INNER JOIN (
    SELECT route_slug
    FROM organisations
    GROUP BY route_slug
    HAVING COUNT(*) > 1
) AS duplicate_slug
    ON duplicate_slug.route_slug = organisation.route_slug
SET organisation.route_slug = CONCAT(
    organisation.route_slug,
    '-',
    LEFT(REPLACE(organisation.public_id, '-', ''), 8)
);

ALTER TABLE organisations
    ADD UNIQUE KEY uq_organisations_route_slug (route_slug);

ALTER TABLE parties
    ADD COLUMN route_slug VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER public_id;

UPDATE parties AS party
LEFT JOIN party_organisations AS company
    ON company.party_id = party.id
    AND company.organisation_id = party.organisation_id
LEFT JOIN party_persons AS person
    ON person.party_id = party.id
    AND person.organisation_id = party.organisation_id
SET party.route_slug = LOWER(
    REGEXP_REPLACE(
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
    )
);

UPDATE parties
SET route_slug = CONCAT('party', id)
WHERE route_slug IS NULL OR route_slug = '';

UPDATE parties AS party
INNER JOIN (
    SELECT organisation_id, route_slug
    FROM parties
    GROUP BY organisation_id, route_slug
    HAVING COUNT(*) > 1
) AS duplicate_slug
    ON duplicate_slug.organisation_id = party.organisation_id
    AND duplicate_slug.route_slug = party.route_slug
SET party.route_slug = CONCAT(
    party.route_slug,
    '-',
    LEFT(REPLACE(party.public_id, '-', ''), 8)
);

ALTER TABLE parties
    ADD UNIQUE KEY uq_parties_organisation_route_slug (organisation_id, route_slug);

ALTER TABLE external_access_invitations
    ADD COLUMN party_id BIGINT UNSIGNED NULL AFTER owning_organisation_id,
    ADD KEY idx_external_access_invitations_party (party_id, owning_organisation_id),
    ADD CONSTRAINT fk_external_access_invitations_party
        FOREIGN KEY (party_id, owning_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE external_access_grants
    ADD COLUMN party_id BIGINT UNSIGNED NULL AFTER owning_organisation_id,
    ADD KEY idx_external_access_grants_party (party_id, owning_organisation_id),
    ADD CONSTRAINT fk_external_access_grants_party
        FOREIGN KEY (party_id, owning_organisation_id)
        REFERENCES parties (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Supplier RFQ invitations already carry the canonical supplier CRM party.
UPDATE external_access_invitations AS external_invitation
INNER JOIN external_supplier_rfq_links AS link
    ON link.external_access_invitation_id = external_invitation.id
INNER JOIN rfq_invitations AS rfq_invitation
    ON rfq_invitation.id = link.rfq_invitation_id
    AND rfq_invitation.organisation_id = external_invitation.owning_organisation_id
SET external_invitation.party_id = rfq_invitation.supplier_party_id
WHERE external_invitation.party_id IS NULL;

-- Invitation-derived grants inherit the CRM party identity.
UPDATE external_access_grants AS grant
INNER JOIN external_access_invitations AS invitation
    ON invitation.id = grant.invitation_id
    AND invitation.owning_organisation_id = grant.owning_organisation_id
SET grant.party_id = invitation.party_id
WHERE grant.party_id IS NULL
  AND invitation.party_id IS NOT NULL;

-- Existing person-level project grants resolve to the represented CRM organisation
-- where one exists, otherwise to the invited CRM person.
UPDATE external_access_grants AS grant
INNER JOIN projects AS project
    ON project.public_id = grant.context_public_id
    AND project.owning_organisation_id = grant.owning_organisation_id
INNER JOIN project_external_collaborators AS collaborator
    ON collaborator.project_id = project.id
    AND collaborator.owning_organisation_id = grant.owning_organisation_id
    AND collaborator.auth_user_id = grant.auth_user_id
SET grant.party_id = COALESCE(
    collaborator.crm_organisation_party_id,
    collaborator.crm_person_party_id
)
WHERE grant.party_id IS NULL
  AND grant.context_type = 'project';

-- The portal context remains canonical even for grants created by older adapters that
-- have not yet started writing party_id. This view derives the CRM principal from the
-- authoritative supplier/project relationship rather than trusting a URL slug.
CREATE OR REPLACE VIEW external_portal_access_contexts AS
SELECT
    grant.id AS external_access_grant_id,
    grant.auth_user_id,
    grant.owning_organisation_id,
    grant.party_id
FROM external_access_grants AS grant
WHERE grant.party_id IS NOT NULL
UNION
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
DROP VIEW IF EXISTS external_portal_access_contexts;

ALTER TABLE external_access_grants
    DROP FOREIGN KEY fk_external_access_grants_party,
    DROP KEY idx_external_access_grants_party,
    DROP COLUMN party_id;

ALTER TABLE external_access_invitations
    DROP FOREIGN KEY fk_external_access_invitations_party,
    DROP KEY idx_external_access_invitations_party,
    DROP COLUMN party_id;

ALTER TABLE parties
    DROP KEY uq_parties_organisation_route_slug,
    DROP COLUMN route_slug;

ALTER TABLE organisations
    DROP KEY uq_organisations_route_slug,
    DROP COLUMN route_slug;
