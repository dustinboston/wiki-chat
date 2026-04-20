# Security

## Secrets Management

### Strategy

| Environment | Method | Details |
|---|---|---|
| Local development | `.env.local` file | Plain-text, gitignored. Never committed. |
| Production (Vercel) | Vercel Environment Variables | Encrypted at rest, injected at build/runtime. Scoped per environment (Production, Preview, Development). |

### Required Secrets

| Variable | Purpose | Rotation Cadence |
|---|---|---|
| `POSTGRES_URL` | Neon PostgreSQL connection string | Rotate if compromised or on credential cycle |
| `OPENAI_API_KEY` | OpenAI API key for embeddings and chat | Rotate quarterly or if compromised |
| `AUTH_SECRET` | NextAuth session encryption key | Rotate on auth incidents; requires all sessions to re-authenticate |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage access token | Rotate if compromised |

### Key Rotation

1. Generate the new secret value.
2. Set it in the Vercel dashboard under **Settings > Environment Variables**.
3. Redeploy the application so the new value takes effect.
4. Revoke the old secret in the issuing service (OpenAI dashboard, Neon console, etc.).

For `AUTH_SECRET`, rotation invalidates all active user sessions. Plan rotation during low-traffic windows.

### Validation

All required environment variables are validated at startup via Zod in `app/env.ts`. The application will fail fast with a clear error if any secret is missing or empty.

## Destructive Operations

All delete operations use **soft-delete** (`deletedAt` timestamp) rather than hard deletes. Every destructive action is recorded in the `AuditLog` table with:

- `actor` -- the user who performed the action
- `timestamp` -- when it occurred
- `action` -- what was done (`delete_chat`, `delete_file`)
- `resourceType` -- the entity type (`Chat`, `File`)
- `resourceId` -- the entity identifier

Client-side delete buttons require confirmation before proceeding.

## API Input Validation

- `POST /api/chat` -- request body validated with Zod schema (`id`, `messages`, `selectedFileIds`).
- `POST /api/files/upload` -- query params validated with Zod; filename is sanitized (path traversal characters stripped, length capped at 255). JSON body validated with Zod when content type is `application/json`.
- `DELETE /api/history` -- requires authenticated session and `id` query param.
- `DELETE /api/files/delete` -- requires authenticated session, `id` query param parsed as integer.
- `GET /api/files/content`, `GET /api/files/sources` -- require authenticated session, `id` parsed as integer.
