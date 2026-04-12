import {type Message} from 'ai';
import {
	createMessage as dbCreateMessage,
	getChatsByUser,
	getChatById,
	deleteChatById as dbDeleteChatById,
} from '@/app/db';

export async function saveMessage({
	id,
	messages,
	author,
}: {
	id: string;
	messages: Message[];
	author: string;
}) {
	return dbCreateMessage({id, messages, author});
}

export async function listChats({email}: {email: string}) {
	return getChatsByUser({email});
}

export async function getChat({id}: {id: string}) {
	return getChatById({id});
}

export async function deleteChat({id, userEmail}: {id: string; userEmail: string}) {
	const chat = await getChatById({id});
	if (chat?.author !== userEmail) {
		return null;
	}

	await dbDeleteChatById({id});
	return chat;
}
