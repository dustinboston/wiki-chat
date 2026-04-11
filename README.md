# Wiki Chat

![A large W inside of a chat bubble](./logo.png)

A RAG (Retrieval-Augmented Generation) chat application that lets users upload documents and ask questions about them. Built with Next.js, OpenAI, and PostgreSQL.

## Features

- Upload PDF or text documents and chat with their contents
- RAG pipeline with HyDE (Hypothetical Document Embedding) for improved retrieval
- Cosine similarity search over document embeddings
- LLM-generated titles for uploaded documents and chat responses
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
pnpm lint      # Run ESLint
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

## License

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). You may share and adapt this work for non-commercial purposes with attribution.
