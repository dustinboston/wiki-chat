import {auth} from '@/app/(auth)/auth';
import {listFiles} from '@/services/file';

export async function GET() {
	const session = await auth();

	if (!session?.user?.email) {
		return new Response('Unauthorized', {status: 401});
	}

	const files = await listFiles({email: session.user.email});

	return Response.json(files.map(f => ({
		id: f.id,
		pathname: f.pathname,
		title: f.title,
		sourceType: f.sourceType,
	})));
}
