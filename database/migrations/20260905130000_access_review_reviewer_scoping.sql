-- Independent, scoped reviewers for organisation access-review campaigns.
-- Reviewer assignments govern attestation authority only; they never grant runtime access.

-- migrate:up transaction:false

ALTER TABLE access_review_campaigns
    ADD COLUMN reviewer_mode VARCHAR(24) NOT NULL DEFAULT 'organisation_manage' AFTER due_at,
    ADD CONSTRAINT ck_access_review_campaigns_reviewer_mode
        CHECK (reviewer_mode IN ('organisation_manage', 'assigned'));

CREATE TABLE access_review_reviewer_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NOT NULL,
    campaign_id BIGINT UNSIGNED NOT NULL,
    organisation_id BIGINT UNSIGNED NOT NULL,
    subject_member_id BIGINT UNSIGNED NOT NULL,
    reviewer_member_id BIGINT UNSIGNED NOT NULL,
    assigned_by_member_id BIGINT UNSIGNED NOT NULL,
    assigned_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    UNIQUE KEY uq_access_review_reviewer_assignments_public_id (public_id),
    UNIQUE KEY uq_access_review_reviewer_assignments_subject (campaign_id, subject_member_id),
    KEY idx_access_review_reviewer_assignments_reviewer (organisation_id, reviewer_member_id, campaign_id),
    KEY idx_access_review_reviewer_assignments_subject_org (subject_member_id, organisation_id),
    KEY idx_access_review_reviewer_assignments_reviewer_org (reviewer_member_id, organisation_id),
    KEY idx_access_review_reviewer_assignments_assigned_by_org (assigned_by_member_id, organisation_id),

    CONSTRAINT fk_access_review_reviewer_assignments_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES access_review_campaigns (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_access_review_reviewer_assignments_organisation
        FOREIGN KEY (organisation_id)
        REFERENCES organisations (id)
        ON UPDATE RESTRICT ON DELETE CASCADE,
    CONSTRAINT fk_access_review_reviewer_assignments_subject_member
        FOREIGN KEY (subject_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_access_review_reviewer_assignments_reviewer_member
        FOREIGN KEY (reviewer_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_access_review_reviewer_assignments_assigned_by_member
        FOREIGN KEY (assigned_by_member_id, organisation_id)
        REFERENCES organisation_members (id, organisation_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_access_review_reviewer_assignments_independent
        CHECK (subject_member_id <> reviewer_member_id)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- migrate:down transaction:false
DROP TABLE access_review_reviewer_assignments;

ALTER TABLE access_review_campaigns
    DROP CHECK ck_access_review_campaigns_reviewer_mode,
    DROP COLUMN reviewer_mode;
