CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "Chunk" ALTER COLUMN "embedding" TYPE vector(1536) USING "embedding"::vector(1536);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Chunk_embedding_idx" ON "Chunk" USING hnsw ("embedding" vector_cosine_ops);
