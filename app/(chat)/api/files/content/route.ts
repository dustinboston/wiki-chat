import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { getFileContent, replaceFileContent } from '@/services/file';

const WORD_LIMIT = 5000;

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);

	const session = await auth();

	if (!session?.user?.email) {
		return new Response('Unauthorized', { status: 401 });
	}

	const userEmail = session.user.email;

	const idParameter = searchParams.get('id');

	if (idParameter === null) {
		return new Response('File ID not provided', { status: 400 });
	}

	const id = Number.parseInt(idParameter, 10);
	if (Number.isNaN(id)) {
		return new Response('Invalid file ID', { status: 400 });
	}

	const result = await getFileContent({ id, userEmail });
	if (!result) {
		return new Response('File not found', { status: 404 });
	}

	let fullContent = result.chunks.map((chunk) => chunk.content).join('\n\n');

	const words = fullContent.split(/\s+/v);
	const truncated = words.length > WORD_LIMIT;
	if (truncated) {
		fullContent = words.slice(0, WORD_LIMIT).join(' ');
	}

	return Response.json({
		content: fullContent,
		truncated,
		title: result.file.title,
		pathname: result.file.pathname,
		sourceType: result.file.sourceType,
	});
}

const patchBodySchema = z.object({
	content: z.string().min(1).max(200_000),
});

export async function PATCH(request: Request) {
	const { searchParams } = new URL(request.url);

	const session = await auth();
	if (!session?.user?.email) {
		return new Response('Unauthorized', { status: 401 });
	}

	const userEmail = session.user.email;

	const idParameter = searchParams.get('id');
	if (idParameter === null) {
		return new Response('File ID not provided', { status: 400 });
	}

	const id = Number.parseInt(idParameter, 10);
	if (Number.isNaN(id)) {
		return new Response('Invalid file ID', { status: 400 });
	}

	const bodyJson: unknown = await request.json();
	const bodyResult = patchBodySchema.safeParse(bodyJson);
	if (!bodyResult.success) {
		return new Response(bodyResult.error.issues[0].message, { status: 400 });
	}

	const result = await replaceFileContent({ id, userEmail, content: bodyResult.data.content });
	if (!result.ok) {
		if (result.reason === 'not_found') {
			return new Response('File not found', { status: 404 });
		}

		if (result.reason === 'forbidden_source_type') {
			return new Response('This file type cannot be overwritten', { status: 403 });
		}
	}

	return Response.json({ ok: true });
}
