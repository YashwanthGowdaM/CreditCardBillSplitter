-- =============================================================================
-- CardSplit  |  PostgreSQL schema
-- Runs automatically ONE TIME, the first time the database container starts
-- with an empty data volume (see /docker-entrypoint-initdb.d in the Dockerfile).
-- =============================================================================

-- 1. Credit cards ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cards (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer         TEXT        NOT NULL,
    card_name      TEXT        NOT NULL,
    network        TEXT        NOT NULL,
    bill_due_date  TEXT        NOT NULL,
    statement_date TEXT        NOT NULL,
    last_4_digits  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The same issuer + card name cannot be added twice (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cards_issuer_name
    ON cards (lower(trim(issuer)), lower(trim(card_name)));

-- 2. People (friends / flatmates / family who share expenses) ----------------
CREATE TABLE IF NOT EXISTS people (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    phone      TEXT,
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_people_name
    ON people (lower(trim(name)));

-- 3. Uploaded bills (one row per imported PDF statement) ---------------------
CREATE TABLE IF NOT EXISTS uploaded_bills (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id           UUID        NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    card_name         TEXT        NOT NULL,
    file_name         TEXT        NOT NULL,
    file_size         BIGINT,
    storage_path      TEXT,
    total_debits      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    transaction_count INT            NOT NULL DEFAULT 0,
    uploaded_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bills_card ON uploaded_bills (card_id);

-- 4. Transactions (debit entries extracted from the bills) ------------------
CREATE TABLE IF NOT EXISTS transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq         BIGSERIAL,  -- insertion order, keeps rows in the same order as the PDF
    bill_id     UUID REFERENCES uploaded_bills(id) ON DELETE SET NULL,
    card_id     UUID        NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    card_name   TEXT        NOT NULL,
    date        TEXT        NOT NULL,
    description TEXT        NOT NULL,
    amount      NUMERIC(12, 2) NOT NULL,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_tx_card ON transactions (card_id);
CREATE INDEX IF NOT EXISTS ix_tx_bill ON transactions (bill_id);

-- 5. Assignments: "who owes this transaction?" -------------------------------
--    Deleting a person automatically un-assigns their transactions (CASCADE).
CREATE TABLE IF NOT EXISTS transaction_assignments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
    person_id      UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_assign_person ON transaction_assignments (person_id);
