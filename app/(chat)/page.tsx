import {generateId} from 'ai';
import {Chat} from '@/components/chat';

export default async function Page() {
	return <Chat id={generateId()} initialMessages={[]} />;
}
