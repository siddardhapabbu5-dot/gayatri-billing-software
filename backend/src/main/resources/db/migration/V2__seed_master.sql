-- Seed halls, room types, rooms (passwords hashed at app startup by DataSeeder for users)
INSERT INTO halls (code, name, capacity, half_day_rate, full_day_rate, active) VALUES
 ('IMP', 'Imperial Ballroom', 1100, 300000, 450000, TRUE),
 ('GRD', 'Garden Pavilion', 600, 125000, 250000, TRUE),
 ('HER', 'Heritage Courtyard (MINI)', 250, 125000, 200000, TRUE);

INSERT INTO room_types (code, name, base_rate, extra_bed) VALUES
 ('STD', 'Standard', 2500, 500),
 ('DLX', 'Deluxe', 3500, 700),
 ('FAM', 'Family Suite', 5500, 800);

INSERT INTO rooms (number, type_id, floor, status, hk_status, active)
SELECT 'R' || LPAD(g::text, 2, '0'),
       (SELECT id FROM room_types WHERE code = CASE WHEN g <= 10 THEN 'STD' WHEN g <= 18 THEN 'DLX' ELSE 'FAM' END),
       CASE WHEN g <= 11 THEN 'Ground' ELSE 'First' END,
       'Available', 'Clean', TRUE
FROM generate_series(1, 22) AS g;
