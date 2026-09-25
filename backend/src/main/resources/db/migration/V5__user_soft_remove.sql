-- Soft-remove / archive staff accounts (keep FK history; block login)

ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_removed_at ON app_users (removed_at);

-- Hide legacy inactive demo emails from the normal list by marking them removed (row kept).
UPDATE app_users
SET removed_at = COALESCE(removed_at, NOW()),
    active = FALSE,
    updated_at = NOW()
WHERE active = FALSE
  AND lower(email) LIKE '%@gayatrifunctionhall.com'
  AND removed_at IS NULL;
