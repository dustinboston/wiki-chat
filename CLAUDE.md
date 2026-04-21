# CLAUDE.md

## Overview

Wiki Chat is a RAG (Retrieval-Augmented Generation) chat app. Users upload PDF/text documents, and the system chunks, embeds, and retrieves relevant content to answer questions via OpenAI GPT-4o. Users can also save assistant responses as generated notes, write standalone or article-attached notes, highlight text to anchor notes to specific passages, and expand sparse notes via an ephemeral modal chat.

## Tech Stack

- **Framework:** Next.js (App Router) with TypeScript (`strict: true`)
- **LLM / Embeddings:** OpenAI via Vercel AI SDK (`ai` package)
- **Database:** PostgreSQL (Neon serverless) via Drizzle ORM
- **Auth:** NextAuth (v5 beta, credentials provider)
- **Blob Storage:** Vercel Blob (temporary PDF storage during upload)
- **Tests:** Vitest + React Testing Library

## Project Structure

```
app/            Next.js App Router pages and API routes
  (auth)/       Auth pages (login, register) and NextAuth config
  (chat)/       Chat UI, notes pages (/notes/[id]), and API routes
                  (/api/chat, /api/files/{upload,content,sources,delete,list}, /api/history)
  db.ts         Database repository functions (pure data access)
  env.ts        Zod-validated environment variables
services/       Business logic layer (auth, chat, file)
ai/             RAG retrieval (rag.ts) and model config (index.ts)
components/     React components (sidebar, navbar, chat, note-page, note-composer, etc.)
hooks/          Client hooks (e.g., use-recently-viewed)
scripts/        One-off scripts (e.g., reset-db)
schema.ts       Drizzle ORM table definitions
drizzle/        SQL migration files
utils/          Utility functions (PDF parsing)
__tests__/      Test files
```

## Commands

```bash
pnpm dev            # Start dev server (localhost:3000)
pnpm build          # Production build
pnpm start          # Start production server
pnpm lint           # Run xo (lint)
pnpm lint:fix       # Run xo --fix
pnpm test           # Run tests (vitest)
pnpm test:watch     # Run tests in watch mode
pnpm test:coverage  # Run tests with coverage
pnpm db:generate    # Generate Drizzle migration from schema changes
pnpm db:migrate     # Run pending migrations
pnpm db:push        # Push schema directly (dev only)
pnpm db:reset       # Drop + recreate local DB (tsx scripts/reset-db.ts)
```

## Environment Variables

All required env vars are validated at startup via Zod in `app/env.ts`.

| Variable | Purpose |
|---|---|
| `POSTGRES_URL` | Neon PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key (used by AI SDK) |
| `AUTH_SECRET` | NextAuth session encryption secret |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token |

Create `.env.local` with these values for local development.

## Key Patterns

- **RAG pipeline** is in `ai/rag.ts` — classifies messages, generates hypothetical answers (HyDE), and retrieves top chunks via pgvector cosine similarity (SQL-side, using an HNSW index on `Chunk.embedding`). Returns source chunk metadata for provenance tracking.
- **Service layer** in `services/` — business logic (auth, chat, file). Route handlers and pages call services; services call `app/db.ts`.
- **Database repository** is `app/db.ts` — pure data access, no business logic.
- **Schema** is in `schema.ts` — tables: User, Chat, File, Chunk, FileSource, AuditLog. `Chunk.embedding` is `vector(1536)` with an HNSW cosine index.
- **File source types** — `File.sourceType` is one of `'upload'` (PDF/text), `'manual'` (user-written note), or `'generated'` (note created from an assistant reply). Expand/overwrite/edit are gated to `'manual'` and `'generated'`.
- **Notes** — notes reuse the File + Chunk pipeline. Viewing a note is a full route at `/notes/[id]` (`components/note-page.tsx`). Notes can attach to a parent file and/or a highlighted passage via `FileSource.quotedText`. Expansion is an ephemeral modal chat (`components/note-expander.tsx`) that hits `/api/chat` with a `noteContext` that skips RAG and persistence. Overwrite and inline edit both PATCH `/api/files/content`, which re-chunks + re-embeds and writes an audit log.
- **Soft-delete** — Chat and File tables have a `deletedAt` column. Deletes set this timestamp instead of removing rows. All queries filter out soft-deleted records.
- **Audit logging** — destructive operations (`delete_chat`, `delete_file`, `replace_file_content`) write to the AuditLog table (actor, action, resourceType, resourceId). See `SECURITY.md` for details.
- **Migrations** live in `drizzle/` and are generated via `pnpm db:generate`.
- The `@/*` path alias maps to the project root.
