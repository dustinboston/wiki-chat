# CLAUDE.md

## Overview

Wiki Chat is a RAG (Retrieval-Augmented Generation) chat app. Users upload PDF/text documents, and the system chunks, embeds, and retrieves relevant content to answer questions via OpenAI GPT-4o.

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
  (chat)/       Chat UI and API routes (/api/chat, /api/files, /api/history)
  db.ts         Database repository functions (pure data access)
  env.ts        Zod-validated environment variables
services/       Business logic layer (auth, chat, file)
ai/             RAG retrieval (rag.ts) and model config (index.ts)
components/     React components (sidebar, navbar, chat, file viewer)
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
pnpm lint           # ESLint (note: broken with spaces in path)
pnpm test           # Run tests (vitest)
pnpm test:watch     # Run tests in watch mode
pnpm test:coverage  # Run tests with coverage
pnpm db:generate    # Generate Drizzle migration from schema changes
pnpm db:migrate     # Run pending migrations
pnpm db:push        # Push schema directly (dev only)
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

- **RAG pipeline** is in `ai/rag.ts` — classifies messages, generates hypothetical answers (HyDE), retrieves chunks by cosine similarity, then augments the prompt. Returns source chunk metadata for provenance tracking.
- **Service layer** in `services/` — business logic (auth, chat, file). Route handlers and pages call services; services call `app/db.ts`.
- **Database repository** is `app/db.ts` — pure data access, no business logic.
- **Schema** is in `schema.ts` — tables: User, Chat, File, Chunk, FileSource.
- **Migrations** live in `drizzle/` and are generated via `pnpm db:generate`.
- The `@/*` path alias maps to the project root.
