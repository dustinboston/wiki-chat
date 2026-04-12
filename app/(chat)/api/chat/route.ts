import {type Message, streamText} from 'ai';
import {z} from 'zod';
import {customModel} from '@/ai';
import {auth} from '@/app/(auth)/auth';
import {createMessage} from '@/app/db';

function isMessage(item: unknown): item is Message {
	return typeof item === 'object'
		&& item !== null
		&& 'role' in item
		&& 'content' in item;
}

function isMessageArray(value: unknown): value is Message[] {
	return Array.isArray(value) && value.every(item => isMessage(item));
}

const chatRequestSchema = z.object({
	id: z.string(),
	messages: z.custom<Message[]>(isMessageArray),
	selectedFileIds: z.array(z.number()),
});

const system = `
You are an expert researcher. Keep your responses concise and helpful.

Your job is to answer the users question in the form of a brief article.
Articles should be four paragraphs, unless the user asks a simple question
that can be answered in a sentence or less. Use the documents that you have as 
a primary source, filling in gaps with your own knowledge of a topic.

Once you have completed the article, examine it closely for inaccurate or false
statements. You must ensure that it is factually correct. Do not make up answers.
Do not omit relevant details.

Do not address the user directly or acknowledge the question. Simply respond
with the article, which should stand on its own.

IMPORTANT: Always format your response as follows:
- Line 1 must be a short title (5 words or fewer) summarizing your answer.
- Line 2 must be a blank line.
- Line 3 onward is the actual response content. Four paragraphs or less.
`;

export async function POST(request: Request) {
	const json: unknown = await request.json();
	const {id, messages, selectedFileIds} = chatRequestSchema.parse(json);

	const session = await auth();

	if (!session?.user?.email) {
		return new Response('Unauthorized', {status: 401});
	}

	const userEmail = session.user.email;

	const result = streamText({
		model: customModel,
		temperature: 0,
		system,
		messages,
		experimental_providerMetadata: {
			files: {
				selection: selectedFileIds,
			},
		},
		async onFinish({text}) {
			await createMessage({
				id,
				messages: [...messages, {id, role: 'assistant' as const, content: text}],
				author: userEmail,
			});
		},
		experimental_telemetry: {
			isEnabled: true,
			functionId: 'stream-text',
		},
	});

	return result.toDataStreamResponse({});
}
