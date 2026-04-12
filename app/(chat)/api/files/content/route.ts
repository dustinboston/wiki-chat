import {auth} from '@/app/(auth)/auth';
import {getFileContent} from '@/services/file';

const WORD_LIMIT = 5000;

export async function GET(request: Request) {
	const {searchParams} = new URL(request.url);

	const session = await auth();

	if (!session) {
		return Response.redirect('/login');
	}

	const {user} = session;

	if (!user?.email) {
		return Response.redirect('/login');
	}

	const idParameter = searchParams.get('id');

	if (idParameter === null) {
		return new Response('File ID not provided', {status: 400});
	}

	const id = Number.parseInt(idParameter, 10);
	if (Number.isNaN(id)) {
		return new Response('Invalid file ID', {status: 400});
	}

	const result = await getFileContent({id, userEmail: user.email});
	if (!result) {
		return new Response('File not found', {status: 404});
	}

	let fullContent = result.chunks.map(chunk => chunk.content).join('\n\n');

	const words = fullContent.split(/\s+/v);
	const truncated = words.length > WORD_LIMIT;
	if (truncated) {
		fullContent = words.slice(0, WORD_LIMIT).join(' ');
	}

	return Response.json({content: fullContent, truncated});
}
