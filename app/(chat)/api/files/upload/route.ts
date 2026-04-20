import {openai} from '@ai-sdk/openai';
import {RecursiveCharacterTextSplitter} from '@langchain/textsplitters';
import {del, put} from '@vercel/blob';
import {embedMany} from 'ai';
import {z} from 'zod';
import {getPdfContentFromUrl} from '@/utils/pdf';
import {createFileWithChunks} from '@/services/file';
import {getFileById, getChunksByFileIds} from '@/app/db';
import {auth} from '@/app/(auth)/auth';
import type {FileSourceType} from '@/schema';

function normalizeForMatch(raw: string): string {
	return raw.replaceAll(/\s+/gv, ' ').trim().toLowerCase();
}

function isFileSourceType(value: string): value is FileSourceType {
	return value === 'upload' || value === 'generated' || value === 'manual';
}

const sourceChunkSchema = z.array(z.object({
	chunkId: z.string(),
	fileId: z.number(),
	similarity: z.number(),
}));

function sanitizeFilename(raw: string): string {
	return raw
		.replaceAll(/[\/\\:*?"<>\|]/gv, '_')
		.replaceAll(/\.{2,}/gv, '.')
		.trim()
		.slice(0, 255);
}

const uploadParametersSchema = z.object({
	filename: z.string().min(1, 'Missing filename parameter').transform(sanitizeFilename),
	title: z.string().nullable(),
	sourceType: z.string().refine(isFileSourceType).default('upload'),
});

export async function POST(request: Request) {
	const {searchParams} = new URL(request.url);
	const parameterResult = uploadParametersSchema.safeParse({
		filename: searchParams.get('filename'),
		title: searchParams.get('title'),
		sourceType: searchParams.get('sourceType') ?? 'upload',
	});

	if (!parameterResult.success) {
		return new Response(parameterResult.error.issues[0].message, {status: 400});
	}

	const {filename, title: titleParameter, sourceType} = parameterResult.data;

	const session = await auth();

	if (!session?.user?.email) {
		return new Response('Unauthorized', {status: 401});
	}

	const userEmail = session.user.email;

	if (request.body === null) {
		return new Response('Request body is empty', {status: 400});
	}

	const contentType = request.headers.get('content-type') ?? '';
	let content: string;
	let sourceChunks: z.infer<typeof sourceChunkSchema> = [];
	let parentFileId: number | undefined;
	let quotedText: string | undefined;

	if (contentType.includes('application/pdf')) {
		const {downloadUrl, url} = await put(
			`${userEmail}/${filename}`,
			request.body,
			{
				access: 'public',
			},
		);
		content = await getPdfContentFromUrl(downloadUrl);
		await del(url);
	} else if (contentType.includes('application/json')) {
		const json: unknown = await request.json();
		const parsed = z.object({
			content: z.string(),
			sourceChunks: sourceChunkSchema.optional(),
			parentFileId: z.number().int().positive().optional(),
			quotedText: z.string().min(1).max(10_000).optional(),
		}).parse(json);
		content = parsed.content;
		sourceChunks = parsed.sourceChunks ?? [];
		parentFileId = parsed.parentFileId;
		quotedText = parsed.quotedText;
	} else {
		content = await request.text();
	}

	if (parentFileId !== undefined) {
		const parentFile = await getFileById({id: parentFileId});
		if (!parentFile) {
			return new Response('Parent file not found', {status: 404});
		}

		if (parentFile.userEmail !== userEmail) {
			return new Response('Forbidden', {status: 403});
		}

		const parentChunks = await getChunksByFileIds({fileIds: [parentFileId]});
		if (parentChunks.length === 0) {
			return new Response('Parent file has no chunks', {status: 400});
		}

		const [firstChunk] = parentChunks;
		let anchors = [firstChunk];

		if (quotedText !== undefined) {
			const needle = normalizeForMatch(quotedText).slice(0, 60);
			if (needle.length > 0) {
				const matches = parentChunks.filter(c => normalizeForMatch(c.content).includes(needle));
				if (matches.length > 0) {
					anchors = matches;
				}
			}
		}

		sourceChunks = anchors.map(c => ({
			chunkId: c.id,
			fileId: parentFileId!,
			similarity: 1,
		}));
	}

	const textSplitter = new RecursiveCharacterTextSplitter({
		chunkSize: 1000,
	});
	const chunkedContent = await textSplitter.createDocuments([content]);

	const {embeddings} = await embedMany({
		model: openai.embedding('text-embedding-3-small'),
		values: chunkedContent.map(chunk => chunk.pageContent),
	});

	const fileRecord = await createFileWithChunks({
		pathname: filename,
		title: titleParameter ?? null,
		userEmail: userEmail,
		sourceType,
		chunks: chunkedContent.map((chunk, i) => ({
			content: chunk.pageContent,
			embedding: embeddings[i],
		})),
		sourceChunks,
	});

	return Response.json({id: fileRecord.id});
}
