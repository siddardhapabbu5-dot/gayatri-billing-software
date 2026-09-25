-- RBAC: editable role permissions, app settings (refund limits), richer audit

CREATE TABLE IF NOT EXISTS role_permissions (
    role        VARCHAR(40) NOT NULL,
    permission  VARCHAR(80) NOT NULL,
    allowed     BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  BIGINT REFERENCES app_users(id),
    PRIMARY KEY (role, permission)
);

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key   VARCHAR(80) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by    BIGINT REFERENCES app_users(id)
);

-- Owner-tunable day-to-day controls
INSERT INTO app_settings (setting_key, setting_value) VALUES
    ('manager.refund.limit', '50000'),
    ('invoice.issue.roles', 'ADMIN,MANAGER,FRONTDESK,ACCOUNTS'),
    ('booking.policies.json', '{}')
ON CONFLICT (setting_key) DO NOTHING;

-- Ensure audit_logs can store JSON-ish detail (already TEXT)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
