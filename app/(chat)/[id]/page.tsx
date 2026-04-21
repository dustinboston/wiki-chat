import { notFound } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { Chat as PreviewChat } from '@/components/chat';
import type { Chat } from '@/schema';
import { getChat } from '@/services/chat';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const chatFromDb = await getChat({ id });

	if (!chatFromDb) {
		notFound();
	}

	const chat: Chat = chatFromDb;

	const session = await auth();

	if (chat.author !== session?.user?.email) {
		notFound();
	}

	return <PreviewChat id={chat.id} initialMessages={chat.messages} />;
}
