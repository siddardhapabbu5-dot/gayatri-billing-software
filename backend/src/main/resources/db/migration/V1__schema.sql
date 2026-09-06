-- Gayatri VHMS core schema
CREATE TABLE app_users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(180) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    role            VARCHAR(40)  NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE guests (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(160) NOT NULL,
    phone           VARCHAR(30),
    email           VARCHAR(180),
    address         TEXT,
    gstin           VARCHAR(30),
    nationality     VARCHAR(80) DEFAULT 'India',
    id_proof_type   VARCHAR(40),
    id_proof_number VARCHAR(80),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE halls (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(40) NOT NULL UNIQUE,
    name            VARCHAR(120) NOT NULL,
    capacity        INT,
    half_day_rate   NUMERIC(12,2) NOT NULL DEFAULT 0,
    full_day_rate   NUMERIC(12,2) NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE room_types (
    id              BIGSERIAL PRIMARY KEY,
    code            VARCHAR(40) NOT NULL UNIQUE,
    name            VARCHAR(120) NOT NULL,
    base_rate       NUMERIC(12,2) NOT NULL DEFAULT 0,
    extra_bed       NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rooms (
    id              BIGSERIAL PRIMARY KEY,
    number          VARCHAR(40) NOT NULL UNIQUE,
    type_id         BIGINT REFERENCES room_types(id),
    floor           VARCHAR(40),
    status          VARCHAR(40) NOT NULL DEFAULT 'Available',
    hk_status       VARCHAR(40) NOT NULL DEFAULT 'Clean',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bookings (
    id              BIGSERIAL PRIMARY KEY,
    number          VARCHAR(40) NOT NULL UNIQUE,
    guest_id        BIGINT NOT NULL REFERENCES guests(id),
    type            VARCHAR(80) NOT NULL,
    source          VARCHAR(40),
    event_date      DATE NOT NULL,
    guests_expected INT,
    status          VARCHAR(40) NOT NULL DEFAULT 'Confirmed',
    notes           TEXT,
    discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_by      BIGINT REFERENCES app_users(id),
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hall_reservations (
    id              BIGSERIAL PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    hall_id         BIGINT NOT NULL REFERENCES halls(id),
    event_date      DATE NOT NULL,
    slot_type       VARCHAR(40) NOT NULL DEFAULT 'full-day',
    start_at        TIMESTAMPTZ,
    end_at          TIMESTAMPTZ,
    amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          VARCHAR(40) NOT NULL DEFAULT 'Booked',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE room_reservations (
    id              BIGSERIAL PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    room_id         BIGINT NOT NULL REFERENCES rooms(id),
    guest_id        BIGINT REFERENCES guests(id),
    check_in        DATE NOT NULL,
    check_out       DATE NOT NULL,
    extra_bed       INT NOT NULL DEFAULT 0,
    children        INT NOT NULL DEFAULT 0,
    amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          VARCHAR(40) NOT NULL DEFAULT 'Reserved',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE folios (
    id              BIGSERIAL PRIMARY KEY,
    booking_id      BIGINT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    status          VARCHAR(40) NOT NULL DEFAULT 'Open',
    discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE folio_lines (
    id              BIGSERIAL PRIMARY KEY,
    folio_id        BIGINT NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
    category        VARCHAR(40) NOT NULL,
    description     VARCHAR(255) NOT NULL,
    qty             NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
    id              BIGSERIAL PRIMARY KEY,
    folio_id        BIGINT NOT NULL REFERENCES folios(id) ON DELETE CASCADE,
    booking_id      BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL,
    method          VARCHAR(40) NOT NULL,
    type            VARCHAR(40) NOT NULL,
    paid_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ref_no          VARCHAR(120),
    recorded_by     BIGINT REFERENCES app_users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES app_users(id),
    action          VARCHAR(120) NOT NULL,
    entity          VARCHAR(120),
    detail          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_event_date ON bookings(event_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_guests_phone ON guests(phone);
CREATE INDEX idx_hall_res_date ON hall_reservations(event_date, hall_id);
CREATE INDEX idx_room_res_dates ON room_reservations(room_id, check_in, check_out);
