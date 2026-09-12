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


-- Route slugs are allocated lazily by the application so they always obey the canonical route contract,
-- including reserved roots, ASCII normalisation, length bounds and deterministic collision handling.
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


-- CRM-party route slugs are also allocated lazily from the authoritative party record.
-- Current external adapters resolve their CRM principal from canonical domain relationships.
-- New adapters can add their own explicit binding without changing the public URL model.
CREATE OR REPLACE VIEW routing_external_portal_access_contexts AS
SELECT
    access_grant.id AS external_access_grant_id,
    access_grant.auth_user_id,
    access_grant.owning_organisation_id,
    rfq_invitation.supplier_party_id AS party_id
FROM external_access_grants AS access_grant
INNER JOIN external_supplier_rfq_links AS link
    ON link.external_access_invitation_id = access_grant.invitation_id
INNER JOIN rfq_invitations AS rfq_invitation
    ON rfq_invitation.id = link.rfq_invitation_id
    AND rfq_invitation.organisation_id = access_grant.owning_organisation_id
WHERE rfq_invitation.supplier_party_id IS NOT NULL
UNION
SELECT
    access_grant.id AS external_access_grant_id,
    access_grant.auth_user_id,
    access_grant.owning_organisation_id,
    COALESCE(collaborator.crm_organisation_party_id, collaborator.crm_person_party_id) AS party_id
FROM external_access_grants AS access_grant
INNER JOIN projects AS project
    ON project.public_id = access_grant.context_public_id
    AND project.owning_organisation_id = access_grant.owning_organisation_id
INNER JOIN project_external_collaborators AS collaborator
    ON collaborator.project_id = project.id
    AND collaborator.owning_organisation_id = access_grant.owning_organisation_id
    AND collaborator.auth_user_id = access_grant.auth_user_id
    AND collaborator.status = 'active'
WHERE access_grant.context_type = 'project'
  AND COALESCE(collaborator.crm_organisation_party_id, collaborator.crm_person_party_id) IS NOT NULL;

-- migrate:down transaction:false
DROP VIEW IF EXISTS routing_external_portal_access_contexts;
DROP TABLE party_route_contexts;
DROP TABLE tenant_route_contexts;
