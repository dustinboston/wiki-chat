import {auth} from '@/app/(auth)/auth';
import {deleteFile} from '@/services/file';

export async function DELETE(request: Request) {
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

	const deleted = await deleteFile({id, userEmail: user.email});
	if (!deleted) {
		return new Response('File not found', {status: 404});
	}

	return Response.json({});
}
