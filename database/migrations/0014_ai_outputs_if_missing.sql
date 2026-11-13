-- Creates the AI answer cache if this database was set up without it.
-- Safe to run more than once. Works on MySQL 8 and MariaDB.
--
-- The app works without this table (AI answers are simply not cached), but
-- with it, asking the same thing about an unchanged note costs nothing.

CREATE TABLE IF NOT EXISTS ai_outputs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  output_type VARCHAR(80) NOT NULL,
  model_name VARCHAR(160) NOT NULL,
  input_checksum CHAR(64) NOT NULL,
  output_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ai_outputs_cache_unique (note_id, output_type, model_name, input_checksum),
  CONSTRAINT ai_outputs_note_fk FOREIGN KEY (note_id) REFERENCES notes(id)
);
