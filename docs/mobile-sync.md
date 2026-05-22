# Mobile And Offline Sync Contract

Batch 6 defines the sync contract for a future mobile app without adding realtime infrastructure.

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

## Cursor Tracking

Clients pull changes from their last known cursor:

```http
GET /api/sync/pull?cursor=0
```

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

## Conflict Rule

If `baseSyncVersion` is stale, the server returns `status: "conflict"` and includes `serverNote`.

The client should not overwrite automatically. Show:

1. Local queued edit.
2. Current server note.
3. Choices: keep server, overwrite server, copy local text into a new note.

## Web Offline Queue

The web app now queues failed note saves in `localStorage` under `edge_note_pending_changes_v1`.

When the browser comes back online, it retries queued changes through `/api/sync/push`. Conflicts are surfaced in the AI/status panel for review.
