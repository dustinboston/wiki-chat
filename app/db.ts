import {type Message} from 'ai';
import {drizzle, type PostgresJsDatabase} from 'drizzle-orm/postgres-js';
import {
	desc, eq, inArray, type InferInsertModel,
} from 'drizzle-orm';
import postgres from 'postgres';
import {genSaltSync, hashSync} from 'bcrypt-ts';
import {
	chat, chunk, file, fileSource, user,
	type FileSourceType,
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

export async function createUser(email: string, password: string) {
	const salt = genSaltSync(10);
	const hash = hashSync(password, salt);

	return getDb().insert(user).values({email, password: hash});
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
		.where(eq(chat.author, email))
		.orderBy(desc(chat.createdAt));
}

export async function getChatById({id}: {id: string}) {
	const [selectedChat] = await getDb().select().from(chat).where(eq(chat.id, id));
	return selectedChat;
}

export async function deleteChatById({id}: {id: string}) {
	return getDb().delete(chat).where(eq(chat.id, id));
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

export async function getFilesByUser({email}: {email: string}) {
	return getDb()
		.select()
		.from(file)
		.where(eq(file.userEmail, email))
		.orderBy(desc(file.createdAt));
}

export async function getFileById({id}: {id: number}) {
	const [result] = await getDb().select().from(file).where(eq(file.id, id));
	return result;
}

export async function deleteFileById({id}: {id: number}) {
	await getDb().delete(fileSource).where(eq(fileSource.fileId, id));
	await getDb().delete(chunk).where(eq(chunk.fileId, id));
	await getDb().delete(file).where(eq(file.id, id));
}

export async function insertFileSources({
	sources,
}: {
	sources: Array<{fileId: number; sourceChunkId: string; similarity: number}>;
}) {
	if (sources.length === 0) {
		return;
	}

	return getDb().insert(fileSource).values(sources);
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
		.selectDistinct({
			derivedFileId: fileSource.fileId,
			derivedFileTitle: file.title,
			derivedFilePathname: file.pathname,
		})
		.from(fileSource)
		.innerJoin(chunk, eq(fileSource.sourceChunkId, chunk.id))
		.innerJoin(file, eq(fileSource.fileId, file.id))
		.where(eq(chunk.fileId, fileId));
}
