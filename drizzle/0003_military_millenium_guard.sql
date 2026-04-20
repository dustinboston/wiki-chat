CREATE TABLE IF NOT EXISTS "AuditLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" varchar(64) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"action" varchar(32) NOT NULL,
	"resourceType" varchar(32) NOT NULL,
	"resourceId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "deletedAt" timestamp;--> statement-breakpoint
ALTER TABLE "File" ADD COLUMN "deletedAt" timestamp;