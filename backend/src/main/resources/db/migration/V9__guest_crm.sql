ALTER TABLE guests ADD COLUMN IF NOT EXISTS lead_status varchar(40);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS lead_source varchar(40);
ALTER TABLE guests ADD COLUMN IF NOT EXISTS notes text;
