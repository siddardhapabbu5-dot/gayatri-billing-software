-- Gayatri VHMS operations persistence: enquiries, expenses, refunds, documents, invoices.
-- Additive only: no DROP / DELETE / ALTER of existing columns so live data stays intact.

CREATE TABLE IF NOT EXISTS enquiries (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(160) NOT NULL,
    phone           VARCHAR(30),
    email           VARCHAR(180),
    event_date      DATE,
    hall_code       VARCHAR(40),
    guests_expected INT,
    message         TEXT,
    status          VARCHAR(40) NOT NULL DEFAULT 'Open',
    booking_id      BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
    agree_hall      BOOLEAN NOT NULL DEFAULT FALSE,
    agree_room      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id              BIGSERIAL PRIMARY KEY,
    category        VARCHAR(80) NOT NULL,
    description     VARCHAR(255) NOT NULL,
    amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    spent_on        DATE NOT NULL,
    payment_method  VARCHAR(40),
    vendor          VARCHAR(160),
    notes           TEXT,
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_doc_id  BIGINT,
    created_by      BIGINT REFERENCES app_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refunds (
    id              BIGSERIAL PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    payment_id      BIGINT REFERENCES payments(id) ON DELETE SET NULL,
    amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          VARCHAR(40) NOT NULL DEFAULT 'Pending',
    reason          TEXT,
    requested_by    BIGINT REFERENCES app_users(id),
    approved_by     BIGINT REFERENCES app_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id              BIGSERIAL PRIMARY KEY,
    booking_id      BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
    guest_id        BIGINT REFERENCES guests(id) ON DELETE SET NULL,
    type_code       VARCHAR(60) NOT NULL DEFAULT 'Other',
    file_name       VARCHAR(255) NOT NULL,
    content_type    VARCHAR(120),
    size_bytes      BIGINT NOT NULL DEFAULT 0,
    storage_key     VARCHAR(255) NOT NULL,
    uploaded_by     BIGINT REFERENCES app_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id              BIGSERIAL PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    number          VARCHAR(60) NOT NULL UNIQUE,
    type            VARCHAR(40) NOT NULL DEFAULT 'Tax Invoice',
    status          VARCHAR(40) NOT NULL DEFAULT 'Issued',
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_event_date ON enquiries(event_date);
CREATE INDEX IF NOT EXISTS idx_enquiries_booking ON enquiries(booking_id);
CREATE INDEX IF NOT EXISTS idx_expenses_spent_on ON expenses(spent_on);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_verified ON expenses(verified);
CREATE INDEX IF NOT EXISTS idx_refunds_booking ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_documents_booking ON documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_documents_guest ON documents(guest_id);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id);

-- Conflict lookups scan by (hall, date, status) and (room, dates, status).
CREATE INDEX IF NOT EXISTS idx_hall_res_conflict ON hall_reservations(hall_id, event_date, status);
CREATE INDEX IF NOT EXISTS idx_hall_res_booking ON hall_reservations(booking_id);
CREATE INDEX IF NOT EXISTS idx_room_res_conflict ON room_reservations(room_id, check_in, check_out, status);
CREATE INDEX IF NOT EXISTS idx_room_res_booking ON room_reservations(booking_id);
