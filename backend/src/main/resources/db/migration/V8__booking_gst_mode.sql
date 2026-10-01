alter table bookings add column if not exists gst_mode varchar(16) not null default 'without';
