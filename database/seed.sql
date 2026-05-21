INSERT INTO users (id, email, display_name)
VALUES (1, 'owner@example.com', 'Owner')
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  display_name = VALUES(display_name);

INSERT INTO notebooks (user_id, name, sort_order)
SELECT 1, 'Daily', 10
WHERE NOT EXISTS (
  SELECT 1 FROM notebooks WHERE user_id = 1 AND name = 'Daily' AND deleted_at IS NULL
);

INSERT INTO notebooks (user_id, name, sort_order)
SELECT 1, 'Projects', 20
WHERE NOT EXISTS (
  SELECT 1 FROM notebooks WHERE user_id = 1 AND name = 'Projects' AND deleted_at IS NULL
);

INSERT INTO notebooks (user_id, name, sort_order)
SELECT 1, 'Reference', 30
WHERE NOT EXISTS (
  SELECT 1 FROM notebooks WHERE user_id = 1 AND name = 'Reference' AND deleted_at IS NULL
);
