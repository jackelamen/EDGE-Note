# Inline Image Disappearance — Root Cause and Fix Directions

Status: diagnosed, NOT yet fixed. This document is for the developer implementing the fix.

---

## LATEST FINDING (supersedes the theories below): the image FILES are not on disk

A screenshot of the running app shows the decisive evidence. In the note list and in the open
note ("Note 2"), the embedded image renders as a BROKEN-IMAGE icon next to the text
"1000155049.jpg". Another note ("Note 1") shows its image fine. So this is no longer about the
`<img>` tag being stripped from the body — the tag is present, with the right
`/api/attachments/{id}/download` src. The browser is requesting that URL and getting a failure
(broken image). That means `GET /api/attachments/{id}/download` is returning a non-image
(404 / error / empty) for the affected attachment.

Corroborating evidence from the repo: the attachment storage directory is EMPTY. With
`ATTACHMENT_ROOT=./uploads` (see `.env.example` and `src/config.js`), there are zero files under
`uploads/` and zero image files anywhere in the project tree. Files are written by
`saveAttachment()` in `src/attachmentsRepository.js` via
`writeFile(join(config.attachments.root, storagePath), file.buffer)` and read back by
`getAttachment().stream()` from the same path. If the write target and the read target diverge, or
the files are written to an ephemeral/relative location that doesn't persist, the download endpoint
will 404 and the image renders broken — exactly the observed symptom. "Embeds then disappears
later" fits perfectly: right after upload the editor may still hold a live reference, but on the
next render/reload the `<img>` hits the download URL, the file isn't there, and it breaks.

This is most likely NOT a sync issue. Sync (`src/syncRepository.js`) only carries attachment
METADATA (filename, `downloadUrl`, thumbnail URL) — never file bytes — and it uses the same
`/api/attachments/{id}/download` URL everywhere, so sync does not rewrite or break the src.

### Diagnose on the LIVE server (do this first — I could not, this repo copy has no `.env`/DB/files)

For a broken attachment (open DevTools → Network, click the broken image, note the attachment id
in the request URL and its HTTP status):

1. Read the status of `GET /api/attachments/{id}/download`.
   - `404 "Attachment not found"` → the DB row is missing for that id, OR `getAttachment`'s
     ownership JOIN fails (note not owned by the current session user, or note soft-deleted). Check
     which by querying the DB (next step).
   - `200` but zero/garbage bytes → the file on disk is missing/empty; the stream errored after
     headers were sent. See `src/api.js` download handler and `attachment.stream()`.
   - `503` → DB down.
2. In MySQL, for that attachment id:
   `SELECT id, note_id, filename, storage_path, size_bytes FROM attachments WHERE id = {id};`
   - If no row: the upload never persisted the DB row (but the body has the URL) — investigate the
     POST path / a failed insert that still returned a URL.
   - If a row exists: note its `storage_path` and `size_bytes`.
3. On the server host, check the file actually exists and is non-empty:
   `ls -la "$ATTACHMENT_ROOT/{storage_path}"` (default `ATTACHMENT_ROOT=./uploads`, resolved
   RELATIVE TO THE SERVER PROCESS WORKING DIRECTORY). Confirm:
   - The directory the server actually writes to is the same one it reads from.
   - `ATTACHMENT_ROOT` is an ABSOLUTE path on the deployed box, not `./uploads` relative to a CWD
     that changes between runs (e.g. started by a process manager from a different directory, or a
     container whose `uploads/` is not on a persistent volume).
   - The volume persists across restarts/redeploys (a container without a mounted volume loses
     `uploads/` on every restart — that alone explains "works now, broken later").
4. Confirm the running bundle is `app.v58.js`, not the stale `app.js` (see the section below); the
   stale bundle hides real errors and lacks the save-flow fix.

### Most probable root cause and fix

The attachment files are being written to a location that does not persist (or the server reads
from a different path than it writes to), so the download endpoint can't find them later.

- Set `ATTACHMENT_ROOT` to an ABSOLUTE, persistent path on the server (and the same path the
  process can both write and read). Do not rely on `./uploads` relative to CWD.
- If deployed in a container, mount a persistent volume at that path. Verify it survives a restart.
- Add a guard so this fails loudly instead of silently producing broken images: on upload, after
  `writeFile`, `stat` the file and confirm `size_bytes` matches the buffer length; if the file is
  missing/zero, return a 500 so the client shows a real error rather than "embedded".
- In the download handler (`src/api.js`), when `createReadStream` errors (ENOENT), return 404 with
  a clear body BEFORE piping, and log the attempted absolute path. Right now a missing file can
  surface as a broken stream after a 200 header, which is hard to debug.
- Backfill/repair: for attachments whose file is missing, there is no way to recover bytes that
  were never persisted; those notes will need the images re-embedded. `scripts/recover-inline-images.mjs`
  only re-links URLs into bodies; it does not restore files. If the files DO exist but at the wrong
  path, write a one-off migration to move them to the correct `storage_path`.

### Why "Note 1" looks fine but "Note 2" is broken

Likely one of: Note 1's file happened to land on a path that still exists while Note 2's didn't
(timing relative to a restart/redeploy that wiped `uploads/`), or Note 1 was still showing a live
in-session reference in that screenshot and would also break on a clean reload. Verify by
hard-reloading and re-checking Note 1; if it breaks too, the storage-persistence diagnosis is
confirmed for both.

---

---

## READ THIS FIRST: the browser is running a stale bundle (`app.js`, not `app.v58.js`)

A new symptom appeared during testing: the status bar shows
`Note 5 · Image upload failed: Upload failed`.

That exact terse string — "Upload failed" with NO code suffix — is produced ONLY by the old
`public/app.js`, at its line 2294:

```js
if (!response.ok) throw new Error(payload.message || "Upload failed");
```

The current bundle `public/app.v58.js` never produces that string. Every failure path in v58
appends a code, e.g. `Upload failed (413)` / `Upload failed (HTTP 500)` (v58 lines 2398, 2486),
and v58 reads `payload.error` first. So whatever browser produced the "Upload failed" message was
executing `app.js`, not `app.v58.js`.

This matters enormously: it means NONE of the fixes already committed are actually running in that
browser session — not the sanitizer fix (commit 91c107e), not the multipart fix (commit b6f7f1f),
and not any fix you add to `app.v58.js`. Verified facts:

- `public/index.html` (line 514) correctly loads `/app.v58.js`. Nothing in the repo references
  `app.js` except an unrelated test script (`scripts/check-daily-use.js`), which only reads it as a
  file; it is not served to the page.
- `md5sum` confirms `app.js` and `app.v58.js` are DIFFERENT files. `app.js` lacks the `imgSrc`
  capture (sanitizer fix) entirely (`grep -c "imgSrc = tag"` returns 0 for app.js, 1 for v58).
- The static server (`src/server.js`) serves `/app.v58.js` from the real file with
  `Cache-Control: no-store, no-cache` and does NOT rewrite or fall back to `app.js` for a valid
  request. So the server is not mis-serving the file.

Therefore the browser is loading old cached JavaScript (or the dev is pointed at a stale build /
old deployment / a service-worker-free but hard-cached `app.js` opened directly). Action items:

1. Confirm the page is loaded fresh: hard-reload (Cmd/Ctrl+Shift+R), or open DevTools → Network,
   disable cache, reload, and verify the document requests `/app.v58.js` (NOT `/app.js`) and that
   the response body matches the current `public/app.v58.js` on disk.
2. Make sure no one is opening `public/app.js` or an old URL directly. The app must be loaded via
   `index.html` so it pulls `app.v58.js`.
3. Strongly recommended: DELETE `public/app.js` (and any other stale `app.vNN.js` copies) so it is
   impossible to accidentally run the pre-fix bundle. Update `scripts/check-daily-use.js` to read
   `public/app.v58.js` instead of `public/app.js` first, or it will break. Better long-term: stop
   shipping hand-versioned filenames; serve a single `app.js` and cache-bust with a query string or
   content hash so there is exactly one source of truth.

Once the page is genuinely running `app.v58.js`, the "Upload failed" message will change to one
that includes the real server reason (see next section). Re-test the image flow ONLY after you have
confirmed `app.v58.js` is the executing bundle.

## What the real upload error actually is (once v58 is running)

The server (`src/api.js` → `safely()`) returns errors as `{ error: "<message>" }` with a status
code. The real failure for an attachment POST to `/api/notes/{id}/attachments` is one of:

- `413` `"Attachment is too large."` — file exceeds `ATTACHMENT_LIMIT_MB` (default 25 MB);
  see `assertAttachmentSize` in `src/attachmentsRepository.js`. The multipart reader also enforces
  `limitMb*1024*1024 + 512KB` and throws `413 "Attachment is too large."`.
- `400` `"Attachment file is required."` — the parsed multipart had no file part
  (e.g. bad/missing boundary, or the `file` field name didn't arrive). See `saveAttachment`.
- `400` `"Multipart boundary is missing."` — `Content-Type` had no boundary (`src/http.js`).
- `404` `"Note not found."` — note 5 isn't owned by the logged-in user or was soft-deleted
  (`assertNoteAccess`). Plausible if the note was created in a different account/session, or the
  session cookie changed.
- `503` Database unavailable — MySQL down / schema not migrated.

NOTE the key mismatch that hid this: the server sends the reason under `error`, but old `app.js`
reads `payload.message`, so it always collapsed to the generic "Upload failed". `app.v58.js`
already reads `payload.error` first, so simply running v58 will surface the true reason. Capture
that reason (and the HTTP status from the Network tab) before doing anything else — it tells you
which of the above you actually have. Do not assume; read the status code.

---

## Symptom

When a user embeds an image into a note, the UI reports "Image embedded: <filename>",
the attachment row appears, and the file uploads correctly to disk. But the `<img>` tag is
missing from the saved note body, so the image does not render. The standalone script
`scripts/recover-inline-images.mjs` was written to patch this after the fact: it finds image
attachments whose `/api/attachments/{id}/download` URL is absent from their note body. The
existence of that script confirms the URL is being lost from the stored body, not the file bytes.

## What is NOT the cause (already verified, do not re-investigate)

These were prior bugs that are already fixed in the current tree. I re-verified each one
empirically. Do not spend time on them again:

1. Client HTML sanitizer stripping the `src`. Fixed in commit `91c107e`. The sanitizer in
   `public/app.v58.js` (`sanitizeHtml`, lines ~366-491) now captures `imgSrc`/`imgAlt`/`imgWidth`
   BEFORE the blanket attribute strip and re-applies them. I ran the real `sanitizeHtml` under
   jsdom against every realistic body shape (img in `<p>`, in `<span>`, in `<div>`, with width
   attr, with inline style width, with data-upload-token, absolute URL). The `<img src="/api/attachments/...">`
   survives in 100% of cases.

2. Multipart parser corrupting binary files. Fixed in commit `b6f7f1f`. The `readMultipart` parser
   in `src/http.js` no longer does the unconditional trailing `--` strip. I reproduced the old
   failure and confirmed the current parser returns byte-identical buffers, including the
   file+thumbnail two-part body the client actually sends.

3. Server storage / serving. `src/attachmentsRepository.js` writes and reads from the same
   `config.attachments.root/{noteId}/{storageName}` path, `getAttachment` joins on note ownership
   correctly, and `src/api.js` serves images with `Content-Disposition: inline`. The `body` column
   is `MEDIUMTEXT` (no truncation). The upload response returns the correct `downloadUrl` built from
   the freshly inserted row id, so the URL inserted into the editor matches a real attachment.

## Actual root cause: the save flow drops the body that contains the image

The bug is a re-entrancy / ordering race in `public/app.v58.js`, in `saveNote()` and
`insertImageFileIntoEditor()`.

### The mechanics

`saveNote()` (starts at line ~2225) is guarded by a re-entrancy lock:

```js
async function saveNote() {
  if (state.pendingSave) return;        // line ~2226  <-- silently returns undefined
  state.pendingSave = true;
  ...
  const draft = currentDraft();         // line ~2232  <-- body snapshot taken HERE
  ... await PUT/POST ...
  selectNote(saved);                    // line ~2250  <-- editor overwritten with server body
  ...
  await loadCollections();              // line ~2257
  await loadHistory(saved.id);          // line ~2258
  ... finally { state.pendingSave = false; }   // lock released only after all awaits
}
```

`insertImageFileIntoEditor()` (line ~2364):

```js
if (!state.selectedId) {
  const saved = await saveNote();       // line ~2368: first save to create the note
  ...
}
const attachment = await uploadImageAttachment(file);   // upload (network)
insertImageUrl(attachment.downloadUrl, ...);            // line ~2378: img inserted into DOM
...
const saved = await saveNote();                         // line ~2382: second save to persist img
```

Two distinct failure modes, both produce "embedded but not saved":

**Failure A — second save is swallowed by the lock.**
If any other save is still in flight when line 2382 runs (an overlapping autosave, a title/tags
save, a sync flush, or the next iteration of the multi-image loop below), `state.pendingSave` is
still `true`, so the line 2382 `saveNote()` hits line 2226 and returns `undefined` without
persisting anything. The img is in the DOM but never written to the server.

**Failure B — the in-flight save persists a pre-insert snapshot, then overwrites the editor.**
The save that holds the lock captured `currentDraft()` at line 2232 BEFORE the image was inserted,
so it PUTs an img-less body. When it completes, `selectNote(saved)` (line 2250) calls
`setEditorHtml(saved.body)` and replaces the editor contents with that img-less server body —
deleting the just-inserted `<img>` from the DOM as well. Net result: the image is gone from both
the persisted body and the visible editor, but the user already saw the "Image embedded" status.

**Multi-image amplifier.** `uploadAttachmentFiles()` (line ~2391) loops:

```js
for (const file of images) {
  await insertImageFileIntoEditor(file, imageSelection);   // line ~2400
}
```

Each iteration calls `saveNote()` internally. Because saves overlap with the lock and with
`selectNote()` re-renders between iterations, all but at most one image reliably get dropped.

## Why the status still says "Image embedded"

`insertImageFileIntoEditor` sets the success status at line ~2383 based on whether the upload
returned an attachment, not on whether the body containing the `<img>` was actually persisted.
`saveNote()` returning `undefined` (the swallowed case) is treated the same as success there.

## Fix directions

Make the save flow correct under concurrency and stop the editor from being clobbered by a stale
server snapshot mid-edit. Implement all of the following in `public/app.v58.js`.

1. Do not silently drop overlapping saves. Replace the `if (state.pendingSave) return;`
   early-return with a queue/coalesce: if a save is in progress, set a "dirty/resave-requested"
   flag and, when the current save finishes, run one more save that re-reads `currentDraft()` from
   the live editor. The guarantee you need: after the last mutation to the editor, exactly one save
   runs that serializes the CURRENT editor contents. A simple, robust pattern:
   - `state.pendingSave` stays as the in-flight guard.
   - Add `state.saveAgainRequested = false`.
   - On entry, if `state.pendingSave` is true, set `state.saveAgainRequested = true` and return a
     promise that resolves when the eventual save completes (or return the in-flight promise).
   - In the `finally`, if `state.saveAgainRequested`, clear it and call `saveNote()` again.

2. Stop `saveNote()` from overwriting the editor while the user/flow may have newer content.
   `selectNote(saved)` at line ~2250 calls `setEditorHtml()` and destroys live DOM (including a
   freshly inserted img). On a save of the note that is already open, do NOT re-render the editor
   body from the server response. Update `state.notes[index] = saved`, update `state.selectedId`,
   refresh metadata/breadcrumb/attachments, but leave `elements.body` untouched. Only call the full
   `setEditorHtml`/`selectNote` re-render when actually switching to a DIFFERENT note. (Factor the
   editor-body rendering out of `selectNote` so `saveNote` can refresh state without touching the
   editor DOM.)

3. Order insert-then-save so the saved snapshot always includes the image. In
   `insertImageFileIntoEditor`, ensure the `<img>` is in the editor DOM before any save captures
   `currentDraft()`. After fix #2, the create-first save at line ~2368 will no longer wipe the
   editor, so inserting the img after it is safe. Confirm the final `saveNote()` at line ~2382 is
   the one that persists, and that its `currentDraft()` reads the editor AFTER `insertImageUrl` ran.

4. Serialize the multi-image loop correctly. In `uploadAttachmentFiles` (line ~2399), uploading and
   inserting each image is fine, but do a SINGLE `saveNote()` after the loop rather than relying on
   each `insertImageFileIntoEditor` to persist. Either pass a flag to `insertImageFileIntoEditor`
   to skip its internal save, or strip the internal save and save once at the end. This removes the
   overlapping-save contention entirely for the common multi-file case.

5. Make the success status honest. In `insertImageFileIntoEditor`, only report
   "Image embedded" when the final save returned a truthy saved note whose body actually contains
   `attachment.downloadUrl`. If the save was coalesced/queued, report accordingly or await the
   coalesced save's completion before declaring success. This prevents the misleading message that
   masked the bug.

## How to verify the fix

- Embed a single image into a brand-new (unsaved) note. Reload the page. The image must render.
- Embed 3+ images at once into a note (multi-select). Reload. All images must render.
- Embed an image, then immediately edit the title (triggering another save) within the same second.
  Reload. The image must persist.
- After the fix, run `node scripts/recover-inline-images.mjs --dry-run` on a fresh DB created by
  exercising the above. It should report zero missing URLs (no recovery needed).
- Add a regression check: assert that for any image attachment created via the embed flow, the
  owning note's stored body contains the attachment's `/api/attachments/{id}/download` URL.

## Files involved

- `public/app.v58.js` — all fixes land here. Key functions: `saveNote` (~2225), `selectNote`
  (~2752), `insertImageFileIntoEditor` (~2364), `insertImageUrl` (~2280), `uploadAttachmentFiles`
  (~2391), `currentDraft` (~613), `getEditorHtml` (~600), `setEditorHtml` (~615).
- `scripts/recover-inline-images.mjs` — use as the post-fix data check; run it to repair any notes
  already damaged by the old behavior.
- No server-side change is required for this bug. Do not modify `src/http.js`,
  `src/attachmentsRepository.js`, or `src/api.js` for this fix.

## Note on the versioned client files

`index.html` loads `/app.v58.js`. Apply the fix to `public/app.v58.js`. The stale `app.vNN.js`
copies were removed in `91c107e`; if any remain, ignore them — only the file referenced by
`public/index.html` is served.
