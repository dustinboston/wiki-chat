CREATE TABLE IF NOT EXISTS "FileSource" (
	"id" serial PRIMARY KEY NOT NULL,
	"fileId" integer NOT NULL,
	"sourceChunkId" text NOT NULL,
	"similarity" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "File" ADD COLUMN "sourceType" varchar(16) DEFAULT 'upload' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FileSource" ADD CONSTRAINT "FileSource_fileId_File_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."File"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FileSource" ADD CONSTRAINT "FileSource_sourceChunkId_Chunk_id_fk" FOREIGN KEY ("sourceChunkId") REFERENCES "public"."Chunk"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
