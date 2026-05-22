# Mobile And Offline Sync Contract

Batch 18 defines the sync contract for a future mobile app without adding realtime infrastructure.

## Device Registration

Mobile clients should register once per install:

```http
POST /api/devices
```

```json
{
  "deviceKey": "ios-install-uuid",
  "deviceName": "Jack's iPhone"
}
```

The response returns the server `device.id` and `lastSyncCursor`.

`deviceKey` is required and should be stable for one app install. Use an install UUID stored in the mobile keychain or equivalent durable local storage.

If the same `deviceKey` registers again, the server updates the device name and returns the existing device.

## Initial Bootstrap

After login and device registration, mobile clients should fill their local cache with:

```http
GET /api/sync/bootstrap
```

The response includes the current cursor and entity payloads:

```json
{
  "cursor": 123,
  "serverTime": "2026-05-23T00:00:00.000Z",
  "entities": {
    "notes": [],
    "notebooks": [],
    "tags": [],
    "attachments": []
  }
}
```

Store `cursor` as the device's local `last_sync_cursor` only after the entities are successfully written to the local database.

## Cursor Tracking

Clients pull changes from their last known cursor:

```http
GET /api/sync/pull?cursor=0&include=entities
```

`include=entities` returns current entity payloads for create, update, archive, restore, and attachment changes. Delete changes intentionally have no entity payload; remove the local row matching `entityType` and `entityId`.

After a successful local apply, clients update their cursor:

```http
PUT /api/devices/:id/cursor
```

```json
{
  "cursor": 123
}
```

## Local Mobile Cache

Recommended local tables or stores:

1. `notes`
   - `id`
   - `local_id`
   - `notebook_id`
   - `title`
   - `body`
   - `body_format`
   - `favorite`
   - `archived_at`
   - `sync_version`
   - `updated_at`
   - `dirty_state`

2. `notebooks`
   - `id`
   - `name`
   - `sort_order`
   - `updated_at`

3. `tags`
   - `id`
   - `name`

4. `pending_changes`
   - `client_id`
   - `entity_type`
   - `entity_id`
   - `action`
   - `base_sync_version`
   - `data_json`
   - `queued_at`

5. `sync_state`
   - `device_id`
   - `device_key`
   - `last_sync_cursor`
   - `last_success_at`

## Push Contract

Mobile clients push queued note changes with:

```http
POST /api/sync/push
```

```json
{
  "changes": [
    {
      "clientId": "uuid",
      "entityType": "note",
      "action": "update",
      "entityId": 123,
      "baseSyncVersion": 4,
      "data": {
        "title": "Updated title",
        "body": "Updated body",
        "tags": ["mobile"]
      }
    }
  ]
}
```

The response includes a fresh server cursor:

```json
{
  "accepted": 1,
  "rejected": 0,
  "cursor": 124,
  "serverTime": "2026-05-23T00:00:00.000Z",
  "results": []
}
```

If every queued change is either applied or intentionally discarded by the user, update the device cursor to the returned `cursor`.

## Conflict Rule

If `baseSyncVersion` is stale, the server returns `status: "conflict"` and includes `serverNote`.

The client should not overwrite automatically. Show:

1. Local queued edit.
2. Current server note.
3. Choices: keep server, overwrite server, copy local text into a new note.

## Client Apply Order

For bootstrap and pull payloads, apply entities in this order:

1. Notebooks.
2. Notes.
3. Tags and note tag lists from each note.
4. Attachment metadata.
5. Delete changes from the `changes` array.

Attachments sync as metadata first. Download file bytes lazily through each attachment's `downloadUrl`; download thumbnails through `thumbnailUrl` when present.

## Polling

The first mobile version should poll rather than use realtime:

1. Pull on app open.
2. Pull after a successful push.
3. Pull when the app returns to foreground.
4. Poll every 60 to 120 seconds while the app is open and online.

Keep each pull under `limit=250`. If `hasMore` is true, pull again with `nextCursor`.

## Web Offline Queue

The web app now queues failed note saves in `localStorage` under `edge_note_pending_changes_v1`.

When the browser comes back online, it retries queued changes through `/api/sync/push`. Conflicts are surfaced in the editor with the server note and local queued edit side by side. The user can keep the server version, apply the local edit, or load the local edit into the editor for manual review before syncing.
