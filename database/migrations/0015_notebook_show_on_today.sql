-- Lets each Space (top-level notebook) be shown or hidden on Today.
-- Run once. The app works without it, but then the choice is only kept
-- on the device where it was made instead of syncing everywhere.

ALTER TABLE notebooks
  ADD COLUMN show_on_today TINYINT(1) NOT NULL DEFAULT 1;
