ALTER TABLE app_users ADD COLUMN phone VARCHAR(20);
ALTER TABLE app_users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX uq_app_users_active_phone
    ON app_users (phone)
    WHERE phone IS NOT NULL AND removed_at IS NULL;

CREATE TABLE password_reset_challenges (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES app_users(id),
    otp_hash        VARCHAR(128) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 0,
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    reset_hash      VARCHAR(128),
    reset_expires_at TIMESTAMPTZ,
    consumed        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_user ON password_reset_challenges (user_id, created_at DESC);

ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(64);
