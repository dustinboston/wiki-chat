CREATE TABLE IF NOT EXISTS "File" (
	"id" serial PRIMARY KEY NOT NULL,
	"pathname" text NOT NULL,
	"title" text,
	"userEmail" varchar(64) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "File" ADD CONSTRAINT "File_userEmail_User_email_fk" FOREIGN KEY ("userEmail") REFERENCES "public"."User"("email") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "Chunk" ADD COLUMN "fileId" integer;
--> statement-breakpoint
INSERT INTO "File" ("pathname", "userEmail")
SELECT
  split_part("filePath", '/', 2) AS "pathname",
  split_part("filePath", '/', 1) AS "userEmail"
FROM "Chunk"
GROUP BY "filePath";
--> statement-breakpoint
UPDATE "Chunk" c
SET "fileId" = f."id"
FROM "File" f
WHERE c."filePath" = f."userEmail" || '/' || f."pathname";
--> statement-breakpoint
ALTER TABLE "Chunk" ALTER COLUMN "fileId" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_fileId_File_id_fk" FOREIGN KEY ("fileId") REFERENCES "public"."File"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "Chunk" DROP COLUMN IF EXISTS "filePath";
