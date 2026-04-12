import {auth} from '@/app/(auth)/auth';
import {listFiles} from '@/services/file';

export async function GET() {
	const session = await auth();

	if (!session) {
		return Response.redirect('/login');
	}

	const {user} = session;

	if (!user?.email) {
		return Response.redirect('/login');
	}

	const files = await listFiles({email: user.email});

	return Response.json(files.map(f => ({
		id: f.id,
		pathname: f.pathname,
		title: f.title,
		sourceType: f.sourceType,
	})));
}
