# PRD: Research-to-Knowledge-Base Workflow

## Overview

Enable users to generate LLM responses in the chat interface and save those responses directly into the knowledge base as queryable documents. Users can then select those saved documents alongside uploaded PDFs when querying the RAG system.

---

## Problem

Currently the knowledge base only accepts PDF uploads. If a user asks the LLM a question and receives a useful answer, there is no way to persist that answer for future reference or include it as context in follow-up queries. Users must manually copy responses, create documents, and re-upload them — a friction-heavy process that interrupts the research workflow.

---

## Goal

A seamless loop: ask a question → get a response → save it to the knowledge base → query against it later.

---

## User Stories

1. **As a user**, I want to save any assistant message from the chat as a knowledge base document, so I can reference it in future queries without re-asking.
2. **As a user**, I want to give the saved document a descriptive name, so I can identify it in the file list.
3. **As a user**, I want to select saved research documents alongside uploaded PDFs when composing a query, so my RAG queries can draw from both sources.
4. **As a user**, I want to delete saved research documents from the knowledge base, using the same flow as uploaded files.

---

## Workflow

```
Chat response received
        ↓
User clicks "Save to Knowledge Base" on an assistant message
        ↓
User enters a document name (pre-filled suggestion)
        ↓
POST /api/files/save
  - Chunks and embeds the response text
  - Stores chunks in the Chunk table with filePath = "{email}/research/{name}"
        ↓
Document appears in the Files modal with a "Research" label
        ↓
User selects it alongside other documents and submits a query
        ↓
RAG middleware retrieves relevant chunks as normal
```

---

## Scope

### In Scope

- Save button on assistant messages in `components/message.tsx`
- Name input prompt (inline, not a modal) with a generated default (e.g., "Research – {first 6 words of response}")
- `POST /api/files/save` route that accepts `{ content: string, name: string }`, chunks, embeds, and upserts into the `Chunk` table
- File list distinguishes research documents from uploaded PDFs (prefix or badge)
- Delete works the same as uploaded files — removes chunks by `filePath`

### Out of Scope

- Editing a saved research document after creation
- Versioning or history of research documents
- Sharing research documents across users
- Saving partial selections (always saves the full message)

---

## API Design

### `POST /api/files/save`

**Request body:**
```json
{
  "content": "Full text of the assistant message",
  "name": "User-provided document name"
}
```

**Behavior:**
1. Authenticate session — return 401 if not logged in
2. Validate `content` and `name` are non-empty strings
3. Split `content` with `RecursiveCharacterTextSplitter` (chunkSize: 1000, same as upload)
4. Embed chunks with `text-embedding-3-small`
5. Delete existing chunks for `filePath = "{email}/research/{name}"` (supports re-save / overwrite)
6. Insert new chunks
7. Return `{ pathname: "research/{name}" }`

**filePath convention:** `{email}/research/{name}`
This distinguishes research docs from uploaded files (`{email}/{filename}`) in the `Chunk` table without a schema change.

### `GET /api/files/list` (update)

No route change needed. `getFilesByUser` already returns all `filePath` values for the user. The UI can detect the `research/` prefix to render a badge.

### `DELETE /api/files/delete` (no change)

Deletes by `pathname`, which maps to `filePath = "{email}/{pathname}"`. Works as-is for research docs since their pathname is `research/{name}`.

---

## Data Model

No schema changes required. The existing `Chunk` table stores all document types. The `filePath` prefix convention (`research/`) provides the distinction.

```
Chunk
  id         = "{email}/research/{name}/{chunkIndex}"
  filePath   = "{email}/research/{name}"
  content    = chunk text
  embedding  = vector
```

---

## UI Changes

### `components/message.tsx`

- Add a "Save to Knowledge Base" button (icon + tooltip) on assistant messages
- On click, show an inline name input pre-filled with a slug derived from the first ~8 words of the message
- On confirm, POST to `/api/files/save` and show a success/error toast via `sonner`

### `components/files.tsx`

- In the file list, detect pathnames starting with `research/` and render a small badge (e.g., "Research") next to the filename
- Strip the `research/` prefix from the display name for readability

---

## Success Criteria

- A user can save an assistant response in under 5 seconds with 2 interactions (click save, confirm name)
- Saved documents appear in the file list immediately after saving (optimistic update)
- Saved documents are retrievable in RAG queries — the correct chunks surface when querying against them
- Deleting a saved document removes it from the list and from future query context
- No schema migrations required

---

## Open Questions

1. Should the save button appear on all assistant messages or only the most recent one?
2. Should re-saving with the same name overwrite silently or prompt the user?
3. Should research documents be prefixed in the display name (e.g., "Research: {name}") or indicated only by a badge?
