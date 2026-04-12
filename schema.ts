import {type Message} from 'ai';
import {type InferSelectModel} from 'drizzle-orm';
import {
	pgTable,
	varchar,
	text,
	real,
	timestamp,
	json,
	serial,
	integer,
} from 'drizzle-orm/pg-core';

export type FileSourceType = 'upload' | 'generated' | 'manual';

export const user = pgTable('User', {
	email: varchar('email', {length: 64}).primaryKey().notNull(),
	password: varchar('password', {length: 64}),
});

export const chat = pgTable('Chat', {
	id: text('id').primaryKey().notNull(),
	createdAt: timestamp('createdAt').notNull(),
	messages: json('messages').$type<Message[]>().notNull(),
	author: varchar('author', {length: 64})
		.notNull()
		.references(() => user.email),
});

export const file = pgTable('File', {
	id: serial('id').primaryKey(),
	pathname: text('pathname').notNull(),
	title: text('title'),
	sourceType: varchar('sourceType', {length: 16}).notNull().default('upload').$type<FileSourceType>(),
	userEmail: varchar('userEmail', {length: 64})
		.notNull()
		.references(() => user.email),
	createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export const chunk = pgTable('Chunk', {
	id: text('id').primaryKey().notNull(),
	fileId: integer('fileId')
		.notNull()
		.references(() => file.id),
	content: text('content').notNull(),
	embedding: real('embedding').array().notNull(),
});

export const fileSource = pgTable('FileSource', {
	id: serial('id').primaryKey(),
	fileId: integer('fileId')
		.notNull()
		.references(() => file.id),
	sourceChunkId: text('sourceChunkId')
		.notNull()
		.references(() => chunk.id),
	similarity: real('similarity').notNull(),
});

export type Chat = InferSelectModel<typeof chat>;

export type File = InferSelectModel<typeof file>;
export type Chunk = InferSelectModel<typeof chunk>;
export type FileSource = InferSelectModel<typeof fileSource>;
