CREATE TABLE IF NOT EXISTS staff_notifications (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    body VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_created ON staff_notifications (created_at DESC);
