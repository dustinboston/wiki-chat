import { Message } from "ai";
import { InferSelectModel } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  real,
  timestamp,
  json,
  serial,
  integer,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  email: varchar("email", { length: 64 }).primaryKey().notNull(),
  password: varchar("password", { length: 64 }),
});

export const chat = pgTable("Chat", {
  id: text("id").primaryKey().notNull(),
  createdAt: timestamp("createdAt").notNull(),
  messages: json("messages").notNull(),
  author: varchar("author", { length: 64 })
    .notNull()
    .references(() => user.email),
});

export const file = pgTable("File", {
  id: serial("id").primaryKey(),
  pathname: text("pathname").notNull(),
  title: text("title"),
  userEmail: varchar("userEmail", { length: 64 })
    .notNull()
    .references(() => user.email),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const chunk = pgTable("Chunk", {
  id: text("id").primaryKey().notNull(),
  fileId: integer("fileId")
    .notNull()
    .references(() => file.id),
  content: text("content").notNull(),
  embedding: real("embedding").array().notNull(),
});

export type Chat = Omit<InferSelectModel<typeof chat>, "messages"> & {
  messages: Array<Message>;
};

export type File = InferSelectModel<typeof file>;
export type Chunk = InferSelectModel<typeof chunk>;
