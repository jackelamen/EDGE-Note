CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  password_hash VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email)
);

CREATE TABLE notebooks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY notebooks_user_id_idx (user_id),
  CONSTRAINT notebooks_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  notebook_id BIGINT UNSIGNED NULL,
  title VARCHAR(500) NOT NULL DEFAULT '',
  body MEDIUMTEXT NOT NULL,
  body_format VARCHAR(50) NOT NULL DEFAULT 'markdown',
  favorite TINYINT(1) NOT NULL DEFAULT 0,
  sync_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  archived_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY notes_user_updated_idx (user_id, updated_at),
  KEY notes_notebook_idx (notebook_id),
  FULLTEXT KEY notes_search_ft (title, body),
  CONSTRAINT notes_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT notes_notebook_fk FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
);

CREATE TABLE note_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(500) NOT NULL DEFAULT '',
  body MEDIUMTEXT NOT NULL,
  body_format VARCHAR(50) NOT NULL DEFAULT 'markdown',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY note_versions_note_idx (note_id, created_at),
  CONSTRAINT note_versions_note_fk FOREIGN KEY (note_id) REFERENCES notes(id)
);

CREATE TABLE tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY tags_user_name_unique (user_id, name),
  CONSTRAINT tags_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE note_tags (
  note_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  CONSTRAINT note_tags_note_fk FOREIGN KEY (note_id) REFERENCES notes(id),
  CONSTRAINT note_tags_tag_fk FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id BIGINT UNSIGNED NOT NULL,
  filename VARCHAR(500) NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  storage_path VARCHAR(1000) NOT NULL,
  checksum CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY attachments_note_idx (note_id),
  CONSTRAINT attachments_note_fk FOREIGN KEY (note_id) REFERENCES notes(id)
);

CREATE TABLE sync_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(40) NOT NULL,
  sync_version BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY sync_changes_user_cursor_idx (user_id, id),
  CONSTRAINT sync_changes_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE ai_outputs (
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

CREATE TABLE devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  last_sync_cursor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY devices_user_idx (user_id),
  CONSTRAINT devices_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
);
