# EDGE Note Product Scope

## Product Goal

EDGE Note is a private, beautiful Evernote replacement designed for one primary user first, with a path to become a shareable or sellable product later.

The first goal is not to build a large SaaS. The first goal is to replace Evernote in the user's own ecosystem with a reliable, synced notes app that is low-cost, portable, and pleasant enough to use every day.

## Product Promise

Your notes, attachments, tasks, and knowledge should be available everywhere without locking the product behind expensive AI APIs, surprise bandwidth bills, or a single backend provider.

## Positioning

EDGE Note is a local-first, sync-capable notes workspace with open-source AI features powered by Gemma.

It should feel like a modern Evernote replacement:

- fast capture
- clean organization
- rich editing
- mobile sync
- strong search
- helpful AI
- predictable cost
- portable data

## Primary User

The first user is the owner of the app.

The product should solve personal daily use before optimizing for teams, public onboarding, enterprise accounts, or broad-market polish.

Later, if the personal version works well, the same architecture should support sharing with others or turning the project into a paid product.

## Cost Strategy

The app must be designed around free or already-owned infrastructure first.

### Primary Hosting

Hostinger should be treated as the main hosting environment.

The current target plan is Hostinger Business with Node hosting. It provides enough for the first personal version:

- hosted frontend
- Node.js 22.x app runtime
- persistent server process managed by Hostinger
- environment variables
- MySQL databases managed through phpMyAdmin
- Remote MySQL access
- outbound HTTP(S) requests from backend code
- about 50 GB SSD storage, with roughly 1.67 GB currently used
- 600,000 inode limit
- roughly 3 GB RAM available for typical API workloads
- custom domain and subdomain routing
- typical shared-hosting CPU, RAM, I/O, and process limits

This means the first version should be built as a Node/MySQL web app rather than assuming PHP, Supabase, or a VPS.

### Supabase Free

Supabase Free can be used only where it does not create meaningful egress risk.

Acceptable Supabase uses:

- optional authentication
- small user profile records
- small settings records
- lightweight metadata

Avoid Supabase for:

- primary note storage
- attachments
- image/PDF delivery
- realtime note sync
- repeated large reads
- AI processing

One system should own notes. For the first version, Hostinger-owned storage should be the default.

## Architecture Principles

1. Core notes work even if AI is unavailable.
2. Core notes work even if Supabase is unavailable.
3. Attachments are cached and not repeatedly downloaded.
4. AI output is cached and not regenerated unnecessarily.
5. The data model is portable enough to migrate from Hostinger to VPS/Postgres later.
6. The app can become SaaS later without rebuilding the whole product.
7. The app avoids expensive managed-service features until they are truly needed.

## Recommended First Architecture

### Frontend

- Responsive web app hosted on Hostinger
- Mobile-friendly layout from day one
- Later packaged as a mobile app if needed

### Backend

- Hostinger-hosted Node API
- MySQL primary database
- Simple sync endpoints
- Attachment upload/download endpoints
- Export and backup endpoints

The backend should use boring, portable Node and SQL patterns so the app can run well on Hostinger now and migrate to a VPS later if needed.

### Mobile Sync

Mobile should sync through the Hostinger API.

The mobile experience must support:

- fast note capture
- note reading
- note editing
- search
- offline local cache
- background sync when possible
- conflict detection

### AI

Gemma should be the default AI model family because it is open and low-cost.

The Hostinger Business plan should not be expected to run Gemma directly. Gemma should run through a configurable external endpoint, such as:

- local Ollama
- self-hosted Ollama
- self-hosted vLLM
- another OpenAI-compatible endpoint

The Node backend can call that endpoint using outbound HTTP(S). The app should not require a paid AI provider.

## MVP Scope

The first working version should include:

- account/login strategy
- notebooks
- notes
- tags
- rich text editor
- checklists
- attachments
- search
- mobile-responsive interface
- sync API
- local cache strategy
- note export
- basic backup
- Gemma-powered AI actions

## Hostinger Business V1 Constraints

The first version should respect Hostinger Node hosting limits.

Design choices:

- use Node.js 22.x for the backend API
- use MySQL as the source of truth
- use file storage on Hostinger for early attachments
- keep requests short and predictable
- avoid long-running request handlers
- run AI as external HTTP calls, not local model inference
- cache AI results in MySQL
- avoid chatty realtime sync
- use polling or manual sync first
- compress large JSON responses where practical
- paginate notes, search results, and sync changes

Do not assume:

- WebSockets
- durable background workers
- local GPU inference
- PostgreSQL extensions
- vector database extensions
- unlimited database size
- unlimited concurrent long-running requests

## MVP AI Features

AI should be useful but restrained.

First AI actions:

- summarize this note
- clean up this note
- extract tasks
- suggest tags
- create title
- find related notes
- ask questions about selected notes

AI should be manual by default. Background AI can come later.

## Data Model Draft

Core entities:

- users
- notebooks
- notes
- note_versions
- tags
- note_tags
- attachments
- sync_changes
- ai_outputs
- devices

Important note fields:

- id
- user_id
- notebook_id
- title
- body
- body_format
- created_at
- updated_at
- deleted_at
- archived_at
- favorite
- sync_version

Important attachment fields:

- id
- note_id
- filename
- mime_type
- size_bytes
- storage_path
- checksum
- created_at

Important AI output fields:

- id
- note_id
- output_type
- model_name
- input_checksum
- output_json
- created_at

## Sync Strategy

Use a simple incremental sync model first.

Each client stores:

- local notes cache
- local attachment metadata
- last successful sync cursor
- pending local changes

The server exposes:

- pull changes since cursor, paginated
- push local changes in small batches
- resolve conflicts
- upload attachment
- download attachment

Conflict handling should start simple:

- newest edit wins for low-risk metadata
- preserve conflicting note bodies as versions
- never silently delete user writing

## Attachment Strategy

Attachments are the main bandwidth risk.

Rules:

- Do not store attachments in Supabase.
- Store early attachments on Hostinger file storage.
- Cache attachments on device after first download.
- Generate small thumbnails where possible.
- Avoid automatic full-resolution downloads on mobile.
- Track attachment size clearly in the UI.
- Support export so files are not trapped.
- Keep per-file and total attachment limits configurable.
- Prefer lazy download on mobile.

Later options:

- Hostinger file storage
- Cloudflare R2
- Backblaze B2
- MinIO on VPS
- local network storage

## Import and Export

Evernote replacement requires escape hatches.

Early import/export:

- Markdown export
- JSON backup export
- attachment export

Later import:

- Evernote ENEX import
- Markdown folder import
- HTML import

## Design Goals

EDGE Note should feel calm, capable, and premium.

The interface should prioritize:

- fast capture
- easy scanning
- minimal clutter
- strong keyboard support
- clear sync state
- clear offline state
- excellent mobile ergonomics

The main layout should eventually support:

- sidebar for notebooks and tags
- note list
- editor
- AI/context panel

## Later Commercial Readiness

If the personal version works well, the product can evolve toward:

- hosted paid accounts
- user onboarding
- billing
- team notebooks
- sharing
- public links
- web clipper
- OCR
- mobile app store packaging
- hosted Gemma endpoint
- multi-tenant admin tools

These should not complicate the first personal version.

## Out of Scope for Version 1

- team collaboration
- public publishing
- web clipper
- OCR
- handwriting recognition
- advanced document scanning
- enterprise SSO
- billing
- multi-tenant admin dashboard
- full desktop native app
- complex realtime collaboration

## Build Order

1. Create the first Node/MySQL app shell.
2. Create the MySQL schema.
3. Build account/login.
4. Build notes, notebooks, and tags.
5. Build the editor.
6. Add search.
7. Add attachment upload using Hostinger file storage.
8. Add mobile-responsive sync flow.
9. Add AI endpoint settings.
10. Add first Gemma AI actions through outbound HTTP(S).
11. Add export and backup.
12. Add Evernote import.

## Success Criteria

The personal version is successful when:

- the user can create and edit notes daily
- notes sync to mobile reliably
- search finds old notes quickly
- attachments do not create surprise backend costs
- AI saves real time without being required
- data can be exported
- Evernote can be retired for normal use
