ALTER TABLE attachments
  ADD COLUMN thumbnail_path VARCHAR(1000) NULL AFTER storage_path,
  ADD COLUMN thumbnail_mime_type VARCHAR(255) NULL AFTER thumbnail_path,
  ADD COLUMN thumbnail_size_bytes BIGINT UNSIGNED NULL AFTER thumbnail_mime_type;
