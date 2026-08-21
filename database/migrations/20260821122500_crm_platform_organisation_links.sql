-- NuBlox CRM-to-platform organisation linkage for controlled collaboration
-- A tenant-private CRM organisation may explicitly reference one NuBlox platform organisation.
-- No company-name matching or unrestricted platform directory is introduced.
-- migrate:up transaction:false

ALTER TABLE party_organisations
    ADD COLUMN linked_organisation_id BIGINT UNSIGNED NULL AFTER trading_name,
    ADD UNIQUE KEY uq_party_organisations_linked_org (organisation_id, linked_organisation_id),
    ADD KEY idx_party_organisations_linked_org (linked_organisation_id),
    ADD CONSTRAINT fk_party_organisations_linked_org
        FOREIGN KEY (linked_organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    ADD CONSTRAINT ck_party_organisations_not_self
        CHECK (linked_organisation_id IS NULL OR linked_organisation_id <> organisation_id);

-- migrate:down transaction:false
-- Released CRM collaboration links are forward-only because project invitation and audit
-- history may depend on the explicit association. Non-production environments are rebuilt.
SELECT 1;
