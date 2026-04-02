BEGIN;

-- 1. documents table
CREATE TABLE IF NOT EXISTS documents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signing_request_id UUID NOT NULL REFERENCES signing_requests(id),
    original_filename VARCHAR(500) NOT NULL,
    original_format   VARCHAR(10) NOT NULL,
    pdf_data          TEXT NOT NULL,
    page_count        INT NOT NULL,
    page_dimensions   JSONB NOT NULL,
    uploaded_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_signing_request_id
    ON documents (signing_request_id);

-- 2. document_fields table
CREATE TABLE IF NOT EXISTS document_fields (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id         UUID NOT NULL REFERENCES documents(id),
    signer_email        VARCHAR(255) NOT NULL,
    field_type          VARCHAR(20) NOT NULL,
    label               VARCHAR(255),
    page_number         INT NOT NULL,
    x_percent           DECIMAL NOT NULL,
    y_percent           DECIMAL NOT NULL,
    width_percent       DECIMAL NOT NULL,
    height_percent      DECIMAL NOT NULL,
    value               TEXT,
    prefilled           BOOLEAN DEFAULT FALSE,
    aspect_ratio_locked BOOLEAN DEFAULT TRUE,
    filled_at           TIMESTAMPTZ,
    CONSTRAINT document_fields_field_type_check
        CHECK (field_type IN ('signature', 'initials', 'date', 'text'))
);

CREATE INDEX IF NOT EXISTS idx_document_fields_document_id
    ON document_fields (document_id);

CREATE INDEX IF NOT EXISTS idx_document_fields_document_signer
    ON document_fields (document_id, signer_email);

-- 3. signing_request_signers table
CREATE TABLE IF NOT EXISTS signing_request_signers (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signing_request_id UUID NOT NULL REFERENCES signing_requests(id),
    email              VARCHAR(255) NOT NULL,
    name               VARCHAR(255),
    token              VARCHAR(64) UNIQUE,
    sign_order         INT NOT NULL DEFAULT 1,
    status             VARCHAR(20) NOT NULL DEFAULT 'pending',
    decline_reason     TEXT,
    signature_id       UUID REFERENCES signatures(id),
    snapshot_hash      VARCHAR(64),
    signed_at          TIMESTAMPTZ,
    signed_ip          VARCHAR(45),
    CONSTRAINT signing_request_signers_status_check
        CHECK (status IN ('pending', 'sent', 'signed', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_signing_request_signers_request_id
    ON signing_request_signers (signing_request_id);

CREATE INDEX IF NOT EXISTS idx_signing_request_signers_token
    ON signing_request_signers (token);

-- 4. Alter signing_requests to add document signing columns
ALTER TABLE signing_requests
    ADD COLUMN IF NOT EXISTS signing_mode VARCHAR(20) DEFAULT 'single',
    ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id),
    ADD COLUMN IF NOT EXISTS all_signed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS signed_pdf_data TEXT,
    ADD COLUMN IF NOT EXISTS pre_sign_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS post_sign_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS reminder_interval_hours INT DEFAULT 48;

COMMIT;
