import {notFound} from 'next/navigation';
import {type Chat} from '@/schema';
import {getChatById} from '@/app/db';
import {Chat as PreviewChat} from '@/components/chat';
import {auth} from '@/app/(auth)/auth';

export default async function Page({params}: {params: Promise<{id: string}>}) {
	const {id} = await params;
	const chatFromDb = await getChatById({id});

	if (!chatFromDb) {
		notFound();
	}

	const chat: Chat = chatFromDb;

	const session = await auth();

	if (chat.author !== session?.user?.email) {
		notFound();
	}

	return (
		<PreviewChat
			id={chat.id}
			initialMessages={chat.messages}
		/>
	);
}
