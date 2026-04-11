# TODO

## Checklist

### **Module 1: Scaffolding & Configuration**

- **Domain:** Project initialization, environment strictness, and repository metadata.

- **Execution Independence:** Can run immediately upon repository creation.

- **Version Control (`.gitignore`):** Must omit `node_modules`, build directories (`dist`/`build`), `.env` files, OS artifacts, and IDE configs.
  - [x] `.env` (without suffix) is not gitignored — only `.env*.local` is covered. A plain `.env` file would be committed.
  - [x] IDE configs missing: `.vscode/`, `.idea/`, `*.swp`, `*.swo` are not in `.gitignore`.
  - [x] `node_modules`, `/build`, `/.next/`, `/coverage`, `.DS_Store` are covered.
- **Configuration Validation:** Environment variables must be validated at runtime startup (e.g., via Zod or Joi). No hardcoded credentials or environment-specific URIs in source code.
  - [x] No env validation at startup. `app/db.ts:16` checks `POSTGRES_URL` with a plain `if`, but `OPENAI_API_KEY`, `AUTH_SECRET`, and `BLOB_READ_WRITE_TOKEN` are never validated — they silently fail at call sites.
  - [x] Create a shared `env.ts` that validates all required vars with Zod at import time.
  - [x] `drizzle.config.ts:14` uses a non-null assertion (`process.env.POSTGRES_URL!`) instead of validated access.
  - [x] `layout.tsx:12` has a hardcoded Vercel URL for `metadataBase` — should come from an env var.
- **System Documentation (`CLAUDE.md`):** Must exist at root. Requires: system overview, package script definitions, environment setup steps, and architectural links.
  - [x] `CLAUDE.md` does not exist.
- **Licensing:** Default to `CC BY-NC 4.0`. For proprietary code, `package.json` must state `"license": "SEE LICENSE IN <filename>"` and `"private": true`, with a corresponding custom license file.
  - [x] License mismatch: `package.json` says `"CC-BY-4.0"` but the LICENSE file is CC BY-**NC** 4.0. Should be `"CC-BY-NC-4.0"`.
  - [x] `"private": true` is set.
  - [x] LICENSE file exists with correct CC BY-NC 4.0 text.

### **Module 2: Code Quality & Type Safety**

- **Domain:** Static analysis and syntax enforcement.

- **Execution Independence:** Can run as a continuous background linting/typing agent.

- **Type Strictness:** TypeScript `tsconfig.json` must have `"strict": true`. Zero tolerance for `any` types, non-null assertions (`!`), or type casting (`as Type`).
  - [x] `tsconfig.json` has `"strict": true`.
  - [ ] `any` types found in production code:
    - `app/(auth)/auth.ts:16` — `({ email, password }: any)` on credentials authorize.
    - `app/(auth)/auth.ts:20` — `return user[0] as any`.
    - `app/db.ts:42` — `messages: any` parameter in `createMessage`.
    - `app/db.ts:97` — `chunks: any[]` parameter in `insertChunks`.
    - `components/form.tsx:3` — `action: any` prop type.
  - [ ] Non-null assertions (`!`) found:
    - `app/(auth)/auth.ts:19` — `user[0].password!`
    - `app/(chat)/api/chat/route.ts:51` — `session.user?.email!`
    - `app/(chat)/api/files/upload/route.ts:58` — `filename!`
    - `drizzle.config.ts:14` — `process.env.POSTGRES_URL!`
  - [ ] Type castings (`as Type`) in production code:
    - `app/(auth)/actions.ts:15,35` — `formData.get("email") as string`
    - `app/(chat)/[id]/page.tsx:18` — `chatFromDb.messages as Message[]`
- **Linting Rules:** Must implement `xo` configured for maximum strictness. Pre-commit hooks must block non-compliant code.
  - [ ] Currently using only `next/core-web-vitals` — minimal rule set.
  - [ ] `xo` is not installed or configured.
  - [ ] No pre-commit hooks — no `.husky/` directory, no `lint-staged`, no git hooks.
  - [ ] `pnpm lint` is broken — `next lint` fails because the project path contains spaces. Needs a workaround or migration to a standalone linter.
- **Dependency Auditing:** Lockfiles (`package-lock.json` / `yarn.lock` / `pnpm-lock.yaml`) must be present. Automated vulnerability scanning (e.g., `npm audit` or Dependabot) must pass with zero critical/high vulnerabilities.
  - [x] `pnpm-lock.yaml` exists.
  - [ ] No `pnpm audit` script in `package.json`.
  - [ ] No Dependabot or Renovate configuration (`.github/dependabot.yml` missing).
  - [ ] Using release candidate React (`19.0.0-rc-7771d3a7-20240827`) — should pin to a stable release.
  - [ ] Using canary Next.js (`15.6.0-canary.58`) — should pin to a stable release.

### Module 3: Architecture & State

- **Domain:** System design, persistence layers, and local infrastructure.
- **Execution Independence:** Requires schema and system design definitions.

- **Architectural Patterns:** Enforce separation of concerns (e.g., controllers, services, repositories). File structure must reflect domain-driven or strictly layered architecture.
  - [ ] `app/db.ts` mixes repository logic with password hashing (service-level concern) — `createUser` calls `genSaltSync`/`hashSync` directly.
  - [ ] Route handlers call DB functions directly with no service layer — business logic lives in route files.
  - [ ] `proxy.ts` is dead code — it exports NextAuth middleware, but Next.js requires the file to be named `middleware.ts`. The auth middleware never runs.
  - [ ] Rename `proxy.ts` to `middleware.ts` so the auth `authorized` callback actually executes as middleware.
  - [ ] `components/data.ts` contains hardcoded Order/TrackingInformation demo data that is unused by the application — leftover from a template.
- **Data Persistence:** Database schemas (e.g., PostgreSQL for relational, Pinecone for vector data) must use migration scripts. No manual schema modifications.
  - [x] Drizzle ORM with `schema.ts` and two migration files in `drizzle/`.
  - [x] Migration scripts: `0000_pretty_dracula.sql`, `0001_amusing_plazm.sql`.
  - [x] `pnpm db:generate` and `pnpm db:migrate` scripts defined.
- **Containerization:** Local dependencies (databases, cache, messaging queues) must run via `docker-compose.yml`. Applications should have multi-stage `Dockerfile` definitions for production builds.
  - [ ] No `docker-compose.yml` — database is Neon serverless (cloud-only). No local dev fallback.
  - [ ] No `Dockerfile` for the application.

### Module 4: Security & Safeguards

- **Domain:** Threat mitigation, access control, and data protection.
- **Execution Independence:** Can review PRs for security anti-patterns in parallel with testing.

- **Secrets Management:** All cryptographic keys, API tokens, and database credentials must be encrypted at rest and injected via secure managers (e.g., AWS Secrets Manager, HashiCorp Vault). Require key rotation mechanisms.
  - [ ] All secrets are plain-text in `.env.local`. No secrets manager integration.
  - [ ] No key rotation mechanism for `AUTH_SECRET` or `OPENAI_API_KEY`.
  - [ ] Document the secrets management strategy (Vercel environment variables for prod, `.env.local` for dev).
- **Destructive Operations:** Any `DELETE` or `DROP` operations must implement soft-delete (boolean flags) or robust undo mechanisms. All destructive actions require an immutable audit log entry (actor, timestamp, action, resource).
  - [ ] `deleteChatById` (`app/db.ts:77`) performs a hard DELETE with no audit trail.
  - [ ] `deleteFileById` (`app/db.ts:125-128`) hard-deletes both chunks and file records — no soft-delete, no audit log.
  - [ ] Add `deletedAt` timestamp columns to `Chat` and `File` tables for soft-delete.
  - [ ] Create an audit log table (actor, timestamp, action, resourceType, resourceId).
  - [ ] No confirmation prompt on the client — sidebar delete buttons fire immediately.
- **API Contracts:** Endpoints must have defined input/output schemas (e.g., OpenAPI/Swagger) to prevent injection and enforce strict payload boundaries.
  - [ ] No OpenAPI/Swagger definitions.
  - [ ] `POST /api/chat` — `request.json()` is not validated. `id`, `messages`, `selectedFileIds` are destructured with no schema.
  - [ ] `POST /api/files/upload` — `filename` from query params is used unsanitized at `line 58`.
  - [ ] No Zod request-body validation on any API route (Zod is already a dependency).
  - [ ] Add Zod schemas for all API request/response shapes.

### Module 5: Resilience & Traffic Management

- **Domain:** System stability under load and failure conditions.
- **Execution Independence:** Can evaluate network and service-layer code.

- **Error Handling:** Implementation of `try/catch` on all asynchronous operations. Downstream service calls must implement the Circuit Breaker pattern to prevent cascading failures.
  - [ ] `POST /api/chat` (`route.ts`) — no try/catch around `request.json()` or `streamText`. A malformed body crashes the handler.
  - [ ] `POST /api/files/upload` — no try/catch around `put()` (Vercel Blob), `embedMany()` (OpenAI), or `insertChunks()` (DB). Any failure returns an unhandled 500.
  - [ ] `app/db.ts` — zero try/catch on any database function. A connection error propagates as an unhandled exception.
  - [ ] `ai/rag-middleware.ts` — no try/catch around `generateObject`, `generateText`, `embed` (OpenAI calls). A transient OpenAI failure breaks the entire chat.
  - [ ] No circuit breaker for OpenAI or Neon calls.
- **Rate Limiting:** Ingress traffic must be rate-limited by IP or API key. Outbound retry logic must implement exponential backoff with jitter to prevent thundering herd problems.
  - [ ] No rate limiting on any endpoint — `/api/chat`, `/api/files/upload`, `/api/history` are all unprotected.
  - [ ] No exponential backoff on OpenAI API calls.
  - [ ] No retry logic on database operations.

### Module 6: Telemetry & Monitoring

- **Domain:** Observability, health tracking, and incident alerting.
- **Execution Independence:** Can verify infrastructure-as-code and application middleware.

- **Observability (Logs, Metrics, Traces):** Structured JSON logging must be enforced. Spans and traces must follow requests across system boundaries (e.g., OpenTelemetry).
  - [ ] No structured logging anywhere. Only `console.log` in `migrate.ts`.
  - [ ] No OpenTelemetry setup.
  - [x] `streamText` in the chat route has `experimental_telemetry: { isEnabled: true }` — a start, but no collector configured.
- **Monitoring & Alerting:** Integration with APM tools. Endpoints must include a `/health` or `/live` route checking DB connectivity and memory usage. Usage analytics must be tracked without logging PII.
  - [ ] No `/health` or `/live` endpoint.
  - [ ] `@vercel/analytics` is listed as a dependency but never imported or used — add `<Analytics />` to `layout.tsx`.
  - [ ] No APM integration.

### Module 7: Verification & Delivery

- **Domain:** Automated testing and deployment.
- **Execution Independence:** Runs post-build, parallelized across test runners.

- **Test Coverage:** Strict 100% code coverage requirement across three layers:
  - _Unit Tests:_ Isolated logic, mocked dependencies.
    - [x] 7 test files, 51 tests, all passing.
    - [x] Tests exist for: `fetcher`, `data`, `auth-config`, `rag-middleware`, `api-history`, `api-files`, `api-chat`.
    - [ ] No tests for `app/db.ts` (all 13 exported functions untested directly).
    - [ ] No tests for `app/(auth)/actions.ts` (login/register server actions).
    - [ ] No tests for `utils/pdf.ts`.
    - [ ] No component tests (0 of 12 components tested).
  - _Integration Tests:_ Cross-module and database interactions.
    - [ ] All existing tests are mocked — no tests hit a real database or real API.
    - [ ] No integration test infrastructure (test database, seed scripts).
  - _E2E Tests:_ Full user journey simulation.
    - [ ] No E2E test framework (Playwright, Cypress) installed or configured.
    - [ ] No E2E tests for: login, register, upload document, chat, delete.
  - [ ] Run `pnpm test:coverage` and fix files below 100% coverage.

- **CI/CD Pipeline:** Automated pipelines (e.g., GitHub Actions) must execute linting, type-checking, and testing. Merges to `main` require automated semantic release creation and deployment script execution.
  - [ ] No `.github/workflows/` directory — no CI/CD pipeline.
  - [ ] Create a GitHub Actions workflow: lint, type-check, test, build.
  - [ ] No semantic release configuration.
  - [ ] No branch protection rules documented.

### Module 8: Documentation Context

- **Domain:** Knowledge transfer and operational guides.
- **Execution Independence:** Runs asynchronously, reviewing code to update docs.

- **API Documentation:** Auto-generated from code annotations or strict Markdown.
  - [ ] No API documentation. `PRD.md` describes a planned feature, not current endpoints.
  - [ ] Document all 7 API routes: `POST /api/chat`, `GET /api/history`, `DELETE /api/history`, `GET /api/files/list`, `GET /api/files/content`, `POST /api/files/upload`, `DELETE /api/files/delete`.
- **Operational Guides:** Must include a deployment guide, security considerations matrix, and a `CONTRIBUTING.md` outlining local setup and PR standards.
  - [x] `README.md` covers installation, env vars, database setup, running, and architecture.
  - [ ] No `CONTRIBUTING.md`.
  - [ ] No deployment guide (Vercel deployment steps, env var setup in Vercel dashboard).
  - [ ] No security considerations matrix.

### Additional Issues Found

- [ ] **Dead code:** `components/data.ts` exports `ORDERS`, `TRACKING_INFORMATION`, `getOrders`, `getTrackingInformation` — demo data from the original template, unused by the app. Remove it.
- [ ] **Dead code:** `proxy.ts` — intended as Next.js middleware but named wrong. Rename to `middleware.ts` or delete if not needed.
- [ ] **Package name:** `package.json` name is `"ai-sdk-preview-internal-knowledge-base"` — leftover from the template. Rename to `"wiki-chat"`.
- [ ] **Metadata:** `layout.tsx` `metadataBase` points to `ai-sdk-preview-internal-knowledge-base.vercel.app` — update to the actual deployment URL.
