# Wiki Chat

![A large W inside of a chat bubble](./logo.png)

A RAG (Retrieval-Augmented Generation) chat application that lets users upload documents and ask questions about them. Built with Next.js, OpenAI, and PostgreSQL.

## Features

- Upload PDF or text documents and chat with their contents
- RAG pipeline with HyDE (Hypothetical Document Embedding) and pgvector-backed cosine similarity search
- LLM-generated titles for uploaded documents and chat responses
- Save assistant replies as generated notes, write standalone or article-attached notes, and anchor notes to highlighted passages
- Full-page notes at `/notes/[id]` with a Recently Viewed bar, inline editing, and an "Expand" modal chat for developing sparse notes into full articles
- Provenance tracking: each generated note remembers the source chunks it was derived from
- Soft-delete and audit logging for destructive operations
- Shareable file selections via URL query parameters
- Email/password authentication via NextAuth

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/)
- A [Neon](https://neon.tech/) PostgreSQL database (or compatible Postgres instance)
- An [OpenAI API key](https://platform.openai.com/)
- A [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store (for PDF processing)

### Installation

```bash
pnpm install
```

### Environment Variables

Create a `.env.local` file with:

```ini
OPENAI_API_KEY=
POSTGRES_URL=
BLOB_READ_WRITE_TOKEN=
AUTH_SECRET=
```

### Database Setup

```bash
pnpm db:generate   # Generate migration from schema changes
pnpm db:migrate    # Run pending migrations
pnpm db:push       # Push schema directly (dev only, skips migrations)
```

### Running

```bash
pnpm dev       # Start development server
pnpm build     # Production build
pnpm start     # Start production server
pnpm lint      # Run biome check
pnpm lint:fix  # Run biome check --write
pnpm format    # Run biome format --write
pnpm test      # Run vitest
```

## Architecture

### Stack

- **Framework:** Next.js (App Router)
- **LLM:** OpenAI GPT-4o via Vercel AI SDK
- **Embeddings:** OpenAI text-embedding-3-small
- **Database:** PostgreSQL (Neon) via Drizzle ORM
- **Blob Storage:** Vercel Blob (temporary, for PDF processing)
- **Auth:** NextAuth

### Schema

- **User** — email/password authentication
- **File** — documents with auto-increment `id`, `pathname`, LLM-generated `title`, `userEmail`, `sourceType` (`'upload'` | `'manual'` | `'generated'`), and `deletedAt` for soft-delete
- **Chunk** — text chunks belonging to a File, each with a `vector(1536)` embedding backed by an HNSW cosine index
- **FileSource** — lineage between a generated/note File and the source Chunks it was derived from; `quotedText` optionally anchors the relationship to a highlighted passage
- **Chat** — conversation history stored as JSON messages, with `deletedAt` for soft-delete
- **AuditLog** — records destructive actions (`delete_chat`, `delete_file`, `replace_file_content`) with actor, timestamp, and resource info

### RAG Pipeline

The RAG logic lives in `ai/rag.ts` and runs on every chat request:

1. **Classification** — A fast model (GPT-4o-mini) classifies the user message as a question, statement, or other. Only questions trigger RAG.
2. **Hypothetical Document Embedding (HyDE)** — GPT-4o-mini generates a hypothetical answer to the question, which is then embedded. This produces better retrieval than embedding the question directly.
3. **Retrieval** — The top chunks across the user's selected files are retrieved via pgvector cosine similarity in SQL (HNSW index on `Chunk.embedding`), so similarity runs in the database rather than streaming every chunk into Node.
4. **Augmented Generation** — The top chunks are injected into the user's message as context. GPT-4o generates the final answer, and source chunk metadata is attached to the assistant message for provenance.

When the chat request includes a `noteContext` (from the note-expander modal), RAG is skipped: the note's title and full content are injected as a system-adjacent message, and the resulting conversation is not persisted.

### Document Upload Flow

1. User uploads a file (PDF or text) via the sidebar.
2. PDFs are temporarily stored in Vercel Blob, extracted to text, then deleted.
3. Text is split into chunks using a recursive character text splitter (1000 chars).
4. All chunks are embedded in batch via `text-embedding-3-small`.
5. A `File` record is created, and chunks are inserted with the file's ID.

### LLM Response Format

The system prompt instructs the LLM to return responses in a structured format:

- **Line 1:** A short title (5 words or fewer)
- **Line 2:** Blank line
- **Line 3+:** The actual response content

The title is stripped from the displayed message and used when saving responses as documents.

### Notes

Notes are stored as regular `File` rows with `sourceType` of `'manual'` (user-written) or `'generated'` (saved from an assistant reply). They share the chunk + embedding pipeline so they participate in retrieval alongside uploaded documents.

- **Creating notes** — from the sidebar composer (standalone), from a note-attached-to-an-article composer, from a text selection inside a note page (highlight-anchored note), or by clicking *Add to Library* on an assistant reply.
- **Lineage** — `FileSource` links a generated note back to the source chunks; `FileSource.quotedText` additionally anchors a manual note to a highlighted passage, which is rendered as a `<mark>` in the parent note.
- **Viewing** — `/notes/[id]` renders the note, its provenance (sources, derived notes, attached notes), and a Recently Viewed bar populated from `localStorage`.
- **Editing / expanding / overwriting** — inline edit, a full "Expand" modal chat seeded with the current note as context, and an "Overwrite Note" button on expander replies. All three paths go through `PATCH /api/files/content`, which re-chunks, re-embeds, and writes an audit log entry (`replace_file_content`). Uploaded PDFs (`sourceType: 'upload'`) are read-only.

### URL-Based Selection State

Selected files are stored in the URL as repeated `s` query parameters with numeric file IDs (e.g., `?s=12&s=47`), making selections shareable via URL.

## License

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). You may share and adapt this work for non-commercial purposes with attribution.
