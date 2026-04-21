import {type Message} from 'ai';
import {drizzle, type PostgresJsDatabase} from 'drizzle-orm/postgres-js';
import {
	and, cosineDistance, desc, eq, inArray, isNull, sql, type InferInsertModel,
} from 'drizzle-orm';
import postgres from 'postgres';
import {
	auditLog, chat, chunk, file, fileSource, user,
	type AuditAction, type FileSourceType,
} from '@/schema';
import {env} from '@/app/env';

let client: ReturnType<typeof postgres> | null = null;
let db: PostgresJsDatabase | null = null;

function getDb() {
	if (!db) {
		client = postgres(`${env.POSTGRES_URL}?sslmode=require`);
		db = drizzle(client);
	}

	return db;
}

export async function getUser(email: string) {
	return getDb().select().from(user).where(eq(user.email, email));
}

export async function createUser(email: string, hashedPassword: string) {
	return getDb().insert(user).values({email, password: hashedPassword});
}

export async function createMessage({
	id,
	messages,
	author,
}: {
	id: string;
	messages: Message[];
	author: string;
}) {
	const selectedChats = await getDb().select().from(chat).where(eq(chat.id, id));

	if (selectedChats.length > 0) {
		return getDb()
			.update(chat)
			.set({
				messages,
			})
			.where(eq(chat.id, id));
	}

	return getDb().insert(chat).values({
		id,
		createdAt: new Date(),
		messages,
		author,
	});
}

export async function getChatsByUser({email}: {email: string}) {
	return getDb()
		.select()
		.from(chat)
		.where(and(eq(chat.author, email), isNull(chat.deletedAt)))
		.orderBy(desc(chat.createdAt));
}

export async function getChatById({id}: {id: string}) {
	const [selectedChat] = await getDb()
		.select()
		.from(chat)
		.where(and(eq(chat.id, id), isNull(chat.deletedAt)));
	return selectedChat;
}

export async function deleteChatById({id}: {id: string}) {
	return getDb()
		.update(chat)
		.set({deletedAt: new Date()})
		.where(eq(chat.id, id));
}

export async function createFile({
	pathname,
	title,
	userEmail,
	sourceType = 'upload',
}: {
	pathname: string;
	title: string | null;
	userEmail: string;
	sourceType?: FileSourceType;
}) {
	const [inserted] = await getDb()
		.insert(file)
		.values({
			pathname, title, userEmail, sourceType,
		})
		.returning();
	return inserted;
}

export async function insertChunks({
	chunks,
}: {
	chunks: Array<InferInsertModel<typeof chunk>>;
}) {
	return getDb().insert(chunk).values(chunks);
}

export async function getChunksByFileIds({
	fileIds,
}: {
	fileIds: number[];
}) {
	return getDb()
		.select()
		.from(chunk)
		.where(inArray(chunk.fileId, fileIds));
}

export async function deleteChunksByFileId({fileId}: {fileId: number}) {
	const db = getDb();
	const chunkIds = await db
		.select({id: chunk.id})
		.from(chunk)
		.where(eq(chunk.fileId, fileId));
	const ids = chunkIds.map(c => c.id);
	if (ids.length > 0) {
		await db.delete(fileSource).where(inArray(fileSource.sourceChunkId, ids));
	}

	await db.delete(chunk).where(eq(chunk.fileId, fileId));
}

export async function getTopChunksForFileIds({
	fileIds,
	queryEmbedding,
	limit,
}: {
	fileIds: number[];
	queryEmbedding: number[];
	limit: number;
}) {
	const distance = cosineDistance(chunk.embedding, queryEmbedding);
	return getDb()
		.select({
			id: chunk.id,
			fileId: chunk.fileId,
			content: chunk.content,
			similarity: sql<number>`1 - (${distance})`,
		})
		.from(chunk)
		.where(inArray(chunk.fileId, fileIds))
		.orderBy(distance)
		.limit(limit);
}

export async function getFilesByUser({email}: {email: string}) {
	return getDb()
		.select()
		.from(file)
		.where(and(eq(file.userEmail, email), isNull(file.deletedAt)))
		.orderBy(desc(file.createdAt));
}

export async function getFileById({id}: {id: number}) {
	const [result] = await getDb()
		.select()
		.from(file)
		.where(and(eq(file.id, id), isNull(file.deletedAt)));
	return result;
}

export async function deleteFileById({id}: {id: number}) {
	return getDb()
		.update(file)
		.set({deletedAt: new Date()})
		.where(eq(file.id, id));
}

export async function insertFileSources({
	sources,
}: {
	sources: Array<{
		fileId: number;
		sourceChunkId: string;
		similarity: number;
		quotedText?: string | null;
	}>;
}) {
	if (sources.length === 0) {
		return;
	}

	return getDb().insert(fileSource).values(sources);
}

export async function insertAuditLog({
	actor,
	action,
	resourceType,
	resourceId,
}: {
	actor: string;
	action: AuditAction;
	resourceType: string;
	resourceId: string;
}) {
	return getDb().insert(auditLog).values({
		actor,
		action,
		resourceType,
		resourceId,
	});
}

export async function getSourcesByFileId({fileId}: {fileId: number}) {
	return getDb()
		.select({
			sourceChunkId: fileSource.sourceChunkId,
			similarity: fileSource.similarity,
			sourceFileId: chunk.fileId,
			sourceFileTitle: file.title,
			sourceFilePathname: file.pathname,
		})
		.from(fileSource)
		.innerJoin(chunk, eq(fileSource.sourceChunkId, chunk.id))
		.innerJoin(file, eq(chunk.fileId, file.id))
		.where(eq(fileSource.fileId, fileId))
		.orderBy(desc(fileSource.similarity));
}

export async function getDerivedFilesByFileId({fileId}: {fileId: number}) {
	return getDb()
		.select({
			derivedFileId: fileSource.fileId,
			derivedFileTitle: file.title,
			derivedFilePathname: file.pathname,
			derivedFileSourceType: file.sourceType,
			sourceChunkId: fileSource.sourceChunkId,
			quotedText: fileSource.quotedText,
		})
		.from(fileSource)
		.innerJoin(chunk, eq(fileSource.sourceChunkId, chunk.id))
		.innerJoin(file, eq(fileSource.fileId, file.id))
		.where(eq(chunk.fileId, fileId))
		.orderBy(fileSource.id);
}
