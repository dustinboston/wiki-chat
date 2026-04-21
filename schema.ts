import type { Message } from 'ai';
import type { InferSelectModel } from 'drizzle-orm';
import {
	index,
	integer,
	json,
	pgTable,
	real,
	serial,
	text,
	timestamp,
	varchar,
	vector,
} from 'drizzle-orm/pg-core';

export type AuditAction = 'delete_chat' | 'delete_file' | 'replace_file_content';

export type FileSourceType = 'upload' | 'generated' | 'manual';

export const user = pgTable('User', {
	email: varchar('email', { length: 64 }).primaryKey().notNull(),
	password: varchar('password', { length: 64 }),
});

export const chat = pgTable('Chat', {
	id: text('id').primaryKey().notNull(),
	createdAt: timestamp('createdAt').notNull(),
	messages: json('messages').$type<Message[]>().notNull(),
	author: varchar('author', { length: 64 })
		.notNull()
		.references(() => user.email),
	deletedAt: timestamp('deletedAt'),
});

export const file = pgTable('File', {
	id: serial('id').primaryKey(),
	pathname: text('pathname').notNull(),
	title: text('title'),
	sourceType: varchar('sourceType', { length: 16 })
		.notNull()
		.default('upload')
		.$type<FileSourceType>(),
	userEmail: varchar('userEmail', { length: 64 })
		.notNull()
		.references(() => user.email),
	createdAt: timestamp('createdAt').notNull().defaultNow(),
	deletedAt: timestamp('deletedAt'),
});

export const chunk = pgTable(
	'Chunk',
	{
		id: text('id').primaryKey().notNull(),
		fileId: integer('fileId')
			.notNull()
			.references(() => file.id),
		content: text('content').notNull(),
		embedding: vector('embedding', { dimensions: 1536 }).notNull(),
	},
	(table) => ({
		embeddingIdx: index('Chunk_embedding_idx').using(
			'hnsw',
			table.embedding.op('vector_cosine_ops'),
		),
	}),
);

export const fileSource = pgTable('FileSource', {
	id: serial('id').primaryKey(),
	fileId: integer('fileId')
		.notNull()
		.references(() => file.id),
	sourceChunkId: text('sourceChunkId')
		.notNull()
		.references(() => chunk.id),
	similarity: real('similarity').notNull(),
	quotedText: text('quotedText'),
});

export const auditLog = pgTable('AuditLog', {
	id: serial('id').primaryKey(),
	actor: varchar('actor', { length: 64 }).notNull(),
	timestamp: timestamp('timestamp').notNull().defaultNow(),
	action: varchar('action', { length: 32 }).notNull().$type<AuditAction>(),
	resourceType: varchar('resourceType', { length: 32 }).notNull(),
	resourceId: text('resourceId').notNull(),
});

export type Chat = InferSelectModel<typeof chat>;

export type File = InferSelectModel<typeof file>;
export type Chunk = InferSelectModel<typeof chunk>;
export type FileSource = InferSelectModel<typeof fileSource>;
export type AuditLog = InferSelectModel<typeof auditLog>;
