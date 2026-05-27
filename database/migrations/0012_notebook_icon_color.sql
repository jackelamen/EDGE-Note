-- Widen notebook icon column (was VARCHAR(10), too small for Lucide icon names)
-- and add a color column for per-notebook icon color

ALTER TABLE notebooks
  MODIFY COLUMN icon VARCHAR(50) NULL,
  ADD COLUMN icon_color VARCHAR(7) NULL AFTER icon;
