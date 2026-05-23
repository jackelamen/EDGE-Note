-- Add parent notebook support and emoji icon to notebooks table

ALTER TABLE notebooks
  ADD COLUMN parent_id BIGINT UNSIGNED NULL AFTER user_id,
  ADD COLUMN icon VARCHAR(10) NULL AFTER name,
  ADD CONSTRAINT notebooks_parent_fk FOREIGN KEY (parent_id) REFERENCES notebooks(id) ON DELETE SET NULL;

ALTER TABLE notebooks ADD KEY notebooks_parent_idx (parent_id);
