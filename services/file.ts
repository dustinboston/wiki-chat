import {
	createFile as dbCreateFile,
	insertChunks as dbInsertChunks,
	insertFileSources as dbInsertFileSources,
	getChunksByFileIds,
	getFilesByUser,
	getFileById,
	deleteFileById as dbDeleteFileById,
	insertAuditLog,
	getSourcesByFileId,
	getDerivedFilesByFileId,
	getTopChunksForFileIds,
} from '@/app/db';
import type {FileSourceType} from '@/schema';

export async function createFileWithChunks({
	pathname,
	title,
	userEmail,
	sourceType,
	chunks,
	sourceChunks,
}: {
	pathname: string;
	title: string | null;
	userEmail: string;
	sourceType: FileSourceType;
	chunks: Array<{content: string; embedding: number[]}>;
	sourceChunks: Array<{chunkId: string; fileId: number; similarity: number}>;
}) {
	const fileRecord = await dbCreateFile({
		pathname, title, userEmail, sourceType,
	});

	await dbInsertChunks({
		chunks: chunks.map((c, i) => ({
			id: `${fileRecord.id}/${i}`,
			fileId: fileRecord.id,
			content: c.content,
			embedding: c.embedding,
		})),
	});

	if (sourceChunks.length > 0) {
		await dbInsertFileSources({
			sources: sourceChunks.map(sc => ({
				fileId: fileRecord.id,
				sourceChunkId: sc.chunkId,
				similarity: sc.similarity,
			})),
		});
	}

	return fileRecord;
}

export async function listFiles({email}: {email: string}) {
	return getFilesByUser({email});
}

export async function getFile({id}: {id: number}) {
	return getFileById({id});
}

export async function getFileContent({id, userEmail}: {id: number; userEmail: string}) {
	const file = await getFileById({id});
	if (file?.userEmail !== userEmail) {
		return null;
	}

	const chunks = await getChunksByFileIds({fileIds: [id]});
	return {file, chunks};
}

export async function deleteFile({id, userEmail}: {id: number; userEmail: string}) {
	const file = await getFileById({id});
	if (file?.userEmail !== userEmail) {
		return null;
	}

	await dbDeleteFileById({id});
	await insertAuditLog({
		actor: userEmail,
		action: 'delete_file',
		resourceType: 'File',
		resourceId: String(id),
	});
	return file;
}

export async function getFileSources({id, userEmail}: {id: number; userEmail: string}) {
	const file = await getFileById({id});
	if (file?.userEmail !== userEmail) {
		return null;
	}

	const rawSources = await getSourcesByFileId({fileId: id});
	const sourceMap = new Map<number, {
		fileId: number;
		title: string | null;
		pathname: string;
		similarity: number;
	}>();

	for (const row of rawSources) {
		const existing = sourceMap.get(row.sourceFileId);
		if (!existing || row.similarity > existing.similarity) {
			sourceMap.set(row.sourceFileId, {
				fileId: row.sourceFileId,
				title: row.sourceFileTitle,
				pathname: row.sourceFilePathname,
				similarity: row.similarity,
			});
		}
	}

	const sources = [...sourceMap.values()]
		.toSorted((a, b) => b.similarity - a.similarity);

	const derived = await getDerivedFilesByFileId({fileId: id});

	return {
		sourceType: file.sourceType,
		sources,
		derived: derived.map(d => ({
			fileId: d.derivedFileId,
			title: d.derivedFileTitle,
			pathname: d.derivedFilePathname,
		})),
	};
}

export {getChunksByFileIds, getTopChunksForFileIds} from '@/app/db';
