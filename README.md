# Wiki Chat

A RAG (Retrieval-Augmented Generation) chat application that lets users upload documents and ask questions about them.

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
- **File** — uploaded documents with auto-increment `id`, `pathname`, LLM-generated `title`, and `userEmail`
- **Chunk** — text chunks belonging to a File, each with an embedding vector
- **Chat** — conversation history stored as JSON messages

### RAG Pipeline

The RAG logic lives in `ai/rag-middleware.ts` and runs as middleware on every chat request:

1. **Classification** — A fast model (GPT-4o-mini) classifies the user message as a question, statement, or other. Only questions trigger RAG.
2. **Hypothetical Document Embedding (HyDE)** — GPT-4o-mini generates a hypothetical answer to the question, which is then embedded. This produces better retrieval than embedding the question directly.
3. **Retrieval** — All chunks from the user's selected files are fetched. Each chunk's embedding is compared to the hypothetical answer embedding via cosine similarity. The top 10 chunks are selected.
4. **Augmented Generation** — The top chunks are injected into the user's message as context. GPT-4o generates the final answer.

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

### URL-Based Selection State

Selected files are stored in the URL as repeated `s` query parameters with numeric file IDs (e.g., `?s=12&s=47`), making selections shareable via URL.

## Development

```bash
pnpm install
pnpm dev
```

### Database

```bash
pnpm db:generate   # Generate migration from schema changes
pnpm db:migrate    # Run pending migrations
pnpm db:push       # Push schema directly (dev only, skips migrations)
```
