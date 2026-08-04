-- Cleans up the duplicate "Untitled note" / "Buzz..." notes created by the
-- sync-push idempotency bug fixed in migration 0013 and syncPushRepository.js.
--
-- Run this AFTER applying database/migrations/0013_note_sync_client_id.sql
-- and deploying the code fix, so new duplicates stop being created before
-- you clean up the old ones.
--
-- This soft-deletes (sets deleted_at) rather than hard-deleting, matching
-- how EDGE Note's own delete function works. Soft-deleted notes disappear
-- from every view in the app but the rows aren't destroyed, so this is
-- reversible: to undo, run
--   UPDATE notes SET deleted_at = NULL WHERE deleted_at = '<the timestamp this ran at>';

-- Step 1: PREVIEW. Run this first and check the count looks right
-- (should be roughly 700+ based on what you've seen in the app) before
-- running the UPDATE below.
SELECT COUNT(*) AS notes_to_clean
FROM notes
WHERE deleted_at IS NULL
  AND title = 'Untitled note'
  AND body LIKE '%nsec1ulwz03q5fgtn9k89j4892snwh%'
  AND id NOT IN (
    SELECT keep_id FROM (
      SELECT MIN(id) AS keep_id
      FROM notes
      WHERE deleted_at IS NULL
        AND title = 'Untitled note'
        AND body LIKE '%nsec1ulwz03q5fgtn9k89j4892snwh%'
      GROUP BY user_id, notebook_id, title, body
    ) keepers
  );

-- Step 2: CLEANUP. Keeps exactly one note per (user, notebook, title, body)
-- group for this specific duplicated content, soft-deletes the rest.
UPDATE notes
SET deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE deleted_at IS NULL
  AND title = 'Untitled note'
  AND body LIKE '%nsec1ulwz03q5fgtn9k89j4892snwh%'
  AND id NOT IN (
    SELECT keep_id FROM (
      SELECT MIN(id) AS keep_id
      FROM notes
      WHERE deleted_at IS NULL
        AND title = 'Untitled note'
        AND body LIKE '%nsec1ulwz03q5fgtn9k89j4892snwh%'
      GROUP BY user_id, notebook_id, title, body
    ) keepers
  );
