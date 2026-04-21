import {notFound, redirect} from 'next/navigation';
import {auth} from '@/app/(auth)/auth';
import {NotePage} from '@/components/note-page';

export default async function Page({params}: {params: Promise<{id: string}>}) {
	const {id} = await params;
	const parsed = Number.parseInt(id, 10);
	if (Number.isNaN(parsed) || parsed <= 0) {
		notFound();
	}

	const session = await auth();
	if (!session?.user?.email) {
		redirect('/login');
	}

	return <NotePage fileId={parsed} />;
}
