-- Adds an idempotency key for offline-sync "create" changes.
--
-- Without this, POST /api/sync/push has no way to tell that a queued
-- "create" change it already applied is being retried (e.g. after a
-- timeout or a server outage), and inserts a brand-new note every time
-- the client resends the same queued change. This column lets the sync
-- push handler look up whether a note already exists for a given
-- clientId before inserting another one.

ALTER TABLE notes
  ADD COLUMN sync_client_id VARCHAR(191) NULL AFTER sync_version;

-- A given client-generated id should only ever produce one note per user.
-- NULL values (all notes created before this migration, and notes created
-- directly through the UI rather than the offline queue) are unrestricted,
-- since MySQL unique indexes allow multiple NULLs.
ALTER TABLE notes
  ADD UNIQUE KEY notes_user_sync_client_idx (user_id, sync_client_id);
