import {openai} from '@ai-sdk/openai';
import {RecursiveCharacterTextSplitter} from '@langchain/textsplitters';
import {del, put} from '@vercel/blob';
import {embedMany} from 'ai';
import {z} from 'zod';
import {getPdfContentFromUrl} from '@/utils/pdf';
import {createFileWithChunks} from '@/services/file';
import {auth} from '@/app/(auth)/auth';
import type {FileSourceType} from '@/schema';

function isFileSourceType(value: string): value is FileSourceType {
	return value === 'upload' || value === 'generated' || value === 'manual';
}

const sourceChunkSchema = z.array(z.object({
	chunkId: z.string(),
	fileId: z.number(),
	similarity: z.number(),
}));

export async function POST(request: Request) {
	const {searchParams} = new URL(request.url);
	const filename = searchParams.get('filename');
	const titleParameter = searchParams.get('title');
	const sourceTypeParameter = searchParams.get('sourceType') ?? 'upload';
	const sourceType: FileSourceType = isFileSourceType(sourceTypeParameter) ? sourceTypeParameter : 'upload';

	if (!filename) {
		return new Response('Missing filename parameter', {status: 400});
	}

	const session = await auth();

	if (!session) {
		return Response.redirect('/login');
	}

	const {user} = session;

	if (!user?.email) {
		return Response.redirect('/login');
	}

	if (request.body === null) {
		return new Response('Request body is empty', {status: 400});
	}

	const contentType = request.headers.get('content-type') ?? '';
	let content: string;
	let sourceChunks: z.infer<typeof sourceChunkSchema> = [];

	if (contentType.includes('application/pdf')) {
		const {downloadUrl, url} = await put(
			`${user.email}/${filename}`,
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
		}).parse(json);
		content = parsed.content;
		sourceChunks = parsed.sourceChunks ?? [];
	} else {
		content = await request.text();
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
		userEmail: user.email,
		sourceType,
		chunks: chunkedContent.map((chunk, i) => ({
			content: chunk.pageContent,
			embedding: embeddings[i],
		})),
		sourceChunks,
	});

	return Response.json({id: fileRecord.id});
}
