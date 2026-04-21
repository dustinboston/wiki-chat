import { auth } from '@/app/(auth)/auth';
import { deleteChat, listChats } from '@/services/chat';

export async function GET() {
	const session = await auth();

	if (!session?.user?.email) {
		return Response.json('Unauthorized!', { status: 401 });
	}

	const chats = await listChats({ email: session.user.email });
	return Response.json(chats);
}

export async function DELETE(request: Request) {
	const { searchParams } = new URL(request.url);

	const session = await auth();

	if (!session?.user?.email) {
		return Response.json('Unauthorized!', { status: 401 });
	}

	const id = searchParams.get('id');

	if (!id) {
		return new Response('Chat ID not provided', { status: 400 });
	}

	const deleted = await deleteChat({ id, userEmail: session.user.email });
	if (!deleted) {
		return new Response('Chat not found', { status: 404 });
	}

	return Response.json({});
}
